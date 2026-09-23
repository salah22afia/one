package org.gcc.usp.platform.forms;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;
import org.gcc.usp.platform.forms.ServiceDefinition.FieldDef;
import org.gcc.usp.platform.rules.Check;
import org.gcc.usp.platform.rules.RuleEvaluator;
import org.gcc.usp.platform.shared.Messages;
import org.springframework.stereotype.Component;

/** Server-side validation of a submission (authoritative, AB-35). Mirrors packages/forms-core validate() exactly. */
@Component
public class FormValidator {

    private final RuleEvaluator rules;
    private final Messages messages;

    FormValidator(RuleEvaluator rules, Messages messages) {
        this.rules = rules;
        this.messages = messages;
    }

    /** Failing checks only; empty = ok. {@code today} is exposed to rules as {"var": "today"} (ISO date). */
    public List<Check> validate(ServiceDefinition def, Map<String, Object> data, LocalDate today) {
        var ctx = new HashMap<>(data);
        ctx.put("today", today.toString());
        var out = new ArrayList<Check>();
        for (var f : def.fields()) {
            if (!visible(f, ctx)) continue;
            var v = data.get(f.key());
            if (empty(v)) {
                if (required(f, ctx)) out.add(new Check("required:" + f.key(), "block", messages.text("validation.required", f.label()), f.key()));
                continue;
            }
            if (f.pattern() != null && v instanceof String s && !Pattern.compile(f.pattern()).matcher(s).find())
                out.add(new Check("pattern:" + f.key(), "block", messages.text("validation.pattern", f.label()), f.key()));
            if (v instanceof Number n && ((f.min() != null && n.doubleValue() < f.min()) || (f.max() != null && n.doubleValue() > f.max())))
                out.add(new Check("range:" + f.key(), "block", messages.text("validation.range", f.label()), f.key()));
        }
        for (var r : def.rules()) if (rules.holds(r.when(), ctx)) out.add(new Check(r.id(), r.level(), r.message(), r.field()));
        return out;
    }

    public boolean visible(FieldDef f, Map<String, Object> ctx) {
        return f.visibleWhen() == null || f.visibleWhen().isNull() || rules.holds(f.visibleWhen(), ctx);
    }

    private boolean required(FieldDef f, Map<String, Object> ctx) {
        return Boolean.TRUE.equals(f.required()) || (f.requiredWhen() != null && rules.holds(f.requiredWhen(), ctx));
    }

    private static boolean empty(Object v) {
        return v == null || (v instanceof String s && s.isEmpty()) || (v instanceof Collection<?> c && c.isEmpty());
    }
}
