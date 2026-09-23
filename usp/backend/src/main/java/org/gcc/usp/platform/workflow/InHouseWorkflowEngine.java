package org.gcc.usp.platform.workflow;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HashMap;
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
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/**
 * In-house engine (§7.6.1), a port of the prototype's route model. A human step waits on SAP positions resolved when it
 * opens (CAP-01); whoever holds one of them in SAP when they look sees the task, so a change of holder moves it.
 */
@Service
@Transactional
class InHouseWorkflowEngine implements WorkflowEngine {

    private static final List<String> HUMAN = List.of("approve", "fulfil", "receipt");
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

    InHouseWorkflowEngine(JdbcClient jdbc, JsonMapper json, ApproverResolver resolver, OrgDirectory org, RuleEvaluator rules,
                          ApplicationEventPublisher events, List<SystemStepHandler> handlers, Messages messages, Optional<Clock> clock) {
        this.jdbc = jdbc;
        this.json = json;
        this.resolver = resolver;
        this.org = org;
        this.rules = rules;
        this.events = events;
        this.handlers = handlers.stream().collect(Collectors.toMap(SystemStepHandler::operation, Function.identity()));
        this.messages = messages;
        this.clock = clock.orElse(Clock.systemUTC());
    }

    @Override
    public InstanceView start(String requestId, ServiceDefinition def, String requesterId, Map<String, Object> data) {
        var now = clock.instant();
        jdbc.sql("""
                insert into workflow.instance (request_id, service_id, service_version, requester_id, status, data, created_at)
                values (:id, :svc, :ver, :req, 'running', cast(:data as jsonb), :now)""")
            .param("id", requestId).param("svc", def.id()).param("ver", def.version()).param("req", requesterId)
            .param("data", json.writeValueAsString(data)).param("now", Timestamp.from(now)).update();
        var ctx = new HashMap<>(data);
        ctx.put("today", LocalDate.ofInstant(now, BUSINESS_ZONE).toString());
        int seq = 0;
        for (var s : def.steps()) {
            if (!HUMAN.contains(s.mode()) && !List.of("system", "notify").contains(s.mode()))
                throw new IllegalStateException("Step mode '" + s.mode() + "' is not supported yet (" + def.id() + "/" + s.key() + ")");
            boolean applies = s.when() == null || s.when().isNull() || rules.holds(s.when(), ctx);
            jdbc.sql("""
                    insert into workflow.step (request_id, seq, key, title, mode, status, agent, operation, sla_hours, why)
                    values (:r, :seq, :key, cast(:title as jsonb), :mode, :status, cast(:agent as jsonb), :op, :sla, cast(:why as jsonb))""")
                .param("r", requestId).param("seq", seq++).param("key", s.key()).param("title", json.writeValueAsString(s.title()))
                .param("mode", s.mode()).param("status", applies ? "pending" : "skipped")
                .param("agent", s.agent() == null || s.agent().isNull() ? null : s.agent().toString())
                .param("op", s.operation()).param("sla", s.slaHours())
                .param("why", applies ? null : json.writeValueAsString(MessageRef.of("workflow.notApplied")))
                .update();
        }
        advance(requestId);
        return instance(requestId).orElseThrow();
    }

    @Override
    public InstanceView decide(long stepId, String actorId, String action, String note, String ref) {
        var step = jdbc.sql("select * from workflow.step where id = :id for update").param("id", stepId).query(this::row).optional()
            .orElseThrow(() -> ApiException.notFound("step " + stepId));
        var inst = instanceRow(step.requestId());
        if (!"current".equals(step.status()) || !HUMAN.contains(step.mode())) throw ApiException.conflict("workflow.notAwaiting");
        if (!isMine(step, inst.requesterId(), actorId)) throw ApiException.forbidden();
        var allowed = switch (step.mode()) {
            case "approve" -> List.of("approve", "reject");
            case "fulfil" -> List.of("done", "reject");
            default -> List.of("receive");
        };
        if (!allowed.contains(action)) throw ApiException.unprocessable("workflow.actionNotAvailable");
        if ("done".equals(action) && blank(ref))
            throw ApiException.unprocessable("workflow.refRequired")
                .withChecks(List.of(new Check("required:ref", "block", messages.text("workflow.refRequired.field"), "ref")));
        if ("reject".equals(action) && blank(note))
            throw ApiException.unprocessable("workflow.noteRequired")
                .withChecks(List.of(new Check("required:note", "block", messages.text("workflow.noteRequired.field"), "note")));
        boolean rejected = "reject".equals(action);
        finish(step.id(), rejected ? "rejected" : "done", actorId, action, note, ref);
        events.publishEvent(new StepDecided(step.requestId(), step.key(), step.title(), step.mode(), actorId, action, note, ref));
        if (rejected) end(step.requestId(), "rejected");
        else advance(step.requestId());
        return instance(step.requestId()).orElseThrow();
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
    }

