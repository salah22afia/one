# Unified Services Portal (USP)

Monorepo skeleton built from [`../docs/PLATFORM_REQUIREMENTS.md`](../docs/PLATFORM_REQUIREMENTS.md). The prototype in `../prototype` is the functional reference and is not modified.

## Layout

```
backend/            Spring Boot 4.1 · Java 21 · Spring Modulith · PostgreSQL · Flyway (Maven)
  src/main/java/org/gcc/usp/
    platform/<module>/          core modules: identity, org, modules, config, forms, rules, workflow, requests, …
    modules/<module>/           business modules: timeleave, needs, mydata, letters, finance
      <Key>Module.java          module descriptor (key, catalogue code, features)
      <feature>/                one package per feature (vertical slice)
  src/main/resources/db/migration/<module>/   one migration folder (and one DB schema) per module
apps/web/           Employee web (React 19, Vite, React Router, TanStack Query)
apps/admin/         Admin portal (same stack)
apps/mobile/        Expo SDK 57 app (Expo Router)
  each app: src/app (shell) · src/platform (cross-cutting features) · src/modules/<module>/{index.ts, features/<feature>}
packages/           api-client · forms-core (service schema + rules) · forms-web · forms-native · i18n · ui-web · modules/<module>
config-packages/    source-controlled configured services: <module>/<feature>/service.json
tools/generators/   pnpm gen:module / gen:feature
infra/              docker-compose for local dependencies
```

## Run

```bash
pnpm install
docker compose -f infra/docker-compose.yml up -d   # PostgreSQL on 5433, Gotenberg on 3000
pnpm dev:backend                                   # http://localhost:8080 (dev profile: dev sign-in)
pnpm dev:web                                       # http://localhost:5173  (?as=<person id> switches the dev user)
pnpm dev:admin                                     # http://localhost:5174
pnpm dev:mobile                                    # Expo; set expo.extra.apiUrl in apps/mobile/app.json for a device
```

Useful endpoints: `GET /api/v1/modules` (module & feature registry), `/swagger-ui.html`, `/actuator/health`.

**Database:** PostgreSQL in Docker on **localhost:5433**, database `usp`, user `usp`, password `usp` (pgAdmin: add a server with these).
It starts empty (schema only): no sample data is loaded. People and the org structure will come from the SAP org sync;
until then nothing can be requested or approved.

**Sign-in:** users sign in with their **SAP user and password** (SU01). The backend checks them by calling
`GET {usp.sap.base-url}/sap/tamkeen/profile/me` as that user and opens an **in-memory** session (web: HttpOnly cookie,
mobile: bearer token in the device keychain). If SAP issues a `MYSAPSSO2` logon ticket the password is dropped and the
ticket is used instead; otherwise the credential is kept in memory only until the session ends (30 min idle / 8 h).
Nothing about the employee is written to PostgreSQL. Configure with `USP_SAP_URL` (default `http://sandbox.gcc-sg.org:8000`)
and `USP_SAP_CLIENT` (optional `sap-client`). The backend must be on a network where that host resolves.

**Employee profile:** `GET /api/v1/mydata/profile` (web: sidebar → ملفي, mobile: Me) reads SAP live on every visit.

The dev profile also accepts `X-Dev-User: <person id>` (only used by the automated workflow tests).

## Checks

```bash
pnpm typecheck        # all TS packages and apps
pnpm test             # forms-core rules + config-package validation
pnpm lint             # includes module boundaries (a feature may not import another module's features)
cd backend && ./mvnw test   # module boundaries, rule parity, SAP sign-in against a stub SAP, and the DC-01 flow (Testcontainers)
pnpm --filter @usp/web e2e  # Playwright UI test of the DC-01 flow (skipped until example org data exists)
```

Testcontainers needs Docker. With Colima: `export DOCKER_HOST=unix://$HOME/.colima/default/docker.sock TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE=/var/run/docker.sock`.
Rules are checked for parity: `packages/forms-core/fixtures/rules.json` runs against both the TS and the Java evaluator.

## Adding things

**Configured service (no code):** build it in the admin service builder, or add `config-packages/<module>/<feature>/service.json`, plus a registry entry:

```bash
pnpm gen:feature mydata address-change --configured --service-id MD-07 --ar "تغيير العنوان" --en "Change address"
```

**Coded feature:** scaffolds the backend package + controller, the descriptor entry, the module README row, and web (or admin, for `--kind policy`) and mobile pages and routes:

```bash
pnpm gen:feature timeleave leave-carryover --service-id TM-02 --ar "ترحيل رصيد الإجازة" --en "Carry over leave balance" --doc "TM-02 …"
# --kind service|view|desk|policy|integration   (default: service)
```

**New module:**

```bash
pnpm gen:module training --code TD --ar "التدريب والتطوير والأداء" --en "Training, development & performance" --icon book --order 60
```

Rules: a feature owns its code in every app. Modules talk to each other only through their root package / `@NamedInterface` (backend), or their `index.ts` manifest (frontend), or through domain events. Each module owns its schema. Add tables with a new migration in `db/migration/<module>/`, using a timestamp version above the latest existing one.

## Implemented so far

**DC-01 Employment letter, end to end** (web + mobile), and the platform path every configured service uses:
org structure + approver resolution (line manager, pool, positions; vacant → deputy → superior; no self-approval) ·
service definitions from `config-packages` · server-side validation mirroring the client (same rule fixtures) ·
requests (numbering, my requests, detail, audit) · in-house workflow engine (approve / fulfil / receipt / notify / system
steps, live re-resolution of assignees, SLA due dates) · inbox and decisions · documents (immutable snapshot, number,
HMAC verification code, QR, official layout, HTML print + Gotenberg PDF, public verification).

## Not yet

Return/resubmit and withdraw, SLA reminder/escalation jobs, notifications, config versioning and the admin service
builder, the outbox and further SAP services (MD-01/02/05 and FN-01 run until their SAP system step, which parks as
"waiting for integration"), the real IdP / SU01 principal propagation, Leave and Needs modules, object storage for
attachments, CI pipeline. Employee data beyond the four profile fields (waiting for the extended SAP profile contract).
