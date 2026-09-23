package org.gcc.usp.platform.catalog;

import org.gcc.usp.platform.catalog.CatalogViews.AdminCatalog;
import org.gcc.usp.platform.catalog.CatalogViews.DockChange;
import org.gcc.usp.platform.catalog.CatalogViews.DomainChange;
import org.gcc.usp.platform.catalog.CatalogViews.ServiceChange;
import org.gcc.usp.platform.identity.CurrentUser;
import org.gcc.usp.platform.shared.ApiException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Platform administrators manage the catalogue: domains, services and their wave, the Home dock. Every change takes
 * effect at once, is logged, and carries the version the administrator saw (409 when someone changed it meanwhile).
 */
@RestController
@RequestMapping("/api/v1/admin/catalog")
class CatalogAdminController {

    private final CatalogService catalog;
    private final CurrentUser me;

    CatalogAdminController(CatalogService catalog, CurrentUser me) {
        this.catalog = catalog;
        this.me = me;
    }

    @GetMapping
    AdminCatalog get() {
        requireAdmin();
        return catalog.admin();
    }

    @PutMapping("/domains/{code}")
    AdminCatalog domain(@PathVariable String code, @RequestBody DomainChange body) {
        return catalog.updateDomain(code, body, requireAdmin());
    }

    @PostMapping("/services")
    AdminCatalog add(@RequestBody ServiceChange body) {
        return catalog.addService(body, requireAdmin());
    }

    @PutMapping("/services/{id}")
    AdminCatalog service(@PathVariable String id, @RequestBody ServiceChange body) {
        return catalog.updateService(id, body, requireAdmin());
    }

    @PutMapping("/dock")
    AdminCatalog dock(@RequestBody DockChange body) {
        return catalog.updateDock(body, requireAdmin());
    }

    /** Platform administrators only (catalogue roles by SAP position come with the roles slice). Returns who acts. */
    private String requireAdmin() {
        if (!me.isPlatformAdmin()) throw ApiException.forbidden();
        return me.personId();
    }
}
