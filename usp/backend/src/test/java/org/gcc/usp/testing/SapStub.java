package org.gcc.usp.testing;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.stream.StreamSupport;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

/**
 * A stand-in for the SAP Tamkeen services (docs/SAP_INTEGRATION.md) for backend tests: profile (SAP-001) and org
 * structure (SAP-010 … SAP-014), served from src/test/resources/sap/org-fixture.json. Every fixture employee signs in
 * as {@code U<employee_no>} with password {@code secret}. Records the paths called.
 */
public final class SapStub implements AutoCloseable {

    public static final String PASSWORD = "secret";

    private static final JsonMapper JSON = JsonMapper.builder().build();
    private final HttpServer server;
    private final JsonNode fixture;
    public final List<String> calls = new CopyOnWriteArrayList<>();

    public SapStub() {
        try (var in = SapStub.class.getResourceAsStream("/sap/org-fixture.json")) {
            fixture = JSON.readTree(in);
            server = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
        server.createContext("/sap/tamkeen/", this::handle);
        server.start();
    }

    public String url() {
        return "http://localhost:" + server.getAddress().getPort();
    }

    /** The fixture employee number for a prototype person key such as P-AHMED. */
    public String employeeNo(String key) {
        return employees().stream().filter(e -> key.equals(e.get("key").asString())).findFirst().orElseThrow().get("employee_no").asString();
    }

    public static String userOf(String employeeNo) {
        return "U" + employeeNo;
    }

    @Override
    public void close() {
        server.stop(0);
    }

    private void handle(HttpExchange ex) throws IOException {
        var path = ex.getRequestURI().getPath();
        calls.add(path);
        var me = authenticate(ex.getRequestHeaders().getFirst("Authorization"));
        if (me == null) {
            send(ex, 401, null);
            return;
        }
        var p = path.substring("/sap/tamkeen/".length()).split("/");
        Object body = switch (p[0] + (p.length > 1 ? "/" + p[1] : "")) {
            case "profile/me" -> profile(me);
            case "org/me" -> Map.of("employee_no", me.get("employee_no").asString(),
                "positions", positions().stream().filter(x -> heldBy(x, me)).map(x -> Map.of("id", x.get("id").asString(), "primary", true)).toList(),
                "acting_for", List.of());
            case "org/employees" -> employees().stream().filter(e -> e.get("employee_no").asString().equals(p[2])).findFirst().map(this::assignment).orElse(null);
            case "org/units" -> p.length == 4 && p[3].equals("positions")
                ? positions().stream().filter(x -> x.get("org_unit_id").asString().equals(p[2])).toList()
                : units().stream().filter(u -> u.get("id").asString().equals(p[2])).findFirst().orElse(null);
            case "org/positions" -> positions().stream().filter(x -> x.get("id").asString().equals(p[2])).findFirst().orElse(null);
            default -> null;
        };
        send(ex, body == null ? 404 : 200, body);
    }

    private JsonNode authenticate(String header) {
        if (header == null || !header.startsWith("Basic ")) return null;
        var pair = new String(Base64.getDecoder().decode(header.substring(6)), StandardCharsets.UTF_8).split(":", 2);
        if (pair.length != 2 || !PASSWORD.equals(pair[1])) return null;
        return employees().stream().filter(e -> e.get("sap_user").asString().equalsIgnoreCase(pair[0])).findFirst().orElse(null);
    }

    private static Map<String, Object> profile(JsonNode e) {
        var hire = e.get("hire_date").asString();
        return Map.of("employee_no", Integer.parseInt(e.get("employee_no").asString()), "arabic_name", e.get("arabic_name").asString(),
            "english_name", e.get("english_name").asString(), "date_of_birth", "01-01-1990", "hire_date_iso", hire);
    }

    private ObjectNode assignment(JsonNode e) {
        var n = JSON.createObjectNode();
        n.put("employee_no", e.get("employee_no").asString());
        n.put("arabic_name", e.get("arabic_name").asString());
        n.put("english_name", e.get("english_name").asString());
        n.put("gender", e.get("gender").asString());
        n.put("hire_date", e.get("hire_date").asString());
        var pos = e.get("position_id").asString();
        n.put("position_id", pos);
        positions().stream().filter(x -> x.get("id").asString().equals(pos)).findFirst()
            .ifPresent(x -> n.put("org_unit_id", x.get("org_unit_id").asString()));
        return n;
    }

    private boolean heldBy(JsonNode position, JsonNode me) {
        var h = position.get("holder");
        return h != null && h.isObject() && h.get("employee_no").asString().equals(me.get("employee_no").asString());
    }

    private List<JsonNode> employees() {
        return StreamSupport.stream(fixture.get("employees").spliterator(), false).toList();
    }

    private List<JsonNode> positions() {
        return StreamSupport.stream(fixture.get("positions").spliterator(), false).toList();
    }

    private List<JsonNode> units() {
        return StreamSupport.stream(fixture.get("units").spliterator(), false).toList();
    }

    private static void send(HttpExchange ex, int status, Object body) throws IOException {
        var bytes = body == null ? new byte[0] : JSON.writeValueAsBytes(body);
        ex.getResponseHeaders().add("Content-Type", "application/json; charset=utf-8");
        ex.sendResponseHeaders(status, bytes.length == 0 ? -1 : bytes.length);
        if (bytes.length > 0) ex.getResponseBody().write(bytes);
        ex.close();
    }
}
