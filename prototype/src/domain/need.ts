// v0.9 محرك الاحتياج (بطاقة AS-01): رحلة واحدة للطالب من الحاجة إلى التسليم وقيد العهدة، على محرك CAP-01 نفسه — بإضافتين: خطوة قرار بنتيجة تختار المقطع التالي، وحالة لكل بند.
// v0.10 (AS-01 2.0، مراجعة عمر 19 سبتمبر): الطالب يصف حاجته أو يختار من كتالوج الاحتياجات، والجهة الفنية (أو المستودع) تحدد الصنف، وفرع الشراء: تجهيز ← اعتماد الشراء بجدول الصلاحيات ← حجز الاعتماد ← [المناقصات] ← [العروض ← التقييم] ← [زيادة الحجز] ← [اعتماد الترسية] ← طلب الشراء آلياً ← أمر الشراء ← الاستلام ← التسليم.
// الطلب كائن واحد (P-05)؛ المعتمد منصب (D-012)؛ كل قائمة مفتاحها في النظام المرجعي (P-10)؛ الإلغاء إنهاء بتاريخ لا حذف (P-12). دوال نقية على الحالة.
import type { State, Request, Step, Person, T2, NeedInfo, NeedLine, NeedRole, NeedBranch, NeedOffer, CustodyEntry, Field, OrgLevel, NeedAvailability, Doc, NeedReceipt, NeedReceiptLine, ReceiptLineResult, NeedHandover } from './types';
import { ORG_LEVELS } from './types';
import { toISO, activeVersion, liveNeed, type NeedContent, type NeedCategory, type NeedSite, type NeedStore, type NeedEntity, type NeedCatalogEntry, type NeedPool, type AuthorityBand, type PurchaseMethod, type AgentRule, type RouteStep, type PolicyState, type PolicyVersion } from './policy';
import { personById, positionById, unitById, unitOf, positionOf, resolveAgent, createRequest, decide, completeCurrent, notifyPeople, auditLine, patchRequest, branchActive, awardDeviations, readyLines, readyQty, type BuiltSteps } from './engine';
export { branchActive, branchWhy, awardDeviations, readyLines, readyQty } from './engine';

const t2 = (ar: string, en: string): T2 => ({ ar, en });
const levelIndex = (l: OrgLevel) => ORG_LEVELS.indexOf(l);
const first = (s: string) => s.split(' ')[0];

/* ——— السياسة السارية والقوائم ——— */
export function needVersion(state: State, today = toISO(Date.now())): PolicyVersion { return activeVersion(state.needPolicy, today); }
export function needContent(state: State, today = toISO(Date.now())): NeedContent { return needVersion(state, today).content.need!; }
export const NEED_ROLE_TITLE: Record<NeedRole, T2> = {
  coordinator: t2('مراجعة منسّق القطاع', 'Sector coordinator review'), chain: t2('اعتماد السلسلة الإدارية', 'Management chain approval'), entity: t2('الجهة الفنية: الاعتماد وتحديد الصنف', 'Technical entity: approval and item identification'),
  store: t2('المستودع: التوفر والحجز', 'Store: availability and reservation'), procurement: t2('المشتريات: تجهيز الشراء', 'Procurement: purchase preparation'), purchaseApproval: t2('اعتماد الشراء', 'Purchase approval'),
  budget: t2('الموازنة: الاعتماد المبدئي وحجز الاعتماد', 'Budget: initial approval and funds reservation'), quotes: t2('المشتريات: جمع العروض', 'Procurement: collecting offers'), evaluator: t2('التقييم الفني والتوصية', 'Technical evaluation and recommendation'),
  budgetTopUp: t2('الموازنة: زيادة حجز الاعتماد', 'Budget: reservation top-up'), awardApproval: t2('اعتماد الترسية', 'Award approval'), tender: t2('إجراء المناقصات', 'Tender procedure'), pr: t2('النظام: إنشاء طلب الشراء', 'System: purchase requisition'),
  po: t2('أمر الشراء من النظام المرجعي', 'Purchase order from the system of record'), receipt: t2('الاستلام من المورد ومحضر الاستلام', 'Receipt from the supplier and the receipt record'), receiptSign: t2('توقيع محضر الاستلام', 'Signing the receipt record'),
  handover: t2('التسليم والاستلام', 'Handover'), handoverSign: t2('توقيع المستفيد على الاستلام', 'Beneficiary signs the receipt'),
};
/** المقاطع الستة التي يرى الطالب رحلته بها */
export type NeedSegment = 'request' | 'approval' | 'store' | 'purchase' | 'supply' | 'handover';
export const SEGMENT_OF: Record<NeedRole, NeedSegment> = { coordinator: 'request', chain: 'approval', entity: 'approval', store: 'store', procurement: 'purchase', purchaseApproval: 'purchase', budget: 'purchase', quotes: 'purchase', evaluator: 'purchase', budgetTopUp: 'purchase', awardApproval: 'purchase', tender: 'purchase', pr: 'purchase', po: 'supply', receipt: 'supply', receiptSign: 'supply', handover: 'handover', handoverSign: 'handover' };
export const SEGMENT_TITLE: Record<NeedSegment, T2> = { request: t2('الطلب', 'Request'), approval: t2('الاعتماد', 'Approval'), store: t2('التجهيز', 'Preparation'), purchase: t2('الشراء', 'Purchase'), supply: t2('التوريد', 'Supply'), handover: t2('التسليم', 'Handover') };

/* ——— من يفتح الاحتياج (D-017): المستوى الإداري — من يشغل منصب رئيس وحدة بمستوى لا يقل عن الحد الأدنى ——— */
export function managerLevelOf(state: State, person: Person): OrgLevel | null {
  const pos = positionOf(state, person); if (!pos) return null;
  const unit = state.org.units.find((u) => u.chiefPositionId === pos.id); return unit ? unit.level : null;
}
export function canOpenNeed(state: State, person: Person, content: NeedContent): { ok: boolean; level: OrgLevel | null; min: OrgLevel } {
  const level = managerLevelOf(state, person); const min = content.rules.openerMinLevel;
  return { ok: !!level && levelIndex(level) >= levelIndex(min), level, min };
}
/** المستفيدون الذين يجوز للطالب أن يطلب لهم: هو نفسه وكل من في وحدته وما تحتها */
export function beneficiariesFor(state: State, person: Person): Person[] {
  const pos = positionOf(state, person); const root = pos ? state.org.units.find((u) => u.chiefPositionId === pos.id) : undefined;
  if (!root) return [person];
  const under = new Set<string>(); const walk = (id: string) => { under.add(id); state.org.units.filter((u) => u.parentId === id).forEach((u) => walk(u.id)); }; walk(root.id);
  const people = state.people.filter((p) => { const u = unitOf(state, p); return !!u && under.has(u.id); });
  return [person, ...people.filter((p) => p.id !== person.id)];
}
/** قطاع الطالب (لمنسّقي المشتريات) */
export function sectorOf(state: State, person: Person) { let u = unitOf(state, person); while (u && u.level !== 'sector' && u.parentId) u = unitById(state, u.parentId); return u && u.level === 'sector' ? u : undefined; }
export function coordinatorsOf(state: State, sectorId?: string): string[] { return sectorId ? state.needPolicy.groups[`coord:${sectorId}`] || [] : []; }
export function siteOf(content: NeedContent, person: Person, today: string): NeedSite | undefined { return liveNeed(content.sites, today).find((s) => s.id === (person.location || 'riyadh')); }
export function categoryOf(content: NeedContent, id: string): NeedCategory | undefined { return content.categories.find((c) => c.id === id); }
export function entityOf(content: NeedContent, id?: string): NeedEntity | undefined { return id ? content.entities.find((e) => e.id === id) : undefined; }
export function storeOf(content: NeedContent, id?: string): NeedStore | undefined { return id ? content.stores.find((s) => s.id === id) : undefined; }
/** المستودع الذي يخدم هذا الاحتياج: مستودع الفئة إن كان في مقر المستفيد؛ وإلا لا مستودع (توريد مباشر) */
export function storeFor(content: NeedContent, cat: NeedCategory, site?: NeedSite): NeedStore | undefined { if (!cat.storeId || !site) return undefined; return site.storeIds.includes(cat.storeId) ? storeOf(content, cat.storeId) : undefined; }
export function stockOf(state: State, itemId: string | undefined, storeId: string | undefined): number { if (!itemId || !storeId) return 0; return state.erp.stock.find((x) => x.itemId === itemId && x.storeId === storeId)?.qty || 0; }
/* ——— v0.10: كتالوج الاحتياجات، وجدول الصلاحيات، وطرق الشراء ——— */
export function catalogFor(content: NeedContent, categoryId: string, today: string): NeedCatalogEntry[] { return liveNeed(content.catalog || [], today).filter((k) => k.categoryId === categoryId); }
export function catalogOf(content: NeedContent, id?: string): NeedCatalogEntry | undefined { return id ? (content.catalog || []).find((k) => k.id === id) : undefined; }
export function methodOf(content: NeedContent, id?: string): PurchaseMethod | undefined { return id ? (content.methods || []).find((m) => m.id === id) : undefined; }
/** الشريحة التي تعتمد قيمة: أول شريحة سارية سقفها يغطي القيمة (null = بلا حد)؛ والشريحة الأعلى منها للشراء المباشر */
export function bandFor(content: NeedContent, amount: number, today: string, higher = false): AuthorityBand | undefined {
  const bands = liveNeed(content.authority || [], today).slice().sort((a, b) => (a.upTo === null ? 1 : b.upTo === null ? -1 : a.upTo - b.upTo));
  const i = bands.findIndex((b) => b.upTo === null || amount <= b.upTo); if (i < 0) return bands[bands.length - 1];
  return higher ? bands[Math.min(i + 1, bands.length - 1)] : bands[i];
}
/** القيمة الاسترشادية لبنود الطلب من الكتالوج أو من تحديد الصنف */
export function linesValue(lines: NeedLine[]): number { return lines.reduce((n, l) => n + (l.unitPrice || 0) * l.qty, 0); }
/* ——— v0.11 (D-023): مصدر التوفر ورصيد الجهة الفنية ——— */
/** مصدر التوفر للاحتياج: بند الكتالوج يتجاوز الفئة؛ وإلا الفئة؛ وإلا المستودع للمادة ولا شيء للخدمة */
export function availabilityOf(cat: NeedCategory, entries: (NeedCatalogEntry | undefined)[] = []): NeedAvailability {
  const fromEntry = entries.find((e) => e?.availability)?.availability; if (fromEntry) return fromEntry;
  if (entries.some((e) => e?.poolId)) return 'entity';
  return cat.availability || (cat.kind === 'material' ? 'store' : 'none');
}
export const canProvide = (a?: NeedAvailability) => a === 'entity' || a === 'contract';
export function poolsOf(content: NeedContent, entityId: string | undefined, today: string): NeedPool[] { return entityId ? liveNeed(content.pools || [], today).filter((p) => p.entityId === entityId) : []; }
export function poolOf(content: NeedContent, id?: string): NeedPool | undefined { return id ? (content.pools || []).find((p) => p.id === id) : undefined; }
/** الرصيد الجاري لرصيد الجهة (تشغيل): سجل البوابة للمقاعد والرخص، أو مخزون المادة في موقعها، أو المتبقي من العقد الإطاري بقيمة الوحدة */
export function poolStock(state: State, pool: NeedPool | undefined): number {
  if (!pool) return 0;
  if (pool.erpKind === 'material') return stockOf(state, pool.itemId, pool.storeId);
  if (pool.erpKind === 'contract') { const c = (state.erp.contracts || []).find((x) => x.id === pool.contractId); if (!c) return 0; const left = Math.max(0, c.target - c.consumed); return pool.unitPrice ? Math.floor(left / pool.unitPrice) : left; }
  return (state.erp.poolStock || []).find((x) => x.poolId === pool.id)?.qty || 0;
}

