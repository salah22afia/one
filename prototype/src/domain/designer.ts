/* v0.15 مصمّم الخدمات (بطاقة القدرة CAP-02، D-032 وD-033 وD-034): الخدمة المهيّأة تُقرأ من الإصدار الساري لسياسة المصمّم،
   ونموذجها يُولَّد من لوحة الحقول الثابتة، وتحققاتها من المعجم الثابت برسالة بلغتين، ومسارها يُبنى بمحرك CAP-01 نفسه، وطلبها طلبٌ كأي طلب —
   الموظف لا يعرف أيّ الخدمات مهيّأة وأيّها مبنيّة (المبدأ 6). دوال نقية على الحالة.
   v0.16 (خريطة الحالات CAP-02 §3-ب): من يطلب ومتى (الأهلية والنافذة والحصة والشروط المسبقة والجمهور التجريبي)، ولوحة الحقول الموسّعة (وقت، نعم/لا، مقياس، جدول، ملف الموظف، محسوب، توقيع)
   والشرط المركّب والقيم الافتراضية والتحقق بين الحقول، والمسار بنماذج الخطوات (خيارات قرار وحقول وتعديل وقائمة تحقق) وأنواع الخطوات كلها والمعتمد من حقل وبالشريحة والمالك،
   والمخرجات (مستند بقالب دمج، وسجل مخصص، وعقد، وخدمة تالية، وتقويم) والإشعارات المهيّأة والتذكيرات، والمحاكاة، والقوالب والنسخ والتصدير. */
import type { State, Person, Field, T2, Request, Step, RegisterEntry, Doc, CalEvent } from './types';
import { activeVersion, toISO, liveNeed, inScope, addDays, daysBetween, workingDaysBetween, condLeaves, primaryOutput, type PolicyVersion, type DesignerContent, type ConfiguredService, type FormField, type FormSection, type Cond, type CondLeaf, type ChoiceOption, type ErpListKey, type Route, type Loc, type RouteStep, type AgentRule, type ProfileKey, type ServiceOutput, type StepForm, type StepOutcome, type NotifyRule, type TableColumn } from './policy';
import { buildSteps, createRequest, teamOf, personById, unitById, positionById, notifyPeople, lineManagerOf, holderOf, unitOf, requestTitle, patchRequest, orgHeadPositionId, completeCurrent as engineCompleteCurrent, type BuiltSteps } from './engine';
import { runContract, contractById, contractReady } from './contracts';
import { DOMAINS } from '../data/catalog';

const t2 = (ar: string, en: string): T2 => ({ ar, en });
const EMPTY: DesignerContent = { services: [] };
export type FormValue = string | string[] | boolean;
export type FormValues = Record<string, FormValue>;
export type TableRow = Record<string, string>;
export const DAY = 86400000;

/* ——— القراءة ——— */
export function designerVersion(state: State, today = toISO(Date.now())): PolicyVersion { return activeVersion(state.designer, today); }
export function designerContent(state: State, today = toISO(Date.now())): DesignerContent { return designerVersion(state, today).content.designer || EMPTY; }
/** الخدمات المهيّأة السارية اليوم لمستأجر البوابة (D-033: لا يقرأ مستأجر شيئاً من غيره) */
export function liveServices(state: State, today = toISO(Date.now())): ConfiguredService[] { return liveNeed(designerContent(state, today).services, today).filter((s) => s.tenant === state.tenant.id); }
/** ما يراه هذا الموظف من الخدمات المهيّأة: السارية، وما كان جمهورها التجريبي يشمله (1.10) */
export function visibleServicesFor(state: State, person: Person, today = toISO(Date.now())): ConfiguredService[] { return liveServices(state, today).filter((s) => inPilot(state, person, s)); }
export function inPilot(state: State, person: Person, svc: ConfiguredService): boolean {
  if (svc.visibility !== 'pilot') return true; if (person.persona === 'admin') return true;
  const p = svc.pilot || {}; if ((p.personIds || []).includes(person.id)) return true;
  const my = unitOf(state, person); if (!my) return false; const units = new Set(p.unitIds || []); let u = my; while (u) { if (units.has(u.id)) return true; const parent = u.parentId ? unitById(state, u.parentId) : undefined; if (!parent) break; u = parent; }
  return false;
}
export function configuredById(state: State, id?: string, today = toISO(Date.now())): ConfiguredService | undefined { return id ? liveServices(state, today).find((s) => s.id === id) : undefined; }
/** الخدمة كما التقطها طلبٌ قُدِّم بإصدار بعينه (D-009): الطلب الجاري يكمل بإصداره */
export function serviceOfRequest(state: State, r: Request): ConfiguredService | undefined {
  if (!r.configured) return undefined;
  const v = state.designer.versions.find((x) => x.number === r.configured!.version) || designerVersion(state);
  return v.content.designer?.services.find((s) => s.id === r.configured!.serviceId) || configuredById(state, r.configured.serviceId);
}
/** من يجوز طلب الخدمة باسمه: فريق المدير، أو موظف سابق من قائمة النظام المرجعي (DC-02)، أو أي موظف (شؤون الموظفين)، أو وحدة رئيس الوحدة */
export function beneficiariesFor(state: State, person: Person, svc: ConfiguredService): { id: string; name: T2; sub?: T2 }[] {
  const asPerson = (p: Person) => ({ id: p.id, name: { ar: p.name, en: p.nameEn }, sub: { ar: p.title, en: p.titleEn } });
  if (svc.onBehalf === 'team') return teamOf(state, person).map(asPerson);
  if (svc.onBehalf === 'former') return (state.erp.formerEmployees || []).map((f) => ({ id: f.id, name: f.name, sub: { ar: `${f.empNo} · غادر ${f.leftAt}`, en: `${f.empNo} · left ${f.leftAt}` } }));
  if (svc.onBehalf === 'hrAny') { const u = unitOf(state, person); const hr = u && (u.id === 'O-211' || u.parentId === 'O-210' || u.id === 'O-210' || u.id === 'O-200'); return hr || person.persona === 'admin' ? state.people.filter((p) => p.id !== person.id && p.positionId).map(asPerson) : []; }
  if (svc.onBehalf === 'unit') { const my = unitOf(state, person); if (!my || my.chiefPositionId !== person.positionId) return []; const inTree = (uid?: string): boolean => { let u = uid ? unitById(state, uid) : undefined; while (u) { if (u.id === my.id) return true; u = u.parentId ? unitById(state, u.parentId) : undefined; } return false; }; return state.people.filter((p) => p.id !== person.id && p.positionId && inTree(positionById(state, p.positionId)?.unitId)).map(asPerson); }
  return [];
}

/* ——— القوائم المسمّاة من النظام المرجعي (P-10): الحقل يقرأها بالمفتاح ولا تُكتب يدوياً؛ إضافة قائمة جديدة شيفرةٌ وبطاقة ——— */
export const ERP_LIST_TITLE: Record<ErpListKey, T2> = {
  units: t2('الوحدات التنظيمية', 'Organisational units'), positions: t2('المناصب', 'Positions'), groups: t2('مجموعات الموظفين', 'Employee groups'), subgroups: t2('المجموعات الفرعية', 'Employee subgroups'), locations: t2('مقار العمل', 'Work locations'),
  absenceTypes: t2('أنواع الغياب والحضور', 'Absence and attendance types'), storageLocations: t2('مواقع التخزين', 'Storage locations'), suppliers: t2('المورّدون (شركاء الأعمال)', 'Suppliers (business partners)'), contracts: t2('العقود الإطارية', 'Framework contracts'), items: t2('الأصناف', 'Materials'), currencies: t2('العملات', 'Currencies'), countries: t2('الدول', 'Countries'),
};
const CURRENCIES: ChoiceOption[] = [{ id: 'SAR', name: t2('ريال سعودي', 'Saudi riyal') }, { id: 'AED', name: t2('درهم إماراتي', 'UAE dirham') }, { id: 'USD', name: t2('دولار أمريكي', 'US dollar') }, { id: 'EUR', name: t2('يورو', 'Euro') }, { id: 'GBP', name: t2('جنيه إسترليني', 'Pound sterling') }];
const COUNTRIES: ChoiceOption[] = [{ id: 'SA', name: t2('المملكة العربية السعودية', 'Saudi Arabia') }, { id: 'AE', name: t2('الإمارات العربية المتحدة', 'United Arab Emirates') }, { id: 'BH', name: t2('البحرين', 'Bahrain') }, { id: 'KW', name: t2('الكويت', 'Kuwait') }, { id: 'OM', name: t2('عُمان', 'Oman') }, { id: 'QA', name: t2('قطر', 'Qatar') }, { id: 'GB', name: t2('المملكة المتحدة', 'United Kingdom') }, { id: 'US', name: t2('الولايات المتحدة', 'United States') }, { id: 'FR', name: t2('فرنسا', 'France') }, { id: 'DE', name: t2('ألمانيا', 'Germany') }, { id: 'EG', name: t2('مصر', 'Egypt') }, { id: 'JO', name: t2('الأردن', 'Jordan') }];
export function erpListOptions(state: State, key: ErpListKey): ChoiceOption[] {
  switch (key) {
    case 'units': return state.org.units.map((u) => ({ id: u.id, name: u.name }));
    case 'positions': return state.org.positions.map((p) => ({ id: p.id, name: p.title }));
    case 'groups': return state.groups.map((g) => ({ id: g.id, name: g.name }));
    case 'subgroups': return state.groups.flatMap((g) => g.subgroups.map((s) => ({ id: s.id, name: s.name })));
    case 'locations': return [{ id: 'riyadh', name: t2('الرياض', 'Riyadh') }, { id: 'abudhabi', name: t2('أبوظبي', 'Abu Dhabi') }];
    case 'absenceTypes': return state.erp.absenceTypes.map((a) => ({ id: `${a.grouping}/${a.subtype}`, name: a.name }));
    case 'storageLocations': return state.erp.storageLocations.map((s) => ({ id: s.id, name: s.name }));
    case 'suppliers': return (state.erp.suppliers || []).filter((s) => !s.blocked).map((s) => ({ id: s.id, name: s.name }));
    case 'contracts': return (state.erp.contracts || []).map((c) => ({ id: c.id, name: c.name }));
    case 'items': return state.erp.items.map((i) => ({ id: i.id, name: i.name }));
    case 'currencies': return CURRENCIES;
    case 'countries': return COUNTRIES;
  }
}
/** خيارات حقل الاختيار السارية: اليدوية بلا الملغاة، أو قائمة النظام المرجعي */
export function fieldOptions(state: State, f: FormField, today = toISO(Date.now())): ChoiceOption[] {
  if (f.source === 'erp' && f.erpList) return erpListOptions(state, f.erpList);
  return liveNeed(f.options || [], today);
}
/** خيارات حقول الهيكل: الأشخاص أو المناصب أو الوحدات بنطاق المرشّح (وحدتي، قطاعي، الكل) */
export function orgOptions(state: State, f: FormField, requester: Person): ChoiceOption[] {
  const scope = f.orgFilter || 'all';
  const myUnit = requester.positionId ? positionById(state, requester.positionId)?.unitId : undefined;
  const chain = new Set<string>(); let u = myUnit ? unitById(state, myUnit) : undefined; while (u) { chain.add(u.id); u = u.parentId ? unitById(state, u.parentId) : undefined; }
  const sector = [...chain].map((id) => unitById(state, id)).find((x) => x?.level === 'sector' || x?.level === 'sg');
  const within = (unitId?: string): boolean => { if (scope === 'all' || !unitId) return scope === 'all'; if (scope === 'unit') return unitId === myUnit; let x = unitById(state, unitId); while (x) { if (sector && x.id === sector.id) return true; x = x.parentId ? unitById(state, x.parentId) : undefined; } return false; };
  if (f.kind === 'unit') return state.org.units.filter((x) => scope === 'all' || within(x.id)).map((x) => ({ id: x.id, name: x.name }));
  if (f.kind === 'position') return state.org.positions.filter((p) => within(p.unitId)).map((p) => ({ id: p.id, name: p.title }));
  return state.people.filter((p) => p.positionId && within(positionById(state, p.positionId)?.unitId)).map((p) => ({ id: p.id, name: { ar: p.name, en: p.nameEn } }));
}

