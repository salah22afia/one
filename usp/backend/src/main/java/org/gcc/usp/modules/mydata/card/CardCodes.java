package org.gcc.usp.modules.mydata.card;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;
import java.util.Optional;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.gcc.usp.platform.shared.LocalizedText;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Short-lived, signed codes for the digital employee card's QR (owner decision 2026-09-23). The code carries the
 * employee number, name and expiry, signed with HMAC-SHA256; the public verification page checks the signature, so
 * nothing is stored and no SAP call is needed. A code is issued only to a signed-in employee: once their SAP user is
 * locked they cannot get a new one, and the last one expires within {@code usp.card.code-validity}.
 */
@Component
class CardCodes {

    /** Domain separation: the same secret may sign other things, never interchangeably. */
    private static final String CONTEXT = "usp.card.v1.";
    private static final int VERSION = 1;
    private static final int MAC_BYTES = 16;
    private static final int MAX_LENGTH = 1024;
    private static final Base64.Encoder B64 = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder B64D = Base64.getUrlDecoder();

    private final JsonMapper json;
    private final Clock clock;
    private final byte[] secret;
    private final Duration validity;

    CardCodes(JsonMapper json, Optional<Clock> clock, @Value("${usp.card.secret}") String secret, @Value("${usp.card.code-validity:24h}") Duration validity) {
        this.json = json;
        this.clock = clock.orElse(Clock.systemUTC());
        this.secret = secret.getBytes(StandardCharsets.UTF_8);
        this.validity = validity;
    }

    record Card(String employeeNo, LocalizedText name, Instant expiresAt) {}

    record Issued(String code, Instant expiresAt) {}

    Issued issue(String employeeNo, LocalizedText name) {
        var expires = clock.instant().plus(validity).truncatedTo(ChronoUnit.SECONDS);
        var names = name.values();
        var payload = B64.encodeToString(json.writeValueAsBytes(List.of(VERSION, employeeNo, expires.getEpochSecond(),
            names.getOrDefault("ar", ""), names.getOrDefault("en", ""))));
        return new Issued(payload + "." + B64.encodeToString(mac(payload)), expires);
    }

    /** The card a code was issued for, if its signature holds (expired or not: {@link #expired} tells). */
    Optional<Card> read(String code) {
        if (code == null || code.length() > MAX_LENGTH) return Optional.empty();
        int dot = code.lastIndexOf('.');
        if (dot <= 0) return Optional.empty();
        var payload = code.substring(0, dot);
        byte[] given;
        try {
            given = B64D.decode(code.substring(dot + 1));
        } catch (IllegalArgumentException e) {
            return Optional.empty();
        }
        if (!MessageDigest.isEqual(mac(payload), given)) return Optional.empty();
        try {
            JsonNode a = json.readTree(B64D.decode(payload));
            if (!a.isArray() || a.size() != 5 || a.get(0).asInt() != VERSION) return Optional.empty();
            return Optional.of(new Card(a.get(1).asString(), LocalizedText.arEn(a.get(3).asString(), a.get(4).asString()),
                Instant.ofEpochSecond(a.get(2).asLong())));
        } catch (RuntimeException e) {
            return Optional.empty();
        }
    }

    boolean expired(Card card) {
        return !clock.instant().isBefore(card.expiresAt());
    }

    private byte[] mac(String payload) {
        try {
            var m = Mac.getInstance("HmacSHA256");
            m.init(new SecretKeySpec(secret, "HmacSHA256"));
            return Arrays.copyOf(m.doFinal((CONTEXT + payload).getBytes(StandardCharsets.US_ASCII)), MAC_BYTES);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }
}
