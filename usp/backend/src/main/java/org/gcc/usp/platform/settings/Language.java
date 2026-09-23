package org.gcc.usp.platform.settings;

/** A portal language. {@code direction}: rtl | ltr. */
public record Language(String code, String nativeName, String direction, boolean enabled, boolean isDefault, int position) {}
