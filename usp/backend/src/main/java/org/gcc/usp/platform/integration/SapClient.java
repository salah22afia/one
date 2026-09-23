package org.gcc.usp.platform.integration;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Calls SAP REST/OData services as the signed-in user (§8.5, SEC-03). Responses are returned to the caller and never
 * stored. Only status codes and paths are logged, never bodies or credentials.
 */
@Component
public class SapClient {

    private static final Logger log = LoggerFactory.getLogger(SapClient.class);

    private final RestClient http;
    private final JsonMapper json;
    private final String sapClient;

    SapClient(JsonMapper json, @Value("${usp.sap.base-url}") String baseUrl, @Value("${usp.sap.client:}") String sapClient,
              @Value("${usp.sap.timeout:10s}") Duration timeout) {
        var jdk = HttpClient.newBuilder().connectTimeout(timeout).followRedirects(HttpClient.Redirect.NEVER).build();
        var factory = new JdkClientHttpRequestFactory(jdk);
        factory.setReadTimeout(timeout);
        this.http = RestClient.builder().baseUrl(baseUrl).requestFactory(factory).build();
        this.json = json;
        this.sapClient = sapClient;
    }

    /** GET a JSON resource as the user. */
    public SapResponse get(String path, SapCredentials credentials) {
        var uri = UriComponentsBuilder.fromUriString(path);
        if (!sapClient.isBlank()) uri.queryParam("sap-client", sapClient);
        try {
            return http.get().uri(uri.build().toUriString())
                .accept(MediaType.APPLICATION_JSON)
                .headers(h -> {
                    if (credentials.isTicket()) h.add(HttpHeaders.COOKIE, "MYSAPSSO2=" + credentials.ticket());
                    else h.set(HttpHeaders.AUTHORIZATION, credentials.authorization());
                })
                .exchange((req, res) -> {
                    int status = res.getStatusCode().value();
                    if (status == 401) throw new SapException(SapException.Kind.UNAUTHORIZED, status, "SAP 401 " + path);
                    if (status == 403) throw new SapException(SapException.Kind.FORBIDDEN, status, "SAP 403 " + path);
                    if (status == 404) throw new SapException(SapException.Kind.NOT_FOUND, status, "SAP 404 " + path);
                    if (status >= 500) throw new SapException(SapException.Kind.UNAVAILABLE, status, "SAP " + status + " " + path);
                    if (status >= 300) throw new SapException(SapException.Kind.ERROR, status, "SAP " + status + " " + path);
                    var body = new String(res.getBody().readAllBytes(), java.nio.charset.StandardCharsets.UTF_8);
                    JsonNode node;
                    try {
                        node = json.readTree(body);
                    } catch (RuntimeException e) {
                        throw new SapException(SapException.Kind.ERROR, status, "SAP returned non-JSON for " + path);
                    }
                    return new SapResponse(node, ticketFrom(res.getHeaders().getOrEmpty(HttpHeaders.SET_COOKIE)));
                });
        } catch (ResourceAccessException e) {
            log.warn("SAP unreachable for {}: {}", path, e.getMessage());
            throw new SapException(SapException.Kind.UNAVAILABLE, 0, "SAP unreachable: " + e.getMessage());
        } catch (SapException e) {
            log.info("{}", e.getMessage());
            throw e;
        }
    }

    /** GET a JSON resource as the user, for a user-facing API: SAP's refusals become the portal's API errors. */
    public JsonNode fetch(String path, SapCredentials credentials) {
        try {
            return get(path, credentials).body();
        } catch (SapException e) {
            throw e.toApi();
        }
    }

    private static Optional<String> ticketFrom(List<String> setCookies) {
        return setCookies.stream().filter(c -> c.startsWith("MYSAPSSO2=")).map(c -> c.substring(10, c.contains(";") ? c.indexOf(';') : c.length()))
            .filter(v -> !v.isBlank()).findFirst();
    }

    /** {@code ticket}: the MYSAPSSO2 logon ticket if SAP issued one (then the password can be dropped). */
    public record SapResponse(JsonNode body, Optional<String> ticket) {}
}
