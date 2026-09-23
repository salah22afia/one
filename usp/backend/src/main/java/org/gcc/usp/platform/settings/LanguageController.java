package org.gcc.usp.platform.settings;

import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Public: the sign-in screen needs the language list before anyone is signed in. */
@RestController
class LanguageController {

    private final Languages languages;

    LanguageController(Languages languages) {
        this.languages = languages;
    }

    @GetMapping("/api/v1/settings/languages")
    List<Language> languages() {
        return languages.enabled();
    }
}
