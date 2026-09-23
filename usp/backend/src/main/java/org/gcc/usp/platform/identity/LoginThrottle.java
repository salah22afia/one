package org.gcc.usp.platform.identity;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

/**
 * Stops the portal from hammering SAP with wrong passwords (which would also lock the SAP user): after 5 failures
 * for a user name within 15 minutes, further attempts are refused until the window passes.
 */
@Component
class LoginThrottle {

    private static final int MAX_FAILURES = 5;
    private static final Duration WINDOW = Duration.ofMinutes(15);

    private record Failures(int count, Instant since) {}

    private final Map<String, Failures> failures = new ConcurrentHashMap<>();

    boolean blocked(String username) {
        var f = failures.get(key(username));
        if (f == null) return false;
        if (Instant.now().isAfter(f.since().plus(WINDOW))) {
            failures.remove(key(username));
            return false;
        }
        return f.count() >= MAX_FAILURES;
    }

    void failed(String username) {
        failures.merge(key(username), new Failures(1, Instant.now()),
            (old, one) -> Instant.now().isAfter(old.since().plus(WINDOW)) ? one : new Failures(old.count() + 1, old.since()));
    }

    void succeeded(String username) {
        failures.remove(key(username));
    }

    private static String key(String username) {
        return username.trim().toUpperCase();
    }
}
