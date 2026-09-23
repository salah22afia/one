package org.gcc.usp.platform.shared;

import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Properties;
import java.util.TreeMap;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Component;

/**
 * Server-side message catalogs: {@code classpath:i18n/messages_<lang>.properties} (UTF-8), one file per language.
 * Adding a language = adding its file. {@code {0}}, {@code {1}}… are replaced by arguments; an argument that is a
 * {@link LocalizedText} is taken in the same language. Missing keys fall back to the default language, then to the key.
 */
@Component
public class Messages {

    private final Map<String, Properties> catalogs = new TreeMap<>();
    private final String defaultLanguage;

    public Messages(@Value("${usp.i18n.default-language:ar}") String defaultLanguage) throws IOException {
        this.defaultLanguage = defaultLanguage;
        for (var r : new PathMatchingResourcePatternResolver().getResources("classpath*:i18n/messages_*.properties")) {
            var name = r.getFilename();
            var lang = name.substring("messages_".length(), name.length() - ".properties".length());
            var p = new Properties();
            try (var in = new InputStreamReader(r.getInputStream(), StandardCharsets.UTF_8)) {
                p.load(in);
            }
            catalogs.put(lang, p);
        }
        if (!catalogs.containsKey(defaultLanguage)) throw new IllegalStateException("No message catalog for default language " + defaultLanguage);
    }

    public Collection<String> languages() {
        return catalogs.keySet();
    }

    public String defaultLanguage() {
        return defaultLanguage;
    }

    public LocalizedText text(MessageRef ref) {
        return ref == null ? LocalizedText.EMPTY : text(ref.key(), ref.resolvedArgs());
    }

    /** The message in every language that has a catalog. */
    public LocalizedText text(String key, Object... args) {
        var out = new LinkedHashMap<String, String>();
        for (var lang : catalogs.keySet()) out.put(lang, format(lang, key, args));
        return new LocalizedText(out);
    }

    private String format(String lang, String key, Object... args) {
        var pattern = catalogs.get(lang).getProperty(key);
        if (pattern == null) pattern = catalogs.get(defaultLanguage).getProperty(key, key);
        for (int i = 0; i < args.length; i++) {
            var a = args[i] instanceof LocalizedText t ? t.get(lang) : String.valueOf(args[i]);
            pattern = pattern.replace("{" + i + "}", a);
        }
        return pattern;
    }
}