/* ——— v0.16 ملف الموظف: القيم التي يقرأها حقل «بيانات من ملف الموظف» (بعقد قراءة الموظف؛ الراتب بعقد قراءة الراتب) ——— */
export const PROFILE_TITLE: Record<ProfileKey, T2> = { name: t2('الاسم', 'Name'), empNo: t2('الرقم الوظيفي', 'Employee number'), title: t2('المنصب', 'Position'), unit: t2('الوحدة', 'Unit'), hiredAt: t2('تاريخ التعيين', 'Hire date'), serviceYears: t2('سنوات الخدمة', 'Years of service'), location: t2('مقر العمل', 'Work location'), nationality: t2('الجنسية', 'Nationality'), group: t2('مجموعة الموظفين', 'Employee group'), manager: t2('المدير المباشر', 'Line manager'), basicSalary: t2('الراتب الأساسي', 'Basic salary') };
export function profileValue(state: State, p: Person, key: ProfileKey, lang: 'ar' | 'en'): string {
  const ar = lang === 'ar';
  switch (key) {
    case 'name': return ar ? p.name : p.nameEn;
    case 'empNo': return `GCC-${p.empNo}`;
    case 'title': return ar ? p.title : p.titleEn;
    case 'unit': return ar ? p.unit : p.unitEn;
    case 'hiredAt': return p.hiredAt ? toISO(p.hiredAt) : '';
    case 'serviceYears': return p.hiredAt ? String(Math.floor((Date.now() - p.hiredAt) / (365.25 * DAY))) : '';
    case 'location': return (p.location || 'riyadh') === 'abudhabi' ? (ar ? 'أبوظبي' : 'Abu Dhabi') : ar ? 'الرياض' : 'Riyadh';
    case 'nationality': { const c = COUNTRIES.find((x) => x.id === p.nationality); return c ? (ar ? c.name.ar : c.name.en) : p.nationality || ''; }
    case 'group': { const g = state.groups.find((x) => x.id === p.group); return g ? (ar ? g.name.ar : g.name.en) : p.group || ''; }
    case 'manager': { const m = lineManagerOf(state, p); return m ? (ar ? m.name : m.nameEn) : ''; }
    case 'basicSalary': { const ps = (state.payslips[p.id] || [])[0]; return ps ? `${ps.gross.toLocaleString('en')} SAR` : ''; }
  }
}
export function profileRaw(state: State, p: Person, key: ProfileKey): string {
  if (key === 'location') return p.location || 'riyadh'; if (key === 'group') return p.group || ''; if (key === 'nationality') return p.nationality || ''; if (key === 'basicSalary') { const ps = (state.payslips[p.id] || [])[0]; return ps ? String(ps.gross) : ''; }
  return profileValue(state, p, key, 'ar');
}
/** صفات الطالب التي تقرأها الشروط بـ @ */
export const ATTR_KEYS = ['group', 'subgroup', 'location', 'gender', 'parent', 'outsideHome', 'serviceMonths', 'level', 'nationality'] as const;
export type AttrKey = (typeof ATTR_KEYS)[number];
export const ATTR_TITLE: Record<AttrKey, T2> = { group: t2('مجموعة الموظفين', 'Employee group'), subgroup: t2('المجموعة الفرعية', 'Employee subgroup'), location: t2('مقر العمل', 'Work location'), gender: t2('الجنس', 'Gender'), parent: t2('لديه أبناء', 'Has children'), outsideHome: t2('يعمل خارج موطنه', 'Works outside home country'), serviceMonths: t2('أشهر الخدمة', 'Months of service'), level: t2('مستوى وحدة الطالب', "Requester's unit level"), nationality: t2('الجنسية', 'Nationality') };
export function attrValue(state: State, p: Person, key: AttrKey): string {
  switch (key) {
    case 'group': return p.group || ''; case 'subgroup': return p.subgroup || ''; case 'location': return p.location || 'riyadh'; case 'gender': return p.gender || ''; case 'parent': return p.parent ? 'true' : ''; case 'outsideHome': return p.outsideHome ? 'true' : '';
    case 'serviceMonths': return p.hiredAt ? String(Math.floor((Date.now() - p.hiredAt) / (30.44 * DAY))) : '0'; case 'level': return unitOf(state, p)?.level || ''; case 'nationality': return p.nationality || '';
  }
}

/* ——— الشرط بلا سكربت: ورقة أو مجموعة (كل / أيّ)؛ الحقل من النموذج، أو @صفة الطالب، أو #خطوة (نتيجتها أو حقل من نموذجها) ——— */
export interface CondCtx { state?: State; person?: Person; steps?: Step[]; svc?: ConfiguredService }
function leafValue(leaf: CondLeaf, values: FormValues, ctx?: CondCtx): FormValue | undefined {
  const f = leaf.field;
  if (f.startsWith('@')) return ctx?.state && ctx.person ? attrValue(ctx.state, ctx.person, f.slice(1) as AttrKey) : undefined;
  if (f.startsWith('#')) { const [sid, fid] = f.slice(1).split('.'); const st = (ctx?.steps || []).find((x) => x.id === sid); if (!st) return undefined; if (!fid || fid === 'outcome') return st.status === 'done' ? st.outcome || (st.mode === 'approve' ? '__approved' : '') : undefined; return st.values?.[fid]; }
  return values[f];
}
export function leafHolds(leaf: CondLeaf, values: FormValues, ctx?: CondCtx): boolean {
  const v = leafValue(leaf, values, ctx);
  const s = Array.isArray(v) ? v : typeof v === 'boolean' ? (v ? 'true' : '') : v === undefined ? '' : String(v);
  const has = Array.isArray(s) ? s.length > 0 : !!s;
  switch (leaf.op) {
    case 'set': return has; case 'unset': return !has;
    case 'eq': return Array.isArray(s) ? s.includes(leaf.value || '') : s === (leaf.value || '');
    case 'ne': return Array.isArray(s) ? !s.includes(leaf.value || '') : s !== (leaf.value || '');
    case 'in': return (leaf.value || '').split(',').map((x) => x.trim()).some((x) => (Array.isArray(s) ? s.includes(x) : s === x));
    case 'gt': return has && Number(s) > Number(leaf.value); case 'lt': return has && Number(s) < Number(leaf.value);
    case 'gte': return has && Number(s) >= Number(leaf.value); case 'lte': return has && Number(s) <= Number(leaf.value);
  }
  return true;
}
export function condHolds(c: Cond | undefined, values: FormValues, ctx?: CondCtx): boolean {
  if (!c) return true;
  if ('field' in c) return leafHolds(c, values, ctx);
  const all = c.all || [], any = c.any || [];
  return (all.length ? all.every((l) => leafHolds(l, values, ctx)) : true) && (any.length ? any.some((l) => leafHolds(l, values, ctx)) : true);
}
/** هل يعتمد الشرط على نتائج خطوات (فلا يُحسم إلا لحظة الوصول)؟ */
export function condDeferred(c?: Cond): boolean { return condLeaves(c).some((l) => l.field.startsWith('#')); }
export const OP_TITLE: Record<CondLeaf['op'], T2> = { eq: t2('يساوي', 'is'), ne: t2('لا يساوي', 'is not'), in: t2('ضمن', 'in'), gt: t2('أكبر من', '>'), lt: t2('أقل من', '<'), gte: t2('من', '≥'), lte: t2('حتى', '≤'), set: t2('له قيمة', 'is set'), unset: t2('بلا قيمة', 'is empty') };
/** نص الشرط بلغة النموذج: «الجهة يساوي سفارة و اللغة يساوي إنجليزية» */
export function condText(state: State, svc: ConfiguredService, c: Cond | undefined, lang: 'ar' | 'en'): string {
  if (!c) return lang === 'ar' ? 'دائماً' : 'always';
  const fields = allFields(svc);
  const leaf = (l: CondLeaf): string => {
    let name = l.field; let val = l.value || '';
    if (l.field.startsWith('@')) { const k = l.field.slice(1) as AttrKey; name = ATTR_TITLE[k] ? ATTR_TITLE[k][lang] : k; if (k === 'group') val = state.groups.find((g) => g.id === val)?.name[lang] || val; if (k === 'location') val = val === 'abudhabi' ? (lang === 'ar' ? 'أبوظبي' : 'Abu Dhabi') : val === 'riyadh' ? (lang === 'ar' ? 'الرياض' : 'Riyadh') : val; }
    else if (l.field.startsWith('#')) { const [sid, fid] = l.field.slice(1).split('.'); const i = svc.route.findIndex((x) => x.id === sid); const st = svc.route[i]; const sname = st ? (st.title ? st.title[lang] : `${lang === 'ar' ? 'الخطوة' : 'step'} ${i + 1}`) : sid; if (!fid || fid === 'outcome') { name = lang === 'ar' ? `نتيجة ${sname}` : `${sname} outcome`; const o = st?.form?.outcomes?.find((x) => x.id === val); if (o) val = o.name[lang]; if (val === '__approved') val = lang === 'ar' ? 'اعتُمدت' : 'approved'; } else { const sf = st?.form?.fields?.find((x) => x.id === fid); name = `${sname} · ${sf ? sf.label[lang] : fid}`; } }
    else { const f = fields.find((x) => x.id === l.field); if (f) { name = f.label[lang] || f.id; if ((f.kind === 'choice' || f.kind === 'multichoice') && l.op !== 'in') { const o = fieldOptions(state, f).find((x) => x.id === val); if (o) val = o.name[lang]; } if (f.kind === 'yesno' || f.kind === 'checkbox') val = val === 'true' || val === 'yes' ? (lang === 'ar' ? 'نعم' : 'yes') : lang === 'ar' ? 'لا' : 'no'; } }
    return `${name} ${OP_TITLE[l.op][lang]}${l.op === 'set' || l.op === 'unset' ? '' : ` ${val}`}`;
  };
  if ('field' in c) return leaf(c);
  const parts: string[] = []; if (c.all?.length) parts.push(c.all.map(leaf).join(lang === 'ar' ? ' و' : ' and ')); if (c.any?.length) parts.push(`(${c.any.map(leaf).join(lang === 'ar' ? ' أو ' : ' or ')})`);
  return parts.join(lang === 'ar' ? ' و' : ' and ') || (lang === 'ar' ? 'دائماً' : 'always');
}

/* ——— الأقسام والحقول ——— */
export function visibleSections(svc: ConfiguredService, values: FormValues, today = toISO(Date.now()), ctx?: CondCtx): { section: FormSection; fields: FormField[] }[] {
  return liveNeed(svc.sections, today).map((section) => ({ section, fields: liveNeed(section.fields, today).filter((f) => condHolds(f.rules?.showIf, values, ctx)) })).filter((x) => x.fields.length);
}
export function allFields(svc: ConfiguredService, today = toISO(Date.now())): FormField[] { return liveNeed(svc.sections, today).flatMap((s) => liveNeed(s.fields, today)); }
export const INPUT_KINDS = new Set(['text', 'textarea', 'number', 'money', 'date', 'time', 'daterange', 'choice', 'multichoice', 'yesno', 'scale', 'person', 'position', 'unit', 'attachment', 'table', 'checkbox', 'signature']);
export function isInput(f: FormField): boolean { return INPUT_KINDS.has(f.kind); }
export function parseRows(v: FormValue | undefined): TableRow[] { if (typeof v !== 'string' || !v) return []; try { const x = JSON.parse(v); return Array.isArray(x) ? x : []; } catch { return []; } }
/** القيمة المحسوبة بمعادلة من المعجم (2.7): بلا سكربت — مجموع وفرق وضرب وأيام ونسبة وعدد */
export function computeValue(state: State, svc: ConfiguredService, f: FormField, values: FormValues, requester?: Person): string {
  const fm = f.formula; if (!fm) return '';
  const fields = allFields(svc); const num = (id: string): number => { const g = fields.find((x) => x.id === id); const v = values[id]; if (g?.kind === 'table') { const rows = parseRows(v); const col = (g.columns || []).find((c) => c.kind === 'money' || c.kind === 'number'); return col ? rows.reduce((n, r) => n + (Number(r[col.id]) || 0), 0) : rows.length; } if (g?.kind === 'computed') return Number(computeValue(state, svc, g, values, requester)) || 0; if (g?.kind === 'profile' && requester) return Number(profileRaw(state, requester, g.profileKey || 'serviceYears')) || 0; return typeof v === 'string' ? Number(v) || 0 : 0; };
  const date = (id: string): string => { const v = values[id]; if (typeof v !== 'string') return ''; return v.includes('|') ? v.split('|')[0] : v; };
  const dateEnd = (id: string): string => { const v = values[id]; if (typeof v !== 'string') return ''; return v.includes('|') ? v.split('|')[1] : v; };
  switch (fm.op) {
    case 'sum': return String(fm.fields.reduce((n, id) => n + num(id), 0));
    case 'diff': return fm.fields.length ? String(num(fm.fields[0]) - fm.fields.slice(1).reduce((n, id) => n + num(id), 0)) : '';
    case 'product': return fm.fields.length ? String(fm.fields.reduce((n, id) => n * num(id), 1)) : '';
    case 'divide': { const a = num(fm.fields[0] || ''); const b = num(fm.fields[1] || ''); return b ? String(Math.round((a / b) * 100) / 100) : ''; }
    case 'percent': return fm.fields.length ? String(Math.round(num(fm.fields[0]) * (fm.percent ?? 0)) / 100) : '';
    case 'count': return String(parseRows(values[fm.fields[0] || '']).length);
    case 'daysBetween': case 'workingDaysBetween': {
      const a = fm.fields.length === 1 ? date(fm.fields[0]) : date(fm.fields[0] || ''); const b = fm.fields.length === 1 ? dateEnd(fm.fields[0]) : date(fm.fields[1] || '');
      if (!a || !b || b < a) return '';
      if (fm.op === 'workingDaysBetween') { const cal = state.policy.versions[0]?.content.calendar; const loc: Loc = requester?.location || 'riyadh'; return cal ? String(workingDaysBetween(a, b, loc, cal)) : String(daysBetween(a, b)); }
      return String(daysBetween(a, b));
    }
  }
  return '';
}
/** القيم الافتراضية (2.10) لحقول لم تُملأ بعد: ثابتة، أو اليوم، أو من ملف الموظف، أو من حقل آخر */
export function withDefaults(state: State, svc: ConfiguredService, requester: Person, values: FormValues, today = toISO(Date.now())): FormValues {
  const out = { ...values };
  for (const f of allFields(svc, today)) {
    if (!f.default || out[f.id] !== undefined) continue; const d = f.default;
    if (d.kind === 'static' && d.value !== undefined) out[f.id] = f.kind === 'multichoice' ? d.value.split(',').map((x) => x.trim()).filter(Boolean) : f.kind === 'checkbox' || f.kind === 'signature' ? d.value === 'true' : d.value;
    else if (d.kind === 'today') out[f.id] = f.kind === 'daterange' ? `${today}|${today}` : today;
    else if (d.kind === 'profile' && d.profileKey) out[f.id] = profileRaw(state, requester, d.profileKey);
    else if (d.kind === 'field' && d.field && out[d.field] !== undefined) out[f.id] = out[d.field];
    else if (d.kind === 'me') out[f.id] = f.kind === 'person' ? requester.id : f.kind === 'position' ? requester.positionId || '' : f.kind === 'unit' ? unitOf(state, requester)?.id || '' : '';
  }
  return out;
}
/** القيم الفعلية للعرض والشروط: ما ملأه الموظف + ما يُقرأ من ملفه + ما يُحسب */
export function effectiveValues(state: State, svc: ConfiguredService, requester: Person | undefined, values: FormValues, today = toISO(Date.now())): FormValues {
  const out = { ...values };
  for (const f of allFields(svc, today)) { if (f.kind === 'profile' && requester && f.profileKey) out[f.id] = profileRaw(state, requester, f.profileKey); }
  for (const f of allFields(svc, today)) { if (f.kind === 'computed') out[f.id] = computeValue(state, svc, f, out, requester); }
  return out;
}
export function readOnlyNow(f: FormField, values: FormValues, ctx?: CondCtx): boolean { return !!f.rules?.readOnlyIf && condHolds(f.rules.readOnlyIf, values, ctx); }

