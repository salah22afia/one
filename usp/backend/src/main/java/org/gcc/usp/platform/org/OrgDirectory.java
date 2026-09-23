package org.gcc.usp.platform.org;

import jakarta.servlet.http.HttpServletRequest;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Supplier;
import org.gcc.usp.platform.identity.CurrentUser;
import org.gcc.usp.platform.identity.PlatformUsers;
import org.gcc.usp.platform.integration.SapClient;
import org.gcc.usp.platform.integration.SapException;
import org.gcc.usp.platform.org.OrgModel.Employee;
import org.gcc.usp.platform.org.OrgModel.Me;
import org.gcc.usp.platform.org.OrgModel.Person;
import org.gcc.usp.platform.org.OrgModel.Position;
import org.gcc.usp.platform.org.OrgModel.Unit;
import org.gcc.usp.platform.shared.LocalizedText;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import tools.jackson.databind.JsonNode;

/**
 * The org structure, read from SAP as the signed-in user (SAP-010 … SAP-014). Lookups are memoised for the current
 * HTTP request only, so a request page or inbox asks SAP once per unit/position; nothing outlives the request.
 */
@Service
public class OrgDirectory {

    static final String ME = "/sap/tamkeen/org/me";
    static final String EMPLOYEE = "/sap/tamkeen/org/employees/";
    static final String UNIT = "/sap/tamkeen/org/units/";
    static final String POSITION = "/sap/tamkeen/org/positions/";

    private final SapClient sap;
    private final CurrentUser currentUser;
    private final PlatformUsers platformUsers;

    OrgDirectory(SapClient sap, CurrentUser currentUser, PlatformUsers platformUsers) {
        this.sap = sap;
        this.currentUser = currentUser;
        this.platformUsers = platformUsers;
    }

    /** SAP-010: the signed-in user's positions. */
    public Me me() {
        // A platform account has no SAP user, so it holds no position.
        if (!currentUser.hasSap()) return new Me(currentUser.personId(), List.of(), List.of());
        return memo("me", () -> {
            var n = get(ME).orElseThrow();
            var positions = new ArrayList<String>();
            n.path("positions").forEach(p -> positions.add(text(p, "id")));
            var acting = new ArrayList<String>();
            n.path("acting_for").forEach(a -> acting.add(text(a, "position_id")));
            return new Me(text(n, "employee_no"), positions, acting);
        });
    }

    /** SAP-011. */
    public Optional<Employee> employee(String employeeNo) {
        return memo("emp:" + employeeNo, () -> get(EMPLOYEE + employeeNo).map(n -> new Employee(text(n, "employee_no"),
            LocalizedText.arEn(text(n, "arabic_name"), text(n, "english_name")), blankToNull(text(n, "position_id")), blankToNull(text(n, "org_unit_id")),
            blankToNull(text(n, "gender")), isoDate(text(n, "hire_date")))));
    }

    /** Name and position title for display; falls back to the employee number when SAP does not know the person. */
    public OrgModel.PersonRef describe(String employeeNo) {
        var platform = platformUsers.nameOf(employeeNo);
        if (platform.isPresent()) return new OrgModel.PersonRef(employeeNo, platform.get(), LocalizedText.EMPTY);
        return employee(employeeNo).map(e -> new OrgModel.PersonRef(employeeNo, e.name(),
                position(e.positionId()).map(Position::title).orElse(LocalizedText.EMPTY)))
            .orElse(new OrgModel.PersonRef(employeeNo, LocalizedText.of("und", employeeNo), LocalizedText.EMPTY));
    }

    /** SAP-012. */
    public Optional<Unit> unit(String id) {
        if (id == null) return Optional.empty();
        return memo("unit:" + id, () -> get(UNIT + id).map(OrgDirectory::unit));
    }

    /** SAP-013. */
    public Optional<Position> position(String id) {
        if (id == null) return Optional.empty();
        return memo("pos:" + id, () -> get(POSITION + id).map(OrgDirectory::position));
    }

    /** SAP-014. */
    public List<Position> positionsOf(String unitId) {
        return memo("unitpos:" + unitId, () -> {
            var out = new ArrayList<Position>();
            get(UNIT + unitId + "/positions").ifPresent(arr -> arr.forEach(p -> out.add(position(p))));
            // Seed the per-request memo so later single-position lookups do not call SAP again.
            out.forEach(p -> memoPut("pos:" + p.id(), Optional.of(p)));
            return out;
        });
    }

    private Optional<JsonNode> get(String path) {
        // Signed in without SAP (platform account): SAP cannot be asked; names fall back to the number.
        if (!currentUser.hasSap()) return Optional.empty();
        try {
            return Optional.of(sap.get(path, currentUser.sapCredentials()).body());
        } catch (SapException e) {
            if (e.kind() == SapException.Kind.NOT_FOUND) return Optional.empty();
            throw e.toApi();
        }
    }

    private static Unit unit(JsonNode n) {
        return new Unit(text(n, "id"), LocalizedText.arEn(text(n, "name_ar"), text(n, "name_en")), text(n, "level"),
            blankToNull(text(n, "parent_unit_id")), blankToNull(text(n, "chief_position_id")));
    }

    private static Position position(JsonNode n) {
        var h = n.path("holder");
        var holder = h.isObject() && !text(h, "employee_no").isEmpty()
            ? new Person(text(h, "employee_no"), LocalizedText.arEn(text(h, "arabic_name"), text(h, "english_name"))) : null;
        return new Position(text(n, "id"), LocalizedText.arEn(text(n, "title_ar"), text(n, "title_en")), text(n, "org_unit_id"), holder,
            blankToNull(text(n, "deputy_position_id")));
    }

    static String text(JsonNode n, String field) {
        var v = n.path(field);
        return v.isMissingNode() || v.isNull() ? "" : v.asString().trim();
    }

    /** SAP dates arrive as dd-MM-yyyy or ISO; normalised to ISO. */
    static String isoDate(String s) {
        if (s == null || s.isBlank()) return null;
        return s.length() == 10 && s.charAt(2) == '-' ? s.substring(6) + "-" + s.substring(3, 5) + "-" + s.substring(0, 2) : s;
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s;
    }

    @SuppressWarnings("unchecked")
    private <T> T memo(String key, Supplier<T> load) {
        var cache = cache();
        if (cache == null) return load.get();
        if (cache.containsKey(key)) return (T) cache.get(key);
        var v = load.get();
        cache.put(key, v);
        return v;
    }

    private void memoPut(String key, Object value) {
        var cache = cache();
        if (cache != null) cache.putIfAbsent(key, value);
    }

    /** One map per HTTP request (request attribute); null outside a request (scheduler), meaning no memo. */
    @SuppressWarnings("unchecked")
    private static Map<String, Object> cache() {
        if (!(RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attrs)) return null;
        HttpServletRequest req = attrs.getRequest();
        var m = (Map<String, Object>) req.getAttribute(OrgDirectory.class.getName());
        if (m == null) {
            m = new HashMap<>();
            req.setAttribute(OrgDirectory.class.getName(), m);
        }
        return m;
    }
}
