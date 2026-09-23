package org.gcc.usp.platform.requests;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.gcc.usp.platform.documents.DocumentService;
import org.gcc.usp.platform.identity.PlatformUsers;
import org.gcc.usp.platform.forms.FormValidator;
import org.gcc.usp.platform.forms.ServiceDefinition;
import org.gcc.usp.platform.forms.ServiceDefinitions;
import org.gcc.usp.platform.org.OrgDirectory;
import org.gcc.usp.platform.org.OrgModel.PersonRef;
import org.gcc.usp.platform.requests.RequestViews.AuditView;
import org.gcc.usp.platform.requests.RequestViews.FieldView;
import org.gcc.usp.platform.requests.RequestViews.RequestDetail;
import org.gcc.usp.platform.requests.RequestViews.RequestView;
import org.gcc.usp.platform.requests.RequestViews.StepDetail;
import org.gcc.usp.platform.requests.RequestViews.TaskItem;
import org.gcc.usp.platform.rules.Check;
import org.gcc.usp.platform.shared.ApiException;
import org.gcc.usp.platform.shared.Sequences;
import org.gcc.usp.platform.shared.LocalizedText;
import org.gcc.usp.platform.shared.MessageRef;
import org.gcc.usp.platform.shared.Messages;
import org.gcc.usp.platform.workflow.WorkflowEngine;
import org.gcc.usp.platform.workflow.StepDecided;
import org.gcc.usp.platform.workflow.WorkflowFinished;
import org.springframework.context.event.EventListener;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/** Request runtime for every service (P-05): submit, my requests, detail and timeline, inbox, decisions. */
@Service
@Transactional
public class RequestService {

    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Riyadh");

    private final JdbcClient jdbc;
    private final JsonMapper json;
    private final ServiceDefinitions definitions;
    private final FormValidator validator;
    private final WorkflowEngine workflow;
    private final DocumentService documents;
    private final OrgDirectory org;
    private final Sequences sequences;
    private final Messages messages;
    private final Clock clock;

    RequestService(JdbcClient jdbc, JsonMapper json, ServiceDefinitions definitions, FormValidator validator, WorkflowEngine workflow,
                   DocumentService documents, OrgDirectory org, Sequences sequences, Messages messages, Optional<Clock> clock) {
        this.jdbc = jdbc;
        this.json = json;
        this.definitions = definitions;
        this.validator = validator;
        this.workflow = workflow;
        this.documents = documents;
        this.org = org;
        this.sequences = sequences;
        this.messages = messages;
        this.clock = clock.orElse(Clock.systemUTC());
    }

