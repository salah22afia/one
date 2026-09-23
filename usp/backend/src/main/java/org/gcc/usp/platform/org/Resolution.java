package org.gcc.usp.platform.org;

import java.util.List;
import org.gcc.usp.platform.shared.MessageRef;

/** Resolved actors of a step right now: people, the positions they act for, and a readable reason. */
public record Resolution(List<String> personIds, List<String> positionIds, MessageRef why) {}
