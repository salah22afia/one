package org.gcc.usp.platform.catalog;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.gcc.usp.platform.catalog.CatalogViews.AdminCatalog;
import org.gcc.usp.platform.catalog.CatalogViews.AdminDomain;
import org.gcc.usp.platform.catalog.CatalogViews.AdminService;
import org.gcc.usp.platform.catalog.CatalogViews.Catalog;
import org.gcc.usp.platform.catalog.CatalogViews.Dock;
import org.gcc.usp.platform.catalog.CatalogViews.DockChange;
import org.gcc.usp.platform.catalog.CatalogViews.DockItem;
import org.gcc.usp.platform.catalog.CatalogViews.DomainChange;
import org.gcc.usp.platform.catalog.CatalogViews.DomainView;
import org.gcc.usp.platform.catalog.CatalogViews.FieldChange;
import org.gcc.usp.platform.catalog.CatalogViews.LogEntry;
import org.gcc.usp.platform.catalog.CatalogViews.ServiceChange;
import org.gcc.usp.platform.catalog.CatalogViews.ServiceView;
import org.gcc.usp.platform.forms.ServiceDefinitions;
import org.gcc.usp.platform.modules.FeatureDescriptor;
import org.gcc.usp.platform.modules.ModuleRegistry;
import org.gcc.usp.platform.org.OrgDirectory;
import org.gcc.usp.platform.shared.ApiException;
import org.gcc.usp.platform.shared.LocalizedText;
import org.gcc.usp.platform.shared.MessageRef;
import org.gcc.usp.platform.shared.Messages;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/**
 * The service catalogue (CAT-01): domains, services with their wave, the Home dock, and who asked to be told when a
 * coming service arrives. Operational configuration: an administrator's change takes effect at once and is written to
 * the change log. Every change locks the row it edits and checks the version the administrator saw (409 when stale).
 */
@Service
@Transactional
public class CatalogService {

    static final Set<String> TONES = Set.of("g-green", "g-gold", "g-sage", "g-bronze", "g-teal");
    static final Set<String> STATUSES = Set.of("available", "wave2", "wave3", "later", "hidden", "merged");
    static final Set<String> COMING = Set.of("wave2", "wave3", "later");
    static final Set<String> FREQUENCIES = Set.of("high", "seasonal", "medium", "low");
    private static final Pattern ICON = Pattern.compile("^[a-zA-Z]{1,24}$");
    private static final Pattern ID = Pattern.compile("^[A-Z]{2,4}-[0-9]{2}[A-Z]?$");
    private static final Pattern LANG = Pattern.compile("^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$");
    private static final TypeReference<List<FieldChange>> CHANGES = new TypeReference<>() {};
    /** Text limits (characters per language). */
    private static final Map<String, Integer> MAX = Map.of("name", 120, "description", 400, "scope", 600, "requesters", 200, "target", 300,
        "keywords", 300, "label", 24);

    private final JdbcClient jdbc;
    private final JsonMapper json;
    private final ServiceDefinitions definitions;
    private final OrgDirectory org;
    private final Messages messages;
    private final Clock clock;
    private final Set<String> codedServices;
    private final int dockMax;
    private final int logSize;

    CatalogService(JdbcClient jdbc, JsonMapper json, ModuleRegistry registry, ServiceDefinitions definitions, OrgDirectory org, Messages messages,
                   Optional<Clock> clock, @Value("${usp.catalog.dock-max:4}") int dockMax, @Value("${usp.catalog.log-size:200}") int logSize) {
        this.jdbc = jdbc;
        this.json = json;
        this.definitions = definitions;
        this.org = org;
        this.messages = messages;
        this.clock = clock.orElse(Clock.systemUTC());
        this.codedServices = registry.all().stream().flatMap(m -> m.features().stream())
            .filter(f -> f.kind() == FeatureDescriptor.Kind.SERVICE && f.serviceId() != null).map(FeatureDescriptor::serviceId)
            .collect(Collectors.toUnmodifiableSet());
        this.dockMax = dockMax;
        this.logSize = logSize;
    }

    /* ——— Employees ——— */

