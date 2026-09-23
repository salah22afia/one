package org.gcc.usp.platform.requests;

import java.time.Instant;
import java.util.List;
import org.gcc.usp.platform.documents.DocumentView;
import org.gcc.usp.platform.org.OrgModel.PersonRef;
import org.gcc.usp.platform.shared.LocalizedText;

/** API shapes of the request runtime. */
public final class RequestViews {

    private RequestViews() {}

    /** {@code version}: bumped on every change; send it back with an action so a stale screen cannot act (409). */
    public record RequestView(String id, String serviceId, String module, String feature, LocalizedText serviceName, String icon, String status,
                              String channel, PersonRef requester, Instant createdAt, Instant updatedAt, int version) {}

    /** {@code type}: the field type of the service definition (attachments are shown as files). */
    public record FieldView(String key, String type, LocalizedText label, Object value, LocalizedText display) {}

    /**
     * {@code mine}: the viewer can decide this step now; {@code decisions}: what its holder may decide;
     * {@code shared}: more than one person can act on it (the first to decide closes it).
     */
    public record StepDetail(long id, String key, LocalizedText title, String mode, String status, LocalizedText why, List<PersonRef> assignees, PersonRef actor,
                             String action, String note, String ref, Instant startedAt, Instant dueAt, Instant completedAt, boolean mine,
                             List<String> decisions, boolean shared) {}

    public record AuditView(Instant at, PersonRef actor, LocalizedText what) {}

    /** {@code canWithdraw} / {@code canResubmit}: what the viewer (the requester) may do now, by the service's rules. */
    public record RequestDetail(RequestView request, List<FieldView> fields, List<StepDetail> steps, List<AuditView> audit,
                                List<DocumentView> documents, LocalizedText next, boolean canWithdraw, boolean canResubmit) {}

    public record TaskItem(long stepId, String requestId, String serviceId, LocalizedText serviceName, String icon, LocalizedText stepTitle, String mode,
                           PersonRef requester, Instant startedAt, Instant dueAt, boolean overdue, LocalizedText why, List<String> decisions,
                           boolean shared) {}

    /* ——— My requests (C-UX-84): each row says where the request is and what happens next ——— */

    /** One dot per step that applies, in order: its status (done, current, returned, rejected, pending, waiting). */
    public record StepDot(String key, LocalizedText title, String status) {}

    /**
     * The step the request waits on: {@code holder} when one person has it, otherwise {@code who} (a team, several
     * people); since when and until when; {@code note}: the reason it was returned.
     */
    public record Waiting(LocalizedText title, String status, PersonRef holder, LocalizedText who, Instant since, Instant dueAt, String note) {}

    public record RequestRow(String id, String serviceId, LocalizedText serviceName, String icon, String status, Instant createdAt, Instant updatedAt,
                             int version, List<StepDot> steps, Waiting waiting, int documents) {}

    public record Counts(int ongoing, int returned, int finished) {}

    /** {@code next}: pass it as {@code cursor} for the following page; null when this is the last one. */
    public record RequestPage(List<RequestRow> items, String next, Counts counts) {}

    /* ——— Tasks → Done ——— */

    public record DoneItem(long stepId, String requestId, String serviceId, LocalizedText serviceName, String icon, LocalizedText stepTitle,
                           PersonRef requester, String action, Instant at) {}

    public record DonePage(List<DoneItem> items, String next, int total) {}
}
