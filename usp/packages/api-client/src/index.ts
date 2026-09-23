import type { Language, LocalizedText } from '@usp/i18n';

// Hand-written until `pnpm api:generate` produces src/schema.d.ts from the backend OpenAPI; then derive these from it.

let base = '';
let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;
/** Web uses the dev proxy (''); mobile sets the absolute backend URL. */
export function setApiBase(url: string) { base = url.replace(/\/$/, ''); }
/** Mobile: the portal session token (Authorization: Bearer). Web relies on the HttpOnly session cookie instead. */
export function setAuthToken(token: string | null) { authToken = token; }
/** Called when the session is gone (401 on any call except login), so the app can show the sign-in screen. */
export function setOnUnauthorized(fn: (() => void) | null) { onUnauthorized = fn; }

export interface ApiCheck { key: string; level: 'ok' | 'info' | 'warn' | 'block'; text: LocalizedText; field?: string }
/** `code`: the server's message key (e.g. catalog.stale), for telling refusals of the same status apart. */
export class ApiError extends Error {
  constructor(public status: number, public title: LocalizedText | undefined, public checks: ApiCheck[] = [], public code?: string) { super(title?.en ?? `HTTP ${status}`); }
}

async function send(method: string, path: string, body?: unknown, accept = 'application/json'): Promise<Response> {
  const headers: Record<string, string> = { Accept: accept };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${base}/api/v1${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  if (res.status === 401 && !path.startsWith('/auth/')) onUnauthorized?.();
  if (!res.ok) {
    // problem+json: `message` in every language, `code` = the server's message key.
    const problem = (await res.json().catch(() => ({}))) as { message?: LocalizedText; checks?: ApiCheck[]; code?: string };
    throw new ApiError(res.status, problem.message, problem.checks ?? [], problem.code);
  }
  return res;
}
export const apiGet = async <T>(path: string) => (await (await send('GET', path)).json()) as T;
export const apiPost = async <T>(path: string, body: unknown) => (await (await send('POST', path, body)).json()) as T;
export const apiPut = async <T>(path: string, body: unknown) => (await (await send('PUT', path, body)).json()) as T;
/** Calls that answer 204 No Content. */
export const apiSend = async (method: 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown) => { await send(method, path, body); };
export const apiText = async (path: string) => (await send('GET', path, undefined, 'text/html, text/plain, application/problem+json')).text();
export const apiBlob = async (path: string) => (await send('GET', path, undefined, '*/*')).blob();

/* ——— platform/modules ——— */
export type FeatureKind = 'SERVICE' | 'VIEW' | 'DESK' | 'POLICY' | 'INTEGRATION';
export type FeatureImplementation = 'CONFIGURED' | 'CODED' | 'HYBRID';
export type FeatureStatus = 'AVAILABLE' | 'WAVE_2' | 'WAVE_3' | 'LATER' | 'HIDDEN';
export interface FeatureDescriptor { key: string; serviceId: string | null; kind: FeatureKind; implementation: FeatureImplementation; name: LocalizedText; status: FeatureStatus }
export interface ModuleDescriptor { key: string; catalogCode: string; name: LocalizedText; icon: string; order: number; features: FeatureDescriptor[] }
export const getModules = () => apiGet<ModuleDescriptor[]>('/modules');

/* Arabic-aware matching (prototype app/search.ts): diacritics, hamza forms, taa marbuta and alif maqsura are folded. */
export const normalizeSearch = (s: string) => s.replace(/[\u064B-\u0652\u0640]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').toLowerCase();

/* ——— settings: languages the administrator enabled (public) ——— */
export const getLanguages = () => apiGet<Language[]>('/settings/languages');

/* ——— identity: SAP sign-in (sessions live in the backend's memory only) ——— */
export interface PersonRef { id: string; name: LocalizedText; title: LocalizedText }
/** kind: `sap` (employee, SU01 sign-in) or `platform` (account without SAP); `mustChangePassword`: only the password change is allowed. */
export interface SessionView { username: string; kind: 'sap' | 'platform'; personId: string; employeeNo: string | null; name: LocalizedText; admin: boolean; mustChangePassword: boolean; expiresAt: string; token: string | null }
export const login = (username: string, password: string) => apiPost<SessionView>('/auth/login', { username, password });
export const logout = async () => { await send('POST', '/auth/logout'); };
export const getSession = () => apiGet<SessionView>('/auth/session');
/** Platform accounts only (SAP users change their password in SAP). */
export const changePassword = (current: string, next: string) => apiPost<SessionView>('/auth/password', { current, next });

/* ——— platform accounts (administration) ——— */
export interface PlatformUser { id: string; username: string; name: LocalizedText; email: string | null; admin: boolean; enabled: boolean; mustChangePassword: boolean; createdBy: string; createdAt: string; lastLoginAt: string | null }
export interface NewPlatformUser { username: string; name: LocalizedText; email?: string; admin: boolean; temporaryPassword: string }
export const listPlatformUsers = () => apiGet<PlatformUser[]>('/admin/platform-users');
export const createPlatformUser = (u: NewPlatformUser) => apiPost<PlatformUser>('/admin/platform-users', u);
export const updatePlatformUser = (id: string, u: { name: LocalizedText; email?: string | null; admin: boolean; enabled: boolean }) => apiPut<PlatformUser>(`/admin/platform-users/${id}`, u);
export const resetPlatformUserPassword = (id: string, temporaryPassword: string) => apiPost<PlatformUser>(`/admin/platform-users/${id}/reset-password`, { temporaryPassword });

/* ——— Me: the employee's own data, read live from SAP as them (never stored by the portal) ——— */
/** My data (SAP-001 + org). {@code mobile} and {@code bank.iban} arrive masked; fields SAP does not send yet are null / empty. */
export interface EmployeeProfile {
  employeeNo: string; name: LocalizedText; dateOfBirth: string | null; positionId: string | null; title: LocalizedText; unit: LocalizedText;
  manager: PersonRef | null; group: LocalizedText; subgroup: LocalizedText; location: LocalizedText; hireDate: string | null;
  mobile: string | null; email: string | null; bank: { iban: string; bank: LocalizedText } | null;
}
export const getProfile = () => apiGet<EmployeeProfile>('/mydata/profile');
export type DocumentKind = 'passport' | 'id' | 'card' | 'licence' | 'contract' | 'insurance';
/** Documents wallet (SAP-002), soonest expiry first. */
export interface PersonalDocument { id: string; kind: DocumentKind; title: LocalizedText; number: string; issuedOn: string | null; expiresOn: string | null }
export const getMyDocuments = () => apiGet<PersonalDocument[]>('/mydata/documents');
export interface FamilyMember { id: string; name: LocalizedText; relation: LocalizedText; birthDate: string | null; documentExpiresOn: string | null }
export const getMyFamily = () => apiGet<FamilyMember[]>('/mydata/family');
/** Absence quotas (SAP-004); {@code kind} picks the ring colour. Amounts in days unless {@code unit} is hours. */
export interface LeaveBalance { type: string; kind: 'annual' | 'sick' | 'emergency' | 'other'; name: LocalizedText; entitlement: number | null; used: number | null; remaining: number; unit: 'days' | 'hours'; validTo: string | null }
export const getBalances = () => apiGet<LeaveBalance[]>('/timeleave/balances');
/** Payroll results (SAP-005), newest first; {@code period} is yyyy-MM. */
export interface Payslip { id: string; period: string; payDate: string | null; gross: number | null; deductions: number | null; net: number; currency: string | null }
export const getPayslips = () => apiGet<Payslip[]>('/finance/payslips');
/** The digital card's QR: a code signed for a short time; {@code qr.path} draws it on a {@code qr.size} grid. */
export interface DigitalCard { employeeNo: string; name: LocalizedText; url: string; expiresAt: string; qr: { size: number; path: string } }
export const getCard = () => apiGet<DigitalCard>('/mydata/card');
/** Public check of a scanned card code. */
export interface CardCheck { valid: boolean; expired: boolean; employeeNo: string | null; name: LocalizedText | null; expiresAt: string | null }
export const verifyCard = (code: string) => apiGet<CardCheck>(`/verify/card/${encodeURIComponent(code)}`);

/** Documents within this many days of expiry are flagged (the prototype's window; an operational setting later). */
export const EXPIRY_WINDOW_DAYS = 30;
const DAY_MS = 86_400_000;
/** Whole days from today to a date (yyyy-MM-dd); negative once past. */
export function daysUntil(isoDate: string, now = Date.now()) {
  const today = new Date(now); const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  return Math.round((Date.UTC(y!, m! - 1, d!) - start) / DAY_MS);
}
export function expiryState(isoDate: string | null, now = Date.now()): 'expired' | 'expiring' | 'valid' {
  if (!isoDate) return 'valid';
  const n = daysUntil(isoDate, now);
  return n < 0 ? 'expired' : n <= EXPIRY_WINDOW_DAYS ? 'expiring' : 'valid';
}

/* ——— settings: each person's display preferences (the same on every device) ——— */
export type Appearance = 'auto' | 'light' | 'dark';
export type TextSize = 'normal' | 'large' | 'xl';
/** {@code language} null: the administrator's default. */
export interface Preferences { language: string | null; theme: Appearance; textSize: TextSize }
export const getPreferences = () => apiGet<Preferences>('/me/preferences');
export const savePreferences = (p: Preferences) => apiPut<Preferences>('/me/preferences', p);

/* ——— platform/requests ——— */
export type RequestStatus = 'in_review' | 'returned' | 'rejected' | 'completed' | 'withdrawn';
export type StepStatus = 'pending' | 'current' | 'done' | 'rejected' | 'skipped' | 'waiting' | 'returned';
export type StepMode = 'approve' | 'notify' | 'fulfil' | 'receipt' | 'system';
export type DecisionAction = 'approve' | 'return' | 'reject' | 'done' | 'receive';
/** `version` changes with every change of the request: send it back with an action (409 if it moved on meanwhile). */
export interface RequestView { id: string; serviceId: string; module: string; feature: string; serviceName: LocalizedText; icon: string | null; status: RequestStatus; channel: 'web' | 'app'; requester: PersonRef; createdAt: string; updatedAt: string; version: number }
export interface FieldView { key: string; type: string; label: LocalizedText; value: unknown; display: LocalizedText }
/** `mine`: the viewer decides it now; `decisions`: what its holder may decide; `shared`: several people can act (the first closes it). */
export interface StepDetail {
  id: number; key: string; title: LocalizedText; mode: StepMode; status: StepStatus; why: LocalizedText | null; assignees: PersonRef[]; actor: PersonRef | null;
  action: string | null; note: string | null; ref: string | null; startedAt: string | null; dueAt: string | null; completedAt: string | null; mine: boolean;
  decisions: DecisionAction[]; shared: boolean;
}
export interface AuditView { at: string; actor: PersonRef | null; what: LocalizedText }
export interface DocumentView { id: string; requestId: string; template: string; title: LocalizedText; number: string; verifyCode: string; holderId: string; issuedAt: string; revoked: boolean }
export interface RequestDetail { request: RequestView; fields: FieldView[]; steps: StepDetail[]; audit: AuditView[]; documents: DocumentView[]; next: LocalizedText | null; canWithdraw: boolean; canResubmit: boolean }
export interface TaskItem {
  stepId: number; requestId: string; serviceId: string; serviceName: LocalizedText; icon: string | null; stepTitle: LocalizedText; mode: StepMode; requester: PersonRef;
  startedAt: string; dueAt: string | null; overdue: boolean; why: LocalizedText | null; decisions: DecisionAction[]; shared: boolean;
}
/** "My requests" rows: where the request is and what happens next. */
export interface StepDot { key: string; title: LocalizedText; status: StepStatus }
export interface Waiting { title: LocalizedText; status: StepStatus; holder: PersonRef | null; who: LocalizedText | null; since: string | null; dueAt: string | null; note: string | null }
export interface RequestRow { id: string; serviceId: string; serviceName: LocalizedText; icon: string | null; status: RequestStatus; createdAt: string; updatedAt: string; version: number; steps: StepDot[]; waiting: Waiting | null; documents: number }
export interface RequestPage { items: RequestRow[]; next: string | null; counts: { ongoing: number; returned: number; finished: number } }
export interface DoneItem { stepId: number; requestId: string; serviceId: string; serviceName: LocalizedText; icon: string | null; stepTitle: LocalizedText; requester: PersonRef; action: DecisionAction; at: string }
export interface DonePage { items: DoneItem[]; next: string | null; total: number }

const query = (params: Record<string, string | number | undefined | null>) => {
  const q = new URLSearchParams(); for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  const s = q.toString(); return s ? `?${s}` : '';
};
export const submitRequest = (serviceId: string, data: Record<string, unknown>, channel: 'web' | 'app') =>
  apiPost<RequestDetail>('/requests', { serviceId, data, channel });
/** `view`: ongoing (returned first, then in review) or finished; `cursor`: the previous page's `next`. */
export const getMyRequests = (view: 'ongoing' | 'finished' = 'ongoing', cursor?: string | null, limit?: number) =>
  apiGet<RequestPage>(`/requests${query({ view, cursor, limit })}`);
export const getRequest = (id: string) => apiGet<RequestDetail>(`/requests/${encodeURIComponent(id)}`);
export const resubmitRequest = (id: string, data: Record<string, unknown>, version?: number) =>
  apiPost<RequestDetail>(`/requests/${encodeURIComponent(id)}/resubmit`, { data, version });
export const withdrawRequest = (id: string, version?: number) => apiPost<RequestDetail>(`/requests/${encodeURIComponent(id)}/withdraw`, { version });
export const getTasks = () => apiGet<TaskItem[]>('/tasks');
export const getDoneTasks = (cursor?: string | null, limit?: number) => apiGet<DonePage>(`/tasks/done${query({ cursor, limit })}`);
export const decide = (stepId: number, action: DecisionAction, note?: string, ref?: string, version?: number) =>
  apiPost<RequestDetail>(`/tasks/${stepId}/decision`, { action, note, ref, version });
/** Steps that apply (skipped ones left out), how many are done and where the request stands (the prototype's progressOf). */
export function requestProgress<T extends { status: StepStatus }>(all: T[], status: RequestStatus) {
  const steps = all.filter((s) => s.status !== 'skipped');
  const doneN = steps.filter((s) => s.status === 'done').length;
  const cur = all.find((s) => s.status === 'current' || s.status === 'returned');
  const idx = cur ? steps.indexOf(cur) : status === 'completed' ? steps.length : doneN;
  return { steps, doneN, cur, idx };
}
/** The server refused because the request changed meanwhile (optimistic locking): reload it and look again. */
export const isStale = (e: unknown) => e instanceof ApiError && e.status === 409;

/* ——— platform/documents ——— */
export interface Verification { valid: boolean; revoked: boolean; title: LocalizedText | null; number: string | null; issuedAt: string | null; holder: LocalizedText | null }
export const getDocumentHtml = (id: string) => apiText(`/documents/${id}/html`);
export const getDocumentPdf = (id: string) => apiBlob(`/documents/${id}/pdf`);
export const verifyDocument = (code: string) => apiGet<Verification>(`/verify/${encodeURIComponent(code)}`);

/* ——— platform/catalog: the service catalogue (CAT-01) and the Home dock; administrators change them in the admin portal ——— */
/** Listed statuses; `available` services open when `startable` (built or configured), the others are coming. */
export type CatalogStatus = 'available' | 'wave2' | 'wave3' | 'later';
/** Administrators also see hidden services and those merged into another. */
export type CatalogAdminStatus = CatalogStatus | 'hidden' | 'merged';
export type CatalogFrequency = 'high' | 'seasonal' | 'medium' | 'low';
/** Tile colours of the design system (qicon gradients); null = the screen's default. */
export type Tone = 'g-green' | 'g-gold' | 'g-sage' | 'g-bronze' | 'g-teal';
export const TONES: readonly Tone[] = ['g-green', 'g-gold', 'g-sage', 'g-bronze', 'g-teal'];
export const CATALOG_STATUSES: readonly CatalogAdminStatus[] = ['available', 'wave2', 'wave3', 'later', 'hidden', 'merged'];
export const CATALOG_FREQUENCIES: readonly CatalogFrequency[] = ['high', 'seasonal', 'medium', 'low'];

export interface CatalogDomain { code: string; name: LocalizedText; description: LocalizedText; icon: string; tone: Tone | null; order: number }
export interface CatalogService {
  id: string; domain: string; name: LocalizedText; scope: LocalizedText; requesters: LocalizedText; target: LocalizedText; keywords: LocalizedText;
  status: CatalogStatus; startable: boolean; order: number;
}
export interface DockItem { serviceId: string; label: LocalizedText; icon: string; tone: Tone | null }
/** `interested`: coming services the viewer asked to be told about. */
export interface Catalog { domains: CatalogDomain[]; services: CatalogService[]; dock: DockItem[]; interested: string[] }
export const getCatalog = () => apiGet<Catalog>('/catalog');
/** "Notify me when available" (coming services only; asking twice is harmless). */
export const registerInterest = (serviceId: string) => apiSend('POST', `/catalog/services/${encodeURIComponent(serviceId)}/interest`);
export const withdrawInterest = (serviceId: string) => apiSend('DELETE', `/catalog/services/${encodeURIComponent(serviceId)}/interest`);

const CATALOG_RANK: Record<CatalogStatus, number> = { available: 0, wave2: 1, wave3: 2, later: 3 };
/** Services whose name, scope or search words (any language) or code contain the query; startable ones first. */
export function searchCatalog(services: CatalogService[], q: string, limit = 50) {
  const n = normalizeSearch(q.trim()); if (!n) return [];
  const rank = (s: CatalogService) => (s.startable ? 0 : CATALOG_RANK[s.status] + 1);
  return services
    .filter((s) => normalizeSearch([s.name, s.scope, s.keywords].flatMap((t) => Object.values(t)).join(' ') + ' ' + s.id).includes(n))
    .sort((a, b) => rank(a) - rank(b))
    .slice(0, limit);
}

export interface AdminCatalogDomain extends CatalogDomain { version: number; updatedAt: string }
/** `runnable`: a coded feature or a configured service exists (needed to make it available); `interested`: how many asked to be told. */
export interface AdminCatalogService extends Omit<CatalogService, 'status' | 'startable'> {
  status: CatalogAdminStatus; frequency: CatalogFrequency | null; mergedInto: string | null; version: number; runnable: boolean; inDock: boolean;
  interested: number; updatedAt: string;
}
/** `max`: how many services the dock holds (deployment setting). */
export interface Dock { items: DockItem[]; version: number; max: number }
/** A changed field; `from`/`to` are set for codes (status, domain, order…), texts only say they changed. */
export interface FieldChange { field: string; from: string | null; to: string | null }
export interface CatalogLogEntry { at: string; by: PersonRef; what: LocalizedText; changes: FieldChange[] }
export interface AdminCatalog { domains: AdminCatalogDomain[]; services: AdminCatalogService[]; dock: Dock; log: CatalogLogEntry[] }
export interface DomainChange { name: LocalizedText; description: LocalizedText; icon: string; tone: Tone | null; order?: number; version: number }
/** `id` only when adding; `version` only when changing (409 if someone changed it meanwhile). */
export interface ServiceChange {
  id?: string; domain: string; name: LocalizedText; scope: LocalizedText; requesters: LocalizedText; target: LocalizedText; keywords: LocalizedText;
  frequency: CatalogFrequency | null; status: CatalogAdminStatus; mergedInto: string | null; order?: number; version?: number;
}
export const getAdminCatalog = () => apiGet<AdminCatalog>('/admin/catalog');
export const updateCatalogDomain = (code: string, c: DomainChange) => apiPut<AdminCatalog>(`/admin/catalog/domains/${encodeURIComponent(code)}`, c);
export const addCatalogService = (c: ServiceChange) => apiPost<AdminCatalog>('/admin/catalog/services', c);
export const updateCatalogService = (id: string, c: ServiceChange) => apiPut<AdminCatalog>(`/admin/catalog/services/${encodeURIComponent(id)}`, c);
export const updateDock = (items: DockItem[], version: number) => apiPut<AdminCatalog>('/admin/catalog/dock', { items, version });
