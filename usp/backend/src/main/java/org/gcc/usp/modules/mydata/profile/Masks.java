package org.gcc.usp.modules.mydata.profile;

/** How My data shows contact and bank details: enough to recognise them, never the whole value (as the prototype). */
final class Masks {

    private static final String DOT = "•";

    private Masks() {}

    /** +966512345412 → "+966 5• ••• •412"; a number without a country code keeps its first digit and last three. */
    static String mobile(String value) {
        if (value == null || value.isBlank()) return null;
        var digits = value.replaceAll("[^0-9]", "");
        if (digits.length() < 7) return DOT.repeat(digits.length());
        var international = value.strip().startsWith("+") && digits.length() > 9;
        var cc = international ? digits.substring(0, digits.length() - 9) : "";
        var local = digits.substring(cc.length());
        return (cc.isEmpty() ? "" : "+" + cc + " ") + local.charAt(0) + DOT + " " + DOT.repeat(3) + " " + DOT + local.substring(local.length() - 3);
    }

    /** SA0380000000608010167519 → "SA•• •••• 7519". */
    static String iban(String value) {
        if (value == null || value.isBlank()) return null;
        var s = value.replaceAll("\\s", "").toUpperCase();
        if (s.length() < 8) return DOT.repeat(4);
        return s.substring(0, 2) + DOT.repeat(2) + " " + DOT.repeat(4) + " " + s.substring(s.length() - 4);
    }
}
