package org.gcc.usp.modules.finance;

import java.util.List;
import org.gcc.usp.platform.modules.FeatureDescriptor;
import org.gcc.usp.platform.modules.FeatureDescriptor.Kind;
import org.gcc.usp.platform.modules.ModuleDescriptor;
import org.gcc.usp.platform.shared.LocalizedText;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Module descriptor: key, catalogue code and features. New features are added by {@code pnpm gen:feature finance <feature>}. */
@Configuration
class FinanceModule {

    @Bean
    ModuleDescriptor financeDescriptor() {
        return new ModuleDescriptor("finance", "FN", LocalizedText.arEn("المعاملات المالية للموظف", "Employee Finance"), "wallet", 50,
                List.of(
                        FeatureDescriptor.configured("finance.business-trip", "FN-01", LocalizedText.arEn("الانتداب ومهمة العمل", "Business trip & assignment")),
                        FeatureDescriptor.coded("finance.payslips", null, Kind.VIEW, LocalizedText.arEn("راتبي", "My pay"))
                        // @gen:features
                ));
    }
}
