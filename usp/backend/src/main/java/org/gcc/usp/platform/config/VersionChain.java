package org.gcc.usp.platform.config;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import org.gcc.usp.platform.config.ConfigVersion.Status;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

/**
 * The prototype's version rules (domain/policy.ts), without persistence: precedence, status, the version in force on a
 * date, diff by object, rebase of stale drafts and the scheduling checks. Content is JSON whose top-level fields are
 * either blocks ({@code calendar}, {@code rules}) or lists of items with an {@code id} ({@code types}, {@code services}).
 */
final class VersionChain {

    private VersionChain() {}

    /** Later date wins; on the same date the later-created wins (a correction), so one version is in force per day. */
    static boolean supersedes(ConfigVersion a, ConfigVersion b) {
        return a.from().isAfter(b.from()) || (a.from().equals(b.from()) && a.createdAt().isAfter(b.createdAt()));
    }

    static final Comparator<ConfigVersion> NEWEST_FIRST = (a, b) -> supersedes(a, b) ? -1 : supersedes(b, a) ? 1 : 0;

    static Status status(ConfigVersion v, List<ConfigVersion> all, LocalDate today) {
        if (v.revoked() != null) return Status.REVERTED;
        if (v.cancelled()) return Status.CANCELLED;
        if (!v.scheduled()) return Status.DRAFT;
        if (v.approval() != null && v.approval().pending()) return Status.AWAITING;
        if (v.from().isAfter(today)) return Status.SCHEDULED;
        var later = all.stream().filter(x -> !x.id().equals(v.id()) && x.inForce() && supersedes(x, v) && !x.from().isAfter(today)).toList();
        if (later.isEmpty()) return Status.ACTIVE;
        return later.stream().anyMatch(x -> x.from().equals(v.from())) ? Status.CORRECTED : Status.EXPIRED;
    }

    /** Last day in force, or empty while open-ended. A correction on the same day ends it on that day. */
    static Optional<LocalDate> endOf(ConfigVersion v, List<ConfigVersion> all) {
        return all.stream().filter(x -> !x.id().equals(v.id()) && x.inForce() && supersedes(x, v))
            .min(NEWEST_FIRST.reversed())
            .map(next -> next.from().isAfter(v.from()) ? next.from().minusDays(1) : v.from());
    }

    static Optional<ConfigVersion> on(List<ConfigVersion> all, LocalDate date) {
        return all.stream().filter(v -> v.inForce() && !v.from().isAfter(date)).min(NEWEST_FIRST);
    }

    /** The newest version in force by date, even if still scheduled; new drafts build on it so no scheduled change is lost. */
    static Optional<ConfigVersion> tip(List<ConfigVersion> all) {
        return all.stream().filter(ConfigVersion::inForce).min(NEWEST_FIRST);
    }

    static Optional<ConfigVersion> awaiting(List<ConfigVersion> all, UUID except) {
        return all.stream().filter(v -> !v.id().equals(except) && v.scheduled() && !v.cancelled() && v.approval() != null && v.approval().pending()).findFirst();
    }

    // ——— diff ———

    record Diff(String path, String object, String before, String after) {}

    static List<Diff> diff(JsonNode a, JsonNode b) {
        var fa = flatten(a);
        var fb = flatten(b);
        var keys = new TreeMap<String, Boolean>();
        fa.keySet().forEach(k -> keys.put(k, true));
        fb.keySet().forEach(k -> keys.put(k, true));
        var out = new ArrayList<Diff>();
        for (var k : keys.keySet()) {
            var before = fa.getOrDefault(k, "");
            var after = fb.getOrDefault(k, "");
            if (!before.equals(after)) out.add(new Diff(k, objectOf(k, a, b), before, after));
        }
        return out;
    }

    /** List items are keyed by their id (not their index), so reordering or inserting does not show as a change. */
    static Map<String, String> flatten(JsonNode node) {
        var out = new LinkedHashMap<String, String>();
        flatten(node, "", out);
        return out;
    }

    private static void flatten(JsonNode n, String prefix, Map<String, String> out) {
        if (n == null || n.isMissingNode()) return;
        if (n.isArray()) {
            int i = 0;
            for (var x : n.values()) {
                var key = x.isObject() && x.has("id") ? x.get("id").asString() : String.valueOf(i);
                flatten(x, join(prefix, key), out);
                i++;
            }
        } else if (n.isObject()) {
            for (var e : n.properties()) flatten(e.getValue(), join(prefix, e.getKey()), out);
        } else {
            out.put(prefix, n.isNull() ? "" : n.asString());
        }
    }

    private static String join(String prefix, String key) {
        return prefix.isEmpty() ? key : prefix + "." + key;
    }

