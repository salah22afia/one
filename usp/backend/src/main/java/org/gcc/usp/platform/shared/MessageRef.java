package org.gcc.usp.platform.shared;

import java.util.List;
import java.util.Map;

/**
 * A message catalog key with its arguments, persisted as JSON (e.g. an audit line or the reason a step is with
 * someone) and rendered on read, so texts appear in every language the portal has at that time — including ones
 * added later. Arguments are plain strings or {@link LocalizedText} (stored as language maps).
 */
public record MessageRef(String key, List<Object> args) {

    public static MessageRef of(String key, Object... args) {
        return new MessageRef(key, List.of(args));
    }

    /** Arguments read back from JSON come as maps; turn them into {@link LocalizedText} again. */
    @SuppressWarnings("unchecked")
    public Object[] resolvedArgs() {
        return args == null ? new Object[0]
            : args.stream().map(a -> a instanceof Map<?, ?> m ? new LocalizedText((Map<String, String>) m) : a).toArray();
    }
}
