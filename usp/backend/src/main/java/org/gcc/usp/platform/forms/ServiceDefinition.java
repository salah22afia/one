package org.gcc.usp.platform.forms;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.gcc.usp.platform.shared.LocalizedText;
import tools.jackson.databind.JsonNode;

/**
 * A configured service version (same schema as packages/forms-core ServiceDefinition). {@code raw} is served to the
 * clients as-is so web and mobile render exactly what the server validates.
 *
 * <p>{@code icon}: the icon shown on request rows (an icon name of the UI kit; null = the generic document icon).
 * {@code withdraw}: when the requester may withdraw ({@link #WITHDRAW_BEFORE_DECISION} by default, or {@link #WITHDRAW_NEVER}).
 */
public record ServiceDefinition(String id, String module, String feature, int version, LocalizedText name, LocalizedText next,
                                String icon, String withdraw, List<FieldDef> fields, List<RuleDef> rules, List<StepDef> steps, JsonNode raw) {

    /** The prototype's rule: the requester may withdraw while no one else has decided on the request. */
    public static final String WITHDRAW_BEFORE_DECISION = "beforeDecision";
    public static final String WITHDRAW_NEVER = "never";

    public boolean withdrawable() {
        return !WITHDRAW_NEVER.equals(withdraw);
    }

    /** What the holder of a human step may decide, per mode: everything a service may allow. */
    public static final Map<String, List<String>> DECISIONS = Map.of(
        "approve", List.of("approve", "return", "reject"),
        "fulfil", List.of("done", "return", "reject"),
        "receipt", List.of("receive"));

    /** The prototype's defaults when a step does not list its decisions: fulfilment tasks are only marked done. */
    public static final Map<String, List<String>> DEFAULT_DECISIONS = Map.of(
        "approve", List.of("approve", "return", "reject"),
        "fulfil", List.of("done"),
        "receipt", List.of("receive"));

    public Optional<FieldDef> field(String key) {
        return fields.stream().filter(f -> f.key().equals(key)).findFirst();
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record FieldDef(String key, String type, LocalizedText label, LocalizedText help, Boolean required, JsonNode requiredWhen, JsonNode visibleWhen,
                           List<Option> options, String pattern, Double min, Double max) {}

    public record Option(String value, LocalizedText label) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record RuleDef(String id, JsonNode when, String level, LocalizedText message, String field) {}

    /**
     * mode: approve | notify | fulfil | receipt | system. {@code operation} names the system step handler ("documents.issue:<template>").
     * {@code decisions}: what the step's holder may decide (approve, return, reject, done, receive); null = the mode's defaults.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record StepDef(String key, LocalizedText title, String mode, JsonNode agent, Integer slaHours, JsonNode when, String operation,
                          List<String> decisions) {

        /** The decisions this step allows (its own list, else the mode's defaults); empty for automatic steps. */
        public List<String> effectiveDecisions() {
            return decisions != null ? decisions : DEFAULT_DECISIONS.getOrDefault(mode, List.of());
        }
    }
}
