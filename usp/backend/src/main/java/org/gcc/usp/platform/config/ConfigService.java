package org.gcc.usp.platform.config;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.gcc.usp.platform.config.ConfigVersion.Approval;
import org.gcc.usp.platform.config.ConfigVersion.Change;
import org.gcc.usp.platform.config.ConfigVersion.RebasedFrom;
import org.gcc.usp.platform.config.ConfigVersion.Revoked;
import org.gcc.usp.platform.config.ConfigVersion.Status;
import org.gcc.usp.platform.config.VersionChain.Diff;
import org.gcc.usp.platform.identity.CurrentUser;
import org.gcc.usp.platform.org.OrgDirectory;
import org.gcc.usp.platform.org.OrgModel.PersonRef;
import org.gcc.usp.platform.shared.ApiException;
import org.gcc.usp.platform.shared.LocalizedText;
import org.gcc.usp.platform.shared.MessageRef;
import org.gcc.usp.platform.shared.Messages;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * The version machine shared by every versioned configuration (§7.10, the prototype's policy versions): draft →
 * schedule (date, reason, reference) → optional second approval → in force on its date; correction, revert, rebase of
 * stale drafts, change log and operations log. Managers and the second approver are SAP positions, read on the fly.
 */
@Service
@Transactional
public class ConfigService {

    private static final TypeReference<List<Change>> CHANGES = new TypeReference<>() {};
    private static final TypeReference<List<String>> STRINGS = new TypeReference<>() {};

    private final JdbcClient jdbc;
    private final JsonMapper json;
    private final Map<String, ConfigKind> kinds;
    private final List<ConfigUsage> usages;
    private final CurrentUser currentUser;
    private final OrgDirectory org;
    private final Messages messages;
    private final Clock clock;

    ConfigService(JdbcClient jdbc, JsonMapper json, List<ConfigKind> kinds, List<ConfigUsage> usages, CurrentUser currentUser,
                  OrgDirectory org, Messages messages, Optional<Clock> clock) {
        this.jdbc = jdbc;
        this.json = json;
        this.kinds = kinds.stream().collect(Collectors.toMap(ConfigKind::key, Function.identity()));
        this.usages = usages;
        this.currentUser = currentUser;
        this.org = org;
        this.messages = messages;
        this.clock = clock.orElse(Clock.systemDefaultZone());
    }

    public record Governance(boolean secondApprover, String approverPositionId, List<String> ownerPositionIds) {}

    public record Summary(UUID id, String number, LocalDate from, LocalDate endsOn, Status status, PersonRef createdBy,
                          Instant createdAt, String reason, String reference, String scope, UUID correctsId, Approval approval,
                          Revoked revoked, RebasedFrom rebasedFrom, Set<String> touched) {}

    public record OpsEntry(Instant at, PersonRef by, LocalizedText what, String detail) {}

    public record Overview(String kind, LocalDate today, Governance governance, boolean canManage, boolean canApprove,
                           List<Summary> versions, List<OpsEntry> opsLog) {}

    public record Detail(Summary version, JsonNode content, List<Change> changes, boolean stale, List<String> conflicts) {}

    // ——— reads for the features that consume a configuration ———

    /** The version in force on a date (requests capture it at submission, D-009). */
    @Transactional(readOnly = true)
    public Optional<ConfigVersion> versionOn(String kind, LocalDate date) {
        return VersionChain.on(versions(kind(kind).key()), date);
    }

    @Transactional(readOnly = true)
    public Optional<ConfigVersion> version(String kind, UUID id) {
        return versions(kind(kind).key()).stream().filter(v -> v.id().equals(id)).findFirst();
    }

    // ——— administration views ———

    @Transactional(readOnly = true)
    public Overview overview(String kind) {
        var set = read(kind);
        boolean manage = isManager(set), approve = isApprover(set);
        if (!manage && !approve) throw ApiException.forbidden();
        var all = versions(kind);
        var today = today();
        var list = all.stream().sorted(VersionChain.NEWEST_FIRST.thenComparing(ConfigVersion::createdAt, Comparator.reverseOrder()))
            .map(v -> summary(v, all, today)).toList();
        var ops = jdbc.sql("select at, by, what, detail from config.ops_log where kind = :k order by at desc, id desc limit 200")
            .param("k", kind)
            .query((rs, n) -> new OpsEntry(rs.getTimestamp(1).toInstant(), org.describe(rs.getString(2)),
                messages.text(json.readValue(rs.getString(3), MessageRef.class)), rs.getString(4)))
            .list();
        return new Overview(kind, today, set.governance(), manage, approve, list, ops);
    }

    @Transactional(readOnly = true)
    public Detail detail(String kind, UUID id) {
        var set = read(kind);
        if (!isManager(set) && !isApprover(set)) throw ApiException.forbidden();
        var all = versions(kind);
        var v = find(all, id);
        var plan = VersionChain.rebasePlan(all, v, v.content(), baseContent(v, all));
        return new Detail(summary(v, all, today()), v.content(), v.changes(), plan.stale(),
            plan.conflicts().stream().map(c -> c.object() + " · " + c.version().number()).toList());
    }

    /** AB-91: difference between any two versions of a kind. */
    @Transactional(readOnly = true)
    public List<Diff> diff(String kind, UUID id, UUID against) {
        var set = read(kind);
        if (!isManager(set) && !isApprover(set)) throw ApiException.forbidden();
        var all = versions(kind);
        return VersionChain.diff(find(all, against).content(), find(all, id).content());
    }

    // ——— commands ———

    /** A new draft on the tip of the chain, or a correction: a copy of a version in force that replaces it from its own date. */
    public Detail newDraft(String kind, UUID correctsId, String scope) {
        var set = lock(kind);
        requireManager(set);
        var all = versions(kind);
        var today = today();
        var corrected = correctsId == null ? null : find(all, correctsId);
        if (corrected != null && !corrected.inForce()) throw ApiException.unprocessable("config.notInForce");
        var tip = VersionChain.tip(all);
        var base = corrected != null ? corrected : tip.orElse(null);
        LocalDate from;
        if (corrected != null) from = corrected.from().isAfter(today) ? corrected.from() : today;
        else {
            var proposed = today.plusDays(14);
            from = tip.filter(t -> !t.from().isBefore(proposed)).map(t -> t.from().plusDays(1)).orElse(proposed);
        }
        var year = String.valueOf(today.getYear());
        var number = year + "." + (all.stream().filter(v -> v.number().startsWith(year + ".")).count() + 1);
        var id = UUID.randomUUID();
        jdbc.sql("""
                insert into config.version (id, kind, number, effective_from, created_by, created_at, content, base_id, corrects_id, scope)
                values (:id, :k, :n, :from, :by, :at, cast(:c as jsonb), :base, :corrects, :scope)""")
            .param("id", id).param("k", kind).param("n", number).param("from", from).param("by", currentUser.personId())
            .param("at", Timestamp.from(clock.instant()))
            .param("c", json.writeValueAsString(base != null ? base.content() : kinds.get(kind).emptyContent()))
            .param("base", base == null ? null : base.id()).param("corrects", correctsId)
            .param("scope", corrected != null ? null : blankToNull(scope))
            .update();
        return detail(kind, id);
    }

    /** Saves the draft's full content; the change log is recomputed against its base, keeping who/when/why of unchanged lines. */
    public Detail updateContent(String kind, UUID id, JsonNode content, String why) {
        var set = lock(kind);
        requireManager(set);
        var all = versions(kind);
        var v = requireDraft(all, id);
        if (content == null || !content.isObject()) throw ApiException.unprocessable("config.contentInvalid");
        var diffs = VersionChain.diff(baseContent(v, all), content);
        if (v.scope() != null && diffs.stream().anyMatch(d -> !VersionChain.sameObject(d.object(), v.scope())))
            throw ApiException.unprocessable("config.outOfScope", v.scope());
        var changes = changes(diffs, v.changes(), why == null ? "" : why.trim());
        jdbc.sql("update config.version set content = cast(:c as jsonb), changes = cast(:ch as jsonb) where id = :id")
            .param("c", json.writeValueAsString(content)).param("ch", json.writeValueAsString(changes)).param("id", id).update();
        return detail(kind, id);
    }

    /** Widens or changes what the draft may touch (null = everything). */
    public Detail setScope(String kind, UUID id, String scope) {
        var set = lock(kind);
        requireManager(set);
        requireDraft(versions(kind), id);
        jdbc.sql("update config.version set scope = :s where id = :id").param("s", blankToNull(scope)).param("id", id).update();
        return detail(kind, id);
    }

    public Detail schedule(String kind, UUID id, LocalDate from, String reason, String reference) {
        var set = lock(kind);
        requireManager(set);
        var all = versions(kind);
        var v = requireDraft(all, id);
        if (reason == null || reason.isBlank()) throw ApiException.unprocessable("config.reasonRequired");
        var baseContent = baseContent(v, all);
        VersionChain.scheduleProblem(all, v, from, today(), baseContent).ifPresent(p -> {
            throw ApiException.unprocessable("config.schedule." + p);
        });
        var blocking = kinds.get(kind).problems(v.content()).stream().filter(c -> c.blocks()).toList();
        if (!blocking.isEmpty()) throw ApiException.unprocessable("config.schedule.invalid").withChecks(blocking);

        var now = clock.instant();
        var plan = VersionChain.rebasePlan(all, v, v.content(), baseContent);
        if (plan.stale()) {
            var content = VersionChain.rebased(plan, v.content());
            var why = v.changes().stream().map(Change::why).filter(w -> w != null && !w.isBlank()).findFirst().orElse("");
            var changes = changes(VersionChain.diff(plan.tip().content(), content), v.changes(), why);
            jdbc.sql("""
                    update config.version set content = cast(:c as jsonb), changes = cast(:ch as jsonb), base_id = :tip,
                      rebased_from = cast(:rb as jsonb) where id = :id""")
                .param("c", json.writeValueAsString(content)).param("ch", json.writeValueAsString(changes))
                .param("tip", plan.tip().id()).param("rb", json.writeValueAsString(new RebasedFrom(plan.base().id(), plan.base().number(), now)))
                .param("id", id).update();
            logOps(kind, MessageRef.of("config.ops.rebased", v.number(), plan.tip().number(), plan.base().number()), "");
        }
        var approval = set.secondApprover() ? new Approval(set.approverPositionId(), "pending", now, null, null, null) : null;
        jdbc.sql("""
                update config.version set scheduled = true, effective_from = :from, reason = :r, reference = :ref,
                  approval = cast(:a as jsonb) where id = :id""")
            .param("from", from).param("r", reason.trim()).param("ref", reference == null ? "" : reference.trim())
            .param("a", approval == null ? null : json.writeValueAsString(approval)).param("id", id).update();
        return detail(kind, id);
    }

    /** A draft, or a scheduled version before its date. */
    public Detail cancel(String kind, UUID id) {
        var set = lock(kind);
        requireManager(set);
        var all = versions(kind);
        var status = VersionChain.status(find(all, id), all, today());
        if (status != Status.DRAFT && status != Status.AWAITING && status != Status.SCHEDULED) throw ApiException.conflict("config.notCancellable");
        jdbc.sql("update config.version set cancelled = true where id = :id").param("id", id).update();
        return detail(kind, id);
    }

    /** Second approval by the holder of the governance position — never the version's own author. */
    public Detail approve(String kind, UUID id, String note) {
        return decide(kind, id, true, note);
    }

    /** Returns the version to draft with a note for its author. */
    public Detail returnToDraft(String kind, UUID id, String note) {
        if (note == null || note.isBlank()) throw ApiException.unprocessable("config.noteRequired");
        return decide(kind, id, false, note);
    }

    private Detail decide(String kind, UUID id, boolean approve, String note) {
        lock(kind);
        var all = versions(kind);
        var v = find(all, id);
        if (v.approval() == null || !v.approval().pending() || v.cancelled()) throw ApiException.conflict("config.notAwaiting");
        if (!org.me().holdsAny(List.of(v.approval().positionId()))) throw ApiException.forbidden();
        var me = currentUser.personId();
        if (me.equals(v.createdBy())) throw new ApiException(HttpStatus.FORBIDDEN, "config.selfApproval");
        var a = v.approval();
        var decided = new Approval(a.positionId(), approve ? "approved" : "returned", a.requestedAt(), me, clock.instant(), note == null ? "" : note.trim());
        jdbc.sql("update config.version set approval = cast(:a as jsonb), scheduled = :s where id = :id")
            .param("a", json.writeValueAsString(decided)).param("s", approve).param("id", id).update();
        logOps(kind, MessageRef.of(approve ? "config.ops.approved" : "config.ops.returned", v.number()), decided.note());
        return detail(kind, id);
    }

    /** Takes back the active version; the one before it applies again. Refused once a request was evaluated under it. */
    public Detail revert(String kind, UUID id, String reason) {
        var set = lock(kind);
        requireManager(set);
        if (reason == null || reason.isBlank()) throw ApiException.unprocessable("config.reasonRequired");
        var all = versions(kind);
        var v = find(all, id);
        if (VersionChain.status(v, all, today()) != Status.ACTIVE) throw ApiException.conflict("config.notActive");
        long uses = usages.stream().mapToLong(u -> u.uses(kind, id)).sum();
        if (uses > 0) throw ApiException.conflict("config.revert.evaluated", uses);
        all.stream().filter(x -> !x.id().equals(id) && x.scheduled() && !x.cancelled() && VersionChain.supersedes(x, v))
            .min(VersionChain.NEWEST_FIRST.reversed())
            .ifPresent(later -> { throw ApiException.conflict("config.revert.later", later.number()); });
        if (all.stream().noneMatch(x -> !x.id().equals(id) && x.inForce() && x.from().isBefore(v.from()))) throw ApiException.conflict("config.revert.only");
        var revoked = new Revoked(currentUser.personId(), clock.instant(), reason.trim());
        jdbc.sql("update config.version set cancelled = true, revoked = cast(:r as jsonb) where id = :id")
            .param("r", json.writeValueAsString(revoked)).param("id", id).update();
        logOps(kind, MessageRef.of("config.ops.reverted", v.number()), revoked.reason());
        return detail(kind, id);
    }

    public Governance setGovernance(String kind, Governance g) {
        var set = lock(kind);
        requireManager(set);
        var approver = blankToNull(g.approverPositionId());
        if (g.secondApprover() && approver == null) throw ApiException.unprocessable("config.approverRequired");
        var owners = g.ownerPositionIds() == null ? List.<String>of() : g.ownerPositionIds().stream().map(String::trim).filter(s -> !s.isEmpty()).distinct().toList();
        jdbc.sql("update config.config_set set second_approver = :s, approver_position_id = :a, owner_position_ids = cast(:o as jsonb) where kind = :k")
            .param("s", g.secondApprover()).param("a", approver).param("o", json.writeValueAsString(owners)).param("k", kind).update();
        var old = set.governance();
        if (old.secondApprover() != g.secondApprover() || (g.secondApprover() && !approver.equals(old.approverPositionId())))
            logOps(kind, MessageRef.of(g.secondApprover() ? "config.ops.secondApprovalOn" : "config.ops.secondApprovalOff"), g.secondApprover() ? approver : "");
        if (!Set.copyOf(owners).equals(Set.copyOf(old.ownerPositionIds()))) logOps(kind, MessageRef.of("config.ops.owners"), String.join(", ", owners));
        return read(kind).governance();
    }

    /** Operational changes (windows, groups, period close…) take effect at once and are logged here with no new version. */
    public void logOps(String kind, MessageRef what, String detail) {
        ensureSet(kind);
        jdbc.sql("insert into config.ops_log (kind, at, by, what, detail) values (:k, :at, :by, cast(:w as jsonb), :d)")
            .param("k", kind).param("at", Timestamp.from(clock.instant())).param("by", currentUser.personId())
            .param("w", json.writeValueAsString(what)).param("d", detail == null ? "" : detail).update();
    }

    // ——— internals ———

    private record SetRow(String kind, Governance governance) {
        boolean secondApprover() { return governance.secondApprover(); }
        String approverPositionId() { return governance.approverPositionId(); }
    }

    private ConfigKind kind(String key) {
        var k = kinds.get(key);
        if (k == null) throw ApiException.notFound(key);
        return k;
    }

    private void ensureSet(String kind) {
        kind(kind);
        jdbc.sql("insert into config.config_set (kind) values (:k) on conflict do nothing").param("k", kind).update();
    }

    /** Serialises every command on a kind (the chain rules compare versions with each other). */
    private SetRow lock(String kind) {
        ensureSet(kind);
        return selectSet(kind, " for update").orElseThrow();
    }

    private SetRow read(String kind) {
        kind(kind);
        return selectSet(kind, "").orElse(new SetRow(kind, new Governance(false, null, List.of())));
    }

    private Optional<SetRow> selectSet(String kind, String suffix) {
        return jdbc.sql("select second_approver, approver_position_id, owner_position_ids from config.config_set where kind = :k" + suffix)
            .param("k", kind)
            .query((rs, n) -> new SetRow(kind, new Governance(rs.getBoolean(1), rs.getString(2), json.readValue(rs.getString(3), STRINGS))))
            .optional();
    }

    private boolean isManager(SetRow set) {
        if (currentUser.isPlatformAdmin()) return true;
        return !set.governance().ownerPositionIds().isEmpty() && org.me().holdsAny(set.governance().ownerPositionIds());
    }

    private boolean isApprover(SetRow set) {
        return set.approverPositionId() != null && org.me().holdsAny(List.of(set.approverPositionId()));
    }

    private void requireManager(SetRow set) {
        if (!isManager(set)) throw ApiException.forbidden();
    }

    private ConfigVersion requireDraft(List<ConfigVersion> all, UUID id) {
        var v = find(all, id);
        if (v.scheduled() || v.cancelled()) throw ApiException.conflict("config.notDraft");
        return v;
    }

    private static ConfigVersion find(List<ConfigVersion> all, UUID id) {
        return all.stream().filter(v -> v.id().equals(id)).findFirst().orElseThrow(() -> ApiException.notFound(String.valueOf(id)));
    }

    private JsonNode baseContent(ConfigVersion v, List<ConfigVersion> all) {
        return all.stream().filter(x -> x.id().equals(v.baseId())).findFirst().map(ConfigVersion::content)
            .orElseGet(() -> kinds.get(v.kind()).emptyContent());
    }

    private List<Change> changes(List<Diff> diffs, List<Change> previous, String why) {
        var now = clock.instant();
        var by = currentUser.personId();
        var out = new ArrayList<Change>();
        for (var d : diffs) {
            var old = previous.stream().filter(c -> c.path().equals(d.path()) && c.after().equals(d.after())).findFirst();
            out.add(old.map(c -> new Change(d.path(), d.object(), d.before(), d.after(), c.at(), c.by(), c.why()))
                .orElse(new Change(d.path(), d.object(), d.before(), d.after(), now, by, why)));
        }
        return out;
    }

    private Summary summary(ConfigVersion v, List<ConfigVersion> all, LocalDate today) {
        return new Summary(v.id(), v.number(), v.from(), VersionChain.endOf(v, all).orElse(null), VersionChain.status(v, all, today),
            org.describe(v.createdBy()), v.createdAt(), v.reason(), v.reference(), v.scope(), v.correctsId(), v.approval(),
            v.revoked(), v.rebasedFrom(), VersionChain.touched(v));
    }

    // ponytail: loads every version (with content) of a kind per call; add a summary query if a kind reaches hundreds of versions.
    private List<ConfigVersion> versions(String kind) {
        return jdbc.sql("select * from config.version where kind = :k order by created_at").param("k", kind).query(this::map).list();
    }

    private ConfigVersion map(ResultSet rs, int n) throws SQLException {
        return new ConfigVersion(rs.getObject("id", UUID.class), rs.getString("kind"), rs.getString("number"),
            rs.getObject("effective_from", LocalDate.class), rs.getBoolean("scheduled"), rs.getBoolean("cancelled"),
            rs.getString("created_by"), rs.getTimestamp("created_at").toInstant(), rs.getString("reason"), rs.getString("reference"),
            json.readTree(rs.getString("content")), json.readValue(rs.getString("changes"), CHANGES),
            rs.getObject("base_id", UUID.class), rs.getObject("corrects_id", UUID.class), rs.getString("scope"),
            read(rs.getString("approval"), Approval.class), read(rs.getString("revoked"), Revoked.class),
            read(rs.getString("rebased_from"), RebasedFrom.class));
    }

    private <T> T read(String value, Class<T> type) {
        return value == null ? null : json.readValue(value, type);
    }

    private LocalDate today() {
        return LocalDate.now(clock);
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
