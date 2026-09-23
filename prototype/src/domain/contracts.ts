/* v0.16 سجل عقود التكامل (بطاقة القدرة CAP-02 §4، خريطة الحالات §6): نقاط التوسعة إلى الأنظمة الأخرى.
   العقد يُبنى بالشيفرة وببطاقة (اسمه ونظامه واتجاهه ومدخلاته ومخرجاته وكائنه في SAP)، ومدير النظام يربطه لكل مستأجر وبيئة (الوجهة والنظام والعميل ومرجع الاعتماد لا سرّه)،
   والمصمّم يستعمله من خطوة نظام أو مخرج بربط مدخلاته بحقول النموذج. التنفيذ هنا محاكاة تعيد مرجعاً؛ التنفيذ الحقيقي عبر وجهات BTP خلف طبقة واحدة (البطاقة §7).
   ما لم يُثبَّت من كائنات SAP معلَّم verified: false ويُثبَّت مع شريك التنفيذ في بوابة البنية. */
import type { State, T2, Env, ContractBinding, Tenant } from './types';
import { toISO } from './policy';

const t2 = (ar: string, en: string): T2 => ({ ar, en });
export type ContractSystem = 'H4S4' | 'S4-MM' | 'S4-FI' | 'S4-FM' | 'DMS' | 'MAIL';
export interface ContractInput { key: string; label: T2; required: boolean; kind: 'text' | 'date' | 'number' | 'person' | 'file' | 'choice' }
export interface Contract { id: string; name: T2; system: ContractSystem; direction: 'read' | 'write'; inputs: ContractInput[]; outputs: { key: string; label: T2 }[]; sapObject: T2; verified: boolean; guidance: T2; refPrefix: string }
export const SYSTEM_TITLE: Record<ContractSystem, T2> = { H4S4: t2('الموارد البشرية H4S4', 'HR (H4S4)'), 'S4-MM': t2('المشتريات والمخازن MM', 'Procurement & stores (MM)'), 'S4-FI': t2('المالية FI', 'Finance (FI)'), 'S4-FM': t2('إدارة الاعتمادات FM', 'Funds management (FM)'), DMS: t2('مخزن المستندات', 'Document store'), MAIL: t2('البريد الخارجي', 'External mail') };
export const ENVS: Env[] = ['dev', 'test', 'prod'];
export const ENV_TITLE: Record<Env, T2> = { dev: t2('التطوير', 'Development'), test: t2('الاختبار', 'Test'), prod: t2('الإنتاج', 'Production') };

