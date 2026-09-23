package org.gcc.usp.platform.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import org.gcc.usp.platform.rules.Check;
import org.gcc.usp.platform.shared.LocalizedText;
import org.gcc.usp.testing.MutableClock;
import org.gcc.usp.testing.SapStub;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
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
 * The version machine through its API: bootstrap admin → managers by SAP position → schedule → second approval by the
 * governance position (never the author) → in force on its date → revert; rebase of stale drafts and conflicts.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
@Import(ConfigVersioningTest.Beans.class)
class ConfigVersioningTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17");

    static final SapStub sap = new SapStub();
    static final ZoneId ZONE = ZoneId.of("Asia/Riyadh");
    static final MutableClock clock = new MutableClock(Instant.parse("2026-09-01T09:00:00Z"), ZONE);

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        r.add("usp.sap.base-url", sap::url);
        r.add("usp.admin.bootstrap-employees", () -> sap.employeeNo("P-AHMED"));
    }

    @AfterAll
    static void stop() {
        sap.close();
    }

    @TestConfiguration
    static class Beans {
        @Bean MutableClock clock() { return clock; }
        @Bean ConfigKind lifecycleKind() { return kind("lifecycle"); }
        @Bean ConfigKind rebaseKind() { return kind("rebase"); }

        static ConfigKind kind(String key) {
            return new ConfigKind() {
                public String key() { return key; }
                public JsonNode emptyContent() { return JsonMapper.builder().build().readTree("{\"items\":[],\"rules\":{}}"); }
                public List<Check> problems(JsonNode c) {
                    return c.path("rules").path("broken").asBoolean() ? List.of(new Check("broken", "block", LocalizedText.of("en", "Broken"), null)) : List.of();
                }
            };
        }
    }

    @Autowired MockMvc mvc;
    @Autowired JsonMapper json;

    LocalDate today() {
        return LocalDate.now(clock);
    }

    @Test
    void lifecycleWithSecondApprovalAndRevert() throws Exception {
        var admin = signIn("P-AHMED");
        var mona = signIn("P-MONA");   // S-111
        var hind = signIn("P-HRGM");   // S-200
        var base = "/api/v1/admin/config/lifecycle";

        call(get(base), mona, null, status().isForbidden());
        call(get("/api/v1/admin/config/nope"), admin, null, status().isNotFound());
        assertThat(call(get(base), admin, null, status().isOk()).get("versions")).isEmpty();

        // First version, in force today.
        var v1 = id(call(post(base + "/versions"), admin, null, status().isCreated()));
        call(put(base + "/versions/" + v1 + "/content"), admin, Map.of("content", Map.of("items", List.of(Map.of("id", "a", "v", 1)), "rules", Map.of("x", 1)), "why", "initial"), status().isOk());
        var broken = Map.of("content", Map.of("items", List.of(Map.of("id", "a", "v", 1)), "rules", Map.of("x", 1, "broken", true)), "why", "");
        var draftBroken = id(call(post(base + "/versions"), admin, null, status().isCreated()));
        call(put(base + "/versions/" + draftBroken + "/content"), admin, broken, status().isOk());
        call(post(base + "/versions/" + v1 + "/schedule"), admin, Map.of("from", today().minusDays(1).toString(), "reason", "r"), status().isUnprocessableContent());
        var active = call(post(base + "/versions/" + v1 + "/schedule"), admin, Map.of("from", today().toString(), "reason", "Initial policy", "reference", "Circular 1"), status().isOk());
        assertThat(active.get("version").get("status").asString()).isEqualTo("active");
        assertThat(active.get("changes").findValuesAsString("object")).containsOnly("items.a", "rules");

        // The kind's own check blocks; a draft that changes nothing is refused.
        assertThat(code(call(post(base + "/versions/" + draftBroken + "/schedule"), admin, Map.of("from", today().plusDays(1).toString(), "reason", "r"), status().isUnprocessableContent())))
            .isEqualTo("config.schedule.invalid");
        call(post(base + "/versions/" + draftBroken + "/cancel"), admin, null, status().isOk());
        var empty = id(call(post(base + "/versions"), admin, null, status().isCreated()));
        assertThat(code(call(post(base + "/versions/" + empty + "/schedule"), admin, Map.of("from", today().plusDays(1).toString(), "reason", "r"), status().isUnprocessableContent())))
            .isEqualTo("config.schedule.empty");
        call(post(base + "/versions/" + empty + "/cancel"), admin, null, status().isOk());

        // Managers by SAP position; second approval by the HR general manager's position.
        call(put(base + "/governance"), admin, Map.of("secondApprover", true, "approverPositionId", "S-200", "ownerPositionIds", List.of("S-111")), status().isOk());
        var v2 = id(call(post(base + "/versions"), mona, null, status().isCreated()));
        call(put(base + "/versions/" + v2 + "/content"), mona, Map.of("content", Map.of("items", List.of(Map.of("id", "a", "v", 2)), "rules", Map.of("x", 1)), "why", "raise"), status().isOk());
        var awaiting = call(post(base + "/versions/" + v2 + "/schedule"), mona, Map.of("from", today().plusDays(2).toString(), "reason", "Raise a"), status().isOk());
        assertThat(awaiting.get("version").get("status").asString()).isEqualTo("awaiting");
        call(post(base + "/versions/" + v2 + "/approve"), mona, null, status().isForbidden());
        assertThat(call(get(base), hind, null, status().isOk()).get("canApprove").asBoolean()).isTrue();
        var approved = call(post(base + "/versions/" + v2 + "/approve"), hind, Map.of("note", "ok"), status().isOk());
        assertThat(approved.get("version").get("status").asString()).isEqualTo("scheduled");

        // The approver can never approve their own version.
        call(put(base + "/governance"), admin, Map.of("secondApprover", true, "approverPositionId", "S-111", "ownerPositionIds", List.of("S-111")), status().isOk());
        var own = id(call(post(base + "/versions"), mona, null, status().isCreated()));
        call(put(base + "/versions/" + own + "/content"), mona, Map.of("content", Map.of("items", List.of(Map.of("id", "a", "v", 3)), "rules", Map.of("x", 1)), "why", ""), status().isOk());
        call(post(base + "/versions/" + own + "/schedule"), mona, Map.of("from", today().plusDays(5).toString(), "reason", "Own"), status().isOk());
        assertThat(code(call(post(base + "/versions/" + own + "/approve"), mona, null, status().isForbidden()))).isEqualTo("config.selfApproval");
        call(post(base + "/versions/" + own + "/return"), admin, Map.of("note", "x"), status().isForbidden());
        call(post(base + "/versions/" + own + "/cancel"), mona, null, status().isOk());

        // Two days later v2 is in force and v1 expired; reverting v2 brings v1 back.
        clock.plusDays(2);
        var overview = call(get(base), mona, null, status().isOk());
        assertThat(statusOf(overview, v1)).isEqualTo("expired");
        assertThat(statusOf(overview, v2)).isEqualTo("active");
        call(post(base + "/versions/" + v1 + "/revert"), mona, Map.of("reason", "x"), status().isConflict());
        var reverted = call(post(base + "/versions/" + v2 + "/revert"), mona, Map.of("reason", "Wrong value"), status().isOk());
        assertThat(reverted.get("version").get("status").asString()).isEqualTo("reverted");
        overview = call(get(base), mona, null, status().isOk());
        assertThat(statusOf(overview, v1)).isEqualTo("active");
        assertThat(overview.get("opsLog").findValuesAsString("en")).contains("Version " + reverted.get("version").get("number").asString() + " reverted",
            "Second approval of versions enabled", "Configuration managers changed");
        assertThat(code(call(post(base + "/versions/" + v1 + "/revert"), mona, Map.of("reason", "x"), status().isConflict()))).isEqualTo("config.revert.only");
    }

    @Test
    void staleDraftsAreRebasedAndConflictsRefused() throws Exception {
        var admin = signIn("P-AHMED");
        var base = "/api/v1/admin/config/rebase";
        var today = today();
        var v1 = id(call(post(base + "/versions"), admin, null, status().isCreated()));
        call(put(base + "/versions/" + v1 + "/content"), admin, content(1, 1), status().isOk());
        call(post(base + "/versions/" + v1 + "/schedule"), admin, Map.of("from", today.toString(), "reason", "r"), status().isOk());

        var a = id(call(post(base + "/versions"), admin, null, status().isCreated()));
        var b = id(call(post(base + "/versions"), admin, null, status().isCreated()));
        var c = id(call(post(base + "/versions"), admin, null, status().isCreated()));
        call(put(base + "/versions/" + a + "/content"), admin, content(2, 1), status().isOk());
        call(put(base + "/versions/" + b + "/content"), admin, content(1, 2), status().isOk());
        call(put(base + "/versions/" + c + "/content"), admin, content(1, 3), status().isOk());
        call(post(base + "/versions/" + b + "/schedule"), admin, Map.of("from", today.plusDays(5).toString(), "reason", "b"), status().isOk());

        // a changed item a, b changed item b: a is applied on top of b and keeps b's change.
        assertThat(call(get(base + "/versions/" + a), admin, null, status().isOk()).get("stale").asBoolean()).isTrue();
        assertThat(code(call(post(base + "/versions/" + a + "/schedule"), admin, Map.of("from", today.plusDays(4).toString(), "reason", "a"), status().isUnprocessableContent())))
            .isEqualTo("config.schedule.beforeTip");
        var rebased = call(post(base + "/versions/" + a + "/schedule"), admin, Map.of("from", today.plusDays(6).toString(), "reason", "a"), status().isOk());
        assertThat(rebased.get("content")).isEqualTo(json.valueToTree(content(2, 2).get("content")));
        assertThat(rebased.get("version").get("rebasedFrom").get("number").asString()).isEqualTo(number(call(get(base + "/versions/" + v1), admin, null, status().isOk())));
        assertThat(rebased.get("changes").findValuesAsString("path")).containsExactly("items.a.v");

        // c changed item b too: conflict with b.
        assertThat(call(get(base + "/versions/" + c), admin, null, status().isOk()).get("conflicts")).hasSize(1);
        assertThat(code(call(post(base + "/versions/" + c + "/schedule"), admin, Map.of("from", today.plusDays(7).toString(), "reason", "c"), status().isUnprocessableContent())))
            .isEqualTo("config.schedule.conflict");
    }

    private static Map<String, Object> content(int a, int b) {
        return Map.of("content", Map.of("items", List.of(Map.of("id", "a", "v", a), Map.of("id", "b", "v", b)), "rules", Map.of()), "why", "");
    }

    private static String id(JsonNode detail) {
        return detail.get("version").get("id").asString();
    }

    private static String number(JsonNode detail) {
        return detail.get("version").get("number").asString();
    }

    private static String code(JsonNode problem) {
        return problem.get("code").asString();
    }

    private static String statusOf(JsonNode overview, String id) {
        for (var v : overview.get("versions")) if (v.get("id").asString().equals(id)) return v.get("status").asString();
        return null;
    }

    private String signIn(String key) throws Exception {
        var body = Map.of("username", SapStub.userOf(sap.employeeNo(key)), "password", SapStub.PASSWORD);
        var res = mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        return "Bearer " + json.readTree(res).get("token").asString();
    }

    private JsonNode call(MockHttpServletRequestBuilder req, String auth, Object body, ResultMatcher expected) throws Exception {
        req.header("Authorization", auth);
        if (body != null) req.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        var text = mvc.perform(req).andExpect(expected).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        return text.isEmpty() ? json.nullNode() : json.readTree(text);
    }
}
