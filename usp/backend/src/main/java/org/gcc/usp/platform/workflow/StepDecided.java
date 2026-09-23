package org.gcc.usp.platform.workflow;

import org.gcc.usp.platform.shared.LocalizedText;

/** Published inside the workflow transaction when a step finishes. {@code actorId} is null for system steps. */
public record StepDecided(String requestId, String stepKey, LocalizedText title, String mode, String actorId, String action, String note, String ref) {}
