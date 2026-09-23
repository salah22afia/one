package org.gcc.usp.platform.settings;

import java.sql.Timestamp;
import java.time.Clock;
import java.util.Optional;
import java.util.Set;
import org.gcc.usp.platform.shared.ApiException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

/** A person's display preferences (language, appearance, text size), kept in PostgreSQL so every device shows the same. */
@Service
public class PersonPreferences {

    static final Set<String> THEMES = Set.of("auto", "light", "dark");
    static final Set<String> TEXT_SIZES = Set.of("normal", "large", "xl");

    /** {@code null} fields: the default (the administrator's default language, the device's appearance, normal text). */
    public record Preferences(String language, String theme, String textSize) {

        static final Preferences DEFAULT = new Preferences(null, "auto", "normal");
    }

    private final JdbcClient jdbc;
    private final Languages languages;
    private final Clock clock;

    PersonPreferences(JdbcClient jdbc, Languages languages, Optional<Clock> clock) {
        this.jdbc = jdbc;
        this.languages = languages;
        this.clock = clock.orElse(Clock.systemUTC());
    }

    public Preferences of(String personId) {
        return jdbc.sql("select language, theme, text_size from settings.person_preference where person_id = :p").param("p", personId)
            .query((rs, n) -> new Preferences(enabledOrNull(rs.getString(1)), orDefault(rs.getString(2), "auto"), orDefault(rs.getString(3), "normal")))
            .optional().orElse(Preferences.DEFAULT);
    }

    /** Only enabled languages and the known appearances and sizes are kept; anything else is refused (422). */
    public Preferences save(String personId, Preferences p) {
        var language = p.language() == null || p.language().isBlank() ? null : p.language();
        if (language != null && enabledOrNull(language) == null) throw ApiException.unprocessable("settings.badLanguage", language);
        var theme = p.theme() == null ? "auto" : p.theme();
        if (!THEMES.contains(theme)) throw ApiException.unprocessable("settings.badTheme", theme);
        var size = p.textSize() == null ? "normal" : p.textSize();
        if (!TEXT_SIZES.contains(size)) throw ApiException.unprocessable("settings.badTextSize", size);
        jdbc.sql("""
                insert into settings.person_preference (person_id, language, theme, text_size, updated_at) values (:p, :l, :t, :s, :at)
                on conflict (person_id) do update set language = excluded.language, theme = excluded.theme, text_size = excluded.text_size,
                                                      updated_at = excluded.updated_at""")
            .param("p", personId).param("l", language).param("t", theme).param("s", size).param("at", Timestamp.from(clock.instant())).update();
        return new Preferences(language, theme, size);
    }

    /** A language the administrator has since disabled falls back to the default. */
    private String enabledOrNull(String code) {
        return code != null && languages.enabled().stream().anyMatch(l -> l.code().equals(code)) ? code : null;
    }

    private static String orDefault(String v, String d) {
        return v == null ? d : v;
    }
}
