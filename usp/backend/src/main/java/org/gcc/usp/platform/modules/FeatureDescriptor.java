package org.gcc.usp.platform.modules;

import org.gcc.usp.platform.shared.LocalizedText;

/** A feature inside a module. {@code serviceId} is set for requestable services (e.g. TM-01), otherwise null. */
public record FeatureDescriptor(String key, String serviceId, Kind kind, Implementation implementation, LocalizedText name, Status status) {

    public enum Kind { SERVICE, VIEW, DESK, POLICY, INTEGRATION }

    public enum Implementation { CONFIGURED, CODED, HYBRID }

    public enum Status { AVAILABLE, WAVE_2, WAVE_3, LATER, HIDDEN }

    public static FeatureDescriptor coded(String key, String serviceId, Kind kind, LocalizedText name) {
        return new FeatureDescriptor(key, serviceId, kind, Implementation.CODED, name, Status.AVAILABLE);
    }

    public static FeatureDescriptor configured(String key, String serviceId, LocalizedText name) {
        return new FeatureDescriptor(key, serviceId, Kind.SERVICE, Implementation.CONFIGURED, name, Status.AVAILABLE);
    }
}
