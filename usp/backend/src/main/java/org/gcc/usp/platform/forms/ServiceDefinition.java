package org.gcc.usp.platform.forms;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;
import java.util.Optional;
import org.gcc.usp.platform.shared.LocalizedText;
import tools.jackson.databind.JsonNode;

/**
 * A configured service version (same schema as packages/forms-core ServiceDefinition). {@code raw} is served to the
 * clients as-is so web and mobile render exactly what the server validates.
 */
public record ServiceDefinition(String id, String module, String feature, int version, LocalizedText name, LocalizedText next,
                                List<FieldDef> fields, List<RuleDef> rules, List<StepDef> steps, JsonNode raw) {

    public Optional<FieldDef> field(String key) {
        return fields.stream().filter(f -> f.key().equals(key)).findFirst();
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record FieldDef(String key, String type, LocalizedText label, LocalizedText help, Boolean required, JsonNode requiredWhen, JsonNode visibleWhen,
                           List<Option> options, String pattern, Double min, Double max) {}

    public record Option(String value, LocalizedText label) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record RuleDef(String id, JsonNode when, String level, LocalizedText message, String field) {}

    /** mode: approve | notify | fulfil | receipt | system. {@code operation} names the system step handler ("documents.issue:<template>"). */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record StepDef(String key, LocalizedText title, String mode, JsonNode agent, Integer slaHours, JsonNode when, String operation) {}
}
