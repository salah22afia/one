# Module `needs`: Needs, Custody & Assets (AS)

الاحتياج والعهد والأصول

| Feature | Kind | Implementation | Service | Description |
|---|---|---|---|---|
| `need-request` | service | coded | AS-01 | Submission, route building, branches (ND-01…ND-05, ND-21, ND-23, ND-24). |
| `specification` | desk | coded |  | Technical entity: specify, provide from pool, reroute (ND-06, ND-07). |
| `store` | desk | coded |  | Store decision, reservation, store desk (ND-08, ND-22a). |
| `procurement` | desk | coded |  | Preparation, bands, quotes, evaluation, award, tender, PR/PO (ND-09, ND-10, ND-12…ND-17, ND-22b). |
| `budget` | desk | coded |  | Earmarked funds reservation, top-up, release (ND-11). |
| `receipt` | desk | coded |  | Receipt reports in batches, committee signatures, remainder close (ND-18, ND-19). |
| `handover` | desk | coded |  | Handover notes per batch (ND-20). |
| `custody` | view | coded | AS-02 | Custody register, exposed to other modules (CU-01, CU-02). |
| `needs-policy` | policy | coded |  | Versioned needs policy, operations and simulator. |
<!-- @gen:features -->

Rules: features are sub-packages; other modules may only use this module's root package or `@NamedInterface` packages;
tables live in schema `needs` (migrations in `backend/src/main/resources/db/migration/needs`).