/* ——— معجم التحققات: رسالة بلغتين تُكتب مرة وتظهر في مكانها (C-UX-11) ——— */
const PATTERN: Record<string, { re: RegExp; msg: T2 }> = {
  email: { re: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, msg: t2('اكتب بريداً إلكترونياً صحيحاً (مثل name@gcc-sg.org)', 'Enter a valid email address (e.g. name@gcc-sg.org)') },
  phone: { re: /^\+?\d{8,15}$/, msg: t2('اكتب رقم هاتف بالأرقام فقط (8 إلى 15 رقماً، ويجوز + في البداية)', 'Enter a phone number in digits only (8–15 digits, a leading + is allowed)') },
  nationalId: { re: /^\d{10}$/, msg: t2('رقم الهوية عشرة أرقام', 'The ID number is ten digits') },
  iban: { re: /^[A-Z]{2}\d{2}[A-Z0-9]{18,30}$/, msg: t2('الآيبان يبدأ بحرفي الدولة ثم رقمين ثم 18 خانة فأكثر (مثل SA0380000000608010167519)', 'The IBAN starts with the country code, two check digits, then 18+ characters (e.g. SA0380000000608010167519)') },
  plate: { re: /^[ء-يA-Z](\s?[ء-يA-Z]){0,2}\s?\d{1,4}$/i, msg: t2('رقم اللوحة: أحرف ثم أرقام (مثل أ ب ج 1234)', 'Plate number: letters then digits (e.g. ABC 1234)') },
  url: { re: /^https?:\/\/[^\s]+\.[^\s]{2,}$/i, msg: t2('اكتب رابطاً كاملاً يبدأ بـ https://', 'Enter a full link starting with https://') },
};
export interface FieldError { field: string; text: T2 }
export function isEmptyValue(f: FormField, v: FormValue | undefined): boolean {
  if (v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) return true;
  if (f.kind === 'checkbox' || f.kind === 'signature') return v !== true;
  if (f.kind === 'daterange') { const [a, b] = String(v).split('|'); return !a || !b; }
  if (f.kind === 'table') return parseRows(v).length === 0;
  return false;
}
/** التحقق من نموذج (الطلب أو نموذج خطوة): يقبل قائمة حقول مباشرة */
export function validateFields(state: State, fields: FormField[], values: FormValues, today = toISO(Date.now()), requester?: Person, ctx?: CondCtx, opts?: { svcId?: string; excludeRequestId?: string }): FieldError[] {
  const out: FieldError[] = []; const push = (f: FormField, text: T2) => { if (!out.some((e) => e.field === f.id)) out.push({ field: f.id, text }); };
  const loc: Loc = requester?.location || 'riyadh'; const cal = state.policy.versions[0]?.content.calendar;
  for (const f of fields) {
    if (!isInput(f)) continue;
    if (!condHolds(f.rules?.showIf, values, ctx)) continue;
    const r = f.rules || {}; const v = values[f.id];
    const empty = isEmptyValue(f, v);
    const required = !!r.required || (!!r.requiredIf && condHolds(r.requiredIf, values, ctx));
    if (required && empty) { push(f, f.kind === 'checkbox' ? t2('يلزم تأكيد هذا الإقرار', 'This declaration must be confirmed') : f.kind === 'signature' ? t2('يلزم التوقيع', 'A signature is required') : f.kind === 'attachment' ? t2('أرفق الملف المطلوب', 'Attach the required file') : f.kind === 'table' ? t2('أضف بنداً واحداً على الأقل', 'Add at least one row') : f.kind === 'choice' || f.kind === 'multichoice' || f.kind === 'person' || f.kind === 'position' || f.kind === 'unit' || f.kind === 'yesno' || f.kind === 'scale' ? t2('اختر قيمة', 'Choose a value') : t2('هذا الحقل مطلوب', 'This field is required')); continue; }
    if (empty) continue;
    if (f.kind === 'text' || f.kind === 'textarea') {
      const s = String(v);
      if (r.minLen && s.trim().length < r.minLen) push(f, t2(`اكتب ${r.minLen} أحرف على الأقل`, `Enter at least ${r.minLen} characters`));
      if (r.maxLen && s.length > r.maxLen) push(f, t2(`الحد الأقصى ${r.maxLen} حرفاً (كتبت ${s.length})`, `Maximum ${r.maxLen} characters (you wrote ${s.length})`));
      if (r.pattern && r.pattern !== 'none' && PATTERN[r.pattern] && !PATTERN[r.pattern].re.test(s.trim())) push(f, PATTERN[r.pattern].msg);
    }
    if (f.kind === 'number' || f.kind === 'money') {
      const n = Number(v); if (Number.isNaN(n)) { push(f, t2('اكتب رقماً', 'Enter a number')); continue; }
      if (r.min !== undefined && n < r.min) push(f, t2(`الحد الأدنى ${r.min.toLocaleString('en')}`, `Minimum ${r.min.toLocaleString('en')}`));
      if (r.max !== undefined && n > r.max) push(f, t2(`الحد الأقصى ${r.max.toLocaleString('en')}`, `Maximum ${r.max.toLocaleString('en')}`));
      if (f.kind === 'money' && (f.decimals ?? 2) === 0 && !Number.isInteger(n)) push(f, t2('بلا كسور', 'Whole numbers only'));
      if (r.lteField) { const o = fields.find((x) => x.id === r.lteField); const ov = Number(values[r.lteField]); if (o && !Number.isNaN(ov) && n > ov) push(f, t2(`لا يتجاوز «${o.label.ar}» (${ov.toLocaleString('en')})`, `Must not exceed “${o.label.en}” (${ov.toLocaleString('en')})`)); }
    }
    if (f.kind === 'time') { if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(v))) push(f, t2('اكتب الوقت بصيغة 24 ساعة (مثل 09:30)', 'Enter the time in 24-hour form (e.g. 09:30)')); }
    if (f.kind === 'scale') { const n = Number(v); const max = f.scaleMax || 5; if (Number.isNaN(n) || n < 1 || n > max) push(f, t2(`اختر درجة من 1 إلى ${max}`, `Choose a score from 1 to ${max}`)); }
    if (f.kind === 'date') {
      const d = String(v);
      if (r.dateRel === 'future' && d <= today) push(f, t2('اختر تاريخاً بعد اليوم', 'Choose a date after today'));
      if (r.dateRel === 'todayOrFuture' && d < today) push(f, t2('اختر اليوم أو تاريخاً بعده', 'Choose today or a later date'));
      if (r.dateRel === 'past' && d >= today) push(f, t2('اختر تاريخاً قبل اليوم', 'Choose a date before today'));
      if (r.afterField) { const o = fields.find((x) => x.id === r.afterField); const ov = values[r.afterField]; const od = typeof ov === 'string' ? (ov.includes('|') ? ov.split('|')[1] : ov) : ''; if (o && od && d <= od) push(f, t2(`يكون بعد «${o.label.ar}» (${od})`, `Must be after “${o.label.en}” (${od})`)); }
    }
    if (f.kind === 'daterange') {
      const [a, b] = String(v).split('|');
      if (b < a) push(f, t2('تاريخ النهاية قبل البداية', 'The end date is before the start'));
      else {
        if (r.dateRel === 'future' && a <= today) push(f, t2('تبدأ المدة بعد اليوم', 'The span starts after today'));
        if (r.dateRel === 'todayOrFuture' && a < today) push(f, t2('تبدأ المدة اليوم أو بعده', 'The span starts today or later'));
        if (r.maxDays) { const n = f.workingDays && cal ? workingDaysBetween(a, b, loc, cal) : daysBetween(a, b); if (n > r.maxDays) push(f, t2(`أقصى مدة ${r.maxDays} ${f.workingDays ? 'يوم عمل' : 'يوماً'} (اخترت ${n})`, `Maximum ${r.maxDays} ${f.workingDays ? 'working days' : 'days'} (you chose ${n})`)); }
      }
    }
    if (f.kind === 'attachment' && Array.isArray(v) && r.maxFiles && v.length > r.maxFiles) push(f, t2(`حتى ${r.maxFiles} ${r.maxFiles <= 2 ? 'ملف' : 'ملفات'}`, `Up to ${r.maxFiles} file${r.maxFiles > 1 ? 's' : ''}`));
    if ((f.kind === 'choice' || f.kind === 'multichoice') && f.source !== 'erp') { const ok = new Set(fieldOptions(state, f, today).map((o) => o.id)); const vs = Array.isArray(v) ? v : [String(v)]; if (vs.some((x) => !ok.has(x))) push(f, t2('الخيار لم يعد متاحاً؛ اختر غيره', 'That option is no longer available; choose another')); }
    if (f.kind === 'table') {
      const rows = parseRows(v); const cols = liveNeed(f.columns || [], today);
      if (f.maxRows && rows.length > f.maxRows) push(f, t2(`حتى ${f.maxRows} بنود`, `Up to ${f.maxRows} rows`));
      if (f.minRows && rows.length < f.minRows) push(f, t2(`${f.minRows} بنود على الأقل`, `At least ${f.minRows} rows`));
      const bad = rows.findIndex((row) => cols.some((c) => c.required && !(row[c.id] || '').toString().trim())); if (bad >= 0) push(f, t2(`البند ${bad + 1}: أكمل الأعمدة الإلزامية (${cols.filter((c) => c.required).map((c) => c.label.ar).join('، ')})`, `Row ${bad + 1}: complete the required columns (${cols.filter((c) => c.required).map((c) => c.label.en).join(', ')})`));
    }
    if (r.unique && opts?.svcId && typeof v === 'string') { const clash = state.requests.find((q) => q.id !== opts.excludeRequestId && !!q.configured && q.configured.serviceId === opts.svcId && q.status === 'in_review' && String(q.configured.values[f.id] || '').trim().toLowerCase() === v.trim().toLowerCase()); if (clash) push(f, t2(`هذه القيمة في طلب جارٍ آخر (${clash.id})`, `This value is on another open request (${clash.id})`)); }
  }
  return out;
}
export function validateService(state: State, svc: ConfiguredService, values: FormValues, today = toISO(Date.now()), requester?: Person, excludeRequestId?: string): FieldError[] {
  const ctx: CondCtx = { state, person: requester, svc }; const eff = effectiveValues(state, svc, requester, values, today);
  return validateFields(state, visibleSections(svc, eff, today, ctx).flatMap((s) => s.fields), eff, today, requester, ctx, { svcId: svc.id, excludeRequestId });
}

/* ——— عرض القيم: بلغتين حتى يقرأ المعتمد والمستند بلغته ——— */
export function displayValue(state: State, f: FormField, v: FormValue | undefined, lang: 'ar' | 'en', requester?: Person): string {
  if (v === undefined || v === '' || (Array.isArray(v) && !v.length)) return '';
  const nm = (o: ChoiceOption | undefined, id: string) => (o ? (lang === 'ar' ? o.name.ar : o.name.en) : id);
  if (f.kind === 'checkbox' || f.kind === 'signature') return v === true ? (f.kind === 'signature' ? (lang === 'ar' ? 'وُقّع إلكترونياً' : 'Signed electronically') : lang === 'ar' ? 'نعم' : 'Yes') : lang === 'ar' ? 'لا' : 'No';
  if (f.kind === 'yesno') return v === 'yes' || v === 'true' || v === true ? (lang === 'ar' ? 'نعم' : 'Yes') : lang === 'ar' ? 'لا' : 'No';
  if (f.kind === 'scale') return `${v} / ${f.scaleMax || 5}`;
  if (f.kind === 'choice' || f.kind === 'multichoice') { const opts = fieldOptions(state, f); const vs = Array.isArray(v) ? v : [String(v)]; return vs.map((id) => nm(opts.find((o) => o.id === id), id)).join(lang === 'ar' ? '، ' : ', '); }
  if (f.kind === 'person' || f.kind === 'position' || f.kind === 'unit') { const opts = requester ? orgOptions(state, { ...f, orgFilter: 'all' }, requester) : orgOptions(state, { ...f, orgFilter: 'all' }, state.people[0]); return nm(opts.find((o) => o.id === String(v)), String(v)); }
  if (f.kind === 'money') { const n = Number(v); return `${n.toLocaleString('en', { minimumFractionDigits: f.decimals ?? 2, maximumFractionDigits: f.decimals ?? 2 })} ${f.currency || 'SAR'}`; }
  if (f.kind === 'number') return Number(v).toLocaleString('en');
  if (f.kind === 'computed') { const n = Number(v); return Number.isNaN(n) ? String(v) : n.toLocaleString('en'); }
  if (f.kind === 'profile') { if (f.profileKey && requester) return profileValue(state, requester, f.profileKey, lang); return String(v); }
  if (f.kind === 'daterange') { const [a, b] = String(v).split('|'); return `${a} → ${b}`; }
  if (f.kind === 'attachment') return Array.isArray(v) ? v.join(lang === 'ar' ? '، ' : ', ') : String(v);
  if (f.kind === 'table') { const rows = parseRows(v); const cols = f.columns || []; const money = cols.find((c) => c.kind === 'money' || c.kind === 'number'); const total = money ? rows.reduce((n, r) => n + (Number(r[money.id]) || 0), 0) : 0; return `${rows.length} ${lang === 'ar' ? (rows.length === 1 ? 'بند' : rows.length <= 10 ? 'بنود' : 'بنداً') : rows.length === 1 ? 'row' : 'rows'}${money ? ` · ${lang === 'ar' ? 'المجموع' : 'total'} ${total.toLocaleString('en')}` : ''}`; }
  return String(v);
}
/** صفوف الجدول للعرض بأعمدته */
export function tableRows(state: State, f: FormField, v: FormValue | undefined, lang: 'ar' | 'en'): { cols: TableColumn[]; rows: string[][] } {
  const cols = (f.columns || []).filter((c) => !c.endedAt); const rows = parseRows(v).map((row) => cols.map((c) => { const x = row[c.id] || ''; if (c.kind === 'choice') { const o = (c.options || []).find((y) => y.id === x); return o ? (lang === 'ar' ? o.name.ar : o.name.en) : x; } if (c.kind === 'money' || c.kind === 'number') return x ? Number(x).toLocaleString('en') : ''; return x; }));
  return { cols, rows };
}
/** حقول الطلب كما تُحفظ فيه: التسمية بلغتين والقيمة بلغتين (D-009: صورة لحظة التقديم)؛ تشمل ما يُقرأ من الملف وما يُحسب */
export function requestFields(state: State, svc: ConfiguredService, values: FormValues, requester: Person, today = toISO(Date.now())): Field[] {
  const out: Field[] = []; const eff = effectiveValues(state, svc, requester, values, today);
  for (const { fields } of visibleSections(svc, eff, today, { state, person: requester, svc })) for (const f of fields) {
    if (f.kind === 'guidance' || f.kind === 'attachment') continue;
    const ar = displayValue(state, f, eff[f.id], 'ar', requester); const en = displayValue(state, f, eff[f.id], 'en', requester);
    if (!ar && !en) continue;
    out.push({ key: f.id, label: f.label, value: ar, valueEn: en });
  }
  return out;
}

