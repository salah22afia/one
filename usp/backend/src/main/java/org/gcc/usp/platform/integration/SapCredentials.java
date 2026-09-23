package org.gcc.usp.platform.integration;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

/**
 * How the portal calls SAP as a given user: the user's own Basic credential, or the SAP logon ticket (MYSAPSSO2) SAP
 * issued for it. Held only in the backend's memory session; never persisted, never logged ({@link #toString()} is masked).
 */
public final class SapCredentials {

    private final String authorization;
    private final String ticket;

    private SapCredentials(String authorization, String ticket) {
        this.authorization = authorization;
        this.ticket = ticket;
    }

    public static SapCredentials basic(String user, String password) {
        return new SapCredentials("Basic " + Base64.getEncoder().encodeToString((user + ":" + password).getBytes(StandardCharsets.UTF_8)), null);
    }

    public static SapCredentials ticket(String mysapsso2) {
        return new SapCredentials(null, mysapsso2);
    }

    public boolean isTicket() {
        return ticket != null;
    }

    String authorization() {
        return authorization;
    }

    String ticket() {
        return ticket;
    }

    @Override
    public String toString() {
        return isTicket() ? "SapCredentials[ticket]" : "SapCredentials[basic]";
    }
}
