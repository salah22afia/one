package org.gcc.usp.modules.timeleave.balances;

import java.math.BigDecimal;
import java.time.LocalDate;
import org.gcc.usp.platform.shared.LocalizedText;

/**
 * One absence quota of the employee (SAP-004): {@code kind} (annual, sick, emergency, other) decides the ring's colour;
 * {@code entitlement} is the ring's full circle and {@code remaining} what is left. Units: days unless SAP says hours.
 */
record LeaveBalance(String type, String kind, LocalizedText name, BigDecimal entitlement, BigDecimal used, BigDecimal remaining, String unit,
                    LocalDate validTo) {}