/* ——— من يطلب ومتى (خريطة الحالات §1): الأهلية والنافذة والحصة والشروط المسبقة ——— */
export interface Eligibility { ok: boolean; reasons: T2[]; notes: T2[] }
export function eligibilityOf(state: State, person: Person, svc: ConfiguredService, today = toISO(Date.now())): Eligibility {
  const reasons: T2[] = []; const notes: T2[] = [];
  if (!inScope(person, svc.scope)) reasons.push(t2('هذه الخدمة لفئات موظفين أخرى', 'This service is for other employee groups'));
  for (const e of svc.eligibility || []) {
    if (e === 'female' && person.gender !== 'f') reasons.push(t2('هذه الخدمة للموظفات', 'This service is for female employees'));
    if (e === 'male' && person.gender !== 'm') reasons.push(t2('هذه الخدمة للموظفين الذكور', 'This service is for male employees'));
    if (e === 'parent' && !person.parent) reasons.push(t2('هذه الخدمة لمن لديه أبناء في سجل المرافقين', 'This service is for employees with children in the dependants record'));
    if (e === 'outsideHome' && !person.outsideHome) reasons.push(t2('هذه الخدمة لمن يعمل خارج موطنه', 'This service is for employees working outside their home country'));
  }
  if (svc.window && ((svc.window.from && today < svc.window.from) || (svc.window.to && today > svc.window.to))) reasons.push(t2(`نافذة التقديم ${svc.window.from ? `من ${svc.window.from}` : ''} ${svc.window.to ? `إلى ${svc.window.to}` : ''}`.replace(/\s+/g, ' ').trim(), `Submission window ${svc.window.from ? `from ${svc.window.from}` : ''} ${svc.window.to ? `to ${svc.window.to}` : ''}`.replace(/\s+/g, ' ').trim()));
  else if (svc.window?.to) notes.push(t2(`تُقبل الطلبات حتى ${svc.window.to}`, `Requests accepted until ${svc.window.to}`));
  const mine = state.requests.filter((r) => r.configured?.serviceId === svc.id && r.requesterId === person.id && r.status !== 'withdrawn' && r.status !== 'rejected');
  if (svc.limit) {
    const y = today.slice(0, 4); const m = today.slice(0, 7);
    const n = svc.limit.per === 'open' ? mine.filter((r) => r.status === 'in_review' || r.status === 'returned').length : svc.limit.per === 'year' ? mine.filter((r) => toISO(r.createdAt).startsWith(y)).length : svc.limit.per === 'month' ? mine.filter((r) => toISO(r.createdAt).startsWith(m)).length : mine.length;
    if (n >= svc.limit.count) reasons.push(svc.limit.per === 'open' ? t2(`لديك طلب جارٍ على هذه الخدمة (${mine.find((r) => r.status === 'in_review' || r.status === 'returned')?.id || ''})؛ انتظر اكتماله`, `You have an open request on this service (${mine.find((r) => r.status === 'in_review' || r.status === 'returned')?.id || ''}); wait until it completes`) : t2(`استنفدت الحصة: ${svc.limit.count} ${svc.limit.per === 'year' ? 'في السنة' : svc.limit.per === 'month' ? 'في الشهر' : 'مرة واحدة'}`, `Quota used: ${svc.limit.count} ${svc.limit.per === 'year' ? 'per year' : svc.limit.per === 'month' ? 'per month' : 'in total'}`));
    else notes.push(t2(`الحصة ${svc.limit.count} ${svc.limit.per === 'year' ? 'في السنة' : svc.limit.per === 'month' ? 'في الشهر' : svc.limit.per === 'open' ? 'طلب جارٍ في الوقت نفسه' : 'مرة'}؛ استُخدم ${n}`, `Quota ${svc.limit.count} ${svc.limit.per === 'year' ? 'per year' : svc.limit.per === 'month' ? 'per month' : svc.limit.per === 'open' ? 'open at a time' : 'in total'}; used ${n}`));
  }
  const pr = svc.prereq || {};
  if (pr.minServiceMonths && Number(attrValue(state, person, 'serviceMonths')) < pr.minServiceMonths) reasons.push(t2(`تشترط ${pr.minServiceMonths} شهراً من الخدمة على الأقل`, `Requires at least ${pr.minServiceMonths} months of service`));
  if (pr.requiresService) { const done = state.requests.some((r) => r.serviceId === pr.requiresService && r.requesterId === person.id && r.status === 'completed'); const other = configuredById(state, pr.requiresService, today); if (!done) reasons.push(t2(`تشترط اكتمال «${other ? other.name.ar : pr.requiresService}» أولاً`, `Requires “${other ? other.name.en : pr.requiresService}” to be completed first`)); }
  if (pr.requiresRecord) { const regs = (svc.outputs || []).filter((o) => o.kind === 'register' && !o.endedAt).map((o) => o.registerId); const has = (state.registers || []).some((e) => e.personId === person.id && e.status === 'active' && (regs.length ? regs.includes(e.registerId) : true)); if (!has) reasons.push(t2('تشترط سجلاً سارياً باسمك (هذه خدمة تجديد)', 'Requires a live record in your name (this is a renewal service)')); }
  if (!inPilot(state, person, svc)) reasons.push(t2('الخدمة في نشر تجريبي لفئة محددة', 'The service is in a pilot for a limited audience'));
  return { ok: !reasons.length, reasons, notes };
}
export function canRequest(state: State, person: Person, svc: ConfiguredService): boolean { return eligibilityOf(state, person, svc).ok; }

/* ——— المسار: حلّ المعتمد من حقل أو مالك أو شريحة إلى مناصب، ثم محرك CAP-01 ——— */
export function resolveDzAgent(state: State, requester: Person, agent: AgentRule, svc: ConfiguredService, values: FormValues): AgentRule {
  if (agent.kind === 'owner') return { kind: 'positions', positionIds: svc.owner?.positionId ? [svc.owner.positionId] : [], quorum: 'any' };
  if (agent.kind === 'field') {
    const f = allFields(svc).find((x) => x.id === agent.fieldId); const v = values[agent.fieldId || '']; const id = typeof v === 'string' ? v : '';
    if (!f || !id) return { kind: 'positions', positionIds: [], quorum: 'any' };
    if (f.kind === 'person') { const p = personById(state, id); return { kind: 'positions', positionIds: p?.positionId ? [p.positionId] : [], quorum: 'any' }; }
    if (f.kind === 'position') return { kind: 'positions', positionIds: [id], quorum: 'any' };
    if (f.kind === 'unit') { const u = unitById(state, id); return { kind: 'positions', positionIds: u?.chiefPositionId ? [u.chiefPositionId] : [], quorum: 'any' }; }
    return { kind: 'positions', positionIds: [], quorum: 'any' };
  }
  if (agent.kind === 'band') {
    const amount = Number(values[agent.amountField || '']) || 0; const band = (agent.bands || []).find((b) => b.upTo === null || amount <= b.upTo) || (agent.bands || [])[(agent.bands || []).length - 1];
    return band ? resolveDzAgent(state, requester, band.agent, svc, values) : { kind: 'positions', positionIds: [], quorum: 'any' };
  }
  return agent;
}
export function routeOf(svc: ConfiguredService): Route { return { id: svc.id, name: svc.name, steps: svc.route }; }
export function systemTitleOf(svc: ConfiguredService): T2 {
  const p = primaryOutput(svc); const doc = (svc.outputs || []).find((o) => o.kind === 'document' && !o.endedAt);
  if (p === 'document') return t2(`إصدار ${doc?.title?.ar || 'المستند'} وتوثيقه برمز تحقق`, `${doc?.title?.en || 'Document'} issued with a verification code`);
  if (p === 'register') return t2('تسجيل النتيجة في السجل بتاريخ انتهائها', 'Result recorded in the register with its expiry date');
  if ((svc.outputs || []).some((o) => o.kind === 'contract' && !o.endedAt)) return t2('التنفيذ في النظام المرجعي عبر العقد', 'Executed in the system of record via the contract');
  return t2('اكتمال الطلب وإبلاغ الطالب', 'Request completed and the requester informed');
}
/** خطوات الطلب المتوقعة لهذا الطالب (للمعاينة قبل الإرسال وللمحاكاة): بمحرك CAP-01 نفسه؛ الشروط على الحقول تُحسم الآن، والمؤجَّلة إلى نتائج الخطوات تبقى على الخطوة */
export function stepsFor(state: State, requester: Person, svc: ConfiguredService, values: FormValues = {}): BuiltSteps {
  const eff = effectiveValues(state, svc, requester, values); const ctx: CondCtx = { state, person: requester, svc };
  const dr = allFields(svc).find((f) => f.kind === 'daterange'); const v = dr ? String(eff[dr.id] || '') : '';
  const [a, b] = v.split('|'); const days = a && b && b >= a ? daysBetween(a, b) : 0;
  const notApplied: BuiltSteps['notApplied'] = [];
  const steps: RouteStep[] = svc.route.filter((rs) => {
    if (rs.cond && !condDeferred(rs.cond) && !condHolds(rs.cond, eff, ctx)) { notApplied.push({ title: rs.title || stepTitleOf(state, rs), why: t2(`الشرط لم يتحقق: ${condText(state, svc, rs.cond, 'ar')}`, `Condition not met: ${condText(state, svc, rs.cond, 'en')}`) }); return false; }
    return true;
  }).map((rs) => ({ ...rs, agent: rs.mode === 'wait' || rs.mode === 'system' ? { kind: 'requester' as const } : rs.mode === 'input' ? { kind: 'requester' as const } : resolveDzAgent(state, requester, rs.agent, svc, eff), cond: rs.cond && condDeferred(rs.cond) ? rs.cond : undefined }));
  const built = buildSteps(state, requester, { id: svc.id, name: svc.name, steps }, { days, workingDays: days }, systemTitleOf(svc));
  return { steps: built.steps, notApplied: [...notApplied, ...built.notApplied] };
}
function stepTitleOf(state: State, rs: RouteStep): T2 { void state; return rs.title || t2(rs.mode === 'notify' ? 'إشعار' : rs.mode === 'fulfil' ? 'تنفيذ' : rs.mode === 'review' ? 'توصية' : rs.mode === 'input' ? 'استكمال' : rs.mode === 'wait' ? 'انتظار' : rs.mode === 'system' ? 'نظام' : 'اعتماد', rs.mode === 'notify' ? 'Notification' : rs.mode === 'fulfil' ? 'Fulfilment' : rs.mode === 'review' ? 'Recommendation' : rs.mode === 'input' ? 'Completion' : rs.mode === 'wait' ? 'Wait' : rs.mode === 'system' ? 'System' : 'Approval'); }

/* ——— نماذج الخطوات (§3-ب) ——— */
export function stepFormFields(step: Step | RouteStep, today = toISO(Date.now())): FormField[] { return liveNeed(step.form?.fields || [], today); }
export function stepOutcomes(step: Step | RouteStep, today = toISO(Date.now())): StepOutcome[] { return liveNeed(step.form?.outcomes || [], today); }
export function validateStep(state: State, step: Step, values: FormValues, actor?: Person, today = toISO(Date.now())): FieldError[] { return validateFields(state, stepFormFields(step, today), values, today, actor); }
export function stepOf(r: Request, id: string): Step | undefined { return r.steps.find((s) => s.id === id); }
/** القرارات المسموحة في خطوة: من نموذجها أو الافتراضي بحسب نوعها */
export function allowedDecisions(step: Step): ('approve' | 'return' | 'reject')[] { if (step.form?.allowed?.length) return step.form.allowed; if (step.mode === 'review' || step.mode === 'input' || step.mode === 'fulfil') return ['approve']; return ['approve', 'return', 'reject']; }

/* ——— الطلب ——— */
export interface ConfiguredInput { serviceId: string; requesterId: string; values: FormValues; files?: string[]; onBehalfOf?: string; at?: number; renewOf?: string }
export function createConfiguredRequest(state: State, input: ConfiguredInput): [State, Request | undefined] {
  const at = input.at ?? Date.now(); const today = toISO(at);
  const version = designerVersion(state, today); const svc = configuredById(state, input.serviceId, today); const requester = personById(state, input.requesterId);
  if (!svc || !requester || !canRequest(state, requester, svc)) return [state, undefined];
  if (validateService(state, svc, input.values, today, requester).length) return [state, undefined];
  const eff = effectiveValues(state, svc, requester, input.values, today);
  const fields = requestFields(state, svc, input.values, requester, today);
  if (input.onBehalfOf) { const b = beneficiariesFor(state, requester, svc).find((x) => x.id === input.onBehalfOf); if (b) fields.unshift({ key: '__for', label: t2('باسم', 'On behalf of'), value: b.name.ar, valueEn: b.name.en }); }
  const built = stepsFor(state, requester, svc, input.values);
  const files = [...(input.files || []), ...allFields(svc, today).filter((f) => f.kind === 'attachment').flatMap((f) => (Array.isArray(input.values[f.id]) ? (input.values[f.id] as string[]) : []))];
  const [s1, req] = createRequest(state, { serviceId: svc.id, requesterId: requester.id, fields, at, steps: built.steps, notApplied: built.notApplied, policyVersion: version.number, title: svc.name, tenant: svc.tenant,
    configured: { serviceId: svc.id, version: version.number, values: eff, outputs: (svc.outputs || []).filter((o) => !o.endedAt || o.endedAt > today), confidential: svc.confidential, hideRequester: svc.hideRequester, onBehalfOf: input.onBehalfOf, issued: [], remindersSent: [], renewOf: input.renewOf } });
  const withFiles: Request = { ...req, docs: [...req.docs, ...files.map((name, i) => ({ id: `D-${req.id}-a${i + 1}`, kind: 'attachment' as const, title: t2(name, name), at }))] };
  let s = { ...s1, requests: s1.requests.map((x) => (x.id === req.id ? withFiles : x)) };
  s = applyNotifyRules(s, withFiles, 'submitted', at);
  return [s, s.requests.find((x) => x.id === req.id)];
}
/** رقم المستند الصادر لخدمة مهيّأة: البادئة من المخرج ثم مسلسل/سنة */
export function configuredDocNumber(state: State, prefix: string | undefined, at: number): string { const y = new Date(at).getFullYear(); const seq = 300 + state.seq; const pfx = prefix?.trim(); return pfx ? `${pfx}-${seq}/${y}` : `${seq}/${y}`; }

