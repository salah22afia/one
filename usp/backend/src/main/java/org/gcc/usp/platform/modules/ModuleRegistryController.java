package org.gcc.usp.platform.modules;

import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/modules")
class ModuleRegistryController {

    private final ModuleRegistry registry;

    ModuleRegistryController(ModuleRegistry registry) {
        this.registry = registry;
    }

    @GetMapping
    List<ModuleDescriptor> list() {
        return registry.all();
    }

    @GetMapping("/{key}")
    ResponseEntity<ModuleDescriptor> get(@PathVariable String key) {
        return ResponseEntity.of(registry.find(key));
    }
}
