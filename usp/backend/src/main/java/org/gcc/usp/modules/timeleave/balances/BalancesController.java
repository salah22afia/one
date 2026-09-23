package org.gcc.usp.modules.timeleave.balances;

import java.util.List;
import java.util.Set;
import org.gcc.usp.platform.identity.CurrentUser;
import org.gcc.usp.platform.integration.SapClient;
import org.gcc.usp.platform.integration.SapJson;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Feature timeleave.balances (My balances): the employee's absence quotas (SAP-004), read live and never stored. */
@RestController
class BalancesController {

    static final Set<String> KINDS = Set.of("annual", "sick", "emergency");

    private final SapClient sap;
    private final CurrentUser me;
    private final String path;

    BalancesController(SapClient sap, CurrentUser me, @Value("${usp.sap.paths.quotas}") String path) {
        this.sap = sap;
        this.me = me;
        this.path = path;
    }

    /** In SAP's order; the annual quota leads the Me widget. */
    @GetMapping("/api/v1/timeleave/balances")
    List<LeaveBalance> balances() {
        return SapJson.items(sap.fetch(path, me.sapCredentials()), "quotas").stream()
            .map(q -> {
                var kind = SapJson.text(q, "kind").toLowerCase();
                var unit = SapJson.text(q, "unit").toLowerCase();
                return new LeaveBalance(SapJson.code(q, "type"), KINDS.contains(kind) ? kind : "other", SapJson.coded(q, "type"), SapJson.decimal(q, "entitlement"),
                    SapJson.decimal(q, "used"), SapJson.decimal(q, "remaining"), unit.equals("hours") ? "hours" : "days", SapJson.date(q, "valid_to"));
            })
            .filter(b -> b.remaining() != null)
            .toList();
    }
}
