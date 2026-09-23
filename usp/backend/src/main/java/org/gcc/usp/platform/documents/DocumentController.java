package org.gcc.usp.platform.documents;

import java.time.Instant;
import java.util.UUID;
import org.gcc.usp.platform.identity.CurrentUser;
import org.gcc.usp.platform.shared.ApiException;
import org.gcc.usp.platform.shared.LocalizedText;
import org.gcc.usp.platform.workflow.WorkflowEngine;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@RestController
class DocumentController {

    private final DocumentService documents;
    private final DocumentRenderer renderer;
    private final PdfRenderer pdf;
    private final CurrentUser me;
    private final WorkflowEngine workflow;

    DocumentController(DocumentService documents, DocumentRenderer renderer, PdfRenderer pdf, CurrentUser me, WorkflowEngine workflow) {
        this.documents = documents;
        this.renderer = renderer;
        this.pdf = pdf;
        this.me = me;
        this.workflow = workflow;
    }

    @GetMapping("/api/v1/documents/{id}")
    DocumentView get(@PathVariable UUID id) {
        return visible(id);
    }

    @GetMapping(value = "/api/v1/documents/{id}/html", produces = "text/html;charset=UTF-8")
    String html(@PathVariable UUID id) {
        return renderer.html(visible(id));
    }

    @GetMapping("/api/v1/documents/{id}/pdf")
    ResponseEntity<byte[]> pdf(@PathVariable UUID id) {
        var doc = visible(id);
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_PDF)
            .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.inline().filename(doc.number() + ".pdf").build().toString())
            .body(pdf.pdf(renderer.html(doc)));
    }

    /** Public (no sign-in): anyone holding the document can check it. Shows only what is printed on it, masked. */
    @GetMapping("/api/v1/verify/{code}")
    Verification verify(@PathVariable String code) {
        return documents.findByCode(code)
            .map(d -> new Verification(true, d.revoked(), d.title(), d.number(), d.issuedAt(), mask(documents.payload(d.id()))))
            .orElse(new Verification(false, false, null, null, null, null));
    }

    record Verification(boolean valid, boolean revoked, LocalizedText title, String number, Instant issuedAt, LocalizedText holder) {}

    @SuppressWarnings("unchecked")
    private static LocalizedText mask(java.util.Map<String, Object> payload) {
        var name = (java.util.Map<String, String>) ((java.util.Map<String, Object>) payload.get("holder")).get("name");
        return LocalizedText.arEn(first(name.get("ar")), first(name.get("en")));
    }

    private static String first(String full) {
        var parts = full.trim().split("\\s+");
        return parts.length == 1 ? parts[0] : parts[0] + " " + parts[parts.length - 1].charAt(0) + "…";
    }

    private DocumentView visible(UUID id) {
        var doc = documents.find(id).orElseThrow(() -> ApiException.notFound("document"));
        var who = me.personId();
        if (!doc.holderId().equals(who) && !workflow.isParticipant(doc.requestId(), who)) throw ApiException.forbidden();
        return doc;
    }
}
