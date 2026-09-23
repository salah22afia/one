package org.gcc.usp.platform.requests;

import java.util.List;
import java.util.Map;
import org.gcc.usp.platform.identity.CurrentUser;
import org.gcc.usp.platform.requests.RequestViews.RequestDetail;
import org.gcc.usp.platform.requests.RequestViews.RequestView;
import org.gcc.usp.platform.requests.RequestViews.TaskItem;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
class RequestController {

    private final RequestService requests;
    private final CurrentUser me;

    RequestController(RequestService requests, CurrentUser me) {
        this.requests = requests;
        this.me = me;
    }

    record Submit(String serviceId, Map<String, Object> data, String channel) {}

    record Decision(String action, String note, String ref) {}

    @PostMapping("/api/v1/requests")
    @ResponseStatus(HttpStatus.CREATED)
    RequestDetail submit(@RequestBody Submit body) {
        return requests.submit(body.serviceId(), body.data(), body.channel(), me.personId());
    }

    @GetMapping("/api/v1/requests")
    List<RequestView> mine() {
        return requests.mine(me.personId());
    }

    @GetMapping("/api/v1/requests/{id}")
    RequestDetail detail(@PathVariable String id) {
        return requests.detail(id, me.personId());
    }

    @GetMapping("/api/v1/tasks")
    List<TaskItem> tasks() {
        return requests.tasks(me.personId());
    }

    @PostMapping("/api/v1/tasks/{stepId}/decision")
    RequestDetail decide(@PathVariable long stepId, @RequestBody Decision body) {
        return requests.decide(stepId, me.personId(), body.action(), body.note(), body.ref());
    }
}
