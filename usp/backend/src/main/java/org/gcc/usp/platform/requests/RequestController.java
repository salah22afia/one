package org.gcc.usp.platform.requests;

import java.util.List;
import java.util.Map;
import org.gcc.usp.platform.identity.CurrentUser;
import org.gcc.usp.platform.requests.RequestViews.DonePage;
import org.gcc.usp.platform.requests.RequestViews.RequestDetail;
import org.gcc.usp.platform.requests.RequestViews.RequestPage;
import org.gcc.usp.platform.requests.RequestViews.TaskItem;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Requests and tasks. Every action is checked on the server against the signed-in user: only the requester withdraws or
 * resubmits, only a current holder of the step decides (never on their own request). {@code version}: the request
 * version the screen showed; if it changed meanwhile the action is refused with 409 and the screen reloads.
 */
@RestController
class RequestController {

    private final RequestService requests;
    private final CurrentUser me;

    RequestController(RequestService requests, CurrentUser me) {
        this.requests = requests;
        this.me = me;
    }

    record Submit(String serviceId, Map<String, Object> data, String channel) {}

    record Decision(String action, String note, String ref, Integer version) {}

    record Resubmit(Map<String, Object> data, Integer version) {}

    record Withdraw(Integer version) {}

    @PostMapping("/api/v1/requests")
    @ResponseStatus(HttpStatus.CREATED)
    RequestDetail submit(@RequestBody Submit body) {
        return requests.submit(body.serviceId(), body.data(), body.channel(), me.personId());
    }

    /** {@code view}: ongoing (returned first, then in review) or finished; {@code cursor}: the previous page's {@code next}. */
    @GetMapping("/api/v1/requests")
    RequestPage mine(@RequestParam(defaultValue = "ongoing") String view, @RequestParam(required = false) String cursor,
                     @RequestParam(required = false) Integer limit) {
        return requests.mine(me.personId(), view, cursor, limit);
    }

    @GetMapping("/api/v1/requests/{id}")
    RequestDetail detail(@PathVariable String id) {
        return requests.detail(id, me.personId());
    }

    @PostMapping("/api/v1/requests/{id}/resubmit")
    RequestDetail resubmit(@PathVariable String id, @RequestBody Resubmit body) {
        return requests.resubmit(id, body.data(), body.version(), me.personId());
    }

    @PostMapping("/api/v1/requests/{id}/withdraw")
    RequestDetail withdraw(@PathVariable String id, @RequestBody Withdraw body) {
        // A JSON body is required (even {}), like every other change: cross-site forms cannot send one.
        return requests.withdraw(id, body.version(), me.personId());
    }

    @GetMapping("/api/v1/tasks")
    List<TaskItem> tasks() {
        return requests.tasks(me.personId());
    }

    @GetMapping("/api/v1/tasks/done")
    DonePage done(@RequestParam(required = false) String cursor, @RequestParam(required = false) Integer limit) {
        return requests.done(me.personId(), cursor, limit);
    }

    @PostMapping("/api/v1/tasks/{stepId}/decision")
    RequestDetail decide(@PathVariable long stepId, @RequestBody Decision body) {
        return requests.decide(stepId, me.personId(), body.action(), body.note(), body.ref(), body.version());
    }
}
