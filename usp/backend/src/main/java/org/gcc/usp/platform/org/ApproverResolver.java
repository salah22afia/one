package org.gcc.usp.platform.org;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.gcc.usp.platform.org.OrgModel.Position;
import org.gcc.usp.platform.org.OrgModel.Unit;
import org.gcc.usp.platform.shared.MessageRef;
import org.springframework.stereotype.Service;

/**
 * Who acts on a step (CAP-01, D-012): the approver is a position resolved from the SAP org structure when the step
 * opens. A vacant position falls to its deputy, then to its superior; the requester never approves their own request.
 * The result is the positions the step waits on (stored by the workflow) plus a readable reason.
 */
@Service
public class ApproverResolver {

    private static final int MAX_DEPTH = 12;

    private final OrgDirectory org;

    ApproverResolver(OrgDirectory org) {
        this.org = org;
    }

    public Resolution resolve(AgentRule rule, String requesterNo) {
        return switch (rule.kind()) {
            case "requester" -> new Resolution(List.of(requesterNo), List.of(), MessageRef.of("org.requester"));
            case "pool" -> pool(rule.unitId(), requesterNo);
            case "lineManager" -> lineManager(requesterNo);
            case "orgHead" -> orgHead(requesterNo, rule.level() == null ? "department" : rule.level());
            case "positions" -> positions(rule.positionIds() == null ? List.of() : rule.positionIds(), requesterNo);
            default -> throw new IllegalArgumentException("Agent rule '" + rule.kind() + "' is not supported yet");
        };
    }

    /** Every holder of every position in the unit, except the requester; the first to act decides. No fallback. */
    private Resolution pool(String unitId, String requesterNo) {
        var unit = org.unit(unitId).orElseThrow(() -> new IllegalArgumentException("Unknown unit " + unitId));
        var positions = org.positionsOf(unitId);
        var people = positions.stream().filter(p -> p.holder() != null && !p.holder().employeeNo().equals(requesterNo))
            .map(p -> p.holder().employeeNo()).distinct().toList();
        return new Resolution(people, positions.stream().map(Position::id).toList(), MessageRef.of("org.pool", unit.name()));
    }

    /** Chief of the requester's unit; when the requester is that chief, the chief of the parent unit. */
    private Resolution lineManager(String requesterNo) {
        var me = org.employee(requesterNo).orElseThrow(() -> new IllegalArgumentException("Unknown employee " + requesterNo));
        var unit = org.unit(me.unitId()).orElseThrow(() -> new IllegalStateException(requesterNo + " has no unit"));
        var chief = unit.chiefPositionId();
        if (chief == null || chief.equals(me.positionId())) chief = unit.parentId() == null ? null : org.unit(unit.parentId()).map(Unit::chiefPositionId).orElse(null);
        if (chief == null) return new Resolution(List.of(), List.of(), MessageRef.of("org.noLineManager"));
        return fromHolder(chief, requesterNo, "org.lineManager");
    }

    /** Head of the first unit at or above {@code level}, walking up from the requester's unit. */
    private Resolution orgHead(String requesterNo, String level) {
        var me = org.employee(requesterNo).orElseThrow(() -> new IllegalArgumentException("Unknown employee " + requesterNo));
        var target = OrgModel.rank(level);
        var unit = org.unit(me.unitId()).orElse(null);
        for (int i = 0; unit != null && i < MAX_DEPTH; i++) {
            if (OrgModel.rank(unit.level()) >= target && unit.chiefPositionId() != null) return fromHolder(unit.chiefPositionId(), requesterNo, "org.orgHead");
            unit = unit.parentId() == null ? null : org.unit(unit.parentId()).orElse(null);
        }
        return new Resolution(List.of(), List.of(), MessageRef.of("org.noLineManager"));
    }

    private Resolution positions(List<String> ids, String requesterNo) {
        var people = new LinkedHashSet<String>();
        var acting = new ArrayList<String>();
        var titles = new ArrayList<Object>();
        for (var id : ids) {
            var h = holder(id, requesterNo);
            if (h.employeeNo() != null) people.add(h.employeeNo());
            acting.add(h.positionId());
            org.position(id).ifPresent(p -> titles.add(p.title()));
        }
        return new Resolution(List.copyOf(people), acting, MessageRef.of("org.positions", titles.isEmpty() ? "" : titles.getFirst()));
    }

    private Resolution fromHolder(String positionId, String requesterNo, String key) {
        var h = holder(positionId, requesterNo);
        var title = org.position(positionId).map(Position::title).orElse(null);
        return new Resolution(h.employeeNo() == null ? List.of() : List.of(h.employeeNo()), List.of(h.positionId()),
            MessageRef.of(key + h.via(), title == null ? positionId : title));
    }

    /** holder → deputy (recursively) → superior (recursively); the requester is never chosen; cycles are cut. */
    Holder holder(String positionId, String excludeNo) {
        return holder(positionId, excludeNo, new HashSet<>());
    }

    private Holder holder(String positionId, String excludeNo, Set<String> visited) {
        if (!visited.add(positionId) || visited.size() > MAX_DEPTH) return new Holder(null, positionId, ".noHolder");
        var pos = org.position(positionId).orElseThrow(() -> new IllegalArgumentException("Unknown position " + positionId));
        if (pos.holder() != null && !pos.holder().employeeNo().equals(excludeNo)) return new Holder(pos.holder().employeeNo(), positionId, "");
        if (pos.deputyPositionId() != null) {
            var d = holder(pos.deputyPositionId(), excludeNo, visited);
            if (d.employeeNo() != null) return new Holder(d.employeeNo(), d.positionId(), ".acting");
        }
        var superior = superiorOf(pos);
        if (superior == null) return new Holder(null, positionId, ".noHolder");
        var s = holder(superior, excludeNo, visited);
        return s.employeeNo() == null ? new Holder(null, positionId, ".noHolder") : new Holder(s.employeeNo(), s.positionId(), ".superior");
    }

    /** Chief of the position's unit; if the position is that chief, the chief of the parent unit. */
    private String superiorOf(Position pos) {
        var unit = org.unit(pos.unitId()).orElse(null);
        if (unit == null) return null;
        if (unit.chiefPositionId() != null && !unit.chiefPositionId().equals(pos.id())) return unit.chiefPositionId();
        return unit.parentId() == null ? null : org.unit(unit.parentId()).map(Unit::chiefPositionId).orElse(null);
    }

    /** {@code via}: "" (holder), ".acting", ".superior" or ".noHolder" — suffix of the reason's message key. */
    record Holder(String employeeNo, String positionId, String via) {}
}
