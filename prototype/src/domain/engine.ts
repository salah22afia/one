// محرك الطلب الواحد: إنشاء، قرار، إعادة، سحب، إصدار المستند، وتوليد التنبيهات؛ ومحرك المسارات والصلاحيات (بطاقة CAP-01):
// المعتمد منصب لا شخص، ويُستخرج من الهيكل التنظيمي عند فتح الخطوة؛ لا اعتماد ذاتي ولا توقف عند شاغر. دوال نقية على الحالة.
import type { State, Request, Step, Desk, Field, T2, Notification, NotifKind, Person, PersonaKey, LeaveInfo, OrgUnit, Position, OrgLevel, NeedInfo, NeedBranch, NeedLine } from './types';
import { ORG_LEVELS } from './types';
import { DESK_TITLE, LEVEL_HEAD, evaluateLeave, versionOn, inForce, supersedes, statusOf, cycleStatus, toISO, fromISO, addDays, conditionHolds, conditionText, stepTitle, agentTitle, deskForAgent, cancelRuleOf, onCancelOf, periodClosed, type PeriodClose, type PolicyVersion, type AgentRule, type RouteStep, type Route, type PolicyContent, type Check, type Entitlement } from './policy';
import { changesText, daysText } from '../app/i18n';
/* v0.16: الخدمة المهيّأة — الشروط المؤجَّلة ونماذج الخطوات والعقود والمخرجات (استيراد دائري على مستوى الدوال فقط) */
import { serviceOfRequest, condHolds, condText, contractInputsFor, applyConfiguredOutputs, afterStepDone, applyNotifyRules, allowedDecisions, stepOutcomes } from './designer';
import { runContract } from './contracts';

/* ——— الهيكل التنظيمي: قراءة وحدات ومناصب وشاغلين (من النظام المرجعي) ——— */
export function positionById(state: State, id?: string): Position | undefined { return id ? state.org.positions.find((p) => p.id === id) : undefined; }
export function unitById(state: State, id?: string): OrgUnit | undefined { return id ? state.org.units.find((u) => u.id === id) : undefined; }
export function personById(state: State, id: string): Person | undefined { return state.people.find((p) => p.id === id); }
export function positionOf(state: State, person: Person): Position | undefined { return positionById(state, person.positionId); }
export function unitOf(state: State, person: Person): OrgUnit | undefined { return unitById(state, positionOf(state, person)?.unitId); }
export function holderOf(state: State, positionId?: string): Person | undefined { const pos = positionById(state, positionId); return pos?.holderId ? personById(state, pos.holderId) : undefined; }
const levelIndex = (l: OrgLevel) => ORG_LEVELS.indexOf(l);
/** المنصب الرئيس للوحدة التي يقع فيها منصب ما؛ وإن كان المنصب هو الرئيس فالرئيس الأعلى */
function superiorPositionId(state: State, positionId: string): string | undefined {
  const pos = positionById(state, positionId); if (!pos) return undefined;
  let unit = unitById(state, pos.unitId);
  if (unit && unit.chiefPositionId === pos.id) unit = unitById(state, unit.parentId);
  return unit?.chiefPositionId;
}
export interface Holder { personId?: string; positionId: string; via: 'holder' | 'deputy' | 'superior' | 'none'; note?: T2 }
/** شاغل منصب لحظة الاستخراج: الشاغل، وإلا النائب، وإلا الرئيس الأعلى (مع سبب مقروء)؛ يستثني شخصاً (الطالب) */
export function resolveHolder(state: State, positionId: string, excludeId?: string, depth = 0): Holder {
  const pos = positionById(state, positionId); if (!pos) return { positionId, via: 'none' };
  const holder = pos.holderId ? personById(state, pos.holderId) : undefined;
  if (holder && holder.id !== excludeId) return { personId: holder.id, positionId, via: 'holder' };
  const title = pos.title;
  if (pos.deputyPositionId) { const d = resolveHolder(state, pos.deputyPositionId, excludeId, depth + 1); if (d.personId) return { ...d, via: 'deputy', note: holder ? { ar: `${title.ar}: المعتمد هو الطالب نفسه؛ إلى النائب`, en: `${title.en}: the approver is the requester; to the deputy` } : { ar: `${title.ar} شاغر؛ إلى النائب`, en: `${title.en} is vacant; to the deputy` } }; }
  if (depth > 6) return { positionId, via: 'none' };
  const sup = superiorPositionId(state, positionId);
  if (sup) { const r = resolveHolder(state, sup, excludeId, depth + 1); if (r.personId) return { ...r, via: 'superior', note: holder ? { ar: `${title.ar}: المعتمد هو الطالب نفسه؛ انتقلت إلى المستوى الأعلى`, en: `${title.en}: the approver is the requester; moved up a level` } : { ar: `${title.ar} شاغر ولا نائب؛ إلى الرئيس الأعلى`, en: `${title.en} is vacant with no deputy; to the superior` } }; }
  return { positionId, via: 'none', note: { ar: `${title.ar} شاغر`, en: `${title.en} is vacant` } };
}
/** منصب المدير المباشر: الرئيس لوحدة الموظف، أو رئيس الوحدة الأعلى إن كان هو رئيس وحدته */
export function lineManagerPositionId(state: State, person: Person): string | undefined {
  const pos = positionOf(state, person); if (!pos) return undefined;
  return superiorPositionId(state, pos.id);
}
export function lineManagerOf(state: State, person: Person): Person | undefined {
  const pid = lineManagerPositionId(state, person); if (pid) { const h = resolveHolder(state, pid, person.id); if (h.personId) return personById(state, h.personId); }
  return person.managerId ? personById(state, person.managerId) : undefined;
}
/** رئيس الوحدة بمستوى معيّن فوق الموظف (أو مستواها إن كانت وحدته بذلك المستوى) */
export function orgHeadPositionId(state: State, person: Person, level: OrgLevel): string | undefined {
  let unit = unitOf(state, person);
  while (unit && levelIndex(unit.level) < levelIndex(level)) unit = unitById(state, unit.parentId);
  return unit?.chiefPositionId;
}
/** السلسلة الإدارية من المدير المباشر صعوداً حتى مستوى (مناصب رئيسة مرتبة، بلا تكرار) */
export function chainPositionIds(state: State, person: Person, upTo: OrgLevel): { positionId: string; level: OrgLevel }[] {
  const out: { positionId: string; level: OrgLevel }[] = [];
  let pid = lineManagerPositionId(state, person); const seen = new Set<string>();
  while (pid && !seen.has(pid)) {
    seen.add(pid); const pos = positionById(state, pid); const unit = unitById(state, pos?.unitId); if (!pos || !unit) break;
    out.push({ positionId: pid, level: unit.level });
    if (levelIndex(unit.level) >= levelIndex(upTo)) break;
    pid = superiorPositionId(state, pid);
  }
  return out;
}
export function poolPositionIds(state: State, unitId: string): string[] { return state.org.positions.filter((p) => p.unitId === unitId).map((p) => p.id); }
export function teamOf(state: State, me: Person): Person[] { return state.people.filter((p) => p.id !== me.id && p.positionId && lineManagerOf(state, p)?.id === me.id); }
export function personName(p: Person | undefined, lang: 'ar' | 'en'): string { return p ? (lang === 'ar' ? p.name : p.nameEn) : ''; }
const t2 = (ar: string, en: string): T2 => ({ ar, en });
const joinT2 = (xs: T2[], sep: T2): T2 => ({ ar: xs.map((x) => x.ar).join(sep.ar), en: xs.map((x) => x.en).join(sep.en) });
const nameT2 = (p?: Person): T2 => (p ? { ar: p.name, en: p.nameEn } : { ar: '—', en: '—' });
export const namesFor = (state: State) => ({ position: (id: string) => positionById(state, id)?.title, unit: (id: string) => unitById(state, id)?.name });

/* ——— استخراج معتمدي خطوة: أشخاص لحظة الاستخراج، ومناصبهم، وسبب مقروء ——— */
export interface Resolution { personIds: string[]; positionIds: string[]; why: T2; skipped?: T2 }
export function resolveAgent(state: State, requester: Person, agent: AgentRule): Resolution {
  const one = (pid: string | undefined, label: T2): Resolution => {
    if (!pid) return { personIds: [], positionIds: [], why: label, skipped: t2('لا منصب مطابق في الهيكل التنظيمي', 'No matching position in the org structure') };
    const h = resolveHolder(state, pid, requester.id); const pos = positionById(state, pid);
    if (!h.personId) return { personIds: [], positionIds: [pid], why: label, skipped: h.note || t2('المنصب شاغر', 'Position vacant') };
    const who = personById(state, h.personId);
    const base: T2 = { ar: `${label.ar}: ${pos?.title.ar || ''} — ${nameT2(who).ar}`, en: `${label.en}: ${pos?.title.en || ''} — ${nameT2(who).en}` };
    return { personIds: [h.personId], positionIds: [h.positionId], why: h.note ? { ar: `${base.ar} (${h.note.ar})`, en: `${base.en} (${h.note.en})` } : base };
  };
  if (agent.kind === 'lineManager') { const u = unitOf(state, requester); return one(lineManagerPositionId(state, requester), { ar: `المدير المباشر (رئيس ${u?.name.ar || 'وحدة الطالب'})`, en: `Line manager (head of ${u?.name.en || "the requester's unit"})` }); }
  if (agent.kind === 'orgHead') { const lvl = agent.level || 'department'; const pid = orgHeadPositionId(state, requester, lvl); const u = unitById(state, positionById(state, pid)?.unitId); return one(pid, { ar: `${LEVEL_HEAD[lvl].ar} (${u?.name.ar || ''})`, en: `${LEVEL_HEAD[lvl].en} (${u?.name.en || ''})` }); }
  if (agent.kind === 'requester') return { personIds: [requester.id], positionIds: [], why: t2('الموظف نفسه', 'The employee') };
  if (agent.kind === 'pool') {
    const unit = unitById(state, agent.unitId); const pids = agent.unitId ? poolPositionIds(state, agent.unitId) : [];
    const persons = pids.map((pid) => holderOf(state, pid)).filter((p): p is Person => !!p && p.id !== requester.id);
    if (!persons.length) return { personIds: [], positionIds: pids, why: t2(`فريق ${unit?.name.ar || ''}`, `${unit?.name.en || ''} team`), skipped: t2('لا شاغلين في فريق العمل', 'No holders in the work pool') };
    return { personIds: persons.map((p) => p.id), positionIds: pids, why: { ar: `فريق ${unit?.name.ar || ''}: ${persons.length} ${persons.length <= 10 ? 'أعضاء' : 'عضواً'}، أول من يلتقط المهمة يقررها`, en: `${unit?.name.en || ''} team: ${persons.length} members, the first to pick it up decides` } };
  }
  // مناصب محددة (أي واحد / الكل)
  const ids = agent.positionIds || []; const hs = ids.map((pid) => ({ pid, h: resolveHolder(state, pid, requester.id) }));
  const persons = hs.filter((x) => x.h.personId); const positionIds = Array.from(new Set(hs.map((x) => x.h.positionId)));
  if (!persons.length) return { personIds: [], positionIds: ids, why: agentTitle(agent, namesFor(state)), skipped: hs[0]?.h.note || t2('المناصب شاغرة', 'Positions vacant') };
  const parts = persons.map((x) => { const pos = positionById(state, x.pid); const who = personById(state, x.h.personId!); return { ar: `${pos?.title.ar || x.pid} — ${nameT2(who).ar}${x.h.note ? ` (${x.h.note.ar})` : ''}`, en: `${pos?.title.en || x.pid} — ${nameT2(who).en}${x.h.note ? ` (${x.h.note.en})` : ''}` }; });
  const q = ids.length > 1 ? (agent.quorum === 'all' ? t2('؛ يلزم اعتماد الكل', '; all must approve') : t2('؛ يكفي أي واحد', '; any one suffices')) : t2('', '');
  const why = joinT2(parts, t2('، ', ', '));
  return { personIds: Array.from(new Set(persons.map((x) => x.h.personId!))), positionIds, why: { ar: why.ar + q.ar, en: why.en + q.en } };
}
/** الشاغلون الحاليون لخطوة (للمهام): يُعاد الاستخراج من مناصبها فتنتقل المهمة مع تغيّر الشاغل */
export function currentAssignees(state: State, r: Request, step: Step): string[] {
  /* v0.9: توقيع الاستلام للمستفيد (قد يكون غير الطالب) */
  if (step.role === 'handoverSign') return [r.need?.beneficiaryId || r.requesterId];
  if (step.desk === 'requester' || step.mode === 'receipt') return [r.requesterId];
  if (step.positionIds && step.positionIds.length) {
    const ids = step.positionIds.map((pid) => (step.agent?.kind === 'pool' ? holderOf(state, pid)?.id : resolveHolder(state, pid, r.requesterId).personId)).filter((x): x is string => !!x && x !== r.requesterId);
    if (ids.length) return Array.from(new Set(ids));
  }
  return step.assigneeIds || [];
}
export function assigneesFor(state: State, r: Request, step: Step): Person[] { return currentAssignees(state, r, step).map((id) => personById(state, id)).filter((p): p is Person => !!p); }
/** أول معتمد للخطوة (للعرض) */
export function assigneeFor(state: State, r: Request, step: Step): Person | undefined { return assigneesFor(state, r, step)[0]; }
/** من يقف عند الخطوة (للعرض): المقرِّر إن أُنجزت، وشاغلو مناصبها الآن إن كانت حالية أو لاحقة، وإلا عناوين مناصبها أو قاعدتها */
export function stepWho(state: State, r: Request, s: Step, lang: 'ar' | 'en'): string {
  if (s.desk === 'system' || s.mode === 'system') return DESK_TITLE.system[lang];
  if (s.status === 'done' || s.status === 'returned' || s.status === 'rejected') { const who = s.actorId && s.actorId !== 'system' ? personById(state, s.actorId) : undefined; if (who) return personName(who, lang); }
  const people = assigneesFor(state, r, s); const sep = lang === 'ar' ? '، ' : ', ';
  if (people.length) return people.map((p) => personName(p, lang)).join(people.length > 1 && s.quorum === 'all' ? (lang === 'ar' ? ' و' : ' & ') : sep);
  if (s.positionIds?.length) return s.positionIds.map((id) => positionById(state, id)?.title[lang] || id).join(' / ');
  if (s.agent) return agentTitle(s.agent, namesFor(state))[lang];
  return DESK_TITLE[s.desk][lang];
}
/** تغيير شاغل منصب (كما يصل من النظام المرجعي): المهام المفتوحة على المنصب تنتقل إلى الشاغل الجديد بسطر في السجل وتنبيه */
export function setHolder(state: State, positionId: string, personId: string | undefined, at = Date.now()): State {
  const pos = positionById(state, positionId); if (!pos || pos.holderId === personId) return state;
  const prev = pos.holderId; const newcomer = personId ? personById(state, personId) : undefined;
  let s: State = { ...state,
    org: { ...state.org, positions: state.org.positions.map((p) => (p.id === positionId ? { ...p, holderId: personId } : personId && p.holderId === personId ? { ...p, holderId: undefined } : p)) },
    people: state.people.map((p) => (personId && p.id === personId ? { ...p, positionId } : prev && p.id === prev ? { ...p, positionId: undefined } : p)) };
  for (const r of state.requests) {
    if (r.status !== 'in_review' && r.status !== 'completed') continue;
    const i = r.steps.findIndex((x) => x.status === 'current'); if (i < 0) continue; const st = r.steps[i];
    const before = currentAssignees(state, r, st); const after = currentAssignees(s, r, st);
    const added = after.filter((id) => !before.includes(id)); const removed = before.filter((id) => !after.includes(id));
    if (!added.length && !removed.length) continue;
    const title = requestTitle(r); const requester = personById(s, r.requesterId);
    const what: T2 = newcomer ? { ar: `تغيّر شاغل ${pos.title.ar}؛ انتقلت المهمة إلى ${newcomer.name}`, en: `${pos.title.en} holder changed; the task moved to ${newcomer.nameEn}` } : { ar: `شغر ${pos.title.ar}؛ انتقلت المهمة إلى ${after.map((id) => personById(s, id)?.name || '').join('، ') || 'بلا شاغل'}`, en: `${pos.title.en} became vacant; the task moved to ${after.map((id) => personById(s, id)?.nameEn || '').join(', ') || 'no holder'}` };
    s = { ...s, requests: s.requests.map((x) => (x.id === r.id ? { ...x, steps: x.steps.map((y, k) => (k === i ? { ...y, assigneeIds: after } : y)), audit: [...x.audit, { at, who: 'system', what }] } : x)) };
    s = notifyMany(s, added, { kind: 'task', at, link: '#/inbox', title: { ar: `انتقلت إليك مهمة: ${title.ar}`, en: `A task moved to you: ${title.en}` }, body: { ar: `${requester?.name || ''} · ${r.id} · ${st.title.ar} (بصفتك ${pos.title.ar}).`, en: `${requester?.nameEn || ''} · ${r.id} · ${st.title.en} (as ${pos.title.en}).` } });
    s = notifyMany(s, removed, { kind: 'status', at, link: `#/requests/${r.id}`, title: { ar: `سُحبت مهمة ${title.ar} ${r.id}`, en: `Task ${title.en} ${r.id} withdrawn` }, body: { ar: `انتقلت مع تغيّر شاغل ${pos.title.ar}.`, en: `Moved with the change of the ${pos.title.en} holder.` } });
  }
  return s;
}

