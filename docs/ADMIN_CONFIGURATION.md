# Admin Configuration Catalogue (live document)

Everything an administrator can change without a release. All stored in **PostgreSQL** (schema per module).
**Versioned** = goes through the version machine (draft → safety check → scheduled → optional second approval → active);
requests keep the version they were submitted under. **Operational** = takes effect immediately, logged in the ops log.
Update this file in the same change that makes a setting configurable.

Status: ✅ built · ⬜ planned (slice in brackets)

## Platform

| Setting | Kind | Prototype today | Status |
|---|---|---|---|
| Languages (code, name, direction, default, enabled) | Operational | ar/en fixed | ✅ `settings.language` |
| Managers of each versioned configuration (SAP positions), second approval on/off and the approving position | Operational (ops log) | one hard-coded admin set | ✅ `config.config_set` |
| Bootstrap administrators (employee numbers, first run / recovery) | Environment `USP_BOOTSTRAP_ADMINS` | — | ✅ |
| **Platform users**: accounts without an SAP user (not employees) — name (per language), email, administrator flag, enabled; temporary password on create/reset, changed at first sign-in (≥ 12 characters, not containing the user name, bcrypt-hashed) | Operational (admin portal → Platform users) | — | ✅ `identity.platform_user` |
| First platform administrator (created at start-up while no enabled administrator exists; temporary password) | Environment `USP_BOOTSTRAP_ADMIN_USERNAME` / `USP_BOOTSTRAP_ADMIN_PASSWORD` | — | ✅ |
| Platform admin / designer roles, by SAP position | Operational | hard-coded persons | ⬜ [0] |
| Org-unit role mappings: personnel pool, payroll, entitlements, general services, IT, procurement, budget position | Operational | O-211, O-121, O-122, O-150, O-140, O-130, S-123 in code | ⬜ [0] |
| Locations: country, weekend days, timezone | Operational | fixed Fri/Sat, Riyadh | ⬜ [0] |
| Default SLA per step, escalation threshold (80%), second-approval SLA (48 h) | Operational | constants | ⬜ [0] |
| Request id pattern, document numbering, form codes, letterhead | Operational | constants | ⬜ [0] |
| Expiry alert window (30 days): documents and family documents flagged "expiring" on Me | Operational | constant | ⬜ [0] (a constant in `@usp/api-client` today) |
| Currencies | Operational | SAR constant | ⬜ [4] |
| Notification triggers: channel defaults (in-app / push / email) and wording (per language) | Operational | 32 fixed triggers | ⬜ [0] |

## Me (Slice 1.3)

| Setting | Kind | Prototype today | Status |
|---|---|---|---|
| Digital card QR: signing secret, how long a code stays valid (default 24 h) | Environment `USP_CARD_SECRET` (defaults to `USP_VERIFY_SECRET`), `USP_CARD_CODE_VALIDITY` | decorative QR | ✅ |
| How many months of payslips "My pay" lists (1–36, default 12) | Environment `USP_PAYSLIP_MONTHS` | 3 seeded | ✅ |
| SAP paths of the self-service reads (SAP-002 … 005) | Environment (`usp.sap.paths.*` in application.yml) | — | ✅ |
| Each person's language, appearance and text size | Per person (Me › Settings; `settings.person_preference`), not an administrator setting | device only | ✅ |
| Which widgets Me shows, in which order | Code (each module adds its own; order in its manifest) | hard-coded | — (make operational with the Home widgets in 1.5 if wanted) |

## Home & catalogue

