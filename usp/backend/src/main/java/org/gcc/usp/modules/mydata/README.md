# Module `mydata`: My Data & Documents (MD)

بياناتي ومستنداتي

| Feature | Kind | Implementation | Service | Description |
|---|---|---|---|---|
| `profile` | view | coded |  | My data: SAP-001 with position, unit and line manager; contact and bank masked (ME-01). |
| `documents` | view | coded |  | Documents wallet (SAP-002). |
| `family` | view | coded |  | Family members and dependants (SAP-003). |
| `card` | view | coded |  | Digital employee card: short-lived signed QR code and its public check. |
| `personal-data` | service | configured | MD-01 | Update my personal data |
| `bank-account` | service | configured | MD-02 | Change salary account |
| `document-update` | service | configured | MD-05 | Update a document |
<!-- @gen:features -->

Rules: features are sub-packages; other modules may only use this module's root package or `@NamedInterface` packages;
tables live in schema `mydata` (migrations in `backend/src/main/resources/db/migration/mydata`).
