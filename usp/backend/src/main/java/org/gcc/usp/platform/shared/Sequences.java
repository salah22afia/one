package org.gcc.usp.platform.shared;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/** Gap-free yearly counters (request and document numbers). Runs in the caller's transaction. */
@Component
public class Sequences {

    private final JdbcClient jdbc;

    Sequences(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public int next(String key, int year) {
        return jdbc.sql("""
                insert into shared.sequence (key, year, value) values (:key, :year, 1)
                on conflict (key, year) do update set value = shared.sequence.value + 1
                returning value""")
            .param("key", key).param("year", year)
            .query(Integer.class).single();
    }
}
