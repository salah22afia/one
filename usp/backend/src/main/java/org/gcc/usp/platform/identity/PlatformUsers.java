package org.gcc.usp.platform.identity;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;
import org.gcc.usp.platform.shared.ApiException;
import org.gcc.usp.platform.shared.LocalizedText;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

/**
 * Platform accounts: sign-in without SAP, for administrators and other non-employees (identity.platform_user).
 * Administrators create them with a temporary password that must be changed at first sign-in.
 */
@Service
@Transactional
public class PlatformUsers {

    private static final Logger log = LoggerFactory.getLogger(PlatformUsers.class);
    private static final Pattern USERNAME = Pattern.compile("[a-z0-9][a-z0-9._-]{2,63}");
    static final int MIN_PASSWORD = 12;
    private static final String PREFIX = "u:";

    private final JdbcClient jdbc;
    private final JsonMapper json;
    private final PasswordEncoder encoder = PasswordEncoderFactories.createDelegatingPasswordEncoder();
    private final Clock clock = Clock.systemUTC();
    private final String bootstrapUsername;
    private final String bootstrapPassword;

    PlatformUsers(JdbcClient jdbc, JsonMapper json, @Value("${usp.admin.bootstrap-username:}") String bootstrapUsername,
                  @Value("${usp.admin.bootstrap-password:}") String bootstrapPassword) {
        this.jdbc = jdbc;
        this.json = json;
        this.bootstrapUsername = bootstrapUsername.trim().toLowerCase();
        this.bootstrapPassword = bootstrapPassword;
    }

    public record Account(UUID id, String username, LocalizedText name, String email, boolean admin, boolean enabled,
                          boolean mustChangePassword, String createdBy, Instant createdAt, Instant lastLoginAt) {}

    /** The portal identity of a platform account ({@code u:<username>}), used wherever an employee number would be. */
    public static String personId(String username) {
        return PREFIX + username;
    }

    public static boolean isPlatformId(String personId) {
        return personId != null && personId.startsWith(PREFIX);
    }

    /** Display name of a platform account for timelines and logs. */
    @Transactional(readOnly = true)
    public Optional<LocalizedText> nameOf(String personId) {
        if (!isPlatformId(personId)) return Optional.empty();
        return find(personId.substring(PREFIX.length())).map(Account::name);
    }

    @Transactional(readOnly = true)
    public List<Account> list() {
        return jdbc.sql("select * from identity.platform_user order by username").query(this::map).list();
    }

    @Transactional(readOnly = true)
    public Optional<Account> find(String username) {
        return jdbc.sql("select * from identity.platform_user where username = :u").param("u", normalize(username)).query(this::map).optional();
    }

    /** Empty when the name is not a platform account (the caller then tries SAP). Throws when it is one but the check fails. */
    public Optional<Account> authenticate(String username, String password) {
        var row = jdbc.sql("select password_hash from identity.platform_user where username = :u").param("u", normalize(username))
            .query(String.class).optional();
        if (row.isEmpty()) return Optional.empty();
        var account = find(username).orElseThrow();
        if (!encoder.matches(password, row.get())) throw new ApiException(HttpStatus.UNAUTHORIZED, "auth.wrongCredentials");
        if (!account.enabled()) throw new ApiException(HttpStatus.FORBIDDEN, "auth.accountDisabled");
        jdbc.sql("update identity.platform_user set last_login_at = :t where id = :id").param("t", Timestamp.from(clock.instant())).param("id", account.id()).update();
        return Optional.of(account);
    }

    public Account create(String username, LocalizedText name, String email, boolean admin, String temporaryPassword, String by) {
        var u = normalize(username);
        if (!USERNAME.matcher(u).matches()) throw ApiException.unprocessable("users.usernameInvalid");
        if (name == null || name.values().values().stream().allMatch(v -> v == null || v.isBlank())) throw ApiException.unprocessable("users.nameRequired");
        checkPassword(u, temporaryPassword);
        if (find(u).isPresent()) throw ApiException.conflict("users.usernameTaken", u);
        var id = UUID.randomUUID();
        jdbc.sql("""
                insert into identity.platform_user (id, username, display_name, email, password_hash, is_admin, must_change_password, created_by, created_at)
                values (:id, :u, cast(:n as jsonb), :e, :h, :a, true, :by, :at)""")
            .param("id", id).param("u", u).param("n", json.writeValueAsString(name)).param("e", blankToNull(email))
            .param("h", encoder.encode(temporaryPassword)).param("a", admin).param("by", by).param("at", Timestamp.from(clock.instant())).update();
        return find(u).orElseThrow();
    }

