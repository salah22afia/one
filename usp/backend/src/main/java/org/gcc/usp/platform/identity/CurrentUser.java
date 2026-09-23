package org.gcc.usp.platform.identity;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import org.gcc.usp.platform.integration.SapCredentials;
import org.gcc.usp.platform.shared.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

/** The person behind the current request: an employee (SAP sign-in) or a platform account. */
@Component
public class CurrentUser {

    private final Set<String> bootstrapEmployees;

    CurrentUser(@Value("${usp.admin.bootstrap-employees:}") List<String> bootstrapEmployees) {
        this.bootstrapEmployees = bootstrapEmployees.stream().map(String::trim).filter(s -> !s.isEmpty()).collect(Collectors.toSet());
    }

    /** Employee number, or {@code u:<username>} for a platform account. */
    public String personId() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getName())) throw ApiException.unauthorized();
        return auth.getName();
    }

    public Optional<PortalSession> session() {
        return SecurityContextHolder.getContext().getAuthentication() instanceof SessionFilter.SessionAuthentication a
            ? Optional.of(a.getPrincipal()) : Optional.empty();
    }

    /** Signed in with SAP (an employee); platform accounts are not. */
    public boolean hasSap() {
        return session().map(s -> s.credentials() != null).orElse(false);
    }

    /**
     * Platform administrator: a platform account with the admin flag, or an employee listed in
     * {@code USP_BOOTSTRAP_ADMINS} (first run and recovery; decided at sign-in).
     */
    public boolean isPlatformAdmin() {
        return session().map(PortalSession::admin).orElse(false);
    }

    boolean isBootstrapEmployee(String employeeNo) {
        return bootstrapEmployees.contains(employeeNo);
    }

    /** Credentials for calling SAP as this user (SEC-03). A platform account has none: it cannot use SAP-backed features. */
    public SapCredentials sapCredentials() {
        var s = session().orElseThrow(ApiException::unauthorized);
        if (s.credentials() == null) throw new ApiException(HttpStatus.FORBIDDEN, "auth.noSapAccount");
        return s.credentials();
    }
}
