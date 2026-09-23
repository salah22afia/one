# Unified Services Portal (USP): Platform Requirements Document

| | |
|---|---|
| **Document** | Platform Requirements: Backend, Web, Mobile, Admin Portal |
| **Source** | Prototype `prototype/` (`usp-portal` v0.5.1, domain engine revisions v0.6 → v0.12) + review feedback on Drafts 1–2 |
| **Status** | Draft 3.4, for review. Project in `usp/`: DC-01 end to end; SAP sign-in and live employee profile (see its README). |
| **Date** | 2026-09-21 |
| **Decided so far** | Backend: Java / Spring Boot. DB: PostgreSQL. Mobile: React Native (Expo). SAP access: direct OData / REST (JCo to be decided). Identity: every SAP call runs as the employee's own SU01 user. Single organisation (**no multi-tenancy for now**). |
| **Changes since Draft 2** | (1) Multi-tenancy removed. (2) New **module & feature model**: modules categorise features / services (§4). (3) New **feature-driven project skeletons** for backend, web, admin and mobile, with a "how to add a feature" recipe (§6). (4) Functional requirements regrouped by module (§10). (5) **Workflow engine: lightweight in-house engine** ported from the prototype; Flowable kept as a later option (§7.6.1). |

> The prototype is a single-file React app. All state lives in `localStorage`, and a simulated SAP ("the system of record", H4S4 / S/4HANA) sits in the seed data. This document turns what the prototype *does* into requirements for a production platform. Decision IDs from the prototype (D-009 … D-028, P-05 … P-13, CAP-01, AS-01, TM-01) are kept so the business rules can be traced back to the source.

---

## 1. Purpose and scope

The USP is a **configurable, modular employee-services platform** for the General Secretariat. It is bilingual (Arabic-first, RTL / English), with web, mobile and admin channels. It:

1. Lets an employee request any service from one place. Services are organised into **modules** (business categories) and released in waves.
2. Lets **administrators build and change services without code**: fields, forms, validations, business rules, workflows, documents, notifications and integrations. Every change is versioned, governed and audited.
3. Lets **developers add code-backed features easily**: each feature is a self-contained vertical slice inside its module, in the backend, web, admin and mobile alike.
4. Routes every request through a **position-based approval engine** driven by the org structure.
5. Integrates with **SAP S/4HANA and other systems through configurable extension points**.
6. Issues **official documents** that carry a verification code and a QR code, and keeps users informed with notifications, deadlines (SLA), reminders and escalation.

### 1.1 In scope for Wave 1

**Platform capabilities:** module & feature registry, application builder, integration extension points, workflow runtime, web and mobile runtime, admin portal.

**Business modules and features delivered:**

| Module | Feature (service) | Depth in prototype | Delivered as |
|---|---|---|---|
| **Time & Leave** (TM) | TM-01 Leave request, TM-01C cancellation, leave history, leave policy | **Full** | Code-backed feature + configurable policy |
| **Needs, Custody & Assets** (AS) | AS-01 "I need something", store & procurement desks, needs policy, AS-02 My custody (read) | **Full** | Code-backed feature + configurable policy |
| **My Data & Documents** (MD) | MD-01 Update personal data, MD-02 Change bank account, MD-05 Update a document | Simple routes | **Configuration only** |
| **Letters & Official Documents** (DC) | DC-01 Employment letter | Simple route | **Configuration only** |
| **Employee Finance** (FN) | FN-01 Business trip & assignment | Provisional route | **Configuration only** |

> **Acceptance test for the platform:** the five configuration-only services are built **entirely in the admin portal**, with no developer involvement. Leave and Needs have rules too rich for configuration alone (pay-tier cycles, delegation bands, batch receipts), so they are **code-backed features**. They plug into the same engine through extension points (§7.9) and remain parameterised by admin-editable policies.

### 1.2 Out of scope for Wave 1

- The remaining catalogue services (`prototype/src/data/catalog.ts`). All 16 catalogue domains are **registered as modules** from day one, and their services are listed with a status badge ("coming in wave N", "later").
- **Multi-tenancy.** The platform serves one organisation. (Configuration is data, and nothing organisation-specific is hard-coded, so multi-tenancy can still be added later.)

---

## 2. Actors, personas and channels

| Persona | Main capabilities |
|---|---|
| **Employee** | Request services, track requests, sign handovers, profile, balances, documents, payslips, custody |
| **Manager** (holder of a chief position) | Everything an employee can do, plus approve / return / reject, open needs (department level and above) |
| **Specialist desks** | HR / personnel affairs, procurement, stores, budget, technical entities (IT, general services), payroll, assignments & entitlements: work queues |
| **System administrator** | Modules & features registry, roles, settings, org sync |
| **Application designer** | Build and edit configured services: fields, forms, validations, rules, workflows, documents, notifications |
| **Integration administrator** | Connections, credentials (write-only), connector operations, webhooks, inbound API clients, integration monitor |
| **Policy administrator** | Leave policy, needs policy, operations (seasonal windows, period close, coordinators, pool stock) |
| **Publish approver (optional)** | Second approval of configuration versions (D-010 governance, generalised) |
| **Developer** | Adds code-backed features / extension plugins following the feature skeleton (§6) |
| **System** | Automatic steps, connector calls, reminders, escalation, version activation |

Separation of duties: the person who edits a configuration version cannot approve its publication when second approval is on.

**Channels:** responsive web (desktop sidebar with ⌘K palette; mobile tab bar), native mobile app (iOS/Android), admin portal. Every request records its `channel`.

---

## 3. Solution architecture

```
 ┌──────────────────────────────── Clients ─────────────────────────────────┐
 │  Employee Web (React)        Admin Portal (React)        Mobile (Expo)     │
 │  each organised as: shell + platform features + modules/<module>/features │
 │        └──── shared: api-client · forms-core (renderer rules) · i18n ───┘  │
 └───────────────────────────────┬───────────────────────────────────────────┘
                                 │ HTTPS / JSON (OpenAPI), OIDC bearer tokens
                     ┌───────────▼────────────┐
                     │ API Gateway / proxy     │
                     └───────────┬────────────┘
 ┌───────────────────────────────▼──────────────────────────────────────────┐
 │ USP Backend: Spring Boot modular monolith (Spring Modulith)               │
 │ ┌──────────── platform (core modules) ──────────────┐ ┌─── business ────┐ │
 │ │ identity · org · modules-registry · config ·      │ │ timeleave       │ │
 │ │ forms · rules · workflow (in-house) · requests ·  │ │ needs           │ │
 │ │ documents · notifications · catalog · integration │ │ mydata (config) │ │
 │ │ · audit · shared                                  │ │ letters (cfg)   │ │
 │ └───────────────────────────────────────────────────┘ │ finance (cfg) … │ │
 │  Scheduler (SLA, activation, sync)   Outbox worker     └─────────────────┘ │
 └──────┬──────────────────┬──────────────────┬──────────────────┬──────────┘
  ┌─────▼──────┐   ┌───────▼───────┐  ┌───────▼───────┐  ┌───────▼───────────┐
  │ PostgreSQL │   │ Object storage │  │ Vault/secrets │  │ SAP S/4HANA (as   │
  │            │   │ (files, PDFs)  │  │               │  │ SU01 user), REST, │
  └────────────┘   └───────────────┘  └───────────────┘  │ email, SMS, hooks │
                                                          └───────────────────┘
```

**Architectural principles**

| # | Principle | Source |
|---|---|---|
| A1 | **One request object per service instance.** Its data is validated against the service version it was submitted with. | P-05 |
| A2 | **Approver is a position, not a person.** Resolved when the step opens and re-resolved while it is open. No self-approval. A vacant position never blocks the step. | D-012, CAP-01 |
| A3 | **Configuration is data, versioned.** Services, forms, workflows, policies and connectors all have dated versions. A request pins the versions it used. Changes carry a reason and a reference, and are never deleted. | D-009, D-010 |
| A4 | **Every list keyed by its external key** (SAP grouping + subtype, BP number, material number…). | P-10 |
| A5 | **End-date, never hard delete** for configuration items. | P-12 |
| A6 | **Systems of record own their results.** External numbers arrive through integration and are never typed in (manual fallback only when configured). | D-028 |
| A7 | **Never auto-approve** on SLA breach. | CAP-01 §2 |
| A8 | **Feature-driven structure.** Code is organised by *module → feature* (vertical slices), not by technical layer. A feature owns its API, logic, persistence, UI, tests and migrations. | New |
| A9 | **Modules are the unit of categorisation**, in the catalogue, navigation, permissions, admin, reporting and code. Modules talk to each other only through published APIs or events, with no cycles. | New |
| A10 | **Configure first, code last.** The order of preference is configuration → code-backed feature using the extension points → new platform capability. | New |
| A11 | **Same rules everywhere.** Validation and visibility rules are declarative and run identically on the server (authoritative), the web and mobile. | New |

---

## 4. Module and feature model

### 4.1 Concepts

