/* v0.16 إدارة المستأجرين (بطاقة CAP-02 §5، D-033، خريطة الحالات §8): المستأجر جهة تشغّل البوابة نفسها بمفتاحها وهويتها ونظامها المرجعي وبيئاتها ومديريها ومصمّميها.
   العزل: كل خدمة وطلب وسجل وربط يحمل مفتاح مستأجره؛ الموظف لا يرى غير مستأجره؛ ومدير المنصّة يبدّل سياق المستأجر ليدير خدماته. الإضافة والإلغاء بتاريخ (P-12). */
import type { State, Tenant, T2, Env, Person } from './types';
import { toISO, TENANT_DEFAULT } from './policy';

const t2 = (ar: string, en: string): T2 => ({ ar, en });
export const TENANT_STATUS_TITLE: Record<Tenant['status'], T2> = { onboarding: t2('قيد الانضمام', 'Onboarding'), active: t2('سارٍ', 'Active'), ended: t2('منتهٍ', 'Ended') };
export const ERP_MODE_TITLE: Record<'shared' | 'own', T2> = { shared: t2('مشترك مع الأمانة (عميل آخر في S/4HANA نفسه)', 'Shared with the Secretariat (another client on the same S/4HANA)'), own: t2('نظام مرجعي مستقل', 'Its own system of record') };

export function liveTenants(state: State, today = toISO(Date.now())): Tenant[] { return (state.tenants || []).filter((t) => !t.endedAt || t.endedAt > today); }
export function currentTenant(state: State): Tenant | undefined { return (state.tenants || []).find((t) => t.id === state.tenant.id); }
/** مستأجر الموظف: من النظام المرجعي عند الربط؛ في النموذج الحي كل الموظفين للمستأجر الافتراضي */
export function tenantOfPerson(_state: State, p: Person): string { return (p as Person & { tenant?: string }).tenant || TENANT_DEFAULT; }
export function isPlatformAdmin(state: State, p: Person): boolean { return p.persona === 'admin' && tenantOfPerson(state, p) === TENANT_DEFAULT; }
/** هل يجوز لهذا الشخص تصميم خدمات هذا المجال في هذا المستأجر؟ مدير النظام دائماً، والمصمّم المفوَّض في مجالاته */
export function canDesign(state: State, p: Person, domain?: string): boolean {
  if (p.persona === 'admin') return true;
  const t = currentTenant(state); if (!t || !p.positionId) return false;
  const d = t.designers.find((x) => x.positionId === p.positionId); if (!d) return false;
  return d.domains === 'all' || !domain || d.domains.includes(domain);
}
export function blankTenant(id: string, name: T2, short: T2, at = Date.now()): Tenant {
  const initials = { ar: name.ar.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join(''), en: name.en.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() };
  return { id, name, short, initials, hue: 'teal', status: 'onboarding', joinedAt: toISO(at), lang: 'ar', env: 'dev', erp: { mode: 'shared', systemId: '', client: '', envs: { dev: { host: '', status: 'unbound' }, test: { host: '', status: 'unbound' }, prod: { host: '', status: 'unbound' } } }, admins: [], designers: [], createdAt: at };
}
export function addTenant(state: State, t: Tenant): State { if ((state.tenants || []).some((x) => x.id === t.id)) return state; return { ...state, tenants: [...(state.tenants || []), t] }; }
export function updateTenant(state: State, id: string, patch: Partial<Tenant>): State {
  const tenants = (state.tenants || []).map((t) => (t.id === id ? { ...t, ...patch } : t));
  const cur = tenants.find((t) => t.id === state.tenant.id);
  return { ...state, tenants, tenant: cur ? { id: cur.id, name: cur.name } : state.tenant };
}
/** تبديل سياق المستأجر (مدير المنصّة): الخدمات والطلبات والسجلات تُقرأ به */
export function switchTenant(state: State, id: string): State { const t = (state.tenants || []).find((x) => x.id === id); return t ? { ...state, tenant: { id: t.id, name: t.name } } : state; }
export const ENV_OF: Env[] = ['dev', 'test', 'prod'];
export function tenantKey(s: string): string { return s.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 12); }