/* ——— بناء خطوات الطلب من المسار: الشروط، والتوسيع، والاستخراج، والتخطي، والدمج ——— */
export interface BuiltSteps { steps: Step[]; notApplied: { title: T2; why: T2 }[] }
const levelOfPosition = (state: State, pid: string): OrgLevel => unitById(state, positionById(state, pid)?.unitId)?.level || 'section';
export function buildSteps(state: State, requester: Person, route: Route, ctx: { days: number; workingDays: number }, systemTitle?: T2, groupNames?: { group?: (id: string) => string; subgroup?: (id: string) => string; location?: (id: string) => string }): BuiltSteps {
  const names = namesFor(state); const steps: Step[] = []; const notApplied: BuiltSteps['notApplied'] = []; let prev: string | undefined; let n = 0;
  /* v0.16: خصائص خطوة الخدمة المهيّأة تُنقل إلى خطوة الطلب (المعرّف، ونموذج الخطوة، والمجموعة، والشرط المؤجَّل، والاعتماد الآلي، والانتظار، والعقد) — صورة لحظة التقديم (D-009) */
  const dz = (rs: RouteStep) => ({ id: rs.id, form: rs.form ? JSON.parse(JSON.stringify(rs.form)) as RouteStep['form'] : undefined, group: rs.group, cond: rs.cond, auto: rs.auto, wait: rs.wait, contractId: rs.contractId, mapping: rs.mapping });
  const push = (rs: RouteStep, res: Resolution, title: T2) => {
    if (res.skipped) { notApplied.push({ title, why: res.skipped }); return; }
    if (rs.mode === 'approve' && res.personIds.length === 1 && prev === res.personIds[0] && !rs.form && !rs.group) { notApplied.push({ title, why: t2('المعتمد نفسه اعتمد الخطوة السابقة؛ دُمجت الخطوتان', 'Same approver as the previous step; merged') }); return; }
    n += 1;
    const q = rs.agent.kind === 'positions' && (rs.agent.positionIds || []).length > 1 ? rs.agent.quorum || 'any' : 'any';
    steps.push({ key: `s${n}`, desk: deskForAgent(rs.agent), title, status: 'pending', mode: rs.mode, agent: rs.agent, assigneeIds: res.personIds, positionIds: res.positionIds, quorum: q === 'majority' ? 'all' : q, majority: q === 'majority' || undefined, why: res.why, notifyOnly: rs.mode === 'notify', slaHours: rs.slaHours, escalation: rs.escalation, when: rs.when, entitlementId: rs.entitlementId, ...dz(rs) });
    prev = res.personIds.length === 1 ? res.personIds[0] : undefined;
  };
  for (const rs of route.steps) {
    const title = rs.title || stepTitle(rs, names);
    /* v0.16: خطوات النظام (عقد) والانتظار لا معتمد لها؛ تُفتح وتُنجز بالمحرك */
    if (rs.mode === 'wait' || rs.mode === 'system') { n += 1; steps.push({ key: `s${n}`, desk: 'system', title, status: 'pending', mode: rs.mode, slaHours: 0, ...dz(rs) }); prev = undefined; continue; }
    if (!conditionHolds(rs.when, ctx, requester)) { notApplied.push({ title, why: { ar: `الشرط لم يتحقق: ${conditionText(rs.when!, 'ar', groupNames)}`, en: `Condition not met: ${conditionText(rs.when!, 'en', groupNames)}` } }); continue; }
    if (rs.agent.kind === 'chain') {
      const chain = chainPositionIds(state, requester, rs.agent.upTo || 'ga');
      if (!chain.length) { notApplied.push({ title, why: t2('لا سلسلة إدارية فوق الطالب في الهيكل', 'No management chain above the requester') }); continue; }
      for (const link of chain) { const sub: RouteStep = { ...rs, agent: { kind: 'positions', positionIds: [link.positionId], quorum: 'any' } }; const head = LEVEL_HEAD[link.level]; const res = resolveAgent(state, requester, sub.agent); push(sub, res, rs.mode === 'notify' ? t2(`إشعار ${head.ar}`, `${head.en} notified`) : t2(`اعتماد ${head.ar}`, `${head.en} approval`)); }
      continue;
    }
    push(rs, resolveAgent(state, requester, rs.agent), title);
  }
  steps.push({ key: 'sys', desk: 'system', title: systemTitle || t2('التسجيل في النظام المرجعي', 'Posted to the system of record'), status: 'pending', slaHours: 0, mode: 'system' });
  return { steps, notApplied };
}

/* ——— مسارات الخدمات الأخرى في الموجة الأولى (مبدئية حتى بطاقاتها) بقواعد الاستخراج نفسها ——— */
const ROUTES: Record<string, Route> = {
  'TM-01': { id: 'TM-01', name: t2('طلب إجازة', 'Leave'), steps: [{ agent: { kind: 'lineManager' }, mode: 'approve', slaHours: 48 }, { agent: { kind: 'pool', unitId: 'O-211' }, mode: 'approve', slaHours: 48, title: t2('تدقيق شؤون الموظفين', 'Personnel affairs check') }] },
  'DC-01': { id: 'DC-01', name: t2('خطاب تعريف', 'Employment letter'), steps: [{ agent: { kind: 'pool', unitId: 'O-211' }, mode: 'fulfil', slaHours: 48, title: t2('إصدار الخطاب من شؤون الموظفين', 'Letter issued by personnel affairs') }] },
  'MD-01': { id: 'MD-01', name: t2('تحديث بياناتي', 'Update my data'), steps: [{ agent: { kind: 'pool', unitId: 'O-211' }, mode: 'approve', slaHours: 48, title: t2('مراجعة شؤون الموظفين', 'Personnel affairs review') }] },
  'MD-02': { id: 'MD-02', name: t2('تغيير الحساب البنكي', 'Change salary account'), steps: [{ agent: { kind: 'pool', unitId: 'O-211' }, mode: 'approve', slaHours: 48, title: t2('تحقق شؤون الموظفين من المستند البنكي', 'Personnel affairs verifies the bank document') }, { agent: { kind: 'pool', unitId: 'O-121' }, mode: 'approve', slaHours: 48, title: t2('تأكيد ثانٍ من الرواتب', 'Second confirmation by payroll') }] },
  'MD-05': { id: 'MD-05', name: t2('تحديث مستند', 'Update a document'), steps: [{ agent: { kind: 'pool', unitId: 'O-211' }, mode: 'approve', slaHours: 48, title: t2('مراجعة المستند الجديد', 'Review of the new document') }] },
  'AS-01': { id: 'AS-01', name: t2('أحتاج شيئاً', 'I need something'), steps: [{ agent: { kind: 'lineManager' }, mode: 'approve', slaHours: 24 }, { agent: { kind: 'positions', positionIds: ['S-1301'], quorum: 'any' }, mode: 'approve', slaHours: 72, title: t2('الصرف من المستودع أو طلب الشراء', 'Stock issue or purchase request') }, { agent: { kind: 'requester' }, mode: 'approve', slaHours: 72, title: t2('استلامك وتوقيع سند التسليم', 'Your receipt and handover signature') }] },
  'FN-01': { id: 'FN-01', name: t2('الانتداب', 'Business trip'), steps: [{ agent: { kind: 'lineManager' }, mode: 'approve', slaHours: 24 }, { agent: { kind: 'pool', unitId: 'O-122' }, mode: 'approve', slaHours: 48, title: t2('حجز الاعتماد وإصدار القرار', 'Budget commitment and decision') }] },
};
const SYSTEM_TITLE: Record<string, T2> = {
  'TM-01': t2('تسجيل الإجازة في النظام المرجعي وإصدار القرار', 'Leave posted and decision issued'), 'TM-01C': t2('حذف الغياب من النظام المرجعي وإعادة الرصيد', 'Absence deleted from the system of record; balance restored'), 'DC-01': t2('توثيق الخطاب برمز تحقق', 'Letter registered with a verification code'), 'MD-01': t2('تحديث البيانات في النظام المرجعي', 'Data updated in the system of record'),
  'MD-02': t2('تحديث حساب الراتب', 'Salary account updated'), 'MD-05': t2('تحديث المستند وتاريخ انتهائه', 'Document and expiry updated'), 'AS-01': t2('الصرف من المستودع وقيد العهدة في النظام المرجعي', 'Store issue and custody posted in the system of record'), 'FN-01': t2('تسجيل الانتداب وصرف المقدم', 'Assignment recorded, advance paid'),
};
const ISSUED: Record<string, T2 | undefined> = {
  'TM-01': { ar: 'قرار إجازة', en: 'Leave decision' },
  'DC-01': { ar: 'خطاب تعريف', en: 'Employment letter' },
  'FN-01': { ar: 'قرار انتداب', en: 'Assignment decision' },
};
export const SERVICE_TITLE: Record<string, T2> = {
  'TM-01': { ar: 'طلب إجازة', en: 'Leave request' }, 'TM-01C': { ar: 'إلغاء إجازة معتمدة', en: 'Leave cancellation' }, 'DC-01': { ar: 'خطاب تعريف', en: 'Employment letter' },
  'MD-01': { ar: 'تحديث بياناتي الشخصية', en: 'Update my personal data' }, 'MD-02': { ar: 'تغيير الحساب البنكي', en: 'Change salary account' },
  'MD-05': { ar: 'تحديث مستند', en: 'Update a document' }, 'AS-01': { ar: 'أحتاج شيئاً', en: 'I need something' }, 'FN-01': { ar: 'الانتداب ومهمة العمل', en: 'Business trip & assignment' },
};
export const SLA_HOURS: Record<Desk, number> = { requester: 72, manager: 24, deptManager: 24, gm: 24, hrGm: 24, hrDeptManager: 24, hrSectionHead: 24, hr: 48, payrollManager: 24, buyer: 72, finance: 48, payroll: 48, system: 0 };
export function slaOf(step: Step): number { return step.slaHours ?? SLA_HOURS[step.desk]; }
export function currentPerson(state: State): Person { return (state.settings.actAs ? personById(state, state.settings.actAs) : undefined) || state.people.find((p) => p.persona === state.settings.persona) || state.people[0]; }
/** v0.15: الطلب على خدمة مهيّأة يحمل اسمها الملتقط لحظة التقديم؛ وسواه من جدول الخدمات المبنية */
export function requestTitle(r: Request): T2 { return r.title || SERVICE_TITLE[r.serviceId] || { ar: r.serviceId, en: r.serviceId }; }
export function routeFor(serviceId: string): Route { return ROUTES[serviceId] || ROUTES['MD-01']; }
export function systemTitleFor(serviceId: string): T2 { return SYSTEM_TITLE[serviceId] || t2('التسجيل في النظام المرجعي', 'Posted to the system of record'); }

function nextId(state: State, prefix: string): [State, string] {
  const seq = state.seq + 1; return [{ ...state, seq }, `${prefix}-${String(seq).padStart(4, '0')}`];
}
function notify(state: State, n: Omit<Notification, 'id' | 'read'>): State {
  const nseq = state.nseq + 1;
  return { ...state, nseq, notifications: [{ ...n, id: `N-${nseq}`, read: false }, ...state.notifications] };
}
function notifyMany(state: State, ids: string[], n: Omit<Notification, 'id' | 'read' | 'to'>): State { let s = state; for (const id of Array.from(new Set(ids))) s = notify(s, { ...n, to: id }); return s; }
/** v0.12 (P-13): رقم القرار الإداري بصيغة مسلسل/سنة */
function docNumber(state: State, at: number): string { const y = new Date(at).getFullYear(); return `${300 + state.seq}/${y}`; }
/** v0.12 (D-027): البنود الجاهزة للتسليم في هذه الدفعة — ما حُجز أو وُفِّر كاملاً، وما قُبل من المورّد ولم يُسلَّم بعد */
export function readyQty(l: NeedLine): number { if (l.status === 'reserved' || l.status === 'provided') return l.qty; if (l.status === 'purchasing' || l.status === 'received') return Math.max(0, (l.received || 0) - (l.handed || 0)); return 0; }
export function readyLines(n: NeedInfo): NeedLine[] { return n.lines.filter((l) => readyQty(l) > 0); }
const first = (s: string) => s.split(' ')[0];