| Concept | Definition | Examples |
|---|---|---|
| **Module** | A business category that groups related features. It is the unit of navigation, catalogue grouping, permissions, admin ownership, reporting and code ownership. It maps 1:1 to a catalogue domain. | Time & Leave, Needs, Custody & Assets, My Data & Documents |
| **Feature** | A self-contained capability inside a module: a vertical slice (API + logic + data + UI + tests). | Leave request, leave history, store desk, employment letter |
| **Feature kind** | What sort of feature it is | `service` (requestable, in the catalogue), `view` (read-only page, e.g. My custody, Leave history), `desk` (work queue, e.g. procurement desk), `policy` (admin editor, e.g. leave policy), `integration` (connector bundle) |
| **Implementation** | How it is built | `configured` (defined entirely in the admin app builder, no code), `coded` (code-backed feature in the repo), `hybrid` (configured form/workflow + coded extensions) |
| **Platform module** | Cross-cutting capability used by all business modules; not shown in the catalogue | workflow, forms, rules, documents, notifications, integration |

### 4.2 Module registry: requirements

| ID | Requirement | P |
|---|---|---|
| MOD-01 | A **module registry** stores, for each module: key (e.g. `timeleave`), catalogue code (`TM`), bilingual name and description, icon and colour, display order, business owner (org unit / position), status (`active`/`hidden`), and enabled flag. | M |
| MOD-02 | A **feature registry** stores, for each feature: key (e.g. `timeleave.leave-request`), service ID (`TM-01`) if it is a service, module, kind, implementation, bilingual name and description, keywords, wave / status (`available`, `wave-2`, `wave-3`, `later`, `hidden`), eligibility rule (who can see/start it), channels (web / mobile), and enabled flag (a feature toggle). | M |
| MOD-03 | **Coded features self-register** at startup through a descriptor (backend) and a manifest (web/mobile/admin): routes, menu entries, permissions, extension points they provide. **Configured features** are registered when an admin creates them in a module. | M |
| MOD-04 | The **catalogue, navigation, search, inbox filters, notification preferences, reports and admin menus are all grouped by module**. | M |
| MOD-05 | **Permissions are scoped by module and feature**: e.g. `timeleave.policy.edit`, `needs.desk.procurement`, `mydata.designer`. Roles are bundles of these permissions. | M |
| MOD-06 | Admins can **create a new module** (category) and add configured features to it without code; developers add coded features to any module. | M |
| MOD-07 | Enabling / disabling a module or feature takes effect without redeployment. Disabled features are hidden, while existing requests remain visible and workable. | M |
| MOD-08 | Module dependencies are declared (e.g. `needs` uses `custody` via its API). The build fails on cycles or on access to another module's internals (Spring Modulith verification + ESLint boundaries on the frontend). | M |
| MOD-09 | Each module has its own **migrations folder, i18n namespace, permissions list, tests and documentation page** (`README.md` in the module folder). | M |

### 4.3 Initial module map

| Module key | Catalogue | Wave-1 features | Kind / implementation |
|---|---|---|---|
| `timeleave` | TM Time & leave | `leave-request` (TM-01), `leave-cancellation` (TM-01C), `leave-history`, `leave-policy`, `leave-operations` | service / view / policy: **coded** |
| `needs` | AS Needs, custody & assets | `need-request` (AS-01), `specification`, `store`, `procurement`, `budget`, `receipt`, `handover`, `custody` (AS-02 read), `needs-policy` | service / desk / policy / view: **coded** |
| `mydata` | MD My data & documents | `personal-data` (MD-01), `bank-account` (MD-02), `document-update` (MD-05), `profile` (view) | service: **configured**; profile view: coded |
| `letters` | DC Letters & official documents | `employment-letter` (DC-01) | service: **configured** |
| `finance` | FN Employee finance | `business-trip` (FN-01) | service: **configured** (hybrid later) |
| `hractions`, `insurance`, `govrelations`, `training`, `lifecycle`, `procurement`, `budget`, `governance`, `sysops`, `voice`, `workplace` | HA, MI, GR, TD, LC, PR, BG, GV, SY, EV, WP | none yet (catalogue entries with wave status) | registered, services listed as "coming" |

Platform (core) modules: `identity`, `org`, `modules` (registry), `config` (versioning), `forms`, `rules`, `workflow`, `requests` (runtime, inbox, timeline), `documents`, `notifications`, `catalog`, `integration`, `audit`, `shared`.

---

## 5. Technology stack

### 5.1 Backend

| Concern | Choice | Notes |
|---|---|---|
| Language / runtime | **Java 21 LTS** | Virtual threads for blocking I/O to external systems |
| Framework | **Spring Boot 4.1** (Web MVC, Validation, Actuator) | Spring Boot 3.5 open-source support has ended |
| Modularity | **Spring Modulith**: one application module per platform module and per business module | Enforced boundaries, named interfaces, domain events, event publication registry, generated module docs (C4 / PlantUML) |
| Security | **Spring Security** (OAuth2 Resource Server, OIDC) | §11 |
| Persistence | **Spring `JdbcClient`** (explicit SQL; request data, steps and payloads are JSONB) | Chosen over JPA while the model is JSONB-heavy; JPA can be added per module if a rich entity model appears |
| Migrations | **Flyway** with **one location per module** (`db/migration/<module>`) | |
| Config documents | PostgreSQL **JSONB** + **JSON Schema** validation | Service definitions, forms, policies, connector specs |
| **Workflow engine** | **Lightweight in-house engine** (`platform/workflow`), ported from the prototype's route model | Workflow definitions are versioned JSON; in-flight requests pin their version (D-009); SLA and escalation run on `@Scheduled` + ShedLock. It sits behind a `WorkflowEngine` interface so Flowable can replace it later (§7.6.1). |
| Expression / rules / decision tables | **JSON Logic** (decision tables stored as JSON rows of JSON Logic conditions) (`json-logic-java` + `json-logic-js`) | Sandboxed; identical evaluation server / web / mobile |
| Data mapping | **JSONata** (`jsonata-java` / `jsonata`) | Connector request/response transforms |
| SAP access | **SAP Cloud SDK for Java** (OData v2/v4, destinations, principal propagation). **SAP JCo** optional (decision pending) | §8.5 |
| Reliable external writes | **Transactional outbox** + worker, idempotency keys, retry/backoff, dead-letter | |
| Resilience | Resilience4j per connection | |
| Scheduling | Spring `@Scheduled` + **ShedLock** | SLA, activation, sync, expiry alerts |
| Secrets | **HashiCorp Vault** (or KMS equivalent); write-only from the admin UI | |
| Documents (PDF) | Admin-editable **Thymeleaf** templates (restricted mode) → **headless Chromium (Gotenberg)** | Correct Arabic shaping / RTL |
| QR / verification | ZXing; code = HMAC(document ID) | Public verify endpoint |
| Hijri calendar | `java.time.chrono.HijrahChronology` (Umm al-Qura) | |
| API contract | **springdoc-openapi**, grouped per module → generated TS client | |
| Object storage | S3-compatible (**MinIO** / S3), ClamAV scan | |
| Push / email / SMS | Expo Push; SMTP / Microsoft Graph; SMS gateway: configured as channel providers | |
| Observability | Micrometer/Prometheus/Grafana, OpenTelemetry, JSON logs tagged with `module`, `feature`, `request_id` | |
| Testing | JUnit 5, Testcontainers, WireMock, **Modulith `@ApplicationModuleTest`** per module, ArchUnit; rules conformance suite (Java ⇄ TS) | |
| Build | **Maven** (wrapper included); one project, modules as packages (split into sub-modules only if build time requires it) | |

### 5.2 Database

| Concern | Choice |
|---|---|
| Engine | **PostgreSQL 16+** |
| Schemas | One schema per module (`platform_workflow`, `timeleave`, `needs`, …), owned by that module's migrations; a module never writes another module's tables |
| Dynamic service data | Request payload in **JSONB**, validated against the service version schema; designer-flagged *searchable* fields become generated columns / expression indexes; GIN index |
| HA / backup | Primary + replica, PITR (pgBackRest), RPO ≤ 15 min, RTO ≤ 1 h |
| Search | `pg_trgm` + `unaccent` (Arabic / English) |
| Auditing | Append-only tables for request audit, config change log and ops log |

### 5.3 Employee web app

