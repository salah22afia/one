package org.gcc.usp.platform.modules;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.gcc.usp.platform.shared.LocalizedText;
import org.junit.jupiter.api.Test;

class ModuleRegistryTest {

    @Test
    void ordersModulesAndFindsByKey() {
        var b = new ModuleDescriptor("b", "BB", LocalizedText.arEn("ب", "B"), "x", 20, List.of());
        var a = new ModuleDescriptor("a", "AA", LocalizedText.arEn("أ", "A"), "x", 10, List.of());
        var registry = new ModuleRegistry(List.of(b, a));

        assertThat(registry.all()).extracting(ModuleDescriptor::key).containsExactly("a", "b");
        assertThat(registry.find("b")).contains(b);
        assertThat(registry.find("zz")).isEmpty();
    }
}
