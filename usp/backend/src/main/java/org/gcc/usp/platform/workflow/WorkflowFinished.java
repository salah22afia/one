package org.gcc.usp.platform.workflow;

/** Published inside the workflow transaction when an instance ends. {@code outcome}: completed | rejected | withdrawn. */
public record WorkflowFinished(String requestId, String outcome) {}
