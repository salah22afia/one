package org.gcc.usp.modules.mydata.card;

import java.time.Instant;
import org.gcc.usp.platform.identity.CurrentUser;
import org.gcc.usp.platform.shared.ApiException;
import org.gcc.usp.platform.shared.LocalizedText;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

/** Feature mydata.card: the digital employee card's verification code (QR on its back) and its public check. */
@RestController
class CardController {

    private final CardCodes codes;
    private final CurrentUser me;
    private final String publicBaseUrl;

    CardController(CardCodes codes, CurrentUser me, @Value("${usp.card.public-base-url}") String publicBaseUrl) {
        this.codes = codes;
        this.me = me;
        this.publicBaseUrl = publicBaseUrl.replaceAll("/+$", "");
    }

    /** {@code url}: what the QR opens; {@code expiresAt}: the card's "valid until". A fresh code on every call. */
    record CardView(String employeeNo, LocalizedText name, String url, Instant expiresAt, Qr qr) {}

    /** Employees only (the card is theirs; a platform account has none). Uses the session: no SAP call. */
    @GetMapping("/api/v1/mydata/card")
    CardView card() {
        me.sapCredentials(); // 403 auth.noSapAccount for a platform account
        var s = me.session().orElseThrow(ApiException::unauthorized);
        var issued = codes.issue(s.employeeNo(), s.name());
        var url = publicBaseUrl + "/verify/card/" + issued.code();
        return new CardView(s.employeeNo(), s.name(), url, issued.expiresAt(), Qr.of(url));
    }

    /**
     * Public (no sign-in): what a scanned card code proves. {@code valid}: signed by the portal and not expired;
     * {@code expired}: signed but past its time. The name and number are shown only for a genuine code.
     */
    record CardCheck(boolean valid, boolean expired, String employeeNo, LocalizedText name, Instant expiresAt) {}

    @GetMapping("/api/v1/verify/card/{code}")
    CardCheck verify(@PathVariable String code) {
        return codes.read(code)
            .map(c -> new CardCheck(!codes.expired(c), codes.expired(c), c.employeeNo(), c.name(), c.expiresAt()))
            .orElse(new CardCheck(false, false, null, null, null));
    }
}
