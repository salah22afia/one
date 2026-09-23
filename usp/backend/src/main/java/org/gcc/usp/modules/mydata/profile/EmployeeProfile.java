package org.gcc.usp.modules.mydata.profile;

import java.time.LocalDate;
import org.gcc.usp.platform.shared.LocalizedText;

/** The employee's own data, read live from SAP on every request and never stored by the portal. */
record EmployeeProfile(String employeeNo, LocalizedText name, LocalDate dateOfBirth) {}
