package org.gcc.usp.platform.org;

import jakarta.servlet.http.HttpServletRequest;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.Semaphore;
import java.util.function.Supplier;
import java.util.stream.Stream;
import org.gcc.usp.platform.identity.CurrentUser;
import org.gcc.usp.platform.identity.PlatformUsers;
import org.gcc.usp.platform.integration.SapClient;
import org.gcc.usp.platform.integration.SapCredentials;
import org.gcc.usp.platform.integration.SapException;
import org.gcc.usp.platform.org.OrgModel.Employee;
import org.gcc.usp.platform.org.OrgModel.Me;
import org.gcc.usp.platform.org.OrgModel.Person;
import org.gcc.usp.platform.org.OrgModel.Position;
import org.gcc.usp.platform.org.OrgModel.Unit;
import org.gcc.usp.platform.shared.LocalizedText;
import org.springframework.beans.factory.annotation.Value;
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
    private final int maxParallel;

    OrgDirectory(SapClient sap, CurrentUser currentUser, PlatformUsers platformUsers, @Value("${usp.sap.max-parallel:6}") int maxParallel) {
        this.sap = sap;
        this.currentUser = currentUser;
        this.platformUsers = platformUsers;
        this.maxParallel = Math.max(1, maxParallel);
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
        return memo("emp:" + employeeNo, () -> get(EMPLOYEE + employeeNo).map(OrgDirectory::toEmployee));
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

    /**
     * Loads people (SAP-011, with their position titles) and positions (SAP-013) for a list page concurrently into this
     * HTTP request's memo, so the page asks SAP in parallel rather than one row after another. At most
     * {@code usp.sap.max-parallel} calls run at once, each as the signed-in user. A failed lookup is simply not memoised:
     * the regular lookup then reports it as usual.
     */
    public void prefetch(Collection<String> employeeNos, Collection<String> positionIds) {
        var cache = cache();
        if (cache == null || !currentUser.hasSap()) return;
        var credentials = currentUser.sapCredentials();
        var people = employeeNos.stream().filter(Objects::nonNull).filter(no -> !PlatformUsers.isPlatformId(no))
            .distinct().filter(no -> !cache.containsKey("emp:" + no)).toList();
        var found = fetchAll(people.stream().map(no -> EMPLOYEE + no).toList(), credentials);
        var ownPositions = new ArrayList<String>();
        for (var no : people) {
            var n = found.get(EMPLOYEE + no);
            if (n == null) continue;
            Optional<Employee> e = n.map(OrgDirectory::toEmployee);
            cache.put("emp:" + no, e);
            e.map(Employee::positionId).ifPresent(ownPositions::add);
        }
        var positions = Stream.concat(positionIds.stream(), ownPositions.stream()).filter(Objects::nonNull).distinct()
            .filter(id -> !cache.containsKey("pos:" + id)).toList();
        var pos = fetchAll(positions.stream().map(id -> POSITION + id).toList(), credentials);
        for (var id : positions) {
            var n = pos.get(POSITION + id);
            if (n != null) cache.put("pos:" + id, n.map(OrgDirectory::position));
        }
    }

    /** GETs in parallel on virtual threads; the value is empty for 404 and absent for any other failure. */
    private Map<String, Optional<JsonNode>> fetchAll(List<String> paths, SapCredentials credentials) {
        if (paths.isEmpty()) return Map.of();
        var slots = new Semaphore(maxParallel);
        var out = new HashMap<String, Optional<JsonNode>>();
        try (var pool = Executors.newVirtualThreadPerTaskExecutor()) {
            var futures = new LinkedHashMap<String, Future<Optional<JsonNode>>>();
            for (var path : paths) futures.put(path, pool.submit(() -> {
                slots.acquire();
                try {
                    return Optional.of(sap.get(path, credentials).body());
                } catch (SapException e) {
                    return e.kind() == SapException.Kind.NOT_FOUND ? Optional.<JsonNode>empty() : null;
                } finally {
                    slots.release();
                }
            }));
            for (var f : futures.entrySet()) {
                try {
                    var v = f.getValue().get();
                    if (v != null) out.put(f.getKey(), v);
                } catch (ExecutionException e) {
                    // left for the regular lookup, which reports it
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        }
        return out;
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

    private static Employee toEmployee(JsonNode n) {
        return new Employee(text(n, "employee_no"), LocalizedText.arEn(text(n, "arabic_name"), text(n, "english_name")),
            blankToNull(text(n, "position_id")), blankToNull(text(n, "org_unit_id")), blankToNull(text(n, "gender")), isoDate(text(n, "hire_date")));
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
