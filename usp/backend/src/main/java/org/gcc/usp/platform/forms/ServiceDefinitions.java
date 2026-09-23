package org.gcc.usp.platform.forms;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;
import org.gcc.usp.platform.shared.LocalizedText;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Active versions of configured services. Loaded from the source-controlled config packages
 * ({@code config-packages/<module>/<feature>/service.json}) until the admin config store (§7.10) replaces this.
 */
@Service
public class ServiceDefinitions {

    private static final Logger log = LoggerFactory.getLogger(ServiceDefinitions.class);
    private final Map<String, ServiceDefinition> byId = new TreeMap<>();
    private final JsonMapper json;

    ServiceDefinitions(JsonMapper json, @Value("${usp.config-packages.dir}") String dirSetting) throws IOException {
        var dir = Path.of(dirSetting); // a plain string: Path injection would resolve it as a servlet resource under Tomcat
        this.json = json;
        if (!Files.isDirectory(dir)) throw new IllegalStateException("usp.config-packages.dir not found: " + dir.toAbsolutePath());
        try (var files = Files.walk(dir)) {
            for (var f : files.filter(p -> p.getFileName().toString().equals("service.json")).sorted().toList()) {
                var def = parse(json.readTree(Files.readString(f)));
                if (byId.put(def.id(), def) != null) throw new IllegalStateException("Duplicate service id " + def.id() + " in " + f);
            }
        }
        log.info("Loaded {} configured services from {}: {}", byId.size(), dir.toAbsolutePath().normalize(), byId.keySet());
    }

    public Optional<ServiceDefinition> find(String id) {
        return Optional.ofNullable(byId.get(id));
    }

    ServiceDefinition parse(JsonNode n) {
        return new ServiceDefinition(n.path("id").asString(), n.path("module").asString(), n.path("feature").asString(),
            n.path("version").asInt(1), json.treeToValue(n.path("name"), LocalizedText.class),
            n.hasNonNull("next") ? json.treeToValue(n.get("next"), LocalizedText.class) : null,
            list(n.path("fields"), ServiceDefinition.FieldDef[].class), list(n.path("rules"), ServiceDefinition.RuleDef[].class),
            list(n.path("workflow").path("steps"), ServiceDefinition.StepDef[].class), n);
    }

    private <T> List<T> list(JsonNode n, Class<T[]> type) {
        return n.isArray() ? Arrays.asList(json.treeToValue(n, type)) : List.of();
    }
}
