package org.gcc.usp.platform.workflow;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.gcc.usp.platform.forms.ServiceDefinition;
import org.gcc.usp.platform.org.AgentRule;
import org.gcc.usp.platform.org.ApproverResolver;
import org.gcc.usp.platform.org.OrgDirectory;
import org.gcc.usp.platform.org.OrgModel;
import org.gcc.usp.platform.org.Resolution;
import org.gcc.usp.platform.rules.Check;
import org.gcc.usp.platform.rules.RuleEvaluator;
import org.gcc.usp.platform.shared.ApiException;
import org.gcc.usp.platform.shared.LocalizedText;
import org.gcc.usp.platform.shared.MessageRef;
import org.gcc.usp.platform.shared.Messages;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/**
 * In-house engine (§7.6.1), a port of the prototype's route model. A human step waits on SAP positions resolved when it
 * opens (CAP-01); whoever holds one of them in SAP when they look sees the task, so a change of holder moves it.
 * Every change locks the instance row first, so the changes of one request never interleave.
 */
@Service
@Transactional
class InHouseWorkflowEngine implements WorkflowEngine {

    private static final List<String> HUMAN = List.of("approve", "fulfil", "receipt");
    private static final List<String> NEED_NOTE = List.of("return", "reject");
    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Riyadh");
    private static final TypeReference<List<String>> STRINGS = new TypeReference<>() {};

    private final JdbcClient jdbc;
    private final JsonMapper json;
    private final ApproverResolver resolver;
    private final OrgDirectory org;
    private final RuleEvaluator rules;
    private final ApplicationEventPublisher events;
    private final Map<String, SystemStepHandler> handlers;
    private final Messages messages;
    private final Clock clock;
    private final int noteMax;
    private final int refMax;

    InHouseWorkflowEngine(JdbcClient jdbc, JsonMapper json, ApproverResolver resolver, OrgDirectory org, RuleEvaluator rules,
                          ApplicationEventPublisher events, List<SystemStepHandler> handlers, Messages messages, Optional<Clock> clock,
                          @Value("${usp.workflow.note-max-length:1000}") int noteMax, @Value("${usp.workflow.ref-max-length:100}") int refMax) {
        this.jdbc = jdbc;
        this.json = json;
        this.resolver = resolver;
        this.org = org;
        this.rules = rules;
        this.events = events;
        this.handlers = handlers.stream().collect(Collectors.toMap(SystemStepHandler::operation, Function.identity()));
        this.messages = messages;
        this.clock = clock.orElse(Clock.systemUTC());
        this.noteMax = noteMax;
        this.refMax = refMax;
    }

    @Override
    public InstanceView start(String requestId, ServiceDefinition def, String requesterId, Map<String, Object> data) {
        var now = clock.instant();
        jdbc.sql("""
                insert into workflow.instance (request_id, service_id, service_version, requester_id, status, data, created_at)
                values (:id, :svc, :ver, :req, 'running', cast(:data as jsonb), :now)""")
            .param("id", requestId).param("svc", def.id()).param("ver", def.version()).param("req", requesterId)
            .param("data", json.writeValueAsString(data)).param("now", Timestamp.from(now)).update();
        var ctx = context(data, now);
        int seq = 0;
        for (var s : def.steps()) {
            if (!HUMAN.contains(s.mode()) && !List.of("system", "notify").contains(s.mode()))
                throw new IllegalStateException("Step mode '" + s.mode() + "' is not supported yet (" + def.id() + "/" + s.key() + ")");
            boolean applies = applies(s, ctx);
            jdbc.sql("""
                    insert into workflow.step (request_id, seq, key, title, mode, status, agent, operation, sla_hours, why, decisions)
                    values (:r, :seq, :key, cast(:title as jsonb), :mode, :status, cast(:agent as jsonb), :op, :sla, cast(:why as jsonb),
                            cast(:decisions as jsonb))""")
                .param("r", requestId).param("seq", seq++).param("key", s.key()).param("title", json.writeValueAsString(s.title()))
                .param("mode", s.mode()).param("status", applies ? "pending" : "skipped")
                .param("agent", s.agent() == null || s.agent().isNull() ? null : s.agent().toString())
                .param("op", s.operation()).param("sla", s.slaHours())
                .param("why", applies ? null : json.writeValueAsString(MessageRef.of("workflow.notApplied")))
                .param("decisions", s.decisions() == null ? null : json.writeValueAsString(s.decisions()))
                .update();
        }
        advance(requestId);
        return instance(requestId).orElseThrow();
    }