    public RequestDetail submit(String serviceId, Map<String, Object> input, String channel, String requesterId) {
        // Services are for employees: routing, approvers and documents all come from SAP.
        if (PlatformUsers.isPlatformId(requesterId)) throw new ApiException(HttpStatus.FORBIDDEN, "auth.noSapAccount");
        var def = definitions.find(serviceId).orElseThrow(() -> ApiException.notFound("service " + serviceId));
        // Trust boundary: keep only the fields the service defines.
        var data = new LinkedHashMap<String, Object>();
        for (var f : def.fields()) if (input != null && input.containsKey(f.key())) data.put(f.key(), input.get(f.key()));
        var now = clock.instant();
        List<Check> checks = validator.validate(def, data, LocalDate.ofInstant(now, BUSINESS_ZONE));
        if (checks.stream().anyMatch(Check::blocks))
            throw ApiException.unprocessable("validation.review").withChecks(checks);

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

    @Transactional(readOnly = true)
    public List<RequestView> mine(String personId) {
        return jdbc.sql("select * from requests.request where requester_id = :p order by created_at desc").param("p", personId).query(this::view).list();
    }

    @Transactional(readOnly = true)
    public RequestDetail detail(String id, String viewerId) {
        var request = jdbc.sql("select * from requests.request where id = :id").param("id", id).query(this::view).optional()
            .orElseThrow(() -> ApiException.notFound("request " + id));
        if (!request.requester().id().equals(viewerId) && !workflow.isParticipant(id, viewerId)) throw ApiException.forbidden();
        var def = definitions.find(request.serviceId()).orElseThrow();
        Map<String, Object> data = json.readValue(
            jdbc.sql("select data from requests.request where id = :id").param("id", id).query(String.class).single(), new TypeReference<>() {});
        var fields = def.fields().stream().filter(f -> data.containsKey(f.key()))
            .map(f -> new FieldView(f.key(), f.label(), data.get(f.key()), display(f, data.get(f.key())))).toList();
        var steps = workflow.instance(id).map(i -> i.steps().stream().map(s -> new StepDetail(s.id(), s.key(), s.title(), s.mode(), s.status(), s.why() == null ? null : messages.text(s.why()),
            s.assigneeIds().stream().map(this::ref).toList(), s.actorId() == null ? null : ref(s.actorId()), s.action(), s.note(), s.ref(),
            s.startedAt(), s.dueAt(), s.completedAt(), "current".equals(s.status()) && s.assigneeIds().contains(viewerId))).toList()).orElse(List.of());
        var audit = jdbc.sql("select at, actor_id, what from requests.audit where request_id = :id order by at, id").param("id", id)
            .query((rs, n) -> new AuditView(rs.getTimestamp("at").toInstant(), rs.getString("actor_id") == null ? null : ref(rs.getString("actor_id")),
                messages.text(json.readValue(rs.getString("what"), MessageRef.class)))).list();
        return new RequestDetail(request, fields, steps, audit, documents.forRequest(id), def.next());
    }

    @Transactional(readOnly = true)
    public List<TaskItem> tasks(String personId) {
        return workflow.tasksFor(personId).stream().map(t -> new TaskItem(t.stepId(), t.requestId(), t.serviceId(),
            definitions.find(t.serviceId()).map(ServiceDefinition::name).orElse(LocalizedText.of("und", t.serviceId())), t.title(), t.mode(),
            ref(t.requesterId()), t.startedAt(), t.dueAt(), t.overdue())).toList();
    }

    public RequestDetail decide(long stepId, String actorId, String action, String note, String ref) {
        var instance = workflow.decide(stepId, actorId, action, note, ref);
        return detail(instance.requestId(), actorId);
    }

    @EventListener
    void on(StepDecided e) {
        var ref = e.ref() == null || e.ref().isBlank() ? "" : " — " + e.ref();
        var what = switch (e.action()) {
            case "approve" -> MessageRef.of("audit.approved", e.title());
            case "reject" -> MessageRef.of("audit.rejected", e.title());
            case "receive" -> MessageRef.of("audit.received", e.title());
            default -> MessageRef.of(e.actorId() == null ? "audit.systemDone" : "audit.done", e.title(), ref);
        };
        audit(e.requestId(), e.actorId(), what);
        touch(e.requestId(), null);
    }

    @EventListener
    void on(WorkflowFinished e) {
        touch(e.requestId(), e.outcome());
        audit(e.requestId(), null, MessageRef.of("completed".equals(e.outcome()) ? "audit.completed" : "audit.requestRejected"));
    }

    private void touch(String id, String status) {
        jdbc.sql("update requests.request set updated_at = :now, status = coalesce(:st, status) where id = :id")
            .param("now", Timestamp.from(clock.instant())).param("st", status).param("id", id).update();
    }

    /** Stored as a message reference, rendered in every language on read. */
    private void audit(String requestId, String actorId, MessageRef what) {
        jdbc.sql("insert into requests.audit (request_id, at, actor_id, what) values (:r, :at, :a, cast(:w as jsonb))")
            .param("r", requestId).param("at", Timestamp.from(clock.instant())).param("a", actorId).param("w", json.writeValueAsString(what)).update();
    }

    private PersonRef ref(String personId) {
        return org.describe(personId);
    }

    private LocalizedText display(ServiceDefinition.FieldDef f, Object v) {
        if (v instanceof Boolean b) return messages.text(b ? "common.yes" : "common.no");
        if (f.options() != null)
            for (var o : f.options()) if (o.value().equals(String.valueOf(v))) return o.label();
        return LocalizedText.of("und", String.valueOf(v)); // a user-entered value: not language-specific
    }

    private RequestView view(ResultSet rs, int n) throws SQLException {
        var svc = rs.getString("service_id");
        return new RequestView(rs.getString("id"), svc, rs.getString("module"), rs.getString("feature"),
            definitions.find(svc).map(ServiceDefinition::name).orElse(LocalizedText.of("und", svc)), rs.getString("status"), rs.getString("channel"),
            ref(rs.getString("requester_id")), rs.getTimestamp("created_at").toInstant(), rs.getTimestamp("updated_at").toInstant());
    }
}
