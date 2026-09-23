// محرك السياسات (بطاقة TM-01 §5): السياسة بيانات لا أكواد؛ لكل سياسة إصدارات مؤرخة، والطلب يحمل رقم الإصدار الذي قُيّم به (D-009)،
// والتغيير بسبب ومرجع وتاريخ سريان وسجل لا يُحذف (D-010). دوال نقية على الحالة.
import type { Desk, T2, Person, Absence, State, Step, Balances, OrgLevel, ErpLink, ErpAbsenceType, NeedAvailability, PoolErpKind } from './types';

export type RouteId = string;
export type Loc = 'riyadh' | 'abudhabi';
/** الفئة القديمة (رسمي/متعاقد) تبقى تسمية عرض؛ مفتاح القواعد الآن مجموعة الموظفين من النظام المرجعي (D-013) */
export type Cat = string;
/** أقسام العرض في شاشة اختيار النوع: الأكثر استخداماً (بطاقات بالرصيد)، ثم المرضية والمرافقة، ثم المناسبات والأسرة، ثم غيرها */
export type Section = 'core' | 'medical' | 'family' | 'other';
export const SECTIONS: Section[] = ['core', 'medical', 'family', 'other'];

/* ——— محرك المسارات والصلاحيات (بطاقة CAP-01 §2، D-012): المعتمد منصب لا شخص ——— */
export type AgentKind = 'lineManager' | 'orgHead' | 'chain' | 'positions' | 'pool' | 'requester' | 'field' | 'owner' | 'band';
/** قاعدة استخراج المعتمد: المدير المباشر، أو رئيس الوحدة بمستوى، أو السلسلة الإدارية حتى مستوى، أو مناصب محددة (بنصاب)، أو فريق عمل (وحدة)؛
    v0.16 (خريطة الحالات 3.9–3.11): أو شخص/منصب/وحدة من حقل في النموذج، أو مالك الخدمة، أو شريحة قيمة من حقل مبلغ — تُحلّ إلى مناصب قبل بناء الخطوات */
export interface AgentRule { kind: AgentKind; level?: OrgLevel; upTo?: OrgLevel; positionIds?: string[]; quorum?: 'any' | 'all' | 'majority'; unitId?: string; fieldId?: string; amountField?: string; bands?: { upTo: number | null; agent: AgentRule }[] }
/** أنواع الخطوة: اعتماد، وإشعار، وتنفيذ بمرجع؛ v0.16: توصية (رأي بلا رفض)، واستكمال من الطالب، وانتظار حتى تاريخ، ونظام عبر عقد */
export type StepModeRule = 'approve' | 'notify' | 'fulfil' | 'review' | 'input' | 'wait' | 'system';
/** شرط تطبيق الخطوة: على الطلب (المدة) أو على الطالب (المجموعة، والمجموعة الفرعية، والمقر) */
export interface StepCondition { field: 'days' | 'workingDays' | 'group' | 'subgroup' | 'location'; op: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'in'; value: number | string | string[] }
/** التصعيد: تذكير عند نسبة من المهلة، وبعد انقضائها إبقاء مع تذكير، أو إبلاغ رئيس المعتمد، أو نقل إلى منصب؛ لا اعتماد آلي */
export interface Escalation { remindAtPct: number; after: 'remind' | 'notifyManager' | 'moveTo'; moveToPositionId?: string }
export interface RouteStep { agent: AgentRule; mode: StepModeRule; slaHours: number; when?: StepCondition; escalation?: Escalation; title?: T2; entitlementId?: string; role?: import('./types').NeedRole; branch?: import('./types').NeedBranch;
  /** v0.16 (خريطة الحالات §3 و§3-ب): معرّف ثابت للخطوة تُشير إليه الشروط والقوالب، وشرط على حقول النموذج وصفات الطالب ونتائج الخطوات السابقة، واعتماد آلي بقاعدة، ومجموعة متوازية، ونموذج الخطوة، والانتظار، والعقد */
  id?: string; cond?: Cond; auto?: Cond; group?: string; form?: StepForm; wait?: { field?: string; days?: number }; contractId?: string; mapping?: Record<string, MapSource> }
/* ——— v0.16 نموذج الخطوة (خريطة الحالات §3-ب): ما يراه صاحب الخطوة في مهمته — خيارات قرار بأثرها، وحقول يملؤها من اللوحة نفسها، وحقول من الطلب يعدّلها بسجل، وقائمة تحقق، وحقول تُخفى، وتعليمات، وسبب من قائمة ——— */
export interface StepOutcome { id: string; name: T2; effect: 'approve' | 'reject' | 'return'; tone?: 'ok' | 'warn' | 'danger' | 'gold'; endedAt?: string }
export interface StepForm { outcomes?: StepOutcome[]; fields?: FormField[]; editable?: string[]; checks?: { id: string; text: T2; endedAt?: string }[]; hidden?: string[]; guidance?: T2; noteRequired?: boolean; reasons?: ChoiceOption[]; allowed?: ('approve' | 'return' | 'reject')[] }
/** مصدر قيمة تُربط بمدخل عقد أو حقل خدمة تالية: حقل من النموذج، أو من ملف الموظف، أو من نموذج خطوة، أو ثابت، أو من الطلب (رقمه، تاريخه، طالبه) */
export interface MapSource { from: 'field' | 'profile' | 'step' | 'const' | 'request'; key: string }
/** الشرط بلا سكربت (v0.16): ورقة واحدة (حقل ومقارنة وقيمة) أو مجموعة «كل الشروط» / «أيّ شرط». الحقل: معرّف حقل في النموذج، أو صفة من ملف الطالب بـ @ (group، subgroup، location، gender، parent، outsideHome، serviceMonths، level)، أو نتيجة خطوة بـ # (#step أو #step.field) */
export interface CondLeaf { field: string; op: 'eq' | 'ne' | 'in' | 'gt' | 'lt' | 'gte' | 'lte' | 'set' | 'unset'; value?: string }
export type Cond = CondLeaf | { all?: CondLeaf[]; any?: CondLeaf[] }
export function condLeaves(c: Cond | undefined): CondLeaf[] { if (!c) return []; if ('field' in c) return [c]; return [...(c.all || []), ...(c.any || [])]; }
export interface Route { id: RouteId; name: T2; steps: RouteStep[] }
export interface PayTier { months: number | null; pay: number } // null = بقية الدورة
export interface CycleRule { years: number; tiers: PayTier[]; condition?: T2 }
/** نطاق التطبيق (D-013): مجموعات ومجموعات فرعية ومقار من النظام المرجعي؛ الفارغ = الجميع */
export interface Scope { groups?: string[]; subgroups?: string[]; locations?: Loc[] }
export function inScope(p: Person, scope?: Scope): boolean {
  if (!scope) return true;
  const g = scope.groups && scope.groups.length ? scope.groups.includes(p.group || '') : true;
  const sg = scope.subgroups && scope.subgroups.length ? scope.subgroups.includes(p.subgroup || '') : true;
  const l = scope.locations && scope.locations.length ? scope.locations.includes(p.location || 'riyadh') : true;
  return g && sg && l;
}
export interface LeaveType {
  id: string; name: T2; icon: string; tone: string; route: RouteId; pay: 'paid' | 'partial' | 'unpaid';
  unit: 'day' | 'halfday'; balance?: 'annual' | 'emergency' | 'none'; section?: Section;
  attachment?: { label: T2; required: boolean };
  windowAfterEnd?: number | null; advanceMin?: number | null; maxPerRequest?: number | null;
  fixedDays?: number; onceInCareer?: boolean;
  hijriWindow?: { month: number; fromDay: number; toDay: number };
  dateWindow?: { label: T2; from: string; to: string };
  eligibility?: ('female' | 'parent' | 'outsideHome')[]; minServiceYears?: number;
  /** من يستحق هذا النوع من فئات الموظفين (D-013)؛ الفارغ = الجميع */
  scope?: Scope;
  /** نافذة موسمية يفتحها مدير النظام ويقفلها من «التشغيل» بلا إصدار جديد (كونوا معهم) */
  seasonal?: boolean;
  /** شرائح الأجر داخل الدورة لكل مجموعة موظفين (المفتاح رمز المجموعة في النظام المرجعي) */
  cycle?: Record<string, CycleRule>;
  maxMonthsPerYears?: { months: number; years: number };
  external?: T2;
  guidance: T2;
  enabled: boolean;
  /** الربط بالنظام المرجعي (إلزامي قبل السريان): تجميع ورمز نوع الغياب في H4S4 الذي يُسجَّل به هذا النوع؛ المفتاح لا الاسم */
  erp?: ErpLink;
  /** إلغاء الإجازة المعتمدة (v0.7، المرحلة 1.1 من TM-01): حتى متى يجوز، وبأي مسار؛ الفارغ = القاعدة الافتراضية cancelRuleOf */
  cancel?: CancelRule;
}
/** قاعدة إلغاء الإجازة المعتمدة: متى يجوز (قبل بدايتها، أو حتى نهايتها، أو لا يجوز)، ومن يعتمد الإلغاء (بلا اعتماد = يُبلَّغ المدير المباشر فقط، أو مسار معياري) */
export interface CancelRule { allowed: 'beforeStart' | 'untilEnd' | 'never'; route: 'none' | RouteId }
export function cancelRuleOf(tp: LeaveType): CancelRule { return tp.cancel || { allowed: 'beforeStart', route: tp.route === 'R1' ? 'none' : tp.route }; }
/** ما يحدث للاستحقاق المنفَّذ عند إلغاء الإجازة: هل يلزم اعتماد الجهة المنفذة قبل الإلغاء، وهل يُفتح لها استرداد مهمةً بمرجع أو إشعاراً */
export interface OnCancel { approval: boolean; reversal: 'task' | 'notify' | 'none'; slaHours: number }
export function onCancelOf(e: Entitlement): OnCancel { return e.onCancel || { approval: true, reversal: 'task', slaHours: 72 }; }
/** إقفال الفترة (التشغيل): لا تُقبل طلبات ولا إلغاءات بتواريخ في الفترة المقفلة أو قبلها — نظير قفل فترة الرواتب في النظام المرجعي */
export interface PeriodClose { until: string; reason: string; reference: string; by: string; at: number }
export function periodClosed(pc: PeriodClose | null | undefined, from: string): boolean { return !!pc && !!from && from <= pc.until; }
/** الأنواع المفعّلة في الإصدار التي لم تُربط بنوع غياب في النظام المرجعي: لا يُجدوَل إصدار قبل ربطها أو تعطيلها */
export function unlinkedTypes(content: PolicyContent): LeaveType[] { return content.types.filter((t) => t.enabled && !t.erp?.subtype); }
export function erpTypeOf(list: ErpAbsenceType[], link?: ErpLink): ErpAbsenceType | undefined { return link ? list.find((x) => x.grouping === link.grouping && x.subtype === link.subtype) : undefined; }
/** تنفيذ الاستحقاق (D-014): من ينفّذ (قاعدة استخراج)، وهل مهمة تُغلق بمرجع أم إشعار فقط، ومتى تُفتح */
export interface Fulfil { mode: 'task' | 'notify'; agent: AgentRule; timing: 'afterApproval' | 'beforeStart'; daysBefore?: number; slaHours: number }
/** استحقاق مرتبط بالإجازة: الأهلية إما «خارج الموطن» (جنسية الموظف ≠ بلد مقر عمله، مع بند العقد) أو «نطاق» من فئات النظام المرجعي؛ والقائمة اليدوية في التشغيل استثناءات فوق النطاق */
export interface Entitlement { id: string; name: T2; eligibility: 'outsideHome' | 'scope'; scope?: Scope; contractFlag?: 'ticketsEntitled'; leaveTypes: string[]; minDays: number; perYear: number; action: T2; fulfil: Fulfil; enabled: boolean; onCancel?: OnCancel }
/** نافذة موسمية: مفتوحة أو مغلقة، وبتاريخين اختياريين */
export interface SeasonalWindow { open: boolean; from?: string; to?: string; changedBy?: string; changedAt?: number }
export interface OpsChange { at: number; by: string; what: T2; detail: string }
/** الضوابط التشغيلية: تسري فوراً بلا إصدار جديد وتُسجَّل في سجل التشغيل */
export interface PolicyOps { windows: Record<string, SeasonalWindow>; groups: Record<string, string[]>; periodClose?: PeriodClose | null }
export interface Holiday { date: string; name: T2; locations: Loc[] }
export interface Calendar { weekend: Record<Loc, number[]>; holidays: Holiday[] }
export interface Warnings { tierPct: number; tierDays: number }
/* ——— v0.9 سياسة الاحتياج (AS-01): الجهات الفنية، والفئات، والمستودعات، والمقرات، والقواعد — كلها تُضاف وتُلغى بتاريخ (P-12) ——— */
export interface NeedEntity { id: string; name: T2; agent: AgentRule; endedAt?: string }
export interface NeedStore { id: string; name: T2; agent: AgentRule; endedAt?: string }
/** v0.11 (D-023): «مصدر التوفر» للفئة — مستودع / رصيد الجهة الفنية / عقد إطاري / لا يوجد؛ وبند الكتالوج قد يتجاوزه */
export interface NeedCategory { id: string; name: T2; kind: 'material' | 'service'; entityId?: string; storeId?: string; custody: boolean; icon: string; tone: string; guidance: T2; endedAt?: string; availability?: NeedAvailability;
  /** v0.12 (D-026): الفئة تتطلب فحصاً بلجنة عند الاستلام مهما كانت القيمة */
  inspection?: boolean }
export interface NeedSite { id: string; name: T2; storeIds: string[]; receiverAgent?: AgentRule; endedAt?: string }
/* ——— v0.10 (AS-01 2.0): كتالوج الاحتياجات، وجدول الصلاحيات بالقيمة، وطرق الشراء — تُضاف وتُلغى بتاريخ ——— */
/** بند في كتالوج الاحتياجات: اسم مألوف للطالب مربوط خلف الشاشة برقم صنف (أو بدائل) من السجل الرئيسي وسعر استرشادي؛ الطالب لا يرى رقم الصنف */
export interface NeedCatalogEntry { id: string; name: T2; categoryId: string; itemIds: string[]; price?: number; unit?: T2; icon?: string; guidance?: T2; endedAt?: string; availability?: NeedAvailability; poolId?: string }
/** v0.11 (D-023): رصيد الجهة الفنية — ما توفّره الجهة من عندها بلا شراء: مقاعد ورخص واشتراكات (سجل في البوابة، مخصص)، أو مادة بمخزون في موقع تخزين (قياسي)، أو سعة متبقية في عقد إطاري (قياسي: أمر تنفيذ يستهلك العقد)؛ الرصيد الجاري في التشغيل لا في الإصدار */
export interface NeedPool { id: string; name: T2; entityId: string; unit: T2; erpKind: PoolErpKind; itemId?: string; storeId?: string; contractId?: string; custody: boolean; unitPrice?: number; guidance?: T2; endedAt?: string }
/** شريحة صلاحيات: حتى قيمة (null = بلا حد) يعتمد الشراء والترسية من يشغل مناصبها (بنصاب) */
export interface AuthorityBand { id: string; name: T2; upTo: number | null; agent: AgentRule; endedAt?: string }
/** طريقة شراء يختارها مكتب المشتريات عند التجهيز: هل تحتاج عروضاً وعددها الأدنى، وهل تحتاج اعتماد الشريحة الأعلى، وهل هي مناقصة أو عقد إطاري */
export interface PurchaseMethod { id: string; name: T2; offers: boolean; minOffers: number; higherBand: boolean; tender: boolean; contract: boolean; guidance?: T2; endedAt?: string }
/** v0.11: قاعدة اعتماد الترسية (D-024: دائماً / بالاستثناء)، والمرفق الإلزامي لكل عرض، ونافذة تنبيه التجزئة (ق-08) */
export interface NeedRules { openerMinLevel: OrgLevel; chainUpTo: OrgLevel; coordinatorStep: boolean; tenderThreshold: number; urgentEnabled: boolean; splitAlertDays: number; minOffers: number; tolerancePct: number; awardApproval?: 'always' | 'exception'; offerAttachmentRequired?: boolean;
  /** v0.12: حد الفحص بلجنة (ريال)، والتسليم عند كل استلام أو بعد اكتماله (D-027)، ومهلة معالجة ما لم يُقبل (أيام)، ومهلة التوريد الافتراضية لأمر الشراء (أيام)، ومصدر أرقام النظام المرجعي (D-028) */
  inspectionThreshold?: number; handoverMode?: 'each' | 'complete'; remedyDays?: number; leadDays?: number; erpNumbers?: 'integration' | 'manual'; sla: { coordinator: number; manager: number; entity: number; store: number; procurement: number; purchaseApproval: number; budget: number; quotes: number; evaluator: number; awardApproval: number; receipt: number; handover: number } }
export interface NeedContent { entities: NeedEntity[]; categories: NeedCategory[]; stores: NeedStore[]; sites: NeedSite[]; catalog: NeedCatalogEntry[]; authority: AuthorityBand[]; methods: PurchaseMethod[]; pools?: NeedPool[]; rules: NeedRules }
export const NEED_LISTS = ['entities', 'categories', 'stores', 'sites', 'catalog', 'authority', 'methods', 'pools'] as const;
export type NeedList = (typeof NEED_LISTS)[number];
/** البنود السارية في تاريخ (الإلغاء إنهاء بتاريخ لا حذف) */
export function liveNeed<T extends { endedAt?: string }>(list: T[], today: string): T[] { return list.filter((x) => !x.endedAt || x.endedAt > today); }
/* ——— v0.13: سياسة الأخبار والقصص (D-030، D-031): القطاعات الناشرة ومناصبها، وأنواع المنشورات، وقواعد القصة والتأكيد والوسائط — كل قائمة بالإضافة والإلغاء بتاريخ (P-12) ——— */
export interface CommsSector { id: string; unitId: string; name: T2; short: T2; ring?: T2; initials: T2; hue: import('./types').Hue; publisherPositionIds: string[]; endedAt?: string }
export interface CommsKind { id: import('./types').PostKind; name: T2; ackAllowed: boolean; mediaAllowed?: boolean; endedAt?: string }
export interface CommsRules { storyHours: number; storyVideoMaxSec: number; storyImageMaxMB: number; storyVideoMaxMB: number; ackReminderDays: number; notifyCircular: boolean; notifyStory: boolean;
  /** وسائط المنشور (v0.14): العدد الأقصى وحدود الحجم والمدة — من السياسة لا من الشيفرة (P-12) */
  postMaxMedia?: number; postImageMaxMB?: number; postVideoMaxMB?: number; postVideoMaxSec?: number }
export interface CommsContent { sectors: CommsSector[]; kinds: CommsKind[]; rules: CommsRules }
/* ——— v0.15 مصمّم الخدمات (CAP-02، D-032…D-034): الخدمة المهيّأة كائن إصدار على الآلة نفسها — نموذج من لوحة حقول ثابتة، وتحققات من معجم ثابت، ومسار بمفردات CAP-01، ومخرج على ورقة الهوية؛ لا سكربت ولا لوحة رسم حرة (المبدأ 5)، وكل شيء بالإضافة والإلغاء بتاريخ (P-12)، وكل كائن يحمل مفتاح مستأجره (D-033) ——— */
/** لوحة الحقول (CAP-02 §3): ما يُرسم منها يُختبر مرة واحدة ويعمل على الهاتف والحاسوب وبلغتين؛ لا حقل حرّ خارجها */
export type FieldKind = 'text' | 'textarea' | 'number' | 'money' | 'date' | 'daterange' | 'choice' | 'multichoice' | 'person' | 'position' | 'unit' | 'attachment' | 'checkbox' | 'guidance'
  /* v0.16 (خريطة الحالات 2.2–2.8): وقت، ونعم/لا، ومقياس، وجدول بنود، وبيانات من ملف الموظف، ومحسوب بمعادلة من معجم، وتوقيع */
  | 'time' | 'yesno' | 'scale' | 'table' | 'profile' | 'computed' | 'signature';
