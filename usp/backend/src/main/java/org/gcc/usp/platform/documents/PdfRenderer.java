package org.gcc.usp.platform.documents;

import java.nio.charset.StandardCharsets;
import org.gcc.usp.platform.shared.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/** HTML → PDF through Gotenberg (headless Chromium: correct Arabic shaping). The page size comes from the CSS @page. */
@Component
class PdfRenderer {

    private final RestClient gotenberg;

    PdfRenderer(@Value("${usp.documents.gotenberg-url}") String url) {
        this.gotenberg = RestClient.builder().baseUrl(url).build();
    }

    byte[] pdf(String html) {
        var form = new LinkedMultiValueMap<String, Object>();
        form.add("files", new ByteArrayResource(html.getBytes(StandardCharsets.UTF_8)) {
            @Override
            public String getFilename() { return "index.html"; }
        });
        form.add("preferCssPageSize", "true");
        form.add("printBackground", "true");
        try {
            return gotenberg.post().uri("/forms/chromium/convert/html").contentType(MediaType.MULTIPART_FORM_DATA).body(form)
                .retrieve().body(byte[].class);
        } catch (RestClientException e) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "document.pdfUnavailable");
        }
    }
}
