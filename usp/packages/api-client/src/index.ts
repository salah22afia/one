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
export class ApiError extends Error {
  constructor(public status: number, public title: LocalizedText | undefined, public checks: ApiCheck[] = []) { super(title?.en ?? `HTTP ${status}`); }
}

async function send(method: string, path: string, body?: unknown, accept = 'application/json'): Promise<Response> {
  const headers: Record<string, string> = { Accept: accept };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${base}/api/v1${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  if (res.status === 401 && !path.startsWith('/auth/')) onUnauthorized?.();
  if (!res.ok) {
    // problem+json: `message` in every language, `code` = the server's message key.
    const problem = (await res.json().catch(() => ({}))) as { message?: LocalizedText; checks?: ApiCheck[] };
    throw new ApiError(res.status, problem.message, problem.checks ?? []);
  }
  return res;
}
export const apiGet = async <T>(path: string) => (await (await send('GET', path)).json()) as T;
export const apiPost = async <T>(path: string, body: unknown) => (await (await send('POST', path, body)).json()) as T;
export const apiPut = async <T>(path: string, body: unknown) => (await (await send('PUT', path, body)).json()) as T;
export const apiText = async (path: string) => (await send('GET', path, undefined, 'text/html, text/plain, application/problem+json')).text();
export const apiBlob = async (path: string) => (await send('GET', path, undefined, '*/*')).blob();

/* ——— platform/modules ——— */
export type FeatureKind = 'SERVICE' | 'VIEW' | 'DESK' | 'POLICY' | 'INTEGRATION';
export type FeatureImplementation = 'CONFIGURED' | 'CODED' | 'HYBRID';
export type FeatureStatus = 'AVAILABLE' | 'WAVE_2' | 'WAVE_3' | 'LATER' | 'HIDDEN';
export interface FeatureDescriptor { key: string; serviceId: string | null; kind: FeatureKind; implementation: FeatureImplementation; name: LocalizedText; status: FeatureStatus }
export interface ModuleDescriptor { key: string; catalogCode: string; name: LocalizedText; icon: string; order: number; features: FeatureDescriptor[] }
export const getModules = () => apiGet<ModuleDescriptor[]>('/modules');

/** Catalogue services a person can look for (hidden ones excluded). */
export const catalogServices = (modules: ModuleDescriptor[]) =>
  modules.flatMap((m) => m.features.filter((f): f is FeatureDescriptor & { serviceId: string } => f.kind === 'SERVICE' && !!f.serviceId && f.status !== 'HIDDEN'));
/* Arabic-aware matching (prototype app/search.ts): diacritics, hamza forms, taa marbuta and alif maqsura are folded. */
export const normalizeSearch = (s: string) => s.replace(/[\u064B-\u0652\u0640]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').toLowerCase();
const WAVE_RANK: Record<FeatureStatus, number> = { AVAILABLE: 0, WAVE_2: 1, WAVE_3: 2, LATER: 3, HIDDEN: 4 };
/** The search island: services whose name (any language) or code contains the query, available ones first. */
export function searchServices(modules: ModuleDescriptor[], q: string, limit = 8) {
  const n = normalizeSearch(q.trim()); if (!n) return [];
  return catalogServices(modules).filter((s) => normalizeSearch(`${Object.values(s.name).join(' ')} ${s.serviceId}`).includes(n))
    .sort((a, b) => WAVE_RANK[a.status] - WAVE_RANK[b.status]).slice(0, limit);
}

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

/* ——— mydata: employee profile, read live from SAP (never stored by the portal) ——— */
export interface EmployeeProfile { employeeNo: string; name: LocalizedText; dateOfBirth: string | null }
export const getProfile = () => apiGet<EmployeeProfile>('/mydata/profile');

/* ——— platform/requests ——— */
export type RequestStatus = 'in_review' | 'returned' | 'rejected' | 'completed' | 'withdrawn';
export type StepStatus = 'pending' | 'current' | 'done' | 'rejected' | 'skipped' | 'waiting';
export type StepMode = 'approve' | 'notify' | 'fulfil' | 'receipt' | 'system';
export interface RequestView { id: string; serviceId: string; module: string; feature: string; serviceName: LocalizedText; status: RequestStatus; channel: 'web' | 'app'; requester: PersonRef; createdAt: string; updatedAt: string }
export interface FieldView { key: string; label: LocalizedText; value: unknown; display: LocalizedText }
export interface StepDetail {
  id: number; key: string; title: LocalizedText; mode: StepMode; status: StepStatus; why: LocalizedText | null; assignees: PersonRef[]; actor: PersonRef | null;
  action: string | null; note: string | null; ref: string | null; startedAt: string | null; dueAt: string | null; completedAt: string | null; mine: boolean;
}
export interface AuditView { at: string; actor: PersonRef | null; what: LocalizedText }
export interface DocumentView { id: string; requestId: string; template: string; title: LocalizedText; number: string; verifyCode: string; holderId: string; issuedAt: string; revoked: boolean }
export interface RequestDetail { request: RequestView; fields: FieldView[]; steps: StepDetail[]; audit: AuditView[]; documents: DocumentView[]; next: LocalizedText | null }
export interface TaskItem { stepId: number; requestId: string; serviceId: string; serviceName: LocalizedText; stepTitle: LocalizedText; mode: StepMode; requester: PersonRef; startedAt: string; dueAt: string | null; overdue: boolean }
export type DecisionAction = 'approve' | 'reject' | 'done' | 'receive';

export const submitRequest = (serviceId: string, data: Record<string, unknown>, channel: 'web' | 'app') =>
  apiPost<RequestDetail>('/requests', { serviceId, data, channel });
export const getMyRequests = () => apiGet<RequestView[]>('/requests');
export const getRequest = (id: string) => apiGet<RequestDetail>(`/requests/${encodeURIComponent(id)}`);
export const getTasks = () => apiGet<TaskItem[]>('/tasks');
export const decide = (stepId: number, action: DecisionAction, note?: string, ref?: string) =>
  apiPost<RequestDetail>(`/tasks/${stepId}/decision`, { action, note, ref });

/* ——— platform/documents ——— */
export interface Verification { valid: boolean; revoked: boolean; title: LocalizedText | null; number: string | null; issuedAt: string | null; holder: LocalizedText | null }
export const getDocumentHtml = (id: string) => apiText(`/documents/${id}/html`);
export const getDocumentPdf = (id: string) => apiBlob(`/documents/${id}/pdf`);
export const verifyDocument = (code: string) => apiGet<Verification>(`/verify/${encodeURIComponent(code)}`);

/* ——— shared labels ——— */
export const REQUEST_STATUS: Record<RequestStatus, LocalizedText> = {
  in_review: { ar: 'قيد الاعتماد', en: 'In review' }, returned: { ar: 'معاد إليك', en: 'Returned' }, rejected: { ar: 'مرفوض', en: 'Rejected' },
  completed: { ar: 'مكتمل', en: 'Completed' }, withdrawn: { ar: 'مسحوب', en: 'Withdrawn' },
};
export const STEP_STATUS: Record<StepStatus, LocalizedText> = {
  pending: { ar: 'بانتظار', en: 'Pending' }, current: { ar: 'الآن', en: 'Now' }, done: { ar: 'تم', en: 'Done' }, rejected: { ar: 'مرفوض', en: 'Rejected' },
  skipped: { ar: 'لم ينطبق', en: 'Not applied' }, waiting: { ar: 'بانتظار التكامل', en: 'Waiting for integration' },
};
