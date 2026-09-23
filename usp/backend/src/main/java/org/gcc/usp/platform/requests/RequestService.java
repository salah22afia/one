package org.gcc.usp.platform.requests;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Stream;
import org.gcc.usp.platform.catalog.CatalogService;
import org.gcc.usp.platform.documents.DocumentService;
import org.gcc.usp.platform.forms.FormValidator;
import org.gcc.usp.platform.forms.ServiceDefinition;
import org.gcc.usp.platform.forms.ServiceDefinitions;
import org.gcc.usp.platform.identity.PlatformUsers;
import org.gcc.usp.platform.org.OrgDirectory;
import org.gcc.usp.platform.org.OrgModel;
import org.gcc.usp.platform.org.OrgModel.PersonRef;
import org.gcc.usp.platform.requests.RequestViews.AuditView;
import org.gcc.usp.platform.requests.RequestViews.Counts;
import org.gcc.usp.platform.requests.RequestViews.DoneItem;
import org.gcc.usp.platform.requests.RequestViews.DonePage;
import org.gcc.usp.platform.requests.RequestViews.FieldView;
import org.gcc.usp.platform.requests.RequestViews.RequestDetail;
import org.gcc.usp.platform.requests.RequestViews.RequestPage;
import org.gcc.usp.platform.requests.RequestViews.RequestRow;
import org.gcc.usp.platform.requests.RequestViews.RequestView;
import org.gcc.usp.platform.requests.RequestViews.StepDetail;
import org.gcc.usp.platform.requests.RequestViews.StepDot;
import org.gcc.usp.platform.requests.RequestViews.TaskItem;
import org.gcc.usp.platform.requests.RequestViews.Waiting;
import org.gcc.usp.platform.rules.Check;
import org.gcc.usp.platform.shared.ApiException;
import org.gcc.usp.platform.shared.LocalizedText;
import org.gcc.usp.platform.shared.MessageRef;
import org.gcc.usp.platform.shared.Messages;
import org.gcc.usp.platform.shared.Sequences;
import org.gcc.usp.platform.workflow.StepDecided;
import org.gcc.usp.platform.workflow.StepReopened;
import org.gcc.usp.platform.workflow.WorkflowEngine;
import org.gcc.usp.platform.workflow.WorkflowEngine.Cursor;
import org.gcc.usp.platform.workflow.WorkflowEngine.StepBrief;
import org.gcc.usp.platform.workflow.WorkflowFinished;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.event.EventListener;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/**
 * Request runtime for every service (P-05): submit, my requests, detail and timeline, inbox, decisions, return and
 * resubmit, withdraw. Each change locks the request row first (then the workflow's rows), checks the version the
 * client saw, and bumps it: a stale screen or a second, concurrent action gets 409 instead of acting twice.
 */
@Service
@Transactional
public class RequestService {

    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Riyadh");
    private static final List<String> ONGOING = List.of("returned", "in_review");
    private static final List<String> FINISHED = List.of("completed", "rejected", "withdrawn");

    private final JdbcClient jdbc;
    private final JsonMapper json;
    private final ServiceDefinitions definitions;
    private final FormValidator validator;
    private final WorkflowEngine workflow;
    private final DocumentService documents;
    private final CatalogService catalog;
    private final OrgDirectory org;
    private final Sequences sequences;
    private final Messages messages;
    private final Clock clock;
    private final int pageSize;
    private final int maxPageSize;

    RequestService(JdbcClient jdbc, JsonMapper json, ServiceDefinitions definitions, FormValidator validator, WorkflowEngine workflow,
                   DocumentService documents, CatalogService catalog, OrgDirectory org, Sequences sequences, Messages messages, Optional<Clock> clock,
                   @Value("${usp.requests.page-size:30}") int pageSize, @Value("${usp.requests.max-page-size:100}") int maxPageSize) {
        this.jdbc = jdbc;
        this.json = json;
        this.definitions = definitions;
        this.validator = validator;
        this.workflow = workflow;
        this.documents = documents;
        this.catalog = catalog;
        this.org = org;
        this.sequences = sequences;
        this.messages = messages;
        this.clock = clock.orElse(Clock.systemUTC());
        this.pageSize = pageSize;
        this.maxPageSize = maxPageSize;
    }

