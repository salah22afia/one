package org.gcc.usp.platform.modules;

import java.util.List;
import org.gcc.usp.platform.shared.LocalizedText;

/**
 * A business module: the unit of categorisation (catalogue, navigation, permissions, admin, reports).
 * Each business module publishes one as a bean from its {@code *Module} class.
 */
public record ModuleDescriptor(String key, String catalogCode, LocalizedText name, String icon, int order, List<FeatureDescriptor> features) {}
