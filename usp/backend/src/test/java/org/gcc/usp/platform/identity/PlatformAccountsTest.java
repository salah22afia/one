package org.gcc.usp.platform.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.util.Map;
import org.gcc.usp.testing.SapStub;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
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
 * Platform accounts: the bootstrap administrator signs in without SAP, must replace the temporary password, creates a
 * platform user, and disables it. Platform accounts never reach SAP and cannot use SAP-backed services; employees
 * still sign in with SAP.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class PlatformAccountsTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17");

    static final SapStub sap = new SapStub();
    static final String TEMP = "Temporary-Start-2026";

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        r.add("usp.sap.base-url", sap::url);
        r.add("usp.admin.bootstrap-username", () -> "Admin");
        r.add("usp.admin.bootstrap-password", () -> TEMP);
    }

    @AfterAll
    static void stop() {
        sap.close();
    }

    @Autowired MockMvc mvc;
    @Autowired JsonMapper json;
    @Autowired JdbcClient jdbc;

    @Test
    void platformAdministratorManagesPlatformUsers() throws Exception {
        // Bootstrap administrator: no SAP call, temporary password.
        var sapCalls = sap.calls.size();
        var login = login("ADMIN", TEMP, status().isOk());
        assertThat(sap.calls).hasSize(sapCalls);
        assertThat(login.get("kind").asString()).isEqualTo("platform");
        assertThat(login.get("personId").asString()).isEqualTo("u:admin");
        assertThat(login.get("admin").asBoolean()).isTrue();
        assertThat(login.get("mustChangePassword").asBoolean()).isTrue();
        var admin = "Bearer " + login.get("token").asString();
        assertThat(jdbc.sql("select password_hash from identity.platform_user where username = 'admin'").query(String.class).single())
            .startsWith("{bcrypt}").doesNotContain(TEMP);

        // Nothing but the password change until it is done.
        assertThat(code(call(get("/api/v1/admin/platform-users"), admin, null, status().isForbidden()))).isEqualTo("auth.passwordChangeRequired");
        assertThat(code(call(post("/api/v1/auth/password"), admin, Map.of("current", "nope", "next", "Another-Long-Pass-1"), status().isUnprocessableContent())))
            .isEqualTo("auth.wrongCurrentPassword");
        assertThat(code(call(post("/api/v1/auth/password"), admin, Map.of("current", TEMP, "next", "short"), status().isUnprocessableContent())))
            .isEqualTo("users.passwordTooShort");
        var changed = call(post("/api/v1/auth/password"), admin, Map.of("current", TEMP, "next", "Chosen-By-Owner-9"), status().isOk());
        assertThat(changed.get("mustChangePassword").asBoolean()).isFalse();

        // Create a platform user (not an employee, not in SAP).
        var created = call(post("/api/v1/admin/platform-users"), admin, Map.of("username", "Ops.Desk", "name", Map.of("ar", "مكتب التشغيل", "en", "Operations desk"),
            "email", "ops@example.org", "admin", false, "temporaryPassword", "Ops-Temporary-Pass-1"), status().isCreated());
        var opsId = created.get("id").asString();
        assertThat(created.get("username").asString()).isEqualTo("ops.desk");
        assertThat(created.has("passwordHash")).isFalse();
        call(post("/api/v1/admin/platform-users"), admin, Map.of("username", "ops.desk", "name", Map.of("en", "Again"), "admin", false,
            "temporaryPassword", "Ops-Temporary-Pass-1"), status().isConflict());
        assertThat(call(get("/api/v1/admin/platform-users"), admin, null, status().isOk()).findValuesAsString("username")).containsExactly("admin", "ops.desk");

        // The new user signs in, changes the temporary password, and is not an administrator nor an employee.
        var ops = "Bearer " + login("ops.desk", "Ops-Temporary-Pass-1", status().isOk()).get("token").asString();
        call(post("/api/v1/auth/password"), ops, Map.of("current", "Ops-Temporary-Pass-1", "next", "Ops-Own-Password-1"), status().isOk());
        call(get("/api/v1/admin/platform-users"), ops, null, status().isForbidden());
        assertThat(code(call(get("/api/v1/mydata/profile"), ops, null, status().isForbidden()))).isEqualTo("auth.noSapAccount");
        assertThat(code(call(post("/api/v1/requests"), ops, Map.of("serviceId", "DC-01", "data", Map.of()), status().isForbidden()))).isEqualTo("auth.noSapAccount");
        assertThat(call(get("/api/v1/tasks"), ops, null, status().isOk())).isEmpty();
        // A wrong password on a platform account never falls through to SAP.
        sapCalls = sap.calls.size();
        login("ops.desk", "Wrong-Password-123", status().isUnauthorized());
        assertThat(sap.calls).hasSize(sapCalls);

        // Administrators cannot lock themselves out; disabling a user ends their sessions.
        var me = call(get("/api/v1/admin/platform-users"), admin, null, status().isOk()).get(0).get("id").asString();
        assertThat(code(call(put("/api/v1/admin/platform-users/" + me), admin, Map.of("name", Map.of("en", "Admin"), "admin", true, "enabled", false), status().isUnprocessableContent())))
            .isEqualTo("users.notOnYourself");
        call(put("/api/v1/admin/platform-users/" + opsId), admin, Map.of("name", Map.of("en", "Operations desk"), "admin", false, "enabled", false), status().isOk());
        call(get("/api/v1/tasks"), ops, null, status().isUnauthorized());
        assertThat(code(login("ops.desk", "Ops-Own-Password-1", status().isForbidden()))).isEqualTo("auth.accountDisabled");

        // A reset password is temporary again.
        call(put("/api/v1/admin/platform-users/" + opsId), admin, Map.of("name", Map.of("en", "Operations desk"), "admin", false, "enabled", true), status().isOk());
        call(post("/api/v1/admin/platform-users/" + opsId + "/reset-password"), admin, Map.of("temporaryPassword", "Reset-By-Admin-2026"), status().isOk());
        assertThat(login("ops.desk", "Reset-By-Admin-2026", status().isOk()).get("mustChangePassword").asBoolean()).isTrue();

        // Employees still sign in with SAP, and are not platform administrators.
        var ahmed = login(SapStub.userOf(sap.employeeNo("P-AHMED")), SapStub.PASSWORD, status().isOk());
        assertThat(ahmed.get("kind").asString()).isEqualTo("sap");
        call(get("/api/v1/admin/platform-users"), "Bearer " + ahmed.get("token").asString(), null, status().isForbidden());
        assertThat(code(call(post("/api/v1/auth/password"), "Bearer " + ahmed.get("token").asString(), Map.of("current", "x", "next", "y"), status().isUnprocessableContent())))
            .isEqualTo("auth.passwordInSap");
    }

    private JsonNode login(String username, String password, ResultMatcher expected) throws Exception {
        var res = mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("username", username, "password", password))))
            .andExpect(expected).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        return res.isEmpty() ? json.nullNode() : json.readTree(res);
    }

    private static String code(JsonNode problem) {
        return problem.get("code").asString();
    }

    private JsonNode call(MockHttpServletRequestBuilder req, String auth, Object body, ResultMatcher expected) throws Exception {
        req.header("Authorization", auth);
        if (body != null) req.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        var text = mvc.perform(req).andExpect(expected).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        return text.isEmpty() ? json.nullNode() : json.readTree(text);
    }
}