/* ——— v0.9 المقاطع (AS-01): خطوة قرار سابقة تنشّط مقطعاً أو تُطفئه؛ الخطوة التي مقطعها مطفأ تُتخطى بسبب مكتوب ——— */
export function branchActive(r: Request, b: NeedBranch): boolean {
  const n = r.need; if (!n) return true; const p = n.procurement || {};
  const purchasing = n.lines.some((l) => l.status === 'purchasing' || l.status === 'received');
  if (b === 'provided') return !!n.provision;
  if (b === 'stock') return n.lines.some((l) => l.status === 'reserved' || l.status === 'issued');
  if (b === 'purchase') return purchasing;
  /* v0.10: المقاطع الفرعية للشراء تُقرأ من طريقة الشراء التي سجّلها المكتب عند التجهيز (مفاتيح الطريقة تُحفظ في الطلب لحظتها) */
  if (b === 'tender') return purchasing && (p.methodFlags ? p.methodFlags.tender : (p.estimatedValue ?? n.estimatedValue ?? 0) > (n.tenderThreshold ?? Number.POSITIVE_INFINITY));
  if (b === 'quotes') return purchasing && !!p.methodFlags?.offers;
  /* v0.11 (D-024): اعتماد الترسية بالاستثناء — يُفتح عند انحراف فقط، وإلا يُعتمد آلياً */
  if (b === 'award') return purchasing && !p.methodFlags?.contract && ((n.awardRule || 'always') === 'always' || awardDeviations(r).length > 0);
  if (b === 'topUp') { const reserved = p.reservation?.amount ?? 0; const won = p.recommendation?.amount ?? 0; const tol = n.tolerancePct ?? 0; return purchasing && !p.methodFlags?.contract && won > reserved * (1 + tol / 100); }
  return true;
}
/** v0.11 (D-024): الانحرافات التي تستدعي اعتماد الترسية: العرض الموصى به ليس الأدنى، أو عروض أقل من الحد الأدنى، أو شراء مباشر (الشريحة الأعلى)، أو تجاوز نسبة التسامح؛ نتيجة المناقصات قرار لجنة فلا اعتماد ثانياً ما لم تتجاوز التسامح */
export function awardDeviations(r: Request): T2[] {
  const n = r.need; if (!n) return []; const p = n.procurement || {}; const out: T2[] = [];
  const rec = p.recommendation; const list = p.offers?.list || [];
  if (p.offers?.shortfall) out.push(t2(`عروض أقل من الحد الأدنى (${p.offers.count} من ${p.offers.shortfall.min}): ${p.offers.shortfall.why}`, `Fewer offers than the minimum (${p.offers.count} of ${p.offers.shortfall.min}): ${p.offers.shortfall.why}`));
  if (p.methodFlags?.higherBand) out.push(t2(`طريقة الشراء «${p.methodName?.ar || ''}» تستلزم اعتماد الشريحة الأعلى`, `Purchase method “${p.methodName?.en || ''}” requires the higher band`));
  if (rec && rec.amount && list.length) { const lowest = Math.min(...list.map((o) => o.amount)); if (rec.amount > lowest) out.push(t2(`العرض الموصى به (${rec.amount.toLocaleString('en')}) ليس الأدنى (${lowest.toLocaleString('en')})`, `The recommended offer (${rec.amount.toLocaleString('en')}) is not the lowest (${lowest.toLocaleString('en')})`)); }
  /* المقارنة مع التقدير الذي اعتُمد به الشراء (لا مع الحجز بعد زيادته): تجاوزه بأكثر من التسامح انحراف يستدعي اعتماد الترسية ولو زادت الموازنة الحجز */
  const approved = p.estimatedValue ?? 0; const won = rec?.amount ?? 0; const tol = n.tolerancePct ?? 0;
  if (approved && won > approved * (1 + tol / 100)) out.push(t2(`الترسية (${won.toLocaleString('en')}) تجاوزت التقدير المعتمد (${approved.toLocaleString('en')}) بأكثر من ${tol}%`, `The award (${won.toLocaleString('en')}) exceeds the approved estimate (${approved.toLocaleString('en')}) by more than ${tol}%`));
  return out;
}
export function branchWhy(r: Request, b: NeedBranch): T2 {
  const p = r.need?.procurement;
  if (b === 'provided') return t2('لم توفّره الجهة الفنية من رصيدها', 'Not provided from the technical entity pool');
  if (b === 'stock') return t2('لا بند متوفر في المستودع', 'No line available in the store');
  if (b === 'purchase') return t2('كل البنود متوفرة في المستودع؛ لا شراء', 'All lines available in the store; no purchase');
  if (b === 'quotes') return t2(`طريقة الشراء «${p?.methodName?.ar || ''}» لا تحتاج عروضاً`, `Purchase method “${p?.methodName?.en || ''}” needs no offers`);
  if (b === 'award') return p?.methodFlags?.contract ? t2('الشراء من عقد إطاري قائم؛ لا ترسية', 'Purchase from an existing framework contract; no award') : p?.tender?.referred ? t2('رست عليه لجنة المناقصات؛ قرار اللجنة هو الترسية', 'Awarded by the tender committee; the committee decision is the award') : t2('العرض الموصى به هو الأدنى وضمن المحجوز والعروض مكتملة؛ لا انحراف يستدعي اعتماداً', 'The recommended offer is the lowest, within the reservation, and the offers are complete; no deviation needs approval');
  if (b === 'topUp') return t2(`العرض الفائز (${(p?.recommendation?.amount || 0).toLocaleString('en')}) ضمن المبلغ المحجوز (${(p?.reservation?.amount || 0).toLocaleString('en')}) ونسبة التسامح ${r.need?.tolerancePct ?? 0}%`, `Winning offer (${(p?.recommendation?.amount || 0).toLocaleString('en')}) within the reserved amount (${(p?.reservation?.amount || 0).toLocaleString('en')}) and the ${r.need?.tolerancePct ?? 0}% tolerance`);
  return p?.methodFlags ? t2(`طريقة الشراء «${p.methodName?.ar || ''}» ليست مناقصة`, `Purchase method “${p.methodName?.en || ''}” is not a tender`) : t2(`القيمة دون عتبة المناقصات (${(r.need?.tenderThreshold || 0).toLocaleString('en')} ريال)`, `Value below the tender threshold (SAR ${(r.need?.tenderThreshold || 0).toLocaleString('en')})`);
}
export function notifyPeople(state: State, ids: string[], n: Omit<Notification, 'id' | 'read' | 'to'>): State { return notifyMany(state, ids, n); }
export function patchRequest(state: State, id: string, f: (r: Request) => Request): State { return { ...state, requests: state.requests.map((x) => (x.id === id ? f(x) : x)) }; }
export function auditLine(state: State, id: string, who: string, what: T2, at = Date.now()): State { return patchRequest(state, id, (r) => ({ ...r, audit: [...r.audit, { at, who, what }] })); }
/** إنهاء الخطوة الحالية بقرار خاص (خطوات الاحتياج): تُعلَّم منجزة بنتيجتها ومرجعها ثم تُفتح التالية */
export function completeCurrent(state: State, requestId: string, actorId: string, what: T2, at = Date.now(), patch: { outcome?: string; ref?: string; note?: string } = {}): State {
  const r = state.requests.find((x) => x.id === requestId); if (!r) return state;
  const i = r.steps.findIndex((x) => x.status === 'current'); if (i < 0) return state;
  const steps = r.steps.map((x, k) => (k === i ? { ...x, status: 'done' as const, at, actorId, outcome: patch.outcome, ref: patch.ref, note: patch.note } : x));
  const req: Request = { ...r, steps, audit: [...r.audit, { at, who: actorId, what }] };
  const [s2, r2] = advance(state, req, at);
  return { ...s2, requests: s2.requests.map((x) => (x.id === r2.id ? { ...r2, updatedAt: at } : x)) };
}

