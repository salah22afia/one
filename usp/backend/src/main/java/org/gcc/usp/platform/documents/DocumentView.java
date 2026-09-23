package org.gcc.usp.platform.documents;

import java.time.Instant;
import java.util.UUID;
import org.gcc.usp.platform.shared.LocalizedText;

public record DocumentView(UUID id, String requestId, String template, LocalizedText title, String number, String verifyCode,
                           String holderId, Instant issuedAt, boolean revoked) {}
