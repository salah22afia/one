package org.gcc.usp.platform.org;

import java.util.List;
import org.gcc.usp.platform.shared.LocalizedText;

/** Org structure as SAP returns it. Levels, bottom-up: section, department, ga, sector, sg. */
public final class OrgModel {

    private OrgModel() {}

    public static final List<String> LEVELS = List.of("section", "department", "ga", "sector", "sg");

    public record Unit(String id, LocalizedText name, String level, String parentId, String chiefPositionId) {}

    /** {@code holder} is null when the position is vacant. */
    public record Position(String id, LocalizedText title, String unitId, Person holder, String deputyPositionId) {}

    public record Person(String employeeNo, LocalizedText name) {}

    /** An employee's primary assignment; {@code gender} (m|f) and {@code hireDate} (ISO) when SAP returns them. */
    public record Employee(String employeeNo, LocalizedText name, String positionId, String unitId, String gender, String hireDate) {}

    /** How a person is shown on timelines and inboxes: name and current position title (both from SAP). */
    public record PersonRef(String id, LocalizedText name, LocalizedText title) {}

    /** The signed-in user's positions, including those they currently act for (deputy / substitution). */
    public record Me(String employeeNo, List<String> positionIds, List<String> actingFor) {

        public boolean holdsAny(List<String> positions) {
            return positions.stream().anyMatch(p -> positionIds.contains(p) || actingFor.contains(p));
        }
    }

    public static int rank(String level) {
        return LEVELS.indexOf(level);
    }
}
