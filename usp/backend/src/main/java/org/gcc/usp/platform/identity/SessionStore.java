package org.gcc.usp.platform.identity;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.BiFunction;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Sessions live in this JVM's memory only (credentials must never reach the database).
 * ponytail: single instance; with several backend instances use sticky sessions or an encrypted shared cache.
 */
@Component
class SessionStore {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final Map<String, PortalSession> sessions = new ConcurrentHashMap<>();
    private final Duration idle;
    private final Duration absolute;
    private final Clock clock = Clock.systemUTC();

    SessionStore(@Value("${usp.session.idle-timeout:30m}") Duration idle, @Value("${usp.session.max-age:8h}") Duration absolute) {
        this.idle = idle;
        this.absolute = absolute;
    }

    /** Opens a session; {@code build} receives the new random token. */
    PortalSession open(BiFunction<String, Instant, PortalSession> build) {
        var bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        var token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        var s = build.apply(token, clock.instant());
        sessions.put(token, s);
        return s;
    }

    /** Signs a platform account out everywhere (disabled, or its password reset by an administrator). */
    void endAll(UUID platformUserId) {
        sessions.values().removeIf(s -> platformUserId.equals(s.platformUserId()));
    }

    Optional<PortalSession> find(String token) {
        var s = token == null ? null : sessions.get(token);
        if (s == null) return Optional.empty();
        var now = clock.instant();
        if (expired(s, now)) {
            sessions.remove(token);
            return Optional.empty();
        }
        s.touch(now);
        return Optional.of(s);
    }

    void remove(String token) {
        if (token != null) sessions.remove(token);
    }

    Instant expiresAt(PortalSession s) {
        var byIdle = s.lastSeen().plus(idle);
        var byAge = s.createdAt().plus(absolute);
        return byIdle.isBefore(byAge) ? byIdle : byAge;
    }

    long maxAgeSeconds() {
        return absolute.toSeconds();
    }

    @Scheduled(fixedDelay = 300_000)
    void evictExpired() {
        var now = clock.instant();
        sessions.values().removeIf(s -> expired(s, now));
    }

    private boolean expired(PortalSession s, Instant now) {
        return now.isAfter(expiresAt(s));
    }
}
