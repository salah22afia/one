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
| Expiry alert window (30 days) | Operational | constant | ⬜ [0] |
| Currencies | Operational | SAR constant | ⬜ [4] |
| Notification triggers: channel defaults (in-app / push / email) and wording (per language) | Operational | 32 fixed triggers | ⬜ [0] |

## Home & catalogue

| Setting | Kind | Prototype today | Status |
|---|---|---|---|
| Catalogue domains and services (names, icons, order, wave / visibility) | Operational | seed array | ⬜ [1] |
| Home services dock (which services, order) | Operational | hard-coded | ⬜ [1] |
| Home widgets available / default order | Operational | hard-coded | ⬜ [1] |

## Service designer (CAP-02)

| Setting | Kind | Status |
|---|---|---|
| Services: fields, forms, validations, conditions, steps, assignees, SLAs, step forms, outputs, notifications, audience | Versioned | ⬜ [2] |
| Document templates (merge tokens, per language) | Versioned | ⬜ [2] (DC-01 template is in code today) |
| Registers (expiry, renewal) | Versioned | ⬜ [2] |
| SAP bindings for service outputs / profile fields (contract bindings) | Versioned | ⬜ [2] |
| Service templates, clone, import/export | Operational | ⬜ [2] |

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
SAP connection (URL, client, timeouts) are deployment environment variables, not admin screens. Session and login-throttle limits are security settings owned by operations.
