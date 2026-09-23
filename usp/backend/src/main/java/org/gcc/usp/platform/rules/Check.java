package org.gcc.usp.platform.rules;

import org.gcc.usp.platform.shared.LocalizedText;

/** A rule outcome shown to the user: level ok | info | warn | block (the prototype's Check model, AB-32). */
public record Check(String key, String level, LocalizedText text, String field) {

    public boolean blocks() {
        return "block".equals(level);
    }
}
