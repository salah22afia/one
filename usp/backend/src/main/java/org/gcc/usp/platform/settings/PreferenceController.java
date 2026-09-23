package org.gcc.usp.platform.settings;

import org.gcc.usp.platform.identity.CurrentUser;
import org.gcc.usp.platform.settings.PersonPreferences.Preferences;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/** The signed-in person's own display preferences (Me › Settings). */
@RestController
class PreferenceController {

    private final PersonPreferences preferences;
    private final CurrentUser me;

    PreferenceController(PersonPreferences preferences, CurrentUser me) {
        this.preferences = preferences;
        this.me = me;
    }

    @GetMapping("/api/v1/me/preferences")
    Preferences get() {
        return preferences.of(me.personId());
    }

    @PutMapping("/api/v1/me/preferences")
    Preferences put(@RequestBody Preferences body) {
        return preferences.save(me.personId(), body);
    }
}
