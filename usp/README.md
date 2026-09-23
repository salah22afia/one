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
pnpm dev:backend                                   # http://localhost:8080 (dev profile: first platform administrator admin / Temporary-Start-2026)
pnpm dev:web                                       # http://localhost:5173
pnpm dev:admin                                     # http://localhost:5174
pnpm dev:mobile                                    # Expo; set expo.extra.apiUrl in apps/mobile/app.json for a device
```

Useful endpoints: `GET /api/v1/modules` (module & feature registry), `/swagger-ui.html`, `/actuator/health`.

**Database:** PostgreSQL in Docker on **localhost:5433**, database `usp`, user `usp`, password `usp` (pgAdmin: add a server with these).
It starts empty (schema only): no sample data is loaded. People and the org structure are read live from SAP (SAP-010 … 014)
and never copied into PostgreSQL.

**Sign-in:** users sign in with their **SAP user and password** (SU01). The backend checks them by calling
`GET {usp.sap.base-url}/sap/tamkeen/profile/me` as that user and opens an **in-memory** session (web: HttpOnly cookie,
mobile: bearer token in the device keychain). If SAP issues a `MYSAPSSO2` logon ticket the password is dropped and the
ticket is used instead; otherwise the credential is kept in memory only until the session ends (30 min idle / 8 h).
Nothing about the employee is written to PostgreSQL. Configure with `USP_SAP_URL` (default `http://sandbox.gcc-sg.org:8000`)
and `USP_SAP_CLIENT` (optional `sap-client`). The backend must be on a network where that host resolves.

**Employee profile:** `GET /api/v1/mydata/profile` (web: sidebar → ملفي, mobile: Me) reads SAP live on every visit.

## Checks

```bash
pnpm typecheck        # all TS packages and apps
pnpm test             # forms-core rules + config-package validation
pnpm lint             # includes module boundaries (a feature may not import another module's features)
cd backend && ./mvnw test   # module boundaries, rule parity, SAP sign-in and the org against a stub SAP, the DC-01 flow,
                            # return/resubmit/withdraw, concurrent decisions, paging (Testcontainers)
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

**Platform (Slice 0):** SAP sign-in (in-memory sessions) and platform accounts · languages in PostgreSQL, catalogs per
language · org and approvers read live from SAP (line manager, head of unit, positions, team; vacant → deputy → superior;
no self-approval) · the version machine for versioned configuration (`/api/v1/admin/config/{kind}`) · the prototype's UI
kit and shell on web, admin and mobile.

**Requests and tasks (Slice 1.1):** every configured service runs end to end — submit, **return** to the requester
(reason required), **complete and resubmit** to the same step (validated against the version it was submitted with; later
steps' conditions follow the new data), **withdraw** before anyone else decided (per service: `withdraw`), and per step
which decisions its holder may take (`decisions`). Changes of one request are serialised (row locks) and checked against
the version the screen showed (409 when stale), so a double tap or two holders acting at once decide once. My requests
(ongoing / finished, returned first) and Tasks → Done are paged by key; the names on list rows come from SAP in one
concurrent round (`USP_SAP_MAX_PARALLEL`). Screens 1:1 with the prototype: My requests, the request page, Tasks (swipe,
decision sheet, list + detail on desktop) and the request form, on web and mobile.

**Service catalogue (Slice 1.2):** domains, services and their waves, the Home dock and "notify me" live in PostgreSQL
(`catalog` schema), starting from the prototype's catalogue 1.0 (loaded by migration `V20260923_100100`). Employees get
the Services screen, a domain's page and the search island / ⌘K (Arabic-aware, startable services first) on web and
mobile; coming services open a sheet with "Notify me". Platform administrators edit it in the admin portal → Service
catalogue: services (added with a new code, never deleted: hidden or merged instead), domains, the dock and the change
log. The server keeps the rules: "available" only for a coded or configured service, the dock holds available services
only (at most `USP_CATALOG_DOCK_MAX`, default 4), a service that is not available cannot be requested, stale edits are
refused (409 `catalog.stale`).

**Me (Slice 1.3):** the digital employee card (its QR is a code the portal signs for 24 h; anyone can check it at
`/verify/card/…` without signing in) and a widget grid that modules fill: My data, My documents (wallet), My balances,
My pay, My family — read live from SAP as the employee (SAP-001 … 005), never stored — and My settings: language,
appearance and text size, kept per person so web and phone match.

**DC-01 Employment letter:** issued as an immutable document with number, HMAC verification code, QR, official layout,
HTML print + Gotenberg PDF and public verification.

API: `GET /api/v1/requests?view=ongoing|finished&cursor=&limit=` · `GET /api/v1/requests/{id}` ·
`POST /api/v1/requests/{id}/resubmit` `{data, version}` · `POST /api/v1/requests/{id}/withdraw` `{version}` ·
`GET /api/v1/tasks` · `GET /api/v1/tasks/done?cursor=` · `POST /api/v1/tasks/{stepId}/decision` `{action, note, ref, version}` ·
`GET /api/v1/catalog` · `POST|DELETE /api/v1/catalog/services/{id}/interest` · administrators: `GET /api/v1/admin/catalog`,
`PUT …/domains/{code}`, `POST …/services`, `PUT …/services/{id}`, `PUT …/dock` (each change carries `version`) ·
`GET /api/v1/mydata/profile` · `GET /api/v1/mydata/documents` · `GET /api/v1/mydata/family` · `GET /api/v1/timeleave/balances` ·
`GET /api/v1/finance/payslips` · `GET /api/v1/mydata/card` · public `GET /api/v1/verify/card/{code}` ·
`GET|PUT /api/v1/me/preferences`.

## Not yet

Scheduler (SLA reminders, escalation, version activation), notifications, file store for attachments (the form keeps the
file name only), Home "Today" (Slice 1.5; it will draw the configured dock), notifications (1.4), the admin service builder, the outbox and further SAP
services (MD-01/02/05 and FN-01 run until their SAP system step, which parks as "waiting for integration"), the real IdP /
SU01 principal propagation, Leave and Needs modules, CI pipeline. Employee data beyond the four profile fields (waiting
for the extended SAP profile contract).