/* ——— بناء الخطوات من قالب المسار بالأدوار: الجهات تُستخرج من الفئة والمقر والقطاع لحظة التقديم ——— */
export interface NeedBuildCtx { content: NeedContent; requester: Person; beneficiary: Person; cat: NeedCategory; site?: NeedSite; store?: NeedStore; entity?: NeedEntity; coordinators: string[]; availability?: NeedAvailability }
const BUDGET_AGENT: AgentRule = { kind: 'positions', positionIds: ['S-123'], quorum: 'any' };
function agentFor(state: State, role: NeedRole, ctx: NeedBuildCtx, today: string): AgentRule | undefined {
  const { content, cat, store, entity, site, coordinators } = ctx;
  switch (role) {
    case 'coordinator': return content.rules.coordinatorStep && coordinators.length ? { kind: 'positions', positionIds: coordinators, quorum: 'any' } : undefined;
    case 'chain': return { kind: 'chain', upTo: content.rules.chainUpTo };
    case 'entity': return entity?.agent;
    case 'store': return store?.agent;
    case 'procurement': case 'quotes': case 'tender': case 'po': return { kind: 'pool', unitId: 'O-130' };
    case 'evaluator': return entity?.agent || { kind: 'pool', unitId: 'O-130' };
    case 'budget': case 'budgetTopUp': return BUDGET_AGENT;
    /* اعتماد الشراء والترسية بجدول الصلاحيات: تُبنى بالشريحة الأولى وتُعاد تسويتها بالقيمة عند التجهيز وعند التوصية (D-020، D-021) */
    case 'purchaseApproval': case 'awardApproval': return bandFor(content, 0, today)?.agent;
    case 'receipt': return cat.kind === 'material' ? (store?.agent || site?.receiverAgent) : (entity?.agent || { kind: 'requester' });
    case 'handover': return store?.agent || site?.receiverAgent;
    default: return undefined;
  }
}
const noStore = (ctx: NeedBuildCtx) => !ctx.store;
export function needSteps(state: State, ctx: NeedBuildCtx, at: number): BuiltSteps {
  const route = (needVersion(state, toISO(at)).content.routes.find((r) => r.id === (ctx.cat.kind === 'material' ? 'R5' : 'R7')) || { steps: [] as RouteStep[] });
  const steps: Step[] = []; const notApplied: BuiltSteps['notApplied'] = []; let n = 0; let prev: string | undefined;
  const sla = ctx.content.rules.sla;
  for (const rs of route.steps) {
    const role = rs.role!; const title = rs.title || NEED_ROLE_TITLE[role];
    /* لا مستودع في مقر المستفيد: تُتخطى خطوة المستودع وتسليمها من المخزون (توريد مباشر بعنوان المكتب) */
    if ((role === 'store' || (role === 'handover' && rs.branch === 'stock')) && noStore(ctx)) { notApplied.push({ title, why: t2(`لا مستودع في ${ctx.site?.name.ar || 'مقر المستفيد'}؛ يُورَّد مباشرة`, `No store at ${ctx.site?.name.en || "the beneficiary's site"}; delivered directly`) }); continue; }
    if (role === 'entity' && !ctx.entity) { notApplied.push({ title, why: t2('لا جهة فنية لهذه الفئة', 'No technical entity for this category') }); continue; }
    /* v0.10: خطوة النظام التي تُنشئ طلب الشراء آلياً بعد الترسية (D-022) */
    if (role === 'pr') { n += 1; steps.push({ key: `s${n}`, desk: 'system', title, status: 'pending', mode: 'system', slaHours: 0, role, branch: rs.branch }); continue; }
    /* v0.11 (D-023): مقطع «وُفِّر من رصيد الجهة» — تسليم توقّعه الجهة الفنية ثم المستفيد؛ لا يظهر إلا حين يكون مصدر التوفر رصيد الجهة أو عقداً إطارياً ولها جهة */
    if (role === 'handover' && rs.branch === 'provided') {
      if (!ctx.entity || !canProvide(ctx.availability)) continue;
      const res = resolveAgent(state, ctx.requester, ctx.entity.agent); if (res.skipped) continue;
      n += 1; steps.push({ key: `s${n}`, desk: 'hr', title: t2('التوفير من رصيد الجهة وتوقيع الاستلام', 'Provision from the entity pool and receipt signature'), status: 'pending', mode: 'fulfil', agent: ctx.entity.agent, assigneeIds: res.personIds, positionIds: res.positionIds, quorum: 'any', why: t2(`تسلّمه ${ctx.entity.name.ar} من رصيدها ويوقّع المستفيد`, `${ctx.entity.name.en} hands it over from its pool and the beneficiary signs`), slaHours: sla.handover || 0, role, branch: 'provided' });
      continue;
    }
    const agent = agentFor(state, role, ctx, toISO(at));
    if (!agent) { notApplied.push({ title, why: role === 'coordinator' ? t2('لا منسّقي مشتريات معيّنين للقطاع أو الخطوة مطفأة', 'No sector coordinators configured, or the step is switched off') : t2('لا جهة مسندة لهذه الخطوة', 'No agent configured for this step') }); continue; }
    /* المهلة: من قالب المسار إن حُدِّدت، وإلا من قواعد السياسة بحسب الدور (السلسلة الإدارية على مهلة المدير) */
    const hours = rs.slaHours || (sla as Record<string, number>)[role === 'chain' ? 'manager' : role === 'budgetTopUp' ? 'budget' : role] || 0;
    if (agent.kind === 'chain') {
      const chain = chainOf(state, ctx.requester, agent.upTo || 'sector');
      if (!chain.length) { notApplied.push({ title, why: t2('لا سلسلة إدارية فوق الطالب في الهيكل', 'No management chain above the requester') }); continue; }
      for (const link of chain) {
        const sub: AgentRule = { kind: 'positions', positionIds: [link.positionId], quorum: 'any' }; const res = resolveAgent(state, ctx.requester, sub);
        if (res.skipped) { notApplied.push({ title: t2(`اعتماد ${link.head.ar}`, `${link.head.en} approval`), why: res.skipped }); continue; }
        if (res.personIds.length === 1 && prev === res.personIds[0]) { notApplied.push({ title: t2(`اعتماد ${link.head.ar}`, `${link.head.en} approval`), why: t2('المعتمد نفسه اعتمد الخطوة السابقة؛ دُمجت الخطوتان', 'Same approver as the previous step; merged') }); continue; }
        n += 1; steps.push({ key: `s${n}`, desk: link.level === 'ga' ? 'gm' : link.level === 'sector' ? 'gm' : 'deptManager', title: t2(`اعتماد ${link.head.ar}`, `${link.head.en} approval`), status: 'pending', mode: 'approve', agent: sub, assigneeIds: res.personIds, positionIds: res.positionIds, quorum: 'any', why: res.why, slaHours: hours, escalation: rs.escalation, role: 'chain' });
        prev = res.personIds[0];
      }
      continue;
    }
    const res = resolveAgent(state, ctx.requester, agent);
    if (res.skipped) { notApplied.push({ title, why: res.skipped }); continue; }
    n += 1;
    const why = role === 'purchaseApproval' || role === 'awardApproval' ? t2(`بجدول الصلاحيات بحسب القيمة بعد التقدير — ${res.why.ar}`, `By the delegation table once the value is estimated — ${res.why.en}`) : res.why;
    steps.push({ key: `s${n}`, desk: role === 'coordinator' ? 'hr' : role === 'budget' || role === 'budgetTopUp' ? 'finance' : ['procurement', 'quotes', 'tender', 'po', 'purchaseApproval', 'awardApproval'].includes(role) ? 'buyer' : role === 'store' || role === 'handover' || role === 'receipt' ? 'buyer' : role === 'entity' || role === 'evaluator' ? 'hr' : 'hr', title, status: 'pending', mode: rs.mode, agent, assigneeIds: res.personIds, positionIds: res.positionIds, quorum: agent.kind === 'positions' && (agent.positionIds || []).length > 1 ? agent.quorum || 'any' : 'any', why, notifyOnly: rs.mode === 'notify', slaHours: hours, escalation: rs.escalation, role, branch: rs.branch });
    prev = res.personIds.length === 1 ? res.personIds[0] : undefined;
  }
  steps.push({ key: 'sys', desk: 'system', title: ctx.cat.kind === 'material' ? t2('الصرف من المستودع وقيد العهدة في النظام المرجعي', 'Store issue and custody posted in the system of record') : t2('إقفال الاحتياج في النظام المرجعي', 'Need closed in the system of record'), status: 'pending', slaHours: 0, mode: 'system' });
  return { steps, notApplied };
}
/** السلسلة الإدارية فوق الطالب حتى مستوى، بعناوين مقروءة (رئيس القسم، مدير الإدارة، المدير العام، رأس القطاع) */
function chainOf(state: State, person: Person, upTo: OrgLevel): { positionId: string; level: OrgLevel; head: T2 }[] {
  const HEAD: Record<OrgLevel, T2> = { section: t2('رئيس القسم', 'Section head'), department: t2('مدير الإدارة', 'Department director'), ga: t2('المدير العام', 'Director general'), sector: t2('رأس القطاع (تحت الأمين العام)', 'Sector head (under the SG)'), sg: t2('الأمين العام', 'Secretary-General') };
  const out: { positionId: string; level: OrgLevel; head: T2 }[] = []; const pos = positionOf(state, person); if (!pos) return out;
  /* الطالب الإداري لا يعتمد لنفسه: نبدأ من الوحدة التي فوق وحدته التي يرأسها */
  let unit = unitById(state, pos.unitId); if (unit && unit.chiefPositionId === pos.id) unit = unitById(state, unit.parentId);
  const seen = new Set<string>();
  while (unit && unit.chiefPositionId && !seen.has(unit.id)) {
    seen.add(unit.id); out.push({ positionId: unit.chiefPositionId, level: unit.level, head: HEAD[unit.level] });
    if (levelIndex(unit.level) >= levelIndex(upTo)) break;
    unit = unitById(state, unit.parentId);
  }
  return out;
}

/* ——— الإنشاء ——— */
export interface NeedInput { requesterId: string; beneficiaryId: string; categoryId: string; lines: { itemId?: string; catalogId?: string; name: T2; qty: number; unit?: T2 }[]; justification: string; urgent?: boolean; estimatedValue?: number; attachment?: string; at?: number }
export function buildNeedCtx(state: State, input: { requesterId: string; beneficiaryId: string; categoryId: string; catalogIds?: string[] }, today: string): NeedBuildCtx | null {
  const content = needContent(state, today); const requester = personById(state, input.requesterId); const beneficiary = personById(state, input.beneficiaryId) || requester; const cat = categoryOf(content, input.categoryId);
  if (!requester || !beneficiary || !cat) return null;
  const site = siteOf(content, beneficiary, today); const store = cat.kind === 'material' ? storeFor(content, cat, site) : undefined; const entity = entityOf(content, cat.entityId);
  const sector = sectorOf(state, requester); const coordinators = coordinatorsOf(state, sector?.id).filter((pid) => positionById(state, pid) && positionById(state, pid)!.holderId !== requester.id);
  const availability = availabilityOf(cat, (input.catalogIds || []).map((id) => catalogOf(content, id)));
  return { content, requester, beneficiary, cat, site, store, entity, coordinators, availability };
}
export function createNeed(state: State, input: NeedInput): [State, Request] {
  const at = input.at ?? Date.now(); const today = toISO(at); const ctx = buildNeedCtx(state, { ...input, catalogIds: input.lines.map((l) => l.catalogId).filter((x): x is string => !!x) }, today)!; const version = needVersion(state, today);
  const built = needSteps(state, ctx, at);
  const items = state.erp.items;
  /* v0.10: البند من الكتالوج يحمل اسمه المألوف وسعره الاسترشادي ورقم صنفه المقترح خلف الشاشة (تؤكده الجهة الفنية أو المستودع)؛ والبند الحر يحمل كلمات الطالب؛ v0.11: وبند الكتالوج المربوط برصيد جهة يحمل رصيده المقترح */
  const lines: NeedLine[] = input.lines.map((l, i) => {
    const entry = catalogOf(ctx.content, l.catalogId); const itemId = l.itemId || entry?.itemIds[0]; const item = itemId ? items.find((x) => x.id === itemId) : undefined;
    return { id: `L${i + 1}`, itemId, catalogId: entry?.id, name: entry ? entry.name : item ? item.name : l.name, asked: entry || item ? undefined : l.name, qty: l.qty, unit: l.unit || entry?.unit || item?.unit || t2('قطعة', 'pc'), unitPrice: entry?.price ?? item?.price, status: ctx.store ? 'open' as const : 'purchasing' as const, storeId: ctx.store?.id, poolId: entry?.poolId };
  });
  const indicative = linesValue(lines) || undefined;
  const info: NeedInfo = { kind: ctx.cat.kind, categoryId: ctx.cat.id, beneficiaryId: ctx.beneficiary.id, siteId: ctx.site?.id || ctx.beneficiary.location || 'riyadh', lines, justification: input.justification, urgent: input.urgent && ctx.content.rules.urgentEnabled, estimatedValue: input.estimatedValue || indicative, indicativeValue: indicative, entityId: ctx.entity?.id, storeId: ctx.store?.id, coordinatorStep: built.steps.some((s) => s.role === 'coordinator'), tenderThreshold: ctx.content.rules.tenderThreshold, tolerancePct: ctx.content.rules.tolerancePct, awardRule: ctx.content.rules.awardApproval || 'always', availability: ctx.availability, procurement: {} };
  /* الحاجة العاجلة تقصّر المهل ولا تغيّر المسار (ق-13) */
  const steps = info.urgent ? built.steps.map((s) => (s.slaHours ? { ...s, slaHours: Math.max(4, Math.round(s.slaHours / 2)) } : s)) : built.steps;
  const fields: Field[] = [
    { key: 'category', label: t2('الفئة', 'Category'), value: ctx.cat.name.ar }, { key: 'for', label: t2('لمن', 'For'), value: ctx.beneficiary.id === ctx.requester.id ? 'لي' : ctx.beneficiary.name },
    { key: 'items', label: t2('البنود', 'Items'), value: lines.map((l) => `${l.name.ar} × ${l.qty}`).join('، ') }, { key: 'why', label: t2('المبرر', 'Reason'), value: input.justification },
    ...(info.estimatedValue ? [{ key: 'est', label: indicative && !input.estimatedValue ? t2('القيمة الاسترشادية', 'Indicative value') : t2('القيمة التقديرية', 'Estimated value'), value: String(info.estimatedValue) }] : []), ...(info.urgent ? [{ key: 'urgent', label: t2('عاجل', 'Urgent'), value: 'نعم' }] : []),
  ];
  let [s, r] = createRequest(state, { serviceId: 'AS-01', requesterId: input.requesterId, at, attachment: input.attachment, steps, notApplied: built.notApplied, policyVersion: version.number, fields, need: info });
  if (ctx.beneficiary.id !== ctx.requester.id) {
    s = notifyPeople(s, [ctx.beneficiary.id], { kind: 'status', at, link: `#/requests/${r.id}`, title: t2(`طلب لك ${first(ctx.requester.name)}: ${lines[0].name.ar}${lines.length > 1 ? ` و${lines.length - 1} أخرى` : ''}`, `${first(ctx.requester.nameEn)} requested for you: ${lines[0].name.en}${lines.length > 1 ? ` and ${lines.length - 1} more` : ''}`), body: t2(`${r.id} · ستتابع رحلته هنا وتوقّع استلامه عند التسليم.`, `${r.id} · follow its journey here and sign the receipt on delivery.`) });
    r = s.requests.find((x) => x.id === r.id)!;
  }
  return [s, r];
}

/* ——— القرارات والمهام الخاصة بالاحتياج ——— */
const curStep = (r: Request) => r.steps.find((x) => x.status === 'current');
const num = (n: number) => n.toLocaleString('en');
function withNeed(state: State, id: string, f: (n: NeedInfo) => NeedInfo): State { return patchRequest(state, id, (r) => ({ ...r, need: r.need ? f(r.need) : r.need })); }

/* ——— v0.10: تحديد الصنف — الجهة الفنية في مهمتها (أو المستودع حين لا جهة): رقم صنف من السجل الرئيسي أو بند نصي بمجموعة أصناف، والكمية والسعر التقديري ——— */
export interface SpecInput { lineId: string; itemId?: string; text?: string; materialGroup?: string; qty?: number; unitPrice?: number }
function applySpecs(state: State, lines: NeedLine[], specs: SpecInput[], actorId: string, at: number): NeedLine[] {
  return lines.map((l) => {
    const sp = specs.find((x) => x.lineId === l.id); if (!sp) return l;
    const item = sp.itemId ? state.erp.items.find((x) => x.id === sp.itemId) : undefined;
    const name: T2 = item ? item.name : sp.text ? t2(sp.text, sp.text) : l.name;
    /* ما طلبه الطالب يبقى بجانب ما حُدِّد: كلماته الحرة، أو اسم بند الكتالوج إن اختلف عن اسم الصنف في السجل الرئيسي */
    return { ...l, itemId: item?.id, name, asked: l.asked || (name.ar !== l.name.ar ? l.name : undefined), materialGroup: item ? undefined : sp.materialGroup || l.materialGroup, qty: sp.qty && sp.qty > 0 ? sp.qty : l.qty, unit: item ? item.unit : l.unit, unitPrice: sp.unitPrice ?? item?.price ?? l.unitPrice, specifiedBy: actorId, specifiedAt: at };
  });
}
const specText = (lines: NeedLine[], lang: 'ar' | 'en') => lines.map((l) => `${lang === 'ar' ? l.name.ar : l.name.en} × ${l.qty}${l.itemId ? ` (${l.itemId})` : l.materialGroup ? ` (${lang === 'ar' ? 'مجموعة' : 'group'} ${l.materialGroup})` : ''}${l.unitPrice ? ` ≈ ${(l.unitPrice * l.qty).toLocaleString('en')}` : ''}`).join(lang === 'ar' ? '، ' : ', ');
/** v0.11: مرفق في ملف الشراء بمحطته (مواصفات، عرض مورّد، محضر مناقصات، توصية، استلام) */
function addDoc(state: State, requestId: string, title: string, stage: T2, by: string, at: number): State {
  return patchRequest(state, requestId, (r) => ({ ...r, docs: [...r.docs, { id: `D-${r.id}-${r.docs.length + 1}`, kind: 'attachment', title: t2(title, title), at, stage, by } as Doc] }));
}
/** الجهة الفنية: تعتمد الطلب وتحدد الصنف في الخطوة نفسها (ق-16)؛ التقدير يُحدَّث من الأسعار؛ ثم تُعتمد الخطوة بالقرار العادي؛ v0.11: مرفق المواصفات اختياري */
export function specifyDecision(state: State, requestId: string, actorId: string, input: { specs: SpecInput[]; note?: string; attachment?: string }, at = Date.now()): State {
  const r = state.requests.find((x) => x.id === requestId); const st = r ? curStep(r) : undefined; if (!r || !r.need || !st || st.role !== 'entity') return state;
  const lines = applySpecs(state, r.need.lines, input.specs, actorId, at); const est = linesValue(lines) || r.need.estimatedValue;
  let s = withNeed(state, requestId, (n) => ({ ...n, lines, estimatedValue: est }));
  if (input.attachment) s = addDoc(s, requestId, input.attachment, t2('المواصفات (الجهة الفنية)', 'Specifications (technical entity)'), actorId, at);
  s = auditLine(s, requestId, actorId, t2(`حُدِّد الصنف: ${specText(lines, 'ar')}${input.attachment ? ` — مرفق: ${input.attachment}` : ''}`, `Items identified: ${specText(lines, 'en')}${input.attachment ? ` — attachment: ${input.attachment}` : ''}`), at);
  s = decide(s, requestId, 'approve', actorId, input.note, at);
  const req = s.requests.find((x) => x.id === requestId)!; const actor = personById(s, actorId); const entity = entityOf(needContent(s, toISO(at)), req.need!.entityId);
  return notifyPeople(s, Array.from(new Set([req.requesterId, req.need!.beneficiaryId])), { kind: 'status', at, link: `#/requests/${req.id}`, title: t2(`حدّدت ${entity?.name.ar || actor?.name || ''} صنف احتياجك`, `${entity?.name.en || actor?.nameEn || ''} identified your need's items`), body: t2(`${req.id} · ${specText(lines, 'ar')}${est ? ` · التقدير ${est.toLocaleString('en')} ريال` : ''}`, `${req.id} · ${specText(lines, 'en')}${est ? ` · estimate SAR ${est.toLocaleString('en')}` : ''}`) });
}