/* ——— حقول الدمج (§4.2): {{f:الحقل}} و{{p:المفتاح}} و{{s:الخطوة.الحقل}} و{{r:number|date|requester|service|version}} ——— */
/** تاريخ الانتهاء من قيمة حقل: تاريخ مفرد، أو نهاية المدة في حقل «مدة» (من|إلى) — خريطة الحالات 4.8 */
export const dateEndOf = (v: unknown): string => { const x = typeof v === 'string' ? v : ''; return x.includes('|') ? x.split('|')[1] || x.split('|')[0] : x; };
export function mergeText(state: State, r: Request, svc: ConfiguredService, text: string, lang: 'ar' | 'en', blank = ''): string {
  const p = personById(state, r.requesterId); const fields = allFields(svc);
  return text.replace(/\{\{\s*([a-z]):([^}]+?)\s*\}\}/g, (_m, kind: string, key: string) => {
    const k = key.trim(); const v = one(); return v.trim() ? v : blank; function one(): string {
    if (kind === 'f') { const f = fields.find((x) => x.id === k); return f ? displayValue(state, f, r.configured?.values[k], lang, p) : ''; }
    if (kind === 'p') return p ? profileValue(state, p, k as ProfileKey, lang) : '';
    if (kind === 's') { const [sid, fid] = k.split('.'); const st = stepOf(r, sid); if (!st) return ''; if (!fid || fid === 'outcome') { const o = stepOutcomes(st).find((x) => x.id === st.outcome); return o ? o.name[lang] : st.status === 'done' ? (lang === 'ar' ? 'اعتُمدت' : 'approved') : ''; } if (fid === 'actor') { const a = st.actorId ? personById(state, st.actorId) : undefined; return a ? (lang === 'ar' ? a.name : a.nameEn) : ''; } if (fid === 'date') return st.at ? toISO(st.at) : ''; if (fid === 'note') return st.note || ''; const sf = stepFormFields(st).find((x) => x.id === fid); return sf ? displayValue(state, sf, st.values?.[fid], lang, p) : ''; }
    if (kind === 'r') { if (k === 'number') return r.id; if (k === 'date') return toISO(Date.now()); if (k === 'submitted') return toISO(r.createdAt); if (k === 'requester') return p ? (lang === 'ar' ? p.name : p.nameEn) : ''; if (k === 'service') return svc.name[lang]; if (k === 'version') return r.configured?.version || ''; if (k === 'tenant') return state.tenant.name[lang]; return ''; }
    return '';
    }
  });
}
/** حقول الدمج المتاحة لخدمة: للمحرر (شرائح تُدرج) وللفحص */
export function mergeTokens(svc: ConfiguredService): { token: string; label: T2 }[] {
  const out: { token: string; label: T2 }[] = [];
  for (const f of allFields(svc)) if (f.kind !== 'guidance' && f.kind !== 'attachment') out.push({ token: `{{f:${f.id}}}`, label: f.label });
  for (const k of ['name', 'empNo', 'title', 'unit', 'hiredAt', 'serviceYears', 'location', 'nationality', 'group', 'manager', 'basicSalary'] as ProfileKey[]) out.push({ token: `{{p:${k}}}`, label: PROFILE_TITLE[k] });
  svc.route.forEach((rs, i) => { if (!rs.id) return; const name = rs.title || t2(`الخطوة ${i + 1}`, `Step ${i + 1}`); out.push({ token: `{{s:${rs.id}.outcome}}`, label: t2(`${name.ar}: النتيجة`, `${name.en}: outcome`) }); out.push({ token: `{{s:${rs.id}.actor}}`, label: t2(`${name.ar}: من قرّر`, `${name.en}: decided by`) }); out.push({ token: `{{s:${rs.id}.date}}`, label: t2(`${name.ar}: التاريخ`, `${name.en}: date`) }); for (const f of rs.form?.fields || []) out.push({ token: `{{s:${rs.id}.${f.id}}}`, label: t2(`${name.ar}: ${f.label.ar}`, `${name.en}: ${f.label.en}`) }); });
  out.push({ token: '{{r:number}}', label: t2('رقم الطلب', 'Request number') }, { token: '{{r:date}}', label: t2('تاريخ الإصدار', 'Issue date') }, { token: '{{r:submitted}}', label: t2('تاريخ التقديم', 'Submission date') }, { token: '{{r:requester}}', label: t2('اسم الطالب', 'Requester name') }, { token: '{{r:service}}', label: t2('اسم الخدمة', 'Service name') }, { token: '{{r:tenant}}', label: t2('اسم الجهة', 'Organisation name') });
  return out;
}

/* ——— المخرجات (§4): تُطبَّق عند خطوة النظام الأخيرة، أو عند خطوة بعينها لمستندٍ حدّد «يصدر عند» ——— */
export function contractInputsFor(state: State, r: Request, svc: ConfiguredService, m: Record<string, import('./policy').MapSource> | undefined): Record<string, string> {
  const out: Record<string, string> = {}; const p = personById(state, r.requesterId);
  for (const [k, src] of Object.entries(m || {})) {
    if (src.from === 'const') out[k] = src.key;
    else if (src.from === 'field') { const f = allFields(svc).find((x) => x.id === src.key); const v = r.configured?.values[src.key]; out[k] = f ? (f.kind === 'person' || f.kind === 'position' || f.kind === 'unit' ? String(v || '') : displayValue(state, f, v, 'ar', p)) : String(v || ''); }
    else if (src.from === 'profile') out[k] = src.key === 'personId' ? r.requesterId : p ? profileRaw(state, p, src.key as ProfileKey) : '';
    else if (src.from === 'step') { const [sid, fid] = src.key.split('.'); const st = stepOf(r, sid); out[k] = st ? String(st.values?.[fid] ?? (fid === 'outcome' ? st.outcome || '' : '')) : ''; }
    else if (src.from === 'request') out[k] = src.key === 'requester' ? r.requesterId : src.key === 'number' ? r.id : src.key === 'date' ? toISO(r.createdAt) : '';
  }
  return out;
}
function signatoryOf(state: State, r: Request, out: ServiceOutput, at: number): Doc['signatory'] {
  const sg = out.template?.signatory || { kind: 'lastApprover' }; if (sg.kind === 'none') return null;
  if (sg.kind === 'position' && sg.positionId) { const pos = positionById(state, sg.positionId); const h = holderOf(state, sg.positionId); return { name: h ? { ar: h.name, en: h.nameEn } : t2('—', '—'), role: pos ? pos.title : t2('', ''), at }; }
  const humans = r.steps.filter((s) => s.status === 'done' && s.desk !== 'requester' && s.actorId && s.actorId !== 'system' && s.mode !== 'notify' && !s.notifyOnly); const last = humans[humans.length - 1];
  const who = last?.actorId ? personById(state, last.actorId) : undefined; const pos = who?.positionId ? positionById(state, who.positionId) : undefined;
  return { name: who ? { ar: who.name, en: who.nameEn } : t2('النظام', 'System'), role: pos ? pos.title : t2('الأمانة العامة', 'General Secretariat'), at: last?.at || at };
}
export function issueDocument(state: State, r: Request, svc: ConfiguredService, out: ServiceOutput, at: number): [State, Request] {
  const num = configuredDocNumber(state, out.prefix, at); const title = out.title || svc.name; const tpl = out.template;
  const validUntil = tpl?.validity ? (tpl.validity.field ? dateEndOf(r.configured?.values[tpl.validity.field]) : tpl.validity.days ? addDays(toISO(at), tpl.validity.days) : undefined) : undefined;
  /* الفقرة التي كل حقول دمجها فارغة تسقط (الراتب حين لا يُطلب) */
  const empties = (txt: string) => { const toks = [...txt.matchAll(/\{\{\s*[a-z]:[^}]+?\s*\}\}/g)]; return toks.length > 0 && toks.every((m) => !mergeText(state, r, svc, m[0], 'ar').trim()); };
  const body = (tpl?.paragraphs || []).filter((p) => !empties(p.ar)).map((p) => ({ ar: mergeText(state, r, svc, p.ar, 'ar', '—'), en: mergeText(state, r, svc, p.en, 'en', '—') }));
  const code = tpl?.docKind === 'decision' ? 'FR-HR-01' : tpl?.docKind === 'certificate' ? 'FR-GN-02' : tpl?.docKind === 'permit' ? 'FR-GN-03' : 'FR-GN-01';
  const doc: Doc = { id: `D-${r.id}-${r.docs.length + 1}`, kind: 'issued', title, number: num, at, type: tpl?.docKind === 'decision' ? 'decision' : 'letter', code, body, docKind: tpl?.docKind || 'letter', signatory: signatoryOf(state, r, out, at), validUntil: validUntil || undefined, copyTo: tpl?.copyTo, outputId: out.id };
  const req: Request = { ...r, docs: [...r.docs, doc], audit: [...r.audit, { at, who: 'system', what: { ar: `صدر ${title.ar} رقم ${num}`, en: `${title.en} ${num} issued` } }], configured: r.configured ? { ...r.configured, issued: [...(r.configured.issued || []), out.id] } : r.configured };
  let s = patchRequest(state, r.id, () => req);
  s = notifyPeople(s, [r.requesterId], { kind: 'document', at, link: `#/requests/${r.id}`, title: { ar: `صدر ${title.ar}`, en: `${title.en} issued` }, body: { ar: `${requestTitle(r).ar} ${r.id}: المستند رقم ${num} جاهز في طلبك.`, en: `${requestTitle(r).en} ${r.id}: document ${num} is ready in your request.` } });
  return [s, req];
}
/** عند اكتمال خطوة: المستندات التي تصدر عندها (issueAt = معرّف الخطوة) والإشعارات المهيّأة على الخطوة */
export function afterStepDone(state: State, r: Request, step: Step, at: number): [State, Request] {
  if (!r.configured) return [state, r]; const svc = serviceOfRequest(state, r); if (!svc) return [state, r];
  let s = state; let req = r;
  for (const out of r.configured.outputs.filter((o) => o.kind === 'document' && o.issueAt && o.issueAt !== 'end' && o.issueAt === step.id && !(r.configured?.issued || []).includes(o.id))) { [s, req] = issueDocument(s, req, svc, out, at); }
  s = applyNotifyRules(s, req, 'step', at, step.id); req = s.requests.find((x) => x.id === r.id) || req;
  return [s, req];
}
/** خطوة النظام الأخيرة: كل المخرجات — المستندات المتبقية، والسجلات، والعقود، والخدمات التالية، والتقويم — ثم إشعارات الاكتمال */
export function applyConfiguredOutputs(state: State, r: Request, at: number): [State, Request] {
  const svc = serviceOfRequest(state, r); if (!svc || !r.configured) return [state, r];
  let s = state; let req = r; const today = toISO(at); const p = personById(s, r.requesterId);
  const audit = (what: T2) => { req = { ...req, audit: [...req.audit, { at, who: 'system', what }] }; s = patchRequest(s, req.id, () => req); };
  for (const out of req.configured!.outputs) {
    if (out.kind === 'document' && (!out.issueAt || out.issueAt === 'end') && !(req.configured?.issued || []).includes(out.id)) { [s, req] = issueDocument(s, req, svc, out, at); }
    if (out.kind === 'register') {
      const regId = out.registerId || svc.id; const cols: Record<string, string> = {}; for (const c of out.columns || []) { const f = allFields(svc).find((x) => x.id === c); if (f) cols[c] = displayValue(s, f, req.configured!.values[c], 'ar', p); }
      const exp = out.expiryField ? dateEndOf(req.configured!.values[out.expiryField]) : ''; const docNumber = req.docs.filter((d) => d.kind === 'issued').slice(-1)[0]?.number;
      const entry: RegisterEntry = { id: `RG-${(s.registers || []).length + 1}`, tenant: req.tenant || s.tenant.id, registerId: regId, serviceId: svc.id, requestId: req.id, personId: req.configured!.onBehalfOf || req.requesterId, title: out.title || svc.name, values: cols, issuedAt: at, expiresAt: exp || undefined, status: 'active', docNumber };
      const renewOf = req.configured!.renewOf;
      s = { ...s, registers: [...(s.registers || []).map((e) => (renewOf && e.id === renewOf ? { ...e, status: 'renewed' as const, renewedBy: entry.id } : e)), entry] };
      audit({ ar: `قُيِّد في السجل «${(out.title || svc.name).ar}» (${entry.id})${exp ? ` بتاريخ انتهاء ${exp}` : ''}${renewOf ? ` تجديداً للقيد ${renewOf}` : ''}`, en: `Recorded in the “${(out.title || svc.name).en}” register (${entry.id})${exp ? ` expiring ${exp}` : ''}${renewOf ? ` renewing entry ${renewOf}` : ''}` });
    }
    if (out.kind === 'contract' && out.contractId) {
      const res = runContract(s, out.contractId, contractInputsFor(s, req, svc, out.mapping), at);
      if (res.ok) { s = { ...s, erpSeq: (s.erpSeq || 0) + 1 }; audit(res.message); }
      else { audit({ ar: `تعذّر تنفيذ العقد: ${res.message.ar}؛ يُبلَّغ مدير النظام`, en: `Contract not executed: ${res.message.en}; the administrator is informed` }); s = notifyPeople(s, s.people.filter((x) => x.persona === 'admin').map((x) => x.id), { kind: 'task', at, link: `#/requests/${req.id}`, title: { ar: `عقد غير منفَّذ: ${requestTitle(req).ar} ${req.id}`, en: `Contract not executed: ${requestTitle(req).en} ${req.id}` }, body: res.message }); }
    }
    if (out.kind === 'calendar' && out.dateField) {
      const d = String(req.configured!.values[out.dateField] || '').split('|')[0]; if (d) { const ev: CalEvent = { id: `CE-${req.id}-${out.id}`, title: out.title || svc.name, at: new Date(`${d}T09:00:00`).getTime(), kind: 'event', sub: { ar: req.id, en: req.id } }; const mine = s.comms.cal[req.requesterId] || []; s = { ...s, calendar: [...s.calendar.filter((x) => x.id !== ev.id), ev], comms: { ...s.comms, cal: { ...s.comms.cal, [req.requesterId]: mine.includes(ev.id) ? mine : [...mine, ev.id] } } }; audit({ ar: `أُضيف «${(out.title || svc.name).ar}» إلى تقويمك في ${d}`, en: `“${(out.title || svc.name).en}” added to your calendar on ${d}` }); }
    }
  }
  /* الخدمة التالية (4.10): بعد كل شيء — اقتراح برابط، أو فتح تلقائي بنقل الحقول (لا يُفتح ما لا يستطيع الطالب طلبه) */
  for (const out of req.configured!.outputs.filter((o) => o.kind === 'followUp' && o.serviceId)) {
    const next = configuredById(s, out.serviceId!, today); if (!next || !p) continue;
    if (out.mode === 'auto' && canRequest(s, p, next)) {
      const values: FormValues = {}; for (const [to, from] of Object.entries(out.map || {})) if (req.configured!.values[from] !== undefined) values[to] = req.configured!.values[from];
      const ok = !validateService(s, next, values, today, p).length;
      if (ok) { const [s2, r2] = createConfiguredRequest(s, { serviceId: next.id, requesterId: p.id, values, at: at + 1 }); if (r2) { s = s2; req = { ...req, configured: { ...req.configured!, followUp: { serviceId: next.id, requestId: r2.id } } }; audit({ ar: `فُتح تلقائياً طلب «${next.name.ar}» ${r2.id} بنقل بياناتك`, en: `“${next.name.en}” request ${r2.id} opened automatically with your data` }); continue; } }
    }
    req = { ...req, configured: { ...req.configured!, followUp: { serviceId: next.id } } }; s = patchRequest(s, req.id, () => req);
    s = notifyPeople(s, [p.id], { kind: 'status', at, link: `#/new/${next.id}`, title: { ar: `الخطوة التالية: ${next.name.ar}`, en: `Next: ${next.name.en}` }, body: { ar: `بعد اكتمال ${requestTitle(req).ar} ${req.id} يمكنك الآن طلب «${next.name.ar}».`, en: `With ${requestTitle(req).en} ${req.id} complete you can now request “${next.name.en}”.` } });
  }
  s = applyNotifyRules(s, req, 'completed', at); req = s.requests.find((x) => x.id === r.id) || req;
  return [s, req];
}
/** الإشعارات المهيّأة (5.2): عند حدث، إلى جهة، بنص مدموج */
export function applyNotifyRules(state: State, r: Request, when: NotifyRule['when'], at: number, stepId?: string): State {
  const svc = serviceOfRequest(state, r); if (!svc || !r.configured) return state; let s = state; const p = personById(s, r.requesterId); if (!p) return s;
  for (const rule of liveNeed(svc.notifications || [], toISO(at))) {
    if (rule.when !== when || (when === 'step' && rule.stepId !== stepId)) continue;
    let ids: string[] = [];
    if (rule.to === 'requester') ids = [p.id]; else if (rule.to === 'lineManager') { const m = lineManagerOf(s, p); ids = m ? [m.id] : []; }
    else if (rule.to === 'unitHead') { const pid = orgHeadPositionId(s, p, 'department'); const h = pid ? holderOf(s, pid) : undefined; ids = h ? [h.id] : []; }
    else if (rule.to === 'owner') { const h = svc.owner?.positionId ? holderOf(s, svc.owner.positionId) : undefined; ids = h ? [h.id] : []; }
    else if (rule.to === 'positions') ids = (rule.positionIds || []).map((pid) => holderOf(s, pid)?.id).filter((x): x is string => !!x);
    else if (rule.to === 'field') { const v = r.configured.values[rule.fieldId || '']; const f = allFields(svc).find((x) => x.id === rule.fieldId); if (typeof v === 'string' && v) { if (f?.kind === 'person') ids = [v]; else if (f?.kind === 'position') { const h = holderOf(s, v); ids = h ? [h.id] : []; } else if (f?.kind === 'unit') { const u = unitById(s, v); const h = u?.chiefPositionId ? holderOf(s, u.chiefPositionId) : undefined; ids = h ? [h.id] : []; } } }
    if (!ids.length) continue;
    s = notifyPeople(s, ids, { kind: 'status', at, link: `#/requests/${r.id}`, title: { ar: mergeText(s, r, svc, rule.title.ar, 'ar'), en: mergeText(s, r, svc, rule.title.en, 'en') }, body: { ar: mergeText(s, r, svc, rule.body.ar, 'ar'), en: mergeText(s, r, svc, rule.body.en, 'en') } });
  }
  return s;
}