    public Account update(UUID id, LocalizedText name, String email, boolean admin, boolean enabled) {
        var n = jdbc.sql("update identity.platform_user set display_name = cast(:n as jsonb), email = :e, is_admin = :a, enabled = :en where id = :id")
            .param("n", json.writeValueAsString(name)).param("e", blankToNull(email)).param("a", admin).param("en", enabled).param("id", id).update();
        if (n == 0) throw ApiException.notFound(String.valueOf(id));
        return byId(id);
    }

    /** An administrator sets a new temporary password; the user must change it at next sign-in. */
    public void resetPassword(UUID id, String temporaryPassword) {
        var a = byId(id);
        checkPassword(a.username(), temporaryPassword);
        jdbc.sql("update identity.platform_user set password_hash = :h, must_change_password = true, password_changed_at = :t where id = :id")
            .param("h", encoder.encode(temporaryPassword)).param("t", Timestamp.from(clock.instant())).param("id", id).update();
    }

    /** The user changes their own password (proving the current one). */
    public void changePassword(UUID id, String current, String next) {
        var a = byId(id);
        var hash = jdbc.sql("select password_hash from identity.platform_user where id = :id").param("id", id).query(String.class).single();
        if (current == null || !encoder.matches(current, hash)) throw ApiException.unprocessable("auth.wrongCurrentPassword");
        checkPassword(a.username(), next);
        if (encoder.matches(next, hash)) throw ApiException.unprocessable("auth.passwordReused");
        jdbc.sql("update identity.platform_user set password_hash = :h, must_change_password = false, password_changed_at = :t where id = :id")
            .param("h", encoder.encode(next)).param("t", Timestamp.from(clock.instant())).param("id", id).update();
    }

    Account byId(UUID id) {
        return jdbc.sql("select * from identity.platform_user where id = :id").param("id", id).query(this::map).optional()
            .orElseThrow(() -> ApiException.notFound(String.valueOf(id)));
    }

    /** First run: creates the administrator from the environment when there is no enabled administrator yet. */
    @EventListener(ApplicationReadyEvent.class)
    void bootstrap() {
        if (bootstrapUsername.isEmpty() || bootstrapPassword.isEmpty()) return;
        var admins = jdbc.sql("select count(*) from identity.platform_user where is_admin and enabled").query(Long.class).single();
        if (admins > 0 || find(bootstrapUsername).isPresent()) return;
        create(bootstrapUsername, LocalizedText.arEn("مدير المنصة", "Platform administrator"), null, true, bootstrapPassword, "bootstrap");
        log.info("Created the bootstrap platform administrator '{}' (must change the password at first sign-in)", bootstrapUsername);
    }

    private static void checkPassword(String username, String password) {
        if (password == null || password.length() < MIN_PASSWORD) throw ApiException.unprocessable("users.passwordTooShort", MIN_PASSWORD);
        if (password.toLowerCase().contains(username)) throw ApiException.unprocessable("users.passwordHasUsername");
    }

    private Account map(ResultSet rs, int n) throws SQLException {
        var last = rs.getTimestamp("last_login_at");
        return new Account(rs.getObject("id", UUID.class), rs.getString("username"), json.readValue(rs.getString("display_name"), LocalizedText.class),
            rs.getString("email"), rs.getBoolean("is_admin"), rs.getBoolean("enabled"), rs.getBoolean("must_change_password"),
            rs.getString("created_by"), rs.getTimestamp("created_at").toInstant(), last == null ? null : last.toInstant());
    }

    private static String normalize(String username) {
        return username == null ? "" : username.trim().toLowerCase();
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
