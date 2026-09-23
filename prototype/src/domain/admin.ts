/* v0.18 مركز الإدارة (ملاحظة عمر بعد v0.17: «انظر إلى شاشات الإدارة كلها واجعلها الأفضل لمدير النظام، وإن أمكن اجعلها كصفحة إدارة وفيها كل شيء»):
   نظرة واحدة على كل ما يديره مدير النظام — السياسات الأربع بحالة إصداراتها، وما يحتاجه منه الآن (مسودات لم تُجدوَل، وإصدارات تنتظر الموافقة الثانية،
   وعيوب في المصمّم، وعقود غير مربوطة تستعملها خدمات سارية، وقيود تنتهي قريباً، وطلبات تجاوزت مهلتها، ومستأجر بلا مدير، وإقفال الفترة والنوافذ الموسمية)،
   والبنية بأرقامها، والطلبات بأعدادها. كله قراءة من الحالة؛ لا يغيّر شيئاً. */
import type { State, T2, Request, Step } from './types';
import { statusOf, toISO, addDays, liveNeed, type PolicyState, type PolicyVersion } from './policy';
import { designerContent, designerProblems, liveServices, registerEntries, registerIds } from './designer';
import { CONTRACTS, contractReady } from './contracts';
import { liveTenants } from './tenants';
import { holderOf } from './engine';

export type PolicyKey = 'leave' | 'need' | 'comms' | 'designer';
export interface PolicyCard { key: PolicyKey; href: string; active?: PolicyVersion; draft?: PolicyVersion; scheduled?: PolicyVersion; awaiting?: PolicyVersion; lastChangeAt?: number; countText: T2 }
export interface FocusItem { id: string; tone: 'warn' | 'danger' | 'tint' | 'info'; icon: 'pen' | 'shield' | 'alert' | 'plug' | 'clock' | 'building' | 'lock' | 'calendar' | 'book'; title: T2; sub?: T2; href: string; action: 'open' | 'fix' | 'schedule' | 'bind' | 'see' }
export interface OverdueRow { r: Request; step: Step; holder: string; holderEn: string; hours: number }
export interface AdminOverview {
  policies: PolicyCard[];
  focus: FocusItem[];
  numbers: { inReview: number; overdue: number; completedWeek: number; newWeek: number; returned: number };
  structure: { units: number; positions: number; vacant: number };
  tenants: { total: number; active: number; onboarding: number };
  contracts: { total: number; bound: number; tested: number; unboundUsed: number };
  registers: { entries: number; expiring: number };
  ops: { periodUntil?: string; openWindows: string[] };
  overdue: OverdueRow[];
}

const POLICY_TITLE: Record<PolicyKey, T2> = { leave: { ar: 'سياسة الإجازات', en: 'Leave policy' }, need: { ar: 'سياسة الاحتياج', en: 'Needs policy' }, comms: { ar: 'سياسة الأخبار والقصص', en: 'News & stories policy' }, designer: { ar: 'مصمّم الخدمات', en: 'Service designer' } };
export const policyTitle = (k: PolicyKey): T2 => POLICY_TITLE[k];
const HREF: Record<PolicyKey, string> = { leave: '#/admin/policy', need: '#/admin/need', comms: '#/admin/comms', designer: '#/admin/designer' };

function summarize(ps: PolicyState, today: string): Omit<PolicyCard, 'key' | 'href' | 'countText'> {
  const vs = ps.versions; const withStatus = vs.map((v) => ({ v, st: statusOf(v, vs, today) }));
  const active = withStatus.filter((x) => x.st === 'active').map((x) => x.v).sort((a, b) => (a.from < b.from ? 1 : -1))[0];
  const draft = withStatus.find((x) => x.st === 'draft')?.v; const scheduled = withStatus.filter((x) => x.st === 'scheduled').map((x) => x.v).sort((a, b) => (a.from < b.from ? -1 : 1))[0];
  const awaiting = withStatus.find((x) => x.st === 'awaiting')?.v;
  const lastChangeAt = Math.max(0, ...vs.map((v) => v.createdAt || 0), ...vs.flatMap((v) => (v.changes || []).map((c) => (c as { at?: number }).at || 0)), ...(ps.opsLog || []).map((o) => o.at || 0)) || undefined;
  return { active, draft, scheduled, awaiting, lastChangeAt };
}