    /** Listed services (not hidden or merged) in domain order, the Home dock, and what the viewer asked to be told about. */
    @Transactional(readOnly = true)
    public Catalog catalog(String personId) {
        var domains = domains().stream().map(d -> new DomainView(d.code(), d.name(), d.description(), d.icon(), d.tone(), d.order())).toList();
        var services = jdbc.sql("""
                select s.* from catalog.service s join catalog.domain d on d.code = s.domain_code
                where s.status in ('available', 'wave2', 'wave3', 'later') order by d.sort, s.sort, s.id""")
            .query(this::service).list().stream()
            .map(s -> new ServiceView(s.id(), s.domain(), s.name(), s.scope(), s.requesters(), s.target(), s.keywords(), s.status(),
                startable(s.id(), s.status()), s.order()))
            .toList();
        var startable = services.stream().filter(ServiceView::startable).map(ServiceView::id).collect(Collectors.toSet());
        var dock = dockItems().stream().filter(i -> startable.contains(i.serviceId())).toList();
        var interested = jdbc.sql("select service_id from catalog.interest where person_id = :p order by service_id").param("p", personId)
            .query(String.class).list();
        return new Catalog(domains, services, dock, interested);
    }

    /** "Notify me when it is available": only for a listed service that is still coming. Asking twice is harmless. */
    public void registerInterest(String serviceId, String personId) {
        var status = statusOf(serviceId);
        if (!COMING.contains(status)) throw ApiException.conflict("catalog.notComing");
        jdbc.sql("insert into catalog.interest (service_id, person_id, at) values (:s, :p, :at) on conflict do nothing")
            .param("s", serviceId).param("p", personId).param("at", Timestamp.from(clock.instant())).update();
    }

    public void withdrawInterest(String serviceId, String personId) {
        statusOf(serviceId);
        jdbc.sql("delete from catalog.interest where service_id = :s and person_id = :p").param("s", serviceId).param("p", personId).update();
    }

    /** Whether a new request for this service may be submitted now: it is listed as available in the catalogue. */
    @Transactional(readOnly = true)
    public boolean isAvailable(String serviceId) {
        return jdbc.sql("select status from catalog.service where id = :id").param("id", serviceId).query(String.class).optional()
            .map("available"::equals).orElse(false);
    }

    /* ——— Administrators ——— */

    /** The whole catalogue for administrators; every change below returns it again, as it now stands. */
    @Transactional(readOnly = true)
    public AdminCatalog admin() {
        var domains = domains().stream().map(d -> new AdminDomain(d.code(), d.name(), d.description(), d.icon(), d.tone(), d.order(), d.version(),
            d.updatedAt())).toList();
        var interest = new HashMap<String, Integer>();
        jdbc.sql("select service_id, count(*) as n from catalog.interest group by service_id")
            .query(rs -> { interest.put(rs.getString("service_id"), rs.getInt("n")); });
        var items = dockItems();
        var inDock = items.stream().map(DockItem::serviceId).collect(Collectors.toSet());
        var services = jdbc.sql("""
                select s.* from catalog.service s join catalog.domain d on d.code = s.domain_code order by d.sort, s.sort, s.id""")
            .query(this::service).list().stream()
            .map(s -> new AdminService(s.id(), s.domain(), s.name(), s.scope(), s.requesters(), s.target(), s.keywords(), s.frequency(), s.status(),
                s.mergedInto(), s.order(), s.version(), runnable(s.id()), inDock.contains(s.id()), interest.getOrDefault(s.id(), 0), s.updatedAt()))
            .toList();
        var dockVersion = jdbc.sql("select version from catalog.dock where id = 1").query(Integer.class).single();
        var log = jdbc.sql("select at, by, what, detail from catalog.change_log order by at desc, id desc limit :n").param("n", logSize)
            .query((rs, n) -> new LogRow(rs.getTimestamp("at").toInstant(), rs.getString("by"), json.readValue(rs.getString("what"), MessageRef.class),
                rs.getString("detail")))
            .list();
        org.prefetch(log.stream().map(LogRow::by).distinct().toList(), List.of());
        var entries = log.stream().map(l -> new LogEntry(l.at(), org.describe(l.by()), messages.text(l.what()),
            l.detail().isBlank() ? List.of() : json.readValue(l.detail(), CHANGES))).toList();
        return new AdminCatalog(domains, services, new Dock(items, dockVersion, dockMax), entries);
    }