/* ——— السجلات المخصصة (4.8) ——— */
export function registerIds(state: State, today = toISO(Date.now())): { id: string; title: T2; services: string[] }[] {
  const map = new Map<string, { id: string; title: T2; services: string[] }>();
  for (const svc of liveServices(state, today)) for (const o of (svc.outputs || []).filter((x) => x.kind === 'register' && !x.endedAt)) { const id = o.registerId || svc.id; const cur = map.get(id); if (cur) cur.services.push(svc.id); else map.set(id, { id, title: o.title || svc.name, services: [svc.id] }); }
  for (const e of state.registers || []) if (e.tenant === state.tenant.id && !map.has(e.registerId)) map.set(e.registerId, { id: e.registerId, title: e.title, services: [e.serviceId] });
  return [...map.values()];
}
export function registerEntries(state: State, registerId: string): RegisterEntry[] { return (state.registers || []).filter((e) => e.registerId === registerId && e.tenant === state.tenant.id).sort((a, b) => b.issuedAt - a.issuedAt); }
export function myRegisterEntries(state: State, personId: string): RegisterEntry[] { return (state.registers || []).filter((e) => e.personId === personId && e.tenant === state.tenant.id).sort((a, b) => b.issuedAt - a.issuedAt); }
export function renewServiceFor(state: State, e: RegisterEntry): ConfiguredService | undefined { const svc = configuredById(state, e.serviceId); const out = svc?.outputs.find((o) => o.kind === 'register' && (o.registerId || svc.id) === e.registerId); return out?.renewService ? configuredById(state, out.renewService) : undefined; }

/* ——— الدورة الزمنية: الانتظار، والتذكيرات قبل تاريخ، وانتهاء السجلات وتنبيهاتها ——— */
export function designerTick(state: State, now = Date.now()): State {
  const today = toISO(now); let s = state; let changed = false;
  /* السجلات: انتهاء الحالة، وتنبيه قبل الانتهاء بالمدة المهيّأة يقود إلى خدمة التجديد */
  for (const e of s.registers || []) {
    if (e.status !== 'active') continue;
    const svc = configuredById(s, e.serviceId) || serviceOfRequest(s, s.requests.find((r) => r.id === e.requestId)!); const out = svc?.outputs.find((o) => o.kind === 'register' && (o.registerId || svc.id) === e.registerId); const days = out?.remindDays ?? 30;
    if (e.expiresAt && today > e.expiresAt) { changed = true; s = { ...s, registers: (s.registers || []).map((x) => (x.id === e.id ? { ...x, status: 'expired' as const } : x)) }; continue; }
    if (e.expiresAt && !e.reminded && today >= addDays(e.expiresAt, -days)) {
      changed = true; const left = daysBetween(today, e.expiresAt) - 1; const renew = out?.renewService ? configuredById(s, out.renewService) : undefined;
      s = notifyPeople(s, [e.personId], { kind: 'expiry', at: now, link: renew ? `#/new/${renew.id}/renew/${e.id}` : `#/requests/${e.requestId}`, title: { ar: `ينتهي ${e.title.ar} في ${e.expiresAt}`, en: `${e.title.en} expires on ${e.expiresAt}` }, body: { ar: left > 0 ? `بقي ${left} يوماً؛ ${renew ? `جدّده من «${renew.name.ar}»` : 'قدّم طلباً جديداً من «الخدمات»'}.` : `انتهى؛ ${renew ? `جدّده من «${renew.name.ar}»` : 'قدّم طلباً جديداً من «الخدمات»'}.`, en: left > 0 ? `${left} days left; ${renew ? `renew it from “${renew.name.en}”` : 'submit a new request from Services'}.` : `Expired; ${renew ? `renew it from “${renew.name.en}”` : 'submit a new request from Services'}.` } });
      s = { ...s, registers: (s.registers || []).map((x) => (x.id === e.id ? { ...x, reminded: true } : x)) };
    }
  }
  for (const r of s.requests) {
    if (!r.configured) continue;
    /* الانتظار (3.6): الخطوة الحالية بموعد بلغ */
    const cur = r.steps.find((x) => x.status === 'current' && x.mode === 'wait');
    if (cur && r.status === 'in_review' && cur.waitUntil && today >= cur.waitUntil) { changed = true; s = completeWait(s, r.id, cur, now); continue; }
    /* التذكيرات قبل تاريخ من حقل (5.3) */
    const svc = serviceOfRequest(s, r); if (!svc || (r.status !== 'in_review' && r.status !== 'completed')) continue;
    for (const rm of liveNeed(svc.reminders || [], today)) {
      if ((r.configured.remindersSent || []).includes(rm.id)) continue; const v = String(r.configured.values[rm.field] || '').split('|')[0]; if (!v) continue;
      if (today < addDays(v, -rm.daysBefore) || today > v) continue;
      changed = true; const p = personById(s, r.requesterId); const to = rm.to === 'lineManager' && p ? lineManagerOf(s, p)?.id : r.requesterId; if (!to) continue;
      s = notifyPeople(s, [to], { kind: 'reminder', at: now, link: `#/requests/${r.id}`, title: { ar: mergeText(s, r, svc, rm.text.ar, 'ar'), en: mergeText(s, r, svc, rm.text.en, 'en') }, body: { ar: `${requestTitle(r).ar} ${r.id} · ${v}`, en: `${requestTitle(r).en} ${r.id} · ${v}` } });
      s = patchRequest(s, r.id, (x) => ({ ...x, configured: x.configured ? { ...x.configured, remindersSent: [...(x.configured.remindersSent || []), rm.id] } : x.configured }));
    }
  }
  return changed ? s : state;
}
function completeWait(state: State, requestId: string, step: Step, at: number): State {
  /* الانتظار انتهى: تُعلَّم الخطوة منجزة ويُفتح ما بعدها بمحرك الطلب (completeCurrent يستورد من المحرك لتجنب تكرار المنطق) */
  return engineCompleteCurrent(state, requestId, 'system', { ar: `انقضى الانتظار حتى ${step.waitUntil}`, en: `Waiting period ended (${step.waitUntil})` }, at);
}
/** هل يرى هذا الشخص هذا الطلب السري؟ طالبه ومن كان في مساره ومدير النظام */
export function canSee(state: State, person: Person, r: Request): boolean {
  if (!r.configured?.confidential) return true;
  if (r.requesterId === person.id || person.persona === 'admin') return true;
  return r.steps.some((st: Step) => (st.assigneeIds || []).includes(person.id) || st.actorId === person.id);
}
/** الحقول التي تُخفى عن صاحب خطوة (3-ب.5) */
export function hiddenFor(step: Step | undefined): Set<string> { return new Set(step?.form?.hidden || []); }

