package org.gcc.usp.platform.shared;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

/**
 * Text in any number of languages, keyed by language code ({@code "ar"}, {@code "en"}, …). Serialized as a plain JSON
 * object, so a new language needs no schema change. Data texts (service names, field labels, SAP names) use this;
 * fixed UI/server wording lives in the message catalogs ({@link Messages}).
 */
public record LocalizedText(@JsonValue Map<String, String> values) {

    public static final LocalizedText EMPTY = new LocalizedText(Map.of());

    @JsonCreator
    public LocalizedText {
        var copy = new LinkedHashMap<String, String>();
        if (values != null) values.forEach((k, v) -> { if (k != null && v != null) copy.put(k, v); });
        values = Map.copyOf(copy);
    }

    public static LocalizedText of(String lang, String text) {
        return new LocalizedText(Map.of(lang, Objects.requireNonNullElse(text, "")));
    }

    /** Arabic + English, the two languages SAP returns names in today. Empty values are dropped. */
    public static LocalizedText arEn(String ar, String en) {
        var m = new LinkedHashMap<String, String>();
        if (ar != null && !ar.isBlank()) m.put("ar", ar);
        if (en != null && !en.isBlank()) m.put("en", en);
        return new LocalizedText(m);
    }

    /** The text in {@code lang}, else the first language that has one, else "". */
    public String get(String lang) {
        var v = values.get(lang);
        if (v != null && !v.isEmpty()) return v;
        return values.values().stream().filter(s -> !s.isEmpty()).findFirst().orElse("");
    }

    public boolean isEmpty() {
        return values.values().stream().allMatch(String::isEmpty);
    }
}
