package org.gcc.usp.platform.workflow;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.gcc.usp.platform.forms.ServiceDefinition;
import org.gcc.usp.platform.shared.LocalizedText;
import org.gcc.usp.platform.shared.MessageRef;

/**
 * The only workflow API feature modules use (§7.6.1). Implemented in-house (ported from the prototype engine);
 * a BPMN engine could replace the implementation later without touching callers.
 * Every change runs under a row lock on the instance, so decisions, returns, resubmissions and withdrawals of one
 * request are applied one at a time and a second, concurrent one sees the new state (409).
 * Not yet: wait-for-event, simulation, SLA escalation jobs.
 */
public interface WorkflowEngine {

    /** Builds the steps from the service's workflow (conditions, assignee resolution) and runs until a human step. */
    InstanceView start(String requestId, ServiceDefinition def, String requesterId, Map<String, Object> data);

    /**
     * A decision on the step the actor holds: approve | return | reject (approve steps), done (fulfil steps),
     * receive (receipt steps), limited to the step's configured decisions. Return and reject need a note; a return
     * sends the request back to the requester and waits on the same step.
     */
    InstanceView decide(long stepId, String actorId, String action, String note, String ref);

    /**
     * The requester completed a returned request: the new data replaces the old, the returning step opens again (its
     * holders re-resolved) and the conditions of later steps are evaluated on the new data. {@code def}: the version the
     * request was submitted with.
     */
    InstanceView resubmit(String requestId, ServiceDefinition def, String requesterId, Map<String, Object> data);

    /** Ends a running instance at the requester's wish; open and later steps are skipped. The caller checks the rule. */
    InstanceView withdraw(String requestId, String requesterId);

    Optional<InstanceView> instance(String requestId);

    /** Steps of many instances in one query, for lists: no SAP calls (holders are resolved by the caller if needed). */
    Map<String, Progress> progress(Collection<String> requestIds);

    Optional<String> requestOf(long stepId);

    List<TaskView> tasksFor(String personId);

    /** Decisions the person took, newest first; {@code before} continues a previous page (null = first page). */
    List<DecisionView> decisionsBy(String personId, Cursor before, int limit);

    /** How many decisions {@link #decisionsBy} lists in all. */
    int decisionCount(String personId);

    /** Requester, anyone who decided on a step, or a current assignee. */
    boolean isParticipant(String requestId, String personId);

    /** Someone other than the requester has decided on the request (the prototype's withdrawal limit). */
    boolean decidedByOthers(String requestId);

    record InstanceView(String requestId, String requesterId, String status, List<StepView> steps) {}

    /**
     * {@code assigneeIds}: live holders for the current step (A2); {@code actorId}: who decided a finished step;
     * {@code decisions}: what the holder of this step may decide; {@code shared}: more than one position or person can act.
     */
    record StepView(long id, String key, LocalizedText title, String mode, String status, List<String> assigneeIds, MessageRef why,
                    String actorId, String action, String note, String ref, Instant startedAt, Instant dueAt, Instant completedAt,
                    List<String> decisions, boolean shared) {}

    record TaskView(long stepId, String requestId, String serviceId, String requesterId, LocalizedText title, String mode,
                    Instant startedAt, Instant dueAt, boolean overdue, MessageRef why, List<String> decisions, boolean shared) {}

    /** An instance's steps as stored (no SAP lookups). */
    record Progress(String requestId, String status, List<StepBrief> steps) {

        /** The step the request waits on: the current one, or the one that returned it. */
        public Optional<StepBrief> waitingOn() {
            return steps.stream().filter(s -> "current".equals(s.status()) || "returned".equals(s.status())).findFirst();
        }
    }

    record StepBrief(String key, LocalizedText title, String mode, String status, List<String> positionIds, List<String> assignedTo,
                     MessageRef why, String note, Instant startedAt, Instant dueAt) {}

    record DecisionView(long id, long stepId, String requestId, String serviceId, String requesterId, LocalizedText stepTitle,
                        String action, Instant at) {}

    /** Position in a newest-first list: (time, id) of the last row seen. */
    record Cursor(Instant at, long id) {}
}