/* ——— فحص السلامة قبل الجدولة (CAP-02 §6): يُسمّي كل عيب ويمنع ——— */
export type SafetyKind = 'noName' | 'noFields' | 'fieldNoLabel' | 'choiceNoOptions' | 'erpListMissing' | 'stepNoAgent' | 'noRoute' | 'badCond' | 'noDomain' | 'outputNoTitle' | 'expiryNoField' | 'dupField' | 'tableNoColumns' | 'computedBad' | 'profileNoKey' | 'fieldAgentBad' | 'bandBad' | 'dupStep' | 'contractUnbound' | 'contractMapping' | 'registerBad' | 'followUpBad' | 'templateToken' | 'issueAtBad' | 'waitBad' | 'outcomeNoName' | 'stepFieldNoLabel' | 'notifyBad' | 'reminderBad' | 'ownerMissing' | 'stepCondBad';
export interface SafetyProblem { kind: SafetyKind; service: ConfiguredService; text: T2 }
export function serviceProblems(state: State, svc: ConfiguredService, today = toISO(Date.now())): SafetyProblem[] {
  const out: SafetyProblem[] = []; const p = (kind: SafetyKind, text: T2) => out.push({ kind, service: svc, text });
  const name = svc.name;
  if (!name.ar.trim() || !name.en.trim()) p('noName', t2('اسم الخدمة ناقص بإحدى اللغتين', 'The service name is missing in one language'));
  if (!svc.domain || !DOMAINS.some((d) => d.id === svc.domain)) p('noDomain', t2('الخدمة بلا مجال في الدليل', 'The service has no catalogue domain'));
  const fields = allFields(svc, today); const inputs = fields.filter((f) => f.kind !== 'guidance');
  if (!inputs.length) p('noFields', t2('النموذج بلا حقل واحد يُملأ', 'The form has no field to fill'));
  const ids = new Set<string>(); const fieldIds = new Set(fields.map((f) => f.id)); const stepIds = new Set(svc.route.map((s) => s.id).filter((x): x is string => !!x));
  const checkCond = (c: Cond | undefined, where: T2) => { for (const l of condLeaves(c)) { if (l.field.startsWith('@')) { if (!(ATTR_KEYS as readonly string[]).includes(l.field.slice(1))) p('badCond', t2(`${where.ar}: شرط يشير إلى صفة غير معروفة (${l.field})`, `${where.en}: a condition points at an unknown attribute (${l.field})`)); } else if (l.field.startsWith('#')) { const [sid, fid] = l.field.slice(1).split('.'); const st = svc.route.find((x) => x.id === sid); if (!st) p('stepCondBad', t2(`${where.ar}: شرط يشير إلى خطوة غير موجودة (${sid})`, `${where.en}: a condition points at a missing step (${sid})`)); else if (fid && fid !== 'outcome' && !(st.form?.fields || []).some((x) => x.id === fid)) p('stepCondBad', t2(`${where.ar}: شرط يشير إلى حقل غير موجود في نموذج الخطوة (${fid})`, `${where.en}: a condition points at a missing step-form field (${fid})`)); } else if (!fieldIds.has(l.field)) p('badCond', t2(`${where.ar}: شرط يشير إلى حقل غير موجود (${l.field})`, `${where.en}: a condition points at a missing field (${l.field})`)); } };
  for (const f of fields) {
    if (ids.has(f.id)) p('dupField', t2(`معرّف الحقل مكرر: ${f.id}`, `Duplicate field id: ${f.id}`)); ids.add(f.id);
    if (!f.label.ar.trim() || !f.label.en.trim()) p('fieldNoLabel', t2(`حقل بلا تسمية بإحدى اللغتين (${f.id})`, `A field has no label in one language (${f.id})`));
    const where: T2 = { ar: `«${f.label.ar || f.id}»`, en: `“${f.label.en || f.id}”` };
    if ((f.kind === 'choice' || f.kind === 'multichoice') && f.source !== 'erp' && !liveNeed(f.options || [], today).length) p('choiceNoOptions', t2(`${where.ar}: قائمة اختيار بلا خيار سارٍ`, `${where.en}: a choice with no live option`));
    if ((f.kind === 'choice' || f.kind === 'multichoice') && f.source === 'erp' && (!f.erpList || !erpListOptions(state, f.erpList).length)) p('erpListMissing', t2(`${where.ar}: قائمة النظام المرجعي غير محددة أو فارغة`, `${where.en}: the system-of-record list is unset or empty`));
    if (f.kind === 'table' && !liveNeed(f.columns || [], today).length) p('tableNoColumns', t2(`${where.ar}: جدول بلا أعمدة`, `${where.en}: a table with no columns`));
    if (f.kind === 'table') for (const c of liveNeed(f.columns || [], today)) if (!c.label.ar.trim() || !c.label.en.trim()) p('tableNoColumns', t2(`${where.ar}: عمود بلا تسمية بإحدى اللغتين`, `${where.en}: a column has no label in one language`));
    if (f.kind === 'computed') { const fm = f.formula; const bad = !fm || !fm.fields.length || fm.fields.some((id) => !fieldIds.has(id) || id === f.id) || ((fm.op === 'daysBetween' || fm.op === 'workingDaysBetween') && !(fm.fields.length === 1 ? fields.find((x) => x.id === fm.fields[0])?.kind === 'daterange' : fm.fields.length === 2)); if (bad) p('computedBad', t2(`${where.ar}: معادلة ناقصة أو تشير إلى حقل غير موجود`, `${where.en}: the formula is incomplete or points at a missing field`)); }
    if (f.kind === 'profile' && !f.profileKey) p('profileNoKey', t2(`${where.ar}: بلا مفتاح من ملف الموظف`, `${where.en}: no employee-record key`));
    checkCond(f.rules?.showIf, where); checkCond(f.rules?.requiredIf, where); checkCond(f.rules?.readOnlyIf, where);
    if (f.rules?.afterField && !fields.some((x) => x.id === f.rules!.afterField && (x.kind === 'date' || x.kind === 'daterange'))) p('badCond', t2(`${where.ar}: «بعد تاريخ الحقل» يشير إلى غير حقل تاريخ`, `${where.en}: “after the date field” points at a non-date field`));
    if (f.rules?.lteField && !fields.some((x) => x.id === f.rules!.lteField && (x.kind === 'number' || x.kind === 'money' || x.kind === 'computed'))) p('badCond', t2(`${where.ar}: «لا يتجاوز الحقل» يشير إلى غير حقل رقمي`, `${where.en}: “not above the field” points at a non-numeric field`));
    if (f.default?.kind === 'field' && (!f.default.field || !fieldIds.has(f.default.field))) p('badCond', t2(`${where.ar}: القيمة الافتراضية من حقل غير موجود`, `${where.en}: the default points at a missing field`));
  }
  if (!svc.route.length) p('noRoute', t2('المسار بلا خطوة واحدة: لا أحد يعتمد أو ينفّذ', 'The route has no step: nobody approves or fulfils'));
  const seenStep = new Set<string>();
  svc.route.forEach((s, i) => {
    const sw: T2 = { ar: `الخطوة ${i + 1}${s.title ? ` «${s.title.ar}»` : ''}`, en: `Step ${i + 1}${s.title ? ` “${s.title.en}”` : ''}` };
    if (s.id) { if (seenStep.has(s.id)) p('dupStep', t2(`${sw.ar}: معرّف الخطوة مكرر (${s.id})`, `${sw.en}: duplicate step id (${s.id})`)); seenStep.add(s.id); }
    const a = s.agent;
    if (s.mode !== 'wait' && s.mode !== 'system' && s.mode !== 'input') {
      const bad = (a.kind === 'positions' && !(a.positionIds || []).length) || (a.kind === 'pool' && !a.unitId); if (bad) p('stepNoAgent', t2(`${sw.ar} بلا معتمد (منصب أو فريق)`, `${sw.en} has no approver (position or pool)`));
      if (a.kind === 'field') { const f = fields.find((x) => x.id === a.fieldId); if (!f || !(f.kind === 'person' || f.kind === 'position' || f.kind === 'unit')) p('fieldAgentBad', t2(`${sw.ar}: «المعتمد من حقل» يحتاج حقل شخص أو منصب أو وحدة`, `${sw.en}: “approver from a field” needs a person, position or unit field`)); }
      if (a.kind === 'owner' && !svc.owner?.positionId) p('ownerMissing', t2(`${sw.ar}: المعتمد مالك الخدمة ولا مالك محدد في الأساسيات`, `${sw.en}: the approver is the service owner but no owner is set in Basics`));
      if (a.kind === 'band') { const f = fields.find((x) => x.id === a.amountField); if (!f || !(f.kind === 'money' || f.kind === 'number' || f.kind === 'computed')) p('bandBad', t2(`${sw.ar}: الشريحة تحتاج حقل مبلغ أو رقم`, `${sw.en}: the value band needs an amount or number field`)); if (!(a.bands || []).length) p('bandBad', t2(`${sw.ar}: بلا شرائح`, `${sw.en}: no bands`)); else if (!(a.bands || []).some((b) => b.upTo === null)) p('bandBad', t2(`${sw.ar}: تحتاج شريحة أخيرة «بلا حد»`, `${sw.en}: needs a last band with no upper limit`)); for (const b of a.bands || []) if ((b.agent.kind === 'positions' && !(b.agent.positionIds || []).length) || (b.agent.kind === 'pool' && !b.agent.unitId)) p('bandBad', t2(`${sw.ar}: شريحة بلا معتمد`, `${sw.en}: a band without an approver`)); }
    }
    if (s.mode === 'wait' && !(s.wait?.days || (s.wait?.field && fields.some((x) => x.id === s.wait!.field && (x.kind === 'date' || x.kind === 'daterange'))))) p('waitBad', t2(`${sw.ar}: الانتظار يحتاج أياماً أو حقل تاريخ`, `${sw.en}: the wait needs days or a date field`));
    if (s.mode === 'system') { if (!s.contractId) p('contractUnbound', t2(`${sw.ar}: خطوة نظام بلا عقد`, `${sw.en}: a system step with no contract`)); else { const c = contractById(s.contractId); const ready = contractReady(state, s.contractId, svc.tenant); if (!ready.ok) p('contractUnbound', t2(`${sw.ar}: ${ready.why.ar}`, `${sw.en}: ${ready.why.en}`)); const miss = (c?.inputs || []).filter((i) => i.required && !s.mapping?.[i.key]); if (miss.length) p('contractMapping', t2(`${sw.ar}: مدخلات العقد الإلزامية غير مربوطة (${miss.map((m) => m.label.ar).join('، ')})`, `${sw.en}: required contract inputs not mapped (${miss.map((m) => m.label.en).join(', ')})`)); } }
    checkCond(s.cond, sw); checkCond(s.auto, sw);
    for (const o of liveNeed(s.form?.outcomes || [], today)) if (!o.name.ar.trim() || !o.name.en.trim()) p('outcomeNoName', t2(`${sw.ar}: خيار قرار بلا اسم بإحدى اللغتين`, `${sw.en}: a decision option has no name in one language`));
    for (const f of liveNeed(s.form?.fields || [], today)) { if (!f.label.ar.trim() || !f.label.en.trim()) p('stepFieldNoLabel', t2(`${sw.ar}: حقل في نموذج الخطوة بلا تسمية بإحدى اللغتين (${f.id})`, `${sw.en}: a step-form field has no label in one language (${f.id})`)); if ((f.kind === 'choice' || f.kind === 'multichoice') && f.source !== 'erp' && !liveNeed(f.options || [], today).length) p('choiceNoOptions', t2(`${sw.ar}: «${f.label.ar || f.id}» قائمة بلا خيار`, `${sw.en}: “${f.label.en || f.id}” is a choice with no option`)); }
    for (const e of s.form?.editable || []) if (!fieldIds.has(e)) p('badCond', t2(`${sw.ar}: حقل قابل للتعديل غير موجود (${e})`, `${sw.en}: an editable field is missing (${e})`));
  });
  for (const o of (svc.outputs || []).filter((x) => !x.endedAt)) {
    const ow: T2 = { ar: `المخرج «${o.title?.ar || o.kind}»`, en: `Output “${o.title?.en || o.kind}”` };
    if (o.kind === 'document') { if (!o.title?.ar.trim() || !o.title?.en.trim()) p('outputNoTitle', t2('المستند الصادر بلا عنوان بإحدى اللغتين', 'The issued document has no title in one language')); if (o.issueAt && o.issueAt !== 'end' && !stepIds.has(o.issueAt)) p('issueAtBad', t2(`${ow.ar}: «يصدر عند» يشير إلى خطوة غير موجودة`, `${ow.en}: “issued at” points at a missing step`)); for (const para of o.template?.paragraphs || []) for (const txt of [para.ar, para.en]) for (const m of txt.matchAll(/\{\{\s*([a-z]):([^}]+?)\s*\}\}/g)) { const kind = m[1]; const key = m[2].trim(); if (kind === 'f' && !fieldIds.has(key)) p('templateToken', t2(`${ow.ar}: حقل دمج يشير إلى حقل غير موجود ({{f:${key}}})`, `${ow.en}: a merge field points at a missing field ({{f:${key}}})`)); if (kind === 's') { const [sid, fid] = key.split('.'); const st = svc.route.find((x) => x.id === sid); if (!st) p('templateToken', t2(`${ow.ar}: حقل دمج يشير إلى خطوة غير موجودة ({{s:${key}}})`, `${ow.en}: a merge field points at a missing step ({{s:${key}}})`)); else if (fid && !['outcome', 'actor', 'date', 'note'].includes(fid) && !(st.form?.fields || []).some((x) => x.id === fid)) p('templateToken', t2(`${ow.ar}: حقل دمج يشير إلى حقل غير موجود في نموذج الخطوة ({{s:${key}}})`, `${ow.en}: a merge field points at a missing step-form field ({{s:${key}}})`)); } if (kind === 'p' && !(['name', 'empNo', 'title', 'unit', 'hiredAt', 'serviceYears', 'location', 'nationality', 'group', 'manager', 'basicSalary'] as string[]).includes(key)) p('templateToken', t2(`${ow.ar}: مفتاح ملف غير معروف ({{p:${key}}})`, `${ow.en}: unknown profile key ({{p:${key}}})`)); } if (o.template?.signatory?.kind === 'position' && !o.template.signatory.positionId) p('outputNoTitle', t2(`${ow.ar}: الموقّع منصب غير محدد`, `${ow.en}: the signatory position is unset`)); }
    if (o.kind === 'register') { if (o.expiryField && !fields.some((f) => f.id === o.expiryField && (f.kind === 'date' || f.kind === 'daterange'))) p('expiryNoField', t2(`${ow.ar}: حقل تاريخ الانتهاء ليس حقل تاريخ`, `${ow.en}: the expiry field is not a date field`)); for (const c of o.columns || []) if (!fieldIds.has(c)) p('registerBad', t2(`${ow.ar}: عمود يشير إلى حقل غير موجود (${c})`, `${ow.en}: a column points at a missing field (${c})`)); if (o.renewService && o.renewService !== svc.id && !liveServices(state, today).some((x) => x.id === o.renewService)) p('registerBad', t2(`${ow.ar}: خدمة التجديد غير موجودة أو غير سارية (${o.renewService})`, `${ow.en}: the renewal service is missing or not live (${o.renewService})`)); }
    if (o.kind === 'contract') { if (!o.contractId) p('contractUnbound', t2(`${ow.ar}: بلا عقد`, `${ow.en}: no contract`)); else { const c = contractById(o.contractId); const ready = contractReady(state, o.contractId, svc.tenant); if (!ready.ok) p('contractUnbound', t2(`${ow.ar}: ${ready.why.ar}`, `${ow.en}: ${ready.why.en}`)); const miss = (c?.inputs || []).filter((i) => i.required && !o.mapping?.[i.key]); if (miss.length) p('contractMapping', t2(`${ow.ar}: مدخلات العقد الإلزامية غير مربوطة (${miss.map((m) => m.label.ar).join('، ')})`, `${ow.en}: required contract inputs not mapped (${miss.map((m) => m.label.en).join(', ')})`)); } }
    if (o.kind === 'followUp') { if (!o.serviceId || o.serviceId === svc.id) p('followUpBad', t2(`${ow.ar}: الخدمة التالية غير محددة أو هي الخدمة نفسها`, `${ow.en}: the follow-up service is unset or the same service`)); else if (!liveServices(state, today).some((x) => x.id === o.serviceId) && !designerContent(state, today).services.some((x) => x.id === o.serviceId && x.tenant === svc.tenant)) p('followUpBad', t2(`${ow.ar}: الخدمة التالية غير موجودة (${o.serviceId})`, `${ow.en}: the follow-up service is missing (${o.serviceId})`)); }
    if (o.kind === 'calendar' && !fields.some((f) => f.id === o.dateField && (f.kind === 'date' || f.kind === 'daterange'))) p('badCond', t2(`${ow.ar}: حدث التقويم يحتاج حقل تاريخ`, `${ow.en}: the calendar event needs a date field`));
  }
  for (const n of liveNeed(svc.notifications || [], today)) { if (!n.title.ar.trim() || !n.title.en.trim()) p('notifyBad', t2('إشعار مهيّأ بلا عنوان بإحدى اللغتين', 'A configured notification has no title in one language')); if (n.when === 'step' && (!n.stepId || !stepIds.has(n.stepId))) p('notifyBad', t2('إشعار عند خطوة غير موجودة', 'A notification on a missing step')); if (n.to === 'positions' && !(n.positionIds || []).length) p('notifyBad', t2('إشعار إلى مناصب بلا منصب', 'A notification to positions with none chosen')); if (n.to === 'field' && !fields.some((f) => f.id === n.fieldId && (f.kind === 'person' || f.kind === 'position' || f.kind === 'unit'))) p('notifyBad', t2('إشعار إلى «من حقل» بلا حقل شخص أو منصب أو وحدة', 'A notification “from a field” without a person, position or unit field')); if (n.to === 'owner' && !svc.owner?.positionId) p('ownerMissing', t2('إشعار إلى مالك الخدمة ولا مالك محدد', 'A notification to the service owner but no owner is set')); }
  for (const rm of liveNeed(svc.reminders || [], today)) if (!fields.some((f) => f.id === rm.field && (f.kind === 'date' || f.kind === 'daterange')) || !rm.daysBefore) p('reminderBad', t2('تذكير بلا حقل تاريخ أو بلا مدة', 'A reminder with no date field or no lead time'));
  if (svc.prereq?.requiresService && !designerContent(state, today).services.some((x) => x.id === svc.prereq!.requiresService) && !['TM-01', 'AS-01', 'MD-01', 'MD-02', 'MD-05', 'FN-01'].includes(svc.prereq.requiresService)) p('followUpBad', t2(`الشرط المسبق يشير إلى خدمة غير موجودة (${svc.prereq.requiresService})`, `The prerequisite points at a missing service (${svc.prereq.requiresService})`));
  return out;
}
export function designerProblems(state: State, content: DesignerContent, today: string): SafetyProblem[] { return liveNeed(content.services, today).flatMap((s) => serviceProblems(state, s, today)); }

