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

    /**
     * The exact version a request was submitted with (A1): its data is validated against that version only. Until the
     * admin config store keeps every version (§7.10), only the active one is available.
     */
    public Optional<ServiceDefinition> find(String id, int version) {
        return find(id).filter(d -> d.version() == version);
    }

    ServiceDefinition parse(JsonNode n) {
        return check(new ServiceDefinition(n.path("id").asString(), n.path("module").asString(), n.path("feature").asString(),
            n.path("version").asInt(1), json.treeToValue(n.path("name"), LocalizedText.class),
            n.hasNonNull("next") ? json.treeToValue(n.get("next"), LocalizedText.class) : null,
            n.hasNonNull("icon") ? n.get("icon").asString() : null,
            n.hasNonNull("withdraw") ? n.get("withdraw").asString() : ServiceDefinition.WITHDRAW_BEFORE_DECISION,
            list(n.path("fields"), ServiceDefinition.FieldDef[].class), list(n.path("rules"), ServiceDefinition.RuleDef[].class),
            list(n.path("workflow").path("steps"), ServiceDefinition.StepDef[].class), n));
    }

    /** Refuses a definition the runtime could not honour, at load time rather than on a live request. */
    private static ServiceDefinition check(ServiceDefinition def) {
        if (!List.of(ServiceDefinition.WITHDRAW_BEFORE_DECISION, ServiceDefinition.WITHDRAW_NEVER).contains(def.withdraw()))
            throw new IllegalStateException(def.id() + ": withdraw must be 'beforeDecision' or 'never', not '" + def.withdraw() + "'");
        for (var s : def.steps()) {
            if (s.decisions() == null) continue;
            var allowed = ServiceDefinition.DECISIONS.get(s.mode());
            if (allowed == null) throw new IllegalStateException(def.id() + "/" + s.key() + ": a " + s.mode() + " step takes no decisions");
            if (!allowed.containsAll(s.decisions()))
                throw new IllegalStateException(def.id() + "/" + s.key() + ": decisions " + s.decisions() + " are not all in " + allowed);
            if (!s.decisions().contains(allowed.getFirst()))
                throw new IllegalStateException(def.id() + "/" + s.key() + ": decisions must include '" + allowed.getFirst() + "'");
        }
        return def;
    }

    private <T> List<T> list(JsonNode n, Class<T[]> type) {
        return n.isArray() ? Arrays.asList(json.treeToValue(n, type)) : List.of();
    }
}
