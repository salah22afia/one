package org.gcc.usp.platform.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.sun.net.httpserver.HttpServer;
import jakarta.servlet.http.Cookie;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
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
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * SAP sign-in and the live employee profile against a stub of GET /sap/tamkeen/profile/me (the contract shared by the
 * business: {employee_no, arabic_name, english_name, date_of_birth dd-MM-yyyy}). Also proves nothing is persisted.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class SapLoginTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17");

    static final List<String> seenAuth = new CopyOnWriteArrayList<>();
    static final HttpServer sap = stubSap();

    @DynamicPropertySource
    static void sapUrl(DynamicPropertyRegistry r) {
        r.add("usp.sap.base-url", () -> "http://localhost:" + sap.getAddress().getPort());
    }

    @AfterAll
    static void stop() {
        sap.stop(0);
    }

    @Autowired MockMvc mvc;
    @Autowired JsonMapper json;
    @Autowired JdbcClient jdbc;

    @Test
    void wrongPasswordIsRejected() throws Exception {
        login("EMP1818", "wrong").andExpect(status().isUnauthorized());
        login("", "").andExpect(status().isUnprocessableContent());
    }

    @Test
    void repeatedFailuresAreThrottledBeforeReachingSap() throws Exception {
        for (int i = 0; i < 5; i++) login("LOCKME", "wrong").andExpect(status().isUnauthorized());
        int calls = seenAuth.size();
        login("LOCKME", "secret").andExpect(status().isTooManyRequests());
        assertThat(seenAuth).hasSize(calls); // SAP was not called again
    }

    @Test
    void signInThenReadTheProfileLiveWithCookieOrBearer() throws Exception {
        var res = login("EMP1818", "secret").andExpect(status().isOk()).andReturn().getResponse();
        var session = json.readTree(res.getContentAsString(StandardCharsets.UTF_8));
        var token = session.get("token").asString();
        assertThat(session.get("employeeNo").asString()).isEqualTo("1818");
        assertThat(res.getHeader("Set-Cookie")).contains("usp_session=" + token, "HttpOnly", "SameSite=Strict", "Path=/api");

        // Mobile: bearer token.
        var profile = body(mvc.perform(get("/api/v1/mydata/profile").header("Authorization", "Bearer " + token)).andExpect(status().isOk()));
        assertThat(profile.get("employeeNo").asString()).isEqualTo("1818");
        assertThat(profile.get("name").get("en").asString()).isEqualTo("Salah Afia");
        assertThat(profile.get("name").get("ar").asString()).isEqualTo("صلاح عافية");
        assertThat(profile.get("dateOfBirth").asString()).isEqualTo("2000-09-23");
        // Web: HttpOnly cookie. SAP is called as the user every time (Basic, since this stub issues no ticket).
        mvc.perform(get("/api/v1/mydata/profile").cookie(new Cookie("usp_session", token))).andExpect(status().isOk());
        assertThat(seenAuth.getLast()).isEqualTo(basic("EMP1818", "secret"));
        mvc.perform(get("/api/v1/auth/session").cookie(new Cookie("usp_session", token))).andExpect(status().isOk());

        // Nothing about the employee reached PostgreSQL.
        for (var table : List.of("requests.request", "requests.audit", "workflow.instance", "documents.document"))
            assertThat(jdbc.sql("select count(*) from " + table).query(Long.class).single()).as(table).isZero();
        // The org structure is read live from SAP; the portal has no org tables at all.
        assertThat(jdbc.sql("select count(*) from information_schema.schemata where schema_name = 'org'").query(Long.class).single()).isZero();

        mvc.perform(post("/api/v1/auth/logout").header("Authorization", "Bearer " + token)).andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/mydata/profile").header("Authorization", "Bearer " + token)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/mydata/profile")).andExpect(status().isUnauthorized());
    }

    @Test
    void whenSapIssuesALogonTicketThePasswordIsNotUsedAgain() throws Exception {
        var token = body(login("TICKETUSER", "secret").andExpect(status().isOk())).get("token").asString();
        mvc.perform(get("/api/v1/mydata/profile").header("Authorization", "Bearer " + token)).andExpect(status().isOk());
        assertThat(seenAuth.getLast()).isEqualTo("cookie:MYSAPSSO2=TICKET-123");
    }

    @Test
    void sapDownGives503() throws Exception {
        login("DOWN", "secret").andExpect(status().isServiceUnavailable());
    }

    private org.springframework.test.web.servlet.ResultActions login(String user, String password) throws Exception {
        return mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(java.util.Map.of("username", user, "password", password))));
    }

    private JsonNode body(org.springframework.test.web.servlet.ResultActions r) throws Exception {
        return json.readTree(r.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8));
    }

    private static String basic(String user, String password) {
        return "Basic " + Base64.getEncoder().encodeToString((user + ":" + password).getBytes(StandardCharsets.UTF_8));
    }

    /** Stub of the SAP ICF service: Basic auth per user, optional MYSAPSSO2 ticket, and an outage. */
    private static HttpServer stubSap() {
        try {
            var server = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
            server.createContext("/sap/tamkeen/profile/me", ex -> {
                var auth = ex.getRequestHeaders().getFirst("Authorization");
                var cookie = ex.getRequestHeaders().getFirst("Cookie");
                seenAuth.add(cookie != null ? "cookie:" + cookie : auth);
                int status;
                String body = "";
                if ("MYSAPSSO2=TICKET-123".equals(cookie) || basic("TICKETUSER", "secret").equals(auth)) {
                    if (auth != null) ex.getResponseHeaders().add("Set-Cookie", "MYSAPSSO2=TICKET-123; path=/; HttpOnly");
                    status = 200;
                    body = "{\"employee_no\": 2020, \"arabic_name\": \"\", \"english_name\": \"Ticket User\", \"date_of_birth\": \"01-01-1990\"}";
                } else if (basic("EMP1818", "secret").equals(auth) || basic("LOCKME", "secret").equals(auth)) {
                    status = 200;
                    body = "{\"employee_no\": 1818, \"arabic_name\": \"صلاح عافية\", \"english_name\": \"Salah Afia\", \"date_of_birth\": \"23-09-2000\"}";
                } else if (basic("DOWN", "secret").equals(auth)) {
                    status = 503;
                } else {
                    status = 401;
                }
                var bytes = body.getBytes(StandardCharsets.UTF_8);
                ex.getResponseHeaders().add("Content-Type", "application/json; charset=utf-8");
                ex.sendResponseHeaders(status, bytes.length == 0 ? -1 : bytes.length);
                if (bytes.length > 0) ex.getResponseBody().write(bytes);
                ex.close();
            });
            server.start();
            return server;
        } catch (java.io.IOException e) {
            throw new IllegalStateException(e);
        }
    }
}
