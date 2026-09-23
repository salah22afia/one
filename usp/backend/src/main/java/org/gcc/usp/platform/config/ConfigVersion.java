package org.gcc.usp.platform.config;

import com.fasterxml.jackson.annotation.JsonValue;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import tools.jackson.databind.JsonNode;

/** One version of a configuration kind: its full content plus the change log against the version it was built on. */
public record ConfigVersion(UUID id, String kind, String number, LocalDate from, boolean scheduled, boolean cancelled,
                            String createdBy, Instant createdAt, String reason, String reference, JsonNode content,
                            List<Change> changes, UUID baseId, UUID correctsId, String scope, Approval approval,
                            Revoked revoked, RebasedFrom rebasedFrom) {

    /** {@code object} is what the path belongs to: a list item ({@code types.ANNUAL}) or a top-level block ({@code calendar}). */
    public record Change(String path, String object, String before, String after, Instant at, String by, String why) {}

    /** Second approval (D-010): requested at scheduling when governance asks for it; the version is not in force before it. */
    public record Approval(String positionId, String status, Instant requestedAt, String by, Instant at, String note) {

        boolean pending() {
            return "pending".equals(status);
        }
    }

    public record Revoked(String by, Instant at, String reason) {}

    public record RebasedFrom(UUID id, String number, Instant at) {}

    public enum Status {
        DRAFT, AWAITING, SCHEDULED, ACTIVE, EXPIRED, CANCELLED, CORRECTED, REVERTED;

        @JsonValue
        String json() {
            return name().toLowerCase();
        }
    }

    /** Scheduled, not cancelled, and approved when a second approval was asked for. */
    public boolean inForce() {
        return scheduled && !cancelled && (approval == null || "approved".equals(approval.status()));
    }
}
