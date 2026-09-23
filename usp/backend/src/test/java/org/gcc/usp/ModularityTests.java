package org.gcc.usp;

import org.junit.jupiter.api.Test;
import org.springframework.modulith.core.ApplicationModules;
import org.springframework.modulith.docs.Documenter;

/** Fails the build on module cycles or on access to another module's internals (MOD-08). */
class ModularityTests {

    private final ApplicationModules modules = ApplicationModules.of(UspApplication.class);

    @Test
    void verifiesModuleBoundaries() {
        modules.verify();
    }

    @Test
    void writesModuleDocumentation() {
        new Documenter(modules).writeDocumentation();
    }
}
