package org.gcc.usp.platform.integration;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import org.gcc.usp.platform.shared.LocalizedText;
import tools.jackson.databind.JsonNode;

/**
 * Reading SAP JSON by the conventions in docs/SAP_INTEGRATION.md: empty values may be {@code ""}, {@code null} or
 * omitted; dates come as {@code dd-MM-yyyy} or ISO; texts as {@code <name>_ar} / {@code <name>_en}; coded values as
 * {@code {code, text_ar, text_en}}. Unreadable values become empty rather than failing the page.
 */
public final class SapJson {

    private static final DateTimeFormatter SAP_DATE = DateTimeFormatter.ofPattern("dd-MM-yyyy");

    private SapJson() {}

    /** Trimmed text, "" when absent. */
    public static String text(JsonNode n, String field) {
        JsonNode v = n == null ? null : n.get(field);
        return v == null || v.isNull() || v.isObject() || v.isArray() ? "" : v.asString().trim();
    }

    /** Text or null when absent. */
    public static String textOrNull(JsonNode n, String field) {
        var s = text(n, field);
        return s.isEmpty() ? null : s;
    }

    /** {@code <base>_ar} and {@code <base>_en} as one text (e.g. base "title" reads title_ar and title_en). */
    public static LocalizedText texts(JsonNode n, String base) {
        return LocalizedText.arEn(text(n, base + "_ar"), text(n, base + "_en"));
    }

    /** A coded value's texts: {@code {code, text_ar, text_en}}. */
    public static LocalizedText coded(JsonNode n, String field) {
        JsonNode c = n == null ? null : n.get(field);
        return c == null || !c.isObject() ? LocalizedText.EMPTY : texts(c, "text");
    }

    public static String code(JsonNode n, String field) {
        JsonNode c = n == null ? null : n.get(field);
        return c == null || !c.isObject() ? "" : text(c, "code");
    }

    public static LocalDate date(JsonNode n, String field) {
        var s = text(n, field);
        if (s.isEmpty()) return null;
        try {
            return s.length() == 10 && s.charAt(2) == '-' ? LocalDate.parse(s, SAP_DATE) : LocalDate.parse(s);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    public static BigDecimal decimal(JsonNode n, String field) {
        JsonNode v = n == null ? null : n.get(field);
        if (v == null || v.isNull()) return null;
        try {
            return v.isNumber() ? v.decimalValue() : new BigDecimal(v.asString().trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** The elements of an array body (or of {@code field} in an object body); empty for anything else. */
    public static List<JsonNode> items(JsonNode body, String field) {
        JsonNode a = body != null && body.isObject() && field != null ? body.get(field) : body;
        var out = new ArrayList<JsonNode>();
        if (a != null && a.isArray()) a.forEach(out::add);
        return out;
    }
}