    public RequestDetail submit(String serviceId, Map<String, Object> input, String channel, String requesterId) {
        // Services are for employees: routing, approvers and documents all come from SAP.
        if (PlatformUsers.isPlatformId(requesterId)) throw new ApiException(HttpStatus.FORBIDDEN, "auth.noSapAccount");
        var def = definitions.find(serviceId).orElseThrow(() -> ApiException.notFound("service " + serviceId));
        // The catalogue decides what can be requested now (an administrator may pause or hide a service at any time).
        if (!catalog.isAvailable(serviceId)) throw ApiException.conflict("catalog.notAvailable");
        var now = clock.instant();
        var data = accepted(def, input, LocalDate.ofInstant(now, BUSINESS_ZONE));

        int year = LocalDate.ofInstant(now, BUSINESS_ZONE).getYear();
        var id = "%s-%d-%05d".formatted(def.id(), year, sequences.next("request:" + def.id(), year));
        jdbc.sql("""
                insert into requests.request (id, service_id, module, feature, service_version, requester_id, status, channel, data, created_at, updated_at)
                values (:id, :svc, :mod, :feat, :ver, :req, 'in_review', :ch, cast(:data as jsonb), :now, :now)""")
            .param("id", id).param("svc", def.id()).param("mod", def.module()).param("feat", def.feature()).param("ver", def.version())
            .param("req", requesterId).param("ch", "app".equals(channel) ? "app" : "web").param("data", json.writeValueAsString(data))
            .param("now", Timestamp.from(now)).update();
        audit(id, requesterId, MessageRef.of("audit.submitted"));
        workflow.start(id, def, requesterId, data);
        return detail(id, requesterId);
    }

    /** Resubmission of a returned request (by its requester): validated against the version it was submitted with (A1). */
    public RequestDetail resubmit(String id, Map<String, Object> input, Integer version, String personId) {
        var row = lock(id);
        if (!row.requesterId().equals(personId)) throw ApiException.forbidden();
        checkVersion(row, version);
        if (!"returned".equals(row.status())) throw ApiException.conflict("request.notReturned");
        var def = definitions.find(row.serviceId(), row.serviceVersion()).orElseThrow(() -> ApiException.conflict("request.versionUnavailable"));
        var data = accepted(def, input, LocalDate.ofInstant(clock.instant(), BUSINESS_ZONE));
        jdbc.sql("update requests.request set data = cast(:data as jsonb) where id = :id").param("data", json.writeValueAsString(data)).param("id", id).update();
        workflow.resubmit(id, def, personId, data);
        return detail(id, personId);
    }

    /** The requester withdraws a request in review, while the service allows it (by default: before anyone else decided). */
    public RequestDetail withdraw(String id, Integer version, String personId) {
        var row = lock(id);
        if (!row.requesterId().equals(personId)) throw ApiException.forbidden();
        checkVersion(row, version);
        if (!canWithdraw(row.serviceId(), row.status(), id)) throw ApiException.conflict("request.cannotWithdraw");
        workflow.withdraw(id, personId);
        return detail(id, personId);
    }

    public RequestDetail decide(long stepId, String actorId, String action, String note, String ref, Integer version) {
        var requestId = workflow.requestOf(stepId).orElseThrow(() -> ApiException.notFound("step " + stepId));
        checkVersion(lock(requestId), version);
        workflow.decide(stepId, actorId, action, note, ref);
        return detail(requestId, actorId);
    }

    /** "My requests": ongoing (returned first, then in review) or finished, newest change first, a page at a time. */
    @Transactional(readOnly = true)
    public RequestPage mine(String personId, String view, String cursor, Integer limit) {
        var statuses = switch (view == null ? "ongoing" : view) {
            case "ongoing" -> ONGOING;
            case "finished" -> FINISHED;
            default -> throw new ApiException(HttpStatus.BAD_REQUEST, "error.badRequest");
        };
        int n = limit(limit);
        var rank = "(case when status = 'returned' then 0 else 1 end)";
        var after = "";
        String[] c = null;
        if (cursor != null && !cursor.isBlank()) {
            c = Cursors.decode(cursor, 3);
            after = "and (%1$s > :rank or (%1$s = :rank and (updated_at, id) < (:at, :id)))".formatted(rank);
        }
        var q = jdbc.sql("""
                select *, %s as row_rank from requests.request where requester_id = :p and status in (:st) %s
                order by row_rank, updated_at desc, id desc limit :n""".formatted(rank, after))
            .param("p", personId).param("st", statuses).param("n", n + 1);
        if (c != null) q = q.param("rank", (int) Cursors.number(c[0])).param("at", Timestamp.from(Cursors.instant(c[1]))).param("id", c[2]);
        List<MineRow> rows = q.query((rs, i) -> new MineRow(view(rs, i), rs.getInt("row_rank"))).list();
        var more = rows.size() > n;
        var page = more ? rows.subList(0, n) : rows;
        MineRow last = page.isEmpty() ? null : page.getLast();
        var next = more && last != null ? Cursors.encode(last.rank(), last.request().updatedAt(), last.request().id()) : null;
        return new RequestPage(rows(page.stream().map(MineRow::request).toList()), next, counts(personId));
    }