    public AdminCatalog updateDomain(String code, DomainChange c, String actor) {
        var before = jdbc.sql("select * from catalog.domain where code = :c for update").param("c", code).query(this::domain).optional()
            .orElseThrow(() -> ApiException.notFound("domain " + code));
        checkVersion(before.version(), c.version());
        var name = required(c.name(), "name");
        var description = text(c.description(), "description");
        var icon = icon(c.icon());
        var tone = tone(c.tone());
        int order = c.order() == null ? before.order() : c.order();
        jdbc.sql("""
                update catalog.domain set name = cast(:name as jsonb), description = cast(:d as jsonb), icon = :icon, tone = :tone, sort = :sort,
                       version = version + 1, updated_at = :at, updated_by = :by where code = :c""")
            .param("name", write(name)).param("d", write(description)).param("icon", icon).param("tone", tone).param("sort", order)
            .param("at", Timestamp.from(clock.instant())).param("by", actor).param("c", code).update();
        var changes = new ArrayList<FieldChange>();
        if (!name.equals(before.name())) changes.add(new FieldChange("name", null, null));
        if (!description.equals(before.description())) changes.add(new FieldChange("description", null, null));
        diff(changes, "icon", before.icon(), icon);
        diff(changes, "tone", before.tone(), tone);
        diff(changes, "order", String.valueOf(before.order()), String.valueOf(order));
        log(actor, MessageRef.of("catalog.log.domain", code), changes);
        return admin();
    }

    public AdminCatalog addService(ServiceChange c, String actor) {
        var id = c.id() == null ? "" : c.id().strip().toUpperCase();
        if (!ID.matcher(id).matches()) throw ApiException.unprocessable("catalog.idInvalid");
        if (jdbc.sql("select exists (select 1 from catalog.service where id = :id)").param("id", id).query(Boolean.class).single())
            throw ApiException.conflict("catalog.idTaken", id);
        var s = validated(id, c, null);
        int order = c.order() != null ? c.order()
            : jdbc.sql("select coalesce(max(sort), 0) + 10 from catalog.service where domain_code = :d").param("d", s.domain()).query(Integer.class).single();
        jdbc.sql("""
                insert into catalog.service (id, domain_code, name, scope, requesters, target, keywords, frequency, status, merged_into, sort,
                                             updated_at, updated_by)
                values (:id, :d, cast(:name as jsonb), cast(:scope as jsonb), cast(:req as jsonb), cast(:target as jsonb), cast(:kw as jsonb),
                        :freq, :status, :merged, :sort, :at, :by)""")
            .param("id", id).param("d", s.domain()).param("name", write(s.name())).param("scope", write(s.scope())).param("req", write(s.requesters()))
            .param("target", write(s.target())).param("kw", write(s.keywords())).param("freq", s.frequency()).param("status", s.status())
            .param("merged", s.mergedInto()).param("sort", order).param("at", Timestamp.from(clock.instant())).param("by", actor).update();
        log(actor, MessageRef.of("catalog.log.serviceAdded", id), List.of(new FieldChange("status", null, s.status())));
        return admin();
    }

    public AdminCatalog updateService(String id, ServiceChange c, String actor) {
        var before = jdbc.sql("select * from catalog.service where id = :id for update").param("id", id).query(this::service).optional()
            .orElseThrow(() -> ApiException.notFound("service " + id));
        checkVersion(before.version(), c.version());
        var s = validated(id, c, before);
        int order = c.order() == null ? before.order() : c.order();
        jdbc.sql("""
                update catalog.service set domain_code = :d, name = cast(:name as jsonb), scope = cast(:scope as jsonb), requesters = cast(:req as jsonb),
                       target = cast(:target as jsonb), keywords = cast(:kw as jsonb), frequency = :freq, status = :status, merged_into = :merged,
                       sort = :sort, version = version + 1, updated_at = :at, updated_by = :by where id = :id""")
            .param("d", s.domain()).param("name", write(s.name())).param("scope", write(s.scope())).param("req", write(s.requesters()))
            .param("target", write(s.target())).param("kw", write(s.keywords())).param("freq", s.frequency()).param("status", s.status())
            .param("merged", s.mergedInto()).param("sort", order).param("at", Timestamp.from(clock.instant())).param("by", actor).param("id", id).update();
        var changes = new ArrayList<FieldChange>();
        diff(changes, "status", before.status(), s.status());
        diff(changes, "domain", before.domain(), s.domain());
        diff(changes, "mergedInto", before.mergedInto(), s.mergedInto());
        diff(changes, "order", String.valueOf(before.order()), String.valueOf(order));
        diff(changes, "frequency", before.frequency(), s.frequency());
        for (var f : List.of("name", "scope", "requesters", "target", "keywords"))
            if (!s.text(f).equals(before.text(f))) changes.add(new FieldChange(f, null, null));
        log(actor, MessageRef.of("catalog.log.service", id), changes);
        return admin();
    }