/** v0.16: تنفيذ خطوة نظام عبر عقد بربط مدخلاته من الطلب */
function runContractStep(state: State, r: Request, st: Step, at: number): { ok: boolean; ref?: string; message: T2 } {
  const svc = serviceOfRequest(state, r); if (!svc || !st.contractId) return { ok: false, message: t2('لا عقد على الخطوة', 'No contract on the step') };
  return runContract(state, st.contractId, contractInputsFor(state, r, svc, st.mapping), at);
}
/* ——— فتح الخطوة التالية ——— */
function advance(state: State, r: Request, at: number): [State, Request] {
  // خطوة «إشعار فقط» تُنجز فوراً بتنبيه أصحابها، وخطوة النظام تُنفَّذ فوراً وتُصدر المستند، وخطوة بشرية تفتح مهمة عند شاغلي مناصبها الآن
  let s = state; let req = r;
  const i = req.steps.findIndex((x) => x.status === 'current');
  /* v0.9: الخطوة التي ينتمي مقطعها إلى نتيجة لم تتحقق تُتخطى بسببها؛ v0.11: التوفير من رصيد الجهة (D-023) يتخطى كل ما بعده إلا تسليمه وخطوة النظام، واعتماد الترسية بالاستثناء (D-024) يُعتمد آلياً بقرار نظام مسبَّب */
  const dzSvc = req.configured ? serviceOfRequest(s, req) : undefined;
  const skipWhy = (x: Step): T2 | null => {
    if (req.need?.provision && x.key !== 'sys' && x.branch !== 'provided') return t2('وُفِّر الاحتياج من رصيد الجهة الفنية؛ لا حاجة إلى هذه الخطوة', 'The need was provided from the technical entity pool; this step is not needed');
    if (x.branch && !branchActive(req, x.branch)) return branchWhy(req, x.branch);
    /* v0.12 (D-027): تسليم دفعة لم يُقبل فيها بند لا يُفتح؛ يُنتظر الاستلام التالي */
    if (x.role === 'handover' && x.branch === 'purchase' && req.need && !readyLines(req.need).length) return t2('لم يُقبل بند في هذه الدفعة؛ لا تسليم حتى الاستلام التالي', 'No line accepted in this batch; no handover until the next receipt');
    /* v0.16 (خريطة الحالات 3.12): الشرط المؤجَّل إلى نتائج الخطوات السابقة يُحسم لحظة الوصول */
    if (x.cond && req.configured && dzSvc && !condHolds(x.cond, req.configured.values, { state: s, person: personById(s, req.requesterId), steps: req.steps, svc: dzSvc })) return t2(`الشرط لم يتحقق: ${condText(s, dzSvc, x.cond, 'ar')}`, `Condition not met: ${condText(s, dzSvc, x.cond, 'en')}`);
    return null;
  };
  /* v0.16 (3.13): اعتماد آلي بقاعدة — لا تخطٍّ بل قرار نظام مسبَّب */
  const autoWhy = (x: Step): T2 | null => (x.auto && req.configured && dzSvc && (x.mode === 'approve' || x.mode === 'review') && condHolds(x.auto, req.configured.values, { state: s, person: personById(s, req.requesterId), steps: req.steps, svc: dzSvc }) ? t2(`تحققت قاعدة الاعتماد الآلي: ${condText(s, dzSvc, x.auto, 'ar')}`, `Automatic approval rule met: ${condText(s, dzSvc, x.auto, 'en')}`) : null);
  let next = req.steps.findIndex((x, k) => k > i && x.status === 'pending');
  for (let why = next !== -1 ? skipWhy(req.steps[next]) || autoWhy(req.steps[next]) : null; next !== -1 && why; why = next !== -1 ? skipWhy(req.steps[next]) || autoWhy(req.steps[next]) : null) {
    const b = req.steps[next];
    const auto = (b.role === 'awardApproval' && !req.need?.provision && !!req.need?.procurement && !req.need.procurement.methodFlags?.contract && branchActive(req, 'purchase')) || (!skipWhy(b) && !!autoWhy(b));
    if (auto && b.role === 'awardApproval') {
      req = { ...req, need: { ...req.need!, procurement: { ...req.need!.procurement, awardAuto: true, awardAutoAt: at, awardWhy: [why] } }, steps: req.steps.map((x, k) => (k === next ? { ...x, status: 'done' as const, at, actorId: 'system', note: why.ar } : x)), audit: [...req.audit, { at, who: 'system', what: { ar: `اعتُمدت الترسية آلياً بقاعدة الاستثناء: ${why.ar}`, en: `Award approved automatically under the exception rule: ${why.en}` } }] };
    } else if (auto) {
      req = { ...req, steps: req.steps.map((x, k) => (k === next ? { ...x, status: 'done' as const, at, actorId: 'system', note: why.ar, outcome: '__auto' } : x)), audit: [...req.audit, { at, who: 'system', what: { ar: `اعتُمدت «${b.title.ar}» آلياً: ${why.ar}`, en: `“${b.title.en}” approved automatically: ${why.en}` } }] };
    } else {
      req = { ...req, steps: req.steps.map((x, k) => (k === next ? { ...x, status: 'skipped' as const, at, note: why.ar } : x)), audit: [...req.audit, { at, who: 'system', what: { ar: `تُخُطِّيت خطوة «${b.title.ar}»: ${why.ar}`, en: `Step “${b.title.en}” skipped: ${why.en}` } }] };
    }
    next = req.steps.findIndex((x, k) => k > next && x.status === 'pending');
  }
  if (next === -1) { return [s, { ...req, status: req.status === 'in_review' ? 'completed' : req.status, updatedAt: at }]; }
  const steps = req.steps.map((x, k) => (k === next ? { ...x, status: 'current' as const, startedAt: at } : x));
  req = { ...req, steps, updatedAt: at };
  const st = steps[next]; const title = requestTitle(req); const requester = personById(s, req.requesterId); const lv = req.leave;
  /* v0.16 (3.6): الانتظار — الخطوة تبقى حالية بموعدها وتُنجزها الدورة الزمنية */
  if (st.mode === 'wait') {
    const field = st.wait?.field ? String(req.configured?.values[st.wait.field] || '').split('|')[0] : ''; const until = field || addDays(toISO(at), st.wait?.days || 1);
    req = { ...req, steps: steps.map((x, k) => (k === next ? { ...x, waitUntil: until } : x)), audit: [...req.audit, { at, who: 'system', what: { ar: `ينتظر الطلب حتى ${until}`, en: `The request waits until ${until}` } }] };
    if (toISO(at) >= until) { req = { ...req, steps: req.steps.map((x, k) => (k === next ? { ...x, status: 'done' as const, at, actorId: 'system' } : x)) }; return advance(s, req, at); }
    s = notify(s, { to: req.requesterId, kind: 'status', at, link: `#/requests/${req.id}`, title: { ar: `${title.ar} ${req.id}: انتظار حتى ${until}`, en: `${title.en} ${req.id}: waiting until ${until}` }, body: { ar: `يكمل الطلب آلياً في موعده.`, en: `The request continues automatically on that date.` } });
    return [s, req];
  }
  /* v0.16 (3.7): خطوة نظام عبر عقد — تُنفَّذ فوراً بمرجع، وإن تعذّر تبقى مفتوحة ويُبلَّغ مدير النظام */
  if (st.mode === 'system' && st.contractId && req.configured && dzSvc) {
    const res = runContractStep(s, req, st, at);
    if (res.ok) { s = { ...s, erpSeq: (s.erpSeq || 0) + 1 }; req = { ...req, steps: steps.map((x, k) => (k === next ? { ...x, status: 'done' as const, at, actorId: 'system', ref: res.ref } : x)), audit: [...req.audit, { at, who: 'system', what: res.message }] }; return advance(s, req, at); }
    req = { ...req, audit: [...req.audit, { at, who: 'system', what: { ar: `توقف عند العقد: ${res.message.ar}`, en: `Stopped at the contract: ${res.message.en}` } }] };
    s = notifyMany(s, s.people.filter((p) => p.persona === 'admin').map((p) => p.id), { kind: 'task', at, link: `#/admin/contracts`, title: { ar: `عقد غير منفَّذ: ${title.ar} ${req.id}`, en: `Contract not executed: ${title.en} ${req.id}` }, body: res.message });
    return [s, req];
  }
  if (st.mode === 'notify' || st.notifyOnly) {
    const who = currentAssignees(s, req, st);
    const nextHuman = req.steps.find((x, k) => k > next && !x.notifyOnly && x.mode !== 'notify' && x.desk !== 'system');
    s = notifyMany(s, who, { kind: 'status', at, link: `#/requests/${req.id}`, title: { ar: `للعلم: ${title.ar} من ${first(requester?.name || '')}`, en: `FYI: ${title.en} from ${first(requester?.nameEn || '')}` }, body: { ar: `${req.id}${lv ? ` · من ${lv.from} إلى ${lv.to}` : ''}${nextHuman ? ` · ${nextHuman.title.ar}` : ''}.`, en: `${req.id}${lv ? ` · ${lv.from} to ${lv.to}` : ''}${nextHuman ? ` · ${nextHuman.title.en}` : ''}.` } });
    const done = steps.map((x, k) => (k === next ? { ...x, status: 'done' as const, at, actorId: 'system', assigneeIds: who } : x));
    req = { ...req, steps: done, audit: [...req.audit, { at, who: 'system', what: { ar: `${st.title.ar} (بلا اعتماد)`, en: `${st.title.en} (no approval needed)` } }] };
    return advance(s, req, at);
  }
  if ((st.desk === 'system' || st.mode === 'system') && st.role === 'pr' && req.need) {
    /* v0.10 (D-022): بعد اعتماد الترسية يُنشئ النظام طلب الشراء في النظام المرجعي آلياً — بالصنف والكمية والسعر والمورّد الفائز ومرجع حجز الاعتماد ورقم الاحتياج — محرَّراً بلا اعتماد ثانٍ؛ الاحتياجات المدمجة في ملف شراء واحد تشترك في طلب الشراء نفسه */
    const p = req.need.procurement || {}; const rec = p.recommendation; const seq = (s.erpSeq || 0) + 1;
    const shared = p.purchaseFile ? s.requests.find((x) => x.id !== req.id && x.need?.procurement?.purchaseFile === p.purchaseFile && !!x.need?.procurement?.prNo)?.need?.procurement?.prNo : undefined;
    /* v0.11 (P-10): المورّد من شركاء الأعمال بمفتاحه؛ والعقد الإطاري من قائمة العقود — أمر تنفيذ يستهلك العقد في النظام المرجعي */
    const contract = p.contractNo ? (s.erp.contracts || []).find((c) => c.id === p.contractNo) : undefined; const contractSupplier = contract ? (s.erp.suppliers || []).find((x) => x.id === contract.supplierId) : undefined;
    const prNo = shared || `${10004600 + seq}`; const award = rec ? { supplier: rec.offer, amount: rec.amount ?? p.estimatedValue ?? 0, at, by: rec.by, supplierId: (p.offers?.list || []).find((o) => o.supplier === rec.offer)?.supplierId || p.tender?.supplierId } : p.contractNo ? { supplier: contractSupplier ? `${contractSupplier.name.ar} — عقد ${p.contractNo}` : `عقد ${p.contractNo}`, amount: p.estimatedValue ?? 0, at, supplierId: contractSupplier?.id } : undefined;
    const releaseOrderNo = contract ? `${4500012800 + seq}` : undefined;
    const need = { ...req.need, procurement: { ...p, prNo, prAt: at, prStatus: 'released' as const, award: award || p.award, releaseOrderNo } };
    const done = steps.map((x, k) => (k === next ? { ...x, status: 'done' as const, at, actorId: 'system', ref: prNo } : x));
    const what = { ar: `أنشأ النظام طلب الشراء ${prNo} في النظام المرجعي${shared ? ' (مشترك مع ملف الشراء)' : ''} محرَّراً: ${req.need.lines.filter((l) => l.status === 'purchasing').map((l) => `${l.name.ar} × ${l.qty}${l.itemId ? ` (${l.itemId})` : ''}`).join('، ')}${award ? ` — المورّد ${award.supplier}${award.supplierId ? ` (${award.supplierId})` : ''} بقيمة ${award.amount.toLocaleString('en')} ريال` : ''}${p.reservation ? ` — يخصم من حجز الاعتماد ${p.reservation.no}` : ''}${contract ? `؛ أمر تنفيذ ${releaseOrderNo} على العقد ${contract.id} (المتبقي بعده ${Math.max(0, contract.target - contract.consumed - (p.estimatedValue ?? 0)).toLocaleString('en')} ريال)` : ''}`, en: `The system created purchase requisition ${prNo} in the system of record${shared ? ' (shared purchase file)' : ''}, released: ${req.need.lines.filter((l) => l.status === 'purchasing').map((l) => `${l.name.en} × ${l.qty}${l.itemId ? ` (${l.itemId})` : ''}`).join(', ')}${award ? ` — supplier ${award.supplier}${award.supplierId ? ` (${award.supplierId})` : ''} at SAR ${award.amount.toLocaleString('en')}` : ''}${p.reservation ? ` — consuming funds reservation ${p.reservation.no}` : ''}${contract ? `; release order ${releaseOrderNo} against contract ${contract.id} (remaining after it SAR ${Math.max(0, contract.target - contract.consumed - (p.estimatedValue ?? 0)).toLocaleString('en')})` : ''}` };
    req = { ...req, need, steps: done, audit: [...req.audit, { at, who: 'system', what }], updatedAt: at };
    s = { ...s, erpSeq: shared ? s.erpSeq : seq, erp: contract ? { ...s.erp, contracts: (s.erp.contracts || []).map((c) => (c.id === contract.id ? { ...c, consumed: c.consumed + (p.estimatedValue ?? 0) } : c)) } : s.erp };
    s = notifyMany(s, Array.from(new Set([req.requesterId, need.beneficiaryId])), { kind: 'status', at, link: `#/requests/${req.id}`, title: { ar: `أُنشئ طلب الشراء ${prNo} في النظام المرجعي`, en: `Purchase requisition ${prNo} created in the system of record` }, body: { ar: `${req.id}${award ? ` · ${award.supplier} · ${award.amount.toLocaleString('en')} ريال` : ''} · الخطوة الآن: أمر الشراء.`, en: `${req.id}${award ? ` · ${award.supplier} · SAR ${award.amount.toLocaleString('en')}` : ''} · now: purchase order.` } });
    return advance(s, req, at);
  }
  if ((st.desk === 'system' || st.mode === 'system') && req.configured && st.key === 'sys') {
    /* v0.16 (خريطة الحالات §4): خطوة النظام الأخيرة للخدمة المهيّأة تطبّق مخرجاتها كلها — المستندات بقوالبها، والسجلات، والعقود، والخدمات التالية، والتقويم — ثم إشعارات الاكتمال */
    const done = steps.map((x, k) => (k === next ? { ...x, status: 'done' as const, at, actorId: 'system' } : x));
    req = { ...req, steps: done, status: 'completed', updatedAt: at };
    s = { ...s, requests: s.requests.map((x) => (x.id === req.id ? req : x)) };
    const [s2, r2] = applyConfiguredOutputs(s, req, at); s = s2; req = r2;
    const issuedDocs = req.docs.filter((d) => d.kind === 'issued');
    const posted: T2 = issuedDocs.length ? { ar: `اكتمل الطلب وصدر ${issuedDocs.map((d) => `${d.title.ar} ${d.number}`).join('، ')}`, en: `Request completed; ${issuedDocs.map((d) => `${d.title.en} ${d.number}`).join(', ')} issued` } : { ar: 'اكتمل الطلب', en: 'Request completed' };
    req = { ...req, audit: [...req.audit, { at, who: 'system', what: posted }] };
    if (!issuedDocs.length) s = notify(s, { to: req.requesterId, kind: 'status', at, link: `#/requests/${req.id}`, title: { ar: `اكتمل ${title.ar}`, en: `${title.en} completed` }, body: { ar: `${title.ar} ${req.id} اكتمل.`, en: `${title.en} ${req.id} is complete.` } });
    s = { ...s, requests: s.requests.map((x) => (x.id === req.id ? req : x)) };
    return advance(s, req, at);
  }
  if (st.desk === 'system' || st.mode === 'system') {
    const issued = ISSUED[req.serviceId];
    let docs = req.docs; let audit = req.audit;
    if (issued) {
      const num = docNumber(s, at);
      docs = [...docs, { id: `D-${req.id}-${docs.length + 1}`, kind: 'issued', title: issued, number: num, at, type: req.serviceId === 'TM-01' ? 'decision' as const : undefined, code: req.serviceId === 'TM-01' ? 'FR-HR-01' : undefined }];
      audit = [...audit, { at, who: 'system', what: { ar: `صدر ${issued.ar} رقم ${num}`, en: `${issued.en} ${num} issued` } }];
    }
    const done = steps.map((x, k) => (k === next ? { ...x, status: 'done' as const, at, actorId: 'system' } : x));
    // الترحيل إلى النظام المرجعي: الإجازة تُسجَّل برمز نوع الغياب المرتبط (نوع المعلومات 2001) لا باسمها
    const lvType = lv ? (s.policy.versions.find((v) => v.number === req.policyVersion) || versionOn(s.policy, toISO(at)))?.content.types.find((t) => t.id === lv.typeId) : undefined;
    if (lv && lv.cancelOf) {
      /* إلغاء إجازة معتمدة (v0.7): يُحذف الغياب من النظام المرجعي بالرمز، ويعود الرصيد، وتُعلَّم الإجازة الأصلية «ملغاة»، ويُبلَّغ الموظف ومديره؛ ثم تُفتح مهام الاسترداد إن وُجدت */
      const code = lvType?.erp ? ` (نوع الغياب ${lvType.erp.subtype}، من ${lv.from} إلى ${lv.to})` : '';
      const codeEn = lvType?.erp ? ` (absence type ${lvType.erp.subtype}, ${lv.from} to ${lv.to})` : '';
      req = { ...req, steps: done, audit: [...audit, { at, who: 'system', what: { ar: `اكتمل الإلغاء وحُذف الغياب من النظام المرجعي${code}؛ أُعيد الرصيد`, en: `Cancellation completed; absence deleted from the system of record${codeEn}; balance restored` } }], status: 'completed', updatedAt: at };
      s = { ...s, absences: (s.absences || []).filter((a) => !(a.personId === req.requesterId && a.typeId === lv.typeId && a.from === lv.from && a.to === lv.to)) };
      const bal = s.balances[req.requesterId];
      if (bal && lv.typeId === 'annual') s = { ...s, balances: { ...s.balances, [req.requesterId]: { ...bal, annual: bal.annual + lv.days } } };
      if (bal && lv.typeId === 'emergency') s = { ...s, balances: { ...s.balances, [req.requesterId]: { ...bal, emergency: bal.emergency + lv.days } } };
      s = { ...s, requests: s.requests.map((x) => (x.id === lv.cancelOf ? { ...x, leave: x.leave ? { ...x.leave, cancelled: true } : x.leave, cancellation: { requestId: req.id, status: 'done' }, updatedAt: at, audit: [...x.audit, { at, who: 'system', what: { ar: `أُلغيت الإجازة بالطلب ${req.id} وحُذف الغياب من النظام المرجعي${code}`, en: `Leave cancelled by ${req.id}; absence deleted from the system of record${codeEn}` } }] } : x)) };
      const tn = lvType ? lvType.name : { ar: 'الإجازة', en: 'Leave' }; const mgr = requester ? lineManagerOf(s, requester) : undefined;
      s = notify(s, { to: req.requesterId, kind: 'document', at, link: `#/requests/${req.id}`, title: { ar: `أُلغيت إجازتك: ${tn.ar}`, en: `Your leave is cancelled: ${tn.en}` }, body: { ar: `${lv.from} → ${lv.to} (${lv.days} ${lv.days <= 10 ? 'أيام' : 'يوماً'}) · حُذف الغياب من النظام المرجعي${lv.typeId === 'annual' || lv.typeId === 'emergency' ? ' وأُعيد رصيدك' : ''}.`, en: `${lv.from} → ${lv.to} (${lv.days} days) · absence deleted from the system of record${lv.typeId === 'annual' || lv.typeId === 'emergency' ? ' and your balance restored' : ''}.` } });
      if (mgr) s = notify(s, { to: mgr.id, kind: 'status', at, link: `#/requests/${req.id}`, title: { ar: `أُلغيت إجازة ${first(requester?.name || '')}: ${tn.ar}`, en: `${first(requester?.nameEn || '')}’s leave cancelled: ${tn.en}` }, body: { ar: `${lv.from} → ${lv.to} · ${lv.cancelReason || ''}`, en: `${lv.from} → ${lv.to} · ${lv.cancelReason || ''}` } });
      return advance(s, req, at);
    }
    const posted: T2 = lv ? { ar: `اكتمل الطلب وسُجِّل الغياب في النظام المرجعي${lvType?.erp ? ` (نوع الغياب ${lvType.erp.subtype}، من ${lv.from} إلى ${lv.to})` : ''}`, en: `Request completed; absence posted to the system of record${lvType?.erp ? ` (absence type ${lvType.erp.subtype}, ${lv.from} to ${lv.to})` : ''}` }
      : { ar: 'اكتمل الطلب وحُدِّث النظام المرجعي', en: 'Request completed; system of record updated' };
    req = { ...req, steps: done, docs, audit: [...audit, { at, who: 'system', what: posted }], status: 'completed', updatedAt: at };
    if (lv) {
      // تسجيل الغياب في النظام المرجعي (سجل الإجازات) والرصيد
      s = { ...s, absences: [...(s.absences || []), { personId: req.requesterId, typeId: lv.typeId, from: lv.from, to: lv.to, days: lv.days }] };
      const bal = s.balances[req.requesterId];
      if (bal && lv.typeId === 'annual') s = { ...s, balances: { ...s.balances, [req.requesterId]: { ...bal, annual: Math.max(0, bal.annual - lv.days) } } };
      if (bal && lv.typeId === 'emergency') s = { ...s, balances: { ...s.balances, [req.requesterId]: { ...bal, emergency: Math.max(0, bal.emergency - lv.days) } } };
      s = tierWarningAfterPosting(s, req, at);
    }
    const docNum = issued ? docs[docs.length - 1]?.number : undefined;
    if (req.need) {
      /* v0.9: اكتمال الاحتياج — البنود كلها سُلِّمت وقُيِّدت؛ السند صدر عند التوقيع */
      const who = Array.from(new Set([req.requesterId, req.need.beneficiaryId]));
      s = notifyMany(s, who, { kind: 'status', at, link: `#/requests/${req.id}`, title: { ar: `اكتمل احتياجك ${req.id}`, en: `Your need ${req.id} is complete` }, body: { ar: `${req.need.lines.filter((l) => l.status === 'delivered').map((l) => `${l.name.ar} × ${l.qty}`).join('، ')} · سُلِّم وقُيِّد في النظام المرجعي.`, en: `${req.need.lines.filter((l) => l.status === 'delivered').map((l) => `${l.name.en} × ${l.qty}`).join(', ')} · delivered and posted in the system of record.` } });
    } else if (lv) {
      // الموظف يعرف أن إجازته اعتُمدت: تنبيه باسمها وتاريخيها ورقم قرارها، لا «صدر مستند» فقط
      const tn = lvType ? lvType.name : { ar: 'الإجازة', en: 'Leave' };
      s = notify(s, { to: req.requesterId, kind: 'document', at, link: `#/requests/${req.id}`, title: { ar: `اعتُمدت إجازتك: ${tn.ar}`, en: `Your leave is approved: ${tn.en}` }, body: { ar: `${lv.from} → ${lv.to} (${lv.days} ${lv.days <= 10 ? 'أيام' : 'يوماً'}) · صدر قرار الإجازة رقم ${docNum || ''} وسُجِّلت في النظام المرجعي.`, en: `${lv.from} → ${lv.to} (${lv.days} days) · leave decision ${docNum || ''} issued and posted to the system of record.` } });
    } else s = notify(s, { to: req.requesterId, kind: issued ? 'document' : 'status', at, link: `#/requests/${req.id}`,
      title: issued ? { ar: `صدر ${issued.ar}`, en: `${issued.en} issued` } : { ar: `اكتمل ${title.ar}`, en: `${title.en} completed` },
      body: issued ? { ar: `${title.ar} ${req.id}: المستند جاهز في طلبك.`, en: `${title.en} ${req.id}: the document is ready in your request.` } : { ar: `${title.ar} ${req.id} حُدِّث في النظام.`, en: `${title.en} ${req.id} is updated in the system.` } });
    // ما بعد الاكتمال: مهام تنفيذ الاستحقاقات (D-014) إن وُجدت
    return advance(s, req, at);
  }
  // خطوة بشرية: تُستخرج مناصبها الآن وتُفتح مهمة عند كل شاغل
  const who = currentAssignees(s, req, st);
  const withWho = steps.map((x, k) => (k === next ? { ...x, assigneeIds: who } : x)); req = { ...req, steps: withWho };
  if (!who.length) {
    // لا شاغل الآن (ولا نائب ولا رئيس): تبقى الخطوة مفتوحة ويُبلَّغ مدير السياسة
    req = { ...req, audit: [...req.audit, { at, who: 'system', what: { ar: `لا شاغل لخطوة «${st.title.ar}» الآن؛ تنتظر تعيين شاغل`, en: `No holder for “${st.title.en}” now; waiting for an appointment` } }] };
    s = notifyMany(s, s.people.filter((p) => p.persona === 'admin').map((p) => p.id), { kind: 'task', at, link: `#/requests/${req.id}`, title: { ar: `خطوة بلا شاغل: ${st.title.ar}`, en: `Step without a holder: ${st.title.en}` }, body: { ar: `${title.ar} ${req.id} متوقف حتى يُعيَّن شاغل للمنصب.`, en: `${title.en} ${req.id} is waiting for a position holder.` } });
    return [s, req];
  }
  const isFulfil = st.mode === 'fulfil'; const isInput = st.mode === 'input';
  s = notifyMany(s, who, { kind: 'task', at, link: isInput ? `#/requests/${req.id}` : '#/inbox', title: { ar: `${isInput ? 'يحتاج استكمالك' : isFulfil ? 'تنفيذ' : st.mode === 'review' ? 'توصية' : 'مهمة'}: ${title.ar}`, en: `${isInput ? 'Needs your completion' : isFulfil ? 'Fulfil' : st.mode === 'review' ? 'Recommendation' : 'Task'}: ${title.en}` }, body: { ar: `${isInput ? '' : `${requester?.name || ''} · `}${req.id} · ${st.title.ar}${st.quorum === 'all' ? (st.majority ? ' (بالأغلبية)' : ' (يلزم اعتماد الكل)') : who.length > 1 ? ' (يكفي أحدكم)' : ''}.`, en: `${isInput ? '' : `${requester?.nameEn || ''} · `}${req.id} · ${st.title.en}${st.quorum === 'all' ? (st.majority ? ' (by majority)' : ' (all must approve)') : who.length > 1 ? ' (any one of you)' : ''}.` } });
  /* v0.16 (3.5): المجموعة المتوازية — الخطوات المتتالية بالمجموعة نفسها تُفتح معاً، ولا يُفتح ما بعدها حتى تُنجز كلها */
  if (st.group) {
    let k = next + 1;
    while (k < req.steps.length && req.steps[k].status === 'pending' && req.steps[k].group === st.group) {
      const sib = req.steps[k]; const why = skipWhy(sib);
      if (why) { req = { ...req, steps: req.steps.map((x, j) => (j === k ? { ...x, status: 'skipped' as const, at, note: why.ar } : x)), audit: [...req.audit, { at, who: 'system', what: { ar: `تُخُطِّيت خطوة «${sib.title.ar}»: ${why.ar}`, en: `Step “${sib.title.en}” skipped: ${why.en}` } }] }; k++; continue; }
      const sw = currentAssignees(s, req, sib);
      req = { ...req, steps: req.steps.map((x, j) => (j === k ? { ...x, status: 'current' as const, startedAt: at, assigneeIds: sw } : x)) };
      if (sw.length) s = notifyMany(s, sw, { kind: 'task', at, link: '#/inbox', title: { ar: `${sib.mode === 'fulfil' ? 'تنفيذ' : 'مهمة'}: ${title.ar}`, en: `${sib.mode === 'fulfil' ? 'Fulfil' : 'Task'}: ${title.en}` }, body: { ar: `${requester?.name || ''} · ${req.id} · ${sib.title.ar} (بالتوازي).`, en: `${requester?.nameEn || ''} · ${req.id} · ${sib.title.en} (in parallel).` } });
      else { req = { ...req, audit: [...req.audit, { at, who: 'system', what: { ar: `لا شاغل لخطوة «${sib.title.ar}» الآن؛ تنتظر تعيين شاغل`, en: `No holder for “${sib.title.en}” now; waiting for an appointment` } }] }; }
      k++;
    }
  }
  return [s, req];
}

