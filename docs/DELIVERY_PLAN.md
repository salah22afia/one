# Delivery Plan (live document)

Goal: **100% of the prototype's business and UI** (`prototype/`, v0.18) as a production platform: Java/Spring Boot +
PostgreSQL backend, React web + admin, React Native (Expo) mobile. Specs extracted from the prototype, file by file,
drive every slice (core engine, service designer, leave, needs, home/comms/admin, screens/UI).

Ground rules (from the business owner, 2026-09-22):
- Business and UI exactly as the prototype; admin settings stored in PostgreSQL.
- **No data replicated from SAP** except what the owner confirms (see `SAP_INTEGRATION.md` → "Confirmed persistence").
- **Approvers come from SAP on the fly** (positions, holders, deputies).
- Every SAP API is recorded in `SAP_INTEGRATION.md` with sample request/response, in the same change.
- i18n everywhere: catalogs per language + language-keyed data texts; new languages without code changes.
- Clean, modular code (Spring Modulith modules, feature folders); every slice ends green (tests, lint, typecheck, builds).
- No sample/mock data in real databases; examples only when the owner asks.

Status: ✅ done · 🔄 in progress · ⏳ next · ⬜ planned

## Slice 0 — Platform foundations

| # | Item | Status |
|---|---|---|
| 0.1 | Monorepo, feature-driven skeletons, module registry, generators, boundary checks | ✅ |
| 0.2 | SAP sign-in (Basic → in-memory session; MYSAPSSO2 ticket preferred), live employee profile (SAP-001) | ✅ |
| 0.3 | i18n: `LocalizedText` maps, backend `messages_<lang>.properties`, UI catalogs `locales/<lang>.json`, messages stored as keys (audit, reasons), languages managed in PostgreSQL | ✅ |
| 0.4 | Org & approvers from SAP on the fly (SAP-010 … 014): holder → deputy → superior, no self-approval, cycle guard; inbox by SAP positions; `org` tables removed | ✅ (contracts proposed to SAP team) |
| 0.5 | **Version machine** `platform.config` (one engine for leave, needs, comms, designer — each registers a `ConfigKind`): draft/scope → checks (past, taken, before tip, awaiting, conflict, empty + the kind's own) → schedule (date, reason, reference) → optional second approval (holder of a SAP position, never the author) → in force on its date; correction, revert (blocked when used, later version, only version), rebase of stale drafts object by object, change log, diff, ops log. API `/api/v1/admin/config/{kind}`. UI comes with each policy center; activation notifications with 0.8 | ✅ backend |
| 0.6 | **UI kit + shell**. Web (`@usp/ui-web`): the prototype stylesheets copied unchanged (tokens, components, motion, screen families, deeplook), icons, motion vocabulary (springs, page push/pop, island toast, sheets, swipe rows, ticker, ring, seal), base components, page chrome (large title → glass bar), shell (sidebar ≥900, desk bar + ⌘K ≥1024, glass tab bar that shrinks on scroll + search island), search on the catalogue. Admin app on the same frame. Mobile: the same tokens (light/dark), Cairo, the full icon set (react-native-svg), base components, page frame, floating glass tab bar + search island. Fixed on the way: the starting language's direction was never applied (only on switching). Phone-frame demo mode of the prototype not ported (demo only) | ✅ |
| 0.2b | **Platform accounts** (owner request 2026-09-22): sign-in without SAP for non-employees; platform administrators create/disable/reset them in the admin portal; temporary passwords changed at first sign-in; bootstrap administrator from the environment; platform accounts never call SAP | ✅ |
| 0.7 | Server scheduler (ShedLock): SLA reminders/escalation, version activation, comms reminders, designer tick (registers, waits, date reminders). **No SAP calls** from jobs (no technical user, owner decision 2026-09-22) | ⬜ |
| 0.8 | Notifications: stored as message keys, **in-app only** (addressed to positions for job-driven ones), per-person preferences, threads by request. Push (Expo) deferred | ⬜ |
| 0.9 | File store (MinIO/S3) for attachments and media; AV scan | ⬜ |

## Slice 1 — Employee core (prototype screens, 1:1)
Split into five sub-slices, each approved by the owner before it starts (owner decision 2026-09-23: Slice 1 before 0.7/0.8).

| # | Item | Status |
|---|---|---|
| 1.1 | **My requests, request page, Tasks**, and the engine actions they need. Return to the requester (reason required; the prototype returns only to the requester) → complete and resubmit to the same step (validated against the version it was submitted with; later steps' conditions re-evaluated on the new data — prototype gap fixed) · withdraw before anyone else decided (per-service rule) · per-step allowed decisions · decision history (Tasks → Done) · optimistic locking (request version, 409) and row locks so one request's changes never interleave · keyset paging · inbox looked up through an assignee index (no scan of open steps) · SAP names for list pages fetched concurrently (bounded). Web and mobile screens 1:1 with `Requests.tsx` / `Inbox.tsx` / `NewRequest.tsx` (resubmit) | 🔄 built; backend build and tests to run (Maven offline in the build sandbox) |
| 1.2 | **Services catalogue, search (⌘K / search island), Home dock data — admin-configurable**. Catalogue in PostgreSQL (`catalog` schema: 16 domains, services with wave or hidden/merged status, dock, "notify me", change log); catalogue 1.0 from the prototype loaded by a migration as starting configuration (owner decision 2026-09-23). Rules kept by the server: only coded or configured services can be "available", the dock holds available services only (at most 4, a layout limit), stale edits refused (409), nothing deleted. Arabic-aware search over names, scope, search words and codes, startable services first. Web and mobile Services screen, domain page and search 1:1 with `Services.tsx` / `SearchSheet.tsx`; "Notify me" now kept per person (the prototype only closed the sheet). Admin portal → Service catalogue from the prototype's admin parts (designer catalogue tab, policy cards, edit sheets, save bar, change log). Home draws the dock in 1.5 | 🔄 built; backend tests to run (Maven offline in the build sandbox) |
| 1.3 | **Me**: digital card + widget grid (each module adds its widgets), My data (SAP-001 + org; mobile and IBAN masked by the server), documents wallet (SAP-002), family (SAP-003), balances (SAP-004), pay (SAP-005) — all read live as the employee, never stored; card QR = a short-lived code signed by the portal with a public check (owner decision 2026-09-23: nothing stored, no SAP call); Settings: language, appearance, text size kept per person in PostgreSQL (same on web and phone). Web and mobile 1:1 with `Me.tsx`. Later with their slices: custody and leave-history widgets and "latest leaves" (3, 4), My registers (2), My tools (4), what reaches you (1.4); the prototype's review tools are not ported | 🔄 built; backend tests to run; SAP-002 … 005 proposed to the SAP team |
| 1.4 | Notifications (was 0.8): in-app, threads by request, preferences per person, admin triggers screen from the prototype's admin parts | ⬜ |
| 1.5 | Home "Today": hero, "Needs you" (de-duplicated), dock, "Mine" widgets; stories placeholder until Slice 5 | ⬜ |

## Slice 2 — Service designer + configured-service runtime (CAP-02)
21 field kinds, validation lexicon, conditions (`@attr`, `#step`), computed/defaults/profile fields; 7 step modes, 9 assignee kinds, quorum any/all/majority, parallel groups, auto-approve, deferred conditions, wait steps; step forms (outcomes, fields, edits, checklist, hidden, reasons, allowed decisions); return fields + resubmit to the same step; outputs (document templates with merge tokens, registers with expiry/renewal, SAP writes, follow-ups, calendar); notification rules and reminders; safety check (31 defects), simulation, preview, statistics, templates, clone/import/export. DC-01/MD-01/MD-02/MD-05/FN-01 become configured services. **The prototype's seed designer services (DC-01, DC-03, PR-07, HA-09) are loaded as initial configuration** by a Flyway migration (owner decision 2026-09-22), not as sample data. ⬜

## Slice 3 — Leave (TM-01 / TM-01C)
Policy Center (types, routes, entitlements, calendar, operations, simulation, versions), new-leave wizard with live evaluation, pay tiers + early warning, entitlements and fulfilment, cancellation, leave history, decision document (FR-HR-01), IT2001 post/delete via SAP. ⬜

## Slice 4 — Needs, procurement, custody (AS-01)
Needs policy center, wizard, all desks and branches (store, specify/provide/reroute, procurement, bands, budget, quotes, evaluation, award, tender, PR/PO), receipts in batches with committee, handover notes, custody, registers, contracts center — with SAP MM/FM/FI-AA calls. ⬜

## Slice 5 — Communications
News, circulars with read-acknowledgement and register, sector stories (viewer gestures, composer, media), comms policy center. ⬜

## Slice 6 — Admin center, hardening, go-live
Admin overview, integration monitor, security review, performance, accessibility, UAT, mobile store/MDM release. (Tenants: the prototype is tenant-aware with one tenant; kept single-organisation per the owner's decision.) ⬜

## Prototype gaps to decide (found while extracting the specs)
Deputy cycles not guarded (fixed in 0.4) · holder change moves only the first parallel step · withdrawal notifies nobody · policy creator can second-approve own version · confidentiality (`canSee`) and pilot audience never enforced · declaration and file limits not enforced server-side · designer escalation not editable · on-behalf routes resolved for the submitter · leave resubmit uses a legacy form (no re-evaluation) · balance deduction keyed on type ids, pending requests not reserved · need actions lack actor checks and read today's policy instead of the captured version · cancellation does not release stock or close PR/PO · circular acknowledgement re-evaluated against today's policy · composers are single-language · notification preferences are per device. Default: fix them the correct way unless the owner decides otherwise.
