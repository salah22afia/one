package org.gcc.usp.platform.catalog;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.gcc.usp.testing.SapStub;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
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
 * Slice 1.2 on real PostgreSQL: the catalogue 1.0 loaded by the migration, what employees see (listed and startable
 * services, the dock, "notify me"), and what platform administrators may change (with the rules that keep the catalogue
 * truthful: only built services become available, the dock holds startable services only, stale edits are refused).
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
@TestMethodOrder(MethodOrderer.OrderAnnotation.class) // the first test reads catalogue 1.0 as loaded; the second changes it
class CatalogFlowTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17");

    static final SapStub sap = new SapStub();

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        r.add("usp.sap.base-url", sap::url);
        // The general manager is a bootstrap administrator in this test (first-run administrators, by employee number).
        r.add("usp.admin.bootstrap-employees", () -> sap.employeeNo("P-GM"));
    }

    @AfterAll
    static void stop() {
        sap.close();
    }

    @Autowired MockMvc mvc;
    @Autowired JsonMapper json;

    @Test
    @Order(1)
    void employeesSeeTheCatalogueAndFollowComingServices() throws Exception {
        var ahmed = signIn("P-AHMED");
        var catalog = call(get("/api/v1/catalog"), ahmed, null, status().isOk());
        assertThat(catalog.get("domains").size()).isEqualTo(16);
        assertThat(catalog.get("domains").get(0).get("code").asString()).isEqualTo("TM");
        assertThat(catalog.get("domains").get(0).get("icon").asString()).isEqualTo("leave");
        var services = catalog.get("services");
        assertThat(services.size()).isEqualTo(77); // 78 in catalogue 1.0, one merged into AS-01
        assertThat(services.findValuesAsString("id")).doesNotContain("PR-03");
        var startable = new ArrayList<String>();
        services.forEach(s -> { if (s.get("startable").asBoolean()) startable.add(s.get("id").asString()); });
        assertThat(startable).containsExactlyInAnyOrder("TM-01", "MD-01", "MD-02", "MD-05", "DC-01", "FN-01", "AS-01");
        assertThat(catalog.get("dock").findValuesAsString("serviceId")).containsExactly("TM-01", "DC-01", "AS-01", "FN-01");
        assertThat(catalog.get("dock").get(0).get("label").get("ar").asString()).isEqualTo("إجازة");

        // "Notify me when it is available" on a coming service only; twice is harmless; it can be withdrawn.
        call(post("/api/v1/catalog/services/TM-02/interest"), ahmed, null, status().isNoContent());
        call(post("/api/v1/catalog/services/TM-02/interest"), ahmed, null, status().isNoContent());
        call(post("/api/v1/catalog/services/DC-01/interest"), ahmed, null, status().isConflict());
        call(post("/api/v1/catalog/services/XX-99/interest"), ahmed, null, status().isNotFound());
        assertThat(texts(call(get("/api/v1/catalog"), ahmed, null, status().isOk()).get("interested"))).containsExactly("TM-02");
        call(delete("/api/v1/catalog/services/TM-02/interest"), ahmed, null, status().isNoContent());
        assertThat(texts(call(get("/api/v1/catalog"), ahmed, null, status().isOk()).get("interested"))).isEmpty();

        // The admin API is for platform administrators only.
        call(get("/api/v1/admin/catalog"), ahmed, null, status().isForbidden());
        call(put("/api/v1/admin/catalog/dock"), ahmed, Map.of("items", List.of()), status().isForbidden());
    }

    @Test
    @Order(2)
    void administratorsEditTheCatalogueWithinItsRules() throws Exception {
        var admin = signIn("P-GM");
        var sara = signIn("P-SARA");
        var catalog = call(get("/api/v1/admin/catalog"), admin, null, status().isOk());
        assertThat(catalog.get("services").size()).isEqualTo(78);
        var tm02 = service(catalog, "TM-02");
        assertThat(tm02.get("status").asString()).isEqualTo("wave2");
        assertThat(tm02.get("runnable").asBoolean()).isFalse();
        assertThat(service(catalog, "DC-01").get("inDock").asBoolean()).isTrue();

        // Only a built or configured service can become available.
        var change = edit(tm02);
        change.put("status", "available");
        assertThat(code(call(put("/api/v1/admin/catalog/services/TM-02"), admin, change, status().is(422)))).isEqualTo("catalog.notRunnable");

        // A change of words is logged and seen by employees at once; an edit made on an older version is refused.
        change = edit(tm02);
        change.put("name", Map.of("ar", "ترحيل رصيد الإجازة", "en", "Leave carry-over"));
        change.put("keywords", Map.of("ar", "رصيد سنوي", "en", "balance annual"));
        var after = call(put("/api/v1/admin/catalog/services/TM-02"), admin, change, status().isOk());
        assertThat(service(after, "TM-02").get("name").get("en").asString()).isEqualTo("Leave carry-over");
        assertThat(after.get("log").get(0).get("what").get("en").asString()).isEqualTo("Service TM-02 changed");
        assertThat(after.get("log").get(0).get("changes").findValuesAsString("field")).containsExactlyInAnyOrder("name", "keywords");
        assertThat(code(call(put("/api/v1/admin/catalog/services/TM-02"), admin, change, status().isConflict()))).isEqualTo("catalog.stale");
        var seen = call(get("/api/v1/catalog"), sara, null, status().isOk());
        seen.get("services").forEach(s -> { if (s.get("id").asString().equals("TM-02")) assertThat(s.get("name").get("en").asString()).isEqualTo("Leave carry-over"); });

        // A service on the dock stays available until it is taken off the dock.
        var dc01 = edit(service(after, "DC-01"));
        dc01.put("status", "later");
        assertThat(code(call(put("/api/v1/admin/catalog/services/DC-01"), admin, dc01, status().is(422)))).isEqualTo("catalog.inDock");

        // The dock: startable services only, no duplicates, at most four, and the version the administrator saw.
        int dockVersion = after.get("dock").get("version").asInt();
        var leave = Map.of("serviceId", "TM-01", "label", Map.of("ar", "إجازة", "en", "Leave"), "icon", "leave", "tone", "g-green");
        var letter = Map.of("serviceId", "DC-01", "label", Map.of("ar", "خطاب", "en", "Letter"), "icon", "letter", "tone", "g-gold");
        var coming = Map.of("serviceId", "TM-02", "label", Map.of("ar", "ترحيل"), "icon", "leave");
        assertThat(code(call(put("/api/v1/admin/catalog/dock"), admin, Map.of("items", List.of(leave, coming), "version", dockVersion),
            status().is(422)))).isEqualTo("catalog.dockNotAvailable");
        assertThat(code(call(put("/api/v1/admin/catalog/dock"), admin, Map.of("items", List.of(leave, leave), "version", dockVersion),
            status().is(422)))).isEqualTo("catalog.dockDuplicate");
        var docked = call(put("/api/v1/admin/catalog/dock"), admin, Map.of("items", List.of(letter, leave), "version", dockVersion), status().isOk());
        assertThat(docked.get("dock").get("items").findValuesAsString("serviceId")).containsExactly("DC-01", "TM-01");
        assertThat(code(call(put("/api/v1/admin/catalog/dock"), admin, Map.of("items", List.of(leave), "version", dockVersion), status().isConflict())))
            .isEqualTo("catalog.stale");
        assertThat(call(get("/api/v1/catalog"), sara, null, status().isOk()).get("dock").findValuesAsString("serviceId")).containsExactly("DC-01", "TM-01");

        // A service taken out of "available" cannot be requested any more (checked by the server, not only hidden by the apps).
        var md05 = edit(service(docked, "MD-05"));
        md05.put("status", "later");
        var paused = call(put("/api/v1/admin/catalog/services/MD-05"), admin, md05, status().isOk());
        var request = Map.of("serviceId", "MD-05", "data", Map.of(), "channel", "web");
        assertThat(code(call(post("/api/v1/requests"), sara, request, status().isConflict()))).isEqualTo("catalog.notAvailable");
        md05 = edit(service(paused, "MD-05"));
        md05.put("status", "available");
        call(put("/api/v1/admin/catalog/services/MD-05"), admin, md05, status().isOk());

        // Adding a service: a valid, unused code in a known domain; it starts as coming.
        var added = new HashMap<String, Object>(Map.of("id", "tm-08", "domain", "TM", "name", Map.of("ar", "خدمة جديدة"), "status", "wave2"));
        var withNew = call(post("/api/v1/admin/catalog/services"), admin, added, status().isOk());
        assertThat(service(withNew, "TM-08").get("status").asString()).isEqualTo("wave2");
        assertThat(code(call(post("/api/v1/admin/catalog/services"), admin, added, status().isConflict()))).isEqualTo("catalog.idTaken");
        added.put("id", "leave");
        assertThat(code(call(post("/api/v1/admin/catalog/services"), admin, added, status().is(422)))).isEqualTo("catalog.idInvalid");

        // A domain's words, icon and colour.
        var tm = catalog.get("domains").get(0);
        var domain = Map.of("name", Map.of("ar", "الوقت والإجازات", "en", "Time & leave"), "description", Map.of("ar", "دوام الموظف"),
            "icon", "calendar", "tone", "g-teal", "order", 10, "version", tm.get("version").asInt());
        var d = call(put("/api/v1/admin/catalog/domains/TM"), admin, domain, status().isOk());
        assertThat(d.get("domains").get(0).get("icon").asString()).isEqualTo("calendar");
        var bad = new HashMap<String, Object>(domain);
        bad.put("tone", "pink");
        bad.put("version", d.get("domains").get(0).get("version").asInt());
        assertThat(code(call(put("/api/v1/admin/catalog/domains/TM"), admin, bad, status().is(422)))).isEqualTo("catalog.badTone");
    }

    private static JsonNode service(JsonNode catalog, String id) {
        for (var s : catalog.get("services")) if (s.get("id").asString().equals(id)) return s;
        throw new AssertionError("no service " + id);
    }

    /** The service's current content as an edit (with its version). */
    private Map<String, Object> edit(JsonNode s) {
        var m = new HashMap<String, Object>();
        for (var f : List.of("domain", "status", "frequency")) if (s.hasNonNull(f)) m.put(f, s.get(f).asString());
        for (var f : List.of("name", "scope", "requesters", "target", "keywords")) m.put(f, json.convertValue(s.get(f), Map.class));
        m.put("order", s.get("order").asInt());
        m.put("version", s.get("version").asInt());
        return m;
    }

    private static List<String> texts(JsonNode array) {
        var out = new ArrayList<String>();
        array.forEach(n -> { if (n.isValueNode()) out.add(n.asString()); });
        return out;
    }

    private static String code(JsonNode problem) {
        return problem.get("code").asString();
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
