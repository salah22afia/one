package org.gcc.usp.platform.workflow;

import org.gcc.usp.platform.shared.LocalizedText;

/** Published inside the workflow transaction when a returned request is resubmitted and its returning step opens again. */
public record StepReopened(String requestId, String stepKey, LocalizedText title, String requesterId) {}
