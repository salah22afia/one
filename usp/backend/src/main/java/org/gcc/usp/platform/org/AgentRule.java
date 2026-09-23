package org.gcc.usp.platform.org;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;

/** Who acts on a step (CAP-01): lineManager, pool(unitId), positions(positionIds, quorum), requester. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record AgentRule(String kind, String level, String upTo, List<String> positionIds, String quorum, String unitId) {}
