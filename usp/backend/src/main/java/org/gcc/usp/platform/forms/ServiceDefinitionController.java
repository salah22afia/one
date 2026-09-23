package org.gcc.usp.platform.forms;

import org.gcc.usp.platform.shared.ApiException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;

@RestController
class ServiceDefinitionController {

    private final ServiceDefinitions definitions;

    ServiceDefinitionController(ServiceDefinitions definitions) {
        this.definitions = definitions;
    }

    @GetMapping("/api/v1/services/{id}/definition")
    JsonNode definition(@PathVariable String id) {
        return definitions.find(id).orElseThrow(() -> ApiException.notFound("service " + id)).raw();
    }
}
