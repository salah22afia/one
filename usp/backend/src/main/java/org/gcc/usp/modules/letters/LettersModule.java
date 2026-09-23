package org.gcc.usp.modules.letters;

import java.util.List;
import org.gcc.usp.platform.modules.FeatureDescriptor;
import org.gcc.usp.platform.modules.FeatureDescriptor.Kind;
import org.gcc.usp.platform.modules.ModuleDescriptor;
import org.gcc.usp.platform.shared.LocalizedText;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Module descriptor: key, catalogue code and features. New features are added by {@code pnpm gen:feature letters <feature>}. */
@Configuration
class LettersModule {

    @Bean
    ModuleDescriptor lettersDescriptor() {
        return new ModuleDescriptor("letters", "DC", LocalizedText.arEn("الخطابات والوثائق الرسمية", "Letters & Official Documents"), "doc", 40,
                List.of(
                        FeatureDescriptor.configured("letters.employment-letter", "DC-01", LocalizedText.arEn("خطاب تعريف", "Employment letter"))
                        // @gen:features
                ));
    }
}
