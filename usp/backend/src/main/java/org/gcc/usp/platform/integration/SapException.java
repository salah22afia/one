package org.gcc.usp.platform.integration;

import org.gcc.usp.platform.shared.ApiException;
import org.springframework.http.HttpStatus;

/** A failed SAP call, classified so callers can react (sign-out on UNAUTHORIZED, "try later" on UNAVAILABLE). */
public class SapException extends RuntimeException {

    public enum Kind { UNAUTHORIZED, FORBIDDEN, NOT_FOUND, UNAVAILABLE, ERROR }

    private final Kind kind;
    private final int status;

    public SapException(Kind kind, int status, String message) {
        super(message);
        this.kind = kind;
        this.status = status;
    }

    public Kind kind() {
        return kind;
    }

    public int status() {
        return status;
    }

    public ApiException toApi() {
        return switch (kind) {
            case UNAUTHORIZED -> new ApiException(HttpStatus.UNAUTHORIZED, "sap.unauthorized");
            case FORBIDDEN -> new ApiException(HttpStatus.FORBIDDEN, "sap.forbidden");
            case NOT_FOUND -> new ApiException(HttpStatus.NOT_FOUND, "sap.notFound");
            case UNAVAILABLE -> new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "sap.unavailable");
            case ERROR -> new ApiException(HttpStatus.BAD_GATEWAY, "sap.error");
        };
    }
}