    @Override
    public InstanceView decide(long stepId, String actorId, String action, String note, String ref) {
        var requestId = requestOf(stepId).orElseThrow(() -> ApiException.notFound("step " + stepId));
        var inst = lockInstance(requestId);
        var step = jdbc.sql("select * from workflow.step where id = :id for update").param("id", stepId).query(this::row).single();
        if (!"current".equals(step.status()) || !HUMAN.contains(step.mode())) throw ApiException.conflict("workflow.notAwaiting");
        if (!isMine(step, inst.requesterId(), actorId)) throw ApiException.forbidden();
        if (!step.decisions().contains(action)) throw ApiException.unprocessable("workflow.actionNotAvailable");
        note = trimToNull(note);
        ref = trimToNull(ref);
        checkLength("note", note, noteMax);
        checkLength("ref", ref, refMax);
        if ("done".equals(action) && ref == null)
            throw ApiException.unprocessable("workflow.refRequired")
                .withChecks(List.of(new Check("required:ref", "block", messages.text("workflow.refRequired.field"), "ref")));
        if (NEED_NOTE.contains(action) && note == null)
            throw ApiException.unprocessable("workflow.noteRequired")
                .withChecks(List.of(new Check("required:note", "block", messages.text("workflow.noteRequired.field"), "note")));

        var now = clock.instant();
        jdbc.sql("""
                insert into workflow.decision (step_id, request_id, actor_id, action, note, ref, at)
                values (:s, :r, :a, :action, :note, :ref, :at)""")
            .param("s", stepId).param("r", requestId).param("a", actorId).param("action", action).param("note", note).param("ref", ref)
            .param("at", Timestamp.from(now)).update();
        switch (action) {
            case "return" -> {
                // Back to the requester; resubmission resumes at this same step (the prototype's rule).
                finish(step.id(), "returned", actorId, action, note, null);
                setStatus(requestId, "returned");
                events.publishEvent(new StepDecided(requestId, step.key(), step.title(), step.mode(), actorId, action, note, null));
            }
            case "reject" -> {
                finish(step.id(), "rejected", actorId, action, note, ref);
                skipOpen(requestId);
                events.publishEvent(new StepDecided(requestId, step.key(), step.title(), step.mode(), actorId, action, note, ref));
                end(requestId, "rejected");
            }
            default -> {
                finish(step.id(), "done", actorId, action, note, ref);
                events.publishEvent(new StepDecided(requestId, step.key(), step.title(), step.mode(), actorId, action, note, ref));
                advance(requestId);
            }
        }
        return instance(requestId).orElseThrow();
    }

    @Override
    public InstanceView resubmit(String requestId, ServiceDefinition def, String requesterId, Map<String, Object> data) {
        var inst = lockInstance(requestId);
        if (!inst.requesterId().equals(requesterId)) throw ApiException.forbidden();
        if (!"returned".equals(inst.status())) throw ApiException.conflict("request.notReturned");
        var returning = steps(requestId).stream().filter(s -> "returned".equals(s.status())).findFirst()
            .orElseThrow(() -> ApiException.conflict("request.notReturned"));
        var now = clock.instant();
        jdbc.sql("update workflow.instance set status = 'running', data = cast(:data as jsonb) where request_id = :r")
            .param("data", json.writeValueAsString(data)).param("r", requestId).update();

        // Later steps follow the new data: a condition that now holds (or no longer holds) adds (or drops) its step.
        var ctx = context(data, now);
        var byKey = def.steps().stream().collect(Collectors.toMap(ServiceDefinition.StepDef::key, Function.identity()));
        for (var s : steps(requestId)) {
            if (s.seq() <= returning.seq()) continue;
            boolean byCondition = "skipped".equals(s.status()) && s.why() != null && "workflow.notApplied".equals(s.why().key());
            if (!"pending".equals(s.status()) && !byCondition) continue;
            var d = byKey.get(s.key());
            if (d == null) continue;
            boolean applies = applies(d, ctx);
            jdbc.sql("update workflow.step set status = :st, why = cast(:why as jsonb) where id = :id")
                .param("st", applies ? "pending" : "skipped")
                .param("why", applies ? null : json.writeValueAsString(MessageRef.of("workflow.notApplied")))
                .param("id", s.id()).update();
        }

        jdbc.sql("update workflow.step set actor_id = null, action = null, note = null, ref = null, completed_at = null where id = :id")
            .param("id", returning.id()).update();
        open(returning, resolve(returning, requesterId), now);
        events.publishEvent(new StepReopened(requestId, returning.key(), returning.title(), requesterId));
        return instance(requestId).orElseThrow();
    }

