package org.gcc.usp.platform.rules;

import io.github.jamsesso.jsonlogic.JsonLogic;
import io.github.jamsesso.jsonlogic.JsonLogicException;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

/**
 * Evaluates JSON Logic rules exactly like json-logic-js on web/mobile (A11). Parity is checked against the shared
 * fixtures in packages/forms-core/fixtures/rules.json by both test suites.
 */
@Component
public class RuleEvaluator {

    private final JsonLogic logic = new JsonLogic();

    public RuleEvaluator() {
        // json-logic-java compares numbers only; json-logic-js also compares strings (ISO dates) lexicographically.
        for (var op : List.of("<", "<=", ">", ">=")) logic.addOperation(op, args -> compareAll(op, args));
    }

    public boolean holds(JsonNode rule, Map<String, Object> data) {
        if (rule == null || rule.isNull() || rule.isMissingNode()) return false;
        try {
            return JsonLogic.truthy(logic.apply(rule.toString(), data));
        } catch (JsonLogicException e) {
            throw new IllegalArgumentException("Invalid rule " + rule, e);
        }
    }

    /** {"<": [a, b]} or the "between" form {"<": [a, b, c]}. */
    private static boolean compareAll(String op, Object[] args) {
        if (args.length < 2) return false;
        for (int i = 0; i + 1 < args.length && i < 2; i++) if (!compare(op, args[i], args[i + 1])) return false;
        return true;
    }

    private static boolean compare(String op, Object a, Object b) {
        int c;
        if (a instanceof String x && b instanceof String y) {
            c = x.compareTo(y);
        } else {
            double x = number(a), y = number(b);
            if (Double.isNaN(x) || Double.isNaN(y)) return false;
            c = Double.compare(x, y);
        }
        return switch (op) {
            case "<" -> c < 0;
            case "<=" -> c <= 0;
            case ">" -> c > 0;
            default -> c >= 0;
        };
    }

    private static double number(Object v) {
        if (v instanceof Number n) return n.doubleValue();
        if (v instanceof Boolean b) return b ? 1 : 0;
        if (v instanceof String s) {
            try { return s.isBlank() ? 0 : Double.parseDouble(s.trim()); } catch (NumberFormatException e) { return Double.NaN; }
        }
        return Double.NaN; // missing value (undefined in JS)
    }
}
