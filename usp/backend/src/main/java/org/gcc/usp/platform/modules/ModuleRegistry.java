package org.gcc.usp.platform.modules;

import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Service;

/**
 * Collects every {@link ModuleDescriptor} bean. Coded features self-register through their module's descriptor;
 * configured features will be merged in from the config store (MOD-03).
 */
@Service
public class ModuleRegistry {

    private final List<ModuleDescriptor> modules;

    ModuleRegistry(List<ModuleDescriptor> modules) {
        this.modules = modules.stream().sorted(Comparator.comparingInt(ModuleDescriptor::order)).toList();
    }

    public List<ModuleDescriptor> all() {
        return modules;
    }

    public Optional<ModuleDescriptor> find(String key) {
        return modules.stream().filter(m -> m.key().equals(key)).findFirst();
    }
}
