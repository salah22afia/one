package org.gcc.usp.modules.mydata.profile;

import java.util.List;
import java.util.function.Supplier;
import org.gcc.usp.platform.identity.CurrentUser;
import org.gcc.usp.platform.integration.SapClient;
import org.gcc.usp.platform.integration.SapJson;
import org.gcc.usp.platform.org.AgentRule;
import org.gcc.usp.platform.org.ApproverResolver;
import org.gcc.usp.platform.org.OrgDirectory;
import org.gcc.usp.platform.org.OrgModel.Employee;
import org.gcc.usp.platform.org.OrgModel.PersonRef;
import org.gcc.usp.platform.org.OrgModel.Position;
import org.gcc.usp.platform.org.OrgModel.Unit;
import org.gcc.usp.platform.shared.LocalizedText;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Feature mydata.profile (ME-01, My data): SAP-001 as the signed-in user, with the position, unit and line manager
 * from the org structure (SAP-011 … 013). Nothing is persisted; contact and bank details are masked here.
 */
@RestController
@RequestMapping("/api/v1/mydata/profile")
class ProfileController {

    private static final Logger log = LoggerFactory.getLogger(ProfileController.class);
    private static final AgentRule LINE_MANAGER = new AgentRule("lineManager", null, null, null, null, null);

    private final SapClient sap;
    private final CurrentUser me;
    private final OrgDirectory org;
    private final ApproverResolver approvers;
    private final String profilePath;

    ProfileController(SapClient sap, CurrentUser me, OrgDirectory org, ApproverResolver approvers, @Value("${usp.sap.profile-path}") String profilePath) {
        this.sap = sap;
        this.me = me;
        this.org = org;
        this.approvers = approvers;
        this.profilePath = profilePath;
    }

    @GetMapping
    EmployeeProfile profile() {
        var p = sap.fetch(profilePath, me.sapCredentials());
        var employeeNo = SapJson.text(p, "employee_no");
        // Position and unit: the profile's own when SAP sends them (SAP-001 extension), else the org structure.
        var assignment = org.employee(employeeNo);
        var positionId = firstNonBlank(SapJson.text(p.path("position"), "id"), assignment.map(Employee::positionId).orElse(null));
        var title = or(SapJson.texts(p.path("position"), "title"), () -> org.position(positionId).map(Position::title).orElse(LocalizedText.EMPTY));
        var unitId = firstNonBlank(SapJson.text(p.path("org_unit"), "id"), assignment.map(Employee::unitId).orElse(null));
        var unit = or(SapJson.texts(p.path("org_unit"), "name"), () -> org.unit(unitId).map(Unit::name).orElse(LocalizedText.EMPTY));
        var bank = p.path("bank");
        var iban = Masks.iban(SapJson.text(bank, "iban"));
        return new EmployeeProfile(employeeNo, LocalizedText.arEn(SapJson.text(p, "arabic_name"), SapJson.text(p, "english_name")),
            SapJson.date(p, "date_of_birth"), positionId, title, unit, manager(employeeNo),
            SapJson.coded(p, "employee_group"), SapJson.coded(p, "employee_subgroup"), SapJson.coded(p, "work_location"), SapJson.date(p, "hire_date"),
            Masks.mobile(SapJson.text(p, "mobile")), SapJson.textOrNull(p, "work_email"),
            iban == null ? null : new EmployeeProfile.BankAccount(iban, SapJson.texts(bank, "bank_name")));
    }

    /** The line manager as approvals resolve it (chief of the unit; the parent's chief for a chief). Absent → null. */
    private PersonRef manager(String employeeNo) {
        try {
            var r = approvers.resolve(LINE_MANAGER, employeeNo);
            List<String> people = r.personIds();
            return people.isEmpty() ? null : org.describe(people.getFirst());
        } catch (RuntimeException e) {
            // The page still shows everything else; the reason is in the log (paths only, never bodies).
            log.info("No line manager for My data: {}", e.getMessage());
            return null;
        }
    }

    private static String firstNonBlank(String a, String b) {
        return a != null && !a.isBlank() ? a : b;
    }

    private static LocalizedText or(LocalizedText t, Supplier<LocalizedText> fallback) {
        return t.isEmpty() ? fallback.get() : t;
    }
}
