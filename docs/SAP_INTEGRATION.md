# SAP Integration Catalogue (live document)

Every API the portal calls on the SAP system is listed here with its request, a sample JSON response, the feature that
uses it, and when it is called. **Update this file in the same change that adds or alters an integration.**

| | |
|---|---|
| **SAP system** | `http://sandbox.gcc-sg.org:8000` (sandbox), configured by `USP_SAP_URL` |
| **Client** | optional `sap-client` query parameter, configured by `USP_SAP_CLIENT` |
| **Portal side** | `backend/src/main/java/org/gcc/usp/platform/integration/SapClient.java` (one client for all calls) |
| **Last updated** | 2026-09-23 |

## Conventions (apply to every endpoint)

| Topic | Rule |
|---|---|
| Platform accounts | Users without an SAP user (administrators, operators; `identity.platform_user`) sign in against the portal and **never call SAP**. SAP-backed services answer them 403 `auth.noSapAccount`; they hold no SAP position. |
| Caller identity | Every call runs **as the signed-in user** (their SU01 user): `Authorization: Basic …`, or `Cookie: MYSAPSSO2=…` when SAP issued a logon ticket at sign-in. No shared technical user for user actions. |
| Persistence | Responses are used for the current request only. **Nothing is copied into PostgreSQL** unless the business owner confirms it (see "Confirmed persistence" below). |
| Format | JSON, UTF-8. Field names `snake_case`. |
| Dates | Currently `dd-MM-yyyy` (as in the first sample). ISO `yyyy-MM-dd` preferred; the portal accepts both. |
| Texts | Code + text. Texts in every portal language where SAP has them (`*_ar`, `*_en`); the portal falls back to the other language when one is empty. |
| Empty values | To be agreed: `""`, `null` or omitted (the portal accepts all three). |
| Errors | `401` wrong/expired credentials → portal signs the user out · `403` SAP authorisation missing → "not authorised" · `404` → "not found" · `5xx`/timeout → "SAP unavailable, try later". Timeout 10 s. |
| Logging | Paths and status codes only; never bodies or credentials. |

Status values: **Live** (called in production code and confirmed by SAP team) · **Implemented** (called in code, tested against a stub, awaiting a real test) · **Proposed** (contract drafted by the portal team, awaiting SAP team) · **Planned** (needed by a later feature, contract to be drafted).

## Index

