package org.gcc.usp.platform.requests;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import org.gcc.usp.testing.SapStub;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultMatcher;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Slice 1.1 on real PostgreSQL with the stub SAP: return → resubmit → approve, withdraw, one decision under concurrent
 * clicks, stale screens (optimistic locking), "done by me", and the paged "My requests" rows. Each test uses its own
 * requester so the tests do not see each other's requests.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class RequestActionsFlowTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17");

    static final SapStub sap = new SapStub();

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        r.add("usp.sap.base-url", sap::url);
    }

    @AfterAll
    static void stop() {
        sap.close();
    }

    @Autowired MockMvc mvc;
    @Autowired JsonMapper json;

    static final Map<String, Object> TRIP = Map.of("dest", "Jeddah", "from", "2030-03-01", "to", "2030-03-03", "purpose", "Workshop");
    static final Map<String, Object> DOC = Map.of("doc", "passport", "number", "A1", "expires", "2030-01-01", "copy", "x.pdf");

    @Test
    void returnResubmitAndApprove() throws Exception {
        var ahmed = signIn("P-AHMED");
        var mona = signIn("P-MONA");
        var nayef = signIn("P-FIN");
        var sara = signIn("P-SARA");

        var created = submit(ahmed, "FN-01", TRIP);
        var id = created.get("request").get("id").asString();
        long stepId = created.get("steps").get(0).get("id").asLong();
        int version = created.get("request").get("version").asInt();
        assertThat(created.get("canWithdraw").asBoolean()).isTrue();
        var decisions = new ArrayList<String>();
        created.get("steps").get(0).get("decisions").forEach(d -> decisions.add(d.asString()));
        assertThat(decisions).containsExactly("approve", "return", "reject");

        // "My requests" row: who has it now (one person → the name), and the progress dots.
        var row = call(get("/api/v1/requests"), ahmed, null, status().isOk()).get("items").get(0);
        assertThat(row.get("id").asString()).isEqualTo(id);
        assertThat(row.get("icon").asString()).isEqualTo("plane");
        assertThat(row.get("waiting").get("holder").get("name").get("en").asString()).isEqualTo("Mona Al-Qahtani");
        assertThat(row.get("steps").findValuesAsString("status")).containsExactly("current", "pending", "pending");

        // Returning needs a reason; a screen showing an older version cannot act.
        var noNote = decide(mona, stepId, Map.of("action", "return"), status().isUnprocessableContent());
        assertThat(noNote.get("checks").get(0).get("key").asString()).isEqualTo("required:note");
        decide(mona, stepId, Map.of("action", "return", "note", "Attach the invitation", "version", version + 5), status().isConflict());
        decide(sara, stepId, Map.of("action", "return", "note", "x"), status().isForbidden());

        var returned = decide(mona, stepId, Map.of("action", "return", "note", "Attach the invitation", "version", version), status().isOk());
        assertThat(returned.get("request").get("status").asString()).isEqualTo("returned");
        assertThat(returned.get("steps").get(0).get("status").asString()).isEqualTo("returned");
        assertThat(returned.get("steps").get(0).get("note").asString()).isEqualTo("Attach the invitation");
        assertThat(returned.get("audit").findValuesAsString("en")).contains("Returned for completion: Attach the invitation");
        assertThat(tasks(mona)).doesNotContain(id);

        var mine = call(get("/api/v1/requests/" + id), ahmed, null, status().isOk());
        assertThat(mine.get("canResubmit").asBoolean()).isTrue();
        assertThat(mine.get("canWithdraw").asBoolean()).isFalse();
        var list = call(get("/api/v1/requests"), ahmed, null, status().isOk());
        assertThat(list.get("counts").get("returned").asInt()).isEqualTo(1);
        assertThat(list.get("items").get(0).get("waiting").get("note").asString()).isEqualTo("Attach the invitation");

        // Only the requester resubmits, with valid data, against the version they saw.
        var withInvitation = new HashMap<String, Object>(TRIP);
        withInvitation.put("invitation", "invitation.pdf");
        int v2 = mine.get("request").get("version").asInt();
        call(post("/api/v1/requests/" + id + "/resubmit"), sara, Map.of("data", withInvitation), status().isForbidden());
        var invalid = call(post("/api/v1/requests/" + id + "/resubmit"), ahmed, Map.of("data", Map.of("dest", "")), status().isUnprocessableContent());
        assertThat(invalid.get("checks").findValuesAsString("key")).contains("required:dest");
        call(post("/api/v1/requests/" + id + "/resubmit"), ahmed, Map.of("data", withInvitation, "version", v2 - 1), status().isConflict());
        var resubmitted = call(post("/api/v1/requests/" + id + "/resubmit"), ahmed, Map.of("data", withInvitation, "version", v2), status().isOk());
        assertThat(resubmitted.get("request").get("status").asString()).isEqualTo("in_review");
        assertThat(resubmitted.get("steps").get(0).get("status").asString()).isEqualTo("current");
        assertThat(absent(resubmitted.get("steps").get(0).path("note"))).as("note cleared on resubmit").isTrue();
        assertThat(resubmitted.get("fields").findValuesAsString("key")).contains("invitation");
        assertThat(resubmitted.get("audit").findValuesAsString("en")).contains("Completed and resubmitted to the same desk");
        assertThat(tasks(mona)).contains(id);
        call(post("/api/v1/requests/" + id + "/resubmit"), ahmed, Map.of("data", withInvitation), status().isConflict());

        // Same step, now approved: the next step goes to the assignments team; the requester can no longer withdraw.
        var approved = decide(mona, stepId, Map.of("action", "approve"), status().isOk());
        assertThat(approved.get("steps").get(1).get("status").asString()).isEqualTo("current");
        assertThat(approved.get("steps").get(1).get("assignees").findValuesAsString("id")).contains(sap.employeeNo("P-FIN"));
        assertThat(tasks(nayef)).contains(id);
        call(post("/api/v1/requests/" + id + "/withdraw"), ahmed, Map.of(), status().isConflict());

        // Tasks → Done: both of Mona's decisions, newest first; the page opens for her.
        var done = call(get("/api/v1/tasks/done"), mona, null, status().isOk());
        var actions = new ArrayList<String>();
        done.get("items").forEach(i -> { if (i.get("requestId").asString().equals(id)) actions.add(i.get("action").asString()); });
        assertThat(actions).containsExactly("approve", "return");
        assertThat(done.get("items").get(0).get("requester").get("name").get("en").asString()).isEqualTo("Ahmed Al-Dosari");
    }

    @Test
    void withdrawBeforeAnyDecision() throws Exception {
        var fahad = signIn("P-FAHAD");
        var noura = signIn("P-NOURA");
        var sara = signIn("P-SARA");
        var created = submit(fahad, "MD-05", DOC);
        var id = created.get("request").get("id").asString();
        long stepId = created.get("steps").get(0).get("id").asLong();
        assertThat(tasks(noura)).contains(id);

        call(post("/api/v1/requests/" + id + "/withdraw"), sara, Map.of(), status().isForbidden());
        var withdrawn = call(post("/api/v1/requests/" + id + "/withdraw"), fahad, Map.of("version", created.get("request").get("version").asInt()), status().isOk());
        assertThat(withdrawn.get("request").get("status").asString()).isEqualTo("withdrawn");
        assertThat(withdrawn.get("steps").findValuesAsString("status")).containsOnly("skipped");
        assertThat(withdrawn.get("audit").findValuesAsString("en")).contains("Withdrawn before any decision");
        assertThat(withdrawn.get("canWithdraw").asBoolean()).isFalse();
        assertThat(tasks(noura)).doesNotContain(id);
        call(post("/api/v1/requests/" + id + "/withdraw"), fahad, Map.of(), status().isConflict());
        decide(noura, stepId, Map.of("action", "approve"), status().isConflict());

        var finished = call(get("/api/v1/requests?view=finished"), fahad, null, status().isOk());
        assertThat(finished.get("items").findValuesAsString("id")).contains(id);
        assertThat(finished.get("counts").get("finished").asInt()).isEqualTo(1);
    }

    @Test
    void concurrentDecisionsDecideOnce() throws Exception {
        var sara = signIn("P-SARA");
        var noura = signIn("P-NOURA");
        var ali = signIn("P-HRSH");
        var created = submit(sara, "MD-05", DOC);
        long stepId = created.get("steps").get(0).get("id").asLong();

        // Two holders of the personnel pool approve at the same moment: exactly one decision is recorded.
        var start = new CountDownLatch(1);
        List<Callable<Integer>> both = List.of(noura, ali).stream().<Callable<Integer>>map(auth -> () -> {
            start.await();
            return mvc.perform(post("/api/v1/tasks/" + stepId + "/decision").header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON).content("{\"action\":\"approve\"}")).andReturn().getResponse().getStatus();
        }).toList();
        try (var pool = Executors.newFixedThreadPool(2)) {
            var futures = both.stream().map(pool::submit).toList();
            start.countDown();
            var codes = new ArrayList<Integer>();
            for (var f : futures) codes.add(f.get());
            assertThat(codes).containsExactlyInAnyOrder(200, 409);
        }
        var detail = call(get("/api/v1/requests/" + created.get("request").get("id").asString()), sara, null, status().isOk());
        assertThat(detail.get("audit").findValuesAsString("en").stream().filter(s -> s.startsWith("Approved")).count()).isEqualTo(1);
    }

    @Test
    void myRequestsArePagedWithReturnedFirst() throws Exception {
        var khalid = signIn("P-KHALID");
        var noura = signIn("P-NOURA");
        var ids = new ArrayList<String>();
        for (int i = 0; i < 3; i++) ids.add(submit(khalid, "MD-05", DOC).get("request").get("id").asString());

        var first = call(get("/api/v1/requests?limit=2"), khalid, null, status().isOk());
        assertThat(first.get("items").size()).isEqualTo(2);
        assertThat(first.get("counts").get("ongoing").asInt()).isEqualTo(3);
        var next = first.get("next").asString();
        var second = call(get("/api/v1/requests?limit=2&cursor=" + next), khalid, null, status().isOk());
        assertThat(second.get("items").size()).isEqualTo(1);
        assertThat(absent(second.path("next"))).as("no further page").isTrue();
        var seen = new ArrayList<String>(first.get("items").findValuesAsString("id"));
        seen.addAll(second.get("items").findValuesAsString("id"));
        assertThat(seen).containsExactlyInAnyOrderElementsOf(ids);
        // A team step shows the team, not a list of names.
        assertThat(first.get("items").get(0).get("waiting").get("who").get("en").asString()).isEqualTo("Personnel Affairs Section team");

        // The oldest one is returned: it comes first.
        var oldest = call(get("/api/v1/requests/" + ids.getFirst()), khalid, null, status().isOk());
        decide(noura, oldest.get("steps").get(0).get("id").asLong(), Map.of("action", "return", "note", "Unreadable copy"), status().isOk());
        var after = call(get("/api/v1/requests?limit=2"), khalid, null, status().isOk());
        assertThat(after.get("items").get(0).get("id").asString()).isEqualTo(ids.getFirst());
        assertThat(after.get("items").get(0).get("status").asString()).isEqualTo("returned");

        call(get("/api/v1/requests?cursor=not-a-cursor"), khalid, null, status().isBadRequest());
        call(get("/api/v1/requests?view=everything"), khalid, null, status().isBadRequest());
        assertThat(call(get("/api/v1/requests?view=finished"), khalid, null, status().isOk()).get("items").size()).isZero();
    }

    private static boolean absent(JsonNode n) {
        return n.isNull() || n.isMissingNode();
    }

    private List<String> tasks(String auth) throws Exception {
        return call(get("/api/v1/tasks"), auth, null, status().isOk()).findValuesAsString("requestId");
    }

    private JsonNode decide(String auth, long stepId, Map<String, Object> body, ResultMatcher expected) throws Exception {
        return call(post("/api/v1/tasks/" + stepId + "/decision"), auth, body, expected);
    }

    /** Signs in through the portal (checked against the stub SAP) and returns the Authorization header value. */
    private String signIn(String key) throws Exception {
        var body = Map.of("username", SapStub.userOf(sap.employeeNo(key)), "password", SapStub.PASSWORD);
        var res = mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        return "Bearer " + json.readTree(res).get("token").asString();
    }

    private JsonNode submit(String auth, String service, Map<String, Object> data) throws Exception {
        return call(post("/api/v1/requests"), auth, Map.of("serviceId", service, "data", data), status().isCreated());
    }

    private JsonNode call(MockHttpServletRequestBuilder req, String auth, Object body, ResultMatcher expected) throws Exception {
        req.header("Authorization", auth);
        if (body != null) req.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        var text = mvc.perform(req).andExpect(expected).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        return text.isEmpty() ? json.nullNode() : json.readTree(text);
    }
}
