package org.gcc.usp.platform.workflow;

import java.util.List;
import java.util.Map;

/**
 * Extension point for system steps (EP-04). A step with {@code "operation": "documents.issue:employment-letter"} runs the
 * handler whose {@link #operation()} is {@code documents.issue}, with argument {@code employment-letter}.
 * Runs inside the workflow transaction; external calls must go through the outbox (not built yet).
 */
public interface SystemStepHandler {

    String operation();

    Result execute(Context ctx);

    record Context(String requestId, String serviceId, String requesterId, String argument, Map<String, Object> data,
                   List<WorkflowEngine.StepView> previousSteps) {}

    record Result(String ref) {}
}
