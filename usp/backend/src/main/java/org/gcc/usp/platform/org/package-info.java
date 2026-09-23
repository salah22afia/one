/**
 * Platform module: the organisation structure, read live from SAP (SAP-010 … SAP-014 in docs/SAP_INTEGRATION.md),
 * and approver resolution (CAP-01, D-012). Nothing is stored: every lookup is a call made as the signed-in user,
 * memoised for the duration of one HTTP request.
 */
@ApplicationModule(displayName = "Platform · org")
package org.gcc.usp.platform.org;

import org.springframework.modulith.ApplicationModule;
