package org.gcc.usp.platform.config;

import java.util.UUID;

/** Implemented by features whose requests capture a configuration version (D-009): such a version can no longer be reverted. */
public interface ConfigUsage {

    long uses(String kind, UUID versionId);
}
