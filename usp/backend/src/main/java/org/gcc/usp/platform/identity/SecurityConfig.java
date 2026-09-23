package org.gcc.usp.platform.identity;

import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.AnonymousAuthenticationFilter;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

/**
 * Users sign in with their SAP user (SU01) through {@code /api/v1/auth/login}; every request then carries the portal
 * session (cookie or bearer).
 * CSRF: the session cookie is HttpOnly + SameSite=Strict and the API only accepts JSON, so cross-site requests cannot use it.
 */
@Configuration
class SecurityConfig {

    private static final String[] PUBLIC = { "/actuator/health", "/api/v1/auth/login", "/api/v1/auth/logout", "/api/v1/verify/**", "/api/v1/settings/languages",
        "/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html" };

    @Bean
    SecurityFilterChain api(HttpSecurity http, SessionStore sessions, @Value("${usp.security.cors-origins:}") List<String> corsOrigins) throws Exception {
        http.csrf(c -> c.disable())
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .exceptionHandling(e -> e.authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
            .addFilterBefore(new SessionFilter(sessions), AnonymousAuthenticationFilter.class);
        if (!corsOrigins.isEmpty()) {
            // Only for browser clients on another origin (e.g. Expo web in dev). The web apps use a same-origin proxy.
            var cors = new CorsConfiguration();
            cors.setAllowedOrigins(corsOrigins);
            cors.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE"));
            cors.setAllowedHeaders(List.of("*"));
            cors.setAllowCredentials(true);
            var source = new UrlBasedCorsConfigurationSource();
            source.registerCorsConfiguration("/api/**", cors);
            http.cors(c -> c.configurationSource(source));
        }
        http.authorizeHttpRequests(a -> {
            a.requestMatchers(PUBLIC).permitAll();
            a.requestMatchers("/api/**").authenticated().anyRequest().permitAll();
        });
        return http.build();
    }
}
