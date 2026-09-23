package org.gcc.usp.platform.config;

import java.util.List;
import org.gcc.usp.platform.rules.Check;
import tools.jackson.databind.JsonNode;

/**
 * A versioned configuration (leave policy, needs policy, comms policy, service designer…). The feature that owns it
 * registers one bean; the version machine does the rest.
 */
public interface ConfigKind {

    /** Stable key used in URLs and storage, e.g. {@code leave}. */
    String key();

    /** Content of the very first draft when the kind has no version yet. */
    JsonNode emptyContent();

    /** The kind's own checks before scheduling (e.g. a leave type not linked to an SAP absence type); blocking ones refuse it. */
    default List<Check> problems(JsonNode content) {
        return List.of();
    }
}
