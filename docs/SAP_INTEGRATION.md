# SAP Integration Catalogue (live document)

Every API the portal calls on the SAP system is listed here with its request, a sample JSON response, the feature that
uses it, and when it is called. **Update this file in the same change that adds or alters an integration.**

| | |
|---|---|
| **SAP system** | `http://sandbox.gcc-sg.org:8000` (sandbox), configured by `USP_SAP_URL` |
| **Client** | optional `sap-client` query parameter, configured by `USP_SAP_CLIENT` |
| **Portal side** | `backend/src/main/java/org/gcc/usp/platform/integration/SapClient.java` (one client for all calls) |
| **Last updated** | 2026-09-22 |

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
| [SAP-001](#sap-001-employee-profile-me) | `GET /sap/tamkeen/profile/me` | Implemented | Sign-in, My profile |
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
| Used by | Sign-in (`POST /api/v1/auth/login`) to verify the credentials and learn the employee number · My profile (`GET /api/v1/mydata/profile`, web "ملفي", mobile "Me") |
| When | Once at sign-in; on every visit to the profile page (no caching) |
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

**Requested extension (to agree with the SAP team):**
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
  "contract": { "type": "official", "end_date": null, "tickets_entitled": true }
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
| Used by | Line-manager resolution for a requester; names and titles on timelines and inbox rows; the holder block of issued documents (gender for Arabic wording, hire date) |
| When | When a step opens; when a request page shows who acted |

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
| Used by | Holder of the approver position; deputy when vacant; superior when there is no deputy |
| When | When a step opens; when a timeline shows who holds a waiting step now |

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

Background jobs (SLA reminders, escalations) make **no SAP calls**: there is no technical SAP user. Their notifications are
in-app only, addressed to the stored position ids and shown to whoever holds the position when they next sign in
(business owner, 2026-09-22; revisit when push is needed).