export interface CreateInput { serviceId: string; requesterId: string; fields: Field[]; attachment?: string; at?: number; steps?: Step[]; notApplied?: { title: T2; why: T2 }[]; leave?: LeaveInfo; policyVersion?: string; need?: NeedInfo; title?: T2; tenant?: string; configured?: Request['configured'] }
export function createRequest(state: State, input: CreateInput): [State, Request] {
  const at = input.at ?? Date.now();
  const [s1, id] = nextId(state, 'REQ-2026');
  const requester = personById(state, input.requesterId)!;
  const built = input.steps ? { steps: input.steps.map((x) => ({ ...x, status: 'pending' as const })), notApplied: input.notApplied || [] } : buildSteps(state, requester, routeFor(input.serviceId), { days: 0, workingDays: 0 }, systemTitleFor(input.serviceId));
  const steps: Step[] = [
    { key: 'submit', desk: 'requester', title: { ar: 'تقديم الطلب', en: 'Request submitted' }, status: 'done', at, actorId: input.requesterId, mode: 'receipt' },
    ...built.steps,
  ];
  let req: Request = {
    id, serviceId: input.serviceId, requesterId: input.requesterId, createdAt: at, updatedAt: at, status: 'in_review', steps, fields: input.fields, channel: 'app',
    docs: input.attachment ? [{ id: `D-${id}-0`, kind: 'attachment', title: { ar: input.attachment, en: input.attachment }, at }] : [],
    audit: [{ at, who: input.requesterId, what: input.policyVersion ? { ar: `قُدّم الطلب من التطبيق وقُيّم بالإصدار ${input.policyVersion} من السياسة`, en: `Submitted from the app; evaluated under policy version ${input.policyVersion}` } : { ar: 'قُدّم الطلب من التطبيق', en: 'Submitted from the app' } }],
    policyVersion: input.policyVersion, leave: input.leave, notApplied: built.notApplied, need: input.need,
    title: input.title, tenant: input.tenant ?? state.tenant?.id, configured: input.configured,
  };
  for (const na of built.notApplied) req = { ...req, audit: [...req.audit, { at, who: 'system', what: { ar: `لم تُطبَّق خطوة «${na.title.ar}»: ${na.why.ar}`, en: `Step “${na.title.en}” not applied: ${na.why.en}` } }] };
  let s = s1;
  const title = requestTitle(req);
  const firstHuman = req.steps.find((x, k) => k > 0 && !x.notifyOnly && x.mode !== 'notify' && x.desk !== 'system');
  s = notify(s, { to: req.requesterId, kind: 'status', at, link: `#/requests/${req.id}`, title: { ar: `استلمنا ${title.ar}`, en: `${title.en} received` }, body: { ar: `رقم طلبك ${req.id}. ${firstHuman ? `الخطوة الآن: ${firstHuman.title.ar}.` : 'يُنفَّذ الآن.'}`, en: `Your request number is ${req.id}. ${firstHuman ? `Now: ${firstHuman.title.en}.` : 'Being executed now.'}` } });
  const [s2, r2] = advance(s, { ...req, steps: req.steps.map((x, k) => (k === 0 ? { ...x, status: 'current' as const } : x)) }, at);
  s = s2; req = { ...r2, steps: r2.steps.map((x, k) => (k === 0 ? { ...x, status: 'done' as const, at, actorId: input.requesterId } : x)) };
  return [{ ...s, requests: [req, ...s.requests] }, req];
}

export type Action = 'approve' | 'return' | 'reject' | 'receive' | 'done';
/** v0.8 (D-015) إقفال الفترة يقفل الاعتماد أيضاً: طلب إجازة أو إلغاء جارٍ بتاريخ داخل الفترة المقفلة لا يُعتمد حتى تُفتح — «مقفل يعني مقفل» */
export function approvalLocked(state: State, r: Request): PeriodClose | null {
  const pc = state.policy.periodClose; if (!pc || !r.leave || r.status !== 'in_review') return null;
  return periodClosed(pc, r.leave.from) ? pc : null;
}
/** الطلبات الجارية داخل فترة (لشاشة الإقفال): بأسمائها لا بأرقامها فقط */
export function inflightInPeriod(state: State, until: string): Request[] { return until ? state.requests.filter((r) => r.status === 'in_review' && !!r.leave && periodClosed({ until, reason: '', reference: '', by: '', at: 0 }, r.leave.from)) : []; }
/** عدد الطلبات التي قُدِّمت بنوع إجازة (لسجل النوع في مركز السياسات) */
export function requestsOfType(state: State, typeId: string): Request[] { return state.requests.filter((r) => r.leave?.typeId === typeId && !r.leave.cancelOf && r.status !== 'withdrawn'); }

/** v0.16: ما يحمله القرار من نموذج الخطوة (خريطة الحالات §3-ب): خيار القرار، وقيم حقول الخطوة، وتعديلات على حقول الطلب، وقائمة التحقق، والحقول المطلوب تصحيحها عند الإعادة */
export interface DecideExtra { outcome?: string; values?: Record<string, string | string[] | boolean>; edits?: { field: string; label: T2; before: string; after: string; value: string | string[] | boolean }[]; checks?: string[]; returnFields?: string[] }
export function decide(state: State, requestId: string, action: Action, actorId: string, note?: string, at = Date.now(), ref?: string, extra: DecideExtra = {}): State {
  const r = state.requests.find((x) => x.id === requestId); if (!r) return state;
  /* v0.16 (3.5): قد تكون أكثر من خطوة حالية (مجموعة متوازية)؛ تُختار التي هذا الشخص من شاغليها */
  const currents = r.steps.map((x, k) => ({ x, k })).filter(({ x }) => x.status === 'current');
  const mineIdx = currents.find(({ x }) => currentAssignees(state, r, x).includes(actorId) || (x.mode === 'receipt' && (actorId === r.requesterId || (x.role === 'handoverSign' && actorId === r.need?.beneficiaryId))))?.k;
  const i = mineIdx ?? (currents[0]?.k ?? -1); if (i < 0) return state;
  const cur = r.steps[i]; const allowed = currentAssignees(state, r, cur);
  if (!allowed.includes(actorId) && !(cur.mode === 'receipt' && (actorId === r.requesterId || (cur.role === 'handoverSign' && actorId === r.need?.beneficiaryId)))) return state;
  /* v0.16 (3-ب.1): خيار القرار يحدد الأثر؛ و(3.16) القرارات المسموحة في الخطوة */
  const outcome = extra.outcome ? stepOutcomes(cur).find((o) => o.id === extra.outcome) : undefined;
  const effect: Action = outcome ? (outcome.effect === 'reject' ? 'reject' : outcome.effect === 'return' ? 'return' : action === 'done' || action === 'receive' ? action : 'approve') : action;
  if (r.configured && (effect === 'approve' || effect === 'return' || effect === 'reject') && cur.mode !== 'receipt' && !allowedDecisions(cur).includes(effect) && !outcome) return state;
  if (effect === 'approve' && cur.mode !== 'fulfil' && approvalLocked(state, r)) return state;
  const actor = personById(state, actorId); const title = requestTitle(r);
  const actorPos = positionOf(state, actor!); const onBehalf = cur.positionIds && actorPos && !cur.positionIds.includes(actorPos.id) ? positionById(state, cur.positionIds[0]) : undefined;
  const who: T2 = onBehalf ? { ar: `${actor?.name || ''} نيابةً عن ${onBehalf.title.ar}`, en: `${actor?.nameEn || ''} on behalf of ${onBehalf.title.en}` } : { ar: actor?.name || '', en: actor?.nameEn || '' };
  let s = state; let req = r;
  /* v0.16 (3-ب.3): تعديلات صاحب الخطوة على حقول الطلب تُطبَّق بسجل قبل/بعد */
  const edits = (extra.edits || []).filter((e) => e.before !== e.after);
  if (edits.length && req.configured) {
    const values = { ...req.configured.values }; for (const e of edits) values[e.field] = e.value;
    const fields = req.fields.map((f) => { const e = edits.find((x) => x.field === f.key); return e ? { ...f, value: e.after, valueEn: e.after } : f; });
    req = { ...req, configured: { ...req.configured, values }, fields, audit: [...req.audit, ...edits.map((e) => ({ at, who: actorId, what: { ar: `عدّل «${e.label.ar}»: ${e.before || '—'} ← ${e.after || '—'}`, en: `Changed “${e.label.en}”: ${e.before || '—'} → ${e.after || '—'}` } }))] };
  }
  const stamp = { values: extra.values, checks: extra.checks, edits: edits.length ? edits.map(({ field, label, before, after }) => ({ field, label, before, after })) : undefined, outcome: outcome?.id };
  const outcomeTxt = outcome ? { ar: ` («${outcome.name.ar}»)`, en: ` (“${outcome.name.en}”)` } : { ar: '', en: '' };
  if (effect === 'approve' || effect === 'receive' || effect === 'done') {
    const decisions = [...(cur.decisions || []), { actorId, action: effect === 'done' ? 'done' as const : 'approve' as const, at, note, ref, outcome: outcome?.id }];
    /* v0.16 (3.4): الأغلبية نصاباً ثالثاً */
    const needAll = cur.quorum === 'all' || cur.quorum === 'majority';
    const complete = !needAll || (cur.majority || cur.quorum === 'majority' ? decisions.length > allowed.length / 2 : allowed.every((id) => decisions.some((d) => d.actorId === id)));
    const what: T2 = effect === 'receive' ? { ar: 'أكّد الاستلام ووقّع السند', en: 'Confirmed receipt and signed the note' } : effect === 'done' ? { ar: `${cur.mode === 'review' ? 'أوصى' : cur.mode === 'input' ? 'استكمل الطلب' : 'نُفِّذ'}: ${cur.title.ar}${outcomeTxt.ar}${ref ? ` · المرجع ${ref}` : ''}`, en: `${cur.mode === 'review' ? 'Recommended' : cur.mode === 'input' ? 'Completed the request' : 'Fulfilled'}: ${cur.title.en}${outcomeTxt.en}${ref ? ` · ref ${ref}` : ''}` } : { ar: `اعتُمد: ${cur.title.ar}${outcomeTxt.ar} — ${who.ar}${cur.quorum === 'all' && !complete ? ` (${decisions.length} من ${allowed.length})` : ''}`, en: `Approved: ${cur.title.en}${outcomeTxt.en} — ${who.en}${cur.quorum === 'all' && !complete ? ` (${decisions.length} of ${allowed.length})` : ''}` };
    const steps = req.steps.map((x, k) => (k === i ? (complete ? { ...x, status: 'done' as const, at, actorId, note, decisions, ref, ...stamp } : { ...x, decisions }) : x));
    req = { ...req, steps, audit: [...req.audit, { at, who: actorId, what }] };
    if (!complete) return { ...s, requests: s.requests.map((x) => (x.id === req.id ? { ...req, updatedAt: at } : x)) };
    // نصاب «أي واحد»: إبلاغ الباقين بأن الخطوة أُغلقت
    const others = allowed.filter((id) => id !== actorId);
    if (others.length && cur.quorum !== 'all') s = notifyMany(s, others, { kind: 'status', at, link: `#/requests/${req.id}`, title: { ar: `أُغلقت مهمة ${title.ar} ${req.id}`, en: `Task ${title.en} ${req.id} closed` }, body: { ar: `قررها ${actor?.name || ''}؛ سُحبت من صندوقك.`, en: `Decided by ${actor?.nameEn || ''}; removed from your inbox.` } });
    if (effect === 'done' && cur.mode !== 'input') s = notify(s, { to: req.requesterId, kind: 'status', at, link: `#/requests/${req.id}`, title: { ar: `${cur.mode === 'review' ? 'صدرت توصية' : 'نُفِّذ'}: ${cur.title.ar}`, en: `${cur.mode === 'review' ? 'Recommendation given' : 'Fulfilled'}: ${cur.title.en}` }, body: { ar: `${title.ar} ${req.id}${outcomeTxt.ar}${ref ? ` · المرجع ${ref}` : ''}${note ? ` · ${note}` : ''}.`, en: `${title.en} ${req.id}${outcomeTxt.en}${ref ? ` · ref ${ref}` : ''}${note ? ` · ${note}` : ''}.` } });
    /* v0.16: مستندات تصدر عند هذه الخطوة، وإشعاراتها المهيّأة */
    s = { ...s, requests: s.requests.map((x) => (x.id === req.id ? req : x)) };
    [s, req] = afterStepDone(s, req, req.steps[i], at);
    /* v0.16 (3.5): في المجموعة المتوازية لا يُفتح ما بعدها حتى تُنجز كل خطواتها */
    if (cur.group && req.steps.some((x, k) => k !== i && x.group === cur.group && x.status === 'current')) return { ...s, requests: s.requests.map((x) => (x.id === req.id ? { ...req, updatedAt: at } : x)) };
    [s, req] = advance(s, req, at);
    /* v0.6.4: الموظف يعرف أن طلبه اعتُمد في خطوة: من اعتمد، وما الخطوة التالية، وكم بقي */
    if (req.status === 'in_review' && effect === 'approve') { const nxt = req.steps.find((x) => x.status === 'current'); const left = req.steps.filter((x) => x.status === 'pending' || x.status === 'current').filter((x) => x.mode !== 'notify' && x.desk !== 'system').length; s = notify(s, { to: req.requesterId, kind: 'status', at, link: `#/requests/${req.id}`, title: { ar: `اعتُمد ${title.ar} ${req.id}: ${cur.title.ar}${outcomeTxt.ar}`, en: `${title.en} ${req.id} approved: ${cur.title.en}${outcomeTxt.en}` }, body: { ar: `اعتمده ${who.ar}. الخطوة الآن: ${nxt?.title.ar || ''}${left > 1 ? ` (بقيت ${left} خطوات)` : left === 1 ? ' (الخطوة الأخيرة)' : ''}.`, en: `Approved by ${who.en}. Now: ${nxt?.title.en || ''}${left > 1 ? ` (${left} steps left)` : left === 1 ? ' (last step)' : ''}.` } }); }
  } else if (effect === 'return') {
    const steps = req.steps.map((x, k) => (k === i ? { ...x, status: 'returned' as const, at, actorId, note, ...stamp, returnFields: extra.returnFields } : x.status === 'current' ? { ...x, status: 'pending' as const, startedAt: undefined, decisions: [] } : x));
    const which = extra.returnFields?.length ? extra.returnFields.map((f) => req.fields.find((x) => x.key === f)?.label).filter((x): x is T2 => !!x) : [];
    req = { ...req, steps, status: 'returned', updatedAt: at, audit: [...req.audit, { at, who: actorId, what: { ar: `أُعيد للاستكمال${outcomeTxt.ar}: ${note || ''}${which.length ? ` — المطلوب تصحيحه: ${which.map((x) => x.ar).join('، ')}` : ''}`, en: `Returned for completion${outcomeTxt.en}: ${note || ''}${which.length ? ` — to fix: ${which.map((x) => x.en).join(', ')}` : ''}` } }] };
    s = notify(s, { to: req.requesterId, kind: 'status', at, link: `#/requests/${req.id}`, title: { ar: `أُعيد إليك ${title.ar}`, en: `${title.en} returned to you` }, body: { ar: `${note || ''}${which.length ? ` · صحّح: ${which.map((x) => x.ar).join('، ')}` : ''}`, en: `${note || ''}${which.length ? ` · fix: ${which.map((x) => x.en).join(', ')}` : ''}` } });
    s = { ...s, requests: s.requests.map((x) => (x.id === req.id ? req : x)) }; s = applyNotifyRules(s, req, 'returned', at); req = s.requests.find((x) => x.id === req.id) || req;
  } else if (effect === 'reject') {
    const steps = req.steps.map((x, k) => (k === i ? { ...x, status: 'rejected' as const, at, actorId, note, ...stamp } : k > i || x.status === 'current' ? { ...x, status: 'skipped' as const } : x));
    req = { ...req, steps, status: 'rejected', updatedAt: at, audit: [...req.audit, { at, who: actorId, what: { ar: `رُفض${outcomeTxt.ar}: ${note || ''}`, en: `Rejected${outcomeTxt.en}: ${note || ''}` } }] };
    if (req.leave?.cancelOf) s = { ...s, requests: s.requests.map((x) => (x.id === req.leave!.cancelOf ? { ...x, cancellation: { requestId: req.id, status: 'rejected' }, audit: [...x.audit, { at, who: actorId, what: { ar: `رُفض طلب الإلغاء ${req.id}: ${note || ''}؛ الإجازة قائمة`, en: `Cancellation ${req.id} rejected: ${note || ''}; the leave stands` } }] } : x)) };
    s = notify(s, { to: req.requesterId, kind: 'status', at, link: `#/requests/${req.id}`, title: { ar: `رُفض ${title.ar}`, en: `${title.en} rejected` }, body: { ar: note || '', en: note || '' } });
    if (cur.quorum === 'all') s = notifyMany(s, allowed.filter((id) => id !== actorId), { kind: 'status', at, link: `#/requests/${req.id}`, title: { ar: `أُغلقت مهمة ${title.ar} ${req.id}`, en: `Task ${title.en} ${req.id} closed` }, body: { ar: `رفضها ${actor?.name || ''}.`, en: `Rejected by ${actor?.nameEn || ''}.` } });
    s = { ...s, requests: s.requests.map((x) => (x.id === req.id ? req : x)) }; s = applyNotifyRules(s, req, 'rejected', at); req = s.requests.find((x) => x.id === req.id) || req;
  }
  return { ...s, requests: s.requests.map((x) => (x.id === req.id ? { ...req, updatedAt: at } : x)) };
}

