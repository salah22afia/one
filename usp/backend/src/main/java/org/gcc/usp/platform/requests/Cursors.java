package org.gcc.usp.platform.requests;

import java.nio.charset.StandardCharsets;
import java.time.DateTimeException;
import java.time.Instant;
import java.util.Base64;
import org.gcc.usp.platform.shared.ApiException;
import org.springframework.http.HttpStatus;

/**
 * Opaque keyset cursors for paged lists: the sort key of the last row seen, URL-safe. Paging by key (not offset) stays
 * fast however long the list grows and does not skip or repeat rows when new ones arrive between pages.
 */
final class Cursors {

    private static final String SEP = "\u001f";

    private Cursors() {}

    static String encode(Object... parts) {
        var sb = new StringBuilder();
        for (int i = 0; i < parts.length; i++) sb.append(i == 0 ? "" : SEP).append(parts[i]);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(sb.toString().getBytes(StandardCharsets.UTF_8));
    }

    /** The parts of a cursor made by {@link #encode}; anything else is a 400. */
    static String[] decode(String cursor, int parts) {
        try {
            var s = new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8).split(SEP, -1);
            if (s.length != parts) throw new IllegalArgumentException();
            return s;
        } catch (IllegalArgumentException e) {
            throw bad();
        }
    }

    static Instant instant(String part) {
        try {
            return Instant.parse(part);
        } catch (DateTimeException e) {
            throw bad();
        }
    }

    static long number(String part) {
        try {
            return Long.parseLong(part);
        } catch (NumberFormatException e) {
            throw bad();
        }
    }

    private static ApiException bad() {
        return new ApiException(HttpStatus.BAD_REQUEST, "error.badCursor");
    }
}
