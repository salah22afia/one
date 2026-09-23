package org.gcc.usp.modules.mydata.profile;

import java.time.LocalDate;
import org.gcc.usp.platform.org.OrgModel.PersonRef;
import org.gcc.usp.platform.shared.LocalizedText;

/**
 * The employee's own data (My data, the digital card), read live from SAP on every request and never stored by the
 * portal. {@code mobile} and {@code bank.iban} are masked by the portal: the full values never reach the browser.
 * Fields SAP does not (yet) return are null.
 */
record EmployeeProfile(String employeeNo, LocalizedText name, LocalDate dateOfBirth, String positionId, LocalizedText title, LocalizedText unit,
                       PersonRef manager, LocalizedText group, LocalizedText subgroup, LocalizedText location, LocalDate hireDate, String mobile,
                       String email, BankAccount bank) {

    record BankAccount(String iban, LocalizedText bank) {}
}
