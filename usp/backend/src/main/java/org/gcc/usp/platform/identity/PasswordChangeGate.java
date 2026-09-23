package org.gcc.usp.platform.identity;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.gcc.usp.platform.shared.ApiException;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** A platform account with a temporary password can only change it (and sign out) until it does. */
@Configuration
class PasswordChangeGate implements WebMvcConfigurer {

    private final CurrentUser currentUser;

    PasswordChangeGate(CurrentUser currentUser) {
        this.currentUser = currentUser;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(new HandlerInterceptor() {
            @Override
            public boolean preHandle(HttpServletRequest req, HttpServletResponse res, Object handler) {
                if (currentUser.session().map(PortalSession::mustChangePassword).orElse(false))
                    throw new ApiException(HttpStatus.FORBIDDEN, "auth.passwordChangeRequired");
                return true;
            }
        }).addPathPatterns("/api/**").excludePathPatterns("/api/v1/auth/**", "/api/v1/settings/languages", "/api/v1/verify/**");
    }
}
