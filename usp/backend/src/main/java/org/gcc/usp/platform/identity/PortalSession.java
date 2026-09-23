package org.gcc.usp.platform.identity;

import java.time.Instant;
import java.util.UUID;
import org.gcc.usp.platform.integration.SapCredentials;
import org.gcc.usp.platform.shared.LocalizedText;

/**
 * A signed-in user, in the backend's memory only. An employee signs in with SAP (SU01) and is identified by the
 * employee number; a platform account (no SAP user) by {@code u:<username>} and never calls SAP.
 */
public final class PortalSession {

    public enum Kind { SAP, PLATFORM }

    private final String token;
    private final Kind kind;
    private final String username;
    private final String personId;
    private final String employeeNo;
    private final UUID platformUserId;
    private final LocalizedText name;
    private final SapCredentials credentials;
    private final boolean admin;
    private final Instant createdAt;
    private volatile boolean mustChangePassword;
    private volatile Instant lastSeen;

    private PortalSession(String token, Kind kind, String username, String personId, String employeeNo, UUID platformUserId,
                          LocalizedText name, SapCredentials credentials, boolean admin, boolean mustChangePassword, Instant now) {
        this.token = token;
        this.kind = kind;
        this.username = username;
        this.personId = personId;
        this.employeeNo = employeeNo;
        this.platformUserId = platformUserId;
        this.name = name;
        this.credentials = credentials;
        this.admin = admin;
        this.mustChangePassword = mustChangePassword;
        this.createdAt = now;
        this.lastSeen = now;
    }

    static PortalSession sap(String token, String username, String employeeNo, LocalizedText name, SapCredentials credentials, boolean admin, Instant now) {
        return new PortalSession(token, Kind.SAP, username, employeeNo, employeeNo, null, name, credentials, admin, false, now);
    }

    static PortalSession platform(String token, PlatformUsers.Account a, Instant now) {
        return new PortalSession(token, Kind.PLATFORM, a.username(), PlatformUsers.personId(a.username()), null, a.id(), a.name(), null,
            a.admin(), a.mustChangePassword(), now);
    }

    String token() { return token; }

    public Kind kind() { return kind; }

    public String username() { return username; }

    /** The portal-wide identity: employee number, or {@code u:<username>} for a platform account. */
    public String personId() { return personId; }

    /** Null for platform accounts. */
    public String employeeNo() { return employeeNo; }

    UUID platformUserId() { return platformUserId; }

    public LocalizedText name() { return name; }

    /** Null for platform accounts. */
    public SapCredentials credentials() { return credentials; }

    public boolean admin() { return admin; }

    public boolean mustChangePassword() { return mustChangePassword; }

    void passwordChanged() { mustChangePassword = false; }

    Instant createdAt() { return createdAt; }

    Instant lastSeen() { return lastSeen; }

    void touch(Instant now) { lastSeen = now; }
}
