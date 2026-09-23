package org.gcc.usp.platform.identity;

import java.util.List;
import java.util.UUID;
import org.gcc.usp.platform.identity.PlatformUsers.Account;
import org.gcc.usp.platform.shared.ApiException;
import org.gcc.usp.platform.shared.LocalizedText;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Platform administrators manage platform accounts (people without an SAP user). */
@RestController
@RequestMapping("/api/v1/admin/platform-users")
class PlatformUserController {

    private final PlatformUsers users;
    private final SessionStore sessions;
    private final CurrentUser currentUser;

    PlatformUserController(PlatformUsers users, SessionStore sessions, CurrentUser currentUser) {
        this.users = users;
        this.sessions = sessions;
        this.currentUser = currentUser;
    }

    record NewUser(String username, LocalizedText name, String email, boolean admin, String temporaryPassword) {}

    record Change(LocalizedText name, String email, boolean admin, boolean enabled) {}

    record Reset(String temporaryPassword) {}

    @GetMapping
    List<Account> list() {
        requireAdmin();
        return users.list();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    Account create(@RequestBody NewUser body) {
        requireAdmin();
        return users.create(body.username(), body.name(), body.email(), body.admin(), body.temporaryPassword(), currentUser.personId());
    }

    @PutMapping("/{id}")
    Account update(@PathVariable UUID id, @RequestBody Change body) {
        requireAdmin();
        var before = users.byId(id);
        // An administrator cannot lock themselves out (and so the last administrator stays).
        if (PlatformUsers.personId(before.username()).equals(currentUser.personId()) && (!body.admin() || !body.enabled()))
            throw ApiException.unprocessable("users.notOnYourself");
        var after = users.update(id, body.name(), body.email(), body.admin(), body.enabled());
        if (!after.enabled() || before.admin() != after.admin()) sessions.endAll(id);
        return after;
    }

    @PostMapping("/{id}/reset-password")
    Account resetPassword(@PathVariable UUID id, @RequestBody Reset body) {
        requireAdmin();
        users.resetPassword(id, body.temporaryPassword());
        sessions.endAll(id);
        return users.byId(id);
    }

    private void requireAdmin() {
        if (!currentUser.isPlatformAdmin()) throw ApiException.forbidden();
    }
}