    @Override
    public InstanceView withdraw(String requestId, String requesterId) {
        var inst = lockInstance(requestId);
        if (!inst.requesterId().equals(requesterId)) throw ApiException.forbidden();
        if (!"running".equals(inst.status())) throw ApiException.conflict("request.cannotWithdraw");
        skipOpen(requestId);
        end(requestId, "withdrawn");
        return instance(requestId).orElseThrow();
    }

    /** Runs automatic steps and stops at the first human step (or finishes the instance). */
    private void advance(String requestId) {
        var inst = instanceRow(requestId);
        while (true) {
            var next = jdbc.sql("select * from workflow.step where request_id = :r and status = 'pending' order by seq limit 1")
                .param("r", requestId).query(this::row).optional();
            if (next.isEmpty()) {
                end(requestId, "completed");
                return;
            }
            var s = next.get();
            var now = clock.instant();
            switch (s.mode()) {
                case "system" -> {
                    var op = s.operation() == null ? "" : s.operation();
                    var name = op.contains(":") ? op.substring(0, op.indexOf(':')) : op;
                    var handler = handlers.get(name);
                    if (handler == null) {
                        // No handler yet (e.g. an SAP service not built): park the step visibly instead of failing the request.
                        jdbc.sql("update workflow.step set status = 'waiting', started_at = :now, why = cast(:why as jsonb) where id = :id")
                            .param("now", Timestamp.from(now)).param("id", s.id())
                            .param("why", json.writeValueAsString(MessageRef.of("workflow.waitingIntegration", op))).update();
                        return;
                    }
                    var arg = op.contains(":") ? op.substring(op.indexOf(':') + 1) : null;
                    var result = handler.execute(new SystemStepHandler.Context(requestId, inst.serviceId(), inst.requesterId(), arg,
                        inst.data(), instance(requestId).orElseThrow().steps()));
                    jdbc.sql("update workflow.step set started_at = :now where id = :id").param("now", Timestamp.from(now)).param("id", s.id()).update();
                    finish(s.id(), "done", null, "done", null, result.ref());
                    events.publishEvent(new StepDecided(requestId, s.key(), s.title(), s.mode(), null, "done", null, result.ref()));
                }
                case "notify" -> {
                    open(s, resolve(s, inst.requesterId()), now);
                    finish(s.id(), "done", null, "notified", null, null);
                }
                default -> {
                    open(s, resolve(s, inst.requesterId()), now);
                    return;
                }
            }
        }
    }

    private void open(Step s, Resolution r, Instant now) {
        // Position steps are matched live against SAP positions; person steps (the requester's own) keep the people.
        var people = r.positionIds().isEmpty() ? r.personIds() : List.<String>of();
        jdbc.sql("""
                update workflow.step set status = 'current', position_ids = cast(:pos as jsonb), assigned_to = cast(:people as jsonb),
                       why = cast(:why as jsonb), started_at = :now, due_at = :due where id = :id""")
            .param("pos", json.writeValueAsString(r.positionIds())).param("people", json.writeValueAsString(people))
            .param("why", r.why() == null ? null : json.writeValueAsString(r.why()))
            .param("now", Timestamp.from(now)).param("due", s.slaHours() == null ? null : Timestamp.from(now.plus(Duration.ofHours(s.slaHours()))))
            .param("id", s.id()).update();
        // The inbox index: one row per position or person that can act on the open step.
        jdbc.sql("delete from workflow.step_assignee where step_id = :id").param("id", s.id()).update();
        for (var p : r.positionIds())
            jdbc.sql("insert into workflow.step_assignee (step_id, position_id) values (:id, :p)").param("id", s.id()).param("p", p).update();
        for (var p : people)
            jdbc.sql("insert into workflow.step_assignee (step_id, person_id) values (:id, :p)").param("id", s.id()).param("p", p).update();
    }

