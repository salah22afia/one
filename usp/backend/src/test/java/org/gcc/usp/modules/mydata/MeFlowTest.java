package org.gcc.usp.modules.mydata;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.gcc.usp.testing.MutableClock;
import org.gcc.usp.testing.SapStub;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
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
 * Slice 1.3 with the stub SAP: My data (SAP-001 extension + org, masked contact and bank), the documents wallet,
 * family, balances and payslips read live as the signed-in user; the digital card's signed QR code and its public
 * check (tampered and expired codes refused); per-person display preferences.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
@Import(MeFlowTest.Beans.class)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class) // the last test moves the clock past the card code's expiry
class MeFlowTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17");

    static final SapStub sap = new SapStub();
    static final MutableClock clock = new MutableClock(Instant.parse("2026-09-23T09:00:00Z"), ZoneId.of("Asia/Riyadh"));

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        r.add("usp.sap.base-url", sap::url);
        r.add("usp.card.public-base-url", () -> "https://portal.example/");
    }

    @TestConfiguration
    static class Beans {
        @Bean MutableClock clock() { return clock; }
    }

    @AfterAll
    static void stop() {
        sap.close();
    }

    @Autowired MockMvc mvc;
    @Autowired JsonMapper json;

    @Test
    @Order(1)
    void myDataComesFromSapWithContactAndBankMasked() throws Exception {
        var ahmed = signIn("P-AHMED");
        var p = call(get("/api/v1/mydata/profile"), ahmed, null, status().isOk());
        assertThat(p.get("employeeNo").asString()).isEqualTo("2101");
        assertThat(p.get("name").get("en").asString()).isEqualTo("Ahmed Al-Dosari");
        assertThat(p.get("positionId").asString()).isEqualTo("S-1111");
        assertThat(p.get("title").get("en").asString()).isNotBlank();
        assertThat(p.get("unit").get("ar").asString()).isNotBlank();
        assertThat(p.get("manager").get("name").get("en").asString()).isNotBlank();
        assertThat(p.get("mobile").asString()).isEqualTo("+966 5• ••• •412");
        assertThat(p.get("bank").get("iban").asString()).isEqualTo("SA•• •••• 4471");
        assertThat(p.get("bank").get("bank").get("en").asString()).isEqualTo("Al Rajhi Bank");
        assertThat(p.get("email").asString()).isEqualTo("a.aldosari@gcc-sg.org");
        assertThat(p.get("location").get("en").asString()).isEqualTo("Riyadh");
        assertThat(p.get("hireDate").asString()).isEqualTo("2023-01-01");
        // The full values never leave the portal.
        assertThat(p.toString()).doesNotContain("512345412").doesNotContain("SA0380000000608010164471");

        // Someone SAP has no extension for yet: the confirmed fields only, the rest empty.
        var sara = call(get("/api/v1/mydata/profile"), signIn("P-SARA"), null, status().isOk());
        assertThat(sara.get("employeeNo").asString()).isEqualTo("2188");
        assertThat(absent(sara.get("mobile"))).isTrue();
        assertThat(absent(sara.get("bank"))).isTrue();
    }

    @Test
    @Order(2)
    void walletFamilyBalancesAndPayAreReadLive() throws Exception {
        var ahmed = signIn("P-AHMED");
        var docs = call(get("/api/v1/mydata/documents"), ahmed, null, status().isOk());
        assertThat(docs.size()).isEqualTo(6);
        assertThat(ids(docs)).startsWith("0185-05-1", "0185-07-1"); // soonest expiry first
        assertThat(docs.get(0).get("kind").asString()).isEqualTo("licence");
        assertThat(docs.get(0).get("title").get("ar").asString()).isEqualTo("رخصة القيادة");
        assertThat(docs.get(0).get("expiresOn").asString()).isEqualTo("2026-10-07");
        for (var d : docs) if (d.get("id").asString().equals("0185-09-1")) assertThat(d.get("kind").asString()).isEqualTo("card"); // unknown kind

        var family = call(get("/api/v1/mydata/family"), ahmed, null, status().isOk());
        assertThat(family.size()).isEqualTo(2);
        assertThat(family.get(1).get("relation").get("en").asString()).isEqualTo("Son");
        assertThat(family.get(1).get("documentExpiresOn").asString()).isEqualTo("2026-11-02");

        var balances = call(get("/api/v1/timeleave/balances"), ahmed, null, status().isOk());
        assertThat(balances.size()).isEqualTo(3);
        assertThat(balances.get(0).get("kind").asString()).isEqualTo("annual");
        assertThat(balances.get(0).get("remaining").decimalValue()).isEqualByComparingTo("21.5");
        assertThat(balances.get(0).get("entitlement").decimalValue()).isEqualByComparingTo("30");

        var pay = call(get("/api/v1/finance/payslips"), ahmed, null, status().isOk());
        assertThat(pay.findValuesAsString("period")).containsExactly("2026-09", "2026-08", "2026-07"); // newest first
        assertThat(pay.get(0).get("net").decimalValue()).isEqualByComparingTo("16650");
        assertThat(sap.calls).anyMatch(c -> c.equals("/sap/tamkeen/payroll/me/payslips"));

        // An employee with nothing on file sees empty lists, not errors.
        var sara = signIn("P-SARA");
        assertThat(call(get("/api/v1/mydata/documents"), sara, null, status().isOk()).size()).isZero();
        assertThat(call(get("/api/v1/finance/payslips"), sara, null, status().isOk()).size()).isZero();
    }

    @Test
    @Order(3)
    void preferencesAreKeptPerPerson() throws Exception {
        var ahmed = signIn("P-AHMED");
        var initial = call(get("/api/v1/me/preferences"), ahmed, null, status().isOk());
        assertThat(absent(initial.get("language"))).isTrue();
        assertThat(initial.get("theme").asString()).isEqualTo("auto");
        assertThat(initial.get("textSize").asString()).isEqualTo("normal");
        var saved = call(put("/api/v1/me/preferences"), ahmed, Map.of("language", "en", "theme", "dark", "textSize", "large"), status().isOk());
        assertThat(saved.get("language").asString()).isEqualTo("en");
        assertThat(call(get("/api/v1/me/preferences"), signIn("P-AHMED"), null, status().isOk()).get("theme").asString()).isEqualTo("dark");
        assertThat(call(get("/api/v1/me/preferences"), signIn("P-SARA"), null, status().isOk()).get("theme").asString()).isEqualTo("auto");
        assertThat(code(call(put("/api/v1/me/preferences"), ahmed, Map.of("language", "fr"), status().is(422)))).isEqualTo("settings.badLanguage");
        assertThat(code(call(put("/api/v1/me/preferences"), ahmed, Map.of("theme", "neon"), status().is(422)))).isEqualTo("settings.badTheme");
    }

    @Test
    @Order(4)
    void theCardCodeIsSignedAndShortLived() throws Exception {
        var ahmed = signIn("P-AHMED");
        var card = call(get("/api/v1/mydata/card"), ahmed, null, status().isOk());
        var url = card.get("url").asString();
        assertThat(url).startsWith("https://portal.example/verify/card/");
        assertThat(card.get("qr").get("size").asInt()).isGreaterThan(20);
        assertThat(card.get("qr").get("path").asString()).startsWith("M");
        assertThat(Instant.parse(card.get("expiresAt").asString())).isEqualTo(clock.instant().plus(Duration.ofHours(24)));
        var code = url.substring(url.lastIndexOf('/') + 1);

        // Public: no sign-in needed to check a scanned card.
        var ok = anonymous(get("/api/v1/verify/card/" + code));
        assertThat(ok.get("valid").asBoolean()).isTrue();
        assertThat(ok.get("employeeNo").asString()).isEqualTo("2101");
        assertThat(ok.get("name").get("en").asString()).isEqualTo("Ahmed Al-Dosari");

        // Changing anything in the code breaks the signature; so does another card's signature.
        var payload = code.substring(0, code.indexOf('.'));
        var forged = payload.substring(0, payload.length() - 2) + (payload.endsWith("A") ? "B" : "A") + payload.substring(payload.length() - 1) + code.substring(code.indexOf('.'));
        assertThat(anonymous(get("/api/v1/verify/card/" + forged)).get("valid").asBoolean()).isFalse();
        var other = call(get("/api/v1/mydata/card"), signIn("P-SARA"), null, status().isOk()).get("url").asString();
        var mixed = payload + other.substring(other.lastIndexOf('.'));
        var refused = anonymous(get("/api/v1/verify/card/" + mixed));
        assertThat(refused.get("valid").asBoolean()).isFalse();
        assertThat(absent(refused.get("employeeNo"))).isTrue();
        assertThat(anonymous(get("/api/v1/verify/card/not-a-code")).get("valid").asBoolean()).isFalse();

        // A day later the code has expired (the app shows a new one each time the card is opened).
        clock.plusDays(1);
        var late = anonymous(get("/api/v1/verify/card/" + code));
        assertThat(late.get("valid").asBoolean()).isFalse();
        assertThat(late.get("expired").asBoolean()).isTrue();
    }

    private static boolean absent(JsonNode n) {
        return n == null || n.isNull() || n.isMissingNode();
    }

    private static List<String> ids(JsonNode array) {
        var out = new ArrayList<String>();
        array.forEach(n -> out.add(n.get("id").asString()));
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

    private JsonNode anonymous(MockHttpServletRequestBuilder req) throws Exception {
        return json.readTree(mvc.perform(req).andExpect(status().isOk()).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8));
    }

    private JsonNode call(MockHttpServletRequestBuilder req, String auth, Object body, ResultMatcher expected) throws Exception {
        req.header("Authorization", auth);
        if (body != null) req.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body instanceof Map<?, ?> m ? new HashMap<>(m) : body));
        var text = mvc.perform(req).andExpect(expected).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        return text.isEmpty() ? json.nullNode() : json.readTree(text);
    }
}
