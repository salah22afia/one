package org.gcc.usp.modules.mydata.family;

import java.time.LocalDate;
import org.gcc.usp.platform.shared.LocalizedText;

/** A family member on the employee's file (SAP-003); {@code documentExpiresOn}: their residence / ID document, if any. */
record FamilyMember(String id, LocalizedText name, LocalizedText relation, LocalDate birthDate, LocalDate documentExpiresOn) {}
