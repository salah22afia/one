package org.gcc.usp.modules.timeleave;

import java.util.List;
import org.gcc.usp.platform.modules.FeatureDescriptor;
import org.gcc.usp.platform.modules.FeatureDescriptor.Kind;
import org.gcc.usp.platform.modules.ModuleDescriptor;
import org.gcc.usp.platform.shared.LocalizedText;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Module descriptor: key, catalogue code and features. New features are added by {@code pnpm gen:feature timeleave <feature>}. */
@Configuration
class TimeleaveModule {

    @Bean
    ModuleDescriptor timeleaveDescriptor() {
        return new ModuleDescriptor("timeleave", "TM", LocalizedText.arEn("الوقت والإجازات", "Time & Leave"), "leave", 10,
                List.of(
                        FeatureDescriptor.coded("timeleave.leave-request", "TM-01", Kind.SERVICE, LocalizedText.arEn("طلب إجازة", "Leave request")),
                        FeatureDescriptor.coded("timeleave.leave-cancellation", "TM-01C", Kind.SERVICE, LocalizedText.arEn("إلغاء إجازة معتمدة", "Leave cancellation")),
                        FeatureDescriptor.coded("timeleave.leave-history", null, Kind.VIEW, LocalizedText.arEn("سجل إجازاتي", "Leave history")),
                        FeatureDescriptor.coded("timeleave.balances", null, Kind.VIEW, LocalizedText.arEn("أرصدتي", "My balances")),
                        FeatureDescriptor.coded("timeleave.leave-policy", null, Kind.POLICY, LocalizedText.arEn("سياسة الإجازات", "Leave policy")),
                        FeatureDescriptor.coded("timeleave.leave-operations", null, Kind.POLICY, LocalizedText.arEn("تشغيل الإجازات", "Leave operations"))
                        // @gen:features
                ));
    }
}