| Concern | Choice |
|---|---|
| Framework | **React 18+ / TypeScript / Vite** (reuse the prototype's components and CSS) |
| Structure | **Feature-driven** (`modules/<module>/features/<feature>`), with a module manifest per module (§6.3) |
| Dynamic forms | `packages/forms-core` + `packages/forms-web` renderer |
| Routing / state | React Router (routes contributed by module manifests); **TanStack Query** |
| Forms (coded features) | React Hook Form + Zod |
| i18n / RTL | Bilingual strings, **one i18n namespace per module**; logical CSS properties |
| Theming / motion | Prototype `tokens.css`, Cairo font, light/dark/auto; `motion` |
| Boundaries | `eslint-plugin-boundaries`: features import only from `shared`, `platform`, and other modules' public `index.ts` |

### 5.4 Admin portal

| Concern | Choice |
|---|---|
| Framework | **React / TypeScript / Vite**, a separate app in the monorepo with the same feature-driven structure |
| Form designer | **dnd-kit** canvas + property panel + live preview using the production renderers |
| Workflow designer | **React Flow (xyflow)** with the simple step model + simulator |
| Rule editor | Visual builder → JSON Logic; advanced **Monaco** mode with field autocomplete |
| Mapping editor | JSONata editor with a sample-payload test console |
| Grids | TanStack Table |

### 5.5 Mobile app

| Concern | Choice |
|---|---|
| Framework | **React Native + Expo** (EAS Build / EAS Update) |
| Structure | Feature-driven under `src/modules/...`; Expo Router `app/` folder holds thin route files only (§6.4) |
| Dynamic forms | `packages/forms-core` + `packages/forms-native`: configured services work on mobile with no app release |
| Auth / storage | `expo-auth-session` (OIDC + PKCE), `expo-secure-store`, biometric unlock |
| Push / files | `expo-notifications` (deep links); document/image picker, camera |
| RTL / offline | `I18nManager`; read cache (TanStack Query persist) |

### 5.6 Infrastructure / DevOps

- Docker on Kubernetes / OpenShift (hosting location to be confirmed, §16); data residency in the Kingdom.
- DEV → QA → UAT → PROD. Configured services move between environments as **versioned packages** (export/import); environment URLs and secrets stay outside packages.
- CI/CD: build, module-boundary verification, tests, SAST, dependency and image scans; Helm / Argo CD.

---

## 6. Project structure: feature-driven skeletons

### 6.1 Monorepo

```
usp/
├── backend/                         Spring Boot modular monolith
├── apps/
│   ├── web/                         Employee web
│   ├── admin/                       Admin portal
│   └── mobile/                      Expo app
├── packages/
│   ├── api-client/                  Generated from OpenAPI (one sub-folder per module)
│   ├── forms-core/                  Service/form schema types, JSON Logic, validation
│   ├── forms-web/                   Web renderer
│   ├── forms-native/                React Native renderer
│   ├── i18n/                        Shared + per-module namespaces
│   ├── ui-web/                      Web components + tokens (from prototype)
│   └── modules/                     Per-module shared TS (types, formatters, pure rules)
│       ├── timeleave/
│       └── needs/
├── config-packages/                 Source-controlled configured services (JSON)
│   ├── mydata/personal-data/ …
│   └── letters/employment-letter/ …
├── tools/
│   └── generators/                  `pnpm gen:module`, `pnpm gen:feature` scaffolding
├── infra/                           Docker, Helm, CI pipelines
└── docs/                            This document, ADRs, module docs
```
Tooling: pnpm workspaces + Turborepo, ESLint (+ boundaries) / Prettier, Vitest, Playwright (web E2E), Maestro (mobile E2E).

### 6.2 Backend skeleton

Base package `org.gcc.usp` (placeholder, to confirm). Each top-level package under `platform` and `modules` is a **Spring Modulith application module**. Inside a module, code is grouped **by feature** (vertical slice). Layer sub-packages exist only inside a feature, and only when the feature is big enough to need them.

```
backend/
├── build.gradle.kts
└── src/
    ├── main/
    │   ├── java/org/gcc/usp/
    │   │   ├── UspApplication.java
    │   │   ├── platform/                              ← core modules
    │   │   │   ├── shared/                            value types (T2 bilingual text, Money), errors, time/Hijri utils
    │   │   │   ├── identity/                          OIDC, current user, SU01 mapping, principal propagation
    │   │   │   ├── org/                               units, positions, holders, approver resolution (CAP-01)
    │   │   │   ├── modules/                           module & feature registry, toggles, permissions
    │   │   │   ├── config/                            generic versioning: draft/schedule/approve/rebase/revert
    │   │   │   ├── forms/                             service definitions, fields, forms, field access
    │   │   │   ├── rules/                             JSON Logic evaluation, decision tables, checks
    │   │   │   ├── workflow/                          WorkflowEngine interface + in-house implementation: instances, steps, assignees, branches, SLA/escalation jobs
    │   │   │   ├── requests/                          request runtime, inbox, timeline, drafts, resubmit
    │   │   │   ├── documents/                         templates, numbering, PDF, verification
    │   │   │   ├── notifications/                     in-app, push, email, SMS, preferences
    │   │   │   ├── catalog/                           catalogue & search (reads the registry)
    │   │   │   ├── integration/                       connections, operations, outbox, webhooks, inbound API, SAP client
    │   │   │   └── audit/
    │   │   └── modules/                               ← business modules
    │   │       ├── timeleave/
    │   │       │   ├── package-info.java              @ApplicationModule(displayName = "Time & Leave")
    │   │       │   ├── TimeleaveModule.java           module descriptor (@Configuration; bean method timeleaveDescriptor()): key, catalogue code, features, permissions
    │   │       │   ├── leaverequest/                  ← one feature = one package
    │   │       │   │   ├── LeaveRequestController.java    REST: /api/v1/timeleave/leave-requests
    │   │       │   │   ├── LeaveRequestService.java       use cases (submit, evaluate)
    │   │       │   │   ├── LeaveEvaluator.java            rules (eligibility, windows, overlap, balance)
    │   │       │   │   ├── PayTierCalculator.java
    │   │       │   │   ├── LeaveRequest.java              entity
    │   │       │   │   ├── LeaveRequestRepository.java
    │   │       │   │   ├── PostAbsenceStep.java           SystemStepHandler (extension point) → SAP IT2001
    │   │       │   │   └── dto/
    │   │       │   ├── leavecancellation/
    │   │       │   ├── leavehistory/
    │   │       │   ├── leavepolicy/                   policy content model, editor API, validation
    │   │       │   ├── leaveoperations/               seasonal windows, period close
    │   │       │   └── internal/                      module-private shared code (not exposed)
    │   │       ├── needs/
    │   │       │   ├── package-info.java
    │   │       │   ├── NeedsModule.java
    │   │       │   ├── needrequest/                   submission, route building, branches
    │   │       │   ├── specification/                 technical entity specify / provide / reroute
    │   │       │   ├── store/                         store decision, reservation, store desk
    │   │       │   ├── procurement/                   preparation, bands, quotes, evaluation, award, tender, PR/PO
    │   │       │   ├── budget/                        earmarked funds reservation / top-up / release
    │   │       │   ├── receipt/                       receipt reports, batches, committee signatures
    │   │       │   ├── handover/                      handover notes
    │   │       │   ├── custody/                       custody register (exposed API used by other modules)
    │   │       │   ├── needspolicy/
    │   │       │   └── internal/
    │   │       ├── mydata/
    │   │       │   ├── package-info.java
    │   │       │   ├── MyDataModule.java              registers configured features + coded profile view
    │   │       │   └── profile/                       "Me" read model (balances, docs, payslips…)
    │   │       ├── letters/  (MyLettersModule.java only; features are configured)
    │   │       └── finance/  (FinanceModule.java only; features are configured)
    │   └── resources/
    │       ├── application.yml
    │       ├── db/migration/
    │       │   ├── platform/…                         V1__workflow.sql, V2__requests.sql …
    │       │   ├── timeleave/                         V1__leave_request.sql …
    │       │   └── needs/
    │       ├── templates/<module>/                    document templates shipped with coded features
    │       ├── i18n/<module>_ar.properties, _en…      server-side messages per module
    │       └── modules/<module>/<feature>/            seed configuration (service definition JSON)
    └── test/java/org/gcc/usp/
        ├── ModularityTests.java                       ApplicationModules.of(UspApplication.class).verify()
        ├── platform/…                                 mirrors main
        └── modules/timeleave/leaverequest/…           tests live next to their feature (same package)
```

**Backend conventions**

| Rule | Detail |
|---|---|
| B1 | A feature package holds everything for that feature: controller, service, entities, repository, DTOs, extension-point implementations. |
| B2 | Only types in the module root package or a `@NamedInterface` package (e.g. `needs.custody`) may be used by other modules. Everything else is module-private. |
| B3 | Cross-module communication uses published APIs or **domain events** (`LeaveApproved`, `NeedHandedOver`, `RequestCompleted`), delivered via the Modulith event publication registry. |
| B4 | Each module owns its DB schema and migration folder. There are no foreign keys into another module's tables, only IDs. |
| B5 | Extension points (§7.9) are implemented as Spring beans in the feature package and discovered by the platform. The platform never imports business modules. |
| B6 | REST paths: `/api/v1/{module}/{feature}/…`. OpenAPI is grouped per module. |

### 6.3 Web skeleton (employee app)

```
apps/web/src/
├── app/                                  shell: providers, router assembly, layout (sidebar/tabbar, ⌘K)
│   ├── App.tsx
│   ├── router.tsx                        collects routes from module manifests
│   └── registry.ts                       import of all module manifests
├── platform/                             cross-cutting features (not business modules)
│   ├── home/
│   ├── catalog/                          services catalogue & search (grouped by module)
│   ├── inbox/                            my tasks
│   ├── requests/                         my requests, request detail, timeline, resubmit
│   ├── dynamic-service/                  renders any configured service (forms-web)
│   ├── notifications/
│   ├── documents/                        viewer, print, download
│   └── settings/
├── modules/
│   ├── timeleave/
│   │   ├── index.ts                      module manifest (public API of the module)
│   │   ├── i18n/ar.json, en.json
│   │   └── features/
│   │       ├── leave-request/
│   │       │   ├── pages/NewLeavePage.tsx
│   │       │   ├── components/TypePicker.tsx, RangeCalendar.tsx, PayTierBar.tsx
│   │       │   ├── api.ts                (TanStack Query hooks over api-client)
│   │       │   ├── model.ts              (view types, mappers)
│   │       │   └── __tests__/
│   │       ├── leave-cancellation/
│   │       └── leave-history/
│   ├── needs/
│   │   ├── index.ts
│   │   └── features/need-request/, store-desk/, procurement-desk/, custody/, step-panels/
│   └── mydata/
│       ├── index.ts
│       └── features/profile/
└── shared/                               ui primitives, hooks, formatters, icons (no business logic)
```

**Module manifest** (the only file other code imports from a module):

```ts
// modules/timeleave/index.ts
export const timeleaveModule: WebModule = {
  key: 'timeleave',
  routes: [
    { path: '/timeleave/leave/new', element: lazy(() => import('./features/leave-request/pages/NewLeavePage')) },
    { path: '/timeleave/history', element: lazy(() => import('./features/leave-history/pages/LeaveHistoryPage')) },
  ],
  services: { 'TM-01': '/timeleave/leave/new' },          // catalogue entry → coded page (else dynamic-service)
  profileWidgets: [LeaveHistoryPreview],                   // contributed to "Me"
  stepPanels: {},                                          // custom task panels for coded workflow steps
  fieldTypes: { leaveTypePicker: TypePickerField },        // custom field types for configured forms
  i18n: { ar, en },
};
```

Configured services need **no web code**. The catalogue opens them in `platform/dynamic-service`.

### 6.4 Mobile skeleton

```
apps/mobile/
├── app/                                  Expo Router: thin files only, one line each
│   ├── (tabs)/home.tsx, inbox.tsx, services.tsx, requests.tsx, me.tsx
│   ├── timeleave/leave/new.tsx           → export { default } from '@/modules/timeleave/features/leave-request/NewLeaveScreen'
│   └── service/[key].tsx                 → dynamic configured service
└── src/
    ├── platform/                         inbox, requests, catalog, dynamic-service, notifications, documents
    ├── modules/
    │   ├── timeleave/  index.ts + features/leave-request/, leave-history/
    │   └── needs/      index.ts + features/need-request/, handover-sign/, custody/
    └── shared/                           ui (native), hooks
```
Pure logic (types, formatters, evaluation previews) lives in `packages/modules/<module>` and is shared by web and mobile.

### 6.5 Admin skeleton

```
apps/admin/src/
├── app/                                  shell, router, registry
├── platform/
│   ├── modules-registry/                 modules & features, toggles, ordering
│   ├── service-builder/                  metadata, data model, form designer, rules, workflow designer, documents, notifications
│   ├── versions/                         history, diff, publish, approvals
│   ├── reference-lists/
│   ├── integration/                      connections, operations, webhooks, inbound clients, monitor
│   ├── org/                              org viewer, SAP reference viewers
│   ├── roles/
│   └── reports/
└── modules/
    ├── timeleave/features/leave-policy/, leave-operations/
    └── needs/features/needs-policy/, needs-operations/, simulator/
```

### 6.6 Recipes: adding things

**A. Add a configured service (no code): the normal path**
1. Admin portal → Modules → pick a module (or create a new one).
2. New service → metadata → fields → form → rules → workflow → documents → notifications → connector bindings.
3. Test in the sandbox → publish (with second approval if enabled).
4. (Optional) Export the package into `config-packages/<module>/<feature>/` so it is source-controlled and promoted DEV → PROD.

**B. Add a coded feature to an existing module**
1. `pnpm gen:feature <module> <feature>` scaffolds:
   - backend `modules/<module>/<feature>/` (package-info + controller) and a row in the module README; add a migration in `db/migration/<module>/` when the feature needs tables (timestamp version above the latest);
   - web (or admin for `--kind policy`) `modules/<module>/features/<feature>/pages/<Feature>Page.tsx` and a route in the module manifest;
   - mobile `src/modules/<module>/features/<feature>/<Feature>Screen.tsx` + a thin route file `app/<module>/<feature>.tsx` (not for policy/integration);
   - a feature entry in the module descriptor (key, service ID, kind, implementation, names). `--configured` adds only the descriptor entry and `config-packages/<module>/<feature>/service.json`.
2. Implement. If the feature participates in a configured workflow, implement the relevant extension point (`SystemStepHandler`, `Validator`, `FieldTypeProvider`, …).
3. Tests next to the code; `ModularityTests` must pass.

**C. Add a new module**
1. `pnpm gen:module <key> --code <XX> --name-ar … --name-en …` creates the backend package with `package-info.java` + module descriptor, a migration folder, web/mobile/admin module folders with an empty manifest, i18n namespace and a README.
2. Register the manifests in `app/registry.ts` (web, admin, mobile). The generator does this for you.
3. The module appears in the registry. Features are added via recipe A or B.

---

## 7. Configurable application platform (service builder)

### 7.1 Service definition

| ID | Requirement | P |
|---|---|---|
| AB-01 | Create a service **inside a module**, from scratch, from a template package, or by cloning. | M |
| AB-02 | Metadata: service ID, bilingual names and descriptions, module, icon/colour, keywords, target-system label, **eligibility rule** (all / groups / subgroups / locations / org units / positions / managers at level ≥ X / roles), beneficiary mode (self / someone in my unit subtree), channels, catalogue status (available / wave N / later / hidden). | M |
| AB-03 | A service version bundles: **data model, forms, validations & rules, workflow, documents, notifications, connector bindings, permissions**, published together (§7.10). | M |
| AB-04 | Request numbering pattern per service (e.g. `{SVC}-{YYYY}-{SEQ:5}`). | M |
| AB-05 | **Reference lists** (admin-managed lookups: banks, document types…), bilingual, end-dated, optionally synced from a connector. | M |

### 7.2 Fields

| ID | Requirement | P |
|---|---|---|
| AB-10 | Types: text, long text, number, decimal, **money (currency)**, percentage, boolean, date, **date range** (working days per location, Hijri display), time, email, phone, IBAN, national ID, single / multi select (static, reference list, **connector lookup**), **person / org unit / position picker**, attachment (count, types, size, sensitive), signature, **repeating group / table**, computed, read-only info; plus **custom field types contributed by coded features** (e.g. leave type picker). | M |
| AB-11 | Properties: key (immutable once published), bilingual label / help / placeholder, default (static, **expression over requester/profile/context**, or **connector prefill**), required, read-only, hidden, searchable, **sensitive** (masked in lists, logs, exports), used in title / documents / notifications. | M |
| AB-12 | **Field library** of reusable presets (e.g. "IBAN (Saudi)" with its validation). | S |
| AB-13 | Expression context: `requester.*` (group, subgroup, location, nationality, gender, service years, position, unit, manager level, contract flags), `beneficiary.*`, `request.*`, `step.*`, `today`, connector outputs. | M |
| AB-14 | Model changes create a new version. Existing requests keep their schema, and removed fields are hidden, never deleted. | M |

### 7.3 Forms

| ID | Requirement | P |
|---|---|---|
| AB-20 | Drag-and-drop designer: pages (wizard), sections, responsive columns, info banners. | M |
| AB-21 | Request form, resubmit form, and **step forms** (fields filled by a step's actor, e.g. letter reference). | M |
| AB-22 | Conditional visible / required / read-only (JSON Logic) on fields, sections and pages. | M |
| AB-23 | **Field access matrix per workflow step** (hidden / read-only / editable / required). | M |
| AB-24 | **Review page** with a data summary + **expected route with names and reasons** (simulation). | M |
| AB-25 | Live preview at desktop and phone sizes, in AR and EN, using production renderers. | M |
| AB-26 | Request drafts, resumable across web and mobile. | S |
| AB-27 | Accessible renderer (labels, error announcements, focus order, RTL). | M |

### 7.4 Validations

| ID | Requirement | P |
|---|---|---|
| AB-30 | Field rules: required, length, pattern, min/max, allowed values, date relative to today (±N calendar / working days), range order and length, file type / size / count. | M |
| AB-31 | Cross-field and business rules in JSON Logic. | M |
| AB-32 | Severity `block` / `warn` / `info` / `ok` with bilingual messages (the prototype's `Check` model). | M |
| AB-33 | **Remote validation** via a connector operation, with a timeout and a configurable on-failure behaviour. | M |
| AB-34 | Step-level validation on actions (note required on return/reject, ref on done, approvals blocked in a closed period). | M |
| AB-35 | Server authoritative; clients run the same rules for immediate feedback. | M |
| AB-36 | Custom validators from coded features appear in the designer with parameters. | S |

### 7.5 Rules and decision tables

| ID | Requirement | P |
|---|---|---|
| AB-40 | **Decision tables** (JSON rows of JSON Logic conditions → outputs; hit policy first / collect) in a grid editor, for routing, eligibility, SLA, amounts and document selection. | M |
| AB-41 | Rules are versioned with the service. Standalone **policies** (leave, needs) are shared by features and have their own dated versions. | M |

### 7.6 Workflows

| ID | Requirement | P |
|---|---|---|
| AB-50 | Step types: *Approval*, *Notify*, *Task / fulfil* (with ref + step form), *Signature / receipt*, *Decision* (outcome selects a branch), *System* (connector operation or coded handler; sync or async via the outbox), *Wait for event* (inbound event/callback, with a timeout), *Condition gateway*, *Parallel* (S), *Call sub-service* (S), *End*. | M |
| AB-51 | Assignee rules (CAP-01, extended): line manager; head of unit at level; chain up to level (one step per chief); specific positions (quorum any/all); work pool (unit); requester / beneficiary; person/position from a field; role; decision table / expression; external resolver (S). Vacant position → deputy → superior; no self-approval. | M |
| AB-52 | Per step: title, applies-when condition (with "not applied" reasons shown), SLA, reminder %, escalation (remind / notify superior / move to position), actions and labels, note/ref requirements, **return target** (requester or an earlier step; resubmission resumes at the returning step), step form, field access, notifications. | M |
| AB-53 | Delegation / substitution respected at assignment (§10.6). | S |
| AB-54 | **Simulator**: requester + field values → route with names, skipped steps and reasons. | M |
| AB-55 | Pre-publish checks: unreachable steps, dead ends, missing assignees, unbranched outcomes, unbound connectors. | M |
| AB-56 | In-flight requests stay on their version. Migration is an explicit, audited action. | M / S |
| AB-57 | Runtime for every service: inbox (plus config-approval tasks), timeline with live holders, audit, withdraw rules, optimistic locking, idempotent decisions. | M |

#### 7.6.1 Workflow engine choice

**Recommendation: a lightweight in-house engine** in `platform/workflow`, porting the prototype's route model (`prototype/src/domain/engine.ts`, `need.ts`).

| Reason | Detail |
|---|---|
| Already proven | The prototype engine already handles position-based approvers, deputy/superior fallback, quorum, step conditions, not-applied reasons, SLA and escalation, return-to-same-step, and decision steps that choose the next branch (Needs). Porting it is well-defined work. |
| Custom logic dominates | Position resolution, not-applied reasons, the requester timeline and the simulator would all have to be written as Flowable extensions anyway. |
| No model translation | Admins design with the simple step model. The engine runs that JSON directly, so there is no compile-to-BPMN step to keep in sync. |
| One data store | Requests, steps and decisions live in the platform's own tables, with no Flowable tables to sync. |
| Smaller stack | Fewer moving parts while the service builder is being validated. |

**Design:**
- Workflow definitions are **versioned JSON** managed by `platform/config` (§7.10). A request pins the definition version it started with.
- The engine sits behind a narrow interface that feature modules depend on. Feature modules never touch engine internals:
  ```java
  public interface WorkflowEngine {
      Instance start(StartCommand cmd);                 // build steps: conditions, expansion, assignee resolution, not-applied
      Instance decide(StepDecisionCommand cmd);         // approve / return / reject / done / receive / custom outcome
      Instance resubmit(ResubmitCommand cmd);           // resume at the returning step
      Instance withdraw(WithdrawCommand cmd);
      Instance signal(SignalCommand cmd);               // wait-for-event steps (correlation key / callback token)
      List<Task> tasksFor(UserId user);
      Simulation simulate(SimulateCommand cmd);         // route preview with names and reasons
  }
  ```
- Step progression, system steps and notifications run inside one DB transaction, with SAP and other external calls queued in the outbox. `step.opened`, `step.decided` and `request.completed` domain events are published through Spring Modulith.
- **Timers** (SLA reminders, escalation, wait-step timeouts, "N days before start" fulfilments) are stored as due dates on steps and processed by `@Scheduled` + ShedLock jobs.
- Wave-1 step types: approval, notify, task/fulfil, signature/receipt, decision (branch), system, wait-for-event, condition, end. **Parallel split/join and call sub-service are deferred (S)** until a service needs them.

**When to revisit Flowable (or a similar BPMN engine):** true parallel branches with joins, sub-processes and event-driven waits across many services; decision tables maintained in DMN by business users; or many services with complex timers, where maintaining the in-house engine becomes costly. Because feature modules only use `WorkflowEngine`, the engine can be swapped by adding a new implementation of that interface (the designer JSON would then compile to BPMN). No feature module would change.

### 7.7 Documents

| ID | Requirement | P |
|---|---|---|
| AB-60 | Per service: template, issue point (step / completion), numbering, signer (actual approver of a step, with title), verification code + QR, classification. | M |
| AB-61 | Template editor with placeholders (fields, context, approval chain), bilingual, live PDF preview, restricted mode. | M |
| AB-62 | Immutable PDFs; public verification page. | M |

### 7.8 Notifications

| ID | Requirement | P |
|---|---|---|
| AB-70 | Per event (created, assigned, reminder, escalated, returned, approved, rejected, completed, document issued, custom): recipients, channels, bilingual templates, deep link. | M |
| AB-71 | User preferences per module and kind; admins can lock mandatory ones. | M |

### 7.9 Extension points for coded features

| ID | Requirement | P |
|---|---|---|
| AB-80 | Coded features contribute building blocks to the service builder through Java SPI interfaces: `FieldTypeProvider`, `Validator`, `SystemStepHandler`, `DecisionStepHandler`, `AssigneeResolver`, `LookupProvider`, `DocumentHook`, plus a policy editor. Each declares a **parameter schema** so the designer can configure it. On the frontend, the module manifest contributes the matching `fieldTypes` and `stepPanels`. | M |
| AB-81 | Leave and Needs are built this way: their forms, notifications, documents and non-specialised steps stay configurable. | M |
| AB-82 | The platform discovers extensions by interface and never imports business modules. No admin-supplied scripts run on the server. | M |

### 7.10 Configuration lifecycle, versioning and governance

The prototype's policy versioning engine is **generalised** to every configuration object (services, policies, connectors, templates, reference lists).

| ID | Requirement | P |
|---|---|---|
| AB-90 | States: `draft` → (`awaiting`) → `scheduled` → `active` → `expired`; `cancelled`, `corrected`, `reverted`. | M |
| AB-91 | Change log (path, before, after, who, why) and a diff between any two versions. | M |
| AB-92 | Publish requires a reason + reference. **Second approval** can be switched on per object type. | M |
| AB-93 | Stale drafts are **rebased** object by object on the latest version at scheduling. If the same object changed in between, that is a conflict and publishing is refused. | M |
| AB-94 | **Sandbox** runs with connectors in mock or test mode. Test requests are flagged and excluded from reports. | M |
| AB-95 | Export / import packages between environments. | M |
| AB-96 | Retire a service: hidden for new requests, existing requests continue. | M |

---

## 8. Integration and extension points

### 8.1 Connector model

| ID | Requirement | P |
|---|---|---|
| IX-01 | **Connection** (versioned): type, base URL per environment, authentication, secret reference (Vault), TLS/mTLS, timeout, retries, rate limit, circuit breaker, health check; **egress allow-list** (SSRF protection). | M |
| IX-02 | Types: **SAP OData**, **SAP RFC/JCo** (if adopted), **REST/JSON** (with OpenAPI import), SOAP (C), Email, SMS, Push, SFTP (C). | M |
| IX-03 | Auth: SAP principal propagation (as the current user), OAuth2 client credentials, token exchange / SAML bearer, API key, basic (discouraged), mTLS. | M |
| IX-04 | **Execution identity** per operation: *as current user* (required for user-initiated SAP calls) or *as system* (technical user; only for approved operations, §16 Q2). | M |
| IX-05 | **Operation** (versioned, owned by a module): input/output JSON Schema, method/path/entity, JSONata request/response mapping, error mapping (bilingual message, retryable or not), idempotency key, sync / async. | M |
| IX-06 | Test console with masked request/response. | M |
| IX-07 | Connector templates ship with modules (e.g. `timeleave` ships "Post absence IT2001"), and admins bind them to connections. | M |

### 8.2 Extension points catalogue

| EP | Extension point | Where | Example |
|---|---|---|---|
| EP-01 | Lookup data source | Select/picker options, reference list sync | Banks, suppliers, materials |
| EP-02 | Prefill | Field defaults, info fields | Balance, current IBAN |
| EP-03 | Remote validation | Submit, step action | Budget availability |
| EP-04 | System step | Workflow (sync / outbox) | Post IT2001, create PR |
| EP-05 | Wait for event / callback | Workflow | PO created in SAP |
| EP-06 | Outbound events / webhooks | `request.*`, `step.*`, `document.issued`, module events | Notify an analytics system |
| EP-07 | Inbound API | Create request, post event, update reference data | External system starts a service |
| EP-08 | Assignee resolver | Workflow | External committee list |
| EP-09 | Org & identity source | Org sync, SU01 mapping | SAP OM / IT0105 |
| EP-10 | Channel providers | Notifications | SMS gateway, mail server |
| EP-11 | Document hooks | Before / after issue | Archive to a records system |
| EP-12 | Coded extensions (SPI) | Fields, validators, steps, resolvers | Leave, Needs features |

Each binding is versioned with the service, and has a timeout, a failure behaviour (block / warn / retry / continue), masked logging and metrics.

### 8.3 Events, webhooks and inbound API

| ID | Requirement | P |
|---|---|---|
| IX-20 | Webhook subscriptions: event filter (module, service, event, rule), target connection, JSONata payload, **HMAC-SHA256** signature, retries, dead-letter, replay. | M |
| IX-21 | Versioned event schemas, documented per module. | M |
| IX-22 | Inbound API: OAuth2 client credentials with scopes per module/service, idempotency keys, rate limits, audit. | M |
| IX-23 | Waiting steps completed by a matching correlation key or a one-time callback token. | M |

### 8.4 Integration monitor

Outbox and webhook queues (pending, failed with external error, dead-letter), retry / cancel with a reason (audited), connector metrics (latency, errors, circuit state), inbound call log, all filterable by module.

### 8.5 SAP S/4HANA connector templates

Direct OData/REST via the SAP Cloud SDK; JCo per object if adopted; **every user-initiated call runs as the user's SU01 user**; live reads for user-facing data, scheduled sync for reference lists; writes through the outbox with idempotency keys.

Candidate APIs (verify against the S/4 release and activated services):

| Portal need | Owning module | SAP object | R/W | Candidate interface |
|---|---|---|---|---|
| Org units, positions, holders, chiefs | platform/org | HCM OM (O, S, P; A002/A003/A008/B012) | R | Custom OData or RFC; **to confirm** |
| Employee master, SAP user link | platform/identity | PA IT0001/0002/0105 | R | Custom OData / HCM Fiori services |
| Personal data, bank, documents, family | mydata | IT0006, IT0009, doc infotypes, IT0021 | R/W | Custom OData or `HR_INFOTYPE_OPERATION` via RFC; **to confirm** |
| Absence types & quotas | timeleave | IT2001/2002 customizing, IT2006 | R | Custom OData |
| Post / delete leave; business trip | timeleave, finance | IT2001, IT2002 | W | `BAPI_ABSENCE_CREATE` / infotype operation; **to confirm** |
| Payslips | mydata | Remuneration statement | R | HCM Fiori payslip service / custom |
| Materials, stock | needs | Product, material stock | R | `API_PRODUCT_SRV`, `API_MATERIAL_STOCK_SRV` |
| Reservation | needs | MM reservation | W | `API_RESERVATION_DOCUMENT_SRV` |
| Goods issue / receipt | needs | Material document | W | `API_MATERIAL_DOCUMENT_SRV` |
| Suppliers | needs | Business Partner | R (+W) | `API_BUSINESS_PARTNER` |
| Framework contracts | needs | Purchase contract | R | `API_PURCHASECONTRACT_PROCESS_SRV` |
| Purchase requisition | needs | PR | W | `API_PURCHASEREQ_PROCESS_SRV` |
| Purchase order, delivery completed | needs | PO | R/W | `API_PURCHASEORDER_PROCESS_SRV` |
| Service acceptance | needs | Service entry sheet | W | Release-dependent; **to confirm** |
| Budget reservation / top-up / release | needs | PSM-FM earmarked funds | W | Custom OData / BAPI; **to confirm** |
| Assets for custody | needs | FI-AA | R | Fixed asset API / custom |

---

## 9. Domain model

### 9.1 Platform

| Entity (schema) | Notes |
|---|---|
| `module`, `feature` (platform_modules) | registry per §4.2 |
| `role`, `role_permission`, `role_assignment` | permissions scoped `module.feature.action` |
| `config_object` / `config_version` / `config_change` (platform_config) | generic versioned configuration: type (`service`, `policy`, `connection`, `operation`, `webhook`, `doc_template`, `notif_template`, `reference_list`), key, module, version, state, from_date, content JSONB, approval, base_id; append-only change log |
| `reference_list_item` | list key, code, labels, end-dated, external key |
| `service_definition` (materialised active version) | schema, forms, rules, workflow definition (JSON), documents, notifications, bindings |
| Org reference (platform_org) | `org_unit`, `position`, `person` (incl. **sap_user (SU01)**, PERNR, group, subgroup, location, nationality, gender, hired_at, contract flags), `employee_group` |
| Requests (platform_requests) | `request` (id, service ID, module, **service version**, policy versions, requester, beneficiary, status, channel, **data JSONB**, searchable columns, optimistic lock), `step` (mode, status, agent rule, positions, assignees, quorum, condition, SLA, escalation, role/branch/outcome, batch), `step_decision`, `not_applied_step`, `fulfilment`, `audit_entry` (append-only) |
| Documents / notifications | `document` (kind, type, number, template code, verify code, storage key), `notification`, `notification_pref`, `device_token` |
| Integration | `outbox` (connection, operation, payload, idempotency key, acting identity, status, attempts, error, external ref), `webhook_delivery`, `inbound_event` |

### 9.2 Business modules (own schemas)

| Module | Tables |
|---|---|
| `timeleave` | `leave_request_info` (type, from, to, days, working days, half day, entitlements, pay breakdown, cancel_of), `absence_type_link`, synced `absence_history`, `balance`, `leave_ops` (windows, groups, period close) |
| `needs` | `need_info`, `need_line`, `need_procurement`, `need_offer`, `need_receipt` (+ lines, signers, signatures), `need_handover` (+ lines), `custody_entry`, synced `storage_location`, `material`, `stock`, `supplier`, `framework_contract`, `pool_stock`, `need_ops` (coordinators) |
| `mydata` | read models for profile: `employee_document`, `payslip`, `dependant` (synced / live) |

---

## 10. Functional requirements by module

Priority: **M** = must (Wave 1), **S** = should, **C** = could.

### 10.1 Platform (cross-cutting features)

| ID | Requirement | P |
|---|---|---|
| ORG-01 | Sync units, positions, holders, deputies and chiefs from SAP OM (scheduled delta + manual refresh). | M |
| ORG-02 | Agent rules: lineManager, orgHead(level), chain(upTo), positions(quorum), pool(unit), requester (+ builder extensions §7.6). | M |
| ORG-03 | Line manager = chief of the employee's unit; if the employee is the chief, the chief of the parent unit. | M |
| ORG-04 | Vacant → deputy → superior, with a readable reason; if nobody, the step stays open and the admin is notified. | M |
| ORG-05 | No self-approval. | M |
| ORG-06 | A holder change moves open tasks to the new holder, with an audit line and a notification. | M |
| WF-01 | SLA reminders at %, then remind / notify superior / move; never auto-approve. | M |
| WF-02 | Inbox: all current steps where I am a current holder and have not decided (incl. fulfilment and config-approval tasks), due / overdue, "done by me". | M |
| WF-03 | Request timeline: steps, who is there now, decisions, notes, resolution reasons; full bilingual audit. | M |
| CAT-01 | Catalogue **grouped by module**, with wave status; AR/EN search over services and my requests; ⌘K palette on desktop; home with quick actions, pending tasks, recent requests, alerts. | M |
| NT-01 | Notification kinds: task, status, document, expiry, reminder, policy; in-app centre (mark read / all), push, email; preferences per module and kind; deep links. | M |
| DOC-01 | Official template set per the prototype (bilingual header with emblem, metadata block, title bar with badge, signature + e-stamp, footer with **verification code + QR + template code/version**, classification, draft watermark); immutable PDFs; public verification; print / download / share. | M |

### 10.2 Module `timeleave`: Time & Leave

**Feature `leave-policy`** (policy admin). Its versioning follows §7.10.

| ID | Requirement | P |
|---|---|---|
| POL-01 | Content: leave types, routes, entitlements, calendar (weekends per location, holidays), early-warning thresholds. | M |
| POL-02 | Scheduling blocked also when an enabled type has no SAP absence-type link, or a date / Hijri window is incomplete. | M |
| POL-03 | Correction version; revert only if unused, not built upon, and not the only version. | M |
| POL-04 | Per-object history, and export of a version as a document. | S |

**Initial leave types (version 2026.1):**

| Type | Section | Route | Pay |
|---|---|---|---|
| Annual | core | R1 Line manager | paid, annual balance |
| Emergency | core | R1 | paid, emergency balance |
| Sick | medical | R2 Personnel affairs directly (manager notified) | partial (pay tiers) |
| Patient escort inside / abroad | medical | R2 | partial |
| Exam | other | R3 Manager then personnel affairs | paid |
| Be with them (half day, seasonal) | family | R1 | paid |
| Hajj (Hijri window, once in career) | family | R3 | paid |
| Marriage, Maternity, Iddah | family | R3 | paid |
| Bereavement | family | R2 | paid |
| Exceptional unpaid | other | R4 Management chain then HR | unpaid |

**Feature `leave-operations`**

| ID | Requirement | P |
|---|---|---|
| OPS-01 | Seasonal windows, entitlement groups, **period close** (blocks requests, cancellations and approvals in the closed period; earliest safe date; in-flight list). These take effect immediately and are logged. | M |

**Feature `leave-request` (TM-01)**

| ID | Requirement | P |
|---|---|---|
| LV-01 | Type picker: most-used as cards with a balance ring, others in rows, ineligible types collapsed with the reason. | M |
| LV-02 | Range calendar with weekends and holidays per work location; fixed-days, half days, closed-period limit. | M |
| LV-03 | Live evaluation with `ok/info/warn/block` checks: eligibility (gender, parent, outside home, service years, scope), fixed days / max per request / max months per N years, windows (advance, after-end working days, fixed, Hijri, seasonal), period close, overlap, balance, attachment. | M |
| LV-04 | Sick/escort **pay tiers** per N-year cycle and employee group; split preview; early warning. | M |
| LV-05 | **Linked entitlements** (tickets, advance salary): eligibility, min days, per-year limit, opt-in, fulfilment step after approval or N days before the start. | M |
| LV-06 | Request stores the policy version, days, working days and pay breakdown. | M |
| LV-07 | Final approval → post **IT2001** (linked subtype), update the balance, issue the **Leave Decision** (`serial/year`, actual chain and signer, verification/QR), notify the employee. | M |

**Feature `leave-cancellation` (TM-01C)**

| ID | Requirement | P |
|---|---|---|
| LV-08 | Allowed per type (`beforeStart`/`untilEnd`/`never`) and route (`none` = notify the manager, or a named route) → approval by the entity that executed each fulfilled entitlement (if required) → delete the absence and restore the balance → a reversal task or notification per entitlement. | M |

**Feature `leave-history`**

| ID | Requirement | P |
|---|---|---|
| LV-09 | One row per leave, merged from SAP absences and portal requests; filters by year and type; year summary (taken / upcoming / pending); preview in "Me". | M |

### 10.3 Module `needs`: Needs, Custody & Assets

Journey segments: Request → Approval → Preparation → Purchase → Supply → Handover. Route template (step roles provided as coded step types): coordinator → chain → technical entity (specify / provide / reroute) → [handover from pool] → store (reserve / purchase) → procurement preparation → purchase approval (bands) → budget → [tender] → [quotes → evaluation] → [top-up] → [award approval] → system: auto PR → PO (wait for SAP) → receipt (batches, committee) → handover → custody.

**Feature `need-request` (AS-01)**

| ID | Requirement | P |
|---|---|---|
| ND-01 | Only chief-position holders at or above `openerMinLevel` (default: department) can open a need; beneficiary = self or anyone in their unit subtree (D-017). | M |
| ND-02 | 3-step wizard: who & what → details → review with the expected route. | M |
| ND-03 | Needs catalogue: familiar names → material numbers, with an indicative price. | M |
| ND-04 | Resolve at submission: technical entity, store (only if at the beneficiary's site), sector coordinators, availability source (store / entity pool / contract / none). | M |
| ND-05 | Decision steps pick branches; inactive branches are skipped with a reason. | M |
| ND-21 | Withdraw before procurement unless a line is reserved; afterwards a cancellation request decided by procurement. | M |
| ND-23 | Line statuses and cumulative quantities. | M |
| ND-24 | The requester sees stages with SAP references and expected dates. | M |

**Feature `specification`**

| ID | Requirement | P |
|---|---|---|
| ND-06 | Technical entity approves and specifies each line; can **reroute** to another entity. | M |
| ND-07 | **Provide from entity pool** (licences, seats, framework call-off): no procurement or budget; handover signed by the entity then the beneficiary; digital custody. | M |

**Feature `store` (+ store desk)**

| ID | Requirement | P |
|---|---|---|
| ND-08 | Per line: reserve (SAP reservation) or send to purchase; the store may specify when there is no entity. | M |
| ND-22a | **Store desk**: queue per store / site, incl. receipt & handover officers at sites without a store. | M |

**Feature `procurement` (+ procurement desk)**

| ID | Requirement | P |
|---|---|---|
| ND-09 | Preparation: estimate, method with reason, framework contract, purchase file, evaluator; **split-purchase alert**. | M |
| ND-10 | **Delegation bands** for purchase and award approval (default ≤ SAR 500K procurement director; above → tender committee, quorum `all`); direct purchase uses the next band up. | M |
| ND-12 | Quotes: ≥ N offers, SAP BP or new supplier, currency + SAR, validity, attachment; a shortfall needs a justification and escalates. | M |
| ND-13 | Evaluation with a rationale. | M |
| ND-14 | Award approval `always` / `exception`; otherwise auto-award. A tender result needs no second approval unless tolerance is exceeded. | M |
| ND-15 | Tender: reference, result, winner, amount, committee minutes. | M |
| ND-16 | Auto released PR in SAP; PO created in SAP and read back (wait-for-event); framework call-off. | M |
| ND-17 | Expected-date changes logged and notified. | M |
| ND-22b | **Procurement desk**: whole queue + decisions outside steps (expected date, cancellations). | M |

**Feature `budget`**

| ID | Requirement | P |
|---|---|---|
| ND-11 | Earmarked funds reservation, top-up above tolerance, release on cancel / remainder close. | M |

**Features `receipt` and `handover`**

| ID | Requirement | P |
|---|---|---|
| ND-18 | Receipt reports in batches; committee inspection above the threshold (default SAR 50K) or flagged categories; issued at the last signature (`INS`/`REC`-year-serial); GR / service entry posted to SAP. | M |
| ND-19 | Close remainder (PO delivery completed) and release the budget. | M |
| ND-20 | Handover per batch (`each`/`complete`): handing party signs, then the beneficiary → handover note `ST-year-serial`, goods issue, custody entries. | M |

**Feature `custody` (AS-02 read)**

| ID | Requirement | P |
|---|---|---|
| CU-01 | "My custody": items, qty, item/asset no., handover no./date; digital custody separate; preview in "Me". | M |
| CU-02 | Register keyed by employee + item/asset; exposed API for other modules (clearance in `lifecycle`). Returns and transfers in Wave 2. | M / W2 |

**Feature `needs-policy`** (versioned): technical entities, categories, stores, sites, catalogue, authority bands, purchase methods, entity pools, and rules (opener level, chain, coordinator step, tender threshold, urgent, split window, min offers, tolerance, award rule, offer attachment, inspection threshold, handover mode, remedy days, lead days, SAP numbers integration/manual, SLA per role), with integrity checks. **Operations**: sector coordinators, pool stock. **Simulator**.

### 10.4 Module `mydata`: My Data & Documents

| ID | Feature | Implementation | Definition |
|---|---|---|---|
| MD-01 | `personal-data` | configured | Fields: data to update (mobile, email, address, marital status, card no), new value, proof (required-when). Workflow: personal affairs review. System step: update PA infotype. |
| MD-02 | `bank-account` | configured | Fields: bank (reference list / SAP lookup), IBAN (SA + 24, validated), bank letter required. Workflow: personnel affairs verify → **payroll second confirmation**. System step: update IT0009; an info field shows the applicable payroll cycle. |
| MD-05 | `document-update` | configured | Fields: document (list), new number, expiry ≥ today, copy required. Workflow: personnel affairs review. System step: update the document + expiry. Started from the expiry alert with a prefill. |
| ME-01 | `my-profile` (view) | coded | Personal & job data, balances, documents with expiry, payslips, dependants; widgets contributed by other modules (custody, leave history). Read from SAP as the user. |
| ME-02 | `settings` | platform | Language, theme, notification preferences. |

### 10.5 Module `letters`: Letters & Official Documents

| ID | Feature | Implementation | Definition |
|---|---|---|---|
| DC-01 | `employment-letter` | configured | Fields: addressed to, language (AR/EN/both), include salary. Workflow: personnel affairs pool **reviews and approves**, then a system step issues the letter (the letter number is the reference, so HR does not type one). Output: letter document with number, verification code and QR. |

### 10.6 Module `finance`: Employee Finance

| ID | Feature | Implementation | Definition |
|---|---|---|---|
| FN-01 | `business-trip` | configured (hybrid later) | Fields: destination, from, to, purpose, invitation letter. Workflow: line manager → assignments & entitlements (budget commitment, decision). System step: record IT2002 attendance, pay the advance. Output: **Assignment Decision** document. |

All configured services support resubmission after return (a pre-filled resubmit form that resumes at the step that returned it).

### 10.7 Delegation (platform)

| ID | Requirement | P |
|---|---|---|
| ME-03 | The prototype's persona switcher / "act as" is **demo-only and removed**. Replace it with role-based navigation and optional audited **delegation / substitution** for a period. | M / S |

### 10.8 Admin portal screens

| Area | Screens |
|---|---|
| **Modules** | Module & feature registry, toggles, ordering, business owners |
| **Service builder** | Per module: service list; editor (metadata & eligibility, data model, form designer, rules & decision tables, workflow designer + simulator, documents, notifications, bindings); versions & diff; sandbox; publish / approve; export / import |
| **Reference lists** | Lists, items, sync bindings |
| **Integration** | Connections, operations (test console, OpenAPI import), webhooks, inbound API clients, monitor |
| **Module admin features** | `timeleave`: leave policy, operations. `needs`: needs policy, operations, simulator. |
| **Org & reference data** | Org tree, SAP reference viewers, sync status |
| **Security** | Roles & permissions (module-scoped), delegations, governance (second approval) |
| **Reports** | Per module: requests by service/status/SLA breach, cycle time per step, needs in purchase, spend by band |

---

## 11. Identity, authentication and authorisation

**Decided:** any OData / API call to SAP made on behalf of an employee runs **with that employee's SAP user (SU01)**.

| ID | Requirement |
|---|---|
| SEC-01 | SSO via OIDC (Authorization Code + PKCE) for web, admin and mobile; no passwords stored in the portal. |
| SEC-02 | 1:1 mapping portal user ↔ SU01 user (primary source IT0105 subtype 0001). No mapping → no SAP-backed services. |
| SEC-03 | **Principal propagation** to S/4HANA for every user-initiated call; never a shared technical user. |
| SEC-04 | Technical user only for system-initiated work, and only for approved operations (IX-04). |
| SEC-05 | Portal authorisation = org positions + **module-scoped permissions** (MOD-05); SAP enforces its own authorisation on every call. |
| SEC-06 | Short-lived access tokens (≤ 15 min), refresh rotation, biometric unlock on mobile, logout everywhere. |

**Implemented now (sandbox, decided 2026-09-22):** sign-in with the SAP user + password (Basic) against
`GET /sap/tamkeen/profile/me`; the portal session is in memory only (web HttpOnly SameSite=Strict cookie, mobile bearer
token in the keychain). The SAP `MYSAPSSO2` logon ticket replaces the password whenever SAP issues one. Employee data
is proxied live and never persisted. Failed sign-ins are throttled (5 per 15 min per user) so the portal cannot lock SAP
users. This is option C below in its safest form; moving to A or B remains the target once Basis configures it.

**Principal propagation options** (to choose with SAP Basis):

| Option | How | Notes |
|---|---|---|
| **A. OAuth 2.0 SAML Bearer Assertion** (recommended start) | IdP authenticates the user → backend creates a SAML assertion → S/4 `SOAUTH2` issues an OAuth token → OData called with it | Standard for S/4 OData on-prem |
| **B. Short-lived X.509 client certificates** | Per-user certificate → S/4 `CERTRULE` maps it to SU01 | Works for OData **and** RFC/JCo |
| C. Logon tickets / Basic with user passwords | – | **Rejected** |

**Security non-functionals:** OWASP ASVS L2; sandboxed expressions only (JSON Logic, JSONata, restricted Thymeleaf); no admin-supplied server code; egress allow-list; file checks + AV; sensitive-field masking (lists, logs, exports, webhooks); encryption at rest, TLS 1.2+; audit of all admin and configuration changes; PDPL / NCA ECC (to confirm); data residency in the Kingdom.

---

## 12. API design

REST/JSON, `/api/v1`, OpenAPI grouped **per module**, bilingual `{ar, en}` texts, RFC 9457 errors with structured `checks[]`.

| Area | Endpoints (examples) |
|---|---|
| Platform: catalogue & modules | `GET /modules`, `GET /catalog?q=` (grouped by module) |
| Platform: services runtime | `GET /services/{id}/definition`, `POST /services/{id}/evaluate` (checks + expected route), `POST /services/{id}/lookups/{field}` |
| Platform: requests & tasks | `POST /requests`, `GET /requests?mine`, `GET /requests/{id}`, `/resubmit`, `/withdraw`, drafts; `GET /tasks`, `GET /tasks/done`, `POST /tasks/{stepId}/decision` |
| Platform: me, documents, notifications | `GET /me`, `GET /documents/{id}`, `POST /attachments`, `GET /verify/{code}` (public), `GET /notifications`, read / read-all, `POST /devices` |
| `timeleave` | `GET /timeleave/types`, `POST /timeleave/leave-requests/evaluate`, `POST /timeleave/leave-requests`, `POST /timeleave/leave-requests/{id}/cancellation[/evaluate]`, `GET /timeleave/history?year=&type=`, `GET /timeleave/balances` |
| `needs` | `GET /needs/context`, `POST /needs/preview-route`, `POST /needs`; step actions `/needs/{id}/specify`, `/provide`, `/reroute`, `/store-decision`, `/prepare`, `/quotes`, `/evaluate`, `/budget`, `/tender`, `/expected-date`, `/receipts`, `/receipts/{rid}/sign`, `/close-remainder`, `/handover/start`, `/handover/sign`, `/cancel-request`, `/cancel-decision`; `GET /needs/desks/procurement`, `GET /needs/desks/store`; `GET /needs/custody/mine` |
| Admin | `/admin/modules`, `/admin/config/{type}` (draft, edit, diff, validate, simulate, sandbox, schedule / publish, approve / return, cancel, correct, revert, export, import), `/admin/timeleave/policy/*`, `/admin/needs/policy/*`, `/admin/integration/*`, `/admin/roles`, `/admin/org` |
| Inbound | `/inbound/v1/requests`, `/inbound/v1/events`, `/inbound/v1/reference/{list}` (OAuth2 client credentials) |

---

## 13. Non-functional requirements

| Area | Requirement |
|---|---|
| **Localisation** | Arabic (default, RTL) and English; Latin digits; Gregorian with Hijri display; weekends / holidays per location. |
| **Accessibility** | WCAG 2.1 AA, including dynamically rendered forms. |
| **Performance** | p95 API < 300 ms excluding external time; < 1.5 s with live SAP calls; service definitions cached per version; web first load < 2.5 s on 4G. |
| **Scalability / availability** | Stateless backend, horizontal scale; 99.5 % business hours (to confirm); graceful degradation when SAP is down (cached reads with a timestamp, queued writes). |
| **Maintainability** | Module boundaries verified in CI (backend and frontend); generators for modules/features; each module has a README and generated module docs; ADRs in `docs/adr`. |
| **Configurability limits** | Tested ceilings (e.g. ≤ 150 fields per service, ≤ 60 workflow steps, ≤ 500 rows per repeating group), enforced by the designer. |
| **Data retention** | Per records policy (to confirm); audit, config changes and ops log never hard-deleted. |
| **Time** | UTC storage; business dates in the location's time zone; SLA in calendar hours by default (working hours optional, to confirm). |
| **Observability** | Metrics and logs tagged by module and feature; dashboards per module (queues, SLA breaches, connector health). |
| **Quality** | ≥ 80 % coverage on engine and module logic; `@ApplicationModuleTest` per module; rules conformance suite (Java ⇄ TS); acceptance suite reproducing prototype journeys R1–R16 and all need branches; the §1.1 configuration-only acceptance test. |

---

## 14. Mobile-specific requirements

| ID | Requirement |
|---|---|
| MB-01 | Parity with employee web for all runtime features, including **any configured service** (dynamic renderer), handover signature, custody, leave history and documents. |
| MB-02 | No designer / admin features on mobile. Desk queues are read + step actions only. |
| MB-03 | Push deep links; badge = open tasks. |
| MB-04 | Camera capture with compression; biometric lock; screenshot blocking on sensitive screens (S); root/jailbreak detection (S). |
| MB-05 | OTA updates via EAS Update. New or changed configured services never require a store release. |

---

## 15. Delivery phasing (suggested)

| Phase | Content |
|---|---|
| **0: Foundations** | Monorepo + **feature-driven skeletons** for all four apps, module/feature **generators**, module registry, CI with boundary checks; SSO + **SU01 principal propagation PoC against QAS (biggest risk, do first)**; outbox; org sync; design system port |
| **1: Platform engine** | Config versioning; service definition; fields, forms (web renderer), rules, workflow designer + in-house workflow engine (port of the prototype engine); inbox, timeline, notifications, documents + verification |
| **2: Integration** | Connections, operations, JSONata, SAP connector templates, webhooks, inbound API, monitor |
| **3: Configured modules** | `mydata`, `letters`, `finance` services built **in the admin portal** (platform acceptance test) |
| **4: `timeleave` module** | Policy, operations, request, cancellation, history, IT2001 |
| **5: `needs` module** | All features: request, specification, store, procurement, budget, receipt, handover, custody, policy |
| **6: Mobile GA & hardening** | Native renderer parity, performance, security testing, UAT, go-live |

---

## 16. Open questions / decisions needed

| # | Question | Why it matters |
|---|---|---|
| Q1 | **JCo or OData only?** Which HCM / FM objects have released OData on your S/4 release? | Adapter design; X.509 needed if RFC is used |
| Q2 | **Posting identity** for approvals and automatic steps (manager vs HR clerk vs technical user for IT2001, auto PR)? | PFCG roles, IX-04, SEC-04 |
| Q3 | **Principal propagation method** and **IdP** (SAML bearer / X.509; IAS / AD FS / Entra)? | Identity design |
| Q4 | **Licensing**: does every employee have an SU01 user with a suitable licence? | The SU01-per-user requirement depends on it |
| Q5 | **Workflow engine**: in-house engine for now (recommended, §7.6.1). Agree on the triggers for revisiting Flowable later? | Build effort vs flexibility |
| Q6 | **Module map**: confirm the 16 modules = the 16 catalogue domains, and the business owner of each. | Registry, permissions, admin ownership |
| Q7 | Base Java package / organisation namespace (skeleton uses `org.gcc.usp`; renaming is mechanical)? | Skeleton |
| Q8 | Who may design and publish services? Is second approval mandatory for publication? | Governance defaults |
| Q9 | Hosting: on-prem or an in-Kingdom cloud; Kubernetes or OpenShift? | Infra |
| Q10 | Email / SMS in Wave 1; mobile distribution (stores vs MDM)? | Channels, release |
| Q11 | SLA clock: calendar vs working hours? | Workflow engine |
| Q12 | Retention periods and the applicable security framework (NCA ECC, PDPL)? | NFRs |
| Q13 | Final routes for FN-01, MD-01/02/05 and DC-01: who signs them off? | Configuration content |
| Q14 | Delegation / substitution in Wave 1? | Replaces the prototype's "act as" |