/** إعادة الإرسال بعد الإعادة: تعود إلى المكتب نفسه، لا إلى البداية */
export function resubmit(state: State, requestId: string, fields: Field[], at = Date.now(), values?: Record<string, string | string[] | boolean>): State {
  const r = state.requests.find((x) => x.id === requestId); if (!r || r.status !== 'returned') return state;
  const i = r.steps.findIndex((x) => x.status === 'returned');
  const steps = r.steps.map((x, k) => (k === i ? { ...x, status: 'current' as const, startedAt: at, at: undefined, note: undefined, decisions: [], returnFields: undefined, values: undefined, outcome: undefined } : x));
  /* v0.16: الطلب المهيّأ يعود بقيمه الجديدة (صورة محدَّثة) */
  const configured = r.configured && values ? { ...r.configured, values: { ...r.configured.values, ...values } } : r.configured;
  const req: Request = { ...r, steps, fields, configured, status: 'in_review', updatedAt: at, audit: [...r.audit, { at, who: r.requesterId, what: { ar: 'استُكمل الطلب وأُعيد إرساله إلى المكتب نفسه', en: 'Completed and resubmitted to the same desk' } }] };
  let s = state; const who = currentAssignees(s, req, steps[i]); const title = requestTitle(req); const requester = personById(s, req.requesterId);
  s = notifyMany(s, who, { kind: 'task', at, link: '#/inbox', title: { ar: `عاد إليك: ${title.ar}`, en: `Back to you: ${title.en}` }, body: { ar: `${requester?.name || ''} استكمل ${req.id}.`, en: `${requester?.nameEn || ''} completed ${req.id}.` } });
  return { ...s, requests: s.requests.map((x) => (x.id === req.id ? req : x)) };
}

export function withdraw(state: State, requestId: string, at = Date.now()): State {
  const r = state.requests.find((x) => x.id === requestId); if (!r) return state;
  const decided = r.need ? r.steps.some((x) => (x.status === 'done' && x.role && ['store', 'procurement', 'evaluator', 'budget', 'tender', 'po', 'receipt', 'handover', 'handoverSign'].includes(x.role)) || (x.status === 'current' && x.role && ['procurement', 'evaluator', 'budget', 'tender', 'po', 'receipt', 'handover', 'handoverSign'].includes(x.role))) : r.steps.some((x) => x.status === 'done' && x.desk !== 'requester');
  if (decided || r.status !== 'in_review') return state;
  const steps = r.steps.map((x) => (x.status === 'current' || x.status === 'pending' ? { ...x, status: 'skipped' as const } : x));
  const req: Request = { ...r, steps, status: 'withdrawn', updatedAt: at, audit: [...r.audit, { at, who: r.requesterId, what: { ar: 'سُحب الطلب قبل أي قرار', en: 'Withdrawn before any decision' } }] };
  const requests = state.requests.map((x) => (x.id === req.id ? req : req.leave?.cancelOf && x.id === req.leave.cancelOf ? { ...x, cancellation: { requestId: req.id, status: 'withdrawn' as const }, audit: [...x.audit, { at, who: r.requesterId, what: { ar: `سُحب طلب الإلغاء ${req.id}؛ الإجازة قائمة`, en: `Cancellation ${req.id} withdrawn; the leave stands` } }] } : x));
  return { ...state, requests };
}

/** المهام المنتظرة لشخص: كل خطوة حالية هو من شاغليها الآن ولم يقررها بعد (بما فيها مهام التنفيذ بعد اكتمال الطلب) */
export interface TaskView { request: Request; step: Step; dueAt: number; overdue: boolean }
export function tasksFor(state: State, person: Person, now = Date.now()): TaskView[] {
  const out: TaskView[] = [];
  for (const r of state.requests) {
    if (r.status !== 'in_review' && r.status !== 'completed') continue;
    /* v0.16 (3.5): أكثر من خطوة حالية في المجموعة المتوازية */
    for (const step of r.steps.filter((x) => x.status === 'current')) {
      if (r.status === 'completed' && step.mode !== 'fulfil') continue;
      if (step.mode === 'wait' || (step.mode === 'system' && step.desk === 'system')) continue;
      const mine = currentAssignees(state, r, step).includes(person.id) && !(step.decisions || []).some((d) => d.actorId === person.id);
      if (!mine) continue;
      /* v0.9: خطوة بمهلة صفر (تنفيذ يعتمد على المورد أو المستودع) لا تتأخر ولا تُرتَّب قبل غيرها */
      const sla = slaOf(step); const dueAt = (step.startedAt || r.createdAt) + (sla || 24 * 365) * 3600000;
      out.push({ request: r, step, dueAt, overdue: sla > 0 && now > dueAt });
    }
  }
  return out.sort((a, b) => a.dueAt - b.dueAt);
}
export function doneTasksFor(state: State, person: Person): { request: Request; step: Step }[] {
  const out: { request: Request; step: Step }[] = [];
  for (const r of state.requests) for (const st of r.steps) if (st.desk !== 'requester' && (st.actorId === person.id || (st.decisions || []).some((d) => d.actorId === person.id)) && (st.status === 'done' || st.status === 'returned' || st.status === 'rejected' || (st.status === 'current' && (st.decisions || []).some((d) => d.actorId === person.id)))) out.push({ request: r, step: st });
  return out.sort((a, b) => (b.step.at || 0) - (a.step.at || 0));
}
export function notificationsFor(state: State, person: Person): Notification[] {
  const prefs = state.settings.notifPrefs;
  return state.notifications.filter((n) => n.to === person.id && prefs[n.kind as NotifKind] !== false);
}
export function expiryNotification(state: State, to: string, title: T2, days: number, at: number, link: string): State {
  return notify(state, { to, kind: 'expiry', at, link, title: { ar: `انتهاء ${title.ar} خلال ${daysText(days, 'ar')}`, en: `${title.en} expires in ${daysText(days, 'en')}` }, body: { ar: 'جدّده من «ملفي» قبل انتهائه.', en: 'Renew it from Me before it expires.' } });
}

/* ——— المهل والتصعيد (CAP-01 §2): تذكير عند نسبة من المهلة، وبعد انقضائها إبلاغ رئيس المعتمد أو النقل إلى منصب؛ لا اعتماد آلي ——— */
export function slaTick(state: State, now = Date.now()): State {
  let s = state; let changed = false;
  for (const r of s.requests) {
    if (r.status !== 'in_review' && r.status !== 'completed') continue;
    /* v0.16 (3.5): كل الخطوات الحالية (المجموعة المتوازية) */
    for (const i of r.steps.map((x, k) => (x.status === 'current' ? k : -1)).filter((k) => k >= 0)) {
    const r0 = s.requests.find((x) => x.id === r.id) || r; const st = r0.steps[i]; const sla = slaOf(st); if (!sla || !st.startedAt) continue;
    /* v0.8.1: خطوة اعتماد مقفلة بإقفال الفترة لا تُذكَّر ولا تُصعَّد — المعتمد لا يملك الاعتماد حتى تُفتح الفترة؛ يعود العدّ عند الفتح */
    if (st.mode !== 'fulfil' && st.desk !== 'requester' && approvalLocked(s, r0)) continue;
    const esc = st.escalation || { remindAtPct: 80, after: 'remind' as const };
    const remindAt = st.startedAt + sla * 3600000 * (esc.remindAtPct / 100); const due = st.startedAt + sla * 3600000;
    const who = currentAssignees(s, r0, st); const title = requestTitle(r0); let step = st; let req = r0;
    if (now >= remindAt && !st.remindedAt && now < due) {
      s = notifyMany(s, who, { kind: 'reminder', at: now, link: '#/inbox', title: { ar: `تذكير: ${title.ar} ${r0.id} ينتظر قرارك`, en: `Reminder: ${title.en} ${r0.id} awaits your decision` }, body: { ar: `بقي ${Math.max(1, Math.round((due - now) / 3600000))} ساعة على المهلة (${st.title.ar}).`, en: `${Math.max(1, Math.round((due - now) / 3600000))} h left on the SLA (${st.title.en}).` } });
      step = { ...step, remindedAt: now }; changed = true;
    }
    if (now >= due && !st.escalatedAt) {
      const hours = Math.round((now - due) / 3600000);
      if (esc.after === 'moveTo' && esc.moveToPositionId) {
        const h = resolveHolder(s, esc.moveToPositionId, r0.requesterId);
        if (h.personId) { step = { ...step, positionIds: [h.positionId], assigneeIds: [h.personId], agent: { kind: 'positions', positionIds: [esc.moveToPositionId], quorum: 'any' }, why: { ar: `نُقلت بعد انقضاء المهلة إلى ${positionById(s, esc.moveToPositionId)?.title.ar || ''}`, en: `Moved after the SLA to ${positionById(s, esc.moveToPositionId)?.title.en || ''}` } }; s = notify(s, { to: h.personId, kind: 'task', at: now, link: '#/inbox', title: { ar: `نُقلت إليك مهمة متأخرة: ${title.ar}`, en: `An overdue task moved to you: ${title.en}` }, body: { ar: `${r0.id} · ${st.title.ar} · تأخرت ${hours} ساعة.`, en: `${r0.id} · ${st.title.en} · ${hours} h overdue.` } }); req = { ...req, audit: [...req.audit, { at: now, who: 'system', what: { ar: `نُقلت الخطوة بعد انقضاء المهلة إلى ${positionById(s, esc.moveToPositionId)?.title.ar || ''}`, en: `Step moved after the SLA to ${positionById(s, esc.moveToPositionId)?.title.en || ''}` } }] }; }
      } else if (esc.after === 'notifyManager') {
        const mgrs = who.map((id) => { const p = personById(s, id); return p ? lineManagerOf(s, p)?.id : undefined; }).filter((x): x is string => !!x);
        s = notifyMany(s, mgrs, { kind: 'reminder', at: now, link: `#/requests/${r0.id}`, title: { ar: `تأخر ${title.ar} ${r0.id} عند فريقك`, en: `${title.en} ${r0.id} is overdue with your team` }, body: { ar: `${st.title.ar} تجاوزت مهلتها بـ${hours} ساعة.`, en: `${st.title.en} passed its SLA by ${hours} h.` } });
        s = notifyMany(s, who, { kind: 'reminder', at: now, link: '#/inbox', title: { ar: `تأخر: ${title.ar} ${r0.id}`, en: `Overdue: ${title.en} ${r0.id}` }, body: { ar: `تجاوزت المهلة بـ${hours} ساعة، وأُبلغ رئيسك.`, en: `${hours} h past the SLA; your manager was notified.` } });
        req = { ...req, audit: [...req.audit, { at: now, who: 'system', what: { ar: `انقضت مهلة «${st.title.ar}»؛ أُبلغ رئيس المعتمد`, en: `SLA of “${st.title.en}” passed; the approver's manager was notified` } }] };
      } else {
        s = notifyMany(s, who, { kind: 'reminder', at: now, link: '#/inbox', title: { ar: `تأخر: ${title.ar} ${r0.id}`, en: `Overdue: ${title.en} ${r0.id}` }, body: { ar: `تجاوزت المهلة بـ${hours} ساعة.`, en: `${hours} h past the SLA.` } });
      }
      step = { ...step, escalatedAt: now }; changed = true;
    }
    if (step !== st || req !== r0) s = { ...s, requests: s.requests.map((x) => (x.id === r0.id ? { ...req, steps: req.steps.map((y, k) => (k === i ? step : y)) } : x)) };
    }
  }
  return changed ? s : state;
}

