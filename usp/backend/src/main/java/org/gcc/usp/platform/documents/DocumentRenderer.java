package org.gcc.usp.platform.documents;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel;
import java.io.IOException;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.chrono.HijrahChronology;
import java.time.chrono.HijrahDate;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.Locale;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.thymeleaf.ITemplateEngine;
import org.thymeleaf.context.Context;

/**
 * Renders an issued document to standalone HTML (inline fonts, emblem and QR) in the official layout of the prototype
 * (P-13). The same HTML is printed by the browser or converted to PDF by Gotenberg.
 */
@Component
class DocumentRenderer {

    private static final ZoneId ZONE = ZoneId.of("Asia/Riyadh");
    private static final DateTimeFormatter GREG = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter HIJRI_AR = DateTimeFormatter.ofPattern("d MMMM yyyy", Locale.forLanguageTag("ar")).withChronology(HijrahChronology.INSTANCE);
    private static final DateTimeFormatter LONG_EN = DateTimeFormatter.ofPattern("d MMMM yyyy", Locale.ENGLISH);
    private static final DateTimeFormatter LONG_AR = DateTimeFormatter.ofPattern("d MMMM yyyy", Locale.forLanguageTag("ar"));

    private final ITemplateEngine templates;
    private final DocumentService documents;
    private final String publicBaseUrl;
    private final String emblem;
    private final String fontCss;

    DocumentRenderer(ITemplateEngine templates, DocumentService documents, @Value("${usp.documents.public-base-url}") String publicBaseUrl) throws IOException {
        this.templates = templates;
        this.documents = documents;
        this.publicBaseUrl = publicBaseUrl.replaceAll("/$", "");
        this.emblem = dataUri("emblem.png", "image/png");
        this.fontCss = """
            @font-face { font-family: 'Cairo'; font-weight: 200 1000; src: url(%s) format('woff2'); unicode-range: U+0600-06FF, U+0750-077F, U+08A0-08FF, U+FB50-FDFF, U+FE70-FEFF, U+200C-200E; }
            @font-face { font-family: 'Cairo'; font-weight: 200 1000; src: url(%s) format('woff2'); unicode-range: U+0000-00FF, U+2000-206F, U+20AC, U+2122; }
            """.formatted(dataUri("cairo-arabic-wght-normal.woff2", "font/woff2"), dataUri("cairo-latin-wght-normal.woff2", "font/woff2"));
    }

    @SuppressWarnings("unchecked")
    String html(DocumentView doc) {
        Map<String, Object> p = documents.payload(doc.id());
        var data = (Map<String, Object>) p.getOrDefault("data", Map.of());
        var holder = (Map<String, Object>) p.get("holder");
        var lang = String.valueOf(data.getOrDefault("lang", "ar"));
        var issued = LocalDate.ofInstant(Instant.parse((String) p.get("issuedAt")), ZONE);
        var hired = holder.get("hiredAt") == null ? null : LocalDate.parse((String) holder.get("hiredAt"));
        var salary = holder.get("monthlySalary") == null ? null : new BigDecimal(holder.get("monthlySalary").toString());
        var verifyUrl = publicBaseUrl + "/verify/" + doc.verifyCode();

        var ctx = new Context(Locale.forLanguageTag("ar"));
        ctx.setVariable("doc", doc);
        ctx.setVariable("p", p);
        ctx.setVariable("data", data);
        ctx.setVariable("holder", holder);
        ctx.setVariable("signer", p.get("signer"));
        ctx.setVariable("showAr", !"en".equals(lang));
        ctx.setVariable("showEn", !"ar".equals(lang));
        ctx.setVariable("dir", "en".equals(lang) ? "ltr" : "rtl");
        ctx.setVariable("female", "f".equals(holder.get("gender")));
        ctx.setVariable("issuedGreg", GREG.format(issued));
        ctx.setVariable("issuedHijri", HIJRI_AR.format(HijrahDate.from(issued)));
        ctx.setVariable("hiredAr", hired == null ? "" : LONG_AR.format(hired));
        ctx.setVariable("hiredEn", hired == null ? "" : LONG_EN.format(hired));
        ctx.setVariable("salary", salary == null ? null : "%,.2f".formatted(salary));
        ctx.setVariable("verifyUrl", verifyUrl);
        ctx.setVariable("qr", qrSvg(verifyUrl));
        ctx.setVariable("emblem", emblem);
        ctx.setVariable("fontCss", fontCss);
        return templates.process("documents/" + doc.template(), ctx);
    }

    /** QR as inline SVG (one path), so the HTML stays self-contained for printing and PDF. */
    static String qrSvg(String text) {
        try {
            var m = new QRCodeWriter().encode(text, BarcodeFormat.QR_CODE, 0, 0, Map.of(EncodeHintType.ERROR_CORRECTION, ErrorCorrectionLevel.M, EncodeHintType.MARGIN, 0));
            var d = new StringBuilder();
            for (int y = 0; y < m.getHeight(); y++) for (int x = 0; x < m.getWidth(); x++) if (m.get(x, y)) d.append('M').append(x).append(' ').append(y).append("h1v1h-1z");
            return "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 %d %d' shape-rendering='crispEdges'><path fill='#0b4a2f' d='%s'/></svg>".formatted(m.getWidth(), m.getHeight(), d);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private static String dataUri(String asset, String type) throws IOException {
        try (var in = new ClassPathResource("documents/assets/" + asset).getInputStream()) {
            return "data:" + type + ";base64," + Base64.getEncoder().encodeToString(in.readAllBytes());
        }
    }

}