    @Transactional(readOnly = true)
    public RequestDetail detail(String id, String viewerId) {
        var request = jdbc.sql("select * from requests.request where id = :id").param("id", id).query(this::view).optional()
            .orElseThrow(() -> ApiException.notFound("request " + id));
        boolean requester = request.requester().id().equals(viewerId);
        if (!requester && !workflow.isParticipant(id, viewerId)) throw ApiException.forbidden();
        var def = definitions.find(request.serviceId()).orElseThrow(() -> ApiException.notFound("service " + request.serviceId()));
        Map<String, Object> data = json.readValue(
            jdbc.sql("select data from requests.request where id = :id").param("id", id).query(String.class).single(), new TypeReference<>() {});
        var fields = def.fields().stream().filter(f -> data.containsKey(f.key()))
            .map(f -> new FieldView(f.key(), f.type(), f.label(), data.get(f.key()), display(f, data.get(f.key())))).toList();

        // Ask SAP once, concurrently, for everyone the page names (holders of open steps, deciders, audit actors).
        var positions = workflow.progress(List.of(id)).values().stream().flatMap(p -> p.steps().stream())
            .filter(s -> "current".equals(s.status())).flatMap(s -> s.positionIds().stream()).toList();
        var auditRows = jdbc.sql("select at, actor_id, what from requests.audit where request_id = :id order by at, id").param("id", id)
            .query((rs, n) -> new AuditRow(rs.getTimestamp("at").toInstant(), rs.getString("actor_id"), json.readValue(rs.getString("what"), MessageRef.class))).list();
        var instance = workflow.instance(id);
        var people = Stream.concat(auditRows.stream().map(AuditRow::actorId),
            instance.stream().flatMap(i -> i.steps().stream()).map(WorkflowEngine.StepView::actorId)).toList();
        org.prefetch(people, positions);

        var steps = instance.map(i -> i.steps().stream().map(s -> new StepDetail(s.id(), s.key(), s.title(), s.mode(), s.status(),
            s.why() == null ? null : messages.text(s.why()), s.assigneeIds().stream().map(this::ref).toList(), s.actorId() == null ? null : ref(s.actorId()),
            s.action(), s.note(), s.ref(), s.startedAt(), s.dueAt(), s.completedAt(), "current".equals(s.status()) && s.assigneeIds().contains(viewerId),
            s.decisions(), s.shared())).toList()).orElse(List.of());
        var audit = auditRows.stream().map(a -> new AuditView(a.at(), a.actorId() == null ? null : ref(a.actorId()), messages.text(a.what()))).toList();
        boolean canWithdraw = requester && canWithdraw(request.serviceId(), request.status(), id);
        boolean canResubmit = requester && "returned".equals(request.status());
        return new RequestDetail(request, fields, steps, audit, documents.forRequest(id), def.next(), canWithdraw, canResubmit);
    }

    @Transactional(readOnly = true)
    public List<TaskItem> tasks(String personId) {
        var tasks = workflow.tasksFor(personId);
        org.prefetch(tasks.stream().map(WorkflowEngine.TaskView::requesterId).toList(), List.of());
        return tasks.stream().map(t -> new TaskItem(t.stepId(), t.requestId(), t.serviceId(), serviceName(t.serviceId()), icon(t.serviceId()), t.title(),
            t.mode(), ref(t.requesterId()), t.startedAt(), t.dueAt(), t.overdue(), t.why() == null ? null : messages.text(t.why()), t.decisions(),
            t.shared())).toList();
    }

    /** Tasks → Done: the decisions the person took on other people's requests, newest first. */
    @Transactional(readOnly = true)
    public DonePage done(String personId, String cursor, Integer limit) {
        int n = limit(limit);
        Cursor before = null;
        if (cursor != null && !cursor.isBlank()) {
            var c = Cursors.decode(cursor, 2);
            before = new Cursor(Cursors.instant(c[0]), Cursors.number(c[1]));
        }
        var rows = workflow.decisionsBy(personId, before, n + 1);
        var more = rows.size() > n;
        var page = more ? rows.subList(0, n) : rows;
        org.prefetch(page.stream().map(WorkflowEngine.DecisionView::requesterId).toList(), List.of());
        var items = page.stream().map(d -> new DoneItem(d.stepId(), d.requestId(), d.serviceId(), serviceName(d.serviceId()), icon(d.serviceId()),
            d.stepTitle(), ref(d.requesterId()), d.action(), d.at())).toList();
        WorkflowEngine.DecisionView last = page.isEmpty() ? null : page.getLast();
        return new DonePage(items, more && last != null ? Cursors.encode(last.at(), last.id()) : null, workflow.decisionCount(personId));
    }