export const FIELD_KINDS: FieldKind[] = ['text', 'textarea', 'number', 'money', 'date', 'time', 'daterange', 'choice', 'multichoice', 'yesno', 'scale', 'person', 'position', 'unit', 'attachment', 'table', 'profile', 'computed', 'checkbox', 'signature', 'guidance'];
/** خيار في قائمة يدوية (بلغتين، وبإلغاء بتاريخ) */
export interface ChoiceOption { id: string; name: T2; endedAt?: string }
/** شرط على حقل آخر: يظهر / يلزم إذا كانت قيمة الحقل … (بلا سكربت: حقل ومقارنة وقيمة)؛ v0.16: ورقة من الشرط المركّب */
export type FieldCond = CondLeaf;
/** معجم التحققات الثابت (CAP-02 §3): إلزامي، ونطاق وطول، ونمط مسمّى، وتاريخ بالنسبة إلى اليوم، وشرط على حقل آخر، وحد المرفقات؛ v0.16: رابط، وللقراءة بشرط، وتاريخ بعد حقل، ورقم لا يتجاوز حقلاً، وفريد بين الطلبات الجارية */
export type NamedPattern = 'none' | 'email' | 'phone' | 'nationalId' | 'iban' | 'plate' | 'url';
export interface FieldRule { required?: boolean; requiredIf?: Cond; showIf?: Cond; readOnlyIf?: Cond; min?: number; max?: number; minLen?: number; maxLen?: number; pattern?: NamedPattern; dateRel?: 'any' | 'future' | 'past' | 'todayOrFuture'; maxDays?: number; maxFiles?: number; fileKinds?: ('pdf' | 'image' | 'doc')[]; maxMB?: number; afterField?: string; lteField?: string; unique?: boolean }
/** مفاتيح ملف الموظف التي يقرأها حقل «بيانات من ملف الموظف» (بعقد قراءة الموظف؛ الراتب الأساسي بعقد قراءة الراتب) */
export type ProfileKey = 'name' | 'empNo' | 'title' | 'unit' | 'hiredAt' | 'location' | 'nationality' | 'group' | 'manager' | 'basicSalary' | 'serviceYears';
export const PROFILE_KEYS: ProfileKey[] = ['name', 'empNo', 'title', 'unit', 'hiredAt', 'serviceYears', 'location', 'nationality', 'group', 'manager', 'basicSalary'];
/** معادلة من معجم ثابت (v0.16): مجموع، أو فرق، أو ضرب، أو أيام بين تاريخين (تقويمية أو عمل)، أو نسبة من حقل، أو عدد صفوف جدول */
export interface Formula { op: 'sum' | 'diff' | 'product' | 'divide' | 'daysBetween' | 'workingDaysBetween' | 'percent' | 'count'; fields: string[]; percent?: number }
/** عمود في جدول بنود: من لوحة مصغّرة (نص، رقم، مبلغ، تاريخ، اختيار) */
export interface TableColumn { id: string; kind: 'text' | 'number' | 'money' | 'date' | 'choice'; label: T2; options?: ChoiceOption[]; required?: boolean; endedAt?: string }
/** قيمة افتراضية: ثابتة، أو اليوم، أو من ملف الموظف، أو من حقل آخر */
export interface FieldDefault { kind: 'static' | 'today' | 'profile' | 'field' | 'me'; value?: string; profileKey?: ProfileKey; field?: string }
/** القوائم المسمّاة من النظام المرجعي التي يجوز لحقل الاختيار أن يقرأ منها بالمفتاح (P-10)؛ تُضاف إليها القائمة بالشيفرة وببطاقة لا من الشاشة */
export type ErpListKey = 'units' | 'positions' | 'groups' | 'subgroups' | 'locations' | 'absenceTypes' | 'storageLocations' | 'suppliers' | 'contracts' | 'items' | 'currencies' | 'countries';
export const ERP_LIST_KEYS: ErpListKey[] = ['units', 'positions', 'groups', 'subgroups', 'locations', 'absenceTypes', 'storageLocations', 'suppliers', 'contracts', 'items', 'currencies', 'countries'];
export interface FormField {
  id: string; kind: FieldKind; label: T2; hint?: T2; placeholder?: T2;
  /** الاختيار: خيارات يدوية، أو قائمة مسمّاة من النظام المرجعي بمفتاحها */
  source?: 'manual' | 'erp'; options?: ChoiceOption[]; erpList?: ErpListKey;
  /** الشخص والمنصب والوحدة: نطاق الاختيار من الهيكل */
  orgFilter?: 'unit' | 'sector' | 'all';
  /** النص الطويل بلغتين؛ والمبلغ بعملته ومنازله؛ والمدة بأيام العمل */
  bilingual?: boolean; currency?: string; decimals?: number; workingDays?: boolean;
  rules?: FieldRule; endedAt?: string;
  /** يظهر في المستند الصادر (المخرج) */
  inDoc?: boolean;
  /** v0.16: مفتاح ملف الموظف، والمعادلة، وأعمدة الجدول وحدود صفوفه، وحدود المقياس ووصفاه، والقيمة الافتراضية */
  profileKey?: ProfileKey; formula?: Formula; columns?: TableColumn[]; maxRows?: number; minRows?: number; scaleMax?: number; scaleLabels?: { low: T2; high: T2 }; default?: FieldDefault;
}
export interface FormSection { id: string; title: T2; hint?: T2; fields: FormField[]; endedAt?: string }
/* ——— v0.16 المخرجات (خريطة الحالات §4): أكثر من مخرج للخدمة — مستند بقالب على ورقة الهوية، أو سجل مخصص بتاريخ انتهاء، أو كتابة عبر عقد، أو خدمة تالية، أو حدث في التقويم ——— */
export type OutputKind = 'document' | 'register' | 'contract' | 'followUp' | 'calendar';
export type DocKind = 'letter' | 'decision' | 'certificate' | 'permit';
/** قالب المستند: فقرات بلغتين فيها حقول دمج {{f:الحقل}} و{{p:المفتاح}} و{{s:الخطوة.الحقل}} و{{r:number|date|requester}}، ونوعه من مجموعة النماذج المطبوعة، وموقّعه، وصلاحيته، ونسخة إلى */
export interface DocTemplate { docKind: DocKind; paragraphs: T2[]; signatory?: { kind: 'lastApprover' | 'position' | 'none'; positionId?: string }; validity?: { field?: string; days?: number }; copyTo?: T2[] }
export interface ServiceOutput {
  id: string; kind: OutputKind; title?: T2; endedAt?: string;
  /** مستند: بادئة الترقيم، والقالب، ومتى يصدر (في النهاية أو عند خطوة بمعرّفها) */
  prefix?: string; template?: DocTemplate; issueAt?: 'end' | string;
  /** سجل مخصص: معرّفه (سجل واحد قد تشترك فيه خدمات: الإصدار والتجديد)، وأعمدته من حقول النموذج، وحقل تاريخ الانتهاء، والتنبيه قبله، وخدمة التجديد */
  registerId?: string; columns?: string[]; expiryField?: string; remindDays?: number; renewService?: string;
  /** عقد: معرّفه وربط مدخلاته */
  contractId?: string; mapping?: Record<string, MapSource>;
  /** خدمة تالية: اقتراح برابط، أو فتح تلقائي بنقل الحقول */
  serviceId?: string; mode?: 'suggest' | 'auto'; map?: Record<string, string>;
  /** حدث في تقويم الطالب: من حقل تاريخ */
  dateField?: string;
}
/** إشعار مهيّأ (خريطة الحالات 5.2): عند حدث، إلى جهة، بعنوان ونص فيهما حقول الدمج */
export interface NotifyRule { id: string; when: 'submitted' | 'completed' | 'rejected' | 'returned' | 'step'; stepId?: string; to: 'requester' | 'lineManager' | 'unitHead' | 'owner' | 'positions' | 'field'; positionIds?: string[]; fieldId?: string; title: T2; body: T2; endedAt?: string }
/** تذكير قبل تاريخ من حقل بأيام (5.3) */
export interface Reminder { id: string; field: string; daysBefore: number; to: 'requester' | 'lineManager'; text: T2; endedAt?: string }
export type ServiceKind = 'configured' | 'hybrid';
export interface ConfiguredService {
  id: string; name: T2; domain: string; description: T2; icon: string; tone: string;
  /** مفتاح المستأجر (D-033): كل كائن تهيئة يحمله منذ اليوم الأول؛ التشغيل بمستأجر واحد حتى ينضم غيره */
  tenant: string;
  kind: ServiceKind;
  /** من يطلبها: نطاق من فئات النظام المرجعي (D-013)؛ الفارغ = الجميع. ومن يطلب باسم غيره: لا أحد، أو المدير لفريقه، أو شؤون الموظفين لموظف سابق؛ v0.16: شؤون الموظفين لأي موظف، ورئيس الوحدة لوحدته */
  scope?: Scope; onBehalf?: 'none' | 'team' | 'former' | 'hrAny' | 'unit';
  /** خدمة سرية: لا يرى الطلب إلا طالبه ومعتمدوه ومنفذوه؛ وإخفاء هوية الطالب عن الخطوات (التظلمات) */
  confidential?: boolean; hideRequester?: boolean;
  /** v0.16 (خريطة الحالات §1): الأهلية بالصفات، ونافذة التقديم، والحصة، والشروط المسبقة، والجمهور التجريبي، والمالك */
  eligibility?: ('female' | 'male' | 'parent' | 'outsideHome')[]; window?: { from?: string; to?: string }; limit?: { count: number; per: 'year' | 'month' | 'ever' | 'open' };
  prereq?: { minServiceMonths?: number; requiresService?: string; requiresRecord?: boolean }; visibility?: 'all' | 'pilot'; pilot?: { unitIds?: string[]; personIds?: string[] }; owner?: { positionId?: string };
  /** v0.16 (§2): النموذج على صفحات، و«قبل أن تبدأ»، والإقرار النهائي */
  paged?: boolean; beforeYouStart?: T2[]; declaration?: T2;
  sections: FormSection[];
  /** المسار بمفردات CAP-01 (من يعتمد بالمنصب والعلاقة التنظيمية، والنصاب، والمهلة، والتصعيد، ومهام التنفيذ) — بلا لوحة رسم حرة */
  route: RouteStep[];
  /** v0.16: المخرجات (بدل المخرج الواحد)، والإشعارات المهيّأة، والتذكيرات */
  outputs: ServiceOutput[]; notifications?: NotifyRule[]; reminders?: Reminder[];
  endedAt?: string; source?: 'catalog' | 'new' | 'template' | 'clone' | 'import'; createdAt?: number;
}
/** المخرج الرئيس للعرض (بطاقة الخدمة والخطوة الأخيرة): مستند، أو سجل، أو لا شيء */
export function primaryOutput(svc: ConfiguredService): 'document' | 'register' | 'none' { const live = (svc.outputs || []).filter((o) => !o.endedAt); return live.some((o) => o.kind === 'document') ? 'document' : live.some((o) => o.kind === 'register') ? 'register' : 'none'; }
export interface DesignerContent { services: ConfiguredService[] }
export interface PolicyContent { types: LeaveType[]; routes: Route[]; entitlements: Entitlement[]; calendar: Calendar; warnings: Warnings; need?: NeedContent; comms?: CommsContent; designer?: DesignerContent }
export interface PolicyChange { at: number; by: string; path: string; label: T2; before: string; after: string; why?: string }
/** الموافقة الثانية على الإصدار (D-010): تُطلب عند الجدولة إن كان المفتاح مفعّلاً، ولا يسري الإصدار قبلها */
export interface VersionApproval { positionId: string; status: 'pending' | 'approved' | 'returned'; requestedAt: number; by?: string; at?: number; note?: string }
export interface PolicyVersion { id: string; number: string; from: string; scheduled: boolean; cancelled?: boolean; createdBy: string; createdAt: number; reason: string; reference: string; content: PolicyContent; changes: PolicyChange[]; baseId?: string; approval?: VersionApproval; notifiedScheduled?: boolean; notifiedActive?: boolean;
  /** v0.7 تصحيح الإصدارات: إصدار تصحيحي يحل محل إصدار سارٍ من تاريخه نفسه (correctsId)، أو تراجُع عن إصدار سرى ولم يُقيَّم به طلب (revoked) */
  correctsId?: string; revoked?: { by: string; at: number; reason: string };
  /** v0.8 (D-016): نطاق الإصدار المعلَن عند إنشائه — نوع واحد أو مسار أو استحقاق أو التقويم أو السياسة كلها؛ المحرر يُفتح عليه وحده */
  scope?: VersionScope;
  /** v0.8.1: المسودة التي صدر بعد إنشائها إصدار آخر تُطبَّق عند جدولتها فوق طرف السلسلة (كائناً كائناً) ويُذكر الإصدار الذي أُنشئت عليه */
  rebasedFrom?: { id: string; number: string; at: number } }
/** نطاق الإصدار: ما الذي يغيّره هذا الإصدار (يُعلَن عند الإنشاء ويُستنتج من سجل التغييرات بعد الحفظ) */
export type ScopeKind = 'all' | 'type' | 'route' | 'entitlement' | 'calendar';
export interface VersionScope { kind: ScopeKind; id?: string }
/** حوكمة التغيير: مدير سياسة واحد، ومفتاح الموافقة الثانية (مطفأ افتراضياً) مع المكتب الذي يعتمد */
export interface Governance { secondApprover: boolean; approverPositionId: string }
export interface PolicyState { versions: PolicyVersion[]; windows: Record<string, SeasonalWindow>; groups: Record<string, string[]>; opsLog: OpsChange[]; governance: Governance; periodClose?: PeriodClose | null }
export type VersionStatus = 'draft' | 'awaiting' | 'scheduled' | 'active' | 'expired' | 'cancelled' | 'corrected' | 'reverted';

