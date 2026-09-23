package org.gcc.usp.platform.config;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.gcc.usp.platform.config.ConfigService.Detail;
import org.gcc.usp.platform.config.ConfigService.Governance;
import org.gcc.usp.platform.config.ConfigService.Overview;
import org.gcc.usp.platform.config.VersionChain.Diff;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;

/** Versions of one configuration kind (leave, need, comms, designer…), for its policy center. */
@RestController
@RequestMapping("/api/v1/admin/config/{kind}")
class ConfigController {

    private final ConfigService config;

    ConfigController(ConfigService config) {
        this.config = config;
    }

    record NewDraft(UUID correctsId, String scope) {}

    record Content(JsonNode content, String why) {}

    record Scope(String scope) {}

    record Schedule(LocalDate from, String reason, String reference) {}

    record Note(String note) {}

    record Reason(String reason) {}

    @GetMapping
    Overview overview(@PathVariable String kind) {
        return config.overview(kind);
    }

    @GetMapping("/versions/{id}")
    Detail detail(@PathVariable String kind, @PathVariable UUID id) {
        return config.detail(kind, id);
    }

    @GetMapping("/versions/{id}/diff")
    List<Diff> diff(@PathVariable String kind, @PathVariable UUID id, @RequestParam UUID against) {
        return config.diff(kind, id, against);
    }

    @PostMapping("/versions")
    @ResponseStatus(HttpStatus.CREATED)
    Detail newDraft(@PathVariable String kind, @RequestBody(required = false) NewDraft body) {
        return body == null ? config.newDraft(kind, null, null) : config.newDraft(kind, body.correctsId(), body.scope());
    }

    @PutMapping("/versions/{id}/content")
    Detail content(@PathVariable String kind, @PathVariable UUID id, @RequestBody Content body) {
        return config.updateContent(kind, id, body.content(), body.why());
    }

    @PutMapping("/versions/{id}/scope")
    Detail scope(@PathVariable String kind, @PathVariable UUID id, @RequestBody Scope body) {
        return config.setScope(kind, id, body.scope());
    }

    @PostMapping("/versions/{id}/schedule")
    Detail schedule(@PathVariable String kind, @PathVariable UUID id, @RequestBody Schedule body) {
        return config.schedule(kind, id, body.from(), body.reason(), body.reference());
    }

    @PostMapping("/versions/{id}/cancel")
    Detail cancel(@PathVariable String kind, @PathVariable UUID id) {
        return config.cancel(kind, id);
    }

    @PostMapping("/versions/{id}/approve")
    Detail approve(@PathVariable String kind, @PathVariable UUID id, @RequestBody(required = false) Note body) {
        return config.approve(kind, id, body == null ? null : body.note());
    }

    @PostMapping("/versions/{id}/return")
    Detail returnToDraft(@PathVariable String kind, @PathVariable UUID id, @RequestBody Note body) {
        return config.returnToDraft(kind, id, body.note());
    }

    @PostMapping("/versions/{id}/revert")
    Detail revert(@PathVariable String kind, @PathVariable UUID id, @RequestBody Reason body) {
        return config.revert(kind, id, body.reason());
    }

    @PutMapping("/governance")
    Governance governance(@PathVariable String kind, @RequestBody Governance body) {
        return config.setGovernance(kind, body);
    }
}