export function adminOverview(state: State, now = Date.now()): AdminOverview {
  const today = toISO(now); const weekAgo = now - 7 * 86400000;
  /* السياسات الأربع */
  const leaveC = state.policy.versions.length ? (() => { const v = state.policy.versions; const a = v.find((x) => statusOf(x, v, today) === 'active'); return (a?.content.types || []).filter((t) => t.enabled).length; })() : 0;
  const needC = state.needPolicy?.versions?.length ? (() => { const v = state.needPolicy.versions; const a = v.find((x) => statusOf(x, v, today) === 'active'); return liveNeed(a?.content.need?.categories || [], today).length; })() : 0;
  const commsC = state.commsPolicy?.versions?.length ? (() => { const v = state.commsPolicy.versions; const a = v.find((x) => statusOf(x, v, today) === 'active'); return liveNeed(a?.content.comms?.sectors || [], today).length; })() : 0;
  const dzServices = liveServices(state, today).length;
  const policies: PolicyCard[] = [
    { key: 'leave', href: HREF.leave, ...summarize(state.policy, today), countText: { ar: `${leaveC} أنواع`, en: `${leaveC} types` } },
    { key: 'need', href: HREF.need, ...summarize(state.needPolicy, today), countText: { ar: `${needC} فئات`, en: `${needC} categories` } },
    { key: 'comms', href: HREF.comms, ...summarize(state.commsPolicy, today), countText: { ar: `${commsC} قطاعات ناشرة`, en: `${commsC} publishing sectors` } },
    { key: 'designer', href: HREF.designer, ...summarize(state.designer, today), countText: { ar: `${dzServices} خدمات مهيّأة`, en: `${dzServices} configured services` } },
  ];
  /* يحتاجك */
  const focus: FocusItem[] = [];
  for (const p of policies) {
    const t = POLICY_TITLE[p.key];
    if (p.awaiting) focus.push({ id: `aw-${p.key}`, tone: 'warn', icon: 'shield', title: { ar: `${t.ar}: الإصدار ${p.awaiting.number} ينتظر الموافقة الثانية`, en: `${t.en}: version ${p.awaiting.number} awaits the second approval` }, href: p.href, action: 'open' });
    if (p.draft) focus.push({ id: `dr-${p.key}`, tone: 'tint', icon: 'pen', title: { ar: `مسودة ${t.ar} لم تُجدوَل`, en: `${t.en} draft not scheduled` }, sub: { ar: `منذ ${toISO(p.draft.createdAt || now)}`, en: `since ${toISO(p.draft.createdAt || now)}` }, href: p.href, action: 'schedule' });
    if (p.scheduled && p.scheduled.from <= addDays(today, 7)) focus.push({ id: `sc-${p.key}`, tone: 'info', icon: 'calendar', title: { ar: `${t.ar}: الإصدار ${p.scheduled.number} يسري ${p.scheduled.from}`, en: `${t.en}: version ${p.scheduled.number} takes effect ${p.scheduled.from}` }, href: p.href, action: 'see' });
  }
  const dzDraft = state.designer.versions.find((v) => statusOf(v, state.designer.versions, today) === 'draft');
  const problems = designerProblems(state, dzDraft ? dzDraft.content.designer || designerContent(state, today) : designerContent(state, today), today);
  if (problems.length) focus.push({ id: 'dz-problems', tone: 'danger', icon: 'alert', title: { ar: problems.length === 1 ? 'عيب في المصمّم يمنع الجدولة' : `${problems.length} عيوب في المصمّم تمنع الجدولة`, en: problems.length === 1 ? 'A designer defect blocks scheduling' : `${problems.length} designer defects block scheduling` }, sub: { ar: problems.slice(0, 2).map((x) => x.text.ar).join(' · '), en: problems.slice(0, 2).map((x) => x.text.en).join(' · ') }, href: '#/admin/designer', action: 'fix' });
  /* عقود غير مربوطة تستعملها خدمات سارية */
  const used = new Set<string>(); for (const s of liveServices(state, today)) { for (const st of s.route) if (st.contractId) used.add(st.contractId); for (const o of s.outputs || []) if (o.contractId) used.add(o.contractId); }
  const unboundUsed = [...used].filter((cid) => !contractReady(state, cid).ok);
  if (unboundUsed.length) focus.push({ id: 'ct-unbound', tone: 'danger', icon: 'plug', title: { ar: unboundUsed.length === 1 ? 'عقد غير مربوط تستعمله خدمة سارية' : `${unboundUsed.length} عقود غير مربوطة تستعملها خدمات سارية`, en: unboundUsed.length === 1 ? 'An unbound contract is used by a live service' : `${unboundUsed.length} unbound contracts are used by live services` }, sub: { ar: unboundUsed.join(' · '), en: unboundUsed.join(' · ') }, href: '#/admin/contracts', action: 'bind' });
  /* قيود تنتهي قريباً */
  const soon = addDays(today, 30); const regs = registerIds(state, today); const entries = regs.flatMap((r) => registerEntries(state, r.id));
  const expiring = entries.filter((e) => e.status === 'active' && e.expiresAt && e.expiresAt <= soon);
  if (expiring.length) focus.push({ id: 'rg-expiring', tone: 'warn', icon: 'book', title: { ar: expiring.length === 1 ? 'قيد ينتهي خلال 30 يوماً' : `${expiring.length} قيود تنتهي خلال 30 يوماً`, en: expiring.length === 1 ? 'A register entry expires within 30 days' : `${expiring.length} register entries expire within 30 days` }, href: `#/admin/registers${regs.length === 1 ? `/${regs[0].id}` : ''}`, action: 'see' });
  /* طلبات تجاوزت مهلتها */
  const overdue: OverdueRow[] = [];
  for (const r of state.requests) {
    if (r.status !== 'in_review') continue;
    for (const st of r.steps) {
      if (st.status !== 'current' || st.notifyOnly || st.mode === 'wait' || (st.mode === 'system' && st.desk === 'system')) continue;
      const sla = st.slaHours ?? 0; if (!sla) continue; const due = (st.startedAt || r.createdAt) + sla * 3600000; if (now <= due) continue;
      const pid = st.assigneeIds?.[0]; const h = pid ? state.people.find((p) => p.id === pid) : undefined; const pos = st.positionIds?.[0]; const hp = !h && pos ? holderOf(state, pos) : undefined; const who = h || hp;
      overdue.push({ r, step: st, holder: who ? who.name : '—', holderEn: who ? who.nameEn : '—', hours: Math.round((now - due) / 3600000) });
    }
  }
  overdue.sort((a, b) => b.hours - a.hours);
  if (overdue.length) focus.push({ id: 'rq-overdue', tone: 'warn', icon: 'clock', title: { ar: overdue.length === 1 ? 'طلب تجاوز مهلته' : `${overdue.length} طلبات تجاوزت مهلتها`, en: overdue.length === 1 ? 'A request is past its deadline' : `${overdue.length} requests are past their deadline` }, href: '#/admin#overdue', action: 'see' });
  /* مستأجر قيد الانضمام بلا مدير */
  const tenants = liveTenants(state, today);
  for (const tn of tenants) if (tn.status === 'onboarding' && !(tn.admins || []).length) focus.push({ id: `tn-${tn.id}`, tone: 'info', icon: 'building', title: { ar: `${tn.short.ar}: قيد الانضمام بلا مدير`, en: `${tn.short.en}: onboarding with no administrator` }, href: '#/admin/tenants', action: 'open' });
  /* التشغيل */
  const pc = state.policy.periodClose; const openWindows = Object.entries(state.policy.windows || {}).filter(([, w]) => w.open).map(([k]) => k);
  if (pc && pc.until >= today) focus.push({ id: 'ops-close', tone: 'info', icon: 'lock', title: { ar: `الفترة مقفلة حتى ${pc.until}`, en: `The period is closed until ${pc.until}` }, sub: { ar: pc.reason, en: pc.reason }, href: '#/admin/policy/ops', action: 'see' });
  /* الأرقام */
  const inReview = state.requests.filter((r) => r.status === 'in_review').length; const returned = state.requests.filter((r) => r.status === 'returned').length;
  const completedWeek = state.requests.filter((r) => r.status === 'completed' && r.updatedAt >= weekAgo).length; const newWeek = state.requests.filter((r) => r.createdAt >= weekAgo).length;
  const vacant = state.org.positions.filter((p) => !p.holderId).length;
  const bindings = (state.contracts?.bindings || []).filter((b) => (!b.endedAt || b.endedAt > today) && b.tenant === state.tenant.id);
  return {
    policies, focus,
    numbers: { inReview, overdue: overdue.length, completedWeek, newWeek, returned },
    structure: { units: state.org.units.length, positions: state.org.positions.length, vacant },
    tenants: { total: tenants.length, active: tenants.filter((t) => t.status === 'active').length, onboarding: tenants.filter((t) => t.status === 'onboarding').length },
    contracts: { total: CONTRACTS.length, bound: bindings.filter((b) => b.status !== 'unbound').length, tested: bindings.filter((b) => b.status === 'tested').length, unboundUsed: unboundUsed.length },
    registers: { entries: entries.length, expiring: expiring.length },
    ops: { periodUntil: pc && pc.until >= today ? pc.until : undefined, openWindows },
    overdue: overdue.slice(0, 8),
  };
}