/* ——— v0.11 (D-023): الجهة الفنية توفّر الاحتياج من رصيدها — خطوة قرار بنتيجة كالمستودع: لا مشتريات ولا موازنة، تسليم توقّعه الجهة ثم المستفيد، وعهدة رقمية إن كان الرصيد عهدة ——— */
export interface ProvideInput { items: { lineId: string; poolId: string; ref?: string }[]; note?: string }
export function provideDecision(state: State, requestId: string, actorId: string, input: ProvideInput, at = Date.now()): State {
  const r = state.requests.find((x) => x.id === requestId); const st = r ? curStep(r) : undefined; if (!r || !r.need || !st || st.role !== 'entity') return state;
  const content = needContent(state, toISO(at)); const today = toISO(at);
  const picks = r.need.lines.map((l) => { const it = input.items.find((x) => x.lineId === l.id); const pool = it ? poolOf(content, it.poolId) : undefined; return { line: l, pool, ref: it?.ref }; });
  if (picks.some((x) => !x.pool || x.pool.entityId !== r.need!.entityId || x.pool.endedAt && x.pool.endedAt <= today)) return state;
  /* الرصيد يكفي لكل بند (بالمجموع لكل رصيد) */
  const needBy: Record<string, number> = {}; picks.forEach((x) => { needBy[x.pool!.id] = (needBy[x.pool!.id] || 0) + x.line.qty; });
  if (Object.entries(needBy).some(([pid, q]) => poolStock(state, poolOf(content, pid)) < q)) return state;
  let s = state; let seq = s.erpSeq || 0; let erp = { ...s.erp };
  const pools: NonNullable<NeedInfo['provision']>['pools'] = [];
  const lines = picks.map(({ line, pool, ref }) => {
    let releaseOrderNo: string | undefined; let provisionRef = ref;
    if (pool!.erpKind === 'portal') { erp = { ...erp, poolStock: (erp.poolStock || []).map((x) => (x.poolId === pool!.id ? { ...x, qty: Math.max(0, x.qty - line.qty) } : x)) }; }
    else if (pool!.erpKind === 'material') { erp = { ...erp, stock: erp.stock.map((x) => (x.itemId === pool!.itemId && x.storeId === pool!.storeId ? { ...x, qty: Math.max(0, x.qty - line.qty) } : x)) }; }
    else if (pool!.erpKind === 'contract') { seq += 1; releaseOrderNo = `${4500012800 + seq}`; const value = (pool!.unitPrice || 0) * line.qty; erp = { ...erp, contracts: (erp.contracts || []).map((c) => (c.id === pool!.contractId ? { ...c, consumed: c.consumed + value } : c)) }; provisionRef = provisionRef || releaseOrderNo; }
    pools.push({ poolId: pool!.id, name: pool!.name, qty: line.qty, ref: provisionRef, erpKind: pool!.erpKind, releaseOrderNo });
    return { ...line, status: 'provided' as const, poolId: pool!.id, provisionRef, unitPrice: line.unitPrice ?? pool!.unitPrice };
  });
  s = { ...s, erp, erpSeq: seq };
  s = withNeed(s, requestId, (n) => ({ ...n, lines, estimatedValue: linesValue(lines) || n.estimatedValue, provision: { by: actorId, at, note: input.note, pools } }));
  const entity = entityOf(content, r.need.entityId); const actor = personById(s, actorId);
  const txt = (lang: 'ar' | 'en') => pools.map((p) => `${lang === 'ar' ? p.name.ar : p.name.en} × ${p.qty}${p.erpKind === 'contract' && p.releaseOrderNo ? (lang === 'ar' ? ` (أمر تنفيذ ${p.releaseOrderNo} على العقد ${poolOf(content, p.poolId)?.contractId})` : ` (release order ${p.releaseOrderNo} against contract ${poolOf(content, p.poolId)?.contractId})`) : p.ref ? ` (${p.ref})` : ''}${lang === 'ar' ? ` — المتبقي ${poolStock(s, poolOf(content, p.poolId))}` : ` — remaining ${poolStock(s, poolOf(content, p.poolId))}`}`).join(lang === 'ar' ? '، ' : ', ');
  s = completeCurrent(s, requestId, actorId, t2(`متوفر لدى ${entity?.name.ar || 'الجهة الفنية'} ووُفِّر من رصيدها: ${txt('ar')}${input.note ? ` — ${input.note}` : ''}`, `Available with ${entity?.name.en || 'the technical entity'} and provided from its pool: ${txt('en')}${input.note ? ` — ${input.note}` : ''}`), at, { outcome: 'provided', note: input.note });
  /* ما بعد التسليم من رصيد الجهة (المستودع والشراء والموازنة) يُتخطى الآن لا لاحقاً حتى يرى الطالب رحلته القصيرة فوراً */
  const skipWhy = t2('وُفِّر الاحتياج من رصيد الجهة الفنية؛ لا حاجة إلى هذه الخطوة', 'The need was provided from the technical entity pool; this step is not needed');
  s = patchRequest(s, requestId, (x) => { const skipped = x.steps.filter((y) => y.status === 'pending' && y.branch !== 'provided' && y.key !== 'sys'); return skipped.length ? { ...x, steps: x.steps.map((y) => (skipped.includes(y) ? { ...y, status: 'skipped' as const, at, note: skipWhy.ar } : y)), audit: [...x.audit, { at, who: 'system', what: t2(`تُخُطِّيت ${skipped.length} خطوات (${skipped.map((y) => y.title.ar).slice(0, 3).join('، ')}…): ${skipWhy.ar}`, `${skipped.length} steps skipped (${skipped.map((y) => y.title.en).slice(0, 3).join(', ')}…): ${skipWhy.en}`) }] } : x; });
  /* الجهة الفنية هي المسلِّم: توقّع الآن وتتحول الخطوة إلى توقيع المستفيد */
  const req = s.requests.find((x) => x.id === requestId)!;
  if (curStep(req)?.role === 'handover' && curStep(req)?.branch === 'provided') s = handoverStart(s, requestId, actorId, at);
  const who = Array.from(new Set([req.requesterId, req.need!.beneficiaryId]));
  return notifyPeople(s, who, { kind: 'status', at, link: `#/requests/${req.id}`, title: t2(`متوفر لدى ${entity?.name.ar || 'الجهة الفنية'}: يُسلَّم لك بلا شراء`, `Available with ${entity?.name.en || 'the technical entity'}: handed to you without a purchase`), body: t2(`${req.id} · ${pools.map((p) => `${p.name.ar} × ${p.qty}`).join('، ')} · وفّره ${actor?.name || ''} من رصيد الجهة؛ وقّع الاستلام.`, `${req.id} · ${pools.map((p) => `${p.name.en} × ${p.qty}`).join(', ')} · provided by ${actor?.nameEn || ''} from the entity pool; sign the receipt.`) });
}
/** v0.11: «ليست من اختصاصنا» — تحويل الاحتياج إلى جهة فنية أخرى بتغيير الفئة (من النوع نفسه)؛ الخطوة نفسها تنتقل إلى الجهة الجديدة وتُعاد تسوية الخطوات المعلّقة التي تعتمد على الفئة (المستودع، والمقيّم، والاستلام، والتسليم) */
export function rerouteDecision(state: State, requestId: string, actorId: string, input: { categoryId: string; note: string }, at = Date.now()): State {
  const r = state.requests.find((x) => x.id === requestId); const st = r ? curStep(r) : undefined; if (!r || !r.need || !st || st.role !== 'entity') return state;
  const today = toISO(at); const content = needContent(state, today); const from = categoryOf(content, r.need.categoryId); const to = categoryOf(content, input.categoryId);
  if (!from || !to || to.id === from.id || to.kind !== from.kind || !to.entityId) return state;
  const ctx = buildNeedCtx(state, { requesterId: r.requesterId, beneficiaryId: r.need.beneficiaryId, categoryId: to.id, catalogIds: r.need.lines.map((l) => l.catalogId).filter((x): x is string => !!x) }, today); if (!ctx || !ctx.entity) return state;
  const requester = personById(state, r.requesterId)!;
  const steps = r.steps.map((x) => {
    if (x.status !== 'current' && x.status !== 'pending') return x;
    if (!x.role || !['entity', 'store', 'evaluator', 'receipt', 'handover'].includes(x.role)) return x;
    if (x.role === 'handover' && x.branch === 'provided') { const res = resolveAgent(state, requester, ctx.entity!.agent); return { ...x, agent: ctx.entity!.agent, assigneeIds: res.personIds, positionIds: res.positionIds }; }
    const agent = agentFor(state, x.role, ctx, today); if (!agent) return x;
    const res = resolveAgent(state, requester, agent); if (res.skipped) return x;
    return { ...x, agent, assigneeIds: res.personIds, positionIds: res.positionIds, why: x.role === 'entity' ? t2(`حُوِّل من ${from.name.ar}: ${input.note}`, `Re-routed from ${from.name.en}: ${input.note}`) : res.why };
  });
  let s = patchRequest(state, requestId, (x) => ({ ...x, steps, updatedAt: at, fields: x.fields.map((f) => (f.key === 'category' ? { ...f, value: to.name.ar } : f)) }));
  s = withNeed(s, requestId, (n) => ({ ...n, categoryId: to.id, entityId: ctx.entity?.id, storeId: ctx.store?.id, availability: ctx.availability, lines: n.lines.map((l) => ({ ...l, storeId: ctx.store?.id, status: l.status === 'open' || l.status === 'purchasing' ? (ctx.store ? 'open' as const : 'purchasing' as const) : l.status })), rerouted: [...(n.rerouted || []), { by: actorId, at, fromCategoryId: from.id, toCategoryId: to.id, note: input.note }] }));
  const actor = personById(s, actorId); const fromEntity = entityOf(content, from.entityId);
  s = auditLine(s, requestId, actorId, t2(`حُوِّل الاحتياج من «${from.name.ar}» (${fromEntity?.name.ar || ''}) إلى «${to.name.ar}» (${ctx.entity.name.ar}): ${input.note}`, `Re-routed from “${from.name.en}” (${fromEntity?.name.en || ''}) to “${to.name.en}” (${ctx.entity.name.en}): ${input.note}`), at);
  const req = s.requests.find((x) => x.id === requestId)!; const cur = curStep(req);
  s = notifyPeople(s, cur?.assigneeIds || [], { kind: 'task', at, link: '#/inbox', title: t2(`احتياج حُوِّل إليكم من ${fromEntity?.name.ar || actor?.name || ''}`, `A need re-routed to you from ${fromEntity?.name.en || actor?.nameEn || ''}`), body: t2(`${req.id} · ${input.note}`, `${req.id} · ${input.note}`) });
  return notifyPeople(s, [req.requesterId], { kind: 'status', at, link: `#/requests/${req.id}`, title: t2(`حُوِّل احتياجك إلى ${ctx.entity.name.ar}`, `Your need was re-routed to ${ctx.entity.name.en}`), body: t2(`${req.id} · ${input.note} · الفئة الآن: ${to.name.ar}.`, `${req.id} · ${input.note} · category now: ${to.name.en}.`) });
}

/** خطوة المستودع (قرار بنتيجة): لكل بند حجز من المخزون أو تحويل إلى الشراء؛ الحجز يُنشئ مستند حجز في النظام المرجعي ويخصم من المتاح؛ وحين لا جهة فنية (أو لتصحيح التحديد) يحدد المستودع الصنف هنا (ق.ت-12) */
export function storeDecision(state: State, requestId: string, actorId: string, decisions: { lineId: string; action: 'reserve' | 'purchase' }[], at = Date.now(), note?: string, specs?: SpecInput[]): State {
  const r = state.requests.find((x) => x.id === requestId); const st = r ? curStep(r) : undefined; if (!r || !r.need || !st || st.role !== 'store') return state;
  let s = state; let stock = s.erp.stock.slice(); let seq = s.erpSeq || 0;
  const base = specs && specs.length ? applySpecs(state, r.need.lines, specs, actorId, at) : r.need.lines;
  const lines = base.map((l) => {
    const d = decisions.find((x) => x.lineId === l.id); if (!d) return l;
    if (d.action === 'reserve') { const i = stock.findIndex((x) => x.itemId === l.itemId && x.storeId === l.storeId); if (i >= 0) stock[i] = { ...stock[i], qty: Math.max(0, stock[i].qty - l.qty) }; seq += 1; return { ...l, status: 'reserved' as const, reservationNo: `${20000400 + seq}` }; }
    return { ...l, status: 'purchasing' as const };
  });
  s = { ...s, erp: { ...s.erp, stock }, erpSeq: seq };
  s = withNeed(s, requestId, (n) => ({ ...n, lines, estimatedValue: linesValue(lines) || n.estimatedValue }));
  if (specs && specs.length) s = auditLine(s, requestId, actorId, t2(`حدّد المستودع الصنف: ${specText(lines, 'ar')}`, `Store identified the items: ${specText(lines, 'en')}`), at);
  const reserved = lines.filter((l) => l.status === 'reserved'); const buying = lines.filter((l) => l.status === 'purchasing');
  const outcome = reserved.length && buying.length ? 'partial' : reserved.length ? 'available' : 'unavailable';
  const what: T2 = outcome === 'available' ? t2(`متوفر في المستودع وحُجز: ${reserved.map((l) => `${l.name.ar} × ${l.qty} (حجز ${l.reservationNo})`).join('، ')}`, `Available and reserved: ${reserved.map((l) => `${l.name.en} × ${l.qty} (reservation ${l.reservationNo})`).join(', ')}`)
    : outcome === 'unavailable' ? t2(`غير متوفر في المستودع؛ تحوّل إلى الشراء: ${buying.map((l) => `${l.name.ar} × ${l.qty}`).join('، ')}`, `Not in stock; converted to purchase: ${buying.map((l) => `${l.name.en} × ${l.qty}`).join(', ')}`)
    : t2(`توفر جزئي: حُجز ${reserved.map((l) => l.name.ar).join('، ')} وتحوّل إلى الشراء ${buying.map((l) => l.name.ar).join('، ')}`, `Partly available: reserved ${reserved.map((l) => l.name.en).join(', ')}; to purchase ${buying.map((l) => l.name.en).join(', ')}`);
  s = completeCurrent(s, requestId, actorId, what, at, { outcome, note });
  const req = s.requests.find((x) => x.id === requestId)!; const store = storeOf(needContent(s, toISO(at)), req.need!.storeId);
  const who = Array.from(new Set([req.requesterId, req.need!.beneficiaryId]));
  if (reserved.length) s = notifyPeople(s, who, { kind: 'status', at, link: `#/requests/${req.id}`, title: t2(`متوفر في ${store?.name.ar || 'المستودع'} وحُجز لك`, `Available at ${store?.name.en || 'the store'} and reserved for you`), body: t2(`${reserved.map((l) => `${l.name.ar} × ${l.qty}`).join('، ')} · ${req.id} · جاهز للتسليم قريباً.`, `${reserved.map((l) => `${l.name.en} × ${l.qty}`).join(', ')} · ${req.id} · ready for handover soon.`) });
  if (buying.length) s = notifyPeople(s, who, { kind: 'status', at, link: `#/requests/${req.id}`, title: t2(`تحوّل إلى الشراء: ${buying.map((l) => l.name.ar).join('، ')}`, `Converted to purchase: ${buying.map((l) => l.name.en).join(', ')}`), body: t2(`لم يتوفر في ${store?.name.ar || 'المستودع'}؛ ${req.id} الآن عند مكتب المشتريات.`, `Not in stock at ${store?.name.en || 'the store'}; ${req.id} is now with procurement.`) });
  return s;
}

