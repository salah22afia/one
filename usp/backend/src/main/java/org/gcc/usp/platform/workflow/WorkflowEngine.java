package org.gcc.usp.platform.workflow;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.gcc.usp.platform.forms.ServiceDefinition;
import org.gcc.usp.platform.shared.LocalizedText;
import org.gcc.usp.platform.shared.MessageRef;

/**
 * The only workflow API feature modules use (§7.6.1). Implemented in-house (ported from the prototype engine);
 * a BPMN engine could replace the implementation later without touching callers.
 * Not yet: return/resubmit, withdraw, wait-for-event, simulation, SLA escalation jobs.
 */
public interface WorkflowEngine {

    /** Builds the steps from the service's workflow (conditions, assignee resolution) and runs until a human step. */
    InstanceView start(String requestId, ServiceDefinition def, String requesterId, Map<String, Object> data);

    /** approve | reject (approve steps), done | reject (fulfil steps), receive (receipt steps). */
    InstanceView decide(long stepId, String actorId, String action, String note, String ref);

    Optional<InstanceView> instance(String requestId);

    List<TaskView> tasksFor(String personId);

    /** Requester, anyone who acted on a step, or a current assignee. */
    boolean isParticipant(String requestId, String personId);

    record InstanceView(String requestId, String requesterId, String status, List<StepView> steps) {}

    /** {@code assigneeIds}: live holders for the current step (A2); {@code actorId}: who decided a finished step. */
    record StepView(long id, String key, LocalizedText title, String mode, String status, List<String> assigneeIds, MessageRef why,
                    String actorId, String action, String note, String ref, Instant startedAt, Instant dueAt, Instant completedAt) {}

    record TaskView(long stepId, String requestId, String serviceId, String requesterId, LocalizedText title, String mode,
                    Instant startedAt, Instant dueAt, boolean overdue) {}
}