/** العقود الابتدائية الثمانية (+2): ما احتاجه الجرد ق.ص-01 من الخدمات المهيّأة في الموجتين الأولى والثانية */
export const CONTRACTS: Contract[] = [
  { id: 'hr.employeeRead', name: t2('قراءة بيانات الموظف', 'Read employee data'), system: 'H4S4', direction: 'read', refPrefix: 'RD', verified: true,
    inputs: [{ key: 'personId', label: t2('الموظف', 'Employee'), required: true, kind: 'person' }], outputs: [{ key: 'name', label: t2('الاسم', 'Name') }, { key: 'empNo', label: t2('الرقم الوظيفي', 'Employee number') }, { key: 'title', label: t2('المنصب', 'Position') }, { key: 'unit', label: t2('الوحدة', 'Unit') }, { key: 'hiredAt', label: t2('تاريخ التعيين', 'Hire date') }],
    sapObject: t2('أنواع المعلومات 0000 و0001 و0002 (PA) والتعيين التنظيمي (OM)', 'Infotypes 0000, 0001 and 0002 (PA) and the organisational assignment (OM)'), guidance: t2('يقرأه حقل «بيانات من ملف الموظف» في كل نموذج؛ لا كتابة', 'Read by the “from the employee record” field on every form; read-only') },
  { id: 'hr.salaryRead', name: t2('قراءة الراتب الأساسي', 'Read the basic salary'), system: 'H4S4', direction: 'read', refPrefix: 'RD', verified: true,
    inputs: [{ key: 'personId', label: t2('الموظف', 'Employee'), required: true, kind: 'person' }], outputs: [{ key: 'basicSalary', label: t2('الراتب الأساسي', 'Basic salary') }],
    sapObject: t2('نوع المعلومات 0008 الأجر الأساسي (PA)', 'Infotype 0008 Basic Pay (PA)'), guidance: t2('لا يُقرأ إلا إن طلب الموظف ذكر الراتب (خطاب التعريف)', 'Read only when the employee asks for the salary to be mentioned (employment letter)') },
  { id: 'hr.absencePost', name: t2('تسجيل غياب', 'Post an absence'), system: 'H4S4', direction: 'write', refPrefix: 'AB', verified: true,
    inputs: [{ key: 'personId', label: t2('الموظف', 'Employee'), required: true, kind: 'person' }, { key: 'subtype', label: t2('رمز نوع الغياب', 'Absence subtype'), required: true, kind: 'text' }, { key: 'from', label: t2('من', 'From'), required: true, kind: 'date' }, { key: 'to', label: t2('إلى', 'To'), required: true, kind: 'date' }], outputs: [{ key: 'ref', label: t2('رقم القيد', 'Record number') }],
    sapObject: t2('نوع المعلومات 2001 الغياب (PT)', 'Infotype 2001 Absences (PT)'), guidance: t2('يستعمله TM-01 (مبنيّ)؛ متاح للخدمات المهيّأة ذات الغياب البسيط', 'Used by TM-01 (built); available to configured services with a simple absence') },
  { id: 'hr.timeEventFix', name: t2('تصحيح حدث وقت', 'Correct a time event'), system: 'H4S4', direction: 'write', refPrefix: 'TE', verified: true,
    inputs: [{ key: 'personId', label: t2('الموظف', 'Employee'), required: true, kind: 'person' }, { key: 'date', label: t2('التاريخ', 'Date'), required: true, kind: 'date' }, { key: 'time', label: t2('الوقت', 'Time'), required: true, kind: 'text' }, { key: 'kind', label: t2('حضور/انصراف', 'In/out'), required: true, kind: 'choice' }], outputs: [{ key: 'ref', label: t2('رقم الحدث', 'Event number') }],
    sapObject: t2('نوع المعلومات 2011 أحداث الوقت (PT)', 'Infotype 2011 Time Events (PT)'), guidance: t2('لخدمة TM-04 نسيان البصمة', 'For TM-04 missed punch') },
  { id: 'hr.qualificationPost', name: t2('تسجيل مؤهل', 'Record a qualification'), system: 'H4S4', direction: 'write', refPrefix: 'QL', verified: true,
    inputs: [{ key: 'personId', label: t2('الموظف', 'Employee'), required: true, kind: 'person' }, { key: 'degree', label: t2('المؤهل', 'Degree'), required: true, kind: 'text' }, { key: 'institute', label: t2('الجهة المانحة', 'Institution'), required: true, kind: 'text' }, { key: 'date', label: t2('تاريخ الحصول', 'Date obtained'), required: true, kind: 'date' }, { key: 'proof', label: t2('الإثبات', 'Proof'), required: false, kind: 'file' }], outputs: [{ key: 'ref', label: t2('رقم القيد', 'Record number') }],
    sapObject: t2('نوع المعلومات 0022 التعليم (PA)', 'Infotype 0022 Education (PA)'), guidance: t2('لخدمة MD-04 إضافة مؤهل', 'For MD-04 add a qualification') },
  { id: 'hr.addressUpdate', name: t2('تحديث العنوان', 'Update the address'), system: 'H4S4', direction: 'write', refPrefix: 'AD', verified: true,
    inputs: [{ key: 'personId', label: t2('الموظف', 'Employee'), required: true, kind: 'person' }, { key: 'address', label: t2('العنوان', 'Address'), required: true, kind: 'text' }, { key: 'city', label: t2('المدينة', 'City'), required: true, kind: 'text' }], outputs: [{ key: 'ref', label: t2('رقم القيد', 'Record number') }],
    sapObject: t2('نوع المعلومات 0006 العناوين (PA)', 'Infotype 0006 Addresses (PA)'), guidance: t2('جزء من MD-01 (منتَج)؛ متاح لخدمة مهيّأة تحدّث العنوان وحده', 'Part of MD-01 (product); available to a configured service that updates the address alone') },
  { id: 'mm.purchaseReq', name: t2('إنشاء طلب شراء', 'Create a purchase requisition'), system: 'S4-MM', direction: 'write', refPrefix: 'PR', verified: true,
    inputs: [{ key: 'item', label: t2('الصنف أو الوصف', 'Material or description'), required: true, kind: 'text' }, { key: 'qty', label: t2('الكمية', 'Quantity'), required: true, kind: 'number' }, { key: 'value', label: t2('القيمة التقديرية', 'Estimated value'), required: false, kind: 'number' }, { key: 'costCenter', label: t2('مركز التكلفة', 'Cost centre'), required: true, kind: 'text' }], outputs: [{ key: 'prNo', label: t2('رقم طلب الشراء', 'PR number') }],
    sapObject: t2('طلب الشراء (MM-PUR) — واجهة API_PURCHASEREQ_PROCESS_SRV', 'Purchase requisition (MM-PUR) — API_PURCHASEREQ_PROCESS_SRV'), guidance: t2('يستعمله AS-01 (مبنيّ) بعد الترسية؛ متاح لخدمة مهيّأة تفتح طلب شراء بسيطاً', 'Used by AS-01 (built) after award; available to a configured service that opens a simple PR') },
  { id: 'fm.fundsReservation', name: t2('حجز اعتماد', 'Reserve funds'), system: 'S4-FM', direction: 'write', refPrefix: 'FR', verified: false,
    inputs: [{ key: 'amount', label: t2('المبلغ', 'Amount'), required: true, kind: 'number' }, { key: 'fundsCenter', label: t2('مركز الاعتماد', 'Funds centre'), required: true, kind: 'text' }, { key: 'purpose', label: t2('الغرض', 'Purpose'), required: true, kind: 'text' }], outputs: [{ key: 'docNo', label: t2('مستند الحجز', 'Reservation document') }],
    sapObject: t2('الأموال المخصّصة (FM) — واجهتها تُثبَّت', 'Earmarked funds (FM) — interface to be confirmed'), guidance: t2('يستعمله AS-01 (مبنيّ) في خطوة الموازنة؛ للخدمات المهيّأة ذات المبلغ (الضيافة، الاستضافة)', 'Used by AS-01 (built) at the budget step; for configured services with an amount (hospitality)') },
  { id: 'dms.archive', name: t2('أرشفة مستند', 'Archive a document'), system: 'DMS', direction: 'write', refPrefix: 'AR', verified: false,
    inputs: [{ key: 'docNo', label: t2('رقم المستند', 'Document number'), required: true, kind: 'text' }, { key: 'personId', label: t2('الموظف', 'Employee'), required: false, kind: 'person' }, { key: 'kind', label: t2('نوع المستند', 'Document kind'), required: true, kind: 'text' }], outputs: [{ key: 'archiveId', label: t2('معرّف الأرشيف', 'Archive id') }],
    sapObject: t2('ArchiveLink / مخزن المحتوى — تُثبَّت الوجهة', 'ArchiveLink / content repository — destination to be confirmed'), guidance: t2('كل مستند يصدر على ورقة الهوية يُؤرشف بمعرّفه', 'Every issued document on the identity sheet is archived by its id') },
  { id: 'mail.external', name: t2('إشعار خارجي بالبريد', 'External email notification'), system: 'MAIL', direction: 'write', refPrefix: 'ML', verified: true,
    inputs: [{ key: 'to', label: t2('إلى (بريد)', 'To (email)'), required: true, kind: 'text' }, { key: 'subject', label: t2('الموضوع', 'Subject'), required: true, kind: 'text' }, { key: 'body', label: t2('النص', 'Body'), required: true, kind: 'text' }, { key: 'attachment', label: t2('المرفق', 'Attachment'), required: false, kind: 'file' }], outputs: [{ key: 'msgId', label: t2('معرّف الرسالة', 'Message id') }],
    sapObject: t2('SAPconnect (BCS) أو خدمة بريد المنصّة', 'SAPconnect (BCS) or the platform mail service'), guidance: t2('لخدمات التأمين (MI-*) والخطابات إلى جهات خارجية (DC-03)', 'For insurance services (MI-*) and letters to external parties (DC-03)') },
  { id: 'bp.supplierCreate', name: t2('إنشاء شريك أعمال: مورّد', 'Create a business partner: supplier'), system: 'S4-MM', direction: 'write', refPrefix: 'BP', verified: true,
    inputs: [{ key: 'name', label: t2('اسم المورّد', 'Supplier name'), required: true, kind: 'text' }, { key: 'crNo', label: t2('السجل التجاري', 'Commercial registration'), required: true, kind: 'text' }, { key: 'iban', label: t2('الآيبان', 'IBAN'), required: true, kind: 'text' }, { key: 'docs', label: t2('المستندات النظامية', 'Statutory documents'), required: true, kind: 'file' }], outputs: [{ key: 'bpNo', label: t2('رقم شريك الأعمال', 'BP number') }],
    sapObject: t2('شريك الأعمال (BP) بدور المورّد — واجهة API_BUSINESS_PARTNER', 'Business partner (BP) with the supplier role — API_BUSINESS_PARTNER'), guidance: t2('لخدمة PR-05 تسجيل مورّد', 'For PR-05 supplier registration') },
];
export function contractById(id?: string): Contract | undefined { return id ? CONTRACTS.find((c) => c.id === id) : undefined; }