| Setting | Kind | Prototype today | Status |
|---|---|---|---|
| Catalogue domains: name and description (per language), icon, colour, order | Operational (admin portal → Service catalogue; logged in `catalog.change_log`) | seed array | ✅ `catalog.domain` |
| Catalogue services: domain, name, what it covers, who requests it, where it ends, search words (per language), how often requested, order, status — available / wave 2 / wave 3 / later / hidden / merged into another. Added with a new code; never deleted (hidden instead). "Available" only for a service that is coded or configured; a service on the dock must stay available; taking a service out of "available" stops new requests at once (the server refuses them; requests in flight continue) | Operational (same screen and log) | seed array | ✅ `catalog.service` (catalogue 1.0 loaded by migration) |
| Home services dock: which available services, their order, short label (per language), icon, colour; at most `USP_CATALOG_DOCK_MAX` (default 4), then "Services" | Operational (same screen and log; saved as a whole, with its version) | hard-coded | ✅ `catalog.dock_item` (Home draws it in [1.5]) |
| How many catalogue changes the admin screen lists | Environment `USP_CATALOG_LOG_SIZE` (default 200) | — | ✅ |
| Home widgets available / default order | Operational | hard-coded | ⬜ [1] |

## Service designer (CAP-02)

| Setting | Kind | Status |
|---|---|---|
| Services: fields, forms, validations, conditions, steps, assignees, SLAs, step forms, outputs, notifications, audience | Versioned | ⬜ [2] |
| Document templates (merge tokens, per language) | Versioned | ⬜ [2] (DC-01 template is in code today) |
| Registers (expiry, renewal) | Versioned | ⬜ [2] |
| SAP bindings for service outputs / profile fields (contract bindings) | Versioned | ⬜ [2] |
| Service templates, clone, import/export | Operational | ⬜ [2] |
| Per step: the decisions its holder may take (`decisions`: approve / return / reject, done, receive); default = the prototype's (approval steps approve, return, reject; fulfilment steps done) | Versioned (with the service) | ✅ in `config-packages` today; designer UI [2] |
| Per service: when the requester may withdraw (`withdraw`: `beforeDecision` = while nobody else has decided, the default; `never`) | Versioned (with the service) | ✅ in `config-packages` today; designer UI [2] |
| Per service: icon on request rows and tasks (`icon`, a UI-kit icon name) | Versioned (with the service) | ✅ in `config-packages` today; designer UI [2] |

## Leave policy (TM-01)

| Setting | Kind | Status |
|---|---|---|
| Leave types, eligibility, pay tiers, limits, attachments, warnings | Versioned | ⬜ [3] |
| Routes (who approves which type/case) | Versioned | ⬜ [3] |
| Entitlements and accrual rules | Versioned | ⬜ [3] |
| Calendar: holidays, weekends per location | Versioned | ⬜ [3] |
| Governance: second approval, audience | Versioned | ⬜ [3] |
| Operations: seasonal windows, exception groups, period close | Operational | ⬜ [3] |

## Needs policy (AS-01)

| Setting | Kind | Status |
|---|---|---|
| Categories, entities, stores, sites, catalogue items | Versioned | ⬜ [4] |
| Value bands and procurement methods (quotes, tender thresholds) | Versioned | ⬜ [4] |
| Pools, routing rules, SLA per role | Versioned | ⬜ [4] |
| Operations: coordinators, pool stock | Operational | ⬜ [4] |

## Communications policy

| Setting | Kind | Status |
|---|---|---|
| Sectors (unit, publisher positions) | Versioned | ⬜ [5] |
| Kinds (news, circular, story), acknowledgement rules, limits | Versioned | ⬜ [5] |

## Deliberately not configurable
SAP connection (URL, client, timeouts, `USP_SAP_MAX_PARALLEL` — how many SAP calls one list page may run at once) are
deployment environment variables, not admin screens. Session and login-throttle limits are security settings owned by
operations. List page sizes (`usp.requests.page-size` / `max-page-size`) and the length limits of decision notes and
references (`usp.workflow.note-max-length` / `ref-max-length`) are deployment settings in `application.yml`.
A reason is always required to return or reject (platform rule, AB-34), and a returned request always goes back to its
requester (the prototype's rule; returning to an earlier step is in the requirements, AB-52, but not in the prototype).
