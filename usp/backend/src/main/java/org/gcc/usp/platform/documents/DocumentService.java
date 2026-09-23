package org.gcc.usp.platform.documents;

import java.nio.charset.StandardCharsets;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.ZoneId;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.gcc.usp.platform.shared.Sequences;
import org.gcc.usp.platform.shared.LocalizedText;
import org.gcc.usp.platform.shared.Messages;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/** Issued documents: immutable payload snapshots with a number and an HMAC verification code (DOC-01, AB-62). */
@Service
public class DocumentService {

    private final JdbcClient jdbc;
    private final JsonMapper json;
    private final Sequences sequences;
    private final Messages messages;
    private final byte[] verifySecret;

    DocumentService(JdbcClient jdbc, JsonMapper json, Sequences sequences, Messages messages, @Value("${usp.documents.verify-secret}") String verifySecret) {
        this.messages = messages;
        this.jdbc = jdbc;
        this.json = json;
        this.sequences = sequences;
        this.verifySecret = verifySecret.getBytes(StandardCharsets.UTF_8);
    }

    public List<DocumentView> forRequest(String requestId) {
        return jdbc.sql("select * from documents.document where request_id = :r order by issued_at").param("r", requestId).query(this::view).list();
    }

    public Optional<DocumentView> find(UUID id) {
        return jdbc.sql("select * from documents.document where id = :id").param("id", id).query(this::view).optional();
    }

    public Optional<DocumentView> findByCode(String code) {
        return jdbc.sql("select * from documents.document where verify_code = :c").param("c", code.trim().toUpperCase()).query(this::view).optional();
    }

    Map<String, Object> payload(UUID id) {
        var raw = jdbc.sql("select payload from documents.document where id = :id").param("id", id).query(String.class).single();
        return json.readValue(raw, new TypeReference<>() {});
    }

    DocumentView issue(DocumentTemplates.Template template, String requestId, String holderId, String issuedBy, Instant at, Map<String, Object> payload) {
        var id = UUID.randomUUID();
        int year = at.atZone(ZoneId.of("Asia/Riyadh")).getYear();
        var number = "%s-%d-%04d".formatted(template.numberPrefix(), year, sequences.next("doc:" + template.key(), year));
        var full = new java.util.LinkedHashMap<String, Object>(payload);
        full.put("number", number);
        full.put("issuedAt", at.toString());
        jdbc.sql("""
                insert into documents.document (id, request_id, template, number, verify_code, holder_id, issued_by, issued_at, payload)
                values (:id, :r, :t, :n, :c, :h, :by, :at, cast(:p as jsonb))""")
            .param("id", id).param("r", requestId).param("t", template.key()).param("n", number).param("c", verifyCode(id))
            .param("h", holderId).param("by", issuedBy).param("at", Timestamp.from(at)).param("p", json.writeValueAsString(full)).update();
        return find(id).orElseThrow();
    }

    /** GS-XXXX-XXXX-XXXX from HMAC-SHA256(secret, id): not guessable, and not derivable from the number. */
    String verifyCode(UUID id) {
        try {
            var mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(verifySecret, "HmacSHA256"));
            var hex = HexFormat.of().withUpperCase().formatHex(mac.doFinal(id.toString().getBytes(StandardCharsets.UTF_8)));
            return "GS-%s-%s-%s".formatted(hex.substring(0, 4), hex.substring(4, 8), hex.substring(8, 12));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private DocumentView view(ResultSet rs, int n) throws SQLException {
        var template = rs.getString("template");
        var title = DocumentTemplates.find(template).map(t -> messages.text(t.titleKey())).orElse(LocalizedText.of("und", template));
        return new DocumentView(rs.getObject("id", UUID.class), rs.getString("request_id"), template, title, rs.getString("number"),
            rs.getString("verify_code"), rs.getString("holder_id"), rs.getTimestamp("issued_at").toInstant(), rs.getTimestamp("revoked_at") != null);
    }
}
