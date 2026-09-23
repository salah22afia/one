package org.gcc.usp.platform.documents;

import java.util.Map;
import java.util.Optional;

/** Document types the platform can issue. {@code code} is the form code printed in the footer (P-13). */
final class DocumentTemplates {

    /** {@code titleKey}: message catalog key of the document title. */
    record Template(String key, String titleKey, String numberPrefix, String code, String version) {}

    private static final Map<String, Template> ALL = Map.of(
        "employment-letter", new Template("employment-letter", "document.employment-letter.title", "LTR", "USP-DC-01", "1.0"));

    private DocumentTemplates() {}

    static Optional<Template> find(String key) {
        return Optional.ofNullable(ALL.get(key));
    }
}
