package org.gcc.usp.modules.finance.payslips;

import java.math.BigDecimal;
import java.time.LocalDate;

/** One payroll result of the employee (SAP-005): {@code period} is yyyy-MM; amounts in {@code currency}. */
record Payslip(String id, String period, LocalDate payDate, BigDecimal gross, BigDecimal deductions, BigDecimal net, String currency) {}
