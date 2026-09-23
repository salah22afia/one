package org.gcc.usp.platform.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.gcc.usp.platform.config.ConfigVersion.Status;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

class VersionChainTest {

    static final JsonMapper JSON = JsonMapper.builder().build();
    static final LocalDate TODAY = LocalDate.of(2026, 9, 22);

    static JsonNode j(String s) {
        return JSON.readTree(s.replace('\'', '"'));
    }

    static ConfigVersion v(LocalDate from, Instant created, JsonNode content) {
        return new ConfigVersion(UUID.randomUUID(), "t", "x", from, true, false, "1", created, "", "", content, List.of(),
            null, null, null, null, null, null);
    }

    @Test
    void diffKeysListItemsByIdAndNamesTheObject() {
        var a = j("{'types':[{'id':'A','days':30},{'id':'B','days':5}],'calendar':{'weekend':[5,6]}}");
        var b = j("{'types':[{'id':'B','days':7},{'id':'A','days':30}],'calendar':{'weekend':[5,6]}}");
        var d = VersionChain.diff(a, b);
        assertThat(d).singleElement().satisfies(x -> {
            assertThat(x.path()).isEqualTo("types.B.days");
            assertThat(x.object()).isEqualTo("types.B");
            assertThat(x.before()).isEqualTo("5");
            assertThat(x.after()).isEqualTo("7");
        });
        assertThat(VersionChain.diff(a, j("{'types':[{'id':'A','days':30},{'id':'B','days':5}],'calendar':{'weekend':[6]}}")))
            .extracting(VersionChain.Diff::object).containsOnly("calendar");
        assertThat(VersionChain.sameObject("types", "types.B")).isTrue();
        assertThat(VersionChain.sameObject("types.A", "types.B")).isFalse();
    }

    @Test
    void sameDayCorrectionReplacesAndLaterVersionExpires() {
        var t0 = Instant.parse("2026-01-01T00:00:00Z");
        var v1 = v(TODAY.minusDays(10), t0, j("{}"));
        var fix = v(TODAY.minusDays(10), t0.plusSeconds(60), j("{}"));
        var v2 = v(TODAY.plusDays(3), t0.plusSeconds(120), j("{}"));
        var all = List.of(v1, fix, v2);
        assertThat(VersionChain.status(v1, all, TODAY)).isEqualTo(Status.CORRECTED);
        assertThat(VersionChain.status(fix, all, TODAY)).isEqualTo(Status.ACTIVE);
        assertThat(VersionChain.status(v2, all, TODAY)).isEqualTo(Status.SCHEDULED);
        assertThat(VersionChain.on(all, TODAY)).contains(fix);
        assertThat(VersionChain.tip(all)).contains(v2);
        assertThat(VersionChain.endOf(fix, all)).contains(TODAY.plusDays(2));
        assertThat(VersionChain.status(fix, all, TODAY.plusDays(3))).isEqualTo(Status.EXPIRED);
    }

    @Test
    void rebaseCarriesOnlyTheDraftsObjects() {
        var tip = v(TODAY, Instant.now(), j("{'items':[{'id':'a','v':1},{'id':'b','v':2}],'rules':{'x':2}}"));
        var plan = new VersionChain.RebasePlan(true, null, tip, java.util.Set.of("items.a", "items.c", "rules"), List.of());
        var draft = j("{'items':[{'id':'a','v':9},{'id':'c','v':3}],'rules':{'x':1}}");
        assertThat(VersionChain.rebased(plan, draft))
            .isEqualTo(j("{'items':[{'id':'a','v':9},{'id':'b','v':2},{'id':'c','v':3}],'rules':{'x':1}}"));
    }
}
