# Module `mydata`: My Data & Documents (MD)

بياناتي ومستنداتي

| Feature | Kind | Implementation | Service | Description |
|---|---|---|---|---|
| `profile` | view | coded |  | Personal data, balances, documents, payslips, dependants (ME-01). |
| `personal-data` | service | configured | MD-01 | Update my personal data |
| `bank-account` | service | configured | MD-02 | Change salary account |
| `document-update` | service | configured | MD-05 | Update a document |
<!-- @gen:features -->

Rules: features are sub-packages; other modules may only use this module's root package or `@NamedInterface` packages;
tables live in schema `mydata` (migrations in `backend/src/main/resources/db/migration/mydata`).
