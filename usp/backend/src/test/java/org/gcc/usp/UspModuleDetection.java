package org.gcc.usp;

import java.util.stream.Stream;
import org.springframework.modulith.core.ApplicationModuleDetectionStrategy;
import org.springframework.modulith.core.JavaPackage;

/**
 * Application modules live two levels below the root: {@code platform.<module>} and {@code modules.<module>}.
 * Registered in {@code META-INF/spring.factories}.
 */
public class UspModuleDetection implements ApplicationModuleDetectionStrategy {

    @Override
    public Stream<JavaPackage> getModuleBasePackages(JavaPackage basePackage) {
        return basePackage.getDirectSubPackages().stream()
                .filter(p -> p.getLocalName().equals("platform") || p.getLocalName().equals("modules"))
                .flatMap(p -> p.getDirectSubPackages().stream());
    }
}
