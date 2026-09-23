package org.gcc.usp.platform.identity;

import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import org.gcc.usp.platform.integration.SapClient;
import org.gcc.usp.platform.integration.SapCredentials;
import org.gcc.usp.platform.integration.SapException;
import org.gcc.usp.platform.shared.ApiException;
import org.gcc.usp.platform.shared.LocalizedText;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;

/**
 * Sign-in. A platform account (identity.platform_user) is checked first, against its stored hash; any other name is an
 * SAP user (SU01), checked by calling the employee profile service as that user. On success the portal opens an
 * in-memory session: web gets an HttpOnly cookie, mobile a bearer token.
 */
@RestController
class AuthController {

    static final String COOKIE = "usp_session";

    private final SapClient sap;
    private final PlatformUsers platformUsers;
    private final CurrentUser currentUser;
    private final SessionStore sessions;
    private final LoginThrottle throttle;
    private final String profilePath;
    private final boolean secureCookie;

    AuthController(SapClient sap, PlatformUsers platformUsers, CurrentUser currentUser, SessionStore sessions, LoginThrottle throttle, @Value("${usp.sap.profile-path}") String profilePath,
                   @Value("${usp.session.secure-cookie:true}") boolean secureCookie) {
        this.sap = sap;
        this.platformUsers = platformUsers;
        this.currentUser = currentUser;
        this.sessions = sessions;
        this.throttle = throttle;
        this.profilePath = profilePath;
        this.secureCookie = secureCookie;
    }

    record Login(String username, String password) {}

    record PasswordChange(String current, String next) {}

    /** {@code kind}: sap (employee) or platform (no SAP user); {@code mustChangePassword}: nothing else is allowed until it is changed. */
    record SessionView(String username, String kind, String personId, String employeeNo, LocalizedText name, boolean admin,
                       boolean mustChangePassword, Instant expiresAt, String token) {}

    @PostMapping("/api/v1/auth/login")
    ResponseEntity<SessionView> login(@RequestBody Login body) {
        if (body == null || blank(body.username()) || blank(body.password()))
            throw ApiException.unprocessable("auth.missingCredentials");
        var username = body.username().trim();
        if (throttle.blocked(username))
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "auth.tooManyAttempts");

        PlatformUsers.Account account;
        try {
            account = platformUsers.authenticate(username, body.password()).orElse(null);
        } catch (ApiException e) {
            throttle.failed(username);
            throw e;
        }
        if (account != null) {
            throttle.succeeded(username);
            return opened(sessions.open((token, now) -> PortalSession.platform(token, account, now)));
        }

        var basic = SapCredentials.basic(username, body.password());
        SapClient.SapResponse res;
        try {
            res = sap.get(profilePath, basic);
        } catch (SapException e) {
            if (e.kind() == SapException.Kind.UNAUTHORIZED) {
                throttle.failed(username);
                throw new ApiException(HttpStatus.UNAUTHORIZED, "auth.wrongCredentials");
            }
            throw e.toApi();
        }
        throttle.succeeded(username);
        var p = res.body();
        var employeeNo = text(p, "employee_no");
        if (employeeNo.isBlank())
            throw new ApiException(HttpStatus.FORBIDDEN, "auth.noEmployee");
        // Prefer SAP's logon ticket when it issues one: then the password is not kept at all.
        var credentials = res.ticket().map(SapCredentials::ticket).orElse(basic);
        var name = LocalizedText.arEn(text(p, "arabic_name"), text(p, "english_name"));
        return opened(sessions.open((token, now) -> PortalSession.sap(token, username, employeeNo, name, credentials, currentUser.isBootstrapEmployee(employeeNo), now)));
    }

    private ResponseEntity<SessionView> opened(PortalSession s) {
        var cookie = ResponseCookie.from(COOKIE, s.token()).httpOnly(true).secure(secureCookie).sameSite("Strict").path("/api")
            .maxAge(sessions.maxAgeSeconds()).build();
        return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, cookie.toString()).body(view(s, s.token()));
    }

    @PostMapping("/api/v1/auth/logout")
    ResponseEntity<Void> logout(HttpServletRequest req) {
        sessions.remove(SessionFilter.tokenOf(req));
        var gone = ResponseCookie.from(COOKIE, "").httpOnly(true).secure(secureCookie).sameSite("Strict").path("/api").maxAge(0).build();
        return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, gone.toString()).build();
    }

    /** A platform account changes its own password (required after an administrator set or reset it). */
    @PostMapping("/api/v1/auth/password")
    SessionView changePassword(HttpServletRequest req, @RequestBody PasswordChange body) {
        var s = sessions.find(SessionFilter.tokenOf(req)).orElseThrow(ApiException::unauthorized);
        if (s.kind() != PortalSession.Kind.PLATFORM) throw new ApiException(HttpStatus.UNPROCESSABLE_CONTENT, "auth.passwordInSap");
        platformUsers.changePassword(s.platformUserId(), body.current(), body.next());
        s.passwordChanged();
        return view(s, null);
    }

    /** Who is signed in (the token is not echoed back here). */
    @GetMapping("/api/v1/auth/session")
    SessionView session(HttpServletRequest req) {
        return sessions.find(SessionFilter.tokenOf(req)).map(s -> view(s, null)).orElseThrow(ApiException::unauthorized);
    }

    private SessionView view(PortalSession s, String token) {
        return new SessionView(s.username(), s.kind().name().toLowerCase(), s.personId(), s.employeeNo(), s.name(), s.admin(),
            s.mustChangePassword(), sessions.expiresAt(s), token);
    }

    private static String text(JsonNode n, String field) {
        var v = n.path(field);
        return v.isMissingNode() || v.isNull() ? "" : v.asString().trim();
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }
}
