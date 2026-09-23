# Module `finance`: Employee Finance (FN)

المعاملات المالية للموظف

| Feature | Kind | Implementation | Service | Description |
|---|---|---|---|---|
| `business-trip` | service | configured | FN-01 | Business trip & assignment |
<!-- @gen:features -->

Rules: features are sub-packages; other modules may only use this module's root package or `@NamedInterface` packages;
tables live in schema `finance` (migrations in `backend/src/main/resources/db/migration/finance`).
