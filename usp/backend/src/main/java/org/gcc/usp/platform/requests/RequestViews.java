package org.gcc.usp.platform.requests;

import java.time.Instant;
import java.util.List;
import org.gcc.usp.platform.documents.DocumentView;
import org.gcc.usp.platform.org.OrgModel.PersonRef;
import org.gcc.usp.platform.shared.LocalizedText;

/** API shapes of the request runtime. */
public final class RequestViews {

    private RequestViews() {}

    public record RequestView(String id, String serviceId, String module, String feature, LocalizedText serviceName, String status, String channel,
                              PersonRef requester, Instant createdAt, Instant updatedAt) {}

    public record FieldView(String key, LocalizedText label, Object value, LocalizedText display) {}

    /** {@code mine}: the viewer can decide this step now. */
    public record StepDetail(long id, String key, LocalizedText title, String mode, String status, LocalizedText why, List<PersonRef> assignees, PersonRef actor,
                             String action, String note, String ref, Instant startedAt, Instant dueAt, Instant completedAt, boolean mine) {}

    public record AuditView(Instant at, PersonRef actor, LocalizedText what) {}

    public record RequestDetail(RequestView request, List<FieldView> fields, List<StepDetail> steps, List<AuditView> audit,
                                List<DocumentView> documents, LocalizedText next) {}

    public record TaskItem(long stepId, String requestId, String serviceId, LocalizedText serviceName, LocalizedText stepTitle, String mode, PersonRef requester,
                           Instant startedAt, Instant dueAt, boolean overdue) {}
}