    /** Replaces the Home dock: up to {@code usp.catalog.dock-max} services that employees can start now. */
    public AdminCatalog updateDock(DockChange c, String actor) {
        int version = jdbc.sql("select version from catalog.dock where id = 1 for update").query(Integer.class).single();
        checkVersion(version, c.version());
        var items = c.items() == null ? List.<DockItem>of() : c.items();
        if (items.size() > dockMax) throw ApiException.unprocessable("catalog.dockTooMany", dockMax);
        var seen = new HashSet<String>();
        var clean = new ArrayList<DockItem>();
        for (var i : items) {
            var id = Objects.requireNonNullElse(i.serviceId(), "");
            if (!seen.add(id)) throw ApiException.unprocessable("catalog.dockDuplicate", id);
            if (!startable(id, statusOf(id))) throw ApiException.unprocessable("catalog.dockNotAvailable", id);
            clean.add(new DockItem(id, required(i.label(), "label"), icon(i.icon()), tone(i.tone())));
        }
        var before = dockItems();
        jdbc.sql("delete from catalog.dock_item").update();
        int position = 1;
        for (var i : clean)
            jdbc.sql("insert into catalog.dock_item (position, service_id, label, icon, tone) values (:p, :s, cast(:l as jsonb), :i, :t)")
                .param("p", position++).param("s", i.serviceId()).param("l", write(i.label())).param("i", i.icon()).param("t", i.tone()).update();
        jdbc.sql("update catalog.dock set version = version + 1, updated_at = :at, updated_by = :by where id = 1")
            .param("at", Timestamp.from(clock.instant())).param("by", actor).update();
        var changes = new ArrayList<FieldChange>();
        diff(changes, "services", before.stream().map(DockItem::serviceId).collect(Collectors.joining(", ")),
            clean.stream().map(DockItem::serviceId).collect(Collectors.joining(", ")));
        if (!before.equals(clean) && changes.isEmpty()) changes.add(new FieldChange("labels", null, null));
        log(actor, MessageRef.of("catalog.log.dock"), changes);
        return admin();
    }

    /* ——— Rules ——— */

    /** A coded feature or a configured service exists for it, so it can be requested. */
    boolean runnable(String serviceId) {
        return codedServices.contains(serviceId) || definitions.find(serviceId).isPresent();
    }

    private boolean startable(String serviceId, String status) {
        return "available".equals(status) && runnable(serviceId);
    }

    /** A service's content, validated; {@code before} is null when it is being added. */
    private ServiceData validated(String id, ServiceChange c, ServiceRow before) {
        var domain = c.domain() == null ? "" : c.domain().strip();
        if (!jdbc.sql("select exists (select 1 from catalog.domain where code = :d)").param("d", domain).query(Boolean.class).single())
            throw ApiException.unprocessable("catalog.unknownDomain", domain);
        var status = c.status() == null ? "" : c.status();
        if (!STATUSES.contains(status)) throw ApiException.unprocessable("catalog.badStatus", status);
        var frequency = c.frequency() == null || c.frequency().isBlank() ? null : c.frequency();
        if (frequency != null && !FREQUENCIES.contains(frequency)) throw ApiException.unprocessable("catalog.badFrequency", frequency);
        String mergedInto = null;
        if ("merged".equals(status)) {
            mergedInto = c.mergedInto() == null ? "" : c.mergedInto().strip();
            var target = jdbc.sql("select status from catalog.service where id = :id").param("id", mergedInto).query(String.class).optional();
            if (mergedInto.equals(id) || target.isEmpty() || "merged".equals(target.get())) throw ApiException.unprocessable("catalog.mergeTarget");
            if (before != null && jdbc.sql("select exists (select 1 from catalog.service where merged_into = :id)").param("id", id).query(Boolean.class).single())
                throw ApiException.unprocessable("catalog.mergeTarget");
        }
        // Available means employees can start it now: it must be built or configured.
        if ("available".equals(status) && !runnable(id)) throw ApiException.unprocessable("catalog.notRunnable", id);
        // The Home dock only holds services employees can start; take it off the dock first.
        if (before != null && !"available".equals(status) && jdbc.sql("select exists (select 1 from catalog.dock_item where service_id = :id)")
            .param("id", id).query(Boolean.class).single())
            throw ApiException.unprocessable("catalog.inDock", id);
        return new ServiceData(domain, required(c.name(), "name"), text(c.scope(), "scope"), text(c.requesters(), "requesters"),
            text(c.target(), "target"), text(c.keywords(), "keywords"), frequency, status, mergedInto);
    }

    private String statusOf(String serviceId) {
        return jdbc.sql("select status from catalog.service where id = :id").param("id", serviceId).query(String.class).optional()
            .orElseThrow(() -> ApiException.notFound("service " + serviceId));
    }

