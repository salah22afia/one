package org.gcc.usp.platform.identity;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

/** Authenticates requests carrying a portal session: {@code Authorization: Bearer <token>} (mobile) or the HttpOnly cookie (web). */
class SessionFilter extends OncePerRequestFilter {

    private final SessionStore sessions;

    SessionFilter(SessionStore sessions) {
        this.sessions = sessions;
    }

    static String tokenOf(HttpServletRequest req) {
        var h = req.getHeader("Authorization");
        if (h != null && h.startsWith("Bearer ")) return h.substring(7).trim();
        if (req.getCookies() != null)
            for (var c : req.getCookies()) if (AuthController.COOKIE.equals(c.getName())) return c.getValue();
        return null;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain) throws ServletException, IOException {
        sessions.find(tokenOf(req)).ifPresent(s -> SecurityContextHolder.getContext().setAuthentication(new SessionAuthentication(s)));
        chain.doFilter(req, res);
    }

    static final class SessionAuthentication extends AbstractAuthenticationToken {

        private final PortalSession session;

        SessionAuthentication(PortalSession session) {
            super(List.of());
            this.session = session;
            setAuthenticated(true);
        }

        @Override
        public Object getCredentials() {
            return "";
        }

        @Override
        public PortalSession getPrincipal() {
            return session;
        }

        @Override
        public String getName() {
            return session.personId();
        }
    }
}
