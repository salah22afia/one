package org.gcc.usp.platform.settings;

import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

/** Languages the administrator has configured (settings.language). */
@Service
public class Languages {

    private final JdbcClient jdbc;

    Languages(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public List<Language> enabled() {
        return jdbc.sql("""
                select code, native_name, direction, enabled, is_default, position
                from settings.language where enabled order by position, code""")
            .query((rs, n) -> new Language(rs.getString(1), rs.getString(2), rs.getString(3), rs.getBoolean(4), rs.getBoolean(5), rs.getInt(6)))
            .list();
    }
}