/* ——— الإنذار المبكر قبل نهاية الشريحة (ق-06): عند تسجيل إجازة من نوع بأجر متدرج ——— */
function tierWarningAfterPosting(state: State, req: Request, at: number): State {
  const lv = req.leave; if (!lv) return state;
  const person = personById(state, req.requesterId); if (!person) return state;
  const version = state.policy.versions.find((v) => v.number === req.policyVersion) || versionOn(state.policy, toISO(at)); if (!version) return state;
  const type = version.content.types.find((t) => t.id === lv.typeId); if (!type || !type.cycle) return state;
  const ev = evaluateLeave({ content: version.content, person, type, from: '', to: '', today: toISO(at), absences: state.absences, ops: state.policy });
  if (!ev.sick) return state;
  const cs = cycleStatus(ev.sick, version.content.warnings); if (!cs.near || cs.total === null) return state;
  const beyond = cs.nextPay === 0 ? { ar: 'بلا أجر', en: 'unpaid' } : { ar: `بأجر ${cs.nextPay}%`, en: `at ${cs.nextPay}% pay` };
  const tierName = cs.curPay === 100 ? { ar: 'بأجر كامل', en: 'at full pay' } : { ar: `بأجر ${cs.curPay}%`, en: `at ${cs.curPay}% pay` };
  let s = notify(state, { to: person.id, kind: 'reminder', at, link: '#/me/balances', title: { ar: `اقتربت من نهاية شريحة الأجر ${cs.curPay === 100 ? 'الكامل' : `${cs.curPay}%`} في ${type.name.ar}`, en: `Near the end of the ${cs.curPay === 100 ? 'full-pay' : `${cs.curPay}%`} tier for ${type.name.en}` }, body: { ar: `بلغت إجازاتك ${cs.used} من ${cs.total} يوماً ${tierName.ar} في دورتك الحالية (${ev.sick.cycleStart} → ${ev.sick.cycleEnd})؛ ما بعدها ${beyond.ar}.`, en: `You have used ${cs.used} of ${cs.total} days ${tierName.en} in your current cycle (${ev.sick.cycleStart} → ${ev.sick.cycleEnd}); beyond it ${beyond.en}.` } });
  const hr = poolPositionIds(s, 'O-211').map((pid) => holderOf(s, pid)?.id).filter((x): x is string => !!x);
  s = notifyMany(s, hr, { kind: 'reminder', at, link: `#/requests/${req.id}`, title: { ar: `${first(person.name)} يقترب من نهاية شريحة ${type.name.ar}`, en: `${first(person.nameEn)} is near the end of the ${type.name.en} tier` }, body: { ar: `${person.name}: ${cs.used} من ${cs.total} يوماً ${tierName.ar} في الدورة الحالية؛ ما بعدها ${beyond.ar}.`, en: `${person.nameEn}: ${cs.used} of ${cs.total} days ${tierName.en} in the current cycle; beyond it ${beyond.en}.` } });
  return s;
}

