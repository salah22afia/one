package org.gcc.usp.modules.mydata.documents;

import java.util.Comparator;
import java.util.List;
import java.util.Set;
import org.gcc.usp.platform.identity.CurrentUser;
import org.gcc.usp.platform.integration.SapClient;
import org.gcc.usp.platform.integration.SapJson;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Feature mydata.documents: the documents wallet (SAP-002), read live as the signed-in user, never stored. */
@RestController
class DocumentsController {

    /** Kinds the wallet draws; SAP document types map onto these (anything else is shown as a card). */
    static final Set<String> KINDS = Set.of("passport", "id", "card", "licence", "contract", "insurance");

    private final SapClient sap;
    private final CurrentUser me;
    private final String path;

    DocumentsController(SapClient sap, CurrentUser me, @Value("${usp.sap.paths.documents}") String path) {
        this.sap = sap;
        this.me = me;
        this.path = path;
    }

    /** Soonest expiry first (what needs renewing leads), as the prototype's wallet. */
    @GetMapping("/api/v1/mydata/documents")
    List<PersonalDocument> documents() {
        return SapJson.items(sap.fetch(path, me.sapCredentials()), "documents").stream()
            .map(d -> {
                var kind = SapJson.text(d, "kind").toLowerCase();
                return new PersonalDocument(SapJson.text(d, "id"), KINDS.contains(kind) ? kind : "card", SapJson.coded(d, "type"), SapJson.text(d, "number"),
                    SapJson.date(d, "issue_date"), SapJson.date(d, "expiry_date"));
            })
            .sorted(Comparator.comparing(PersonalDocument::expiresOn, Comparator.nullsLast(Comparator.naturalOrder())))
            .toList();
    }
}
