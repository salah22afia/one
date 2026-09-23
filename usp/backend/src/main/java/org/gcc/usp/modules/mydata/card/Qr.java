package org.gcc.usp.modules.mydata.card;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.WriterException;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel;
import java.util.Map;

/**
 * A QR code as one SVG path over a {@code size}×{@code size} grid (as the prototype's QR component draws it), so the
 * apps render it with their own colours and no HTML is passed around.
 */
record Qr(int size, String path) {

    static Qr of(String text) {
        try {
            var m = new QRCodeWriter().encode(text, BarcodeFormat.QR_CODE, 0, 0,
                Map.of(EncodeHintType.ERROR_CORRECTION, ErrorCorrectionLevel.M, EncodeHintType.MARGIN, 0));
            var d = new StringBuilder();
            for (int y = 0; y < m.getHeight(); y++) for (int x = 0; x < m.getWidth(); x++) if (m.get(x, y)) d.append('M').append(x).append(' ').append(y).append("h1v1h-1z");
            return new Qr(m.getWidth(), d.toString());
        } catch (WriterException e) {
            throw new IllegalStateException(e);
        }
    }
}