/* ——— الربط لكل مستأجر × بيئة ——— */
export function liveBindings(state: State, today = toISO(Date.now())): ContractBinding[] { return (state.contracts?.bindings || []).filter((b) => !b.endedAt || b.endedAt > today); }
export function bindingFor(state: State, tenant: string, contractId: string, env: Env, today = toISO(Date.now())): ContractBinding | undefined {
  return liveBindings(state, today).find((b) => b.tenant === tenant && b.contractId === contractId && b.env === env);
}
export function currentEnv(state: State): Env { const t = (state.tenants || []).find((x) => x.id === state.tenant.id); return t?.env || 'dev'; }
export function tenantById(state: State, id?: string): Tenant | undefined { return id ? (state.tenants || []).find((t) => t.id === id) : undefined; }
/** هل العقد جاهز للتنفيذ في بيئة المستأجر الحالية؟ (مربوط أو مختبَر) */
export function contractReady(state: State, contractId: string, tenant = state.tenant.id, env = currentEnv(state)): { ok: boolean; binding?: ContractBinding; why: T2 } {
  const c = contractById(contractId); if (!c) return { ok: false, why: t2('العقد غير موجود في السجل', 'The contract is not in the registry') };
  const b = bindingFor(state, tenant, contractId, env);
  if (!b || b.status === 'unbound') return { ok: false, binding: b, why: t2(`العقد «${c.name.ar}» غير مربوط في بيئة ${ENV_TITLE[env].ar} للمستأجر ${tenant}`, `Contract “${c.name.en}” is not bound in the ${ENV_TITLE[env].en} environment for tenant ${tenant}`) };
  return { ok: true, binding: b, why: t2(`مربوط: ${b.destination}${b.status === 'tested' ? ' (اختُبر)' : ''}`, `Bound: ${b.destination}${b.status === 'tested' ? ' (tested)' : ''}`) };
}
/** إضافة ربط أو تعديله (P-12: التعديل إنهاء القديم بتاريخ وإضافة الجديد) */
export function upsertBinding(state: State, b: Omit<ContractBinding, 'id' | 'createdAt'> & { id?: string }, at = Date.now()): State {
  const today = toISO(at); const list = state.contracts?.bindings || [];
  const prev = list.find((x) => x.tenant === b.tenant && x.contractId === b.contractId && x.env === b.env && (!x.endedAt || x.endedAt > today));
  const ended = prev ? list.map((x) => (x.id === prev.id ? { ...x, endedAt: today } : x)) : list;
  const nb: ContractBinding = { ...b, id: b.id && !prev ? b.id : `CB-${list.length + 1}`, createdAt: at };
  return { ...state, contracts: { ...state.contracts, bindings: [...ended, nb] } };
}
export function testBinding(state: State, id: string, by: string, at = Date.now()): State {
  return { ...state, contracts: { ...state.contracts, bindings: (state.contracts?.bindings || []).map((b) => (b.id === id ? { ...b, status: 'tested', testedAt: at, testedBy: by } : b)) } };
}
/** التنفيذ (محاكاة): يعود مرجع بالبادئة؛ الحقيقي عبر الوجهة المربوطة خلف طبقة واحدة */
export function runContract(state: State, contractId: string, inputs: Record<string, string>, at = Date.now()): { ok: boolean; ref?: string; message: T2 } {
  const c = contractById(contractId); if (!c) return { ok: false, message: t2('العقد غير موجود', 'Contract not found') };
  const ready = contractReady(state, contractId); if (!ready.ok) return { ok: false, message: ready.why };
  const missing = c.inputs.filter((i) => i.required && !(inputs[i.key] || '').toString().trim());
  if (missing.length) return { ok: false, message: t2(`نقص مدخل إلزامي: ${missing.map((m) => m.label.ar).join('، ')}`, `Missing required input: ${missing.map((m) => m.label.en).join(', ')}`) };
  const seq = (state.erpSeq || 0) + 1; const y = new Date(at).getFullYear();
  const ref = `${c.refPrefix}-${y}-${String(seq).padStart(5, '0')}`;
  return { ok: true, ref, message: t2(`نُفِّذ عقد «${c.name.ar}» في ${SYSTEM_TITLE[c.system].ar} عبر ${ready.binding?.destination || ''}: المرجع ${ref}`, `Contract “${c.name.en}” executed in ${SYSTEM_TITLE[c.system].en} via ${ready.binding?.destination || ''}: reference ${ref}`) };
}
