package org.gcc.usp.platform.catalog;

import org.gcc.usp.platform.catalog.CatalogViews.Catalog;
import org.gcc.usp.platform.identity.CurrentUser;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * The catalogue for signed-in people: domains, listed services (search runs in the apps over this list, which stays
 * small), the Home dock, and "notify me when it is available" on coming services.
 */
@RestController
class CatalogController {

    private final CatalogService catalog;
    private final CurrentUser me;

    CatalogController(CatalogService catalog, CurrentUser me) {
        this.catalog = catalog;
        this.me = me;
    }

    @GetMapping("/api/v1/catalog")
    Catalog catalog() {
        return catalog.catalog(me.personId());
    }

    @PostMapping("/api/v1/catalog/services/{id}/interest")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void interested(@PathVariable String id) {
        catalog.registerInterest(id, me.personId());
    }

    @DeleteMapping("/api/v1/catalog/services/{id}/interest")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void notInterested(@PathVariable String id) {
        catalog.withdrawInterest(id, me.personId());
    }
}
