package org.gcc.usp.modules.needs;

import java.util.List;
import org.gcc.usp.platform.modules.FeatureDescriptor;
import org.gcc.usp.platform.modules.FeatureDescriptor.Kind;
import org.gcc.usp.platform.modules.ModuleDescriptor;
import org.gcc.usp.platform.shared.LocalizedText;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Module descriptor: key, catalogue code and features. New features are added by {@code pnpm gen:feature needs <feature>}. */
@Configuration
class NeedsModule {

    @Bean
    ModuleDescriptor needsDescriptor() {
        return new ModuleDescriptor("needs", "AS", LocalizedText.arEn("الاحتياج والعهد والأصول", "Needs, Custody & Assets"), "box", 20,
                List.of(
                        FeatureDescriptor.coded("needs.need-request", "AS-01", Kind.SERVICE, LocalizedText.arEn("أحتاج شيئاً", "I need something")),
                        FeatureDescriptor.coded("needs.specification", null, Kind.DESK, LocalizedText.arEn("تحديد الصنف", "Specification")),
                        FeatureDescriptor.coded("needs.store", null, Kind.DESK, LocalizedText.arEn("مكتب المستودع", "Store desk")),
                        FeatureDescriptor.coded("needs.procurement", null, Kind.DESK, LocalizedText.arEn("مكتب المشتريات", "Procurement desk")),
                        FeatureDescriptor.coded("needs.budget", null, Kind.DESK, LocalizedText.arEn("الموازنة", "Budget")),
                        FeatureDescriptor.coded("needs.receipt", null, Kind.DESK, LocalizedText.arEn("الاستلام", "Receipt")),
                        FeatureDescriptor.coded("needs.handover", null, Kind.DESK, LocalizedText.arEn("التسليم", "Handover")),
                        FeatureDescriptor.coded("needs.custody", "AS-02", Kind.VIEW, LocalizedText.arEn("عهدتي", "My custody")),
                        FeatureDescriptor.coded("needs.needs-policy", null, Kind.POLICY, LocalizedText.arEn("سياسة الاحتياج", "Needs policy"))
                        // @gen:features
                ));
    }
}
