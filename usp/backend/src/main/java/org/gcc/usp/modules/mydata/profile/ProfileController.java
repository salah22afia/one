package org.gcc.usp.modules.mydata.profile;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import org.gcc.usp.platform.identity.CurrentUser;
import org.gcc.usp.platform.integration.SapClient;
import org.gcc.usp.platform.integration.SapException;
import org.gcc.usp.platform.shared.LocalizedText;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;

/** Feature mydata.profile (ME-01): proxies SAP's /sap/tamkeen/profile/me as the signed-in user; nothing is persisted. */
@RestController
@RequestMapping("/api/v1/mydata/profile")
class ProfileController {

    private static final DateTimeFormatter SAP_DATE = DateTimeFormatter.ofPattern("dd-MM-yyyy");

    private final SapClient sap;
    private final CurrentUser me;
    private final String profilePath;

    ProfileController(SapClient sap, CurrentUser me, @Value("${usp.sap.profile-path}") String profilePath) {
        this.sap = sap;
        this.me = me;
        this.profilePath = profilePath;
    }

    @GetMapping
    EmployeeProfile profile() {
        try {
            return map(sap.get(profilePath, me.sapCredentials()).body());
        } catch (SapException e) {
            throw e.toApi();
        }
    }

    static EmployeeProfile map(JsonNode p) {
        return new EmployeeProfile(text(p, "employee_no"), LocalizedText.arEn(text(p, "arabic_name"), text(p, "english_name")), date(text(p, "date_of_birth")));
    }

    /** SAP sends dd-MM-yyyy (e.g. 23-09-2000); ISO is accepted too. Unparseable → null rather than failing the page. */
    private static LocalDate date(String s) {
        if (s.isBlank()) return null;
        try {
            return s.charAt(2) == '-' ? LocalDate.parse(s, SAP_DATE) : LocalDate.parse(s);
        } catch (DateTimeParseException | IndexOutOfBoundsException e) {
            return null;
        }
    }

    private static String text(JsonNode n, String field) {
        var v = n.path(field);
        return v.isMissingNode() || v.isNull() ? "" : v.asString().trim();
    }
}