    private void finish(long stepId, String status, String actorId, String action, String note, String ref) {
        jdbc.sql("""
                update workflow.step set status = :st, actor_id = :actor, action = :action, note = :note, ref = :ref, completed_at = :now
                where id = :id""")
            .param("st", status).param("actor", actorId).param("action", action).param("note", note).param("ref", ref)
            .param("now", Timestamp.from(clock.instant())).param("id", stepId).update();
    }

    private void end(String requestId, String outcome) {
        jdbc.sql("update workflow.instance set status = :s where request_id = :r").param("s", outcome).param("r", requestId).update();
        events.publishEvent(new WorkflowFinished(requestId, outcome));
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<InstanceView> instance(String requestId) {
        return jdbc.sql("select * from workflow.instance where request_id = :r").param("r", requestId).query(this::mapInstance).optional()
            .map(inst -> new InstanceView(requestId, inst.requesterId(), inst.status(), steps(requestId).stream().map(s -> view(s, inst.requesterId())).toList()));
    }

    @Override
    @Transactional(readOnly = true)
    public List<TaskView> tasksFor(String personId) {
        var now = clock.instant();
        var me = org.me();
        return jdbc.sql("""
                select s.*, i.requester_id as inst_requester, i.service_id as inst_service from workflow.step s
                join workflow.instance i on i.request_id = s.request_id
                where s.status = 'current' and s.mode in ('approve', 'fulfil', 'receipt') order by s.started_at""")
            .query((rs, n) -> Map.entry(row(rs, n), new String[] { rs.getString("inst_requester"), rs.getString("inst_service") })).list().stream()
            .filter(e -> isMine(e.getKey(), e.getValue()[0], personId, me))
            .map(e -> {
                var s = e.getKey();
                return new TaskView(s.id(), s.requestId(), e.getValue()[1], e.getValue()[0], s.title(), s.mode(), s.startedAt(), s.dueAt(),
                    s.dueAt() != null && s.dueAt().isBefore(now));
            }).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public boolean isParticipant(String requestId, String personId) {
        var inst = jdbc.sql("select * from workflow.instance where request_id = :r").param("r", requestId).query(this::mapInstance).optional();
        if (inst.isEmpty()) return false;
        if (inst.get().requesterId().equals(personId)) return true;
        var steps = steps(requestId);
        if (steps.stream().anyMatch(s -> personId.equals(s.actorId()))) return true;
        return steps.stream().anyMatch(s -> "current".equals(s.status()) && isMine(s, inst.get().requesterId(), personId));
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
            s.startedAt(), s.dueAt(), s.completedAt());
    }

    private Resolution resolve(Step s, String requesterId) {
        if (s.agent() == null) return new Resolution(List.of(), List.of(), null);
        return resolver.resolve(json.readValue(s.agent(), AgentRule.class), requesterId);
    }

    private List<Step> steps(String requestId) {
        return jdbc.sql("select * from workflow.step where request_id = :r order by seq").param("r", requestId).query(this::row).list();
    }

    private Instance instanceRow(String requestId) {
        return jdbc.sql("select * from workflow.instance where request_id = :r").param("r", requestId).query(this::mapInstance).single();
    }

    private Instance mapInstance(ResultSet rs, int n) throws SQLException {
        Map<String, Object> data = json.readValue(rs.getString("data"), new TypeReference<>() {});
        return new Instance(rs.getString("request_id"), rs.getString("service_id"), rs.getString("requester_id"), rs.getString("status"), data);
    }

    private Step row(ResultSet rs, int n) throws SQLException {
        return new Step(rs.getLong("id"), rs.getString("request_id"), rs.getString("key"), json.readValue(rs.getString("title"), LocalizedText.class),
            rs.getString("mode"), rs.getString("status"), rs.getString("agent"), rs.getString("operation"), (Integer) rs.getObject("sla_hours"),
            rs.getString("why") == null ? null : json.readValue(rs.getString("why"), MessageRef.class),
            json.readValue(rs.getString("position_ids"), STRINGS), json.readValue(rs.getString("assigned_to"), STRINGS),
            rs.getString("actor_id"), rs.getString("action"), rs.getString("note"), rs.getString("ref"),
            instant(rs, "started_at"), instant(rs, "due_at"), instant(rs, "completed_at"));
    }

    private static Instant instant(ResultSet rs, String col) throws SQLException {
        var t = rs.getTimestamp(col);
        return t == null ? null : t.toInstant();
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }

    private record Instance(String requestId, String serviceId, String requesterId, String status, Map<String, Object> data) {}

    private record Step(long id, String requestId, String key, LocalizedText title, String mode, String status, String agent, String operation,
                        Integer slaHours, MessageRef why, List<String> positionIds, List<String> assignedTo, String actorId, String action,
                        String note, String ref, Instant startedAt, Instant dueAt, Instant completedAt) {}
}