/* ——— فرع الشراء المنقّح (AS-01 2.0) ——— */
/** إعادة تسوية خطوة اعتماد (الشراء أو الترسية) بالشريحة التي تغطي القيمة (D-020، D-021) */
function rebandStep(state: State, requestId: string, role: 'purchaseApproval' | 'awardApproval', amount: number, higher: boolean, at: number): State {
  const r = state.requests.find((x) => x.id === requestId); if (!r || !r.need) return state;
  const content = needContent(state, toISO(at)); const band = bandFor(content, amount, toISO(at), higher); if (!band) return state;
  const requester = personById(state, r.requesterId)!; const res = resolveAgent(state, requester, band.agent);
  const why = t2(`${band.name.ar} — القيمة ${amount.toLocaleString('en')} ريال${higher ? ' (الشريحة الأعلى لأن طريقة الشراء تستلزمها)' : ''} — ${res.why.ar}`, `${band.name.en} — value SAR ${amount.toLocaleString('en')}${higher ? ' (higher band required by the purchase method)' : ''} — ${res.why.en}`);
  let s = patchRequest(state, requestId, (x) => ({ ...x, steps: x.steps.map((y) => (y.role === role && y.status === 'pending' ? { ...y, agent: band.agent, assigneeIds: res.personIds, positionIds: res.positionIds, quorum: band.agent.quorum || 'any', why } : y)) }));
  s = withNeed(s, requestId, (n) => ({ ...n, procurement: { ...(n.procurement || {}), [role === 'purchaseApproval' ? 'band' : 'awardBand']: { id: band.id, name: band.name, upTo: band.upTo } } }));
  return s;
}
export interface PrepareInput { estimatedValue: number; methodId: string; methodWhy: string; contractNo?: string; purchaseFile?: string; evaluatorPersonIds: string[]; evaluatorWhy: string; note?: string }
/** v0.11 (ق-08): تنبيه منع التجزئة — احتياجات من القطاع نفسه والفئة نفسها خلال نافذة الأيام، يقترب مجموعها (مع هذا الاحتياج) من شريحة صلاحيات أعلى أو من عتبة المناقصات بينما لا يبلغها الاحتياج وحده */
export function splitAlertFor(state: State, r: Request, estimatedValue: number, today: string): { ids: string[]; total: number; days: number; band?: T2 } | null {
  if (!r.need) return null; const content = needContent(state, today); const days = content.rules.splitAlertDays || 0; if (!days) return null;
  const requester = personById(state, r.requesterId); if (!requester) return null; const sector = sectorOf(state, requester)?.id;
  const since = r.createdAt - days * 86400000;
  const siblings = state.requests.filter((x) => x.id !== r.id && x.need && x.need.categoryId === r.need!.categoryId && x.createdAt >= since && x.status !== 'withdrawn' && x.status !== 'rejected' && x.need.lines.some((l) => l.status === 'purchasing' || l.status === 'received' || l.status === 'delivered') && !!x.need.procurement?.preparedAt && (() => { const p = personById(state, x.requesterId); return !!p && sectorOf(state, p)?.id === sector; })());
  if (!siblings.length) return null;
  const total = siblings.reduce((n, x) => n + (x.need!.procurement?.estimatedValue || x.need!.estimatedValue || 0), 0) + estimatedValue;
  const alone = bandFor(content, estimatedValue, today); const together = bandFor(content, total, today); const threshold = r.need.tenderThreshold ?? content.rules.tenderThreshold;
  const crosses = (alone && together && alone.id !== together.id) || (estimatedValue <= threshold && total > threshold);
  return crosses ? { ids: siblings.map((x) => x.id), total, days, band: together?.name } : null;
}
/** مكتب المشتريات: تجهيز الشراء — التقدير النهائي وطريقة الشراء (حرية المكتب بسبب) والعقد الإطاري (من قائمة عقود النظام المرجعي، P-10) والدمج في ملف شراء والمقيّم؛ ثم تُسوَّى خطوتا الاعتماد بجدول الصلاحيات؛ v0.11: تنبيه التجزئة يُسجَّل ويراه المعتمد */
export function procurementDecision(state: State, requestId: string, actorId: string, input: PrepareInput, at = Date.now()): State {
  const r = state.requests.find((x) => x.id === requestId); const st = r ? curStep(r) : undefined; if (!r || !r.need || !st || st.role !== 'procurement') return state;
  const content = needContent(state, toISO(at)); const m = methodOf(content, input.methodId); if (!m) return state;
  const overThreshold = input.estimatedValue > (r.need.tenderThreshold ?? content.rules.tenderThreshold);
  const flags = { offers: m.offers && !overThreshold, minOffers: Math.max(m.minOffers, m.offers ? 1 : 0), tender: m.tender || overThreshold, contract: m.contract && !overThreshold, higherBand: m.higherBand };
  if (flags.contract && (!input.contractNo || !(state.erp.contracts || []).some((c) => c.id === input.contractNo))) return state;
  const file = input.purchaseFile || `PF-${String(r.id).slice(-4)}`;
  const split = splitAlertFor(state, r, input.estimatedValue, toISO(at));
  let s = withNeed(state, requestId, (n) => ({ ...n, estimatedValue: input.estimatedValue, procurement: { ...(n.procurement || {}), estimatedValue: input.estimatedValue, method: m.id, methodName: m.name, methodFlags: flags, methodWhy: input.methodWhy, contractNo: flags.contract ? input.contractNo : undefined, purchaseFile: file, preparedAt: at, evaluator: flags.offers ? { personIds: input.evaluatorPersonIds, why: input.evaluatorWhy, at } : undefined, tender: flags.tender ? { referred: true, at } : undefined, splitAlert: split ? { ...split, at } : undefined } }));
  if (split) s = auditLine(s, requestId, 'system', t2(`تنبيه التجزئة (ق-08): مع ${split.ids.join('، ')} خلال ${split.days} يوماً يبلغ المجموع ${split.total.toLocaleString('en')} ريال${split.band ? ` — شريحة «${split.band.ar}»` : ''}؛ يقرر المعتمد`, `Split alert (ق-08): with ${split.ids.join(', ')} within ${split.days} days the total reaches SAR ${split.total.toLocaleString('en')}${split.band ? ` — band “${split.band.en}”` : ''}; the approver decides`), at);
  if (flags.offers) s = patchRequest(s, requestId, (x) => ({ ...x, steps: x.steps.map((y) => (y.role === 'evaluator' && y.status === 'pending' ? { ...y, assigneeIds: input.evaluatorPersonIds, positionIds: [], agent: { kind: 'positions', positionIds: [], quorum: 'any' }, why: t2(`عيّنه مكتب المشتريات: ${input.evaluatorWhy}`, `Named by procurement: ${input.evaluatorWhy}`) } : y)) }));
  s = rebandStep(s, requestId, 'purchaseApproval', input.estimatedValue, flags.higherBand, at);
  s = rebandStep(s, requestId, 'awardApproval', input.estimatedValue, flags.higherBand, at);
  const evalNames = input.evaluatorPersonIds.map((id) => personById(s, id)).filter((p): p is Person => !!p);
  const what = t2(`جُهِّز الشراء: التقدير ${num(input.estimatedValue)} ريال، الطريقة «${m.name.ar}»${flags.tender && !m.tender ? ' (فوق عتبة المناقصات فصارت مناقصة)' : ''} — ${input.methodWhy}${flags.contract && input.contractNo ? `؛ العقد ${input.contractNo}` : ''}${input.purchaseFile ? `؛ دُمج في ملف الشراء ${file}` : ''}${flags.offers ? `؛ المقيّم: ${evalNames.map((p) => p.name).join('، ')} — ${input.evaluatorWhy}` : ''}`, `Purchase prepared: estimate SAR ${num(input.estimatedValue)}, method “${m.name.en}”${flags.tender && !m.tender ? ' (above the tender threshold, so a tender)' : ''} — ${input.methodWhy}${flags.contract && input.contractNo ? `; contract ${input.contractNo}` : ''}${input.purchaseFile ? `; merged into purchase file ${file}` : ''}${flags.offers ? `; evaluator: ${evalNames.map((p) => p.nameEn).join(', ')} — ${input.evaluatorWhy}` : ''}`);
  s = completeCurrent(s, requestId, actorId, what, at, { ref: file, note: input.note });
  const req = s.requests.find((x) => x.id === requestId)!; const who = Array.from(new Set([req.requesterId, req.need!.beneficiaryId]));
  return notifyPeople(s, who, { kind: 'status', at, link: `#/requests/${req.id}`, title: t2(`تسلّم مكتب المشتريات احتياجك: ${m.name.ar}`, `Procurement took up your need: ${m.name.en}`), body: t2(`${req.id} · التقدير ${num(input.estimatedValue)} ريال · الخطوة الآن: اعتماد الشراء.`, `${req.id} · estimate SAR ${num(input.estimatedValue)} · now: purchase approval.`) });
}
/** الموازنة: الاعتماد المبدئي بحجز الاعتماد (مستند الأموال المخصّصة في PSM-FM) بمبلغ التقدير؛ وزيادة الحجز حين يتجاوز العرض الفائز المحجوز بأكثر من التسامح */
export function budgetDecision(state: State, requestId: string, actorId: string, ref: string, at = Date.now(), note?: string, amount?: number): State {
  const r = state.requests.find((x) => x.id === requestId); const st = r ? curStep(r) : undefined; if (!r || !r.need || !st || (st.role !== 'budget' && st.role !== 'budgetTopUp')) return state;
  const p = r.need.procurement || {}; const topUp = st.role === 'budgetTopUp';
  const amt = amount ?? (topUp ? p.recommendation?.amount ?? p.estimatedValue ?? 0 : p.estimatedValue ?? r.need.estimatedValue ?? 0);
  let s = withNeed(state, requestId, (n) => ({ ...n, procurement: { ...(n.procurement || {}), budgetRef: topUp ? n.procurement?.budgetRef || ref : ref, reservation: topUp && n.procurement?.reservation ? { ...n.procurement.reservation, amount: amt, topUps: [...(n.procurement.reservation.topUps || []), { at, from: n.procurement.reservation.amount, to: amt, no: ref || undefined }] } : { no: ref, amount: amt, at } } }));
  s = decide(s, requestId, 'approve', actorId, note, at, ref);
  const req = s.requests.find((x) => x.id === requestId)!; const tender = branchActive(req, 'tender');
  const who = Array.from(new Set([req.requesterId, req.need!.beneficiaryId]));
  if (topUp) return notifyPeople(s, who, { kind: 'status', at, link: `#/requests/${req.id}`, title: t2(`زادت الموازنة حجز الاعتماد إلى ${num(amt)} ريال`, `Budget raised the reservation to SAR ${num(amt)}`), body: t2(`${req.id} · الخطوة الآن: اعتماد الترسية.`, `${req.id} · now: award approval.`) });
  return notifyPeople(s, who, { kind: 'status', at, link: `#/requests/${req.id}`, title: t2(`حُجز اعتماد احتياجك: ${num(amt)} ريال`, `Funds reserved for your need: SAR ${num(amt)}`), body: tender ? t2(`${req.id} · حجز الاعتماد ${ref} · أُحيل إلى إجراء المناقصات.`, `${req.id} · reservation ${ref} · referred to the tender procedure.`) : req.need!.procurement?.methodFlags?.offers ? t2(`${req.id} · حجز الاعتماد ${ref} · الخطوة الآن: جمع العروض.`, `${req.id} · reservation ${ref} · now: collecting offers.`) : t2(`${req.id} · حجز الاعتماد ${ref} · الخطوة الآن: طلب الشراء من العقد.`, `${req.id} · reservation ${ref} · now: requisition from the contract.`) });
}
/** مكتب المشتريات: تسجيل العروض (المورّد من قائمة النظام المرجعي أو جديد، والقيمة بعملتها ومعادلها بالريال، والصلاحية، ومرفق العرض) بعددها الأدنى بحسب الطريقة؛ v0.11 (D-025): عروض أقل من الحد بمبرر تصعد اعتماد الترسية إلى الشريحة الأعلى */
export function quotesDecision(state: State, requestId: string, actorId: string, input: { offers: NeedOffer[]; note?: string; shortfallWhy?: string }, at = Date.now()): State {
  const r = state.requests.find((x) => x.id === requestId); const st = r ? curStep(r) : undefined; if (!r || !r.need || !st || st.role !== 'quotes') return state;
  const content = needContent(state, toISO(at)); const suppliers = state.erp.suppliers || [];
  const list = input.offers.filter((o) => o.supplier.trim() && o.amount > 0).map((o) => { const sup = o.supplierId ? suppliers.find((x) => x.id === o.supplierId) : undefined; return { ...o, supplier: sup ? sup.name.ar : o.supplier.trim(), currency: o.currency || 'SAR' }; });
  const min = r.need.procurement?.methodFlags?.minOffers || 1; const shortfall = list.length < min;
  if (!list.length || (shortfall && !(input.shortfallWhy || '').trim()) || (content.rules.offerAttachmentRequired && list.some((o) => !o.attachment))) return state;
  let s = withNeed(state, requestId, (n) => ({ ...n, procurement: { ...(n.procurement || {}), offers: { count: list.length, at, note: input.note, list, shortfall: shortfall ? { min, why: input.shortfallWhy!.trim() } : undefined } } }));
  for (const o of list) if (o.attachment) s = addDoc(s, requestId, o.attachment, t2(`عرض ${o.supplier}`, `Offer: ${o.supplier}`), actorId, at);
  /* تعذر الحد الأدنى: اعتماد الترسية يصعد شريحةً كالشراء المباشر (D-025) */
  if (shortfall) s = rebandStep(s, requestId, 'awardApproval', r.need.procurement?.estimatedValue ?? r.need.estimatedValue ?? 0, true, at);
  s = completeCurrent(s, requestId, actorId, t2(`سُجِّلت العروض (${list.length}${shortfall ? ` من ${min} — بمبرر: ${input.shortfallWhy}` : ''}): ${list.map((o) => `${o.supplier}${o.supplierNew ? ' (مورّد جديد يُنشأ في النظام المرجعي قبل أمر الشراء)' : o.supplierId ? ` (${o.supplierId})` : ''} — ${num(o.amount)} ريال${o.currency && o.currency !== 'SAR' && o.fxAmount ? ` (${num(o.fxAmount)} ${o.currency})` : ''}${o.attachment ? ` · مرفق ${o.attachment}` : ''}`).join('، ')}`, `Offers recorded (${list.length}${shortfall ? ` of ${min} — justified: ${input.shortfallWhy}` : ''}): ${list.map((o) => `${o.supplier}${o.supplierNew ? ' (new supplier, to be created in the system of record before the PO)' : o.supplierId ? ` (${o.supplierId})` : ''} — SAR ${num(o.amount)}${o.currency && o.currency !== 'SAR' && o.fxAmount ? ` (${num(o.fxAmount)} ${o.currency})` : ''}${o.attachment ? ` · attachment ${o.attachment}` : ''}`).join(', ')}`), at, { note: input.note });
  const req = s.requests.find((x) => x.id === requestId)!; const ev = (req.need!.procurement?.evaluator?.personIds || []).map((id) => personById(s, id)).filter((p): p is Person => !!p);
  return notifyPeople(s, [req.requesterId], { kind: 'status', at, link: `#/requests/${req.id}`, title: t2(`طُلبت العروض لاحتياجك وسُجِّل ${list.length}`, `Offers requested for your need; ${list.length} recorded`), body: t2(`${req.id} · يقيّمها: ${ev.map((p) => first(p.name)).join('، ')}.`, `${req.id} · evaluated by: ${ev.map((p) => first(p.nameEn)).join(', ')}.`) });
}
/** المقيّم: يوصي بعرض من المسجَّلة ويكتب مبرره؛ تُعاد تسوية اعتماد الترسية بقيمة العرض */
export function evaluationDecision(state: State, requestId: string, actorId: string, input: { offer: string; amount?: number; note: string; attachment?: string }, at = Date.now()): State {
  const r = state.requests.find((x) => x.id === requestId); const st = r ? curStep(r) : undefined; if (!r || !r.need || !st || st.role !== 'evaluator') return state;
  const listed = r.need.procurement?.offers?.list?.find((o) => o.supplier === input.offer); const amount = input.amount ?? listed?.amount;
  let s = withNeed(state, requestId, (n) => ({ ...n, procurement: { ...(n.procurement || {}), recommendation: { by: actorId, at, offer: input.offer, amount, note: input.note, attachment: input.attachment } } }));
  if (input.attachment) s = addDoc(s, requestId, input.attachment, t2('التوصية الفنية', 'Technical recommendation'), actorId, at);
  if (amount) s = rebandStep(s, requestId, 'awardApproval', amount, !!r.need.procurement?.methodFlags?.higherBand || !!r.need.procurement?.offers?.shortfall, at);
  /* v0.11 (D-024): الانحرافات تُحسب الآن وتُحفظ ليراها المعتمد (أو ليُعتمد آلياً في المحرك) */
  const req0 = s.requests.find((x) => x.id === requestId)!; const dev = awardDeviations(req0);
  s = withNeed(s, requestId, (n) => ({ ...n, procurement: { ...(n.procurement || {}), awardWhy: dev.length ? dev : undefined, awardAuto: undefined } }));
  s = completeCurrent(s, requestId, actorId, t2(`قُيِّمت العروض والتوصية بـ: ${input.offer}${amount ? ` (${num(amount)} ريال)` : ''} — ${input.note}${input.attachment ? ` — مرفق: ${input.attachment}` : ''}`, `Offers evaluated; recommended: ${input.offer}${amount ? ` (SAR ${num(amount)})` : ''} — ${input.note}${input.attachment ? ` — attachment: ${input.attachment}` : ''}`), at, {});
  const req = s.requests.find((x) => x.id === requestId)!; const topUp = branchActive(req, 'topUp'); const auto = !!req.need?.procurement?.awardAuto;
  return notifyPeople(s, [req.requesterId], { kind: 'status', at, link: `#/requests/${req.id}`, title: t2('قُيِّمت العروض وأوصى المقيّم', 'Offers evaluated; recommendation made'), body: topUp ? t2(`${req.id} · العرض الموصى به يتجاوز المبلغ المحجوز؛ أُعيد إلى الموازنة لزيادة الحجز.`, `${req.id} · the recommended offer exceeds the reservation; back to budget for a top-up.`) : auto ? t2(`${req.id} · اعتُمدت الترسية آلياً (لا انحراف) وأُنشئ طلب الشراء.`, `${req.id} · award approved automatically (no deviation) and the requisition created.`) : t2(`${req.id} · الخطوة الآن: اعتماد الترسية${dev.length ? ` (${dev[0].ar})` : ''}.`, `${req.id} · now: award approval${dev.length ? ` (${dev[0].en})` : ''}.`) });
}
/** إجراء المناقصات (فوق العتبة أو بقرار المكتب): يُسجَّل بمرجعه ونتيجته والمورّد الفائز (من قائمة النظام المرجعي) وقيمته ومحضر اللجنة مرفقاً؛ قرار اللجنة هو الترسية فلا اعتماد ثانياً ما لم تتجاوز التسامح (D-024) */
export function tenderDecision(state: State, requestId: string, actorId: string, input: { ref: string; result: string; supplier?: string; supplierId?: string; amount?: number; attachment?: string }, at = Date.now()): State {
  const r = state.requests.find((x) => x.id === requestId); const st = r ? curStep(r) : undefined; if (!r || !r.need || !st || st.role !== 'tender') return state;
  const sup = input.supplierId ? (state.erp.suppliers || []).find((x) => x.id === input.supplierId) : undefined; const supplier = sup ? sup.name.ar : input.supplier;
  let s = withNeed(state, requestId, (n) => ({ ...n, procurement: { ...(n.procurement || {}), tender: { referred: true, ref: input.ref, result: input.result, supplier, supplierId: input.supplierId, amount: input.amount, at, attachment: input.attachment }, recommendation: supplier ? { by: actorId, at, offer: supplier, amount: input.amount, note: input.result } : n.procurement?.recommendation } }));
  if (input.attachment) s = addDoc(s, requestId, input.attachment, t2('محضر لجنة المناقصات', 'Tender committee minutes'), actorId, at);
  if (input.amount) s = rebandStep(s, requestId, 'awardApproval', input.amount, false, at);
  const req0 = s.requests.find((x) => x.id === requestId)!; const dev = awardDeviations(req0);
  s = withNeed(s, requestId, (n) => ({ ...n, procurement: { ...(n.procurement || {}), awardWhy: dev.length ? dev : undefined, awardAuto: undefined } }));
  s = completeCurrent(s, requestId, actorId, t2(`اكتمل إجراء المناقصات (${input.ref}): ${input.result}${supplier ? ` — ${supplier}${input.supplierId ? ` (${input.supplierId})` : ''}${input.amount ? ` بقيمة ${num(input.amount)} ريال` : ''}` : ''}${input.attachment ? ` — المحضر: ${input.attachment}` : ''}`, `Tender procedure completed (${input.ref}): ${input.result}${supplier ? ` — ${supplier}${input.supplierId ? ` (${input.supplierId})` : ''}${input.amount ? ` at SAR ${num(input.amount)}` : ''}` : ''}${input.attachment ? ` — minutes: ${input.attachment}` : ''}`), at, { ref: input.ref });
  const req = s.requests.find((x) => x.id === requestId)!; const auto = !!req.need?.procurement?.awardAuto;
  return notifyPeople(s, [req.requesterId], { kind: 'status', at, link: `#/requests/${req.id}`, title: t2('اكتمل إجراء المناقصات', 'Tender procedure completed'), body: auto ? t2(`${req.id} · ${input.result} · رست بقرار اللجنة وأُنشئ طلب الشراء.`, `${req.id} · ${input.result} · awarded by the committee; requisition created.`) : t2(`${req.id} · ${input.result} · الخطوة الآن: اعتماد الترسية.`, `${req.id} · ${input.result} · now: award approval.`) });
}
const DAY = 86400000;
/** v0.12 (D-028): أمر الشراء ينشئه أخصائي المشتريات في النظام المرجعي من طلب الشراء (أو العرض الفائز) والبوابة تقرؤه بمرجع طلب الشراء وتأخذ موعد التوريد منه — لا يكتب أحد رقمه؛ في النموذج الحي محاكاة النظام المرجعي؛ والإدخال اليدوي احتياط بمفتاح في القواعد */
export function poDecision(state: State, requestId: string, actorId: string, input: { poNo?: string; expectedAt?: string }, at = Date.now()): State {
  const r = state.requests.find((x) => x.id === requestId); const st = r ? curStep(r) : undefined; if (!r || !r.need || !st || st.role !== 'po') return state;
  const rules = needContent(state, toISO(at)).rules; const manual = rules.erpNumbers === 'manual';
  if (manual && !input.poNo) return state;
  const seq = (state.erpSeq || 0) + 1; const poNo = manual ? input.poNo! : `${4500012900 + seq}`;
  const expectedAt = input.expectedAt || toISO(at + (rules.leadDays || 14) * DAY); const p = r.need.procurement || {};
  let s: State = manual ? state : { ...state, erpSeq: seq };
  s = withNeed(s, requestId, (n) => ({ ...n, procurement: { ...(n.procurement || {}), poNo, poAt: at, expectedAt, expectedLog: [{ at, to: expectedAt, why: 'أمر الشراء' }], poSource: manual ? 'manual' : 'erp' } }));
  const supplier = p.award ? `${p.award.supplier}${p.award.supplierId ? ` (${p.award.supplierId})` : ''}` : '';
  s = completeCurrent(s, requestId, actorId, manual
    ? t2(`سُجِّل أمر الشراء ${poNo} يدوياً (مفتاح الإدخال اليدوي)؛ التوريد المتوقع ${expectedAt}`, `Purchase order ${poNo} recorded manually (manual-entry switch); expected delivery ${expectedAt}`)
    : t2(`أُنشئ أمر الشراء ${poNo} في النظام المرجعي مقابل طلب الشراء ${p.prNo || ''}${supplier ? ` — ${supplier}` : ''}${p.award ? ` بقيمة ${num(p.award.amount)} ريال` : ''}، وقرأته البوابة آلياً؛ التوريد المتوقع ${expectedAt}`, `Purchase order ${poNo} created in the system of record against requisition ${p.prNo || ''}${supplier ? ` — ${supplier}` : ''}${p.award ? ` at SAR ${num(p.award.amount)}` : ''}, read back by the portal; expected delivery ${expectedAt}`), at, { ref: poNo });
  const req = s.requests.find((x) => x.id === requestId)!; const who = Array.from(new Set([req.requesterId, req.need!.beneficiaryId]));
  s = notifyPeople(s, who, { kind: 'status', at, link: `#/requests/${req.id}`, title: t2(`صدر أمر الشراء ${poNo}`, `Purchase order ${poNo} issued`), body: t2(`${req.id} · التوريد المتوقع ${expectedAt}.`, `${req.id} · expected delivery ${expectedAt}.`) });
  return s;
}
/** تغيير الموعد المتوقع (بلا خطوة): يُسجَّل ويُبلَّغ الطالب */
export function updateExpected(state: State, requestId: string, actorId: string, expectedAt: string, why: string, at = Date.now()): State {
  const r = state.requests.find((x) => x.id === requestId); if (!r || !r.need) return state;
  const from = r.need.procurement?.expectedAt;
  let s = withNeed(state, requestId, (n) => ({ ...n, procurement: { ...(n.procurement || {}), expectedAt, expectedLog: [...(n.procurement?.expectedLog || []), { at, from, to: expectedAt, why }] } }));
  s = auditLine(s, requestId, actorId, t2(`تغيّر الموعد المتوقع للتوريد من ${from || '—'} إلى ${expectedAt}: ${why}`, `Expected delivery changed from ${from || '—'} to ${expectedAt}: ${why}`), at);
  const req = s.requests.find((x) => x.id === requestId)!; const who = Array.from(new Set([req.requesterId, req.need!.beneficiaryId]));
  return notifyPeople(s, who, { kind: 'status', at, link: `#/requests/${req.id}`, title: t2(`تغيّر موعد توريد ${req.id} إلى ${expectedAt}`, `Delivery date of ${req.id} changed to ${expectedAt}`), body: t2(why, why) });
}

