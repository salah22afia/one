package org.gcc.usp.platform.catalog;

import java.time.Instant;
import java.util.List;
import org.gcc.usp.platform.org.OrgModel.PersonRef;
import org.gcc.usp.platform.shared.LocalizedText;

/** API shapes of the service catalogue: what employees browse, and what administrators edit. */
public final class CatalogViews {

    private CatalogViews() {}

    /* ——— Employees ——— */

    /** {@code tone}: the tile colour (g-green, g-gold, g-sage, g-bronze, g-teal) or null for the screen's default. */
    public record DomainView(String code, LocalizedText name, LocalizedText description, String icon, String tone, int order) {}

    /**
     * A listed service. {@code status}: available, wave2, wave3 or later. {@code startable}: available and actually
     * built or configured, so the apps open it; otherwise they show when it is coming.
     */
    public record ServiceView(String id, String domain, LocalizedText name, LocalizedText scope, LocalizedText requesters, LocalizedText target,
                              LocalizedText keywords, String status, boolean startable, int order) {}

    public record DockItem(String serviceId, LocalizedText label, String icon, String tone) {}

    /** {@code interested}: the coming services the viewer asked to be told about. */
    public record Catalog(List<DomainView> domains, List<ServiceView> services, List<DockItem> dock, List<String> interested) {}

    /* ——— Administrators ——— */

    public record AdminDomain(String code, LocalizedText name, LocalizedText description, String icon, String tone, int order, int version,
                              Instant updatedAt) {}

    /**
     * Every service, hidden and merged ones too. {@code runnable}: a coded feature or a configured service exists for it
     * (required to make it available); {@code inDock}: on the Home dock; {@code interested}: how many asked to be told.
     */
    public record AdminService(String id, String domain, LocalizedText name, LocalizedText scope, LocalizedText requesters, LocalizedText target,
                               LocalizedText keywords, String frequency, String status, String mergedInto, int order, int version,
                               boolean runnable, boolean inDock, int interested, Instant updatedAt) {}

    /** {@code max}: how many services the dock holds (deployment setting). */
    public record Dock(List<DockItem> items, int version, int max) {}

    /** One change: {@code changes} lists the fields that changed, with the old and new value where it is a code. */
    public record LogEntry(Instant at, PersonRef by, LocalizedText what, List<FieldChange> changes) {}

    public record FieldChange(String field, String from, String to) {}

    public record AdminCatalog(List<AdminDomain> domains, List<AdminService> services, Dock dock, List<LogEntry> log) {}

    /* ——— Changes ——— */

    public record DomainChange(LocalizedText name, LocalizedText description, String icon, String tone, Integer order, Integer version) {}

    /** A service's content; {@code id} only when adding one, {@code version} only when changing one. */
    public record ServiceChange(String id, String domain, LocalizedText name, LocalizedText scope, LocalizedText requesters, LocalizedText target,
                                LocalizedText keywords, String frequency, String status, String mergedInto, Integer order, Integer version) {}

    public record DockChange(List<DockItem> items, Integer version) {}
}
