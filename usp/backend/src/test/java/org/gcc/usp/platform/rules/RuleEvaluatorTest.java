package org.gcc.usp.platform.rules;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.stream.Stream;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Same fixtures as packages/forms-core (rules-parity.test.ts): server and clients must agree on every rule (A11). */
class RuleEvaluatorTest {

    private static final JsonMapper JSON = JsonMapper.builder().build();
    private final RuleEvaluator rules = new RuleEvaluator();

    static Stream<JsonNode> fixtures() throws Exception {
        var all = JSON.readTree(Files.readString(Path.of("../packages/forms-core/fixtures/rules.json")));
        return java.util.stream.StreamSupport.stream(all.spliterator(), false);
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("fixtures")
    void matchesJsonLogicJs(JsonNode c) {
        Map<String, Object> data = JSON.convertValue(c.get("data"), new TypeReference<>() {});
        assertThat(rules.holds(c.get("rule"), data)).as(c.get("name").asString()).isEqualTo(c.get("expected").asBoolean());
    }
}