/* ——— v0.12 (D-026، D-027): محضر الاستلام يولّده النظام، والاستلام على دفعات، وإقفال المتبقي ——— */
export interface ReceiptInput { supplierNote?: { no?: string; date?: string }; attachment?: string; lines?: { lineId: string; delivered: number; accepted: number; result: ReceiptLineResult; note?: string }[]; notes?: string; remedyDays?: number; period?: { from: string; to: string }; value?: number; criteria?: { text: string; evidence?: string; ok: boolean }[]; last?: boolean; status?: 'ok' | 'note' | 'rejected' }
/** المتبقي من البند: المطلوب ناقص ما قُبل وما أُقفل */
export const remainingQty = (l: NeedLine) => Math.max(0, l.qty - (l.received || 0) - (l.closed || 0));
/** تقدّم الاستلام كما يراه الطالب: «استُلم ن من م» بوحدات البنود المشتراة */
export function receiptProgress(n: NeedInfo): { received: number; total: number; closed: number; open: boolean } {
  const bought = n.lines.filter((l) => l.status === 'purchasing' || l.status === 'received' || (l.status === 'delivered' && (l.received || 0) > 0) || ((l.status === 'cancelled') && (l.closed || 0) > 0));
  const received = bought.reduce((a, l) => a + (l.received || 0), 0); const total = bought.reduce((a, l) => a + l.qty, 0); const closed = bought.reduce((a, l) => a + (l.closed || 0), 0);
  return { received, total, closed, open: bought.some((l) => remainingQty(l) > 0) };
}
/** الفحص بلجنة (D-026): للمواد فوق حد الفحص أو لفئة معلَّمة «تتطلب فحصاً» */
export function inspectionNeeded(state: State, r: Request, today = toISO(Date.now())): boolean {
  const n = r.need; if (!n || n.kind !== 'material') return false; const content = needContent(state, today); const cat = categoryOf(content, n.categoryId); const p = n.procurement || {};
  const value = p.award?.amount ?? p.estimatedValue ?? n.estimatedValue ?? 0; const threshold = content.rules.inspectionThreshold ?? 0;
  return !!cat?.inspection || (threshold > 0 && value >= threshold);
}
/** من يوقّع المحضر مع مسؤول الاستلام: ممثل الجهة الطالبة (المقيّم المسمّى في ملف الشراء وإلا المستفيد) وأخصائي المشتريات الذي جهّز الملف */
export function receiptSigners(state: State, r: Request, officerId: string): { personId: string; role: 'entity' | 'buyer' }[] {
  const n = r.need!; const p = n.procurement || {};
  const buyer = r.steps.find((s) => s.role === 'procurement' && s.status === 'done' && s.actorId && s.actorId !== 'system')?.actorId || state.org.positions.find((x) => x.unitId === PROCUREMENT_UNIT && x.holderId)?.holderId;
  /* ممثل الجهة الطالبة: من قيّم فعلاً في ملف الشراء، وإلا أول المقيّمين المسمّين، وإلا المستفيد */
  const evaluated = r.steps.find((s) => s.role === 'evaluator' && s.status === 'done' && s.actorId && s.actorId !== 'system')?.actorId;
  const entityRep = evaluated || p.evaluator?.personIds?.[0] || (n.beneficiaryId !== officerId ? n.beneficiaryId : r.requesterId);
  const out: { personId: string; role: 'entity' | 'buyer' }[] = [];
  if (n.kind === 'material' && entityRep && entityRep !== officerId) out.push({ personId: entityRep, role: 'entity' });
  if (buyer && buyer !== officerId && !out.some((x) => x.personId === buyer)) out.push({ personId: buyer, role: 'buyer' });
  return out;
}
const receiptTitle = (material: boolean) => (material ? t2('محضر فحص واستلام', 'Inspection and receipt record') : t2('محضر استلام خدمة', 'Service receipt record'));
function receiptResultOf(lines: NeedReceiptLine[]): NeedReceipt['result'] {
  const accepted = lines.reduce((a, l) => a + l.accepted, 0);
  if (!accepted) return 'rejected';
  if (lines.some((l) => l.result === 'short' || l.result === 'rejected' || l.accepted < l.delivered)) return 'partial';
  if (lines.some((l) => l.result === 'note')) return 'note';
  return 'ok';
}
/** مسؤول الاستلام يعدّ المحضر من ملف الشراء ويكمل ما لا يعرفه النظام ويوقّعه: يصدر فوراً، أو ينتظر توقيع اللجنة (ممثل الجهة الطالبة وأخصائي المشتريات) */
export function receiptStart(state: State, requestId: string, actorId: string, input: ReceiptInput, at = Date.now()): State {
  const r = state.requests.find((x) => x.id === requestId); const st = r ? curStep(r) : undefined; if (!r || !r.need || !st || st.role !== 'receipt') return state;
  const n = r.need; const material = n.kind === 'material'; const rules = needContent(state, toISO(at)).rules; const batch = st.batch || 1;
  const bought = n.lines.filter((l) => l.status === 'purchasing' && remainingQty(l) > 0);
  let lines: NeedReceiptLine[];
  if (material) {
    lines = bought.map((l) => { const inp = (input.lines || []).find((x) => x.lineId === l.id); const remaining = remainingQty(l); const delivered = Math.max(0, Math.min(inp?.delivered ?? remaining, remaining + (inp ? Math.max(0, inp.delivered - remaining) : 0))); const accepted = Math.max(0, Math.min(inp?.accepted ?? delivered, delivered, remaining)); const result: ReceiptLineResult = inp?.result || (accepted === remaining ? 'ok' : accepted === 0 ? 'rejected' : 'short'); return { lineId: l.id, ordered: l.qty, before: l.received || 0, delivered, accepted, result, note: inp?.note }; });
    if (!lines.length) return state;
  } else {
    const rejected = input.status === 'rejected';
    lines = bought.map((l) => ({ lineId: l.id, ordered: l.qty, before: l.received || 0, delivered: rejected ? 0 : input.last ? remainingQty(l) : 0, accepted: rejected ? 0 : input.last ? remainingQty(l) : 0, result: rejected ? 'rejected' as const : input.status === 'note' ? 'note' as const : 'ok' as const }));
  }
  const result: NeedReceipt['result'] = material ? receiptResultOf(lines) : input.status === 'rejected' ? 'rejected' : input.status === 'note' ? 'note' : 'ok';
  const committee = material ? inspectionNeeded(state, r, toISO(at)) : true;
  const others = committee ? receiptSigners(state, r, actorId).filter((x) => material || x.role === 'buyer') : [];
  const rc: NeedReceipt = { id: `RC-${r.id}-${batch}`, kind: n.kind, batch, at, by: actorId, status: 'signing', supplierNote: input.supplierNote, attachment: input.attachment, lines, result, notes: input.notes, remedyDays: result === 'ok' ? undefined : input.remedyDays ?? rules.remedyDays ?? 5, period: input.period, value: input.value, criteria: input.criteria, last: material ? undefined : !!input.last, committee, signers: [{ personId: actorId, role: 'officer' }, ...others], signatures: [{ personId: actorId, role: 'officer', at }], officerStep: { agent: st.agent, assigneeIds: st.assigneeIds, positionIds: st.positionIds } };
  const actor = personById(state, actorId);
  let s = withNeed(state, requestId, (x) => ({ ...x, procurement: { ...(x.procurement || {}), receipts: [...(x.procurement?.receipts || []), rc] } }));
  if (input.attachment) s = addDoc(s, requestId, input.attachment, material ? t2('إشعار التسليم من المورد', "Supplier's delivery note") : t2('مستند المورّد', "Supplier's document"), actorId, at);
  const summary = material ? lines.map((l) => { const line = n.lines.find((y) => y.id === l.lineId)!; return `${line.name.ar}: ${l.accepted} من ${l.delivered}${l.result === 'rejected' ? ' (مرفوض)' : l.result === 'short' ? ' (ناقص)' : l.result === 'note' ? ' (بملاحظة)' : ''}`; }).join('، ') : `${input.period ? `الفترة ${input.period.from} → ${input.period.to}` : ''}${input.value ? ` · ${num(input.value)} ريال` : ''}${input.last ? ' · المحضر الأخير' : ''}`;
  s = auditLine(s, requestId, actorId, t2(`أعدّ ${actor?.name || ''} ${receiptTitle(material).ar} للدفعة ${batch} من ملف الشراء ووقّعه: ${summary}${input.notes ? ` — ${input.notes}` : ''}`, `${actor?.nameEn || ''} prepared the ${receiptTitle(material).en} for batch ${batch} from the purchase file and signed it: ${summary}${input.notes ? ` — ${input.notes}` : ''}`), at);
  if (!others.length) return issueReceipt(s, requestId, at);
  /* ينتظر بقية التوقيعات: تتحول الخطوة إلى توقيع الموقّعين الآخرين بنصاب «الكل» */
  const title = material ? t2(`توقيع محضر الفحص والاستلام${batch > 1 ? ` — الدفعة ${batch}` : ''}`, `Sign the inspection and receipt record${batch > 1 ? ` — batch ${batch}` : ''}`) : t2(`توقيع محضر استلام الخدمة${batch > 1 ? ` — الدفعة ${batch}` : ''}`, `Sign the service receipt record${batch > 1 ? ` — batch ${batch}` : ''}`);
  s = patchRequest(s, requestId, (x) => ({ ...x, steps: x.steps.map((y) => (y.status === 'current' ? { ...y, role: 'receiptSign' as const, mode: 'approve' as const, desk: 'buyer' as const, title, assigneeIds: others.map((o) => o.personId), positionIds: [], quorum: 'all' as const, decisions: [], startedAt: at, why: t2(material ? 'الفحص بلجنة: يوقّع ممثل الجهة الطالبة وأخصائي المشتريات بعد مسؤول الاستلام' : 'يوقّع أخصائي المشتريات بعد مسؤول الخدمة', material ? 'Committee inspection: the requesting-side representative and the buyer sign after the receipt officer' : 'The buyer signs after the service owner') } : y)) }));
  const req = s.requests.find((x) => x.id === requestId)!;
  s = notifyPeople(s, others.map((o) => o.personId), { kind: 'task', at, link: '#/inbox', title: t2(`وقّع ${receiptTitle(material).ar}: ${req.id}`, `Sign the ${receiptTitle(material).en}: ${req.id}`), body: t2(`أعدّه ${actor?.name || ''} ووقّعه؛ يصدر برقمه بتوقيعك.`, `Prepared and signed by ${actor?.nameEn || ''}; it is issued with your signature.`) });
  return s;
}
/** توقيع عضو اللجنة (أو أخصائي المشتريات) على المحضر؛ بالتوقيع الأخير يصدر */
export function receiptSign(state: State, requestId: string, actorId: string, at = Date.now()): State {
  const r = state.requests.find((x) => x.id === requestId); const st = r ? curStep(r) : undefined; if (!r || !r.need || !st || st.role !== 'receiptSign') return state;
  const rc = (r.need.procurement?.receipts || []).find((x) => x.status === 'signing'); if (!rc) return state;
  const signer = rc.signers.find((x) => x.personId === actorId); if (!signer || rc.signatures.some((x) => x.personId === actorId)) return state;
  const actor = personById(state, actorId); const material = rc.kind === 'material';
  let s = withNeed(state, requestId, (x) => ({ ...x, procurement: { ...(x.procurement || {}), receipts: (x.procurement?.receipts || []).map((y) => (y.id === rc.id ? { ...y, signatures: [...y.signatures, { personId: actorId, role: signer.role, at }] } : y)) } }));
  s = patchRequest(s, requestId, (x) => ({ ...x, steps: x.steps.map((y) => (y.status === 'current' ? { ...y, decisions: [...(y.decisions || []), { actorId, action: 'approve' as const, at }] } : y)), audit: [...x.audit, { at, who: actorId, what: t2(`وقّع ${actor?.name || ''} ${receiptTitle(material).ar} بصفته ${signer.role === 'entity' ? 'ممثل الجهة الطالبة' : 'أخصائي المشتريات'}`, `${actor?.nameEn || ''} signed the ${receiptTitle(material).en} as ${signer.role === 'entity' ? 'the requesting-side representative' : 'the buyer'}`) }] }));
  const after = s.requests.find((x) => x.id === requestId)!.need!.procurement!.receipts!.find((x) => x.id === rc.id)!;
  if (after.signers.every((x) => after.signatures.some((y) => y.personId === x.personId))) return issueReceipt(s, requestId, at);
  return s;
}
/** رقم المحضر: نوع/سنة/مسلسل (INS للمواد، REC للخدمات) */
function receiptNumber(state: State, material: boolean, at: number): string {
  const issued = state.requests.reduce((a, r) => a + (r.need?.procurement?.receipts || []).filter((x) => x.status === 'issued' && (x.kind === 'material') === material).length, 0);
  return `${material ? 'INS' : 'REC'}-${new Date(at).getFullYear()}-${String((material ? 17 : 498) + issued + 1).padStart(3, '0')}`;
}
/** رقم سند التسليم والاستلام: ST-سنة-مسلسل */
function handoverNumber(state: State, at: number): string {
  const count = state.requests.reduce((a, r) => a + (r.need?.handovers || []).length, 0);
  return `ST-${new Date(at).getFullYear()}-${String(1170 + count + 1).padStart(4, '0')}`;
}
/** إصدار المحضر: رقم ورمز تحقق ومستند في ملف الشراء، وترحيل الاستلام إلى النظام المرجعي (مستند المادة أو محضر استلام الخدمة) ويعود رقمه، وتحديث كميات البنود، وفتح الدفعة التالية إن بقي شيء */
function issueReceipt(state: State, requestId: string, at: number): State {
  const r = state.requests.find((x) => x.id === requestId); const st = r ? curStep(r) : undefined; if (!r || !r.need || !st) return state;
  const rc = (r.need.procurement?.receipts || []).find((x) => x.status === 'signing'); if (!rc) return state;
  const n = r.need; const material = rc.kind === 'material'; const rules = needContent(state, toISO(at)).rules;
  const anyAccepted = material ? rc.lines.some((l) => l.accepted > 0) : rc.result !== 'rejected';
  const no = receiptNumber(state, material, at); const seq = (state.erpSeq || 0) + 1; const erpNo = anyAccepted ? (material ? `${5000000400 + seq}` : `${1000004500 + seq}`) : undefined;
  const docId = `D-${r.id}-${r.docs.length + 1}`;
  const lines = n.lines.map((l) => { const rl = rc.lines.find((x) => x.lineId === l.id); if (!rl) return l; const received = (l.received || 0) + rl.accepted; const rejected = (l.rejected || 0) + Math.max(0, rl.delivered - rl.accepted); const done = received + (l.closed || 0) >= l.qty; return { ...l, received, rejected: rejected || undefined, status: done ? (material ? 'received' as const : 'delivered' as const) : l.status }; });
  const issued: NeedReceipt = { ...rc, status: 'issued', no, erpNo, erpAt: erpNo ? at : undefined, docId, issuedAt: at };
  let s: State = erpNo ? { ...state, erpSeq: seq } : state;
  s = withNeed(s, requestId, (x) => ({ ...x, lines, procurement: { ...(x.procurement || {}), receipts: (x.procurement?.receipts || []).map((y) => (y.id === rc.id ? issued : y)), ...(erpNo ? (material ? { receiptNo: erpNo, receiptAt: at } : { serviceEntryNo: erpNo, receiptAt: at }) : {}) } }));
  s = patchRequest(s, requestId, (x) => ({ ...x, docs: [...x.docs, { id: docId, kind: 'issued', type: material ? 'inspection' : 'serviceReceipt', code: material ? 'FR-PR-04' : 'FR-PR-05', title: receiptTitle(material), number: no, at, refId: rc.id }] }));
  const req1 = s.requests.find((x) => x.id === requestId)!; const prog = receiptProgress(req1.need!);
  const signersTxt = issued.signatures.map((g) => personById(s, g.personId)?.name || '').filter(Boolean).join(' و');
  const rejectedLines = rc.lines.filter((l) => l.accepted < l.delivered || l.result === 'short' || l.result === 'rejected');
  s = auditLine(s, requestId, 'system', t2(`صدر ${receiptTitle(material).ar} رقم ${no} بتوقيع ${signersTxt}${erpNo ? `؛ رُحِّل الاستلام إلى النظام المرجعي (${material ? 'مستند المادة' : 'محضر استلام الخدمة'} ${erpNo})` : '؛ لم يُقبل شيء فلا ترحيل'}${material ? `؛ استُلم ${prog.received} من ${prog.total}` : ''}${rejectedLines.length ? `؛ ما لم يُقبل يعالجه المورّد خلال ${rc.remedyDays} أيام` : ''}`, `${receiptTitle(material).en} ${no} issued, signed by ${signersTxt}${erpNo ? `; receipt posted to the system of record (${material ? 'material document' : 'service entry sheet'} ${erpNo})` : '; nothing accepted, nothing posted'}${material ? `; received ${prog.received} of ${prog.total}` : ''}${rejectedLines.length ? `; the supplier remedies what was not accepted within ${rc.remedyDays} days` : ''}`), at);
  /* الدفعة التالية (D-027): يبقى شيء لم يُستلم ولم يُقفل — تُدرج خطوة استلام (وتسليم) جديدة بحسب قاعدة التسليم */
  const remainder = material ? lines.some((l) => l.status === 'purchasing' && remainingQty(l) > 0) : !rc.last;
  if (remainder) {
    const b = rc.batch + 1; const mode = rules.handoverMode || 'each';
    s = patchRequest(s, requestId, (x) => {
      const i = x.steps.findIndex((y) => y.status === 'current'); const cur = x.steps[i];
      const officer = rc.officerStep || { agent: cur.agent, assigneeIds: cur.assigneeIds, positionIds: cur.positionIds };
      const nextReceipt: Step = { key: `${cur.key.replace(/b\d+$/, '')}b${b}`, desk: 'buyer', title: t2(`الاستلام من المورد — الدفعة ${b}`, `Receipt from the supplier — batch ${b}`), status: 'pending', mode: 'fulfil', agent: officer.agent, assigneeIds: officer.assigneeIds, positionIds: officer.positionIds, quorum: 'any', slaHours: cur.slaHours, role: 'receipt', branch: 'purchase', batch: b, why: t2(`بقي من التوريد ما لم يُستلم بعد الدفعة ${rc.batch}`, `Part of the delivery remains after batch ${rc.batch}`) };
      const hIdx = x.steps.findIndex((y, k) => k > i && y.status === 'pending' && y.role === 'handover' && y.branch === 'purchase');
      if (!material || hIdx < 0) { const out = x.steps.slice(); out.splice(i + 1, 0, nextReceipt); return { ...x, steps: out }; }
      const h = x.steps[hIdx];
      if (mode === 'complete') { const out = x.steps.slice(); out.splice(hIdx, 0, nextReceipt); return { ...x, steps: out }; }
      const nextHandover: Step = { ...h, key: `${h.key.replace(/b\d+$/, '')}b${b}`, title: t2(`التسليم والاستلام — الدفعة ${b}`, `Handover — batch ${b}`), status: 'pending', batch: b, decisions: undefined, at: undefined, actorId: undefined, startedAt: undefined };
      const out = x.steps.slice(); out.splice(hIdx + 1, 0, nextReceipt, nextHandover); return { ...x, steps: out };
    });
  }
  const req = s.requests.find((x) => x.id === requestId)!; const who = Array.from(new Set([req.requesterId, req.need!.beneficiaryId]));
  const lineNames = (ls: NeedReceiptLine[]) => ls.map((l) => { const line = n.lines.find((y) => y.id === l.lineId)!; return `${line.name.ar} × ${l.accepted}`; }).join('، ');
  s = notifyPeople(s, who, { kind: 'document', at, link: `#/requests/${req.id}`, title: material ? (anyAccepted ? t2(`وصل ${prog.received === prog.total ? 'احتياجك كاملاً' : `جزء من احتياجك (${prog.received} من ${prog.total})`}`, `${prog.received === prog.total ? 'Your need arrived in full' : `Part of your need arrived (${prog.received} of ${prog.total})`}`) : t2('وصل توريد ولم يُقبل', 'A delivery arrived and was not accepted')) : (rc.result === 'rejected' ? t2('لم يُقبل استلام الخدمة', 'The service was not accepted') : t2(rc.last ? 'اكتمل استلام الخدمة' : 'استُلمت دفعة من الخدمة', rc.last ? 'Service receipt completed' : 'A service batch was received')), body: t2(`${req.id} · ${receiptTitle(material).ar} ${no}${anyAccepted && material ? ` · ${lineNames(rc.lines.filter((l) => l.accepted > 0))}${remainder ? ' · بقية الكمية تُستلم دفعةً تالية' : ''} · التسليم إليك ${rules.handoverMode === 'complete' && remainder ? 'بعد اكتمال الاستلام' : 'قريباً'}` : ''}.`, `${req.id} · ${receiptTitle(material).en} ${no}${anyAccepted && material ? ` · ${remainder ? 'the rest arrives in a later batch' : 'complete'} · handover to you ${rules.handoverMode === 'complete' && remainder ? 'after the receipt is complete' : 'soon'}` : ''}.`) });
  if (rejectedLines.length || rc.result === 'rejected') {
    const buyers = state.org.positions.filter((p) => p.unitId === PROCUREMENT_UNIT && p.holderId).map((p) => p.holderId!);
    s = notifyPeople(s, buyers, { kind: 'task', at, link: `#/requests/${req.id}`, title: t2(`متابعة مع المورّد: ${no}`, `Follow up with the supplier: ${no}`), body: t2(`${req.id} · ${material ? rejectedLines.map((l) => { const line = n.lines.find((y) => y.id === l.lineId)!; return `${line.name.ar}: ${l.delivered - l.accepted} ${l.result === 'rejected' ? 'مرفوض' : 'ناقص'}`; }).join('، ') : rc.notes || 'لم يُقبل الاستلام'} · مهلة المعالجة ${rc.remedyDays} أيام${rc.attachment ? ` · ${rc.attachment}` : ''}.`, `${req.id} · not accepted · remedy period ${rc.remedyDays} days.`) });
  }
  return completeCurrent(s, requestId, rc.by, t2(`أُغلقت خطوة الاستلام${rc.batch > 1 ? ` (الدفعة ${rc.batch})` : ''} بالمحضر ${no}${remainder ? '؛ تُفتح دفعة تالية' : ''}`, `Receipt step${rc.batch > 1 ? ` (batch ${rc.batch})` : ''} closed with record ${no}${remainder ? '; a further batch opens' : ''}`), at, { outcome: rc.result === 'rejected' ? 'rejected' : remainder ? 'partial' : 'complete', ref: no });
}
/** إقفال المتبقي بلا توريد (D-027): من مسؤول الاستلام في دفعة تالية أو من مكتب المشتريات — مؤشر اكتمال التوريد على بند أمر الشراء، ويُحرَّر ما بقي من حجز الاعتماد وتُبلَّغ الموازنة */
export function closeRemainder(state: State, requestId: string, actorId: string, why: string, at = Date.now()): State {
  const r = state.requests.find((x) => x.id === requestId); if (!r || !r.need || r.status !== 'in_review' || !why.trim()) return state;
  const st = curStep(r); if (st?.role === 'receiptSign') return state;
  const n = r.need; const p = n.procurement || {}; const material = n.kind === 'material';
  const open = n.lines.filter((l) => l.status === 'purchasing' && remainingQty(l) > 0); if (!open.length) return state;
  const closedValue = material ? open.reduce((a, l) => a + remainingQty(l) * (l.unitPrice || 0), 0) : Math.max(0, (p.award?.amount ?? p.estimatedValue ?? 0) - (p.receipts || []).filter((x) => x.status === 'issued').reduce((a, x) => a + (x.value || 0), 0));
  const res = p.reservation; const releasable = res && !res.released ? Math.max(0, Math.min(closedValue, res.amount)) : 0;
  const lines = n.lines.map((l) => { if (!(l.status === 'purchasing' && remainingQty(l) > 0)) return l; const closed = (l.closed || 0) + remainingQty(l); const received = l.received || 0; const handed = l.handed || 0; return { ...l, closed, status: handed + closed >= l.qty || (!material && received > 0) ? 'delivered' as const : received > 0 ? 'received' as const : 'cancelled' as const }; });
  const actor = personById(state, actorId);
  let s = withNeed(state, requestId, (x) => ({ ...x, lines, procurement: { ...(x.procurement || {}), deliveryCompleted: { at, by: actorId, why, closedValue, releasedAmount: releasable || undefined }, reservation: x.procurement?.reservation && releasable ? { ...x.procurement.reservation, amount: x.procurement.reservation.amount - releasable, topUps: x.procurement.reservation.topUps } : x.procurement?.reservation } }));
  s = auditLine(s, requestId, actorId, t2(`أقفل ${actor?.name || ''} المتبقي من التوريد بلا استلام: ${why} — ${material ? open.map((l) => `${l.name.ar}: ${remainingQty(l)}`).join('، ') : 'بقية الخدمة'}؛ وُضع مؤشر اكتمال التوريد على بند أمر الشراء ${p.poNo || ''} في النظام المرجعي${releasable ? `؛ حُرِّر من حجز الاعتماد ${res!.no} مبلغ ${num(releasable)} ريال` : ''}`, `${actor?.nameEn || ''} closed the undelivered remainder: ${why} — ${material ? open.map((l) => `${l.name.en}: ${remainingQty(l)}`).join(', ') : 'the rest of the service'}; delivery-completed indicator set on purchase order ${p.poNo || ''} in the system of record${releasable ? `; SAR ${num(releasable)} released from funds reservation ${res!.no}` : ''}`), at);
  const req = s.requests.find((x) => x.id === requestId)!; const who = Array.from(new Set([req.requesterId, req.need!.beneficiaryId]));
  s = notifyPeople(s, who, { kind: 'status', at, link: `#/requests/${req.id}`, title: t2(`أُقفل المتبقي من ${req.id}`, `Remainder of ${req.id} closed`), body: t2(`${why} · ما استُلم يُسلَّم إليك، والباقي لن يُورَّد.`, `${why} · what was received is handed over; the rest will not be delivered.`) });
  if (releasable) { const budget = state.org.positions.find((x) => x.id === 'S-123')?.holderId; if (budget) s = notifyPeople(s, [budget], { kind: 'status', at, link: `#/requests/${req.id}`, title: t2(`حُرِّر ${num(releasable)} ريال من الحجز ${res!.no}`, `SAR ${num(releasable)} released from reservation ${res!.no}`), body: t2(`${req.id} · أُقفل المتبقي: ${why}`, `${req.id} · remainder closed: ${why}`) }); }
  const cur = curStep(req);
  if (cur?.role === 'receipt') s = completeCurrent(s, requestId, actorId, t2(`أُغلقت خطوة الاستلام${cur.batch ? ` (الدفعة ${cur.batch})` : ''} بإقفال المتبقي`, `Receipt step${cur.batch ? ` (batch ${cur.batch})` : ''} closed by closing the remainder`), at, { outcome: 'closed' });
  return s;
}
/** التسليم: المسلِّم (المستودع أو مسؤول المكتب أو الجهة) يبدأ التسليم فيوقّع، وتتحول الخطوة إلى توقيع المستفيد؛ v0.12: بكميات الدفعة الجاهزة */
export function handoverStart(state: State, requestId: string, actorId: string, at = Date.now()): State {
  const r = state.requests.find((x) => x.id === requestId); const st = r ? curStep(r) : undefined; if (!r || !r.need || !st || st.role !== 'handover') return state;
  const ready = readyLines(r.need); if (!ready.length) return state;
  const actor = personById(state, actorId); const pos = actor ? positionOf(state, actor) : undefined; const batch = st.batch || 1;
  let s = withNeed(state, requestId, (n) => ({ ...n, handover: { startedBy: actorId, startedAt: at, issuerPositionId: pos?.id, batch, lines: ready.map((l) => ({ lineId: l.id, qty: readyQty(l) })) } }));
  s = patchRequest(s, requestId, (x) => ({ ...x, steps: x.steps.map((y) => (y.status === 'current' ? { ...y, role: 'handoverSign' as const, mode: 'receipt' as const, desk: 'requester' as const, title: batch > 1 ? t2(`توقيع المستفيد على الاستلام — الدفعة ${batch}`, `Beneficiary signs the receipt — batch ${batch}`) : NEED_ROLE_TITLE.handoverSign, assigneeIds: [x.need!.beneficiaryId], positionIds: [], startedAt: at, why: t2(`بدأ التسليم ${actor?.name || ''}؛ يوقّع المستفيد الاستلام`, `${actor?.nameEn || ''} started the handover; the beneficiary signs`) } : y)), audit: [...x.audit, { at, who: actorId, what: t2(`بدأ التسليم ووقّع المسلِّم: ${actor?.name || ''}${batch > 1 ? ` (الدفعة ${batch})` : ''}`, `Handover started; issuer signed: ${actor?.nameEn || ''}${batch > 1 ? ` (batch ${batch})` : ''}`) }] }));
  const req = s.requests.find((x) => x.id === requestId)!;
  s = notifyPeople(s, [req.need!.beneficiaryId], { kind: 'task', at, link: '#/inbox', title: t2('حان التسليم: وقّع الاستلام', 'Handover now: sign the receipt'), body: t2(`${actor?.name || ''} يسلّمك الآن ${ready.map((l) => `${l.name.ar} × ${readyQty(l)}`).join('، ')} · ${req.id}.`, `${actor?.nameEn || ''} is handing you ${ready.map((l) => `${l.name.en} × ${readyQty(l)}`).join(', ')} · ${req.id}.`) });
  return s;
}
/** توقيع المستفيد: يكمل الخطوة (بقرار «استلام») ثم يُصدر سند التسليم والاستلام برقم ورمز تحقق (سند لكل دفعة)، ويصرف الأصناف في النظام المرجعي، ويقيّدها في سجل العهدة */
export function handoverSign(state: State, requestId: string, actorId: string, at = Date.now()): State {
  const r = state.requests.find((x) => x.id === requestId); const st = r ? curStep(r) : undefined; if (!r || !r.need || !st || st.role !== 'handoverSign') return state;
  const number = handoverNumber(state, at);
  const content = needContent(state, toISO(at)); const cat = categoryOf(content, r.need.categoryId);
  const h = r.need.handover || {}; const batchLines = h.lines && h.lines.length ? h.lines : readyLines(r.need).map((l) => ({ lineId: l.id, qty: readyQty(l) }));
  let seq = state.erpSeq || 0; const docId = `D-${r.id}-${r.docs.length + 1}`;
  const hl: NonNullable<NeedHandover['lines']> = [];
  /* v0.11: البند الموفَّر من رصيد الجهة — مستند مادة إن كان الرصيد مادة بمخزون، وعهدة رقمية (رخصة أو مقعد بمرجعها) إن كان الرصيد عهدة؛ v0.12: كمية الدفعة، والبند يُغلق حين يُسلَّم كله */
  const lines = r.need.lines.map((l) => {
    const bl = batchLines.find((x) => x.lineId === l.id); if (!bl || bl.qty <= 0) return l;
    const handed = (l.handed || 0) + bl.qty; const done = handed + (l.closed || 0) >= l.qty || l.status === 'reserved' || l.status === 'provided';
    const pool = l.status === 'provided' ? poolOf(content, l.poolId) : undefined; const item = state.erp.items.find((x) => x.id === (pool?.itemId || l.itemId));
    if (pool && pool.erpKind !== 'material') { const assetNo = pool.custody ? l.provisionRef || `${pool.id}-${r.need!.beneficiaryId}` : undefined; hl.push({ lineId: l.id, qty: bl.qty, ref: assetNo }); return { ...l, handed, status: 'delivered' as const, assetNo }; }
    seq += 1; const custody = item ? item.custody : pool ? pool.custody : cat?.custody; const materialDocNo = `${4900000400 + seq}`; const assetNo = custody ? `${400000400 + seq}` : undefined;
    hl.push({ lineId: l.id, qty: bl.qty, materialDocNo, assetNo });
    return { ...l, handed, status: done ? 'delivered' as const : l.status, materialDocNo, assetNo };
  });
  const custody: CustodyEntry[] = hl.filter((x) => x.assetNo || x.ref).map((x) => { const l = lines.find((y) => y.id === x.lineId)!; const pool = poolOf(content, l.poolId); const digital = !!pool && pool.erpKind !== 'material'; return { id: `C-${r.id}-${l.id}${(h.batch || 1) > 1 ? `-${h.batch}` : ''}`, personId: r.need!.beneficiaryId, requestId: r.id, lineId: l.id, name: l.name, qty: x.qty, itemId: l.itemId, assetNo: digital ? undefined : x.assetNo, ref: digital ? x.ref : undefined, digital, handoverNo: number, at }; });
  const finished: NeedHandover = { ...h, number, signedBy: actorId, signedAt: at, docId, batch: h.batch || 1, lines: hl };
  let s: State = { ...state, erpSeq: seq, custody: [...state.custody, ...custody] };
  s = withNeed(s, requestId, (n) => ({ ...n, lines, handover: finished, handovers: [...(n.handovers || []), finished] }));
  s = patchRequest(s, requestId, (x) => ({ ...x, docs: [...x.docs, { id: docId, kind: 'issued', type: 'handover', code: 'FR-PR-01', title: t2('سند تسليم واستلام', 'Handover note'), number, at, refId: number }] }));
  s = decide(s, requestId, 'receive', actorId, undefined, at);
  const req = s.requests.find((x) => x.id === requestId)!; const actor = personById(s, actorId);
  const issued = hl.filter((x) => x.materialDocNo); const ready = hl.map((x) => ({ l: lines.find((y) => y.id === x.lineId)!, qty: x.qty }));
  s = auditLine(s, requestId, 'system', t2(`صدر سند التسليم والاستلام رقم ${number}${(h.batch || 1) > 1 ? ` (الدفعة ${h.batch})` : ''} بتوقيع الطرفين${issued.length ? `؛ صُرفت الأصناف في النظام المرجعي (${issued.map((x) => `مستند المادة ${x.materialDocNo}`).join('، ')})` : '؛ لا صرف من مستودع (وُفِّر من رصيد الجهة)'}${custody.length ? `؛ قُيِّد في عهدة ${actor?.name || ''}: ${custody.map((c) => `${c.name.ar} (${c.digital ? `عهدة رقمية ${c.ref}` : `الأصل ${c.assetNo}`})`).join('، ')}` : ''}`, `Handover note ${number}${(h.batch || 1) > 1 ? ` (batch ${h.batch})` : ''} issued with both signatures${issued.length ? `; items issued in the system of record (${issued.map((x) => `material document ${x.materialDocNo}`).join(', ')})` : '; no store issue (provided from the entity pool)'}${custody.length ? `; recorded in ${actor?.nameEn || ''}'s custody: ${custody.map((c) => `${c.name.en} (${c.digital ? `digital custody ${c.ref}` : `asset ${c.assetNo}`})`).join(', ')}` : ''}`), at);
  const who = Array.from(new Set([req.requesterId, req.need!.beneficiaryId]));
  s = notifyPeople(s, who, { kind: 'document', at, link: `#/requests/${req.id}`, title: t2(`${req.status === 'completed' ? 'اكتمل احتياجك' : 'استلمت'}: صدر سند التسليم والاستلام رقم ${number}`, `${req.status === 'completed' ? 'Your need is complete' : 'Received'}: handover note ${number} issued`), body: t2(`${ready.map((x) => `${x.l.name.ar} × ${x.qty}`).join('، ')}${custody.length ? ' · قُيِّد في عهدتك' : ''}${req.status !== 'completed' ? ' · بقية البنود قيد التوريد' : ''}.`, `${ready.map((x) => `${x.l.name.en} × ${x.qty}`).join(', ')}${custody.length ? ' · recorded in your custody' : ''}${req.status !== 'completed' ? ' · remaining lines being supplied' : ''}.`) });
  if (custody.length) s = notifyPeople(s, [req.need!.beneficiaryId], { kind: 'status', at, link: '#/me/custody', title: t2(`قُيِّد في عهدتك: ${custody.map((c) => c.name.ar).join('، ')}`, `Recorded in your custody: ${custody.map((c) => c.name.en).join(', ')}`), body: t2(custody.map((c) => (c.digital ? `عهدة رقمية ${c.ref}` : `الأصل ${c.assetNo}`)).join(' · '), custody.map((c) => (c.digital ? `digital custody ${c.ref}` : `asset ${c.assetNo}`)).join(' · ')) });
  return s;
}
/** طلب الإلغاء بعد خطوة المشتريات: يقرره مكتب المشتريات (حرية المشتريات) */
export function requestNeedCancel(state: State, requestId: string, reason: string, at = Date.now()): State {
  const r = state.requests.find((x) => x.id === requestId); if (!r || !r.need || r.status !== 'in_review') return state;
  let s = withNeed(state, requestId, (n) => ({ ...n, cancel: { requestedAt: at, reason } }));
  s = auditLine(s, requestId, r.requesterId, t2(`طلب الإلغاء: ${reason}`, `Cancellation requested: ${reason}`), at);
  const buyers = state.org.positions.filter((p) => p.unitId === 'O-130' && p.holderId).map((p) => p.holderId!);
  const requester = personById(s, r.requesterId);
  return notifyPeople(s, buyers, { kind: 'task', at, link: '#/desk/procurement', title: t2(`طلب ${requester?.name || ''} إلغاء احتياجه ${r.id}`, `${requester?.nameEn || ''} asked to cancel ${r.id}`), body: t2(`${reason} — يقرره مكتب المشتريات.`, `${reason} — procurement decides.`) });
}
export function decideNeedCancel(state: State, requestId: string, actorId: string, accepted: boolean, note: string, at = Date.now()): State {
  const r = state.requests.find((x) => x.id === requestId); if (!r || !r.need?.cancel || r.need.cancel.decidedAt) return state;
  const res = r.need.procurement?.reservation;
  let s = withNeed(state, requestId, (n) => ({ ...n, cancel: { ...n.cancel!, decidedBy: actorId, decidedAt: at, accepted, note }, lines: accepted ? n.lines.map((l) => (l.status === 'delivered' ? l : { ...l, status: 'cancelled' as const })) : n.lines, procurement: accepted && n.procurement?.reservation && !n.procurement.reservation.released ? { ...n.procurement, reservation: { ...n.procurement.reservation, released: true, releasedAt: at } } : n.procurement }));
  if (accepted) s = patchRequest(s, requestId, (x) => ({ ...x, status: 'withdrawn', updatedAt: at, steps: x.steps.map((y) => (y.status === 'current' || y.status === 'pending' ? { ...y, status: 'skipped' as const } : y)), audit: [...x.audit, { at, who: actorId, what: t2(`قبل مكتب المشتريات الإلغاء: ${note}`, `Procurement accepted the cancellation: ${note}`) }, ...(res && !res.released ? [{ at, who: 'system', what: t2(`حُرِّر حجز الاعتماد ${res.no} (${res.amount.toLocaleString('en')} ريال) في النظام المرجعي${x.need?.procurement?.prNo ? `؛ يُغلق طلب الشراء ${x.need.procurement.prNo}${x.need.procurement.poNo ? ` وأمر الشراء ${x.need.procurement.poNo}` : ''}` : ''}`, `Funds reservation ${res.no} (SAR ${res.amount.toLocaleString('en')}) released in the system of record${x.need?.procurement?.prNo ? `; requisition ${x.need.procurement.prNo}${x.need.procurement.poNo ? ` and purchase order ${x.need.procurement.poNo}` : ''} to be closed` : ''}`) }] : [])] }));
  else s = auditLine(s, requestId, actorId, t2(`رفض مكتب المشتريات الإلغاء: ${note}؛ يكمل الطلب مساره`, `Procurement declined the cancellation: ${note}; the request continues`), at);
  const req = s.requests.find((x) => x.id === requestId)!;
  return notifyPeople(s, [req.requesterId], { kind: 'status', at, link: `#/requests/${req.id}`, title: accepted ? t2(`أُلغي احتياجك ${req.id}`, `Your need ${req.id} is cancelled`) : t2(`لم يُقبل إلغاء ${req.id}`, `Cancellation of ${req.id} declined`), body: t2(note, note) });
}
/** الطالب يسحب الاحتياج قبل خطوة المشتريات ما لم يُحجز بند من المستودع */
export function canWithdrawNeed(r: Request): boolean {
  if (!r.need || r.status !== 'in_review') return false;
  return !r.steps.some((s) => (s.status === 'done' || s.status === 'current') && s.role && ['store', 'procurement', 'purchaseApproval', 'budget', 'quotes', 'evaluator', 'budgetTopUp', 'awardApproval', 'tender', 'pr', 'po', 'receipt', 'receiptSign', 'handover', 'handoverSign'].includes(s.role) && (s.status === 'done' || s.role !== 'store'));
}
export function canCancelNeed(r: Request): boolean {
  if (!r.need || r.status !== 'in_review' || r.need.cancel) return false;
  return r.steps.some((s) => s.status === 'done' && s.role === 'procurement');
}

/* ——— سلامة سياسة الاحتياج قبل الجدولة: فئة مادة بلا مستودع، وفئة تشير إلى جهة غير موجودة، وجهة أو مستودع أو مسؤول مقر بلا منصب ——— */
export type NeedProblem = { kind: 'store' | 'entity' | 'agent' | 'band' | 'method' | 'catalog' | 'pool'; name: T2 };
export function needProblems(content: NeedContent, today: string): NeedProblem[] {
  const out: NeedProblem[] = []; const live = <T extends { endedAt?: string }>(l: T[]) => liveNeed(l, today);
  for (const c of live(content.categories)) {
    if (c.kind === 'material' && (!c.storeId || !live(content.stores).some((s) => s.id === c.storeId))) out.push({ kind: 'store', name: c.name });
    if (c.entityId && !live(content.entities).some((e) => e.id === c.entityId)) out.push({ kind: 'entity', name: c.name });
  }
  for (const e of live(content.entities)) if (!(e.agent.positionIds || []).length) out.push({ kind: 'agent', name: e.name });
  for (const s of live(content.stores)) if (!(s.agent.positionIds || []).length) out.push({ kind: 'agent', name: s.name });
  for (const s of live(content.sites)) if (!s.storeIds.length && !(s.receiverAgent?.positionIds || []).length) out.push({ kind: 'agent', name: s.name });
  /* v0.10: شريحة صلاحيات بلا منصب، وجدول بلا شريحة تغطي كل القيم، وطرق شراء لا طريقة سارية فيها، وبند كتالوج لفئة ملغاة */
  const bands = live(content.authority || []);
  for (const b of bands) if (!(b.agent.positionIds || []).length) out.push({ kind: 'agent', name: b.name });
  if (!bands.length || !bands.some((b) => b.upTo === null)) out.push({ kind: 'band', name: t2('جدول الصلاحيات', 'Delegation table') });
  if (!live(content.methods || []).length) out.push({ kind: 'method', name: t2('طرق الشراء', 'Purchase methods') });
  for (const k of live(content.catalog || [])) if (!live(content.categories).some((c) => c.id === k.categoryId)) out.push({ kind: 'catalog', name: k.name });
  /* v0.11: رصيد جهة بلا جهة سارية، أو بند كتالوج يشير إلى رصيد غير سارٍ، أو فئة مصدر توفرها «رصيد الجهة» بلا جهة */
  for (const p of live(content.pools || [])) if (!live(content.entities).some((e) => e.id === p.entityId)) out.push({ kind: 'pool', name: p.name });
  for (const k of live(content.catalog || [])) if (k.poolId && !live(content.pools || []).some((p) => p.id === k.poolId)) out.push({ kind: 'pool', name: k.name });
  for (const c of live(content.categories)) if (canProvide(c.availability) && !c.entityId) out.push({ kind: 'entity', name: c.name });
  return out;
}
/* ——— v0.11: تشغيل رصيد الجهة (سجل البوابة للمقاعد والرخص): تعديل الرصيد يسري فوراً بسجل تشغيل ——— */
export function setPoolStock(state: State, poolId: string, poolName: T2, qty: number, by: string, why: string, at = Date.now()): State {
  const before = (state.erp.poolStock || []).find((x) => x.poolId === poolId)?.qty || 0;
  const poolStockList = (state.erp.poolStock || []).some((x) => x.poolId === poolId) ? (state.erp.poolStock || []).map((x) => (x.poolId === poolId ? { ...x, qty } : x)) : [...(state.erp.poolStock || []), { poolId, qty }];
  return { ...state, erp: { ...state.erp, poolStock: poolStockList }, needPolicy: { ...state.needPolicy, opsLog: [{ at, by, what: t2(`تعديل رصيد «${poolName.ar}»: ${why}`, `Adjusted the pool “${poolName.en}”: ${why}`), detail: `${before} → ${qty}` }, ...state.needPolicy.opsLog] } };
}

/* ——— التشغيل: منسّقو المشتريات لكل قطاع (يسري فوراً بسجل تشغيل) ——— */
export function setCoordinators(policy: PolicyState, sectorId: string, sectorName: T2, positionIds: string[], by: string, at = Date.now()): PolicyState {
  const key = `coord:${sectorId}`; const before = policy.groups[key] || []; const added = positionIds.filter((x) => !before.includes(x)); const removed = before.filter((x) => !positionIds.includes(x));
  return { ...policy, groups: { ...policy.groups, [key]: positionIds }, opsLog: [{ at, by, what: t2(`تعديل منسّقي المشتريات في ${sectorName.ar}`, `Changed the procurement coordinators of ${sectorName.en}`), detail: `+${added.length} −${removed.length} · ${positionIds.length}` }, ...policy.opsLog] };
}

/* ——— قراءات للشاشات ——— */
export function myCustody(state: State, personId: string): CustodyEntry[] { return state.custody.filter((c) => c.personId === personId && !c.returnedAt).sort((a, b) => b.at - a.at); }
export function needsWithRole(state: State, roles: NeedRole[]): Request[] { return state.requests.filter((r) => r.need && r.status === 'in_review' && r.steps.some((s) => s.status === 'current' && s.role && roles.includes(s.role))); }
export function needsInPurchase(state: State): Request[] { return state.requests.filter((r) => r.need && r.status === 'in_review' && r.steps.some((s) => s.status === 'done' && s.role === 'procurement')); }
export const PROCUREMENT_UNIT = 'O-130';
export const PURCHASE_ROLES: NeedRole[] = ['procurement', 'purchaseApproval', 'budget', 'quotes', 'evaluator', 'budgetTopUp', 'awardApproval', 'tender', 'po', 'receipt', 'receiptSign'];
export const STORE_ROLES: NeedRole[] = ['store', 'handover', 'handoverSign', 'receipt'];
/** المكاتب التي يراها الشخص: مكتب المشتريات لأعضاء فريق المشتريات، ومكتب المستودع لمن يشغل منصب مستودع أو مسؤول استلام وتسليم في مقر بلا مستودع */
export function desksFor(state: State, person: Person, today = toISO(Date.now())): { procurement: boolean; store: boolean; storeIds: string[]; siteIds: string[]; procurementCount: number; storeCount: number } {
  const content = state.needPolicy ? needContent(state, today) : undefined; const pid = person.positionId;
  const procurement = person.persona === 'buyer' || (!!pid && state.org.positions.some((p) => p.id === pid && p.unitId === PROCUREMENT_UNIT));
  const storeIds = content ? liveNeed(content.stores, today).filter((s) => pid && (s.agent.positionIds || []).includes(pid)).map((s) => s.id) : [];
  const siteIds = content ? liveNeed(content.sites, today).filter((s) => pid && (s.receiverAgent?.positionIds || []).includes(pid)).map((s) => s.id) : [];
  const store = storeIds.length > 0 || siteIds.length > 0;
  const mine = (roles: NeedRole[]) => needsWithRole(state, roles).filter((r) => r.steps.some((s) => s.status === 'current' && s.role && roles.includes(s.role) && (s.assigneeIds || []).includes(person.id))).length;
  return { procurement, store, storeIds, siteIds, procurementCount: procurement ? mine(['procurement', 'quotes', 'tender', 'po']) + state.requests.filter((r) => r.need?.cancel && !r.need.cancel.decidedAt).length : 0, storeCount: store ? mine(['store', 'handover', 'receipt']) : 0 };
}
/** احتياجات المستودع: ما يقف عند المستودع أو التسليم أو الاستلام لهذا المستودع/المقر، وما مرّ به */
export function storeNeeds(state: State, storeIds: string[], siteIds: string[]): Request[] {
  return state.requests.filter((r) => r.need && ((r.need.storeId && storeIds.includes(r.need.storeId)) || (!r.need.storeId && r.need.kind === 'material' && siteIds.includes(r.need.siteId)))).sort((a, b) => b.updatedAt - a.updatedAt);
}
export interface NeedStage { key: string; title: T2; state: 'done' | 'current' | 'pending' | 'skipped'; ref?: string; at?: number; sub?: T2; segment: NeedSegment }
/** مراحل الرحلة كما يراها الطالب: الخطوات بمراجعها من النظام المرجعي وموعدها المتوقع، مجمَّعة في ستة مقاطع (الطلب، الاعتماد، التجهيز، الشراء، التوريد، التسليم) */
export function needStages(r: Request): NeedStage[] {
  const p = r.need?.procurement; const h = r.need?.handover; const n = (x?: number) => (x ? x.toLocaleString('en') : '');
  return r.steps.filter((s) => s.key !== 'submit').map((s) => {
    const st: NeedStage['state'] = s.status === 'done' ? 'done' : s.status === 'current' ? 'current' : s.status === 'skipped' ? 'skipped' : s.status === 'returned' || s.status === 'rejected' ? 'current' : 'pending';
    const done = s.status === 'done';
    /* v0.12: مرجع كل دفعة من محضرها وسندها */
    const rc = s.role === 'receipt' || s.role === 'receiptSign' ? (p?.receipts || []).find((x) => x.batch === (s.batch || 1)) : undefined; const hv = s.role === 'handoverSign' || s.role === 'handover' ? (r.need?.handovers || []).find((x) => (x.batch || 1) === (s.batch || 1)) : undefined;
    const ref = s.role === 'pr' ? p?.prNo : s.role === 'po' ? p?.poNo : s.role === 'budget' ? p?.reservation?.no || p?.budgetRef : s.role === 'budgetTopUp' ? (p?.reservation?.topUps || []).slice(-1)[0]?.no : s.role === 'tender' ? p?.tender?.ref : s.role === 'receipt' || s.role === 'receiptSign' ? (rc?.no ? `${rc.no}${rc.erpNo ? ` · ${rc.erpNo}` : ''}` : undefined) : s.role === 'handoverSign' || s.role === 'handover' ? hv?.number || h?.number : s.role === 'procurement' && done ? p?.contractNo : undefined;
    const prog = r.need ? receiptProgress(r.need) : undefined;
    const sub = s.role === 'po' && p?.expectedAt ? t2(`التوريد المتوقع ${p.expectedAt}`, `expected ${p.expectedAt}`)
      : (s.role === 'receipt' || s.role === 'receiptSign') && done && rc ? (s.outcome === 'closed' ? t2('أُقفل المتبقي بلا توريد', 'remainder closed, not delivered') : rc.result === 'rejected' ? t2('لم يُقبل التوريد', 'delivery not accepted') : rc.kind === 'material' && prog ? t2(`استُلم ${prog.received} من ${prog.total}${rc.result === 'partial' || rc.result === 'note' ? ' · بملاحظات' : ''}`, `received ${prog.received} of ${prog.total}${rc.result === 'partial' || rc.result === 'note' ? ' · with notes' : ''}`) : t2(rc.last ? 'اكتمل الاستلام' : 'دفعة مستلمة', rc.last ? 'receipt complete' : 'batch received'))
      : s.role === 'receiptSign' && !done ? t2('بانتظار توقيع اللجنة', 'awaiting committee signatures')
      : s.role === 'receipt' && !done && (s.batch || 1) > 1 && prog ? t2(`استُلم ${prog.received} من ${prog.total}؛ الدفعة ${s.batch}`, `received ${prog.received} of ${prog.total}; batch ${s.batch}`)
      : s.role === 'store' && s.outcome ? (s.outcome === 'available' ? t2('متوفر وحُجز', 'available, reserved') : s.outcome === 'partial' ? t2('توفر جزئي', 'partly available') : t2('غير متوفر؛ إلى الشراء', 'not in stock; to purchase'))
      : s.role === 'entity' && s.outcome === 'provided' ? t2('متوفر لدى الجهة؛ وُفِّر من رصيدها بلا شراء', 'available with the entity; provided from its pool, no purchase')
      : s.role === 'awardApproval' && done && s.actorId === 'system' ? t2('اعتُمدت آلياً: لا انحراف', 'approved automatically: no deviation')
      : s.role === 'entity' && done && r.need?.estimatedValue ? t2(`التقدير ${n(r.need.estimatedValue)} ريال`, `estimate SAR ${n(r.need.estimatedValue)}`)
      : s.role === 'procurement' && done && p?.methodName ? t2(`${p.methodName.ar} · ${n(p.estimatedValue)} ريال`, `${p.methodName.en} · SAR ${n(p.estimatedValue)}`)
      : s.role === 'budget' && done && p?.reservation ? t2(`حُجز ${n(p.reservation.amount)} ريال`, `SAR ${n(p.reservation.amount)} reserved`)
      : s.role === 'budgetTopUp' && done && p?.reservation ? t2(`زيد الحجز إلى ${n(p.reservation.amount)} ريال`, `reservation raised to SAR ${n(p.reservation.amount)}`)
      : s.role === 'quotes' && done && p?.offers ? t2(`${p.offers.count} عروض`, `${p.offers.count} offers`)
      : (s.role === 'evaluator' || s.role === 'tender') && done && p?.recommendation ? t2(`${p.recommendation.offer}${p.recommendation.amount ? ` · ${n(p.recommendation.amount)} ريال` : ''}`, `${p.recommendation.offer}${p.recommendation.amount ? ` · SAR ${n(p.recommendation.amount)}` : ''}`)
      : s.role === 'awardApproval' && done && p?.recommendation ? t2(`رست على ${p.recommendation.offer}`, `awarded to ${p.recommendation.offer}`)
      : s.role === 'pr' && done && p?.award ? t2(`${p.award.supplier} · ${n(p.award.amount)} ريال`, `${p.award.supplier} · SAR ${n(p.award.amount)}`) : undefined;
    return { key: s.key, title: s.title, state: st, ref: ref || s.ref, at: s.at, sub, segment: s.role ? SEGMENT_OF[s.role] : 'handover' };
  });
}
/** بطاقة الاحتياج: ملخص المستفيد والفئة والبنود والمقر لعرضه في المهمة والطلب */
export function needSummary(state: State, r: Request, lang: 'ar' | 'en'): { beneficiary: string; site: string; lines: string; category: string } {
  const n = r.need!; const content = needContent(state); const b = personById(state, n.beneficiaryId); const cat = categoryOf(content, n.categoryId); const site = content.sites.find((s) => s.id === n.siteId);
  return { beneficiary: b ? (lang === 'ar' ? b.name : b.nameEn) : '', site: site ? (lang === 'ar' ? site.name.ar : site.name.en) : n.siteId, lines: n.lines.map((l) => `${lang === 'ar' ? l.name.ar : l.name.en} × ${l.qty}`).join(lang === 'ar' ? '، ' : ', '), category: cat ? (lang === 'ar' ? cat.name.ar : cat.name.en) : n.categoryId };
}