/* ——— دورة حياة إصدار السياسة: من يعتمد، ومن يُبلَّغ بالجدولة والسريان ——— */
function policyAudience(state: State): string[] {
  const admins = state.people.filter((p) => p.persona === 'admin').map((p) => p.id);
  const hr = poolPositionIds(state, 'O-211').map((pid) => holderOf(state, pid)?.id).filter((x): x is string => !!x);
  return Array.from(new Set([...admins, ...hr]));
}
/** من يتولى الموافقة الثانية على إصدار: شاغل المنصب المعتمد (أو نائبه أو رئيسه إن شغر) */
export function policyApprovers(state: State, positionId: string): Person[] {
  const h = resolveHolder(state, positionId); const p = h.personId ? personById(state, h.personId) : undefined; return p ? [p] : [];
}
export interface PolicyTask { version: PolicyVersion; positionId: string; requestedAt: number; dueAt: number; overdue: boolean }
/** مهام السياسة المنتظرة لشخص: الإصدارات التي تنتظر موافقته الثانية (تظهر في مهامي مع بقية المهام) */
export function policyTasksFor(state: State, person: Person, now = Date.now()): PolicyTask[] {
  const today = toISO(now); const out: PolicyTask[] = [];
  for (const v of state.policy.versions) {
    if (statusOf(v, state.policy.versions, today) !== 'awaiting' || !v.approval) continue;
    const mine = policyApprovers(state, v.approval.positionId).some((p) => p.id === person.id); if (!mine) continue;
    const dueAt = v.approval.requestedAt + 48 * 3600000;
    out.push({ version: v, positionId: v.approval.positionId, requestedAt: v.approval.requestedAt, dueAt, overdue: now > dueAt });
  }
  return out;
}
/** بعد الجدولة: إن كانت الموافقة الثانية مطلوبة تصل مهمة إلى المعتمد، وإلا يُبلَّغ مدير السياسة وشؤون الموظفين بموعد السريان */
export function afterSchedule(state: State, versionId: string, at = Date.now()): State {
  const v = state.policy.versions.find((x) => x.id === versionId); if (!v) return state;
  let s = state; const creator = personById(s, v.createdBy);
  if (v.approval && v.approval.status === 'pending') {
    for (const p of policyApprovers(s, v.approval.positionId)) s = notify(s, { to: p.id, kind: 'task', at, link: '#/admin/policy', title: { ar: `مهمة: الموافقة الثانية على الإصدار ${v.number} من سياسة الإجازات`, en: `Task: second approval of leave policy version ${v.number}` }, body: { ar: `${creator?.name || ''} جدوله ليسري في ${v.from}: ${v.reason}`, en: `${creator?.nameEn || ''} scheduled it for ${v.from}: ${v.reason}` } });
    return s;
  }
  return scheduledNotice(s, v, at);
}
function scheduledNotice(state: State, v: PolicyVersion, at: number): State {
  if (v.notifiedScheduled) return state;
  let s = state;
  for (const id of policyAudience(s)) s = notify(s, { to: id, kind: 'policy', at, link: '#/admin/policy', title: { ar: `جُدوِل الإصدار ${v.number} من سياسة الإجازات`, en: `Leave policy version ${v.number} scheduled` }, body: { ar: `يسري اعتباراً من ${v.from}${v.changes.length ? ` · ${changesText(v.changes.length, 'ar')}` : ''} · ${v.reason}${v.reference ? ` (${v.reference})` : ''}.`, en: `Takes effect on ${v.from}${v.changes.length ? ` · ${changesText(v.changes.length, 'en')}` : ''} · ${v.reason}${v.reference ? ` (${v.reference})` : ''}.` } });
  return { ...s, policy: { ...s.policy, versions: s.policy.versions.map((x) => (x.id === v.id ? { ...x, notifiedScheduled: true } : x)) } };
}
/** بعد قرار المعتمد الثاني: الاعتماد يُبلِّغ الجمهور بموعد السريان، والإعادة تُبلِّغ مدير السياسة بالملاحظة */
export function afterApproval(state: State, versionId: string, at = Date.now()): State {
  const v = state.policy.versions.find((x) => x.id === versionId); if (!v || !v.approval) return state;
  const actor = v.approval.by ? personById(state, v.approval.by) : undefined; const creator = personById(state, v.createdBy); const posTitle = positionById(state, v.approval.positionId)?.title || { ar: '', en: '' };
  if (v.approval.status === 'approved') { let s = scheduledNotice(state, v, at); if (creator) s = notify(s, { to: creator.id, kind: 'policy', at, link: '#/admin/policy', title: { ar: `اعتمد ${actor ? first(actor.name) : posTitle.ar} الإصدار ${v.number}`, en: `${actor ? first(actor.nameEn) : posTitle.en} approved version ${v.number}` }, body: { ar: `يسري في ${v.from}.${v.approval.note ? ` ملاحظة: ${v.approval.note}` : ''}`, en: `Effective ${v.from}.${v.approval.note ? ` Note: ${v.approval.note}` : ''}` } }); return s; }
  if (v.approval.status === 'returned' && creator) return notify(state, { to: creator.id, kind: 'policy', at, link: '#/admin/policy', title: { ar: `أُعيد الإصدار ${v.number} إلى المسودة`, en: `Version ${v.number} returned to draft` }, body: { ar: `${actor?.name || posTitle.ar}: ${v.approval.note || ''}`, en: `${actor?.nameEn || posTitle.en}: ${v.approval.note || ''}` } });
  return state;
}
/** فحص السريان: الإصدارات التي بلغت تاريخها اليوم يُبلَّغ بها مدير السياسة وشؤون الموظفين مرة واحدة */
export function activationTick(state: State, now = Date.now()): State {
  const today = toISO(now); let s = state; let changed = false;
  for (const v of s.policy.versions) {
    if (!inForce(v) || v.from > today || v.notifiedActive) continue;
    changed = true;
    for (const id of policyAudience(s)) s = notify(s, { to: id, kind: 'policy', at: now, link: '#/admin/policy', title: { ar: `سرى الإصدار ${v.number} من سياسة الإجازات`, en: `Leave policy version ${v.number} is now in force` }, body: { ar: `اعتباراً من ${v.from === today ? 'اليوم' : v.from}؛ الطلبات الجديدة تُقيَّم به، والجارية تكمل بإصدارها.`, en: `From ${v.from === today ? 'today' : v.from}; new requests are evaluated under it, in-flight ones keep their version.` } });
    s = { ...s, policy: { ...s.policy, versions: s.policy.versions.map((x) => (x.id === v.id ? { ...x, notifiedActive: true } : x)) } };
  }
  return changed ? s : state;
}
/** إشعار سريان قديم للبيانات التجريبية (الإصدار الابتدائي) */
export function policyActiveNotification(state: State, v: PolicyVersion, at: number): State {
  let s = state;
  for (const id of policyAudience(s)) s = notify(s, { to: id, kind: 'policy', at, link: '#/admin/policy', title: { ar: `سرى الإصدار ${v.number} من سياسة الإجازات`, en: `Leave policy version ${v.number} is now in force` }, body: { ar: `اعتباراً من ${v.from}؛ ${v.reason}.`, en: `From ${v.from}; ${v.reason}.` } });
  return s;
}
/* ——— v0.7: تصحيح الإصدارات، وإلغاء الإجازة المعتمدة ——— */
/** الطلبات التي قُيِّمت بإصدار (D-009): تبقى بإصدارها؛ وهي ما يمنع التراجع عن إصدار سرى */
export function requestsUnderVersion(state: State, v: PolicyVersion): Request[] { return state.requests.filter((r) => r.policyVersion === v.number && r.status !== 'withdrawn'); }
export function canRevertVersion(state: State, v: PolicyVersion, today: string): boolean { return statusOf(v, state.policy.versions, today) === 'active' && !revertBlocker(state, v); }
/** ما يمنع التراجع عن إصدار سارٍ: طلبات قُيِّمت به (D-009)، أو إصدار مجدول/منتظر بعده بُني عليه فيحمل تغييره (v0.8.1)، أو أنه الإصدار الوحيد */
export function revertBlocker(state: State, v: PolicyVersion): { kind: 'evaluated'; n: number } | { kind: 'later'; version: PolicyVersion } | { kind: 'only' } | null {
  const n = requestsUnderVersion(state, v).length; if (n) return { kind: 'evaluated', n };
  const later = state.policy.versions.filter((x) => x.id !== v.id && x.scheduled && !x.cancelled && supersedes(x, v)).sort((a, b) => (supersedes(a, b) ? 1 : -1))[0]; if (later) return { kind: 'later', version: later };
  if (!state.policy.versions.some((x) => x.id !== v.id && inForce(x) && x.from < v.from)) return { kind: 'only' };
  return null;
}
/** إبلاغ الجمهور المعني بالتراجع عن إصدار أو تصحيحه */
export function afterRevert(state: State, v: PolicyVersion, reason: string, at = Date.now()): State {
  let s = state;
  for (const id of policyAudience(s)) s = notify(s, { to: id, kind: 'policy', at, link: '#/admin/policy', title: { ar: `تُرُوجع عن الإصدار ${v.number} من سياسة الإجازات`, en: `Leave policy version ${v.number} reverted` }, body: { ar: `${reason}؛ عاد الإصدار السابق سارياً.`, en: `${reason}; the previous version is active again.` } });
  return s;
}
/** الاستحقاقات التي نُفِّذت فعلاً مع إجازة معتمدة (مهمة تنفيذ أُغلقت بمرجع أو إشعار سُلِّم) */
export function fulfilledEntitlements(r: Request, content: PolicyContent): { e: Entitlement; ref?: string }[] {
  return r.steps.filter((st) => st.entitlementId && st.status === 'done' && (st.mode === 'fulfil' || st.mode === 'notify')).map((st) => ({ e: content.entitlements.find((x) => x.id === st.entitlementId)!, ref: st.ref })).filter((x) => !!x.e);
}
export interface CancelEval { ok: boolean; checks: Check[]; fulfilled: { e: Entitlement; ref?: string }[]; steps: Step[]; notApplied: { title: T2; why: T2 }[]; rule: ReturnType<typeof cancelRuleOf> }
/** تقييم إلغاء إجازة معتمدة: هل يجوز الآن ولمن، ومساره (مسار النوع + موافقة الجهات المنفذة + النظام + الاسترداد)، وما لا ينطبق */
export function cancelEvaluation(state: State, original: Request, today: string, groupNames?: Parameters<typeof buildSteps>[5]): CancelEval {
  const checks: Check[] = []; const lv = original.leave!; const requester = personById(state, original.requesterId)!;
  const version = state.policy.versions.find((v) => v.number === original.policyVersion) || versionOn(state.policy, today) || state.policy.versions[0];
  const content = version.content; const type = content.types.find((t) => t.id === lv.typeId)!; const rule = cancelRuleOf(type);
  const block = (key: string, ar: string, en: string) => checks.push({ key, level: 'block', text: { ar, en } });
  if (original.status !== 'completed') block('status', 'الإلغاء للإجازات المعتمدة فقط؛ الطلب الجاري يُسحب من صفحته.', 'Cancellation is for approved leaves; an in-flight request is withdrawn from its page.');
  if (lv.cancelled) block('done', 'أُلغيت هذه الإجازة من قبل.', 'This leave was already cancelled.');
  if (original.cancellation?.status === 'pending') block('pending', `طلب الإلغاء ${original.cancellation.requestId} جارٍ.`, `Cancellation ${original.cancellation.requestId} is in progress.`);
  if (rule.allowed === 'never') block('rule', `لا يجوز إلغاء ${type.name.ar} بعد اعتمادها وفق سياسة الإجازات.`, `${type.name.en} cannot be cancelled once approved under the leave policy.`);
  else if (rule.allowed === 'beforeStart' && today >= lv.from) block('rule', `يجوز إلغاء ${type.name.ar} قبل بدايتها فقط (بدأت في ${lv.from}).`, `${type.name.en} can be cancelled only before it starts (started ${lv.from}).`);
  else if (rule.allowed === 'untilEnd' && today > lv.to) block('rule', `يجوز إلغاء ${type.name.ar} حتى نهايتها فقط (انتهت في ${lv.to}).`, `${type.name.en} can be cancelled only until it ends (ended ${lv.to}).`);
  const pc = state.policy.periodClose;
  if (pc && periodClosed(pc, lv.from)) block('closed', `الفترة حتى ${pc.until} مقفلة (${pc.reason})؛ لا يُلغى غياب فيها. راجع شؤون الموظفين.`, `The period up to ${pc.until} is closed (${pc.reason}); absences inside it cannot be cancelled. Contact personnel affairs.`);
  const fulfilled = fulfilledEntitlements(original, content);
  const steps = cancelSteps(state, requester, content, original, Date.now(), groupNames);
  return { ok: !checks.some((c) => c.level === 'block'), checks, fulfilled, steps: steps.steps, notApplied: steps.notApplied, rule };
}
/** خطوات طلب الإلغاء: إشعار المدير (بلا اعتماد) أو مسار الإلغاء، ثم موافقة الجهة المنفذة لكل استحقاق نُفِّذ ولزمت موافقته، ثم النظام، ثم استرداد كل استحقاق نُفِّذ */
export function cancelSteps(state: State, requester: Person, content: PolicyContent, original: Request, at: number, groupNames?: Parameters<typeof buildSteps>[5]): BuiltSteps {
  const lv = original.leave!; const type = content.types.find((t) => t.id === lv.typeId)!; const rule = cancelRuleOf(type); const names = namesFor(state);
  const route: Route = rule.route === 'none' ? { id: 'none', name: t2('بلا اعتماد', 'No approval'), steps: [{ agent: { kind: 'lineManager' }, mode: 'notify', slaHours: 0, title: t2('إشعار المدير المباشر بالإلغاء', 'Line manager notified of the cancellation') }] } : content.routes.find((r) => r.id === rule.route) || content.routes[0];
  const routeWithTitles: Route = { ...route, steps: route.steps.map((rs) => (rs.title ? rs : { ...rs, title: (() => { const t = stepTitle(rs, names); return rs.mode === 'notify' ? { ar: `${t.ar} بالإلغاء`, en: `${t.en} of the cancellation` } : { ar: `${t.ar} للإلغاء`, en: `${t.en} of the cancellation` }; })() })) };
  const built = buildSteps(state, requester, routeWithTitles, { days: lv.days, workingDays: lv.workingDays }, SYSTEM_TITLE['TM-01C'], groupNames);
  const sysIdx = built.steps.findIndex((x) => x.mode === 'system'); const before: Step[] = []; const after: Step[] = []; let n = built.steps.length;
  for (const { e } of fulfilledEntitlements(original, content)) {
    const oc = onCancelOf(e); const res = resolveAgent(state, requester, e.fulfil.agent); if (res.skipped) { built.notApplied.push({ title: e.name, why: res.skipped }); continue; }
    const agentName = agentTitle(e.fulfil.agent, names);
    if (oc.approval) { n += 1; before.push({ key: `c${n}`, desk: 'hr', title: { ar: `موافقة ${agentName.ar} على إلغاء ${e.name.ar}`, en: `${agentName.en} approval to cancel ${e.name.en}` }, status: 'pending', mode: 'approve', agent: e.fulfil.agent, assigneeIds: res.personIds, positionIds: res.positionIds, quorum: 'any', why: { ar: `نُفِّذ ${e.name.ar} مع هذه الإجازة؛ الجهة المنفذة تعتمد إلغاءها قبل حذف الغياب`, en: `${e.name.en} was fulfilled with this leave; the executing office approves before the absence is deleted` }, slaHours: oc.slaHours, escalation: { remindAtPct: 80, after: 'notifyManager' }, entitlementId: e.id }); }
    if (oc.reversal !== 'none') { n += 1; after.push({ key: `r${n}`, desk: 'hr', title: { ar: `${oc.reversal === 'task' ? 'استرداد' : 'إشعار الاسترداد'}: ${e.name.ar}`, en: `${oc.reversal === 'task' ? 'Recover' : 'Recovery notice'}: ${e.name.en}` }, status: 'pending', mode: oc.reversal === 'task' ? 'fulfil' : 'notify', agent: e.fulfil.agent, assigneeIds: res.personIds, positionIds: res.positionIds, quorum: 'any', why: res.why, notifyOnly: oc.reversal === 'notify', slaHours: oc.reversal === 'task' ? oc.slaHours : 0, entitlementId: e.id }); }
  }
  const steps = [...built.steps.slice(0, sysIdx), ...before, ...built.steps.slice(sysIdx), ...after].map((x, i) => ({ ...x, key: x.mode === 'system' ? 'sys' : `${x.key.charAt(0)}${i + 1}` }));
  return { steps, notApplied: built.notApplied };
}
/** إنشاء طلب إلغاء إجازة معتمدة (TM-01C) مرتبط بالأصل، بمساره الملتقط لحظة الطلب */
export function createCancellation(state: State, originalId: string, reason: string, at = Date.now(), groupNames?: Parameters<typeof buildSteps>[5]): [State, Request | undefined] {
  const original = state.requests.find((r) => r.id === originalId); if (!original || !original.leave) return [state, undefined];
  const ev = cancelEvaluation(state, original, toISO(at), groupNames); if (!ev.ok) return [state, undefined];
  const version = state.policy.versions.find((v) => v.number === original.policyVersion) || versionOn(state.policy, toISO(at)) || state.policy.versions[0];
  const type = version.content.types.find((t) => t.id === original.leave!.typeId)!;
  const lv: LeaveInfo = { ...original.leave, cancelOf: original.id, cancelReason: reason, entitlements: ev.fulfilled.map((x) => x.e.id), payBreakdown: undefined };
  const fields: Field[] = [{ key: 'original', label: t2('الإجازة الأصلية', 'Original leave'), value: original.id }, { key: 'type', label: t2('نوع الإجازة', 'Leave type'), value: type.name.ar }, { key: 'from', label: t2('من', 'From'), value: lv.from }, { key: 'to', label: t2('إلى', 'To'), value: lv.to }, { key: 'reason', label: t2('سبب الإلغاء', 'Reason for cancelling'), value: reason }];
  const [s1, req] = createRequest(state, { serviceId: 'TM-01C', requesterId: original.requesterId, fields, at, steps: ev.steps, notApplied: ev.notApplied, leave: lv, policyVersion: original.policyVersion });
  /* إن كان الإلغاء بلا اعتماد فقد اكتمل داخل الإنشاء نفسه (الأصل معلَّم «ملغاة» أصلاً)؛ وإلا يُعلَّم الأصل بطلب إلغاء جارٍ */
  const requested = { at, who: original.requesterId, what: { ar: `طُلب إلغاء الإجازة (${req.id}): ${reason}`, en: `Cancellation requested (${req.id}): ${reason}` } };
  const s2 = { ...s1, requests: s1.requests.map((x) => {
    if (x.id !== original.id) return x;
    if (x.cancellation?.requestId === req.id && x.cancellation.status === 'done') return { ...x, audit: [...x.audit.slice(0, -1), requested, x.audit[x.audit.length - 1]] };
    return { ...x, cancellation: { requestId: req.id, status: 'pending' } as Request['cancellation'], updatedAt: at, audit: [...x.audit, requested] };
  }) };
  return [s2, s2.requests.find((x) => x.id === req.id)];
}
/** خطوات تنفيذ الاستحقاقات المختارة (D-014): تُلحق بعد خطوة النظام، بقاعدة استخراج كل استحقاق وتوقيته */
export function fulfilmentSteps(state: State, requester: Person, content: PolicyContent, leave: LeaveInfo, at: number): RouteStep[] {
  const out: RouteStep[] = [];
  for (const id of leave.entitlements || []) {
    const e = content.entitlements.find((x) => x.id === id); if (!e) continue;
    let sla = e.fulfil.slaHours;
    if (e.fulfil.timing === 'beforeStart') { const dueBy = fromISO(leave.from).getTime() - (e.fulfil.daysBefore || 0) * 86400000; const hours = Math.max(24, Math.round((dueBy - at) / 3600000)); sla = Math.min(sla, hours); }
    out.push({ agent: e.fulfil.agent, mode: e.fulfil.mode === 'task' ? 'fulfil' : 'notify', slaHours: sla, title: { ar: `${e.fulfil.mode === 'task' ? 'تنفيذ' : 'إشعار'}: ${e.name.ar}`, en: `${e.fulfil.mode === 'task' ? 'Fulfil' : 'Notify'}: ${e.name.en}` }, entitlementId: e.id });
  }
  return out;
}
/** خطوات طلب الإجازة كاملة: مسار النوع ثم النظام ثم تنفيذ الاستحقاقات */
export function leaveSteps(state: State, requester: Person, content: PolicyContent, typeRouteId: string, leave: LeaveInfo, at: number, groupNames?: Parameters<typeof buildSteps>[5]): BuiltSteps {
  const route = content.routes.find((r) => r.id === typeRouteId) || content.routes[0];
  const built = buildSteps(state, requester, route, { days: leave.days, workingDays: leave.workingDays }, SYSTEM_TITLE['TM-01'], groupNames);
  const ful = fulfilmentSteps(state, requester, content, leave, at);
  let n = built.steps.length;
  for (const rs of ful) { const res = resolveAgent(state, requester, rs.agent); if (res.skipped) { built.notApplied.push({ title: rs.title!, why: res.skipped }); continue; } n += 1; built.steps.push({ key: `f${n}`, desk: 'hr', title: rs.title!, status: 'pending', mode: rs.mode, agent: rs.agent, assigneeIds: res.personIds, positionIds: res.positionIds, quorum: 'any', why: res.why, notifyOnly: rs.mode === 'notify', slaHours: rs.slaHours, entitlementId: rs.entitlementId }); }
  return built;
}

/* ——— v0.8.2 سجل إجازاتي (سؤال عمر «كيف أرى سجل إجازاتي بعين الموظف؟»): سطر واحد لكل إجازة من مصدرين — الغياب المسجَّل في النظام المرجعي (مصدر الحقيقة لما وقع: IT2001 في H4S4) وطلبات البوابة (ما ينتظر أو أُعيد أو رُفض أو سُحب أو أُلغي) — مدمجَين بلا تكرار ——— */
export type LeaveEntryStatus = 'taken' | 'ongoing' | 'upcoming' | 'in_review' | 'returned' | 'rejected' | 'withdrawn' | 'cancelling' | 'cancelled';
export interface LeaveEntry { key: string; typeId: string; from: string; to: string; days: number; workingDays?: number; halfDay?: boolean; status: LeaveEntryStatus; requestId?: string; decisionNo?: string; policyVersion?: string; cancelRequestId?: string; posted: boolean; entitlements?: string[]; at?: number }
const LEAVE_STATUS_ORDER: Record<LeaveEntryStatus, number> = { in_review: 0, returned: 1, ongoing: 2, upcoming: 3, cancelling: 4, taken: 5, cancelled: 6, rejected: 7, withdrawn: 8 };
export function leaveHistory(state: State, personId: string, today = toISO(Date.now())): LeaveEntry[] {
  const byDate = (from: string, to: string): LeaveEntryStatus => (to < today ? 'taken' : from > today ? 'upcoming' : 'ongoing');
  const out: LeaveEntry[] = []; const seen = new Set<string>();
  for (const r of state.requests) {
    if (r.requesterId !== personId || !r.leave || r.leave.cancelOf) continue;
    const lv = r.leave; const k = `${lv.typeId}|${lv.from}|${lv.to}`;
    let status: LeaveEntryStatus;
    if (r.status === 'completed') { status = lv.cancelled ? 'cancelled' : r.cancellation?.status === 'pending' ? 'cancelling' : byDate(lv.from, lv.to); }
    else if (r.status === 'in_review') status = 'in_review'; else if (r.status === 'returned') status = 'returned'; else if (r.status === 'rejected') status = 'rejected'; else if (r.status === 'withdrawn') status = 'withdrawn'; else status = 'in_review';
    const posted = (state.absences || []).some((a) => a.personId === personId && a.typeId === lv.typeId && a.from === lv.from && a.to === lv.to);
    if (posted) seen.add(k);
    out.push({ key: r.id, typeId: lv.typeId, from: lv.from, to: lv.to, days: lv.days, workingDays: lv.workingDays, halfDay: lv.halfDay, status, requestId: r.id, decisionNo: r.docs.find((d) => d.kind === 'issued')?.number, policyVersion: r.policyVersion, cancelRequestId: r.cancellation?.requestId, posted, entitlements: lv.entitlements, at: r.createdAt });
  }
  /* غياب مسجَّل في النظام المرجعي بلا طلب في البوابة (تاريخ سابق للبوابة أو سُجِّل يدوياً): يظهر كما هو */
  for (const a of state.absences || []) {
    if (a.personId !== personId) continue; const k = `${a.typeId}|${a.from}|${a.to}`; if (seen.has(k)) continue; seen.add(k);
    out.push({ key: `ABS-${k}`, typeId: a.typeId, from: a.from, to: a.to, days: a.days, status: byDate(a.from, a.to), posted: true });
  }
  return out.sort((x, y) => (x.from === y.from ? LEAVE_STATUS_ORDER[x.status] - LEAVE_STATUS_ORDER[y.status] : x.from < y.from ? 1 : -1));
}
/** ملخص السنة: ما أُخذ (المعتمد الذي وقع أو يقع الآن)، وما هو قادم معتمد، وما ينتظر الاعتماد — بالأيام */
export function leaveSummary(entries: LeaveEntry[], year: number | null): { taken: number; upcoming: number; pending: number; byType: Record<string, number> } {
  const inYear = (e: LeaveEntry) => year === null || e.from.startsWith(String(year));
  const s = { taken: 0, upcoming: 0, pending: 0, byType: {} as Record<string, number> };
  for (const e of entries) { if (!inYear(e)) continue;
    if (e.status === 'taken' || e.status === 'ongoing' || e.status === 'cancelling') { s.taken += e.days; s.byType[e.typeId] = (s.byType[e.typeId] || 0) + e.days; }
    else if (e.status === 'upcoming') s.upcoming += e.days; else if (e.status === 'in_review' || e.status === 'returned') s.pending += e.days; }
  return s;
}
export { DESK_TITLE };