    /** Language codes, trimmed values, blanks dropped, length limits per field. */
    private LocalizedText text(LocalizedText t, String field) {
        if (t == null) return LocalizedText.EMPTY;
        var out = new LinkedHashMap<String, String>();
        int max = MAX.get(field);
        t.values().forEach((lang, v) -> {
            if (!LANG.matcher(lang).matches()) throw ApiException.unprocessable("catalog.badLanguage", lang);
            var s = v.strip();
            if (s.length() > max) throw ApiException.unprocessable("catalog.textTooLong", messages.text("catalog.field." + field), max);
            if (!s.isEmpty()) out.put(lang, s);
        });
        return new LocalizedText(out);
    }

    private LocalizedText required(LocalizedText t, String field) {
        var v = text(t, field);
        if (v.isEmpty()) throw ApiException.unprocessable("catalog.textRequired", messages.text("catalog.field." + field));
        return v;
    }

    private static String icon(String icon) {
        if (icon == null || !ICON.matcher(icon).matches()) throw ApiException.unprocessable("catalog.badIcon");
        return icon;
    }

    private static String tone(String tone) {
        if (tone == null || tone.isBlank()) return null;
        if (!TONES.contains(tone)) throw ApiException.unprocessable("catalog.badTone");
        return tone;
    }

    private static void checkVersion(int current, Integer seen) {
        if (seen != null && seen != current) throw ApiException.conflict("catalog.stale");
    }

    private static void diff(List<FieldChange> out, String field, String from, String to) {
        if (!Objects.equals(from, to)) out.add(new FieldChange(field, from, to));
    }

    private void log(String actor, MessageRef what, List<FieldChange> changes) {
        jdbc.sql("insert into catalog.change_log (at, by, what, detail) values (:at, :by, cast(:w as jsonb), :d)")
            .param("at", Timestamp.from(clock.instant())).param("by", actor).param("w", json.writeValueAsString(what))
            .param("d", changes.isEmpty() ? "" : json.writeValueAsString(changes)).update();
    }

    /* ——— Rows ——— */

    private List<DomainRow> domains() {
        return jdbc.sql("select * from catalog.domain order by sort, code").query(this::domain).list();
    }

    private List<DockItem> dockItems() {
        return jdbc.sql("select * from catalog.dock_item order by position")
            .query((rs, n) -> new DockItem(rs.getString("service_id"), read(rs, "label"), rs.getString("icon"), rs.getString("tone"))).list();
    }

    private DomainRow domain(ResultSet rs, int n) throws SQLException {
        return new DomainRow(rs.getString("code"), read(rs, "name"), read(rs, "description"), rs.getString("icon"), rs.getString("tone"),
            rs.getInt("sort"), rs.getInt("version"), rs.getTimestamp("updated_at").toInstant());
    }

    private ServiceRow service(ResultSet rs, int n) throws SQLException {
        return new ServiceRow(rs.getString("id"), rs.getString("domain_code"), read(rs, "name"), read(rs, "scope"), read(rs, "requesters"),
            read(rs, "target"), read(rs, "keywords"), rs.getString("frequency"), rs.getString("status"), rs.getString("merged_into"),
            rs.getInt("sort"), rs.getInt("version"), rs.getTimestamp("updated_at").toInstant());
    }

    private LocalizedText read(ResultSet rs, String column) throws SQLException {
        return json.readValue(rs.getString(column), LocalizedText.class);
    }

    private String write(LocalizedText t) {
        return json.writeValueAsString(t);
    }

    private record DomainRow(String code, LocalizedText name, LocalizedText description, String icon, String tone, int order, int version,
                             Instant updatedAt) {}

    private record ServiceRow(String id, String domain, LocalizedText name, LocalizedText scope, LocalizedText requesters, LocalizedText target,
                              LocalizedText keywords, String frequency, String status, String mergedInto, int order, int version, Instant updatedAt) {

        LocalizedText text(String field) {
            return switch (field) {
                case "name" -> name;
                case "scope" -> scope;
                case "requesters" -> requesters;
                case "target" -> target;
                default -> keywords;
            };
        }
    }

    private record ServiceData(String domain, LocalizedText name, LocalizedText scope, LocalizedText requesters, LocalizedText target,
                               LocalizedText keywords, String frequency, String status, String mergedInto) {

        LocalizedText text(String field) {
            return switch (field) {
                case "name" -> name;
                case "scope" -> scope;
                case "requesters" -> requesters;
                case "target" -> target;
                default -> keywords;
            };
        }
    }

    private record LogRow(Instant at, String by, MessageRef what, String detail) {}
}
