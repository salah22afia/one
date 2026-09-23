package org.gcc.usp.platform.shared;

import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** problem+json with {@code message} (every language), {@code code} (the message key) and optional {@code checks}. */
@RestControllerAdvice
class ApiErrors {

    private final Messages messages;

    ApiErrors(Messages messages) {
        this.messages = messages;
    }

    @ExceptionHandler(ApiException.class)
    ProblemDetail handle(ApiException e) {
        var text = messages.text(e.key(), e.args());
        var p = ProblemDetail.forStatus(e.status());
        p.setTitle(text.get(messages.defaultLanguage()));
        p.setProperty("code", e.key());
        p.setProperty("message", text);
        if (!e.checks().isEmpty()) p.setProperty("checks", e.checks());
        return p;
    }
}
