package org.gcc.usp.modules.finance.payslips;

import java.util.Comparator;
import java.util.List;
import org.gcc.usp.platform.identity.CurrentUser;
import org.gcc.usp.platform.integration.SapClient;
import org.gcc.usp.platform.integration.SapJson;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Feature finance.payslips (My pay): the employee's latest payroll results (SAP-005), read live as the signed-in user
 * and never stored or cached (responses carry Cache-Control: no-store).
 */
@RestController
class PayslipsController {

    private final SapClient sap;
    private final CurrentUser me;
    private final String path;
    private final int months;

    PayslipsController(SapClient sap, CurrentUser me, @Value("${usp.sap.paths.payslips}") String path, @Value("${usp.payslips.months:12}") int months) {
        this.sap = sap;
        this.me = me;
        this.path = path;
        this.months = Math.max(1, Math.min(months, 36));
    }

    /** Newest first. */
    @GetMapping("/api/v1/finance/payslips")
    List<Payslip> payslips() {
        return SapJson.items(sap.fetch(path + "?months=" + months, me.sapCredentials()), "payslips").stream()
            .map(p -> new Payslip(SapJson.text(p, "id"), SapJson.text(p, "period"), SapJson.date(p, "pay_date"), SapJson.decimal(p, "gross"),
                SapJson.decimal(p, "deductions"), SapJson.decimal(p, "net"), SapJson.textOrNull(p, "currency")))
            .filter(p -> !p.period().isEmpty() && p.net() != null)
            .sorted(Comparator.comparing(Payslip::period).reversed())
            .limit(months)
            .toList();
    }
}
