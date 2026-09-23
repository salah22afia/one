package org.gcc.usp.platform.requests;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
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
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * DC-01 end to end on real PostgreSQL and Gotenberg, with the org structure and people served by a stub SAP
 * (SAP-001, SAP-010 … SAP-014): sign in → submit → personnel affairs inbox (by SAP position) → approve → letter issued →
 * HTML/PDF → public verification. Also the access rules and approver resolution (vacancy, no self-approval).
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class EmploymentLetterFlowTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17");

    @Container
    static GenericContainer<?> gotenberg = new GenericContainer<>("gotenberg/gotenberg:8").withExposedPorts(3000);

    static final SapStub sap = new SapStub();

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        r.add("usp.documents.gotenberg-url", () -> "http://" + gotenberg.getHost() + ":" + gotenberg.getMappedPort(3000));
        r.add("usp.sap.base-url", sap::url);
    }

    @AfterAll
    static void stop() {
        sap.close();
    }

    @Autowired MockMvc mvc;
    @Autowired JsonMapper json;

    @Test
    void approversComeFromSapPositions() throws Exception {
        // Majed's line manager position (procurement director) is vacant with no deputy → the DG (superior) gets it.
        var majed = signIn("P-MAJED");
        var r = submit(majed, "MD-05", Map.of("doc", "passport", "number", "A1", "expires", "2030-01-01", "copy", "x.pdf"));
        // MD-05 goes to the personnel pool, so use a line-manager service instead: FN-01.
        var trip = submit(majed, "FN-01", Map.of("dest", "Jeddah", "from", "2030-01-01", "to", "2030-01-03", "purpose", "Workshop"));
        var step = trip.get("steps").get(0);
        assertThat(step.get("assignees").findValuesAsString("id")).containsExactly(sap.employeeNo("P-GM"));
        assertThat(step.get("why").get("en").asString()).contains("moved to the superior");
        assertThat(r.get("steps").get(0).get("assignees").findValuesAsString("id")).doesNotContain(sap.employeeNo("P-MAJED"));

        // Ahmed's line manager is Mona (head of his section).
        var ahmedTrip = submit(signIn("P-AHMED"), "FN-01", Map.of("dest", "Riyadh", "from", "2030-02-01", "to", "2030-02-02", "purpose", "Meeting"));
        assertThat(ahmedTrip.get("steps").get(0).get("assignees").findValuesAsString("id")).containsExactly(sap.employeeNo("P-MONA"));
        var monaInbox = call(get("/api/v1/tasks"), signIn("P-MONA"), null, status().isOk());
        assertThat(monaInbox.findValuesAsString("requestId")).contains(ahmedTrip.get("request").get("id").asString());
    }

    @Test
    void employmentLetterEndToEnd() throws Exception {
        mvc.perform(get("/api/v1/requests")).andExpect(status().isUnauthorized());
        var ahmed = signIn("P-AHMED");
        var noura = signIn("P-NOURA");
        var sara = signIn("P-SARA");

        var invalid = call(post("/api/v1/requests"), ahmed, Map.of("serviceId", "DC-01", "data", Map.of("lang", "ar")), status().isUnprocessableContent());
        assertThat(invalid.get("checks").get(0).get("key").asString()).isEqualTo("required:to");
        assertThat(invalid.get("message").get("ar").asString()).isEqualTo("راجع الحقول المطلوبة");

        var created = submit(ahmed, "DC-01", Map.of("to", "Riyad Bank", "lang", "both", "salary", true, "ignored", "x"));
        var id = created.get("request").get("id").asString();
        assertThat(id).matches("DC-01-\\d{4}-\\d{5}");
        assertThat(created.get("request").get("requester").get("name").get("en").asString()).isEqualTo("Ahmed Al-Dosari");
        assertThat(created.get("fields").findValuesAsString("key")).containsExactly("to", "lang", "salary");
        var review = created.get("steps").get(0);
        assertThat(review.get("status").asString()).isEqualTo("current");
        assertThat(review.get("assignees").findValuesAsString("id")).contains(sap.employeeNo("P-NOURA"));
        assertThat(review.get("mine").asBoolean()).isFalse();
        long stepId = review.get("id").asLong();

        assertThat(call(get("/api/v1/tasks"), noura, null, status().isOk()).findValuesAsString("requestId")).contains(id);
        call(get("/api/v1/requests/" + id), noura, null, status().isOk());
        call(get("/api/v1/requests/" + id), sara, null, status().isForbidden());
        call(post("/api/v1/tasks/" + stepId + "/decision"), sara, Map.of("action", "approve"), status().isForbidden());
        call(post("/api/v1/tasks/" + stepId + "/decision"), noura, Map.of("action", "reject"), status().isUnprocessableContent());

        var done = call(post("/api/v1/tasks/" + stepId + "/decision"), noura, Map.of("action", "approve"), status().isOk());
        assertThat(done.get("request").get("status").asString()).isEqualTo("completed");
        assertThat(done.get("steps").findValuesAsString("status")).containsExactly("done", "done");
        var doc = done.get("documents").get(0);
        var number = doc.get("number").asString();
        assertThat(number).matches("LTR-\\d{4}-\\d{4}");
        assertThat(done.get("audit").findValuesAsString("en")).contains("Request submitted", "Request completed");
        call(post("/api/v1/tasks/" + stepId + "/decision"), noura, Map.of("action", "approve"), status().isConflict());

        var docId = doc.get("id").asString();
        var html = mvc.perform(get("/api/v1/documents/" + docId + "/html").header("Authorization", ahmed)).andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(html).contains("Riyad Bank", "أحمد بن سعود الدوسري", "Ahmed Al-Dosari", "محلل بيانات أول", number, doc.get("verifyCode").asString(), "<svg");
        mvc.perform(get("/api/v1/documents/" + docId + "/html").header("Authorization", sara)).andExpect(status().isForbidden());
        var pdf = mvc.perform(get("/api/v1/documents/" + docId + "/pdf").header("Authorization", ahmed)).andExpect(status().isOk())
            .andReturn().getResponse().getContentAsByteArray();
        assertThat(new String(pdf, 0, 5, StandardCharsets.US_ASCII)).isEqualTo("%PDF-");

        var verified = json.readTree(mvc.perform(get("/api/v1/verify/" + doc.get("verifyCode").asString())).andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8));
        assertThat(verified.get("valid").asBoolean()).isTrue();
        assertThat(verified.get("holder").get("en").asString()).isEqualTo("Ahmed A…");
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

    @SuppressWarnings("unused")
    private static final List<String> NOTE = List.of("MD-05's system step parks as 'waiting for integration' (no SAP write yet).");
}