    private void finish(long stepId, String status, String actorId, String action, String note, String ref) {
        jdbc.sql("""
                update workflow.step set status = :st, actor_id = :actor, action = :action, note = :note, ref = :ref, completed_at = :now
                where id = :id""")
            .param("st", status).param("actor", actorId).param("action", action).param("note", note).param("ref", ref)
            .param("now", Timestamp.from(clock.instant())).param("id", stepId).update();
        jdbc.sql("delete from workflow.step_assignee where step_id = :id").param("id", stepId).update();
    }

    /** Open and later steps no longer happen (rejection, withdrawal). */
    private void skipOpen(String requestId) {
        jdbc.sql("""
                delete from workflow.step_assignee where step_id in
                  (select id from workflow.step where request_id = :r and status in ('current', 'pending', 'waiting'))""")
            .param("r", requestId).update();
        jdbc.sql("update workflow.step set status = 'skipped' where request_id = :r and status in ('current', 'pending', 'waiting')")
            .param("r", requestId).update();
    }

    private void end(String requestId, String outcome) {
        setStatus(requestId, outcome);
        events.publishEvent(new WorkflowFinished(requestId, outcome));
    }

    private void setStatus(String requestId, String status) {
        jdbc.sql("update workflow.instance set status = :s where request_id = :r").param("s", status).param("r", requestId).update();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<InstanceView> instance(String requestId) {
        return jdbc.sql("select * from workflow.instance where request_id = :r").param("r", requestId).query(this::mapInstance).optional()
            .map(inst -> new InstanceView(requestId, inst.requesterId(), inst.status(), steps(requestId).stream().map(s -> view(s, inst.requesterId())).toList()));
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Progress> progress(Collection<String> requestIds) {
        if (requestIds.isEmpty()) return Map.of();
        var status = new HashMap<String, String>();
        jdbc.sql("select request_id, status from workflow.instance where request_id in (:ids)").param("ids", requestIds)
            .query(rs -> { status.put(rs.getString("request_id"), rs.getString("status")); });
        var steps = new LinkedHashMap<String, List<StepBrief>>();
        jdbc.sql("select * from workflow.step where request_id in (:ids) order by request_id, seq").param("ids", requestIds).query(this::row).list()
            .forEach(s -> steps.computeIfAbsent(s.requestId(), k -> new ArrayList<>()).add(new StepBrief(s.key(), s.title(), s.mode(), s.status(),
                s.positionIds(), s.assignedTo(), s.why(), s.note(), s.startedAt(), s.dueAt())));
        var out = new HashMap<String, Progress>();
        status.forEach((id, st) -> out.put(id, new Progress(id, st, steps.getOrDefault(id, List.of()))));
        return out;
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<String> requestOf(long stepId) {
        return jdbc.sql("select request_id from workflow.step where id = :id").param("id", stepId).query(String.class).optional();
    }

    @Override
    @Transactional(readOnly = true)
    public List<TaskView> tasksFor(String personId) {
        var now = clock.instant();
        var me = org.me();
        var positions = new ArrayList<String>(me.positionIds());
        positions.addAll(me.actingFor());
        // Looked up through the assignee index by the viewer's positions (SAP-010) and person, never by scanning every open step.
        var sql = """
                select s.*, i.requester_id as inst_requester, i.service_id as inst_service from workflow.step s
                join workflow.instance i on i.request_id = s.request_id
                where s.status = 'current' and s.mode in ('approve', 'fulfil', 'receipt')
                  and s.id in (select a.step_id from workflow.step_assignee a where a.person_id = :me %s)
                order by s.due_at asc nulls last, s.started_at, s.id"""
            .formatted(positions.isEmpty() ? "" : "or a.position_id in (:positions)");
        var q = jdbc.sql(sql).param("me", personId);
        if (!positions.isEmpty()) q = q.param("positions", positions);
        return q.query((rs, n) -> Map.entry(row(rs, n), new String[] { rs.getString("inst_requester"), rs.getString("inst_service") })).list().stream()
            .filter(e -> isMine(e.getKey(), e.getValue()[0], personId, me))
            .map(e -> {
                var s = e.getKey();
                return new TaskView(s.id(), s.requestId(), e.getValue()[1], e.getValue()[0], s.title(), s.mode(), s.startedAt(), s.dueAt(),
                    s.dueAt() != null && s.dueAt().isBefore(now), s.why(), s.decisions(), shared(s));
            }).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<DecisionView> decisionsBy(String personId, Cursor before, int limit) {
        // "Done by me": decisions on other people's requests (the requester's own receipts are not tasks done for others).
        var sql = """
                select d.id, d.step_id, d.request_id, d.action, d.at, s.title, i.service_id, i.requester_id
                from workflow.decision d
                join workflow.step s on s.id = d.step_id
                join workflow.instance i on i.request_id = d.request_id
                where d.actor_id = :p and i.requester_id <> d.actor_id %s
                order by d.at desc, d.id desc limit :n"""
            .formatted(before == null ? "" : "and (d.at < :at or (d.at = :at and d.id < :id))");
        var q = jdbc.sql(sql).param("p", personId).param("n", limit);
        if (before != null) q = q.param("at", Timestamp.from(before.at())).param("id", before.id());
        return q.query((rs, n) -> new DecisionView(rs.getLong("id"), rs.getLong("step_id"), rs.getString("request_id"), rs.getString("service_id"),
            rs.getString("requester_id"), json.readValue(rs.getString("title"), LocalizedText.class), rs.getString("action"),
            rs.getTimestamp("at").toInstant())).list();
    }

    @Override
    @Transactional(readOnly = true)
    public int decisionCount(String personId) {
        return jdbc.sql("""
                select count(*) from workflow.decision d join workflow.instance i on i.request_id = d.request_id
                where d.actor_id = :p and i.requester_id <> d.actor_id""")
            .param("p", personId).query(Integer.class).single();
    }

    @Override
    @Transactional(readOnly = true)
    public boolean isParticipant(String requestId, String personId) {
        var inst = jdbc.sql("select * from workflow.instance where request_id = :r").param("r", requestId).query(this::mapInstance).optional();
        if (inst.isEmpty()) return false;
        if (inst.get().requesterId().equals(personId)) return true;
        boolean decided = jdbc.sql("select exists (select 1 from workflow.decision where request_id = :r and actor_id = :p)")
            .param("r", requestId).param("p", personId).query(Boolean.class).single();
        if (decided) return true;
        return steps(requestId).stream().anyMatch(s -> "current".equals(s.status()) && isMine(s, inst.get().requesterId(), personId));
    }

    @Override
    @Transactional(readOnly = true)
    public boolean decidedByOthers(String requestId) {
        return jdbc.sql("""
                select exists (select 1 from workflow.decision d join workflow.instance i on i.request_id = d.request_id
                               where d.request_id = :r and d.actor_id <> i.requester_id)""")
            .param("r", requestId).query(Boolean.class).single();
    }

    /** No self-approval; person steps by employee number; position steps by the viewer's SAP positions now. */
    private boolean isMine(Step s, String requesterId, String personId) {
        if (s.positionIds().isEmpty()) return s.assignedTo().contains(personId);
        return isMine(s, requesterId, personId, org.me());
    }

    private static boolean isMine(Step s, String requesterId, String personId, OrgModel.Me me) {
        if (!s.positionIds().isEmpty()) return !personId.equals(requesterId) && me.holdsAny(s.positionIds());
        return s.assignedTo().contains(personId);
    }

    private static boolean shared(Step s) {
        return s.positionIds().size() > 1 || s.assignedTo().size() > 1;
    }

    /** Current holders of the step's positions, read from SAP now (A2); the requester is never listed. */
    private StepView view(Step s, String requesterId) {
        List<String> assignees = List.of();
        if ("current".equals(s.status()) && HUMAN.contains(s.mode())) {
            var people = new LinkedHashSet<>(s.assignedTo());
            for (var p : s.positionIds())
                org.position(p).map(OrgModel.Position::holder).filter(h -> !h.employeeNo().equals(requesterId)).ifPresent(h -> people.add(h.employeeNo()));
            assignees = List.copyOf(people);
        }
        return new StepView(s.id(), s.key(), s.title(), s.mode(), s.status(), assignees, s.why(), s.actorId(), s.action(), s.note(), s.ref(),
            s.startedAt(), s.dueAt(), s.completedAt(), s.decisions(), shared(s));
    }

    private Resolution resolve(Step s, String requesterId) {
        if (s.agent() == null) return new Resolution(List.of(), List.of(), null);
        return resolver.resolve(json.readValue(s.agent(), AgentRule.class), requesterId);
    }

    private boolean applies(ServiceDefinition.StepDef s, Map<String, Object> ctx) {
        return s.when() == null || s.when().isNull() || rules.holds(s.when(), ctx);
    }

    private static Map<String, Object> context(Map<String, Object> data, Instant now) {
        var ctx = new HashMap<>(data);
        ctx.put("today", LocalDate.ofInstant(now, BUSINESS_ZONE).toString());
        return ctx;
    }

    private void checkLength(String field, String value, int max) {
        if (value != null && value.length() > max)
            throw ApiException.unprocessable("validation.tooLong", max)
                .withChecks(List.of(new Check("length:" + field, "block", messages.text("validation.tooLong", max), field)));
    }

    private List<Step> steps(String requestId) {
        return jdbc.sql("select * from workflow.step where request_id = :r order by seq").param("r", requestId).query(this::row).list();
    }

    private Instance lockInstance(String requestId) {
        return jdbc.sql("select * from workflow.instance where request_id = :r for update").param("r", requestId).query(this::mapInstance)
            .optional().orElseThrow(() -> ApiException.notFound("request " + requestId));
    }

    private Instance instanceRow(String requestId) {
        return jdbc.sql("select * from workflow.instance where request_id = :r").param("r", requestId).query(this::mapInstance).single();
    }

    private Instance mapInstance(ResultSet rs, int n) throws SQLException {
        Map<String, Object> data = json.readValue(rs.getString("data"), new TypeReference<>() {});
        return new Instance(rs.getString("request_id"), rs.getString("service_id"), rs.getString("requester_id"), rs.getString("status"), data);
    }

    private Step row(ResultSet rs, int n) throws SQLException {
        var mode = rs.getString("mode");
        var decisions = rs.getString("decisions");
        return new Step(rs.getLong("id"), rs.getString("request_id"), rs.getInt("seq"), rs.getString("key"),
            json.readValue(rs.getString("title"), LocalizedText.class), mode, rs.getString("status"), rs.getString("agent"), rs.getString("operation"),
            (Integer) rs.getObject("sla_hours"), rs.getString("why") == null ? null : json.readValue(rs.getString("why"), MessageRef.class),
            json.readValue(rs.getString("position_ids"), STRINGS), json.readValue(rs.getString("assigned_to"), STRINGS),
            rs.getString("actor_id"), rs.getString("action"), rs.getString("note"), rs.getString("ref"),
            instant(rs, "started_at"), instant(rs, "due_at"), instant(rs, "completed_at"),
            decisions == null ? ServiceDefinition.DEFAULT_DECISIONS.getOrDefault(mode, List.of()) : json.readValue(decisions, STRINGS));
    }

    private static Instant instant(ResultSet rs, String col) throws SQLException {
        var t = rs.getTimestamp(col);
        return t == null ? null : t.toInstant();
    }

    private static String trimToNull(String s) {
        return s == null || s.isBlank() ? null : s.strip();
    }

    private record Instance(String requestId, String serviceId, String requesterId, String status, Map<String, Object> data) {}

    private record Step(long id, String requestId, int seq, String key, LocalizedText title, String mode, String status, String agent,
                        String operation, Integer slaHours, MessageRef why, List<String> positionIds, List<String> assignedTo,
                        String actorId, String action, String note, String ref, Instant startedAt, Instant dueAt, Instant completedAt,
                        List<String> decisions) {}
}
