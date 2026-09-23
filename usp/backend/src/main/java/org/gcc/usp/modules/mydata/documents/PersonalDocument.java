package org.gcc.usp.modules.mydata.documents;

import java.time.LocalDate;
import org.gcc.usp.platform.shared.LocalizedText;

/**
 * A personal document on the employee's file (passport, ID, card, licence, contract, insurance), as SAP-002 returns it.
 * {@code kind} picks the wallet card's icon and colour; the full number is the holder's own data.
 */
record PersonalDocument(String id, String kind, LocalizedText title, String number, LocalDate issuedOn, LocalDate expiresOn) {}
