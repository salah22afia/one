package org.gcc.usp.modules.mydata.family;

import java.util.List;
import org.gcc.usp.platform.identity.CurrentUser;
import org.gcc.usp.platform.integration.SapClient;
import org.gcc.usp.platform.integration.SapJson;
import org.gcc.usp.platform.shared.LocalizedText;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Feature mydata.family: the employee's family members and dependants (SAP-003), read live and never stored. */
@RestController
class FamilyController {

    private final SapClient sap;
    private final CurrentUser me;
    private final String path;

    FamilyController(SapClient sap, CurrentUser me, @Value("${usp.sap.paths.family}") String path) {
        this.sap = sap;
        this.me = me;
        this.path = path;
    }

    @GetMapping("/api/v1/mydata/family")
    List<FamilyMember> family() {
        return SapJson.items(sap.fetch(path, me.sapCredentials()), "members").stream()
            .map(m -> new FamilyMember(SapJson.text(m, "id"), LocalizedText.arEn(SapJson.text(m, "arabic_name"), SapJson.text(m, "english_name")),
                SapJson.coded(m, "relation"), SapJson.date(m, "date_of_birth"), SapJson.date(m.path("document"), "expiry_date")))
            .toList();
    }
}