    /** The object a path belongs to: {@code list.id} for items of an id-keyed list, else the top-level field. */
    static String objectOf(String path, JsonNode a, JsonNode b) {
        var parts = path.split("\\.", 3);
        return parts.length > 1 && (idList(a.path(parts[0])) || idList(b.path(parts[0]))) ? parts[0] + "." + parts[1] : parts[0];
    }

    private static boolean idList(JsonNode n) {
        return n.isArray() && !n.isEmpty() && n.get(0).isObject() && n.get(0).has("id");
    }

    /** Same object, or one is the whole list the other is an item of. */
    static boolean sameObject(String a, String b) {
        return a.equals(b) || a.startsWith(b + ".") || b.startsWith(a + ".");
    }

    /** Objects the version changed; a draft with no change yet shows its declared scope. */
    static Set<String> touched(ConfigVersion v) {
        var out = new LinkedHashSet<String>();
        v.changes().forEach(c -> out.add(c.object()));
        if (out.isEmpty() && v.scope() != null) out.add(v.scope());
        return out;
    }

    // ——— rebase (AB-93) ———

    record Conflict(String object, ConfigVersion version) {}

    record RebasePlan(boolean stale, ConfigVersion base, ConfigVersion tip, Set<String> mine, List<Conflict> conflicts) {}

    /**
     * A draft is a full copy of its base. If another version came into force after the draft was created, the draft is
     * applied on top of the tip object by object; touching an object the newer version also changed is a conflict.
     */
    static RebasePlan rebasePlan(List<ConfigVersion> all, ConfigVersion v, JsonNode content, JsonNode baseContent) {
        var tip = tip(all).orElse(null);
        var base = all.stream().filter(x -> x.id().equals(v.baseId())).findFirst().orElse(null);
        var mine = new LinkedHashSet<String>();
        diff(baseContent, content).forEach(d -> mine.add(d.object()));
        boolean stale = !v.scheduled() && v.correctsId() == null && base != null && tip != null && !base.id().equals(tip.id());
        if (!stale) return new RebasePlan(false, base, tip, mine, List.of());
        var between = all.stream().filter(x -> x.inForce() && !x.id().equals(v.id()) && !x.id().equals(base.id()) && supersedes(x, base)).toList();
        var conflicts = new ArrayList<Conflict>();
        for (var m : mine) {
            between.stream().filter(b -> touched(b).stream().anyMatch(o -> sameObject(o, m))).findFirst()
                .ifPresent(hit -> conflicts.add(new Conflict(m, hit)));
        }
        return new RebasePlan(true, base, tip, mine, conflicts);
    }

    /** The tip's content with the draft's objects carried over as they are (like an SAP transport carries whole objects). */
    static JsonNode rebased(RebasePlan plan, JsonNode draft) {
        var c = (ObjectNode) plan.tip().content().deepCopy();
        for (var m : plan.mine()) {
            var parts = m.split("\\.", 2);
            if (parts.length == 1) {
                if (draft.has(m)) c.set(m, draft.get(m).deepCopy());
                else c.remove(m);
                continue;
            }
            var list = c.has(parts[0]) && c.get(parts[0]).isArray() ? (ArrayNode) c.get(parts[0]) : c.putArray(parts[0]);
            var src = item(draft.path(parts[0]), parts[1]);
            int i = indexOf(list, parts[1]);
            if (src == null) { if (i >= 0) list.remove(i); }
            else if (i >= 0) list.set(i, src.deepCopy());
            else list.add(src.deepCopy());
        }
        return c;
    }

    private static JsonNode item(JsonNode list, String id) {
        for (var x : list.values()) if (id.equals(x.path("id").asString())) return x;
        return null;
    }

    private static int indexOf(ArrayNode list, String id) {
        for (int i = 0; i < list.size(); i++) if (id.equals(list.get(i).path("id").asString())) return i;
        return -1;
    }

    // ——— scheduling checks ———

    /** The first reason the version cannot be scheduled on {@code from} (message key suffix), or empty. */
    static Optional<String> scheduleProblem(List<ConfigVersion> all, ConfigVersion v, LocalDate from, LocalDate today, JsonNode baseContent) {
        if (from == null || from.isBefore(today)) return Optional.of("past");
        if (all.stream().anyMatch(x -> !x.id().equals(v.id()) && !x.id().equals(v.correctsId()) && x.inForce() && x.from().equals(from))) return Optional.of("taken");
        if (v.correctsId() == null && all.stream().anyMatch(x -> !x.id().equals(v.id()) && x.inForce() && x.from().isAfter(from))) return Optional.of("beforeTip");
        if (awaiting(all, v.id()).isPresent()) return Optional.of("awaiting");
        if (!rebasePlan(all, v, v.content(), baseContent).conflicts().isEmpty()) return Optional.of("conflict");
        if (diff(baseContent, v.content()).isEmpty()) return Optional.of("empty");
        return Optional.empty();
    }
}
