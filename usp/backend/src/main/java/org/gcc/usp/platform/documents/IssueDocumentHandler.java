package org.gcc.usp.platform.documents;

import java.util.LinkedHashMap;
import java.util.Map;
import org.gcc.usp.platform.org.OrgDirectory;
import org.gcc.usp.platform.org.OrgModel;
import org.gcc.usp.platform.shared.LocalizedText;
import org.gcc.usp.platform.shared.Messages;
import org.gcc.usp.platform.workflow.SystemStepHandler;
import org.springframework.stereotype.Component;

/**
 * System step {@code documents.issue:<template>}: snapshots the holder, the signer (the last person who acted on a
 * human step) and the request data into an immutable payload, then numbers it.
 */
@Component
class IssueDocumentHandler implements SystemStepHandler {

    private final DocumentService documents;
    private final OrgDirectory org;
    private final Messages messages;
    private final java.time.Clock clock;

    IssueDocumentHandler(DocumentService documents, OrgDirectory org, Messages messages, java.util.Optional<java.time.Clock> clock) {
        this.documents = documents;
        this.messages = messages;
        this.org = org;
        this.clock = clock.orElse(java.time.Clock.systemUTC());
    }

    @Override
    public String operation() {
        return "documents.issue";
    }

    @Override
    public Result execute(Context ctx) {
        var template = DocumentTemplates.find(ctx.argument()).orElseThrow(() -> new IllegalStateException("Unknown document template " + ctx.argument()));
        var holder = org.employee(ctx.requesterId()).orElseThrow();
        var signerStep = ctx.previousSteps().stream().filter(s -> s.actorId() != null).reduce((a, b) -> b).orElse(null);
        var payload = new LinkedHashMap<String, Object>();
        payload.put("template", template.key());
        payload.put("title", messages.text(template.titleKey())); // frozen with the issued document
        payload.put("code", template.code());
        payload.put("version", template.version());
        payload.put("requestId", ctx.requestId());
        payload.put("holder", snapshot(holder));
        if (signerStep != null) {
            var signer = org.describe(signerStep.actorId());
            payload.put("signer", Map.of("name", signer.name(), "title", signer.title(), "ref", signerStep.ref() == null ? "" : signerStep.ref(),
                "at", signerStep.completedAt().toString()));
        }
        payload.put("data", ctx.data());
        var doc = documents.issue(template, ctx.requestId(), holder.employeeNo(), signerStep == null ? null : signerStep.actorId(), clock.instant(), payload);
        return new Result(doc.number());
    }

    /**
     * Only what the document shows, read from SAP now (SAP-011/012/013). The salary line joins the snapshot when the
     * requester's profile fields are captured at submission (service designer slice).
     */
    private Map<String, Object> snapshot(OrgModel.Employee e) {
        var m = new LinkedHashMap<String, Object>();
        m.put("name", e.name());
        m.put("empNo", e.employeeNo());
        m.put("title", org.position(e.positionId()).map(OrgModel.Position::title).orElse(LocalizedText.EMPTY));
        m.put("unit", org.unit(e.unitId()).map(OrgModel.Unit::name).orElse(LocalizedText.EMPTY));
        m.put("gender", e.gender());
        m.put("hiredAt", e.hireDate());
        return m;
    }
}
