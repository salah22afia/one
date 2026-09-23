package org.gcc.usp.modules.mydata;

import java.util.List;
import org.gcc.usp.platform.modules.FeatureDescriptor;
import org.gcc.usp.platform.modules.FeatureDescriptor.Kind;
import org.gcc.usp.platform.modules.ModuleDescriptor;
import org.gcc.usp.platform.shared.LocalizedText;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Module descriptor: key, catalogue code and features. New features are added by {@code pnpm gen:feature mydata <feature>}. */
@Configuration
class MydataModule {

    @Bean
    ModuleDescriptor mydataDescriptor() {
        return new ModuleDescriptor("mydata", "MD", LocalizedText.arEn("بياناتي ومستنداتي", "My Data & Documents"), "person", 30,
                List.of(
                        FeatureDescriptor.coded("mydata.profile", null, Kind.VIEW, LocalizedText.arEn("ملفي", "My profile")),
                        FeatureDescriptor.configured("mydata.personal-data", "MD-01", LocalizedText.arEn("تحديث بياناتي الشخصية", "Update my personal data")),
                        FeatureDescriptor.configured("mydata.bank-account", "MD-02", LocalizedText.arEn("تغيير الحساب البنكي", "Change salary account")),
                        FeatureDescriptor.configured("mydata.document-update", "MD-05", LocalizedText.arEn("تحديث مستند", "Update a document"))
                        // @gen:features
                ));
    }
}