/* ——— الإحصاءات (7.10) والمحاكاة (7.3) والنسخ والتصدير (7.5، 7.7) ——— */
export function serviceStats(state: State, id: string, now = Date.now()) {
  const rs = state.requests.filter((r) => r.serviceId === id && r.status !== 'withdrawn');
  const by = { in_review: 0, returned: 0, rejected: 0, completed: 0 } as Record<string, number>; for (const r of rs) by[r.status] = (by[r.status] || 0) + 1;
  const durations = rs.filter((r) => r.status === 'completed').map((r) => r.updatedAt - r.createdAt).sort((a, b) => a - b); const median = durations.length ? durations[Math.floor(durations.length / 2)] : 0;
  let overdue = 0; const stepLate: Record<string, number> = {};
  for (const r of rs) { if (r.status !== 'in_review') continue; const st = r.steps.find((x) => x.status === 'current'); if (!st || !st.slaHours) continue; if (now > (st.startedAt || r.createdAt) + st.slaHours * 3600000) { overdue++; stepLate[st.title.ar] = (stepLate[st.title.ar] || 0) + 1; } }
  const slowest = Object.entries(stepLate).sort((a, b) => b[1] - a[1])[0];
  return { total: rs.length, by, medianHours: Math.round(median / 3600000), overdue, slowestStep: slowest ? { title: slowest[0], n: slowest[1] } : undefined };
}
export interface Simulation { steps: BuiltSteps; documents: T2[]; registers: T2[]; contracts: { name: T2; ready: boolean; why: T2 }[]; notifications: T2[]; followUps: T2[]; eligibility: Eligibility; errors: FieldError[] }
export function simulate(state: State, svc: ConfiguredService, person: Person, values: FormValues): Simulation {
  const eff = effectiveValues(state, svc, person, values); const steps = stepsFor(state, person, svc, values);
  const documents = svc.outputs.filter((o) => o.kind === 'document' && !o.endedAt).map((o) => t2(`${o.title?.ar || svc.name.ar}${o.issueAt && o.issueAt !== 'end' ? ` (عند الخطوة ${svc.route.findIndex((s) => s.id === o.issueAt) + 1})` : ''}`, `${o.title?.en || svc.name.en}${o.issueAt && o.issueAt !== 'end' ? ` (at step ${svc.route.findIndex((s) => s.id === o.issueAt) + 1})` : ''}`));
  const registers = svc.outputs.filter((o) => o.kind === 'register' && !o.endedAt).map((o) => { const exp = o.expiryField ? String(eff[o.expiryField] || '').split('|')[1] || String(eff[o.expiryField] || '') : ''; return t2(`${o.title?.ar || svc.name.ar}${exp ? ` حتى ${exp}` : ''}`, `${o.title?.en || svc.name.en}${exp ? ` until ${exp}` : ''}`); });
  const contracts = [...svc.route.filter((s) => s.mode === 'system' && s.contractId).map((s) => s.contractId!), ...svc.outputs.filter((o) => o.kind === 'contract' && o.contractId && !o.endedAt).map((o) => o.contractId!)].map((cid) => { const c = contractById(cid); const r = contractReady(state, cid, svc.tenant); return { name: c ? c.name : t2(cid, cid), ready: r.ok, why: r.why }; });
  const notifications = liveNeed(svc.notifications || [], toISO(Date.now())).map((n) => t2(`${n.when === 'submitted' ? 'عند التقديم' : n.when === 'completed' ? 'عند الاكتمال' : n.when === 'rejected' ? 'عند الرفض' : n.when === 'returned' ? 'عند الإعادة' : `عند الخطوة ${svc.route.findIndex((s) => s.id === n.stepId) + 1}`}: ${n.title.ar}`, `${n.when === 'submitted' ? 'On submission' : n.when === 'completed' ? 'On completion' : n.when === 'rejected' ? 'On rejection' : n.when === 'returned' ? 'On return' : `At step ${svc.route.findIndex((s) => s.id === n.stepId) + 1}`}: ${n.title.en}`));
  const followUps = svc.outputs.filter((o) => o.kind === 'followUp' && o.serviceId && !o.endedAt).map((o) => { const n = configuredById(state, o.serviceId!); return t2(`${o.mode === 'auto' ? 'يُفتح تلقائياً' : 'يُقترح'}: ${n ? n.name.ar : o.serviceId}`, `${o.mode === 'auto' ? 'Opened automatically' : 'Suggested'}: ${n ? n.name.en : o.serviceId}`); });
  return { steps, documents, registers, contracts, notifications, followUps, eligibility: eligibilityOf(state, person, svc), errors: validateService(state, svc, values, toISO(Date.now()), person) };
}
/** قيم تجريبية للمحاكاة: من الأمثلة والخيارات الأولى والتواريخ القريبة */
/** قيمة تجريبية لحقل واحد (المحاكاة ومعاينة المستند) */
export function sampleFieldValue(state: State, f: FormField, person: Person, today = toISO(Date.now())): FormValue | undefined {
  if (f.kind === 'text') return f.rules?.pattern === 'email' ? 'name@gcc-sg.org' : f.rules?.pattern === 'phone' ? '+966500000000' : f.rules?.pattern === 'nationalId' ? '1000000000' : f.rules?.pattern === 'iban' ? 'SA0380000000608010167519' : f.rules?.pattern === 'plate' ? 'أ ب ج 1234' : f.rules?.pattern === 'url' ? 'https://gcc-sg.org' : f.placeholder?.ar || `قيمة تجريبية: ${f.label.ar || f.id}`;
  if (f.kind === 'textarea') return f.placeholder?.ar || 'نص تجريبي للمحاكاة يكفي طوله لكل تحقق.';
  if (f.kind === 'number') return String(f.rules?.min ?? 1); if (f.kind === 'money') return String(f.rules?.min ?? 1000);
  if (f.kind === 'date') return f.rules?.dateRel === 'past' ? addDays(today, -7) : addDays(today, 7); if (f.kind === 'time') return '09:30';
  if (f.kind === 'daterange') return `${addDays(today, 7)}|${addDays(today, 10)}`;
  if (f.kind === 'choice') return fieldOptions(state, f, today)[0]?.id || ''; if (f.kind === 'multichoice') return fieldOptions(state, f, today).slice(0, 1).map((o) => o.id);
  if (f.kind === 'yesno') return 'yes'; if (f.kind === 'scale') return String(Math.ceil((f.scaleMax || 5) / 2));
  if (f.kind === 'person' || f.kind === 'position' || f.kind === 'unit') return orgOptions(state, f, person).find((o) => o.id !== person.id && o.id !== person.positionId)?.id || '';
  if (f.kind === 'checkbox' || f.kind === 'signature') return true;
  if (f.kind === 'table') { const row: TableRow = {}; for (const c of f.columns || []) row[c.id] = c.kind === 'money' || c.kind === 'number' ? '100' : c.kind === 'date' ? today : c.kind === 'choice' ? (c.options || [])[0]?.id || '' : 'بند'; return JSON.stringify([row]); }
  return undefined;
}
export function sampleValues(state: State, svc: ConfiguredService, person: Person, today = toISO(Date.now())): FormValues {
  const v: FormValues = {};
  for (const f of allFields(svc, today)) { const x = sampleFieldValue(state, f, person, today); if (x !== undefined) v[f.id] = x; }
  return withDefaults(state, svc, person, v, today);
}
/** v0.18 (ملاحظة عمر: «هل أستطيع معاينة القالب قبل أن أحفظه؟»): المستند كما سيصدر — طلب تجريبي لا يُحفظ، خطواته منجزة بقيم تجريبية، ثم الدمج نفسه الذي يجري عند الإصدار (C-UX-81: المعاينة هي الشيء نفسه) */
export function previewDocument(state: State, svc: ConfiguredService, out: ServiceOutput, person: Person, at = Date.now()): { doc: Doc; req: Request } | undefined {
  try {
    const today = toISO(at); const values = sampleValues(state, svc, person, today);
    const eff = effectiveValues(state, svc, person, values, today); const fields = requestFields(state, svc, values, person, today);
    const built = stepsFor(state, person, svc, values);
    const [s1, req0] = createRequest(state, { serviceId: svc.id, requesterId: person.id, fields, at, steps: built.steps, notApplied: built.notApplied, policyVersion: 'preview', title: svc.name, tenant: svc.tenant,
      configured: { serviceId: svc.id, version: 'preview', values: eff, outputs: svc.outputs || [], confidential: svc.confidential, hideRequester: svc.hideRequester, issued: [], remindersSent: [] } });
    const steps: Step[] = req0.steps.map((st) => { const outs = stepOutcomes(st); const sv: FormValues = {}; for (const f of stepFormFields(st)) { const x = sampleFieldValue(state, f, person, today); if (x !== undefined) sv[f.id] = x; } const actor = st.desk === 'system' ? 'system' : (st.assigneeIds || [])[0] || person.id; return { ...st, status: 'done' as const, actorId: actor, at, values: sv, outcome: outs[0]?.id }; });
    const req: Request = { ...req0, steps, status: 'completed' };
    const [, req2] = issueDocument(s1, req, svc, out, at);
    const doc = req2.docs.find((d) => d.kind === 'issued' && d.outputId === out.id);
    return doc ? { doc, req: req2 } : undefined;
  } catch { return undefined; }
}
export function cloneService(svc: ConfiguredService, id: string, name: T2, at = Date.now()): ConfiguredService { const c = JSON.parse(JSON.stringify(svc)) as ConfiguredService; return { ...c, id, name, source: 'clone', createdAt: at, endedAt: undefined }; }
export function exportService(svc: ConfiguredService): string { const { tenant: _t, ...rest } = svc; void _t; return JSON.stringify({ format: 'usp-service/1', exportedAt: toISO(Date.now()), service: rest }, null, 2); }
export function importService(json: string, tenant: string, taken: string[], at = Date.now()): { ok: true; service: ConfiguredService } | { ok: false; why: T2 } {
  try {
    const x = JSON.parse(json); const s = (x && x.format === 'usp-service/1' ? x.service : x) as Partial<ConfiguredService>;
    if (!s || typeof s !== 'object' || !s.name || !s.sections || !s.route) return { ok: false, why: t2('الملف ليس تعريف خدمة صالحاً (يلزم name وsections وroute)', 'The file is not a valid service definition (name, sections and route are required)') };
    /* المعرّف: إن كان مأخوذاً نزيد الرقم من رقمه هو (HA-09 → HA-10) لا من 01 (P-10: معرّف فريد داخل المستأجر) */
    let id = String(s.id || 'NEW-01'); const m = /^(.*)-(\d+)$/.exec(id); const base = m ? m[1] : id; let n = m ? Number(m[2]) : 1; while (taken.includes(id)) { n++; id = `${base}-${String(n).padStart(2, '0')}`; }
    const defaults: Partial<ConfiguredService> = { icon: 'grid', tone: 'g-sage', kind: 'configured', domain: 'WP', description: t2('', ''), outputs: [] };
    const svc = { ...defaults, ...(s as Partial<ConfiguredService>), id, tenant, source: 'import' as const, createdAt: at, endedAt: undefined } as ConfiguredService;
    return { ok: true, service: svc };
  } catch { return { ok: false, why: t2('تعذّر قراءة الملف: ليس JSON صالحاً', 'Could not read the file: not valid JSON') }; }
}
export const DESIGNER_EVENTS = ['submitted', 'completed', 'rejected', 'returned', 'step'] as const;