    @EventListener
    void on(StepDecided e) {
        var ref = e.ref() == null || e.ref().isBlank() ? "" : " — " + e.ref();
        var what = switch (e.action()) {
            case "approve" -> MessageRef.of("audit.approved", e.title());
            case "reject" -> MessageRef.of("audit.rejected", e.title());
            case "return" -> MessageRef.of("audit.returned", e.title(), e.note() == null ? "" : e.note());
            case "receive" -> MessageRef.of("audit.received", e.title());
            default -> MessageRef.of(e.actorId() == null ? "audit.systemDone" : "audit.done", e.title(), ref);
        };
        audit(e.requestId(), e.actorId(), what);
        touch(e.requestId(), "return".equals(e.action()) ? "returned" : null);
    }

    @EventListener
    void on(StepReopened e) {
        audit(e.requestId(), e.requesterId(), MessageRef.of("audit.resubmitted", e.title()));
        touch(e.requestId(), "in_review");
    }

    @EventListener
    void on(WorkflowFinished e) {
        touch(e.requestId(), e.outcome());
        switch (e.outcome()) {
            case "completed" -> audit(e.requestId(), null, MessageRef.of("audit.completed"));
            case "withdrawn" -> audit(e.requestId(), requesterOf(e.requestId()), MessageRef.of("audit.withdrawn"));
            default -> audit(e.requestId(), null, MessageRef.of("audit.requestRejected"));
        }
    }

    /* ——— helpers ——— */

    /** Trust boundary: only the fields the service defines, validated as the clients validate them (AB-35). */
    private Map<String, Object> accepted(ServiceDefinition def, Map<String, Object> input, LocalDate today) {
        var data = new LinkedHashMap<String, Object>();
        for (var f : def.fields()) if (input != null && input.containsKey(f.key())) data.put(f.key(), input.get(f.key()));
        List<Check> checks = validator.validate(def, data, today);
        if (checks.stream().anyMatch(Check::blocks)) throw ApiException.unprocessable("validation.review").withChecks(checks);
        return data;
    }

    /** Locks the request row: first in every change, so the changes of one request never interleave. */
    private LockedRow lock(String id) {
        return jdbc.sql("select requester_id, status, service_id, service_version, version from requests.request where id = :id for update")
            .param("id", id)
            .query((rs, n) -> new LockedRow(rs.getString("requester_id"), rs.getString("status"), rs.getString("service_id"),
                rs.getInt("service_version"), rs.getInt("version")))
            .optional().orElseThrow(() -> ApiException.notFound("request " + id));
    }

    /** Optimistic locking: the client acted on the version it saw; if the request changed since, it must look again. */
    private static void checkVersion(LockedRow row, Integer expected) {
        if (expected != null && expected != row.version()) throw ApiException.conflict("request.stale");
    }

    private boolean canWithdraw(String serviceId, String status, String requestId) {
        var withdrawable = definitions.find(serviceId).map(ServiceDefinition::withdrawable).orElse(false);
        return withdrawable && "in_review".equals(status) && !workflow.decidedByOthers(requestId);
    }

    private int limit(Integer limit) {
        return limit == null ? pageSize : Math.max(1, Math.min(limit, maxPageSize));
    }

    private Counts counts(String personId) {
        var by = new HashMap<String, Integer>();
        jdbc.sql("select status, count(*) as n from requests.request where requester_id = :p group by status").param("p", personId)
            .query(rs -> { by.put(rs.getString("status"), rs.getInt("n")); });
        int returned = by.getOrDefault("returned", 0);
        return new Counts(returned + by.getOrDefault("in_review", 0), returned, FINISHED.stream().mapToInt(s -> by.getOrDefault(s, 0)).sum());
    }