| ID | API | Status | Used by |
|---|---|---|---|
| [SAP-001](#sap-001-employee-profile-me) | `GET /sap/tamkeen/profile/me` | Implemented (extension proposed) | Sign-in, My data, the digital card |
| [SAP-002](#sap-002-my-documents) | `GET /sap/tamkeen/profile/me/documents` | Implemented | Me › My documents (wallet), My data completeness |
| [SAP-003](#sap-003-my-family) | `GET /sap/tamkeen/profile/me/family` | Implemented | Me › My family |
| [SAP-004](#sap-004-my-absence-quotas) | `GET /sap/tamkeen/time/me/quotas` | Implemented | Me › My balances |
| [SAP-005](#sap-005-my-payslips) | `GET /sap/tamkeen/payroll/me/payslips` | Implemented | Me › My pay |
| [SAP-010](#sap-010-my-org-assignment) | `GET /sap/tamkeen/org/me` | Implemented | Inbox, approver resolution |
| [SAP-011](#sap-011-employee-org-assignment) | `GET /sap/tamkeen/org/employees/{employee_no}` | Implemented | Approver resolution (line manager), names on request timelines |
| [SAP-012](#sap-012-org-unit) | `GET /sap/tamkeen/org/units/{unit_id}` | Implemented | Approver resolution (chief, parent chain) |
| [SAP-013](#sap-013-position) | `GET /sap/tamkeen/org/positions/{position_id}` | Implemented | Approver resolution (holder, deputy, vacancy) |
| [SAP-014](#sap-014-positions-of-a-unit) | `GET /sap/tamkeen/org/units/{unit_id}/positions` | Implemented | Team (pool) steps |

---

## SAP-001 Employee profile (me)

| | |
|---|---|
| Status | **Implemented** (tested against a stub; real test pending network access) |
| Used by | Sign-in (`POST /api/v1/auth/login`) to verify the credentials and learn the employee number · My data (`GET /api/v1/mydata/profile`): with the extension below, contact details, salary account, group, subgroup, work location and hire date; position, unit and line manager come from the org structure (SAP-011 … 013) when the extension does not carry them |
| When | Once at sign-in; when Me or My data opens (kept only in the app's memory for a few minutes, never on disk) |
| Caller | The user signing in / signed in |
| Persistence | None. The session keeps the employee number and name in memory while signed in. |

**Request**
```http
GET /sap/tamkeen/profile/me HTTP/1.1
Host: sandbox.gcc-sg.org:8000
Authorization: Basic RU1QMTgxODpzZWNyZXQ=
Accept: application/json
```

**Response 200 (contract confirmed so far)**
```json
{
  "employee_no": 1818,
  "arabic_name": "",
  "english_name": "",
  "date_of_birth": "23-09-2000"
}
```

**Portal mapping:** `employee_no` → session identity and `employeeNo` (kept as text) · `arabic_name`/`english_name` → `name.ar`/`name.en` · `date_of_birth` → `dateOfBirth` (ISO).

**Requested extension (to agree with the SAP team; the portal already reads it when present):** `mobile` and
`bank.iban` are masked by the portal before they reach the browser (`+966 5• ••• •412`, `SA•• •••• 4471`); changes go
through the MD-01 / MD-02 services, never directly.
```json
{
  "employee_no": "00001818",
  "sap_user": "EMP1818",
  "arabic_name": "صلاح عافية",
  "english_name": "Salah Afia",
  "gender": "m",
  "date_of_birth": "2000-09-23",
  "nationality": { "code": "SA", "text_ar": "السعودية", "text_en": "Saudi Arabia" },
  "marital_status": { "code": "1", "text_ar": "متزوج", "text_en": "Married" },
  "mobile": "+9665XXXXXXXX",
  "work_email": "s.afia@gcc-sg.org",
  "position": { "id": "50001234", "title_ar": "محلل بيانات أول", "title_en": "Senior Data Analyst" },
  "org_unit": { "id": "50000111", "name_ar": "قسم التمكين الرقمي", "name_en": "Digital Enablement Section", "level": "section" },
  "employee_group": { "code": "1", "text_ar": "موظف رسمي", "text_en": "Official employee" },
  "employee_subgroup": { "code": "12", "text_ar": "رسمي · تخصصي", "text_en": "Official · specialist" },
  "work_location": { "code": "riyadh", "text_ar": "الرياض", "text_en": "Riyadh" },
  "hire_date": "2023-01-01",
  "grade": "12",
  "contract": { "type": "official", "end_date": null, "tickets_entitled": true },
  "bank": { "iban": "SA0380000000608010164471", "bank_name_ar": "مصرف الراجحي", "bank_name_en": "Al Rajhi Bank" }
}
```

---

## Employee self-service reads (SAP-002 … SAP-005)

The Me tab (Slice 1.3) reads the employee's own records live, **as the signed-in user**, on every visit; nothing is
stored by the portal (responses carry `Cache-Control: no-store`). An employee without records gets empty lists. Paths are
configurable (`usp.sap.paths.*`). **SAP authorisation needed:** each employee may read their own personnel number only
(`P_PERNR` own-record access for infotypes 0021, 0185, 2006 and payroll results). To agree with Basis.

### SAP-002 My documents

| | |
|---|---|
| Status | **Implemented** (contract proposed by the portal team; tested against a stub; awaiting the SAP team) |
| Used by | Me › My documents (the wallet: soonest expiry first, full number when a card is brought forward), the "My data" completeness on Me |
| Source in SAP | IT0185 (personal IDs: passport, national ID, residence), IT0016 (contract), cards and insurance where kept |
| When | When Me or My documents opens |

```http
GET /sap/tamkeen/profile/me/documents
```
```json
{
  "documents": [
    { "id": "0185-02-1", "kind": "passport", "type": { "code": "02", "text_ar": "جواز السفر", "text_en": "Passport" }, "number": "A12345712", "issue_date": "2022-03-16", "expiry_date": "2027-03-16" },
    { "id": "0185-05-1", "kind": "licence", "type": { "code": "05", "text_ar": "رخصة القيادة", "text_en": "Driving licence" }, "number": "30012351", "issue_date": "2021-10-07", "expiry_date": "2026-10-07" }
  ]
}
```
`kind` (the wallet card's icon and colour): `passport`, `id`, `card`, `licence`, `contract`, `insurance`; anything else is
shown as a card. `id` must be stable per document.

### SAP-003 My family

| | |
|---|---|
| Status | **Implemented** (contract proposed by the portal team; tested against a stub; awaiting the SAP team) |
| Used by | Me › My family (relation and the time left on each member's document), the count on Me |
| Source in SAP | IT0021 (family members / dependants), their document from IT0185 of the member where kept |
| When | When Me or My family opens |

```http
GET /sap/tamkeen/profile/me/family
```
```json
{
  "members": [
    { "id": "0021-1-01", "relation": { "code": "1", "text_ar": "زوجة", "text_en": "Spouse" }, "arabic_name": "ريم", "english_name": "Reem", "gender": "f", "date_of_birth": "1996-04-02", "document": { "kind": "id", "expiry_date": "2027-05-01" } }
  ]
}
```

### SAP-004 My absence quotas

| | |
|---|---|
| Status | **Implemented** (contract proposed by the portal team; tested against a stub; awaiting the SAP team) |
| Used by | Me › My balances (a ring per quota: remaining of entitlement), the annual balance on Me |
| Source in SAP | IT2006 (absence quotas), deductions from IT2001 |
| When | When Me or My balances opens |

```http
GET /sap/tamkeen/time/me/quotas
```
```json
{
  "quotas": [
    { "type": { "code": "10", "text_ar": "سنوية", "text_en": "Annual" }, "kind": "annual", "entitlement": 30, "used": 8.5, "remaining": 21.5, "unit": "days", "valid_to": "2026-12-31" },
    { "type": { "code": "20", "text_ar": "مرضية", "text_en": "Sick" }, "kind": "sick", "entitlement": 30, "used": 0, "remaining": 30, "unit": "days", "valid_to": "2026-12-31" }
  ]
}
```
`kind` (the ring's colour and which one leads Me): `annual`, `sick`, `emergency`; others are shown with SAP's text.
`unit`: `days` (default) or `hours`.

### SAP-005 My payslips

| | |
|---|---|
| Status | **Implemented** (contract proposed by the portal team; tested against a stub; awaiting the SAP team) |
| Used by | Me › My pay (newest first; one opens with gross, deductions, net and pay date), the latest month on Me |
| Source in SAP | Payroll results (cluster RT), the employee's own periods only |
| When | When Me or My pay opens; `months` = `USP_PAYSLIP_MONTHS` (default 12) |

```http
GET /sap/tamkeen/payroll/me/payslips?months=12
```
```json
{
  "payslips": [
    { "id": "2026-09", "period": "2026-09", "pay_date": "2026-09-22", "gross": 18500.00, "deductions": 1850.00, "net": 16650.00, "currency": "SAR" }
  ]
}
```

---

## Approvers from SAP, on the fly (SAP-010 … SAP-014)

The approver of a step is a **position**, resolved from the SAP org structure when the step opens (CAP-01, D-012):
line manager, head of unit at a level, the management chain, specific positions, or a unit's team. A vacant position
falls to its deputy, then to its superior; nobody approves their own request. The portal stores only the **position /
unit ids** a step is waiting on (workflow state, not org data). Whoever holds that position in SAP when they open their
inbox sees the task, so a change of holder in SAP moves open tasks automatically.

These are read-only calls made as the signed-in user. **SAP authorisation needed:** every employee must be allowed to
read the org structure (units, positions, holders' names), e.g. structural authorisation / `PLOG` display. To agree with Basis.

### SAP-010 My org assignment

| | |
|---|---|
| Status | **Implemented** (contract proposed by the portal team; tested against a stub; awaiting the SAP team) |
| Used by | Inbox (which open steps are mine), request submission (the requester's position and unit) |
| When | On every inbox load and on every request submission |

```http
GET /sap/tamkeen/org/me
```
```json
{
  "employee_no": "00001818",
  "positions": [
    { "id": "50001234", "title_ar": "محلل بيانات أول", "title_en": "Senior Data Analyst", "org_unit_id": "50000111", "primary": true }
  ],
  "acting_for": [
    { "position_id": "50000120", "until": "2026-10-31" }
  ]
}
```
`acting_for`: positions the employee currently covers as deputy / substitute (SAP relationship A008 / substitution). Optional.

### SAP-011 Employee org assignment

| | |
|---|---|
| Status | **Implemented** (contract proposed by the portal team; tested against a stub; awaiting the SAP team) |
| Used by | Line-manager resolution for a requester; names and titles on timelines, inbox rows, Tasks → Done and "My requests" rows; who made each change in the admin catalogue log; My data (the employee's own position and unit, and the line manager's name and title); the holder block of issued documents (gender for Arabic wording, hire date) |
| When | When a step opens; when a request page or a list page shows who acted or who has it. A list page asks for all its people in one concurrent round (at most `USP_SAP_MAX_PARALLEL` calls at once, default 6), memoised for that HTTP request only |

```http
GET /sap/tamkeen/org/employees/00001818
```
```json
{
  "employee_no": "00001818",
  "arabic_name": "صلاح عافية",
  "english_name": "Salah Afia",
  "position_id": "50001234",
  "org_unit_id": "50000111",
  "gender": "m",
  "hire_date": "2023-01-01"
}
```

### SAP-012 Org unit

| | |
|---|---|
| Status | **Implemented** (contract proposed by the portal team; tested against a stub; awaiting the SAP team) |
| Used by | Line manager (chief of the unit, or of the parent unit when the requester is the chief), head of unit at a level, management chain |
| When | When a step opens (walks up the parent chain as needed) |

```http
GET /sap/tamkeen/org/units/50000111
```
```json
{
  "id": "50000111",
  "name_ar": "قسم التمكين الرقمي وذكاء الأعمال",
  "name_en": "Digital Enablement & BI Section",
  "level": "section",
  "parent_unit_id": "50000110",
  "chief_position_id": "50001200"
}
```
`level`: `section` · `department` · `ga` (general administration) · `sector` · `sg` (General Secretariat).

### SAP-013 Position

| | |
|---|---|
| Status | **Implemented** (contract proposed by the portal team; tested against a stub; awaiting the SAP team) |
| Used by | Holder of the approver position; deputy when vacant; superior when there is no deputy; who has a request now on "My requests" rows |
| When | When a step opens; when a timeline or a list row shows who holds a waiting step now (list pages: one concurrent round, as SAP-011) |

```http
GET /sap/tamkeen/org/positions/50001200
```
```json
{
  "id": "50001200",
  "title_ar": "رئيس قسم التمكين الرقمي وذكاء الأعمال",
  "title_en": "Head of Digital Enablement & BI",
  "org_unit_id": "50000111",
  "holder": { "employee_no": "00001840", "arabic_name": "منى القحطاني", "english_name": "Mona Al-Qahtani" },
  "deputy_position_id": null
}
```
`holder` is `null` when the position is vacant.

### SAP-014 Positions of a unit

| | |
|---|---|
| Status | **Implemented** (contract proposed by the portal team; tested against a stub; awaiting the SAP team) |
| Used by | Team (pool) steps, e.g. "Personnel Affairs Section" reviews a letter request |
| When | When a team step opens (to record who can act) and when its timeline is shown |

```http
GET /sap/tamkeen/org/units/50000211/positions
```
```json
[
  { "id": "50002110", "title_ar": "رئيس قسم شؤون الموظفين", "title_en": "Head of Personnel Affairs", "holder": { "employee_no": "00001611", "arabic_name": "علي البوعينين", "english_name": "Ali Al-Buainain" } },
  { "id": "50002111", "title_ar": "أخصائي أول شؤون موظفين", "title_en": "Senior Personnel Affairs Specialist", "holder": { "employee_no": "00001922", "arabic_name": "نورة الحربي", "english_name": "Noura Al-Harbi" } },
  { "id": "50002112", "title_ar": "أخصائي شؤون موظفين", "title_en": "Personnel Affairs Specialist", "holder": null }
]
```

---

## Confirmed persistence (exceptions to "no replication")

| Data | Where | Why | Confirmed by / date |
|---|---|---|---|
| Issued-document snapshot: holder name, title, unit, gender, hire date, salary line if requested, signer | `documents.issued_document` | A legal document must be reproducible and verifiable exactly as issued | Business owner, 2026-09-22 |
| Workflow state: position/unit ids a step waits on, employee numbers of who decided, when | `workflow.*`, `requests.audit` | The portal's own audit trail (who approved what, and when) | Business owner, 2026-09-22 |

The digital employee card's QR code carries the employee number, name and an expiry, **signed by the portal** (HMAC)
and valid for `USP_CARD_CODE_VALIDITY` (default 24 h): the public check verifies the signature, so nothing is stored and
SAP is not called (business owner, 2026-09-23).

Background jobs (SLA reminders, escalations) make **no SAP calls**: there is no technical SAP user. Their notifications are
in-app only, addressed to the stored position ids and shown to whoever holds the position when they next sign in
(business owner, 2026-09-22; revisit when push is needed).