/* ——— التواريخ ——— */
export const DAY = 86400000;
export const MONTH_DAYS = 30; // في النموذج: الشهر 30 يوماً
export function toISO(d: Date | number): string { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; }
export function fromISO(s: string): Date { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
export function addDays(s: string, n: number): string { const d = fromISO(s); d.setDate(d.getDate() + n); return toISO(d); }
/** سنوات تقويمية: 2026-07-25 + سنتان = 2028-07-25 (ونهاية الدورة اليوم الذي قبله) */
export function addYears(s: string, n: number): string { const d = fromISO(s); const m = d.getMonth(), day = d.getDate(); d.setFullYear(d.getFullYear() + n); if (d.getMonth() !== m) d.setDate(0); void day; return toISO(d); }
/** بلد مقر العمل: يُقارن بجنسية الموظف لتحديد «يعمل خارج موطنه» */
export const LOC_COUNTRY: Record<Loc, string> = { riyadh: 'SA', abudhabi: 'AE' };
export function worksOutsideHome(p: Person): boolean { if (p.nationality) return p.nationality !== LOC_COUNTRY[p.location || 'riyadh']; return !!p.outsideHome; }
/** نافذة كونوا معهم ونحوها: مفتوحة الآن؟ */
export function windowOpen(w: SeasonalWindow | undefined, today: string): boolean { if (!w || !w.open) return false; if (w.from && today < w.from) return false; if (w.to && today > w.to) return false; return true; }
export function daysBetween(a: string, b: string): number { return Math.round((fromISO(b).getTime() - fromISO(a).getTime()) / DAY) + 1; }
export function isWeekend(s: string, loc: Loc, cal: Calendar): boolean { return cal.weekend[loc].includes(fromISO(s).getDay()); }
export function holidayOn(s: string, loc: Loc, cal: Calendar): Holiday | undefined { return cal.holidays.find((h) => h.date === s && h.locations.includes(loc)); }
export function isWorkingDay(s: string, loc: Loc, cal: Calendar): boolean { return !isWeekend(s, loc, cal) && !holidayOn(s, loc, cal); }
export function workingDaysBetween(a: string, b: string, loc: Loc, cal: Calendar): number { let n = 0; for (let d = a; d <= b; d = addDays(d, 1)) if (isWorkingDay(d, loc, cal)) n++; return n; }
export function addWorkingDays(s: string, n: number, loc: Loc, cal: Calendar): string { let d = s; let k = 0; while (k < n) { d = addDays(d, 1); if (isWorkingDay(d, loc, cal)) k++; } return d; }
export function hijri(s: string): { y: number; m: number; d: number } | null {
  try { const parts = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(fromISO(s)); const g = (t: string) => Number(parts.find((p) => p.type === t)?.value); return { y: g('year'), m: g('month'), d: g('day') }; } catch { return null; }
}
export function hijriText(s: string, lang: 'ar' | 'en'): string {
  try { return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA-u-ca-islamic-umalqura-nu-latn' : 'en-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' }).format(fromISO(s)); } catch { return ''; }
}

/* ——— الإصدارات ——— */
/** إصدار نافذ: مجدول وغير ملغى وقد نال الموافقة الثانية إن كانت مطلوبة */
export function inForce(v: PolicyVersion): boolean { return v.scheduled && !v.cancelled && (!v.approval || v.approval.status === 'approved'); }
/** أسبقية الإصدارات: التاريخ الأحدث يسبق، وعند تساوي التاريخ يسبق الأحدث إنشاءً (فلا يكون إصداران ساريين في يوم واحد) */
export function supersedes(a: PolicyVersion, b: PolicyVersion): boolean { return a.from > b.from || (a.from === b.from && a.createdAt > b.createdAt); }
export function statusOf(v: PolicyVersion, versions: PolicyVersion[], today: string): VersionStatus {
  if (v.revoked) return 'reverted';
  if (v.cancelled) return 'cancelled';
  if (!v.scheduled) return 'draft';
  if (v.approval && v.approval.status === 'pending') return 'awaiting';
  if (v.from > today) return 'scheduled';
  const later = versions.filter((x) => x.id !== v.id && inForce(x) && supersedes(x, v) && x.from <= today);
  if (!later.length) return 'active';
  /* حلّ محله إصدار من تاريخه نفسه (إصدار تصحيحي): لم يسرِ يوماً كاملاً */
  return later.some((x) => x.from === v.from) ? 'corrected' : 'expired';
}
/** الإصدار الذي صحّح هذا الإصدار (إن وُجد) */
export function correctedBy(v: PolicyVersion, versions: PolicyVersion[]): PolicyVersion | undefined { return versions.find((x) => x.id !== v.id && inForce(x) && x.from === v.from && x.createdAt > v.createdAt); }
export function endOf(v: PolicyVersion, versions: PolicyVersion[]): string | null {
  const next = versions.filter((x) => x.id !== v.id && inForce(x) && supersedes(x, v)).sort((a, b) => (supersedes(a, b) ? 1 : -1))[0];
  return next ? (next.from > v.from ? addDays(next.from, -1) : v.from) : null;
}
export function versionOn(policy: PolicyState, date: string): PolicyVersion | undefined {
  return policy.versions.filter((v) => inForce(v) && v.from <= date).sort((a, b) => (supersedes(a, b) ? -1 : 1))[0];
}
/** تحقق ورقة الجدولة: التاريخ لا يسبق اليوم ولا يساوي تاريخ إصدار نافذ آخر ولا يسبق طرف السلسلة؛ ولا جدولة وإصدارٌ ينتظر الموافقة الثانية، ولا مع تعارض، ولا بلا تغيير، ولا بنوع غير مرتبط أو نافذة غير مكتملة */
export type ScheduleProblem = 'past' | 'taken' | 'beforeTip' | 'awaiting' | 'conflict' | 'empty' | 'unlinked' | 'incomplete';
export function scheduleProblem(policy: PolicyState, id: string, from: string, today: string, content?: PolicyContent): ScheduleProblem | null {
  if (!from || from < today) return 'past';
  /* الإصدار التصحيحي يجوز له تاريخ الإصدار الذي يصحّحه نفسه (فيحل محله من ذلك اليوم)؛ غيره لا يشارك إصداراً نافذاً تاريخه */
  const me = policy.versions.find((v) => v.id === id);
  if (policy.versions.some((v) => v.id !== id && v.id !== me?.correctsId && inForce(v) && v.from === from)) return 'taken';
  /* v0.8: المسودة بُنيت على طرف السلسلة (وقد يكون مجدولاً)، فلا تُجدوَل قبله وإلا سرى تغييره قبل موعده */
  if (!me?.correctsId && policy.versions.some((v) => v.id !== id && inForce(v) && v.from > from)) return 'beforeTip';
  /* v0.8.1: سلسلة الإصدارات مرتّبة — لا جدولة وإصدارٌ آخر ينتظر الموافقة الثانية (يُبتّ فيه أولاً)، ولا مسودة تعارض ما صدر بعد إنشائها */
  if (awaitingVersion(policy, id)) return 'awaiting';
  const c = content || me?.content;
  if (me && c && rebasePlan(policy, me, c).conflicts.length) return 'conflict';
  /* v0.8.1: إصدار بلا تغيير يربك السجل («آخر تعديل» يشير إليه ولم يغيّر شيئاً)؛ لا يُجدوَل */
  if (me && c && !diffContent(baseContentOf(policy, me), c).length) return 'empty';
  /* v0.6.4: لا يُجدوَل إصدار فيه نوع مفعّل غير مرتبط بنوع غياب في النظام المرجعي — الطلب المعتمد لن يجد رمزاً يُرحَّل به */
  if (c && unlinkedTypes(c).length) return 'unlinked';
  /* v0.8.1: نافذة إتاحة غير مكتملة (تاريخان ناقصان أو معكوسان، أو أيام هجرية معكوسة) تجعل النوع متاحاً دائماً أو لا يُتاح أبداً بلا قصد */
  if (c && incompleteWindows(c).length) return 'incomplete';
  return null;
}
/** محتوى الأساس الذي بُنيت عليه المسودة (الإصدار المصحَّح للتصحيحي، وطرف السلسلة عند إنشائها لغيره) */
export function baseContentOf(policy: PolicyState, v: PolicyVersion): PolicyContent { return policy.versions.find((x) => x.id === v.baseId)?.content || v.content; }
/** الإصدار الذي ينتظر الموافقة الثانية الآن (إن وُجد) */
export function awaitingVersion(policy: PolicyState, exceptId?: string): PolicyVersion | undefined { return policy.versions.find((v) => v.id !== exceptId && v.scheduled && !v.cancelled && v.approval?.status === 'pending'); }
/** نوافذ الإتاحة غير المكتملة في الأنواع المفعّلة: نافذة ثابتة بلا تاريخين أو معكوسة، أو نافذة هجرية أيامها معكوسة أو خارج الشهر */
export type WindowProblem = 'dates' | 'reversed' | 'hijri';
export function incompleteWindows(content: PolicyContent): { tp: LeaveType; why: WindowProblem }[] {
  const out: { tp: LeaveType; why: WindowProblem }[] = [];
  for (const tp of content.types) {
    if (!tp.enabled) continue;
    if (tp.hijriWindow) { const h = tp.hijriWindow; if (!(h.month >= 1 && h.month <= 12) || !(h.fromDay >= 1) || !(h.toDay <= 30) || !(h.fromDay <= h.toDay)) out.push({ tp, why: 'hijri' }); }
    else if (tp.dateWindow && !tp.seasonal) { if (!tp.dateWindow.from || !tp.dateWindow.to) out.push({ tp, why: 'dates' }); else if (tp.dateWindow.from > tp.dateWindow.to) out.push({ tp, why: 'reversed' }); }
  }
  return out;
}
/** حالة النافذة الثابتة اليوم: مفتوحة الآن، أو تفتح لاحقاً، أو انتهت */
export function fixedWindowState(w: { from: string; to: string }, today: string): 'open' | 'upcoming' | 'ended' | null { if (!w.from || !w.to || w.from > w.to) return null; return today < w.from ? 'upcoming' : today > w.to ? 'ended' : 'open'; }
export function activeVersion(policy: PolicyState, today = toISO(Date.now())): PolicyVersion { return versionOn(policy, today) || policy.versions[0]; }

/* ——— v0.8 أساس الإدارة (D-016): الإصدار تعديلٌ معلَن النطاق على سياسة واحدة، ولكل كائن سجلُّه ——— */
export type Head = 'types' | 'routes' | 'entitlements' | 'calendar' | 'warnings' | 'need' | 'comms' | 'designer';
export interface Touched { head: Head; id?: string }
export const HEAD_OF_KIND: Record<Exclude<ScopeKind, 'all'>, Head> = { type: 'types', route: 'routes', entitlement: 'entitlements', calendar: 'calendar' };
/** الكائنات التي مسّها الإصدار، تُستنتج من مسارات سجل تغييراته؛ والمسودة التي لم تُغيّر شيئاً بعد تُظهر نطاقها المعلَن */
/** الكائن الذي يمسّه مسار تغيير: للأنواع والمسارات والاستحقاقات معرّف؛ ولسياسة الاحتياج القائمة ومعرّف البند (need · entities.IT) أو «rules»؛ ولمصمّم الخدمات الخدمة بمعرّفها (designer · services.DC-03) */
export function pathObject(p: string): Touched {
  const parts = p.split('.'); const h = parts[0] as Head;
  if (h === 'need') { const sub = parts[1]; return (NEED_LISTS as readonly string[]).includes(sub) ? { head: 'need', id: `${sub}.${parts[2]}` } : { head: 'need', id: sub }; }
  if (h === 'comms') { const sub = parts[1]; return sub === 'sectors' || sub === 'kinds' ? { head: 'comms', id: `${sub}.${parts[2]}` } : { head: 'comms', id: sub }; }
  if (h === 'designer') { const sub = parts[1]; return sub === 'services' ? { head: 'designer', id: `services.${parts[2]}` } : { head: 'designer', id: sub }; }
  return h === 'types' || h === 'routes' || h === 'entitlements' ? { head: h, id: parts[1] } : { head: h };
}
export function touchedFromPaths(paths: string[]): Touched[] {
  const out: Touched[] = []; const seen = new Set<string>();
  for (const p of paths) { const o = pathObject(p); const key = o.id ? `${o.head}.${o.id}` : o.head; if (seen.has(key)) continue; seen.add(key); out.push(o); }
  return out;
}
export function touchedIn(v: PolicyVersion): Touched[] {
  const out = touchedFromPaths(v.changes.map((c) => c.path));
  if (!out.length && v.scope && v.scope.kind !== 'all') out.push({ head: HEAD_OF_KIND[v.scope.kind], id: v.scope.id });
  return out;
}
/** الكائنان نفسهما؟ (التقويم والإنذار المبكر بلا معرّف) */
export function sameObject(a: Touched, b: Touched): boolean { return a.head === b.head && (a.id === undefined || b.id === undefined || a.id === b.id); }
export function touches(v: PolicyVersion, head: Head, id?: string): boolean { return touchedIn(v).some((x) => x.head === head && (id === undefined || x.id === id)); }
/** التغييرات التي مسّت كائناً بعينه في إصدار */
export function changesOf(v: PolicyVersion, head: Head, id?: string): PolicyChange[] { return v.changes.filter((c) => { const o = pathObject(c.path); return o.head === head && (id === undefined || o.id === id); }); }
/** سجل الكائن: الإصدارات التي مسّته (الملغاة لا تُعدّ إلا ما تُرُوجع عنه)، الأحدث سرياناً أولاً */
export function versionsTouching(versions: PolicyVersion[], head: Head, id?: string): PolicyVersion[] { return versions.filter((v) => (!v.cancelled || v.revoked) && touches(v, head, id)).sort((a, b) => (supersedes(a, b) ? -1 : 1)); }
/** آخر إصدار نافذ مسّ الكائن — قد يكون مجدولاً لم يسرِ بعد، فتقول الشاشة «يسري من» */
export function lastChangeOf(versions: PolicyVersion[], head: Head, id?: string): PolicyVersion | undefined { return versions.filter((v) => inForce(v) && touches(v, head, id)).sort((a, b) => (supersedes(a, b) ? -1 : 1))[0]; }
/** طرف السلسلة: أحدث إصدار نافذ بالتاريخ ولو كان مجدولاً؛ عليه تُبنى المسودة الجديدة فلا يضيع تغيير مجدول عند سريان الذي بعده */
export function tipVersion(policy: PolicyState): PolicyVersion { return policy.versions.filter(inForce).sort((a, b) => (supersedes(a, b) ? -1 : 1))[0] || policy.versions[0]; }
/** هل الكائن داخل نطاق المسودة؟ (النطاق «الكل» يشمل كل شيء) */
export function inVersionScope(scope: VersionScope | undefined, head: Head, id?: string): boolean { if (!scope || scope.kind === 'all') return true; const h = HEAD_OF_KIND[scope.kind]; return h === head && (scope.id === undefined || id === undefined || scope.id === id); }

/* ——— v0.8.1 سلامة السلسلة: المسودة صورة كاملة من أساسها، فإن صدر بعد إنشائها إصدار آخر تُطبَّق عند جدولتها فوق الطرف الحالي كائناً كائناً (كما يحمل أمر النقل في النظام المرجعي الكائن كاملاً)، وإن مسّ الإصدار اللاحق الكائن نفسه فذلك تعارض يُرفض ——— */
export interface RebasePlan { stale: boolean; base?: PolicyVersion; tip: PolicyVersion; mine: Touched[]; conflicts: { obj: Touched; version: PolicyVersion }[] }
export function rebasePlan(policy: PolicyState, v: PolicyVersion, content: PolicyContent = v.content): RebasePlan {
  const tip = tipVersion(policy); const base = policy.versions.find((x) => x.id === v.baseId);
  const mine = touchedFromPaths(diffContent(base?.content || v.content, content).map((d) => d.path));
  const stale = !v.scheduled && !v.correctsId && !!base && base.id !== tip.id;
  if (!stale || !base) return { stale: false, base, tip, mine, conflicts: [] };
  const between = policy.versions.filter((x) => inForce(x) && x.id !== v.id && x.id !== base.id && supersedes(x, base));
  const conflicts: RebasePlan['conflicts'] = [];
  for (const m of mine) { const hit = between.find((b) => touchedIn(b).some((o) => sameObject(o, m))); if (hit) conflicts.push({ obj: m, version: hit }); }
  return { stale, base, tip, mine, conflicts };
}
/** تطبيق المسودة فوق طرف السلسلة عند الجدولة (إن كانت قديمة الأساس ولا تعارض): الكائنات التي مسّتها تُنقل كما هي، وسواها يُؤخذ من الطرف، ويُعاد حساب سجل التغييرات عليه ويُسجَّل في التشغيل */
export function rebaseDraft(policy: PolicyState, id: string, at = Date.now()): PolicyState {
  const v = policy.versions.find((x) => x.id === id); if (!v) return policy;
  const plan = rebasePlan(policy, v); if (!plan.stale || !plan.base || plan.conflicts.length) return policy;
  const tip = plan.tip; const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T; const c: PolicyContent = clone(tip.content);
  for (const m of plan.mine) {
    if (m.head === 'calendar') c.calendar = clone(v.content.calendar);
    else if (m.head === 'warnings') c.warnings = clone(v.content.warnings);
    else if (m.head === 'need') {
      /* سياسة الاحتياج: البند بمعرّفه داخل قائمته (جهة، فئة، مستودع، مقر) أو كتلة القواعد */
      const [sub, oid] = (m.id || '').split('.'); if (!c.need || !v.content.need) continue;
      if (sub === 'rules') c.need.rules = clone(v.content.need.rules);
      else if ((NEED_LISTS as readonly string[]).includes(sub)) { const list = c.need[sub as NeedList] as unknown as { id: string }[]; const src = (v.content.need[sub as NeedList] as unknown as { id: string }[]).find((x) => x.id === oid); const i = list.findIndex((x) => x.id === oid); if (!src) { if (i >= 0) list.splice(i, 1); } else if (i >= 0) list[i] = clone(src); else list.push(clone(src)); }
    } else if (m.head === 'comms') {
      const [sub, oid] = (m.id || '').split('.'); if (!c.comms || !v.content.comms) continue;
      if (sub === 'rules') c.comms.rules = clone(v.content.comms.rules);
      else if (sub === 'sectors' || sub === 'kinds') { const list = c.comms[sub] as unknown as { id: string }[]; const src = (v.content.comms[sub] as unknown as { id: string }[]).find((x) => x.id === oid); const i = list.findIndex((x) => x.id === oid); if (!src) { if (i >= 0) list.splice(i, 1); } else if (i >= 0) list[i] = clone(src); else list.push(clone(src)); }
    } else if (m.head === 'designer') {
      /* v0.15: الخدمة المهيّأة كائن واحد يُنقل كاملاً (نموذجها ومسارها ومخرجها) كما ينقل أمر النقل الكائن كاملاً */
      const [sub, oid] = (m.id || '').split('.'); if (!c.designer || !v.content.designer || sub !== 'services') continue;
      const list = c.designer.services as { id: string }[]; const src = v.content.designer.services.find((x) => x.id === oid); const i = list.findIndex((x) => x.id === oid);
      if (!src) { if (i >= 0) list.splice(i, 1); } else if (i >= 0) list[i] = clone(src); else list.push(clone(src));
    } else {
      const list = c[m.head] as unknown as { id: string }[]; const src = (v.content[m.head] as unknown as { id: string }[]).find((x) => x.id === m.id); const i = list.findIndex((x) => x.id === m.id);
      if (!src) { if (i >= 0) list.splice(i, 1); } else if (i >= 0) list[i] = clone(src); else list.push(clone(src));
    }
  }
  const why = v.changes.find((x) => x.why)?.why || '';
  const changes: PolicyChange[] = diffContent(tip.content, c).map((d) => { const old = v.changes.find((x) => x.path === d.path); return { at: old?.at || at, by: old?.by || v.createdBy, path: d.path, label: labelFor(d.path, c), before: d.before, after: d.after, why: old?.why || why }; });
  const what: T2 = { ar: `طُبِّقت المسودة ${v.number} فوق الإصدار ${tip.number} عند جدولتها (أُنشئت على ${plan.base.number})`, en: `Draft ${v.number} applied on top of version ${tip.number} at scheduling (created on ${plan.base.number})` };
  return { ...policy, versions: policy.versions.map((x) => (x.id === id ? { ...x, content: c, baseId: tip.id, changes, rebasedFrom: { id: plan.base!.id, number: plan.base!.number, at } } : x)), opsLog: [{ at, by: v.createdBy, what, detail: '' }, ...policy.opsLog] };
}

/* ——— v0.8: متى يتاح النوع — دائماً، أو موسم يشغّله مدير النظام (كونوا معهم)، أو بين تاريخين ثابتين، أو نافذة هجرية كل سنة (الحج) ——— */
export type Availability = 'always' | 'season' | 'fixed' | 'hijri';
export function availabilityOf(tp: LeaveType): Availability { return tp.seasonal ? 'season' : tp.hijriWindow ? 'hijri' : tp.dateWindow ? 'fixed' : 'always'; }
export function availabilityPatch(tp: LeaveType, a: Availability): Partial<LeaveType> {
  const label = tp.dateWindow?.label && (tp.dateWindow.label.ar || tp.dateWindow.label.en) ? tp.dateWindow.label : { ...tp.name };
  if (a === 'season') return { seasonal: true, dateWindow: { label, from: '', to: '' }, hijriWindow: undefined };
  if (a === 'fixed') return { seasonal: undefined, dateWindow: { label, from: tp.dateWindow?.from || '', to: tp.dateWindow?.to || '' }, hijriWindow: undefined };
  if (a === 'hijri') return { seasonal: undefined, dateWindow: undefined, hijriWindow: tp.hijriWindow || { month: 12, fromDay: 1, toDay: 20 } };
  return { seasonal: undefined, dateWindow: undefined, hijriWindow: undefined };
}
export const HIJRI_MONTHS: T2[] = [
  { ar: 'محرم', en: 'Muharram' }, { ar: 'صفر', en: 'Safar' }, { ar: 'ربيع الأول', en: 'Rabi I' }, { ar: 'ربيع الآخر', en: 'Rabi II' }, { ar: 'جمادى الأولى', en: 'Jumada I' }, { ar: 'جمادى الآخرة', en: 'Jumada II' },
  { ar: 'رجب', en: 'Rajab' }, { ar: 'شعبان', en: 'Shaban' }, { ar: 'رمضان', en: 'Ramadan' }, { ar: 'شوال', en: 'Shawwal' }, { ar: 'ذو القعدة', en: 'Dhu al-Qadah' }, { ar: 'ذو الحجة', en: 'Dhu al-Hijjah' },
];
export function hijriMonthName(m: number, lang: 'ar' | 'en'): string { const x = HIJRI_MONTHS[m - 1]; return x ? (lang === 'ar' ? x.ar : x.en) : String(m); }

/* ——— v0.8 إقفال الفترة (D-015): الأنواع التي تُقدَّم بعد وقوعها تحدّد «أقرب إقفال آمن» ——— */
export function afterEndTypes(content: PolicyContent): LeaveType[] { return content.types.filter((t) => t.enabled && (t.windowAfterEnd || 0) > 0); }
/** أقرب تاريخ يجوز فيه إقفال الفترة حتى `until` دون أن يُقطع على أحد نافذة التقديم بعد الوقوع (بأطول نافذة وبأبعد تقويم مقر) */
export function safeCloseDate(content: PolicyContent, until: string): string {
  const n = Math.max(0, ...afterEndTypes(content).map((t) => t.windowAfterEnd || 0)); if (!n || !until) return '';
  const a = addWorkingDays(until, n, 'riyadh', content.calendar); const b = addWorkingDays(until, n, 'abudhabi', content.calendar); return a > b ? a : b;
}

/* ——— الفروق وسجل التغييرات ——— */
type Flat = Record<string, string>;
function flatten(obj: unknown, prefix = '', out: Flat = {}): Flat {
  if (Array.isArray(obj)) { obj.forEach((x, i) => { const key = x && typeof x === 'object' && 'id' in (x as object) ? String((x as { id: string }).id) : String(i); flatten(x, prefix ? `${prefix}.${key}` : key, out); }); return out; }
  if (obj && typeof obj === 'object') { for (const [k, v] of Object.entries(obj as Record<string, unknown>)) flatten(v, prefix ? `${prefix}.${k}` : k, out); return out; }
  out[prefix] = obj === null || obj === undefined ? '' : typeof obj === 'object' ? JSON.stringify(obj) : String(obj); return out;
}
const FIELD_LABEL: Record<string, T2> = {
  route: { ar: 'المسار', en: 'Route' }, section: { ar: 'القسم في شاشة الاختيار', en: 'Section in the picker' }, pay: { ar: 'الأجر', en: 'Pay' }, unit: { ar: 'الوحدة', en: 'Unit' }, balance: { ar: 'الرصيد المرتبط', en: 'Linked balance' },
  'attachment.label.ar': { ar: 'المرفق', en: 'Attachment' }, 'attachment.required': { ar: 'إلزام المرفق', en: 'Attachment required' },
  windowAfterEnd: { ar: 'نافذة التقديم بعد الانتهاء (أيام عمل)', en: 'Submission window after end (working days)' }, advanceMin: { ar: 'الحد الأدنى للتقديم المسبق (أيام)', en: 'Minimum advance notice (days)' },
  maxPerRequest: { ar: 'السقف الأقصى للطلب الواحد', en: 'Maximum per request' }, fixedDays: { ar: 'مدة الإجازة (أيام)', en: 'Leave length (days)' }, onceInCareer: { ar: 'مرة واحدة في العمر الوظيفي', en: 'Once in career' },
  minServiceYears: { ar: 'الحد الأدنى لسنوات الخدمة', en: 'Minimum service years' }, enabled: { ar: 'مفعّل', en: 'Enabled' }, 'guidance.ar': { ar: 'نص الإرشاد', en: 'Guidance text' }, 'guidance.en': { ar: 'نص الإرشاد (إنجليزي)', en: 'Guidance text (English)' },
  'name.ar': { ar: 'الاسم', en: 'Name' }, 'name.en': { ar: 'الاسم (إنجليزي)', en: 'Name (English)' }, icon: { ar: 'الأيقونة', en: 'Icon' }, tone: { ar: 'اللون', en: 'Colour' }, 'erp.subtype': { ar: 'نوع الغياب في النظام المرجعي (الرمز)', en: 'Absence type in the system of record (code)' }, 'erp.grouping': { ar: 'نوع الغياب في النظام المرجعي (التجميع)', en: 'Absence type in the system of record (grouping)' }, id: { ar: 'الرمز', en: 'Code' },
  slaHours: { ar: 'المهلة (ساعات)', en: 'SLA (hours)' }, notifyOnly: { ar: 'إشعار فقط', en: 'Notify only' }, minDays: { ar: 'الحد الأدنى للأيام', en: 'Minimum days' }, perYear: { ar: 'مرات في السنة', en: 'Times per year' },
  tierPct: { ar: 'عتبة الإنذار (%)', en: 'Warning threshold (%)' }, tierDays: { ar: 'عتبة الإنذار (أيام)', en: 'Warning threshold (days)' }, date: { ar: 'تاريخ العطلة', en: 'Holiday date' },
  'agent.kind': { ar: 'من يعتمد', en: 'Approver' }, 'agent.level': { ar: 'المستوى', en: 'Level' }, 'agent.upTo': { ar: 'حتى مستوى', en: 'Up to level' }, 'agent.quorum': { ar: 'النصاب', en: 'Quorum' }, 'agent.unitId': { ar: 'فريق العمل', en: 'Work pool' }, 'agent.positionIds': { ar: 'المناصب', en: 'Positions' }, mode: { ar: 'نوع القرار', en: 'Decision type' }, 'title.ar': { ar: 'عنوان الخطوة', en: 'Step title' }, 'title.en': { ar: 'عنوان الخطوة (إنجليزي)', en: 'Step title (English)' },
  'when.field': { ar: 'شرط التطبيق: الحقل', en: 'Condition: field' }, 'when.op': { ar: 'شرط التطبيق: المقارنة', en: 'Condition: operator' }, 'when.value': { ar: 'شرط التطبيق: القيمة', en: 'Condition: value' }, 'escalation.after': { ar: 'بعد انقضاء المهلة', en: 'After the SLA' }, 'escalation.remindAtPct': { ar: 'تذكير عند (%)', en: 'Remind at (%)' }, 'escalation.moveToPositionId': { ar: 'النقل إلى منصب', en: 'Move to position' },
  'scope.groups': { ar: 'نطاق التطبيق: المجموعات', en: 'Scope: groups' }, 'scope.subgroups': { ar: 'نطاق التطبيق: المجموعات الفرعية', en: 'Scope: subgroups' }, 'scope.locations': { ar: 'نطاق التطبيق: المقار', en: 'Scope: locations' },
  'cancel.allowed': { ar: 'إلغاء الإجازة المعتمدة: حتى متى', en: 'Cancelling an approved leave: until when' }, 'cancel.route': { ar: 'إلغاء الإجازة المعتمدة: من يعتمد', en: 'Cancelling an approved leave: approver' },
  'onCancel.approval': { ar: 'عند الإلغاء بعد التنفيذ: موافقة الجهة المنفذة', en: 'On cancellation after fulfilment: executing office approval' }, 'onCancel.reversal': { ar: 'عند الإلغاء بعد التنفيذ: الاسترداد', en: 'On cancellation after fulfilment: reversal' }, 'onCancel.slaHours': { ar: 'مهلة الاسترداد (ساعات)', en: 'Reversal SLA (hours)' },
  seasonal: { ar: 'موسم يشغّله مدير النظام', en: 'Season operated by the administrator' }, 'dateWindow.label.ar': { ar: 'اسم الموسم أو النافذة', en: 'Season or window name' }, 'dateWindow.label.en': { ar: 'اسم الموسم أو النافذة (إنجليزي)', en: 'Season or window name (English)' }, 'dateWindow.from': { ar: 'النافذة الثابتة: من', en: 'Fixed window: from' }, 'dateWindow.to': { ar: 'النافذة الثابتة: إلى', en: 'Fixed window: to' },
  'hijriWindow.month': { ar: 'النافذة الهجرية: الشهر', en: 'Hijri window: month' }, 'hijriWindow.fromDay': { ar: 'النافذة الهجرية: من يوم', en: 'Hijri window: from day' }, 'hijriWindow.toDay': { ar: 'النافذة الهجرية: إلى يوم', en: 'Hijri window: to day' },
  kind: { ar: 'النوع', en: 'Kind' }, entityId: { ar: 'الجهة الفنية', en: 'Technical entity' }, storeId: { ar: 'المستودع', en: 'Store' }, custody: { ar: 'يصير عهدة', en: 'Becomes custody' }, endedAt: { ar: 'أُلغي اعتباراً من', en: 'Ended as of' }, storeIds: { ar: 'مستودعات المقر', en: 'Site stores' }, 'receiverAgent.kind': { ar: 'مسؤول الاستلام والتسليم', en: 'Receipt & handover officer' }, 'receiverAgent.positionIds': { ar: 'مسؤول الاستلام والتسليم: المنصب', en: 'Receipt & handover officer: position' },
  openerMinLevel: { ar: 'المستوى الإداري الأدنى الذي يفتح الاحتياج', en: 'Minimum management level that opens a need' }, chainUpTo: { ar: 'السلسلة الإدارية حتى مستوى', en: 'Management chain up to level' }, coordinatorStep: { ar: 'خطوة منسّق القطاع', en: 'Sector coordinator step' }, tenderThreshold: { ar: 'عتبة إجراء المناقصات (ريال)', en: 'Tender threshold (SAR)' }, urgentEnabled: { ar: 'الحاجة العاجلة', en: 'Urgent needs' }, splitAlertDays: { ar: 'تنبيه التجزئة (أيام)', en: 'Split alert (days)' }, 'sla.coordinator': { ar: 'مهلة المنسّق (ساعات)', en: 'Coordinator SLA (hours)' }, 'sla.manager': { ar: 'مهلة المدير (ساعات)', en: 'Manager SLA (hours)' }, 'sla.entity': { ar: 'مهلة الجهة الفنية (ساعات)', en: 'Technical entity SLA (hours)' }, 'sla.store': { ar: 'مهلة المستودع (ساعات)', en: 'Store SLA (hours)' }, 'sla.procurement': { ar: 'مهلة المشتريات (ساعات)', en: 'Procurement SLA (hours)' }, 'sla.evaluator': { ar: 'مهلة المقيّم (ساعات)', en: 'Evaluator SLA (hours)' }, 'sla.budget': { ar: 'مهلة الموازنة (ساعات)', en: 'Budget SLA (hours)' }, 'sla.receipt': { ar: 'مهلة الاستلام (ساعات)', en: 'Receipt SLA (hours)' }, 'sla.handover': { ar: 'مهلة التسليم (ساعات)', en: 'Handover SLA (hours)' }, 'sla.purchaseApproval': { ar: 'مهلة اعتماد الشراء (ساعات)', en: 'Purchase approval SLA (hours)' }, 'sla.quotes': { ar: 'مهلة العروض (ساعات)', en: 'Offers SLA (hours)' }, 'sla.awardApproval': { ar: 'مهلة اعتماد الترسية (ساعات)', en: 'Award approval SLA (hours)' }, minOffers: { ar: 'العدد الأدنى للعروض', en: 'Minimum number of offers' }, tolerancePct: { ar: 'نسبة التسامح بين المحجوز والترسية (%)', en: 'Tolerance between reservation and award (%)' }, categoryId: { ar: 'الفئة', en: 'Category' }, itemIds: { ar: 'أرقام الأصناف', en: 'Item numbers' }, price: { ar: 'السعر الاسترشادي (ريال)', en: 'Indicative price (SAR)' }, 'unit.ar': { ar: 'الوحدة', en: 'Unit' }, 'unit.en': { ar: 'الوحدة (إنجليزي)', en: 'Unit (English)' }, upTo: { ar: 'حتى قيمة (ريال)', en: 'Up to value (SAR)' }, offers: { ar: 'تحتاج عروضاً', en: 'Needs offers' }, minOffersOf: { ar: 'العدد الأدنى للعروض', en: 'Minimum offers' }, higherBand: { ar: 'تحتاج اعتماد الشريحة الأعلى', en: 'Needs the higher band' }, tender: { ar: 'مناقصة', en: 'Tender' }, contract: { ar: 'عقد إطاري', en: 'Framework contract' },
  /* v0.11 */ availability: { ar: 'مصدر التوفر', en: 'Availability source' }, poolId: { ar: 'رصيد الجهة', en: 'Entity pool' }, erpKind: { ar: 'قيده في النظام المرجعي', en: 'Recorded in the system of record as' }, itemId: { ar: 'رقم الصنف', en: 'Item number' }, contractId: { ar: 'العقد الإطاري', en: 'Framework contract' }, unitPrice: { ar: 'قيمة الوحدة (ريال)', en: 'Unit value (SAR)' }, awardApproval: { ar: 'اعتماد الترسية', en: 'Award approval' }, offerAttachmentRequired: { ar: 'المرفق إلزامي لكل عرض', en: 'Attachment required per offer' },
  /* v0.12 */ inspection: { ar: 'تتطلب فحصاً بلجنة', en: 'Requires committee inspection' }, inspectionThreshold: { ar: 'حد الفحص بلجنة (ريال)', en: 'Committee inspection threshold (SAR)' }, handoverMode: { ar: 'التسليم للمستفيد', en: 'Handover to the beneficiary' }, remedyDays: { ar: 'مهلة معالجة ما لم يُقبل (أيام)', en: 'Remedy period for what was not accepted (days)' }, leadDays: { ar: 'مهلة التوريد الافتراضية (أيام)', en: 'Default delivery lead time (days)' }, erpNumbers: { ar: 'أرقام النظام المرجعي', en: 'System-of-record numbers' },
  'fulfil.mode': { ar: 'طريقة التنفيذ', en: 'Fulfilment mode' }, 'fulfil.timing': { ar: 'توقيت التنفيذ', en: 'Fulfilment timing' }, 'fulfil.daysBefore': { ar: 'قبل البداية بأيام', en: 'Days before start' }, eligibility: { ar: 'الأهلية', en: 'Eligibility' }, years: { ar: 'سنوات الدورة', en: 'Cycle years' }, months: { ar: 'أشهر الشريحة', en: 'Tier months' },
  /* v0.13 — الأخبار والقصص */ unitId: { ar: 'الوحدة في الهيكل', en: 'Unit in the structure' }, publisherPositionIds: { ar: 'المناصب الناشرة', en: 'Publishing positions' }, 'short.ar': { ar: 'الاسم المختصر', en: 'Short name' }, 'short.en': { ar: 'الاسم المختصر (إنجليزي)', en: 'Short name (English)' }, 'ring.ar': { ar: 'اسم الحلقة', en: 'Ring label' }, 'ring.en': { ar: 'اسم الحلقة (إنجليزي)', en: 'Ring label (English)' }, 'initials.ar': { ar: 'الحرف', en: 'Initials' }, 'initials.en': { ar: 'الحرف (إنجليزي)', en: 'Initials (English)' }, hue: { ar: 'لون القطاع', en: 'Sector colour' },
  ackAllowed: { ar: 'يجوز طلب تأكيد الاطلاع', en: 'May ask for acknowledgement' }, mediaAllowed: { ar: 'يجوز أن يحمل صوراً وفيديو', en: 'May carry photos and video' }, postMaxMedia: { ar: 'العدد الأقصى لوسائط المنشور', en: 'Maximum media per post' }, postImageMaxMB: { ar: 'الحد الأقصى لحجم صورة المنشور (م.ب)', en: 'Maximum post photo size (MB)' }, postVideoMaxMB: { ar: 'الحد الأقصى لحجم فيديو المنشور (م.ب)', en: 'Maximum post video size (MB)' }, postVideoMaxSec: { ar: 'الحد الأقصى لمدة فيديو المنشور (ثانية)', en: 'Maximum post video length (seconds)' }, storyHours: { ar: 'مدة ظهور القصة (ساعات)', en: 'Story lifetime (hours)' }, storyVideoMaxSec: { ar: 'الحد الأقصى لمدة الفيديو (ثانية)', en: 'Maximum video length (seconds)' }, storyImageMaxMB: { ar: 'الحد الأقصى لحجم الصورة (م.ب)', en: 'Maximum photo size (MB)' }, storyVideoMaxMB: { ar: 'الحد الأقصى لحجم الفيديو (م.ب)', en: 'Maximum video size (MB)' }, ackReminderDays: { ar: 'التذكير بعد (أيام)', en: 'Reminder after (days)' }, notifyCircular: { ar: 'تنبيه التعميم الذي يطلب التأكيد', en: 'Notify on a circular asking for acknowledgement' }, notifyStory: { ar: 'تنبيه القصة الجديدة', en: 'Notify on a new story' },
};
/** عناوين قوائم سياسة الأخبار والقصص */
export const COMMS_LIST_TITLE: Record<'sectors' | 'kinds', T2> = { sectors: { ar: 'القطاعات الناشرة', en: 'Publishing sectors' }, kinds: { ar: 'أنواع المنشورات', en: 'Post kinds' } };
export const NEED_LIST_TITLE: Record<NeedList, T2> = { entities: { ar: 'الجهات الفنية', en: 'Technical entities' }, categories: { ar: 'فئات الاحتياج', en: 'Need categories' }, stores: { ar: 'المستودعات', en: 'Stores' }, sites: { ar: 'المقرات', en: 'Sites' }, catalog: { ar: 'كتالوج الاحتياجات', en: 'Needs catalogue' }, authority: { ar: 'جدول الصلاحيات', en: 'Delegation table' }, methods: { ar: 'طرق الشراء', en: 'Purchase methods' }, pools: { ar: 'رصيد الجهات', en: 'Entity pools' } };
/** أسماء مستويات الهيكل التنظيمي */
export const LEVEL_TITLE: Record<OrgLevel, T2> = { section: { ar: 'قسم', en: 'Section' }, department: { ar: 'إدارة', en: 'Department' }, ga: { ar: 'إدارة عامة', en: 'General administration' }, sector: { ar: 'قطاع', en: 'Sector' }, sg: { ar: 'الأمانة العامة', en: 'General Secretariat' } };
export const LEVEL_HEAD: Record<OrgLevel, T2> = { section: { ar: 'رئيس القسم', en: 'Section head' }, department: { ar: 'مدير الإدارة', en: 'Department director' }, ga: { ar: 'المدير العام', en: 'Director general' }, sector: { ar: 'الأمين العام المساعد', en: 'Assistant Secretary-General' }, sg: { ar: 'الأمين العام', en: 'Secretary-General' } };
export const AGENT_KIND_TITLE: Record<AgentKind, T2> = { lineManager: { ar: 'المدير المباشر', en: 'Line manager' }, orgHead: { ar: 'رئيس الوحدة بمستوى', en: 'Head of the unit at level' }, chain: { ar: 'السلسلة الإدارية حتى', en: 'Management chain up to' }, positions: { ar: 'منصب محدد', en: 'Specific position' }, pool: { ar: 'فريق عمل', en: 'Work pool' }, requester: { ar: 'الموظف', en: 'Employee' },
  field: { ar: 'من حقل في النموذج', en: 'From a form field' }, owner: { ar: 'مالك الخدمة', en: 'Service owner' }, band: { ar: 'بشريحة القيمة', en: 'By value band' } };
export function labelFor(path: string, content: PolicyContent): T2 {
  const parts = path.split('.'); const head = parts[0]; const id = parts[1]; const rest = parts.slice(2).join('.');
  const lookup = (k: string) => { const noIdx = k.replace(/\.\d+$/, ''); return FIELD_LABEL[k] || FIELD_LABEL[noIdx] || FIELD_LABEL[noIdx.split('.').slice(-2).join('.')] || FIELD_LABEL[noIdx.split('.').pop() || ''] || { ar: k, en: k }; };
  if (head === 'types') { const t = content.types.find((x) => x.id === id); const f = lookup(rest); return { ar: `${t ? t.name.ar : id} · ${f.ar}`, en: `${t ? t.name.en : id} · ${f.en}` }; }
  if (head === 'routes') { const r = content.routes.find((x) => x.id === id); const sub = rest.replace(/^steps\.\d+\.?/, ''); const f = sub ? lookup(sub) : { ar: 'الخطوة', en: 'step' }; const n = rest.match(/^steps\.(\d+)/)?.[1]; return { ar: `${r ? r.name.ar : id} · الخطوة ${n !== undefined ? Number(n) + 1 : ''} · ${f.ar}`, en: `${r ? r.name.en : id} · step ${n !== undefined ? Number(n) + 1 : ''} · ${f.en}` }; }
  if (head === 'entitlements') { const e = content.entitlements.find((x) => x.id === id); const f = lookup(rest); return { ar: `${e ? e.name.ar : id} · ${f.ar}`, en: `${e ? e.name.en : id} · ${f.en}` }; }
  if (head === 'calendar') { return { ar: `التقويم · ${lookup(rest || id).ar}`, en: `Calendar · ${lookup(rest || id).en}` }; }
  if (head === 'warnings') { return { ar: `الإنذار المبكر · ${lookup(id).ar}`, en: `Early warning · ${lookup(id).en}` }; }
  if (head === 'need' && content.need) {
    const sub = id; const oid = parts[2]; const field = parts.slice(3).join('.'); const listName = NEED_LIST_TITLE[sub as NeedList];
    if (sub === 'rules') { const f = lookup(parts.slice(2).join('.')); return { ar: `قواعد الاحتياج · ${f.ar}`, en: `Need rules · ${f.en}` }; }
    if (listName) { const obj = (content.need[sub as NeedList] as unknown as { id: string; name: T2 }[]).find((x) => x.id === oid); const f = lookup(field); return { ar: `${listName.ar} · ${obj ? obj.name.ar : oid} · ${f.ar}`, en: `${listName.en} · ${obj ? obj.name.en : oid} · ${f.en}` }; }
  }
  if (head === 'comms' && content.comms) {
    const sub = id; const oid = parts[2]; const field = parts.slice(3).join('.');
    if (sub === 'rules') { const f = lookup(parts.slice(2).join('.')); return { ar: `قواعد الأخبار والقصص · ${f.ar}`, en: `News & stories rules · ${f.en}` }; }
    if (sub === 'sectors' || sub === 'kinds') { const listName = COMMS_LIST_TITLE[sub]; const obj = (content.comms[sub] as { id: string; name: T2 }[]).find((x) => x.id === oid); const f = lookup(field); return { ar: `${listName.ar} · ${obj ? obj.name.ar : oid} · ${f.ar}`, en: `${listName.en} · ${obj ? obj.name.en : oid} · ${f.en}` }; }
  }
  if (head === 'designer' && content.designer && id === 'services') {
    /* v0.15: الخدمة · القسم · الحقل · الخاصية — حتى يقرأ المدير سجل التغيير بلغة النموذج لا بمسارات */
    const svc = content.designer.services.find((s) => s.id === parts[2]); const sname: T2 = svc ? svc.name : { ar: parts[2], en: parts[2] }; const rest = parts.slice(3);
    const DL = DESIGNER_LABEL; const dl = (k: string): T2 => DL[k] || lookup(k);
    if (rest[0] === 'sections') {
      const sec = svc?.sections.find((x) => x.id === rest[1]); const stitle: T2 = sec ? sec.title : { ar: rest[1], en: rest[1] };
      if (rest[2] === 'fields') {
        const f = sec?.fields.find((x) => x.id === rest[3]); const flabel: T2 = f ? f.label : { ar: rest[3], en: rest[3] }; const prop = rest.slice(4).join('.');
        if (rest[4] === 'options') { const o = f?.options?.find((x) => x.id === rest[5]); const p = dl(rest.slice(6).join('.')); return { ar: `${sname.ar} · ${flabel.ar} · الخيار «${o ? o.name.ar : rest[5]}» · ${p.ar}`, en: `${sname.en} · ${flabel.en} · option “${o ? o.name.en : rest[5]}” · ${p.en}` }; }
        const p = prop ? dl(prop === 'source' ? 'optionsSource' : prop) : { ar: 'الحقل', en: 'field' }; return { ar: `${sname.ar} · ${stitle.ar} · ${flabel.ar} · ${p.ar}`, en: `${sname.en} · ${stitle.en} · ${flabel.en} · ${p.en}` };
      }
      const p = rest[2] ? dl(`section.${rest.slice(2).join('.')}`) : { ar: 'القسم', en: 'section' }; return { ar: `${sname.ar} · القسم «${stitle.ar}» · ${p.ar}`, en: `${sname.en} · section “${stitle.en}” · ${p.en}` };
    }
    if (rest[0] === 'route') {
      /* v0.16: الخطوة بمعرّفها الثابت (أو برقمها في المسودات القديمة)؛ وما تحتها نموذج الخطوة (خيار، حقل، قائمة تحقق) */
      const idx = svc ? svc.route.findIndex((x) => x.id === rest[1]) : -1; const n = idx >= 0 ? idx : Number(rest[1]); const step = svc && idx >= 0 ? svc.route[idx] : undefined;
      const stepName: T2 = { ar: `الخطوة ${Number.isNaN(n) ? rest[1] : n + 1}${step?.title ? ` «${step.title.ar}»` : ''}`, en: `step ${Number.isNaN(n) ? rest[1] : n + 1}${step?.title ? ` “${step.title.en}”` : ''}` };
      const sub = rest.slice(2);
      if (sub[0] === 'form') {
        if (sub[1] === 'outcomes') { const o = step?.form?.outcomes?.find((x) => x.id === sub[2]); const p = dl(`outcome.${sub.slice(3).join('.')}`); return { ar: `${sname.ar} · ${stepName.ar} · خيار القرار «${o ? o.name.ar : sub[2]}» · ${p.ar}`, en: `${sname.en} · ${stepName.en} · decision option “${o ? o.name.en : sub[2]}” · ${p.en}` }; }
        if (sub[1] === 'fields') { const f = step?.form?.fields?.find((x) => x.id === sub[2]); const p = sub.length > 3 ? dl(sub.slice(3).join('.')) : { ar: 'الحقل', en: 'field' }; return { ar: `${sname.ar} · ${stepName.ar} · حقل الخطوة «${f ? f.label.ar : sub[2]}» · ${p.ar}`, en: `${sname.en} · ${stepName.en} · step field “${f ? f.label.en : sub[2]}” · ${p.en}` }; }
        if (sub[1] === 'checks') { const p = dl(`check.${sub.slice(3).join('.')}`); return { ar: `${sname.ar} · ${stepName.ar} · قائمة التحقق · ${p.ar}`, en: `${sname.en} · ${stepName.en} · checklist · ${p.en}` }; }
        const p = dl(`form.${sub.slice(1).join('.')}`); return { ar: `${sname.ar} · ${stepName.ar} · نموذج الخطوة · ${p.ar}`, en: `${sname.en} · ${stepName.en} · step form · ${p.en}` };
      }
      const p = sub.length ? dl(`step.${sub.join('.')}`) : { ar: 'الخطوة', en: 'step' }; return { ar: `${sname.ar} · المسار · ${stepName.ar} · ${p.ar}`, en: `${sname.en} · route · ${stepName.en} · ${p.en}` };
    }
    if (rest[0] === 'outputs') { const o = svc?.outputs?.find((x) => x.id === rest[1]); const kind = o ? (DL[`output.kind.${o.kind}`] || { ar: o.kind, en: o.kind }) : { ar: 'المخرج', en: 'output' }; const sub = rest.slice(2).join('.'); const p = sub ? dl(`output.${sub}`) : { ar: 'المخرج', en: 'output' }; return { ar: `${sname.ar} · ${kind.ar}${o?.title ? ` «${o.title.ar}»` : ''} · ${p.ar}`, en: `${sname.en} · ${kind.en}${o?.title ? ` “${o.title.en}”` : ''} · ${p.en}` }; }
    if (rest[0] === 'notifications') { const sub = rest.slice(2).join('.'); const p = sub ? dl(`notify.${sub}`) : { ar: 'إشعار', en: 'notification' }; return { ar: `${sname.ar} · إشعار مهيّأ · ${p.ar}`, en: `${sname.en} · configured notification · ${p.en}` }; }
    if (rest[0] === 'reminders') { const sub = rest.slice(2).join('.'); const p = sub ? dl(`reminder.${sub}`) : { ar: 'تذكير', en: 'reminder' }; return { ar: `${sname.ar} · تذكير · ${p.ar}`, en: `${sname.en} · reminder · ${p.en}` }; }
    if (rest[0] === 'beforeYouStart') return { ar: `${sname.ar} · «قبل أن تبدأ» · البند ${Number(rest[1]) + 1}`, en: `${sname.en} · “Before you start” · item ${Number(rest[1]) + 1}` };
    const p = rest.length ? dl(rest.join('.')) : { ar: 'الخدمة', en: 'service' }; return { ar: `${sname.ar} · ${p.ar}`, en: `${sname.en} · ${p.en}` };
  }
  return { ar: path, en: path };
}
/** تسميات خصائص الخدمة المهيّأة في سجل التغيير (v0.15) */
const DESIGNER_LABEL: Record<string, T2> = {
  'name.ar': { ar: 'الاسم', en: 'Name' }, 'name.en': { ar: 'الاسم (إنجليزي)', en: 'Name (English)' }, 'description.ar': { ar: 'الوصف', en: 'Description' }, 'description.en': { ar: 'الوصف (إنجليزي)', en: 'Description (English)' }, domain: { ar: 'المجال', en: 'Domain' }, icon: { ar: 'الأيقونة', en: 'Icon' }, tone: { ar: 'اللون', en: 'Colour' }, tenant: { ar: 'المستأجر', en: 'Tenant' }, kind: { ar: 'نوع الخدمة', en: 'Service kind' }, onBehalf: { ar: 'الطلب باسم غيره', en: 'Requesting on behalf' }, confidential: { ar: 'خدمة سرية', en: 'Confidential service' }, hideRequester: { ar: 'إخفاء هوية الطالب', en: 'Hide the requester' }, endedAt: { ar: 'أُلغيت اعتباراً من', en: 'Ended as of' }, source: { ar: 'المصدر', en: 'Source' }, createdAt: { ar: 'أُنشئت', en: 'Created' },
  'scope.groups': { ar: 'من يطلبها: المجموعات', en: 'Who requests: groups' }, 'scope.subgroups': { ar: 'من يطلبها: المجموعات الفرعية', en: 'Who requests: subgroups' }, 'scope.locations': { ar: 'من يطلبها: المقار', en: 'Who requests: locations' },
  'output.kind': { ar: 'المخرج', en: 'Output' }, 'output.title.ar': { ar: 'عنوان المستند', en: 'Document title' }, 'output.title.en': { ar: 'عنوان المستند (إنجليزي)', en: 'Document title (English)' }, 'output.prefix': { ar: 'بادئة الترقيم', en: 'Numbering prefix' }, 'output.expiryField': { ar: 'حقل تاريخ الانتهاء', en: 'Expiry date field' }, 'output.remindDays': { ar: 'التنبيه قبل الانتهاء (أيام)', en: 'Reminder before expiry (days)' },
  'section.title.ar': { ar: 'العنوان', en: 'Title' }, 'section.title.en': { ar: 'العنوان (إنجليزي)', en: 'Title (English)' }, 'section.hint.ar': { ar: 'الشرح', en: 'Hint' }, 'section.hint.en': { ar: 'الشرح (إنجليزي)', en: 'Hint (English)' }, 'section.endedAt': { ar: 'أُلغي القسم اعتباراً من', en: 'Section ended as of' },
  'label.ar': { ar: 'التسمية', en: 'Label' }, 'label.en': { ar: 'التسمية (إنجليزي)', en: 'Label (English)' }, 'hint.ar': { ar: 'نص المساعدة', en: 'Help text' }, 'hint.en': { ar: 'نص المساعدة (إنجليزي)', en: 'Help text (English)' }, 'placeholder.ar': { ar: 'المثال', en: 'Placeholder' }, 'placeholder.en': { ar: 'المثال (إنجليزي)', en: 'Placeholder (English)' },
  optionsSource: { ar: 'مصدر الخيارات', en: 'Options source' }, erpList: { ar: 'قائمة النظام المرجعي', en: 'System-of-record list' }, orgFilter: { ar: 'نطاق الاختيار من الهيكل', en: 'Org picker scope' }, bilingual: { ar: 'بلغتين', en: 'Bilingual' }, currency: { ar: 'العملة', en: 'Currency' }, decimals: { ar: 'المنازل العشرية', en: 'Decimals' }, workingDays: { ar: 'بأيام العمل', en: 'In working days' }, inDoc: { ar: 'يظهر في المستند', en: 'Shown in the document' },
  'rules.required': { ar: 'إلزامي', en: 'Required' }, 'rules.min': { ar: 'الحد الأدنى', en: 'Minimum' }, 'rules.max': { ar: 'الحد الأقصى', en: 'Maximum' }, 'rules.minLen': { ar: 'أقل طول', en: 'Minimum length' }, 'rules.maxLen': { ar: 'أقصى طول', en: 'Maximum length' }, 'rules.pattern': { ar: 'النمط', en: 'Pattern' }, 'rules.dateRel': { ar: 'التاريخ بالنسبة إلى اليوم', en: 'Date relative to today' }, 'rules.maxDays': { ar: 'أقصى مدة (أيام)', en: 'Maximum span (days)' }, 'rules.maxFiles': { ar: 'أقصى عدد للملفات', en: 'Maximum files' }, 'rules.fileKinds': { ar: 'أنواع الملفات', en: 'File kinds' }, 'rules.maxMB': { ar: 'أقصى حجم (م.ب)', en: 'Maximum size (MB)' },
  'rules.showIf.field': { ar: 'يظهر إذا: الحقل', en: 'Shown if: field' }, 'rules.showIf.op': { ar: 'يظهر إذا: المقارنة', en: 'Shown if: operator' }, 'rules.showIf.value': { ar: 'يظهر إذا: القيمة', en: 'Shown if: value' }, 'rules.requiredIf.field': { ar: 'يلزم إذا: الحقل', en: 'Required if: field' }, 'rules.requiredIf.op': { ar: 'يلزم إذا: المقارنة', en: 'Required if: operator' }, 'rules.requiredIf.value': { ar: 'يلزم إذا: القيمة', en: 'Required if: value' },
  /* v0.16 */
  'rules.readOnlyIf.field': { ar: 'للقراءة إذا: الحقل', en: 'Read-only if: field' }, 'rules.readOnlyIf.op': { ar: 'للقراءة إذا: المقارنة', en: 'Read-only if: operator' }, 'rules.readOnlyIf.value': { ar: 'للقراءة إذا: القيمة', en: 'Read-only if: value' }, 'rules.afterField': { ar: 'بعد تاريخ الحقل', en: 'After the date field' }, 'rules.lteField': { ar: 'لا يتجاوز الحقل', en: 'Not above the field' }, 'rules.unique': { ar: 'فريد بين الطلبات الجارية', en: 'Unique among open requests' },
  profileKey: { ar: 'من ملف الموظف', en: 'From the employee record' }, 'formula.op': { ar: 'المعادلة', en: 'Formula' }, 'formula.fields': { ar: 'حقول المعادلة', en: 'Formula fields' }, 'formula.percent': { ar: 'النسبة', en: 'Percent' }, maxRows: { ar: 'أقصى عدد للصفوف', en: 'Maximum rows' }, minRows: { ar: 'أقل عدد للصفوف', en: 'Minimum rows' }, scaleMax: { ar: 'أعلى درجة', en: 'Top of scale' }, 'scaleLabels.low.ar': { ar: 'وصف الأدنى', en: 'Low label' }, 'scaleLabels.low.en': { ar: 'وصف الأدنى (إنجليزي)', en: 'Low label (English)' }, 'scaleLabels.high.ar': { ar: 'وصف الأعلى', en: 'High label' }, 'scaleLabels.high.en': { ar: 'وصف الأعلى (إنجليزي)', en: 'High label (English)' },
  'default.kind': { ar: 'القيمة الافتراضية: من', en: 'Default: from' }, 'default.value': { ar: 'القيمة الافتراضية', en: 'Default value' }, 'default.profileKey': { ar: 'القيمة الافتراضية من ملف الموظف', en: 'Default from the employee record' }, 'default.field': { ar: 'القيمة الافتراضية من الحقل', en: 'Default from the field' },
  eligibility: { ar: 'الأهلية بالصفات', en: 'Eligibility by attributes' }, 'window.from': { ar: 'نافذة التقديم: من', en: 'Submission window: from' }, 'window.to': { ar: 'نافذة التقديم: إلى', en: 'Submission window: to' }, 'limit.count': { ar: 'الحصة: العدد', en: 'Quota: count' }, 'limit.per': { ar: 'الحصة: لكل', en: 'Quota: per' }, 'prereq.minServiceMonths': { ar: 'الحد الأدنى للخدمة (أشهر)', en: 'Minimum service (months)' }, 'prereq.requiresService': { ar: 'يشترط اكتمال الخدمة', en: 'Requires the completed service' }, 'prereq.requiresRecord': { ar: 'يشترط سجلاً سارياً', en: 'Requires a live record' }, visibility: { ar: 'الظهور', en: 'Visibility' }, 'pilot.unitIds': { ar: 'الجمهور التجريبي: الوحدات', en: 'Pilot audience: units' }, 'pilot.personIds': { ar: 'الجمهور التجريبي: الأشخاص', en: 'Pilot audience: people' }, 'owner.positionId': { ar: 'مالك الخدمة (منصب)', en: 'Service owner (position)' }, paged: { ar: 'النموذج على صفحات', en: 'Paged form' }, 'declaration.ar': { ar: 'الإقرار النهائي', en: 'Final declaration' }, 'declaration.en': { ar: 'الإقرار النهائي (إنجليزي)', en: 'Final declaration (English)' },
  'step.mode': { ar: 'نوع الخطوة', en: 'Step kind' }, 'step.slaHours': { ar: 'المهلة (ساعات)', en: 'SLA (hours)' }, 'step.title.ar': { ar: 'عنوان الخطوة', en: 'Step title' }, 'step.title.en': { ar: 'عنوان الخطوة (إنجليزي)', en: 'Step title (English)' }, 'step.agent.kind': { ar: 'المعتمد', en: 'Approver' }, 'step.agent.level': { ar: 'المستوى', en: 'Level' }, 'step.agent.upTo': { ar: 'حتى مستوى', en: 'Up to level' }, 'step.agent.unitId': { ar: 'فريق العمل', en: 'Work pool' }, 'step.agent.positionIds': { ar: 'المناصب', en: 'Positions' }, 'step.agent.quorum': { ar: 'النصاب', en: 'Quorum' }, 'step.agent.fieldId': { ar: 'من الحقل', en: 'From the field' }, 'step.agent.amountField': { ar: 'حقل المبلغ', en: 'Amount field' }, 'step.group': { ar: 'المجموعة المتوازية', en: 'Parallel group' }, 'step.contractId': { ar: 'العقد', en: 'Contract' }, 'step.wait.field': { ar: 'الانتظار حتى حقل', en: 'Wait until the field' }, 'step.wait.days': { ar: 'الانتظار (أيام)', en: 'Wait (days)' }, 'step.escalation.remindAtPct': { ar: 'التذكير عند نسبة', en: 'Remind at percent' }, 'step.escalation.after': { ar: 'بعد انقضاء المهلة', en: 'After the SLA' },
  'outcome.name.ar': { ar: 'الاسم', en: 'Name' }, 'outcome.name.en': { ar: 'الاسم (إنجليزي)', en: 'Name (English)' }, 'outcome.effect': { ar: 'الأثر', en: 'Effect' }, 'outcome.tone': { ar: 'اللون', en: 'Colour' }, 'outcome.endedAt': { ar: 'أُلغي اعتباراً من', en: 'Ended as of' },
  'check.text.ar': { ar: 'البند', en: 'Item' }, 'check.text.en': { ar: 'البند (إنجليزي)', en: 'Item (English)' }, 'form.editable': { ar: 'حقول يجوز تعديلها', en: 'Editable fields' }, 'form.hidden': { ar: 'حقول تُخفى', en: 'Hidden fields' }, 'form.guidance.ar': { ar: 'تعليمات لصاحب الخطوة', en: 'Guidance for the step owner' }, 'form.guidance.en': { ar: 'التعليمات (إنجليزي)', en: 'Guidance (English)' }, 'form.noteRequired': { ar: 'الملاحظة إلزامية', en: 'Note required' }, 'form.allowed': { ar: 'القرارات المسموحة', en: 'Allowed decisions' },
  'output.kind.document': { ar: 'مستند', en: 'Document' }, 'output.kind.register': { ar: 'سجل', en: 'Register' }, 'output.kind.contract': { ar: 'عقد', en: 'Contract' }, 'output.kind.followUp': { ar: 'خدمة تالية', en: 'Follow-up service' }, 'output.kind.calendar': { ar: 'حدث في التقويم', en: 'Calendar event' },
  'output.issueAt': { ar: 'يصدر عند', en: 'Issued at' }, 'output.template.docKind': { ar: 'نوع المستند', en: 'Document kind' }, 'output.template.signatory.kind': { ar: 'الموقّع', en: 'Signatory' }, 'output.template.signatory.positionId': { ar: 'منصب الموقّع', en: 'Signatory position' }, 'output.template.validity.field': { ar: 'الصلاحية من حقل', en: 'Validity from field' }, 'output.template.validity.days': { ar: 'الصلاحية (أيام)', en: 'Validity (days)' }, 'output.registerId': { ar: 'السجل', en: 'Register' }, 'output.columns': { ar: 'أعمدة السجل', en: 'Register columns' }, 'output.renewService': { ar: 'خدمة التجديد', en: 'Renewal service' }, 'output.contractId': { ar: 'العقد', en: 'Contract' }, 'output.serviceId': { ar: 'الخدمة التالية', en: 'Follow-up service' }, 'output.mode': { ar: 'طريقة الفتح', en: 'Opening mode' }, 'output.dateField': { ar: 'حقل التاريخ', en: 'Date field' }, 'output.endedAt': { ar: 'أُلغي اعتباراً من', en: 'Ended as of' },
  'notify.when': { ar: 'عند', en: 'When' }, 'notify.to': { ar: 'إلى', en: 'To' }, 'notify.title.ar': { ar: 'العنوان', en: 'Title' }, 'notify.title.en': { ar: 'العنوان (إنجليزي)', en: 'Title (English)' }, 'notify.body.ar': { ar: 'النص', en: 'Body' }, 'notify.body.en': { ar: 'النص (إنجليزي)', en: 'Body (English)' }, 'notify.endedAt': { ar: 'أُلغي اعتباراً من', en: 'Ended as of' },
  'reminder.field': { ar: 'قبل تاريخ الحقل', en: 'Before the date field' }, 'reminder.daysBefore': { ar: 'قبل بأيام', en: 'Days before' }, 'reminder.to': { ar: 'إلى', en: 'To' }, 'reminder.text.ar': { ar: 'النص', en: 'Text' }, 'reminder.text.en': { ar: 'النص (إنجليزي)', en: 'Text (English)' },
};
export function diffContent(a: PolicyContent, b: PolicyContent): { path: string; before: string; after: string }[] {
  const fa = flatten(a), fb = flatten(b); const keys = new Set([...Object.keys(fa), ...Object.keys(fb)]); const out: { path: string; before: string; after: string }[] = [];
  for (const k of keys) if ((fa[k] ?? '') !== (fb[k] ?? '')) out.push({ path: k, before: fa[k] ?? '', after: fb[k] ?? '' });
  return out.sort((x, y) => (x.path < y.path ? -1 : 1));
}

/* ——— عمليات الإدارة ——— */
export function newDraft(policy: PolicyState, by: string, at = Date.now(), correctsId?: string, scope?: VersionScope): PolicyState {
  const corrected = correctsId ? policy.versions.find((v) => v.id === correctsId) : undefined;
  /* v0.8: المسودة تُبنى على طرف السلسلة (أحدث نافذ ولو كان مجدولاً) لا على الساري وحده، فلا يضيع تغيير مجدول عند سريان الذي بعده */
  const tip = tipVersion(policy); const base = corrected || tip; const n = policy.versions.length + 1;
  const year = new Date(at).getFullYear(); const seqInYear = policy.versions.filter((v) => v.number.startsWith(String(year))).length + 1;
  const proposed = toISO(at + 14 * DAY); const fromDefault = tip.from >= proposed ? addDays(tip.from, 1) : proposed;
  /* الإصدار التصحيحي: نسخة من الإصدار الخاطئ نفسه (فيُصلَح فيه الخطأ وحده)، وتاريخه المقترح تاريخ ذلك الإصدار، وسببه مهيّأ */
  const v: PolicyVersion = { id: `V-${n}`, number: `${year}.${seqInYear}`, from: corrected ? (corrected.from > toISO(at) ? corrected.from : toISO(at)) : fromDefault, scheduled: false, createdBy: by, createdAt: at, reason: corrected ? `تصحيح الإصدار ${corrected.number}: ` : '', reference: corrected ? corrected.reference : '', content: JSON.parse(JSON.stringify(base.content)), changes: [], baseId: base.id, correctsId, scope: corrected ? { kind: 'all' } : scope || { kind: 'all' } };
  return { ...policy, versions: [...policy.versions, v] };
}
/** توسيع نطاق المسودة (إلى السياسة كلها) أو تغييره؛ لا يمسّ المحتوى */
export function setScope(policy: PolicyState, id: string, scope: VersionScope): PolicyState { return { ...policy, versions: policy.versions.map((v) => (v.id === id ? { ...v, scope } : v)) }; }
/** التراجع عن إصدار سرى: يُلغى ويعود الإصدار الذي قبله سارياً؛ يجوز فقط ما لم يُقيَّم به طلب (يتحقق منه المحرك)؛ يُسجَّل في سجل التشغيل بسبب */
export function revertVersion(policy: PolicyState, id: string, by: string, reason: string, at = Date.now()): PolicyState {
  const v = policy.versions.find((x) => x.id === id); if (!v) return policy;
  return { ...policy, versions: policy.versions.map((x) => (x.id === id ? { ...x, cancelled: true, revoked: { by, at, reason } } : x)), opsLog: [{ at, by, what: { ar: `تراجع عن الإصدار ${v.number}`, en: `Version ${v.number} reverted` }, detail: reason }, ...policy.opsLog] };
}
/** إقفال الفترة أو فتحها (التشغيل): يسري فوراً ويُسجَّل */
export function setPeriodClose(policy: PolicyState, close: { until: string; reason: string; reference: string } | null, by: string, at = Date.now()): PolicyState {
  const pc: PeriodClose | null = close ? { ...close, by, at } : null;
  const what: T2 = pc ? { ar: `إقفال الفترة حتى ${pc.until}`, en: `Period closed up to ${pc.until}` } : { ar: `فتح الفترة${policy.periodClose ? ` (كانت مقفلة حتى ${policy.periodClose.until})` : ''}`, en: `Period reopened${policy.periodClose ? ` (was closed up to ${policy.periodClose.until})` : ''}` };
  return { ...policy, periodClose: pc, opsLog: [{ at, by, what, detail: pc ? `${pc.reason}${pc.reference ? ` · ${pc.reference}` : ''}` : '' }, ...policy.opsLog] };
}
export function updateDraft(policy: PolicyState, id: string, content: PolicyContent, by: string, why: string, at = Date.now()): PolicyState {
  return { ...policy, versions: policy.versions.map((v) => {
    if (v.id !== id) return v;
    const base = policy.versions.find((x) => x.id === v.baseId)?.content || v.content;
    const diffs = diffContent(base, content);
    const changes: PolicyChange[] = diffs.map((d) => ({ at, by, path: d.path, label: labelFor(d.path, content), before: d.before, after: d.after, why }));
    return { ...v, content, changes };
  }) };
}
export function scheduleVersion(policy: PolicyState, id: string, from: string, reason: string, reference: string, at = Date.now()): PolicyState {
  /* v0.8.1: مسودة قديمة الأساس تُطبَّق أولاً فوق طرف السلسلة (لا يصل هنا تعارض؛ الشاشة ترفضه قبل الجدولة) */
  const p = rebaseDraft(policy, id, at);
  const approval: VersionApproval | undefined = p.governance.secondApprover ? { positionId: p.governance.approverPositionId, status: 'pending', requestedAt: at } : undefined;
  return { ...p, versions: p.versions.map((v) => (v.id === id ? { ...v, scheduled: true, from, reason, reference, approval, notifiedScheduled: false, notifiedActive: false } : v)) };
}
export function cancelVersion(policy: PolicyState, id: string): PolicyState { return { ...policy, versions: policy.versions.map((v) => (v.id === id ? { ...v, cancelled: true } : v)) }; }
/** الموافقة الثانية: اعتماد الإصدار المجدول فيصبح نافذاً في تاريخه، أو إعادته إلى المسودة بملاحظة */
export function approveVersion(policy: PolicyState, id: string, by: string, note = '', at = Date.now()): PolicyState {
  return { ...policy, versions: policy.versions.map((v) => (v.id === id && v.approval ? { ...v, approval: { ...v.approval, status: 'approved', by, at, note } } : v)) };
}
export function returnVersion(policy: PolicyState, id: string, by: string, note: string, at = Date.now()): PolicyState {
  return { ...policy, versions: policy.versions.map((v) => (v.id === id && v.approval ? { ...v, scheduled: false, approval: { ...v.approval, status: 'returned', by, at, note } } : v)) };
}
export function setGovernance(policy: PolicyState, g: Governance, by: string, positionTitle = '', at = Date.now()): PolicyState {
  const changed = g.secondApprover !== policy.governance.secondApprover || g.approverPositionId !== policy.governance.approverPositionId;
  if (!changed) return policy;
  const what: T2 = g.secondApprover ? { ar: 'تفعيل الموافقة الثانية على الإصدارات', en: 'Second approval of versions enabled' } : { ar: 'إيقاف الموافقة الثانية على الإصدارات', en: 'Second approval of versions disabled' };
  return { ...policy, governance: g, opsLog: [{ at, by, what, detail: g.secondApprover ? positionTitle : '' }, ...policy.opsLog] };
}
/** حالة الدورة الحالية بلا طلب جديد: هل اقترب الموظف من نهاية الشريحة؟ (ق-06) */
export function cycleStatus(view: SickView, warnings: Warnings): { near: boolean; pct: number; used: number; total: number | null; curPay: number; nextPay: number | null } {
  // الشريحة التي يقع فيها آخر يوم مستخدم (وإلا الأولى): المستخدم منها، وطولها، وما بعدها
  const cur = view.tiers.find((t) => t.toDay === null || Math.max(1, view.usedDays) <= t.toDay) || view.tiers[view.tiers.length - 1];
  const next = view.tiers[view.tiers.indexOf(cur) + 1];
  const used = Math.max(0, view.usedDays - cur.fromDay + 1); const total = cur.toDay === null ? null : cur.toDay - cur.fromDay + 1;
  const pct = total ? Math.round((used / total) * 100) : 0;
  const near = !!next && total !== null && (pct >= warnings.tierPct || total - used <= warnings.tierDays);
  return { near, pct, used, total, curPay: cur.pay, nextPay: next ? next.pay : null };
}
export function setWindow(policy: PolicyState, typeId: string, w: SeasonalWindow, by: string, at = Date.now()): PolicyState {
  const typeName = policy.versions[policy.versions.length - 1]?.content.types.find((t) => t.id === typeId)?.name || { ar: typeId, en: typeId };
  const detail = w.open ? `${w.from || '…'} → ${w.to || '…'}` : '';
  return { ...policy, windows: { ...policy.windows, [typeId]: { ...w, changedBy: by, changedAt: at } }, opsLog: [{ at, by, what: { ar: `${w.open ? 'فتح' : 'إقفال'} نافذة ${typeName.ar}`, en: `${w.open ? 'Opened' : 'Closed'} the ${typeName.en} window` }, detail }, ...policy.opsLog] };
}
export function setGroup(policy: PolicyState, groupId: string, members: string[], by: string, at = Date.now()): PolicyState {
  const ent = policy.versions[policy.versions.length - 1]?.content.entitlements.find((e) => e.id === groupId)?.name || { ar: groupId, en: groupId };
  const before = policy.groups[groupId] || []; const added = members.filter((m) => !before.includes(m)); const removed = before.filter((m) => !members.includes(m));
  return { ...policy, groups: { ...policy.groups, [groupId]: members }, opsLog: [{ at, by, what: { ar: `تعديل استثناءات ${ent.ar}`, en: `Changed the ${ent.en} exceptions` }, detail: `+${added.length} −${removed.length} · ${members.length}` }, ...policy.opsLog] };
}

/* ——— المسار ——— */
/** سطر واحد يلخّص النوع في قوائم الاختيار: أبرز ثلاث خصائص فقط */
export function typeSummary(tp: LeaveType, content: PolicyContent, lang: 'ar' | 'en'): string {
  const ar = lang === 'ar'; const parts: string[] = [];
  const route = content.routes.find((r) => r.id === tp.route);
  if (tp.fixedDays) parts.push(ar ? `${tp.fixedDays} يوماً` : `${tp.fixedDays} days`);
  else if (tp.unit === 'halfday') parts.push(ar ? 'نصف يوم' : 'half day');
  if (tp.onceInCareer) parts.push(ar ? 'مرة واحدة في العمر الوظيفي' : 'once in career');
  if (tp.hijriWindow) parts.push(ar ? `${tp.hijriWindow.fromDay}–${tp.hijriWindow.toDay} ${hijriMonthName(tp.hijriWindow.month, 'ar')}` : `${tp.hijriWindow.fromDay}–${tp.hijriWindow.toDay} ${hijriMonthName(tp.hijriWindow.month, 'en')}`);
  if (tp.dateWindow) parts.push(ar ? tp.dateWindow.label.ar : tp.dateWindow.label.en);
  if (tp.eligibility?.includes('female')) parts.push(ar ? 'للموظفات' : 'female employees');
  if (tp.eligibility?.includes('parent')) parts.push(ar ? 'للآباء والأمهات' : 'parents');
  if (tp.cycle) parts.push(ar ? 'أجر متدرج' : 'tiered pay');
  if (tp.pay === 'unpaid') parts.push(ar ? 'بلا أجر' : 'unpaid');
  if (tp.maxMonthsPerYears) parts.push(ar ? `حتى ${tp.maxMonthsPerYears.months} شهراً كل ${tp.maxMonthsPerYears.years} سنوات` : `up to ${tp.maxMonthsPerYears.months} months per ${tp.maxMonthsPerYears.years} years`);
  if (parts.length < 3 && route) parts.push(ar ? route.name.ar : route.name.en);
  if (parts.length < 3 && tp.windowAfterEnd) parts.push(ar ? `حتى ${tp.windowAfterEnd} أيام عمل بعد الانتهاء` : `up to ${tp.windowAfterEnd} working days after`);
  return parts.slice(0, 3).join(' · ');
}

export const DESK_TITLE: Record<Desk, T2> = {
  requester: { ar: 'الموظف', en: 'Employee' }, manager: { ar: 'المدير المباشر', en: 'Line manager' }, deptManager: { ar: 'مدير الإدارة', en: 'Department manager' }, gm: { ar: 'المدير العام', en: 'General manager' },
  hrGm: { ar: 'المدير العام للموارد البشرية', en: 'HR general manager' }, hrDeptManager: { ar: 'مدير إدارة الموارد البشرية', en: 'HR department manager' }, hrSectionHead: { ar: 'رئيس قسم شؤون الموظفين', en: 'Head of personnel affairs' },
  hr: { ar: 'شؤون الموظفين', en: 'Personnel affairs' }, payrollManager: { ar: 'مدير الرواتب', en: 'Payroll manager' }, buyer: { ar: 'المشتريات والمستودعات', en: 'Procurement & stores' }, finance: { ar: 'الانتدابات والاستحقاقات', en: 'Assignments & entitlements' }, payroll: { ar: 'الرواتب', en: 'Payroll' }, system: { ar: 'النظام المرجعي', en: 'System of record' },
};
/** اسم قاعدة الاستخراج كما تُقرأ في الشاشات (بلا هيكل): «المدير المباشر»، «مدير الإدارة»، «السلسلة حتى المدير العام»، «منصب كذا»، «فريق كذا» */
export function agentTitle(a: AgentRule, names?: { position?: (id: string) => T2 | undefined; unit?: (id: string) => T2 | undefined }): T2 {
  if (a.kind === 'lineManager') return AGENT_KIND_TITLE.lineManager;
  if (a.kind === 'orgHead') return LEVEL_HEAD[a.level || 'department'];
  if (a.kind === 'chain') { const h = LEVEL_HEAD[a.upTo || 'ga']; return { ar: `السلسلة الإدارية حتى ${h.ar}`, en: `Management chain up to the ${h.en.toLowerCase()}` }; }
  if (a.kind === 'positions') { const ts = (a.positionIds || []).map((id) => names?.position?.(id) || { ar: id, en: id }); if (ts.length <= 1) return ts[0] || AGENT_KIND_TITLE.positions; const j = (l: 'ar' | 'en') => ts.map((t) => t[l]).join(l === 'ar' ? (a.quorum === 'all' ? ' و' : ' أو ') : a.quorum === 'all' ? ' and ' : ' or '); return { ar: j('ar'), en: j('en') }; }
  if (a.kind === 'pool') { const u = a.unitId ? names?.unit?.(a.unitId) : undefined; return u ? { ar: `فريق ${u.ar}`, en: `${u.en} team` } : AGENT_KIND_TITLE.pool; }
  if (a.kind === 'field' || a.kind === 'owner' || a.kind === 'band') return AGENT_KIND_TITLE[a.kind];
  return AGENT_KIND_TITLE.requester;
}
/** عنوان الخطوة من قاعدتها ونوع قرارها */
export function stepTitle(rs: RouteStep, names?: Parameters<typeof agentTitle>[1]): T2 {
  if (rs.mode === 'wait') return { ar: 'انتظار حتى الموعد', en: 'Waiting until the date' };
  if (rs.mode === 'system') return { ar: 'تنفيذ في النظام المرجعي عبر العقد', en: 'Executed in the system of record via the contract' };
  if (rs.mode === 'input') return { ar: 'استكمال من الموظف', en: 'Completion by the employee' };
  const a = agentTitle(rs.agent, names);
  if (rs.mode === 'notify') return { ar: `إشعار ${a.ar}`, en: `${a.en} notified` };
  if (rs.mode === 'fulfil') return { ar: `تنفيذ ${a.ar}`, en: `Executed by ${a.en}` };
  if (rs.mode === 'review') return { ar: `توصية ${a.ar}`, en: `${a.en} recommendation` };
  return { ar: `اعتماد ${a.ar}`, en: `${a.en} approval` };
}
/** مكتب تقريبي للتوافق مع الشاشات القديمة */
export function deskForAgent(a: AgentRule): Desk {
  if (a.kind === 'lineManager') return 'manager'; if (a.kind === 'orgHead') return a.level === 'ga' ? 'gm' : 'deptManager'; if (a.kind === 'requester') return 'requester'; return 'hr';
}
/** خطوات غير مستخرجة (للعرض بلا هيكل تنظيمي): تُستبدل بـ buildSteps في المحرك عند التقديم */
export function stepsForType(type: LeaveType, content: PolicyContent): Step[] {
  const route = content.routes.find((r) => r.id === type.route) || content.routes[0];
  const steps: Step[] = route.steps.map((s, i) => ({ key: `s${i + 1}`, desk: deskForAgent(s.agent), title: stepTitle(s), status: 'pending' as const, notifyOnly: s.mode === 'notify', slaHours: s.slaHours, mode: s.mode, agent: s.agent, quorum: s.agent.quorum }));
  steps.push({ key: 'sys', desk: 'system', title: { ar: 'تسجيل الإجازة في النظام المرجعي وإصدار القرار', en: 'Leave posted and decision issued' }, status: 'pending', slaHours: 0, mode: 'system' });
  return steps;
}
/** هل يتحقق شرط الخطوة على هذا الطلب وهذا الطالب؟ */
export function conditionHolds(c: StepCondition | undefined, ctx: { days: number; workingDays: number }, p: Person): boolean {
  if (!c) return true;
  const v = c.field === 'days' ? ctx.days : c.field === 'workingDays' ? ctx.workingDays : c.field === 'group' ? p.group || '' : c.field === 'subgroup' ? p.subgroup || '' : p.location || 'riyadh';
  const val = c.value;
  switch (c.op) {
    case 'gt': return Number(v) > Number(val); case 'gte': return Number(v) >= Number(val); case 'lt': return Number(v) < Number(val); case 'lte': return Number(v) <= Number(val);
    case 'eq': return String(v) === String(val); case 'in': return Array.isArray(val) ? val.includes(String(v)) : String(val).split(',').map((x) => x.trim()).includes(String(v));
  }
  return true;
}
export function conditionText(c: StepCondition, lang: 'ar' | 'en', names?: { group?: (id: string) => string; subgroup?: (id: string) => string; location?: (id: string) => string }): string {
  const f = { days: { ar: 'المدة (أيام)', en: 'days' }, workingDays: { ar: 'أيام العمل', en: 'working days' }, group: { ar: 'مجموعة الموظفين', en: 'employee group' }, subgroup: { ar: 'المجموعة الفرعية', en: 'employee subgroup' }, location: { ar: 'مقر العمل', en: 'work location' } }[c.field];
  const op = { gt: { ar: 'أكبر من', en: '>' }, gte: { ar: 'من', en: '≥' }, lt: { ar: 'أقل من', en: '<' }, lte: { ar: 'حتى', en: '≤' }, eq: { ar: '=', en: '=' }, in: { ar: 'ضمن', en: 'in' } }[c.op];
  const vals = Array.isArray(c.value) ? c.value : [String(c.value)];
  const nm = (x: string) => (c.field === 'group' ? names?.group?.(x) : c.field === 'subgroup' ? names?.subgroup?.(x) : c.field === 'location' ? names?.location?.(x) : undefined) || x;
  return `${f[lang]} ${op[lang]} ${vals.map(nm).join(lang === 'ar' ? '، ' : ', ')}`;
}

/* ——— التقييم ——— */
export interface Check { key: string; level: 'ok' | 'info' | 'warn' | 'block'; text: T2 }
export interface TierSlice { pay: number; days: number }
export interface SickView { cycleStart: string; cycleEnd: string; usedDays: number; tiers: { pay: number; fromDay: number; toDay: number | null }[]; slices: TierSlice[]; warning?: T2; currentTierPay: number; daysLeftInTier: number | null }
export interface EvalResult {
  ok: boolean; days: number; workingDays: number; checks: Check[]; steps: Step[]; balanceAfter?: number; lastAllowedSubmit?: string; sick?: SickView; entitlements: { e: Entitlement; days: number }[]; hijriFrom?: string;
}
export interface EvalInput { content: PolicyContent; person: Person; type: LeaveType; from: string; to: string; halfDay?: boolean; today: string; absences: Absence[]; balances?: Balances; ops?: PolicyOps; requests?: { typeId?: string; year: number; entitlements?: string[]; from?: string; to?: string; open?: boolean }[] }
export function evaluateLeave(inp: EvalInput): EvalResult {
  const { content, person, type, from, to, today, absences } = inp; const loc: Loc = person.location || 'riyadh'; const cal = content.calendar; const checks: Check[] = [];
  const days = from && to && to >= from ? (inp.halfDay ? 0.5 : daysBetween(from, to)) : 0;
  const workingDays = from && to && to >= from ? (inp.halfDay ? 0.5 : workingDaysBetween(from, to, loc, cal)) : 0;
  const steps = stepsForType(type, content);
  const out: EvalResult = { ok: true, days, workingDays, checks, steps, entitlements: [] };
  const block = (key: string, ar: string, en: string) => { checks.push({ key, level: 'block', text: { ar, en } }); out.ok = false; };
  const warn = (key: string, ar: string, en: string) => checks.push({ key, level: 'warn', text: { ar, en } });
  const info = (key: string, ar: string, en: string) => checks.push({ key, level: 'info', text: { ar, en } });
  const okc = (key: string, ar: string, en: string) => checks.push({ key, level: 'ok', text: { ar, en } });
  if (!type.enabled) block('enabled', 'هذا النوع غير مفعّل في الإصدار الساري من السياسة.', 'This type is not enabled in the active policy version.');
  // الأهلية
  if (type.eligibility?.includes('female') && person.gender !== 'f') block('elig', 'هذه الإجازة للموظفات.', 'This leave is for female employees.');
  if (type.scope && !inScope(person, type.scope)) block('elig', 'هذه الإجازة لفئات موظفين أخرى وفق سياسة الإجازات.', 'This leave is for other employee groups under the leave policy.');
  if (type.eligibility?.includes('parent') && !person.parent) block('elig', 'هذه الإجازة للآباء والأمهات وفق سجل المرافقين.', 'This leave is for parents per the dependants record.');
  if (type.minServiceYears && person.hiredAt && (Date.now() - person.hiredAt) < type.minServiceYears * 365 * DAY) block('service', `تشترط هذه الإجازة ${type.minServiceYears} سنوات خدمة على الأقل.`, `Requires at least ${type.minServiceYears} years of service.`);
  if (type.onceInCareer && absences.some((a) => a.personId === person.id && a.typeId === type.id)) block('once', 'هذه الإجازة تُمنح مرة واحدة في العمر الوظيفي وقد استُخدمت.', 'Granted once in a career, and already used.');
  if (type.seasonal) { const w = inp.ops?.windows[type.id]; if (!windowOpen(w, today)) block('season', `نافذة ${type.dateWindow?.label.ar || type.name.ar} مغلقة الآن؛ يفتحها مدير النظام في موعدها${w?.from ? ` (آخر نافذة: ${w.from} → ${w.to || '…'})` : ''}.`, `The ${type.dateWindow?.label.en || type.name.en} window is closed now; the administrator opens it in season${w?.from ? ` (last window: ${w.from} → ${w.to || '…'})` : ''}.`); }
  // الدورة والشرائح (المرضية والمرافقة)
  if (type.cycle) {
    const rule = type.cycle[person.group || ''] || Object.values(type.cycle)[0];
    if (rule) {
      // الدورة تبدأ من أول إجازة من النوع نفسه وتمتد سنوات تقويمية حتى اليوم الذي قبل الذكرى؛ وأول إجازة بعد انتهاء دورة تبدأ دورة جديدة من تاريخها (قيم عمر، 17 سبتمبر 2026)
      const mine = absences.filter((a) => a.personId === person.id && a.typeId === type.id).sort((a, b) => (a.from < b.from ? -1 : 1));
      const ref = from || today;
      let cycleStart = mine[0]?.from || ref; let cycleEnd = addDays(addYears(cycleStart, rule.years), -1);
      for (const a of mine) { if (a.from > cycleEnd) { cycleStart = a.from; cycleEnd = addDays(addYears(cycleStart, rule.years), -1); } }
      if (ref > cycleEnd) { cycleStart = ref; cycleEnd = addDays(addYears(cycleStart, rule.years), -1); }
      const usedDays = mine.filter((a) => a.from >= cycleStart && a.from <= cycleEnd).reduce((n, a) => n + a.days, 0);
      const tiers: SickView['tiers'] = []; let cursor = 1;
      for (const t of rule.tiers) { const len = t.months === null ? null : t.months * MONTH_DAYS; tiers.push({ pay: t.pay, fromDay: cursor, toDay: len === null ? null : cursor + len - 1 }); if (len !== null) cursor += len; }
      const slices: TierSlice[] = []; let remaining = days; let pos = usedDays + 1;
      for (const t of tiers) { if (remaining <= 0) break; const cap = t.toDay === null ? Infinity : t.toDay - pos + 1; if (cap <= 0) continue; const take = Math.min(remaining, cap); if (take > 0) slices.push({ pay: t.pay, days: take }); remaining -= take; pos += take; }
      const cur = tiers.find((t) => t.toDay === null || usedDays + 1 <= t.toDay) || tiers[tiers.length - 1];
      const daysLeftInTier = cur.toDay === null ? null : cur.toDay - usedDays;
      const view: SickView = { cycleStart, cycleEnd, usedDays, tiers, slices, currentTierPay: cur.pay, daysLeftInTier };
      const totalTier = cur.toDay === null ? null : cur.toDay - cur.fromDay + 1;
      const afterUsed = usedDays + days; const nextTier = tiers[tiers.indexOf(cur) + 1];
      if (days > 0 && cur.toDay !== null && nextTier && (afterUsed >= cur.toDay || (totalTier && (afterUsed / cur.toDay) * 100 >= content.warnings.tierPct) || cur.toDay - afterUsed <= content.warnings.tierDays)) {
        view.warning = { ar: `يقترب رصيد الأجر الكامل من نهايته: بعد هذا الطلب تكون ${afterUsed} من ${cur.toDay} يوماً؛ ما بعدها بأجر ${nextTier.pay}%.`, en: `Full-pay allowance nearly used: after this request ${afterUsed} of ${cur.toDay} days; beyond it pays ${nextTier.pay}%.` };
        warn('tier', view.warning.ar, view.warning.en);
      }
      if (slices.some((sl) => sl.pay < 100)) warn('slices', `توزيع الأجر لهذا الطلب: ${slices.map((sl) => `${sl.days} يوماً بأجر ${sl.pay}%`).join('، ')}.`, `Pay breakdown for this request: ${slices.map((sl) => `${sl.days} days at ${sl.pay}%`).join(', ')}.`);
      out.sick = view;
    }
  }
  if (!from || !to) { out.ok = false; return out; }
  if (to < from) block('dates', 'تاريخ النهاية قبل البداية.', 'End date is before the start.');
  // إقفال الفترة (التشغيل): لا طلبات بتواريخ في فترة أقفلتها شؤون الموظفين بعد تصدير تقاريرها
  const pc = inp.ops?.periodClose;
  if (pc && periodClosed(pc, from)) block('closed', `الفترة حتى ${pc.until} مقفلة (${pc.reason}${pc.reference ? ` · ${pc.reference}` : ''})؛ لا تُقبل طلبات بتواريخ فيها. راجع شؤون الموظفين إن كان لديك مبرر.`, `The period up to ${pc.until} is closed (${pc.reason}${pc.reference ? ` · ${pc.reference}` : ''}); requests dated inside it are not accepted. Contact personnel affairs if you have a reason.`);
  // المدة الثابتة والسقف
  if (type.fixedDays && days !== type.fixedDays) info('fixed', `مدة هذه الإجازة ${type.fixedDays} يوماً؛ سيُضبط تاريخ النهاية عليها.`, `This leave is ${type.fixedDays} days; the end date is set accordingly.`);
  if (type.maxPerRequest && days > type.maxPerRequest) block('max', `السقف الأقصى للطلب الواحد ${type.maxPerRequest} يوماً.`, `Maximum per request is ${type.maxPerRequest} days.`);
  if (type.maxMonthsPerYears) { const win = addDays(from, -type.maxMonthsPerYears.years * 365); const used = absences.filter((a) => a.personId === person.id && a.typeId === type.id && a.from >= win).reduce((n, a) => n + a.days, 0); const cap = type.maxMonthsPerYears.months * MONTH_DAYS; if (used + days > cap) block('cap', `سقف هذه الإجازة ${type.maxMonthsPerYears.months} شهراً في كل ${type.maxMonthsPerYears.years} سنوات؛ المستخدم ${used} يوماً.`, `Cap is ${type.maxMonthsPerYears.months} months per ${type.maxMonthsPerYears.years} years; used ${used} days.`); else okc('cap', `ضمن سقف ${type.maxMonthsPerYears.months} شهراً لكل ${type.maxMonthsPerYears.years} سنوات (المستخدم ${used} يوماً).`, `Within the cap of ${type.maxMonthsPerYears.months} months per ${type.maxMonthsPerYears.years} years (used ${used} days).`); }
  // النوافذ الزمنية
  if (type.windowAfterEnd !== undefined && type.windowAfterEnd !== null) { const last = addWorkingDays(to, type.windowAfterEnd, loc, cal); out.lastAllowedSubmit = last; if (today > last) block('window', `انتهت نافذة التقديم: آخر يوم كان ${last} (${type.windowAfterEnd} أيام عمل بعد انتهاء الإجازة).`, `The submission window closed on ${last} (${type.windowAfterEnd} working days after the leave ended).`); else if (to < today) info('window', `يمكن تقديم هذه الإجازة حتى ${last} (${type.windowAfterEnd} أيام عمل بعد انتهائها).`, `Can be submitted until ${last} (${type.windowAfterEnd} working days after it ended).`); }
  if (type.advanceMin && from < addDays(today, type.advanceMin)) block('advance', `يلزم تقديم هذه الإجازة قبل ${type.advanceMin} أيام على الأقل من بدايتها.`, `Must be submitted at least ${type.advanceMin} days before it starts.`);
  if (type.hijriWindow) { const h = hijri(from); out.hijriFrom = h ? `${h.d}/${h.m}/${h.y}` : undefined; if (h && !(h.m === type.hijriWindow.month && h.d >= type.hijriWindow.fromDay && h.d <= type.hijriWindow.toDay)) block('hijri', `تكون هذه الإجازة من ${type.hijriWindow.fromDay} إلى ${type.hijriWindow.toDay} من شهر ${hijriMonthName(type.hijriWindow.month, 'ar')} (بدايتك: ${hijriText(from, 'ar')}).`, `This leave runs from ${type.hijriWindow.fromDay} to ${type.hijriWindow.toDay} of ${hijriMonthName(type.hijriWindow.month, 'en')} (your start: ${hijriText(from, 'en')}).`); else if (h) okc('hijri', `البداية ${hijriText(from, 'ar')} ضمن نافذة الحج.`, `Start ${hijriText(from, 'en')} is within the Hajj window.`); }
  const win = type.seasonal ? inp.ops?.windows[type.id] : type.dateWindow;
  if (win && win.from && win.to && (from < win.from || to > win.to)) block('datewin', `${type.dateWindow?.label.ar || type.name.ar}: من ${win.from} إلى ${win.to}.`, `${type.dateWindow?.label.en || type.name.en}: ${win.from} to ${win.to}.`);
  // التداخل
  const overlap = absences.find((a) => a.personId === person.id && !(a.to < from || a.from > to));
  if (overlap) block('overlap', `تتداخل مع إجازة مسجلة من ${overlap.from} إلى ${overlap.to}.`, `Overlaps a recorded leave from ${overlap.from} to ${overlap.to}.`);
  const pending = (inp.requests || []).find((r) => r.open && r.from && r.to && !(r.to < from || r.from > to));
  if (pending) block('overlap', `لديك طلب إجازة جارٍ يتداخل مع هذه التواريخ (${pending.from} → ${pending.to}).`, `You have an open leave request overlapping these dates (${pending.from} → ${pending.to}).`);
  // الرصيد
  if (type.balance === 'annual' && inp.balances) { const after = inp.balances.annual - days; out.balanceAfter = after; if (after < 0) block('balance', `الرصيد السنوي ${inp.balances.annual} يوماً لا يكفي لهذا الطلب.`, `Annual balance ${inp.balances.annual} days is not enough.`); else okc('balance', `الرصيد بعد الطلب ${after} يوماً.`, `Balance after: ${after} days.`); }
  if (type.balance === 'emergency' && inp.balances) { const after = inp.balances.emergency - days; out.balanceAfter = after; if (after < 0) block('balance', `رصيد الاضطرارية ${inp.balances.emergency} أيام لا يكفي.`, `Emergency balance ${inp.balances.emergency} days is not enough.`); else okc('balance', `الرصيد بعد الطلب ${after} أيام.`, `Balance after: ${after} days.`); }
  // الاستحقاقات المرتبطة
  for (const e of content.entitlements) {
    if (!e.enabled || !e.leaveTypes.includes(type.id)) continue;
    const eligible = e.eligibility === 'outsideHome' ? worksOutsideHome(person) && (!e.contractFlag || !!person.contract?.[e.contractFlag]) : inScope(person, e.scope) || (inp.ops?.groups[e.id] || []).includes(person.id);
    if (!eligible) continue;
    const min = e.minDays;
    const year = fromISO(from).getFullYear(); const usedThisYear = (inp.requests || []).filter((r) => r.year === year && r.entitlements?.includes(e.id)).length;
    if (days >= min && usedThisYear < e.perYear) out.entitlements.push({ e, days: min });
    else if (days > 0 && days < min && usedThisYear < e.perYear) info(`ent-${e.id}`, `${e.name.ar}: تستحقه عند إجازة ${min} أيام فأكثر (طلبك ${days}).`, `${e.name.en}: earned with ${min}+ days (this request ${days}).`);
  }
  if (type.external) info('external', type.external.ar, type.external.en);
  if (type.attachment?.required) info('att', `المرفق الإلزامي: ${type.attachment.label.ar}.`, `Required attachment: ${type.attachment.label.en}.`);
  return out;
}

/* ——— الإصدار الابتدائي 2026.1 بقيم عمر (17 سبتمبر 2026) ——— */
const t2 = (ar: string, en: string): T2 => ({ ar, en });
export function seedPolicy(at: number): PolicyState {
  const types: LeaveType[] = [
    { id: 'annual', section: 'core', erp: { grouping: '01', subtype: '0100' }, name: t2('الإجازة السنوية', 'Annual leave'), icon: 'leave', tone: 'g-green', route: 'R1', pay: 'paid', unit: 'day', balance: 'annual', windowAfterEnd: 10, advanceMin: null, maxPerRequest: null, enabled: true, cancel: { allowed: 'beforeStart', route: 'none' }, guidance: t2('تُخصم من رصيدك السنوي، ويعتمدها مديرك المباشر. يمكن تقديمها بعد انتهائها خلال 10 أيام عمل على الأكثر.', 'Deducted from your annual balance and approved by your line manager. Can be submitted up to 10 working days after it ends.') },
    { id: 'emergency', section: 'core', erp: { grouping: '01', subtype: '0110' }, name: t2('الإجازة الاضطرارية', 'Emergency leave'), icon: 'alert', tone: 'g-bronze', route: 'R1', pay: 'paid', unit: 'day', balance: 'emergency', windowAfterEnd: 10, advanceMin: null, maxPerRequest: null, enabled: true, cancel: { allowed: 'beforeStart', route: 'none' }, guidance: t2('لظرف طارئ، ويعتمدها مديرك المباشر. يمكن تقديمها بعد انتهائها خلال 10 أيام عمل على الأكثر.', 'For an emergency, approved by your line manager. Can be submitted up to 10 working days after it ends.') },
    { id: 'sick', section: 'medical', erp: { grouping: '01', subtype: '0200' }, name: t2('الإجازة المرضية', 'Sick leave'), icon: 'medkit', tone: 'g-teal', route: 'R2', pay: 'partial', unit: 'day', balance: 'none', attachment: { label: t2('تقرير طبي معتمد', 'Certified medical report'), required: true }, windowAfterEnd: null, advanceMin: null, maxPerRequest: null, enabled: true, cancel: { allowed: 'untilEnd', route: 'R2' },
      cycle: { '1': { years: 2, tiers: [{ months: 6, pay: 100 }, { months: 6, pay: 50 }, { months: null, pay: 0 }] }, '2': { years: 1, tiers: [{ months: 1, pay: 100 }, { months: 2, pay: 75 }, { months: null, pay: 0 }] } },
      guidance: t2('تعتمدها شؤون الموظفين مباشرة ويُشعَر مديرك. الأجر متدرج داخل دورة زمنية تبدأ من أول إجازة مرضية.', 'Approved directly by personnel affairs; your manager is notified. Pay is tiered within a cycle that starts at your first sick leave.') },
    { id: 'escortIn', section: 'medical', erp: { grouping: '01', subtype: '0210' }, name: t2('مرافقة مريض داخلية', 'Patient escort (inside)'), icon: 'bed', tone: 'g-sage', route: 'R2', pay: 'partial', unit: 'day', balance: 'none', attachment: { label: t2('تقرير طبي يثبت الحاجة إلى المرافقة', 'Medical report confirming the need for an escort'), required: true }, windowAfterEnd: null, advanceMin: null, maxPerRequest: null, enabled: true,
      cycle: { '1': { years: 1, tiers: [{ months: 1, pay: 100 }, { months: 2, pay: 0 }], condition: t2('العلاج داخل مقر مدينة العمل', 'Treatment inside the work city') }, '2': { years: 1, tiers: [{ months: 1, pay: 100 }, { months: 2, pay: 0 }], condition: t2('العلاج داخل مقر مدينة العمل', 'Treatment inside the work city') } },
      guidance: t2('لمرافقة مريض يُعالج داخل مدينة العمل: شهر براتب، ويجوز تمديدها شهرين بلا راتب، مرة في كل سنة من أول إجازة.', 'To escort a patient treated inside the work city: one month paid, extendable two months unpaid, once per year from the first leave.') },
    { id: 'escortOut', section: 'medical', erp: { grouping: '01', subtype: '0220' }, name: t2('مرافقة مريض خارجية', 'Patient escort (abroad)'), icon: 'plane', tone: 'g-sage', route: 'R2', pay: 'partial', unit: 'day', balance: 'none', attachment: { label: t2('تقرير طبي وإثبات العلاج خارج مدينة العمل', 'Medical report and proof of treatment outside the work city'), required: true }, windowAfterEnd: null, advanceMin: null, maxPerRequest: null, enabled: true,
      cycle: { '1': { years: 5, tiers: [{ months: 6, pay: 100 }, { months: 3, pay: 50 }, { months: 2, pay: 0 }], condition: t2('العلاج خارج مقر مدينة العمل', 'Treatment outside the work city') }, '2': { years: 5, tiers: [{ months: 6, pay: 100 }, { months: 3, pay: 50 }, { months: 2, pay: 0 }], condition: t2('العلاج خارج مقر مدينة العمل', 'Treatment outside the work city') } },
      guidance: t2('لمرافقة مريض يُعالج خارج مدينة العمل: ستة أشهر براتب، ثم ثلاثة بنصف راتب، ثم تمديد شهرين بلا راتب، في دورة خمس سنوات من أول إجازة.', 'To escort a patient treated outside the work city: six months paid, three at half pay, then two months unpaid, in a five-year cycle from the first leave.') },
    { id: 'exam', section: 'other', erp: { grouping: '01', subtype: '0300' }, name: t2('إجازة الاختبارات', 'Exam leave'), icon: 'pen', tone: 'g-gold', route: 'R3', pay: 'paid', unit: 'day', balance: 'none', attachment: { label: t2('ما يثبت موعد الاختبار', 'Proof of the exam date'), required: true }, windowAfterEnd: null, advanceMin: null, maxPerRequest: null, enabled: true, guidance: t2('لأداء اختبار أثناء وقت العمل، بإثبات موعده. يعتمدها مديرك ثم شؤون الموظفين.', 'To sit an exam during working hours, with proof of the date. Approved by your manager then personnel affairs.') },
    { id: 'withThem', section: 'family', erp: { grouping: '01', subtype: '0310' }, name: t2('كونوا معهم', 'Be with them'), icon: 'school', tone: 'g-sage', route: 'R1', pay: 'paid', unit: 'halfday', balance: 'none', windowAfterEnd: null, advanceMin: null, maxPerRequest: 1, eligibility: ['parent'], seasonal: true, dateWindow: { label: t2('الأسبوع الأول من الدراسة', 'First week of school'), from: '', to: '' }, enabled: true, guidance: t2('نصف يوم للآباء والأمهات في الأسبوع الأول من الدراسة للجلوس مع الأبناء. يعتمدها مديرك المباشر.', 'Half a day for parents in the first week of school to be with their children. Approved by your line manager.') },
    { id: 'hajj', section: 'family', erp: { grouping: '01', subtype: '0400' }, name: t2('إجازة الحج', 'Hajj leave'), icon: 'kaaba', tone: 'g-gold', route: 'R3', pay: 'paid', unit: 'day', balance: 'none', attachment: { label: t2('تصريح الحج', 'Hajj permit'), required: true }, fixedDays: 20, onceInCareer: true, hijriWindow: { month: 12, fromDay: 1, toDay: 20 }, windowAfterEnd: null, enabled: true, guidance: t2('مرة واحدة في العمر الوظيفي، 20 يوماً من 1 إلى 20 ذي الحجة.', 'Once in a career, 20 days from 1 to 20 Dhu al-Hijjah.') },
    { id: 'marriage', section: 'family', erp: { grouping: '01', subtype: '0410' }, name: t2('إجازة الزواج', 'Marriage leave'), icon: 'heart', tone: 'g-gold', route: 'R3', pay: 'paid', unit: 'day', balance: 'none', attachment: { label: t2('عقد الزواج', 'Marriage contract'), required: true }, fixedDays: 7, onceInCareer: true, windowAfterEnd: null, enabled: true, guidance: t2('سبعة أيام لمرة واحدة في العمر الوظيفي، بإرفاق عقد الزواج.', 'Seven days once in a career, with the marriage contract attached.') },
    { id: 'maternity', section: 'family', erp: { grouping: '01', subtype: '0420' }, name: t2('إجازة الأمومة', 'Maternity leave'), icon: 'leaf', tone: 'g-teal', route: 'R3', pay: 'paid', unit: 'day', balance: 'none', attachment: { label: t2('شهادة الميلاد', 'Birth certificate'), required: true }, fixedDays: 60, eligibility: ['female'], windowAfterEnd: null, enabled: true, guidance: t2('ستون يوماً عن كل مولود، بإرفاق شهادة الميلاد.', 'Sixty days per newborn, with the birth certificate attached.') },
    { id: 'iddah', section: 'family', erp: { grouping: '01', subtype: '0430' }, name: t2('إجازة العدة', 'Iddah leave'), icon: 'hourglass', tone: 'g-bronze', route: 'R3', pay: 'paid', unit: 'day', balance: 'none', attachment: { label: t2('شهادة الوفاة', 'Death certificate'), required: true }, fixedDays: 130, eligibility: ['female'], windowAfterEnd: null, enabled: true, guidance: t2('أربعة أشهر وعشرة أيام، بإرفاق شهادة الوفاة.', 'Four months and ten days, with the death certificate attached.') },
    { id: 'death', section: 'family', erp: { grouping: '01', subtype: '0440' }, name: t2('إجازة الوفاة', 'Bereavement leave'), icon: 'ribbon', tone: 'g-bronze', route: 'R2', pay: 'paid', unit: 'day', balance: 'none', attachment: { label: t2('شهادة الوفاة', 'Death certificate'), required: true }, fixedDays: 3, windowAfterEnd: null, enabled: true, guidance: t2('ثلاثة أيام لوفاة قريب من الدرجة الأولى أو الثانية. تعتمدها شؤون الموظفين ويُشعَر مديرك.', 'Three days for a first- or second-degree relative. Approved by personnel affairs; your manager is notified.') },
    { id: 'exceptional', section: 'other', erp: { grouping: '01', subtype: '0500' }, name: t2('الإجازة الاستثنائية', 'Exceptional leave'), icon: 'hand', tone: 'g-bronze', route: 'R4', pay: 'unpaid', unit: 'day', balance: 'none', attachment: { label: t2('قرار الأمين العام المساعد', 'Decision of the Assistant Secretary-General'), required: true }, maxMonthsPerYears: { months: 12, years: 5 }, minServiceYears: 2, windowAfterEnd: null, enabled: true, cancel: { allowed: 'untilEnd', route: 'R3' }, external: t2('موافقة الأمين العام وقراره بالإجازة يصدران خارج النظام، ويُرفق قرار الأمين العام المساعد عند التقديم.', 'The Secretary-General’s approval and decision are issued outside the system; attach the Assistant Secretary-General’s decision when submitting.'), guidance: t2('بلا راتب، سنة كحد أقصى في كل خمس سنوات، بعد سنتين في الخدمة. تمر على السلسلة الإدارية كاملة ثم الموارد البشرية ومدير الرواتب.', 'Unpaid, up to one year in every five, after two years of service. Goes through the full management chain, then HR and the payroll manager.') },
  ];
  // المسارات المعيارية الأربعة بقواعد الاستخراج (CAP-01 §7): النتيجة للموظف كما اعتمدها عمر، والمعتمد منصب لا شخص
  const esc: Escalation = { remindAtPct: 80, after: 'notifyManager' };
  const routes: Route[] = [
    { id: 'R1', name: t2('المدير المباشر', 'Line manager'), steps: [{ agent: { kind: 'lineManager' }, mode: 'approve', slaHours: 48, escalation: esc }] },
    { id: 'R2', name: t2('شؤون الموظفين مباشرة', 'Personnel affairs directly'), steps: [{ agent: { kind: 'lineManager' }, mode: 'notify', slaHours: 0 }, { agent: { kind: 'pool', unitId: 'O-211' }, mode: 'approve', slaHours: 48, escalation: esc }] },
    { id: 'R3', name: t2('المدير ثم شؤون الموظفين', 'Manager then personnel affairs'), steps: [{ agent: { kind: 'lineManager' }, mode: 'approve', slaHours: 48, escalation: esc }, { agent: { kind: 'pool', unitId: 'O-211' }, mode: 'approve', slaHours: 48, escalation: esc }] },
    { id: 'R4', name: t2('السلسلة الإدارية ثم الموارد البشرية', 'Management chain then HR'), steps: [
      { agent: { kind: 'chain', upTo: 'ga' }, mode: 'approve', slaHours: 24, escalation: esc },
      { agent: { kind: 'positions', positionIds: ['S-200'], quorum: 'any' }, mode: 'approve', slaHours: 24, escalation: esc },
      { agent: { kind: 'positions', positionIds: ['S-210'], quorum: 'any' }, mode: 'approve', slaHours: 24, escalation: esc },
      { agent: { kind: 'positions', positionIds: ['S-211'], quorum: 'any' }, mode: 'approve', slaHours: 24, escalation: esc },
      { agent: { kind: 'positions', positionIds: ['S-121'], quorum: 'any' }, mode: 'notify', slaHours: 0 },
      { agent: { kind: 'pool', unitId: 'O-211' }, mode: 'fulfil', slaHours: 48, escalation: esc },
    ] },
  ];
  // الاستحقاقات: الأهلية بالنطاق (D-013) والتنفيذ مهمة في صندوق الجهة (D-014)
  const entitlements: Entitlement[] = [
    { id: 'tickets', name: t2('تذاكر الإجازة السنوية', 'Annual leave tickets'), eligibility: 'outsideHome', contractFlag: 'ticketsEntitled', leaveTypes: ['annual'], minDays: 5, perYear: 1, enabled: true, action: t2('يُنشأ طلب تذاكر مرتبط بالإجازة وينفّذه قسم الانتدابات.', 'A linked tickets request is created and executed by the assignments section.'), fulfil: { mode: 'task', agent: { kind: 'pool', unitId: 'O-122' }, timing: 'afterApproval', slaHours: 72 }, onCancel: { approval: false, reversal: 'task', slaHours: 72 } },
    { id: 'advance', name: t2('راتب الإجازة المقدّم', 'Advance leave salary'), eligibility: 'scope', scope: { groups: ['1'] }, leaveTypes: ['annual'], minDays: 30, perYear: 1, enabled: true, action: t2('يصرف قسم الرواتب راتب الإجازة مقدماً قبل بدايتها.', 'Payroll pays the leave salary in advance before it starts.'), fulfil: { mode: 'task', agent: { kind: 'pool', unitId: 'O-121' }, timing: 'beforeStart', daysBefore: 5, slaHours: 72 }, onCancel: { approval: true, reversal: 'task', slaHours: 72 } },
  ];
  const calendar: Calendar = {
    weekend: { riyadh: [5, 6], abudhabi: [6, 0] },
    holidays: [
      { date: '2026-09-23', name: t2('اليوم الوطني السعودي', 'Saudi National Day'), locations: ['riyadh'] },
      { date: '2026-12-02', name: t2('اليوم الوطني الإماراتي', 'UAE National Day'), locations: ['abudhabi'] },
      { date: '2026-12-03', name: t2('اليوم الوطني الإماراتي', 'UAE National Day'), locations: ['abudhabi'] },
      { date: '2027-02-22', name: t2('يوم التأسيس', 'Founding Day'), locations: ['riyadh'] },
    ],
  };
  const content: PolicyContent = { types, routes, entitlements, calendar, warnings: { tierPct: 80, tierDays: 5 } };
  const v1: PolicyVersion = { id: 'V-1', number: '2026.1', from: '2026-09-01', scheduled: true, createdBy: 'P-OMAR', createdAt: at - 16 * DAY, reason: 'الإصدار الابتدائي من سياسة الإجازات كما قررها صاحب المشروع (بطاقة TM-01)', reference: 'بطاقة الإجراء TM-01 · 1.0', content, changes: [], notifiedScheduled: true, notifiedActive: true };
  return {
    versions: [v1],
    // حوكمة التغيير (D-010): مدير سياسة واحد، والموافقة الثانية مبنية ومطفأة؛ يفعّلها المدير بمفتاح ويختار المكتب المعتمد
    governance: { secondApprover: false, approverPositionId: 'S-200' },
    // النوافذ الموسمية: نافذة «كونوا معهم» أُقفلت بعد الأسبوع الأول من الدراسة، ويفتحها مدير النظام في موعدها القادم
    windows: { withThem: { open: false, from: '2026-08-23', to: '2026-08-27', changedBy: 'P-OMAR', changedAt: at - 20 * DAY } },
    // مجموعات الاستحقاق: مجموعة راتب الإجازة المقدّم يحددها مدير النظام
    groups: { advance: ['P-KHALID'] },
    periodClose: null,
    opsLog: [{ at: at - 20 * DAY, by: 'P-OMAR', what: t2('إقفال نافذة كونوا معهم', 'Closed the Be with them window'), detail: '' }, { at: at - 40 * DAY, by: 'P-OMAR', what: t2('استثناء في راتب الإجازة المقدّم', 'Exception added to Advance leave salary'), detail: '+1 −0 · 1' }],
  };
}

/* ——— v0.9 سياسة الاحتياج (AS-01): الإصدار الابتدائي 2026.1 كما وصفه عمر في 18 سبتمبر 2026 — الجهات الفنية والفئات والمستودعان 1010/1020 والمقرات والقواعد، ومساران بالأدوار (م5 المواد، م7 الخدمات) ——— */
export function seedNeedPolicy(at: number): PolicyState {
  const esc: Escalation = { remindAtPct: 80, after: 'notifyManager' };
  const need: NeedContent = {
    entities: [
      { id: 'IT', name: t2('تقنية المعلومات', 'Information Technology'), agent: { kind: 'positions', positionIds: ['S-140', 'S-1401'], quorum: 'any' } },
      { id: 'GS', name: t2('الخدمات العامة', 'General Services'), agent: { kind: 'positions', positionIds: ['S-150', 'S-1501'], quorum: 'any' } },
      { id: 'PROT', name: t2('المراسم', 'Protocol'), agent: { kind: 'positions', positionIds: ['S-160'], quorum: 'any' } },
      { id: 'MEDIA', name: t2('الإعلامية', 'Media'), agent: { kind: 'positions', positionIds: ['S-170'], quorum: 'any' } },
    ],
    stores: [
      { id: '1010', name: t2('المستودع العام', 'General store'), agent: { kind: 'positions', positionIds: ['S-1302'], quorum: 'any' } },
      { id: '1020', name: t2('المستودع التقني', 'Technical store'), agent: { kind: 'positions', positionIds: ['S-1402'], quorum: 'any' } },
    ],
    categories: [
      { id: 'techMaterial', name: t2('مادة تقنية', 'Technical material'), kind: 'material', entityId: 'IT', storeId: '1020', custody: true, icon: 'box', tone: 'g-green', guidance: t2('أجهزة وملحقات تقنية: تعتمد تقنية المعلومات المواصفات، ويُفحص المستودع التقني قبل الشراء، وتصير عهدة.', 'Devices and technical accessories: IT approves the specifications, the technical store is checked before buying, and the item becomes custody.') },
      { id: 'generalMaterial', name: t2('مادة عامة', 'General material'), kind: 'material', entityId: 'GS', storeId: '1010', custody: true, icon: 'box', tone: 'g-sage', guidance: t2('أثاث ومستلزمات عامة: تعتمدها الخدمات العامة، ويُفحص المستودع العام قبل الشراء.', 'Furniture and general supplies: General Services approves, the general store is checked before buying.') },
      { id: 'protocolMaterial', name: t2('مواد المراسم', 'Protocol material'), kind: 'material', entityId: 'PROT', storeId: '1010', custody: false, icon: 'ribbon', tone: 'g-gold', guidance: t2('هدايا ومستلزمات المراسم: تعتمدها المراسم، وتُصرف من المستودع العام أو تُشترى.', 'Gifts and protocol supplies: Protocol approves; issued from the general store or bought.') },
      { id: 'mediaMaterial', name: t2('مواد إعلامية', 'Media material'), kind: 'material', entityId: 'MEDIA', storeId: '1010', custody: true, icon: 'globe', tone: 'g-bronze', guidance: t2('معدات ومواد إعلامية: تعتمدها الإعلامية، وتصير عهدة.', 'Media equipment and materials: Media approves; becomes custody.') },
      /* v0.11 (D-023): مصدر التوفر للخدمة التقنية «رصيد الجهة» — رخص ومقاعد تملكها تقنية المعلومات فتوفّرها من عندها إن توفرت، وإلا الشراء */
      { id: 'techService', name: t2('خدمة تقنية', 'Technical service'), kind: 'service', entityId: 'IT', custody: false, icon: 'gear', tone: 'g-teal', availability: 'entity', guidance: t2('رخص واشتراكات وخدمات تقنية: تقنية المعلومات توفّرها من رصيدها إن توفرت، وإلا تعتمد المواصفات وتقيّم العروض؛ لا مستودع.', 'Licences, subscriptions and technical services: IT provides them from its own pool when available, otherwise approves the specifications and evaluates the offers; no store.') },
      { id: 'generalService', name: t2('خدمة عامة', 'General service'), kind: 'service', custody: false, icon: 'doc', tone: 'g-sage', guidance: t2('استشارات وترجمة وخدمات عامة: لا جهة فنية؛ مكتب المشتريات يعيّن من يقيّم العروض.', 'Consulting, translation and general services: no technical entity; procurement names the evaluator.') },
    ],
    sites: [
      { id: 'riyadh', name: t2('المقر الرئيسي — الرياض', 'Headquarters — Riyadh'), storeIds: ['1010', '1020'] },
      { id: 'abudhabi', name: t2('مكتب أبوظبي', 'Abu Dhabi office'), storeIds: [], receiverAgent: { kind: 'positions', positionIds: ['S-190'], quorum: 'any' } },
    ],
    /* v0.10: كتالوج الاحتياجات — أسماء مألوفة بسعر استرشادي مربوطة برقم الصنف خلف الشاشة (الطالب لا يختار رقم صنف) */
    catalog: [
      { id: 'K-laptop', name: t2('حاسوب محمول (معيار الموظف)', 'Laptop (staff standard)'), categoryId: 'techMaterial', itemIds: ['M-100201'], price: 4800, unit: t2('جهاز', 'unit'), icon: 'box', guidance: t2('المعيار المعتمد من تقنية المعلومات: 14 بوصة، 16 غ.ب', 'IT-approved standard: 14", 16 GB') },
      { id: 'K-monitor', name: t2('شاشة مكتب', 'Desk monitor'), categoryId: 'techMaterial', itemIds: ['M-100202'], price: 1350, unit: t2('جهاز', 'unit'), icon: 'box' },
      { id: 'K-stand', name: t2('حامل حاسوب محمول', 'Laptop stand'), categoryId: 'techMaterial', itemIds: ['M-100203'], price: 180, unit: t2('قطعة', 'pc'), icon: 'box' },
      { id: 'K-headset', name: t2('سماعة رأس للاجتماعات', 'Meeting headset'), categoryId: 'techMaterial', itemIds: ['M-100204'], price: 320, unit: t2('قطعة', 'pc'), icon: 'box' },
      { id: 'K-toner', name: t2('حبر طابعة', 'Printer toner'), categoryId: 'techMaterial', itemIds: ['M-100205'], price: 260, unit: t2('عبوة', 'cartridge'), icon: 'box' },
      { id: 'K-projector', name: t2('جهاز عرض لقاعة', 'Meeting-room projector'), categoryId: 'techMaterial', itemIds: ['M-100206'], price: 3900, unit: t2('جهاز', 'unit'), icon: 'box' },
      { id: 'K-chair', name: t2('كرسي مكتب', 'Office chair'), categoryId: 'generalMaterial', itemIds: ['M-200301'], price: 950, unit: t2('قطعة', 'pc'), icon: 'box' },
      { id: 'K-desk', name: t2('مكتب', 'Desk'), categoryId: 'generalMaterial', itemIds: ['M-200302'], price: 2200, unit: t2('قطعة', 'pc'), icon: 'box' },
      { id: 'K-paper', name: t2('ورق A4', 'A4 paper'), categoryId: 'generalMaterial', itemIds: ['M-200303'], price: 95, unit: t2('كرتون', 'box'), icon: 'doc' },
      { id: 'K-gift', name: t2('علبة هدايا رسمية', 'Official gift box'), categoryId: 'protocolMaterial', itemIds: ['M-300401'], price: 420, unit: t2('علبة', 'box'), icon: 'ribbon' },
      { id: 'K-camera', name: t2('كاميرا فيديو', 'Video camera'), categoryId: 'mediaMaterial', itemIds: ['M-400501'], price: 8900, unit: t2('جهاز', 'unit'), icon: 'globe' },
      /* v0.11: بنود مرتبطة برصيد الجهة (تقنية المعلومات تملك مقاعد) — الطالب يطلب بالاسم المألوف ولا يعرف الرصيد */
      { id: 'K-m365', name: t2('مقعد Microsoft 365 (بريد ومكتب)', 'Microsoft 365 seat (mail & office)'), categoryId: 'techService', itemIds: [], price: 900, unit: t2('مقعد', 'seat'), icon: 'gear', poolId: 'POOL-M365', guidance: t2('تخصّصه تقنية المعلومات من رصيدها إن توفر', 'Assigned by IT from its pool when available') },
      { id: 'K-acrobat', name: t2('رخصة Adobe Acrobat Pro', 'Adobe Acrobat Pro licence'), categoryId: 'techService', itemIds: [], price: 780, unit: t2('رخصة', 'licence'), icon: 'gear', poolId: 'POOL-ACROBAT' },
      { id: 'K-licence', name: t2('رخص برمجية أخرى', 'Other software licences'), categoryId: 'techService', itemIds: [], unit: t2('رخصة', 'licence'), icon: 'gear', guidance: t2('اذكر البرنامج وعدد المستخدمين والمدة', 'Name the software, users and term') },
      { id: 'K-translation', name: t2('ترجمة', 'Translation'), categoryId: 'generalService', itemIds: [], unit: t2('صفحة', 'page'), icon: 'doc' },
      { id: 'K-consult', name: t2('استشارة أو دراسة', 'Consulting or study'), categoryId: 'generalService', itemIds: [], unit: t2('عقد', 'contract'), icon: 'doc' },
    ],
    /* v0.10 (D-020، D-021): جدول الصلاحيات بالقيمة — يعتمد الشراء والترسية؛ حتى 500 ألف مدير إدارة المشتريات، وفوقها لجنة المناقصات (رئيسها ونائبها بنصاب الكل) */
    authority: [
      { id: 'B1', name: t2('حتى 500 ألف ريال: مدير إدارة المشتريات', 'Up to SAR 500K: procurement director'), upTo: 500000, agent: { kind: 'positions', positionIds: ['S-130'], quorum: 'any' } },
      { id: 'B2', name: t2('فوق 500 ألف ريال: لجنة المناقصات', 'Above SAR 500K: tender committee'), upTo: null, agent: { kind: 'positions', positionIds: ['S-300', 'S-100'], quorum: 'all' } },
    ],
    /* v0.10 (ق.ت-11): طرق الشراء — حرية المكتب بسبب يُسجَّل؛ «ثلاثة عروض» قيمة لا قاعدة */
    methods: [
      { id: 'quotes', name: t2('عروض أسعار', 'Price quotations'), offers: true, minOffers: 3, higherBand: false, tender: false, contract: false, guidance: t2('العدد الأدنى من العروض من السياسة', 'Minimum number of offers from the policy') },
      { id: 'contract', name: t2('عقد إطاري قائم', 'Existing framework contract'), offers: false, minOffers: 0, higherBand: false, tender: false, contract: true, guidance: t2('بلا عروض ولا ترسية: أمر استدعاء من العقد', 'No offers and no award: a call-off from the contract') },
      { id: 'direct', name: t2('شراء مباشر بمبرر', 'Direct purchase with justification'), offers: true, minOffers: 1, higherBand: true, tender: false, contract: false, guidance: t2('عرض واحد ويعتمده صاحب الشريحة الأعلى', 'One offer, approved by the higher band') },
      { id: 'tender', name: t2('مناقصة', 'Tender'), offers: false, minOffers: 0, higherBand: false, tender: true, contract: false, guidance: t2('إلزامية فوق عتبة المناقصات', 'Mandatory above the tender threshold') },
    ],
    /* v0.11 (D-023): رصيد الجهات — ما توفّره الجهة الفنية من عندها؛ الرصيد الجاري في state.erp.poolStock (تشغيل) لا في الإصدار */
    pools: [
      { id: 'POOL-M365', name: t2('مقاعد Microsoft 365 E3', 'Microsoft 365 E3 seats'), entityId: 'IT', unit: t2('مقعد', 'seat'), erpKind: 'portal', custody: true, unitPrice: 900, guidance: t2('اتفاقية مؤسسية سنوية؛ المقعد يُخصَّص للموظف ويُسترد عند إخلاء الطرف', 'Annual enterprise agreement; a seat is assigned to the employee and reclaimed at clearance') },
      { id: 'POOL-ACROBAT', name: t2('رخص Adobe Acrobat Pro', 'Adobe Acrobat Pro licences'), entityId: 'IT', unit: t2('رخصة', 'licence'), erpKind: 'portal', custody: true, unitPrice: 780 },
      { id: 'POOL-AVCARE', name: t2('صيانة أجهزة العرض (عقد إطاري)', 'Projector maintenance (framework contract)'), entityId: 'IT', unit: t2('زيارة', 'visit'), erpKind: 'contract', contractId: '4600001234', custody: false, unitPrice: 1200, guidance: t2('أمر تنفيذ على العقد الإطاري للأجهزة السمعية والبصرية', 'A release order against the audio-visual framework contract') },
    ],
    /* v0.11 (D-024، D-025): اعتماد الترسية بالاستثناء، والمرفق إلزامي لكل عرض */
    rules: { openerMinLevel: 'department', chainUpTo: 'sector', coordinatorStep: true, tenderThreshold: 500000, urgentEnabled: false, splitAlertDays: 30, minOffers: 3, tolerancePct: 10, awardApproval: 'exception', offerAttachmentRequired: true, inspectionThreshold: 50000, handoverMode: 'each', remedyDays: 5, leadDays: 14, erpNumbers: 'integration', sla: { coordinator: 24, manager: 48, entity: 72, store: 48, procurement: 0, purchaseApproval: 48, budget: 72, quotes: 0, evaluator: 72, awardApproval: 48, receipt: 0, handover: 48 } },
  };
  const R = (role: import('./types').NeedRole, mode: StepModeRule, branch?: import('./types').NeedBranch): RouteStep => ({ agent: { kind: 'requester' }, mode, slaHours: 0, role, branch, escalation: mode === 'approve' ? esc : undefined });
  /* v0.10 (AS-01 2.0 §14): فرع الشراء المنقّح — التجهيز ← اعتماد الشراء ← حجز الاعتماد ← [المناقصات] ← [العروض ← التقييم] ← [زيادة الحجز] ← [اعتماد الترسية] ← النظام: طلب الشراء ← أمر الشراء ← الاستلام ← التسليم */
  const purchase: RouteStep[] = [R('procurement', 'fulfil', 'purchase'), R('purchaseApproval', 'approve', 'purchase'), R('budget', 'approve', 'purchase'), R('tender', 'fulfil', 'tender'), R('quotes', 'fulfil', 'quotes'), R('evaluator', 'approve', 'quotes'), R('budgetTopUp', 'approve', 'topUp'), R('awardApproval', 'approve', 'award'), R('pr', 'fulfil', 'purchase'), R('po', 'fulfil', 'purchase'), R('receipt', 'fulfil', 'purchase')];
  const routes: Route[] = [
    /* v0.11 (D-023): بعد الجهة الفنية مقطع «وُفِّر من رصيد الجهة»: تسليم توقّعه الجهة ثم المستفيد، ويُتخطى كل ما بعده */
    { id: 'R5', name: t2('م5 · المواد: المنسّق ← السلسلة ← الجهة الفنية (الاعتماد وتحديد الصنف أو التوفير من رصيدها) ← [التسليم من رصيد الجهة] ← المستودع ← (التسليم) أو (تجهيز الشراء ← اعتماد الشراء ← حجز الاعتماد ← [المناقصات] ← [العروض ← التقييم] ← [زيادة الحجز] ← [اعتماد الترسية] ← طلب الشراء آلياً ← أمر الشراء ← الاستلام ← التسليم)', 'م5 · Materials: coordinator → chain → technical entity (approval + item identification, or provision from its pool) → [handover from the entity pool] → store → (handover) or (purchase preparation → purchase approval → funds reservation → [tender] → [offers → evaluation] → [top-up] → [award approval] → automatic PR → PO → receipt → handover)'),
      steps: [R('coordinator', 'approve'), R('chain', 'approve'), R('entity', 'approve'), R('handover', 'fulfil', 'provided'), R('store', 'fulfil'), R('handover', 'fulfil', 'stock'), ...purchase, R('handover', 'fulfil', 'purchase')] },
    { id: 'R7', name: t2('م7 · الخدمات: المنسّق ← السلسلة ← الجهة الفنية (الاعتماد أو التوفير من رصيدها) ← [التسليم من رصيد الجهة] ← تجهيز الشراء ← اعتماد الشراء ← حجز الاعتماد ← [المناقصات] ← [العروض ← التقييم] ← [زيادة الحجز] ← [اعتماد الترسية] ← طلب الشراء آلياً ← أمر الشراء ← استلام الخدمة', 'م7 · Services: coordinator → chain → technical entity (approval, or provision from its pool) → [handover from the entity pool] → purchase preparation → purchase approval → funds reservation → [tender] → [offers → evaluation] → [top-up] → [award approval] → automatic PR → PO → service receipt'),
      steps: [R('coordinator', 'approve'), R('chain', 'approve'), R('entity', 'approve'), R('handover', 'fulfil', 'provided'), ...purchase] },
  ];
  const content: PolicyContent = { types: [], routes, entitlements: [], calendar: { weekend: { riyadh: [5, 6], abudhabi: [6, 0] }, holidays: [] }, warnings: { tierPct: 80, tierDays: 5 }, need };
  const v1: PolicyVersion = { id: 'V-1', number: '2026.1', from: '2026-09-01', scheduled: true, createdBy: 'P-OMAR', createdAt: at - 10 * DAY, reason: 'الإصدار الابتدائي من سياسة الاحتياج كما وصفها صاحب المشروع في 18 سبتمبر 2026 وراجعها في 19 سبتمبر (بطاقة AS-01 2.3: الكتالوج وتحديد الصنف وفرع الشراء المنقّح، ورصيد الجهة الفنية، واعتماد الترسية بالاستثناء، ومحاضر الاستلام بدفعاتها)', reference: 'AS-01 2.3', content, changes: [], baseId: 'V-1', notifiedScheduled: true, notifiedActive: true, scope: { kind: 'all' } };
  return {
    versions: [v1], governance: { secondApprover: false, approverPositionId: 'S-100' }, windows: {},
    /* التشغيل: منسّقو المشتريات في القطاع (مناصب) — يسري فوراً بسجل تشغيل */
    groups: { 'coord:O-300': ['S-1112'] }, periodClose: null,
    opsLog: [{ at: at - 10 * DAY, by: 'P-OMAR', what: t2('تعيين منسّقي المشتريات في قطاع الشؤون الإدارية والمالية', 'Procurement coordinators set for the Administrative & Financial Affairs Sector'), detail: '+1 −0 · 1' }],
  };
}


/* ——— v0.13: الإصدار الابتدائي لسياسة الأخبار والقصص (يديره مدير النظام من مركز السياسات؛ الناشرون مناصب من الهيكل لا أشخاص) ——— */
export function seedCommsPolicy(at: number): PolicyState {
  const comms: CommsContent = {
    sectors: [
      { id: 'SEC-SG', unitId: 'O-300', name: t2('الأمانة العامة', 'General Secretariat'), short: t2('الأمانة', 'Secretariat'), initials: t2('أ', 'GS'), hue: 'green', publisherPositionIds: ['S-170'] },
      { id: 'SEC-300', unitId: 'O-100', name: t2('الإدارة العامة للشؤون المالية والإدارية', 'GA for Financial & Administrative Affairs'), short: t2('المالية والإدارية', 'Finance & Admin'), ring: t2('الإدارية', 'Admin'), initials: t2('م', 'AF'), hue: 'gold', publisherPositionIds: ['S-100'] },
      { id: 'SEC-200', unitId: 'O-200', name: t2('الموارد البشرية', 'Human Resources'), short: t2('الموارد البشرية', 'HR'), ring: t2('الموارد', 'HR'), initials: t2('ب', 'HR'), hue: 'sage', publisherPositionIds: ['S-200'] },
      { id: 'SEC-140', unitId: 'O-140', name: t2('تقنية المعلومات', 'Information Technology'), short: t2('التقنية', 'IT'), initials: t2('ت', 'IT'), hue: 'teal', publisherPositionIds: ['S-140'] },
      { id: 'SEC-160', unitId: 'O-160', name: t2('المراسم', 'Protocol'), short: t2('المراسم', 'Protocol'), initials: t2('ر', 'PR'), hue: 'bronze', publisherPositionIds: ['S-160'] },
      { id: 'SEC-190', unitId: 'O-190', name: t2('مكتب أبوظبي', 'Abu Dhabi Office'), short: t2('أبوظبي', 'Abu Dhabi'), initials: t2('ظ', 'AD'), hue: 'night', publisherPositionIds: ['S-190'] },
    ],
    kinds: [
      { id: 'news', name: t2('خبر', 'News'), ackAllowed: false, mediaAllowed: true },
      { id: 'circular', name: t2('تعميم', 'Circular'), ackAllowed: true, mediaAllowed: false },
      { id: 'event', name: t2('فعالية', 'Event'), ackAllowed: false, mediaAllowed: true },
    ],
    rules: { storyHours: 24, storyVideoMaxSec: 30, storyImageMaxMB: 8, storyVideoMaxMB: 60, ackReminderDays: 3, notifyCircular: true, notifyStory: false, postMaxMedia: 10, postImageMaxMB: 12, postVideoMaxMB: 120, postVideoMaxSec: 180 },
  };
  const content: PolicyContent = { types: [], routes: [], entitlements: [], calendar: { weekend: { riyadh: [5, 6], abudhabi: [6, 0] }, holidays: [] }, warnings: { tierPct: 80, tierDays: 5 }, comms };
  const v1: PolicyVersion = { id: 'V-1', number: '2026.1', from: '2026-09-01', scheduled: true, createdBy: 'P-OMAR', createdAt: at - 30 * DAY, reason: 'الإصدار الابتدائي لسياسة الأخبار والقصص', reference: 'قرار D-030 وD-031', content, changes: [], notifiedScheduled: true, notifiedActive: true };
  return { versions: [v1], governance: { secondApprover: false, approverPositionId: 'S-100' }, windows: {}, groups: {}, opsLog: [] };
}

/* ——— v0.15 مصمّم الخدمات (CAP-02): الإصدار الابتدائي بخدمة مهيّأة واحدة مثالاً — DC-03 «خطاب لجهة خارجية» من الجرد ق.ص-01 (مهيّأة بلا عقد كتابة)؛ وما بعدها يبنيه مدير النظام من الشاشة ——— */
/** المستأجر الوحيد اليوم (D-033): الأمانة العامة؛ ينضم غيره بمفتاحه دون تعديل شيفرة */
export const TENANT_DEFAULT = 'GCC-SG';
/* v0.16: البذرة انتقلت إلى src/data/designerSeed.ts (أربع خدمات مثالاً بخريطة الحالات) */
