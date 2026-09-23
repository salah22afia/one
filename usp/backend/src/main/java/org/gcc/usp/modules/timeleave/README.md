# Module `timeleave`: Time & Leave (TM)

الوقت والإجازات

| Feature | Kind | Implementation | Service | Description |
|---|---|---|---|---|
| `leave-request` | service | coded | TM-01 | Type picker, live evaluation, pay tiers, entitlements, IT2001 posting (LV-01…LV-07). |
| `leave-cancellation` | service | coded | TM-01C | Cancellation of approved leave (LV-08). |
| `leave-history` | view | coded |  | Merged from SAP absences and portal requests (LV-09). |
| `leave-policy` | policy | coded |  | Versioned types, routes, entitlements, calendar (POL-01…POL-04). |
| `leave-operations` | policy | coded |  | Seasonal windows, entitlement groups, period close (OPS-01). |
<!-- @gen:features -->

Rules: features are sub-packages; other modules may only use this module's root package or `@NamedInterface` packages;
tables live in schema `timeleave` (migrations in `backend/src/main/resources/db/migration/timeleave`).
