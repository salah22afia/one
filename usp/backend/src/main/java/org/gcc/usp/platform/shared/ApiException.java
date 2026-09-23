package org.gcc.usp.platform.shared;

import java.util.List;
import org.springframework.http.HttpStatus;

/**
 * Business/API error rendered as RFC 9457 problem+json. Carries a message key (resolved in every language by
 * {@link Messages} when rendered) and, for 422, the structured checks.
 */
public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final String key;
    private final transient Object[] args;
    private final transient List<?> checks;

    public ApiException(HttpStatus status, String key, Object... args) {
        this(status, key, args, List.of());
    }

    private ApiException(HttpStatus status, String key, Object[] args, List<?> checks) {
        super(key);
        this.status = status;
        this.key = key;
        this.args = args;
        this.checks = checks;
    }

    public ApiException withChecks(List<?> checks) {
        return new ApiException(status, key, args, checks);
    }

    public static ApiException notFound(String what) {
        return new ApiException(HttpStatus.NOT_FOUND, "error.notFound", what);
    }

    public static ApiException forbidden() {
        return new ApiException(HttpStatus.FORBIDDEN, "error.forbidden");
    }

    public static ApiException unauthorized() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "error.unauthorized");
    }

    public static ApiException unprocessable(String key, Object... args) {
        return new ApiException(HttpStatus.UNPROCESSABLE_CONTENT, key, args);
    }

    public static ApiException conflict(String key, Object... args) {
        return new ApiException(HttpStatus.CONFLICT, key, args);
    }

    public HttpStatus status() { return status; }

    public String key() { return key; }

    public Object[] args() { return args; }

    public List<?> checks() { return checks; }
}