    /** Rows with their progress, documents and who has them now (one SAP round, concurrent, for the whole page). */
    private List<RequestRow> rows(List<RequestView> requests) {
        var ids = requests.stream().map(RequestView::id).toList();
        var progress = workflow.progress(ids);
        var docs = documents.countsByRequest(ids);
        var single = new ArrayList<String>();
        var people = new ArrayList<String>();
        for (var p : progress.values())
            p.waitingOn().filter(s -> "current".equals(s.status())).ifPresent(s -> {
                if (s.positionIds().size() == 1) single.add(s.positionIds().getFirst());
                else if (s.positionIds().isEmpty() && s.assignedTo().size() == 1) people.add(s.assignedTo().getFirst());
            });
        org.prefetch(people, single);
        var out = new ArrayList<RequestRow>();
        for (var r : requests) {
            var p = progress.get(r.id());
            var steps = p == null ? List.<StepDot>of()
                : p.steps().stream().filter(s -> !"skipped".equals(s.status())).map(s -> new StepDot(s.key(), s.title(), s.status())).toList();
            var waiting = p == null ? null : p.waitingOn().map(s -> waiting(s, r.requester().id())).orElse(null);
            out.add(new RequestRow(r.id(), r.serviceId(), r.serviceName(), r.icon(), r.status(), r.createdAt(), r.updatedAt(), r.version(), steps, waiting,
                docs.getOrDefault(r.id(), 0)));
        }
        return out;
    }

    /** Who has the step: one person by name (with their title), otherwise the step's reason ("Personnel Affairs team"). */
    private Waiting waiting(StepBrief s, String requesterId) {
        PersonRef holder = null;
        LocalizedText who = s.why() == null ? null : messages.text(s.why());
        if ("current".equals(s.status())) {
            if (s.positionIds().size() == 1) {
                var pos = org.position(s.positionIds().getFirst());
                var h = pos.map(OrgModel.Position::holder).filter(x -> !x.employeeNo().equals(requesterId));
                if (h.isPresent()) holder = new PersonRef(h.get().employeeNo(), h.get().name(), pos.get().title());
                else if (pos.isPresent()) who = pos.get().title();
            } else if (s.positionIds().isEmpty() && s.assignedTo().size() == 1) {
                holder = ref(s.assignedTo().getFirst());
            }
        }
        return new Waiting(s.title(), s.status(), holder, who, s.startedAt(), s.dueAt(), "returned".equals(s.status()) ? s.note() : null);
    }

    private void touch(String id, String status) {
        jdbc.sql("update requests.request set updated_at = :now, status = coalesce(:st, status), version = version + 1 where id = :id")
            .param("now", Timestamp.from(clock.instant())).param("st", status).param("id", id).update();
    }

    private String requesterOf(String id) {
        return jdbc.sql("select requester_id from requests.request where id = :id").param("id", id).query(String.class).single();
    }

    /** Stored as a message reference, rendered in every language on read. */
    private void audit(String requestId, String actorId, MessageRef what) {
        jdbc.sql("insert into requests.audit (request_id, at, actor_id, what) values (:r, :at, :a, cast(:w as jsonb))")
            .param("r", requestId).param("at", Timestamp.from(clock.instant())).param("a", actorId).param("w", json.writeValueAsString(what)).update();
    }

    private PersonRef ref(String personId) {
        return org.describe(personId);
    }

    private LocalizedText serviceName(String serviceId) {
        return definitions.find(serviceId).map(ServiceDefinition::name).orElse(LocalizedText.of("und", serviceId));
    }

    private String icon(String serviceId) {
        return definitions.find(serviceId).map(ServiceDefinition::icon).orElse(null);
    }

    private LocalizedText display(ServiceDefinition.FieldDef f, Object v) {
        if (v instanceof Boolean b) return messages.text(b ? "common.yes" : "common.no");
        if (f.options() != null)
            for (var o : f.options()) if (o.value().equals(String.valueOf(v))) return o.label();
        return LocalizedText.of("und", String.valueOf(v)); // a user-entered value: not language-specific
    }

    private RequestView view(ResultSet rs, int n) throws SQLException {
        var svc = rs.getString("service_id");
        return new RequestView(rs.getString("id"), svc, rs.getString("module"), rs.getString("feature"), serviceName(svc), icon(svc),
            rs.getString("status"), rs.getString("channel"), ref(rs.getString("requester_id")), rs.getTimestamp("created_at").toInstant(),
            rs.getTimestamp("updated_at").toInstant(), rs.getInt("version"));
    }

    private record LockedRow(String requesterId, String status, String serviceId, int serviceVersion, int version) {}

    private record MineRow(RequestView request, int rank) {}

    private record AuditRow(Instant at, String actorId, MessageRef what) {}
}
