// نموذج البيانات: الطلب كائن واحد لكل خدمة (P-05)
export interface T2 { ar: string; en: string }
export type Desk = 'requester' | 'manager' | 'deptManager' | 'gm' | 'hrGm' | 'hrDeptManager' | 'hrSectionHead' | 'hr' | 'payrollManager' | 'buyer' | 'finance' | 'payroll' | 'system';
export type PersonaKey = 'employee' | 'manager' | 'hr' | 'buyer' | 'admin';

/* ——— الهيكل التنظيمي (من النظام المرجعي: وحدات ومناصب وشاغلون وعلاقات) — بطاقة CAP-01 §2 ——— */
export type OrgLevel = 'section' | 'department' | 'ga' | 'sector' | 'sg';
export const ORG_LEVELS: OrgLevel[] = ['section', 'department', 'ga', 'sector', 'sg'];
export interface OrgUnit { id: string; name: T2; level: OrgLevel; parentId?: string; chiefPositionId?: string }
/** المنصب: كائن ثابت في الهيكل، له شاغل حالي (أو شاغر) ونائب اختياري */
export interface Position { id: string; title: T2; unitId: string; holderId?: string; deputyPositionId?: string }
/** مجموعة الموظفين ومجموعاتها الفرعية كما في التعيين التنظيمي للنظام المرجعي (D-013) */
export interface EmployeeGroup { id: string; name: T2; subgroups: { id: string; name: T2 }[] }
/** نوع غياب أو حضور كما هو معرَّف في النظام المرجعي (H4S4): مفتاحه تجميع منطقة الموظفين الفرعية (MOABW) ورمز النوع الفرعي (SUBTY) في نوع المعلومات 2001 للغياب و2002 للحضور؛ يُقرأ للعرض ولا يُنشأ في البوابة */
export interface ErpAbsenceType { grouping: string; subtype: string; kind: 'absence' | 'attendance'; name: T2; quotaType?: string; quotaName?: T2; unit: 'day' | 'hour' }
/** ربط نوع في البوابة بنوعه في النظام المرجعي: التجميع والرمز، لا الاسم */
export interface ErpLink { grouping: string; subtype: string }

export interface Person {
  id: string; empNo: string; name: string; nameEn: string; title: string; titleEn: string; unit: string; unitEn: string; initials: T2;
  persona: PersonaKey; managerId?: string; onLeaveToday?: boolean;
  /** مكتب ثابت في المسارات (توافق مع الإصدارات السابقة؛ الاستخراج الآن بالمنصب) */
  desk?: Desk;
  /** منصب الموظف في الهيكل التنظيمي (D-012) ومجموعته ومجموعته الفرعية (D-013) */
  positionId?: string; group?: string; subgroup?: string;
  /** صفات من النظام المرجعي تحكم الاستحقاق: الفئة الوظيفية، ومقر العمل، والعمل خارج الموطن، والجنس، والأبناء، وتاريخ التعيين، وبنود العقد */
  category?: 'official' | 'contract'; location?: 'riyadh' | 'abudhabi'; nationality?: string; outsideHome?: boolean; gender?: 'm' | 'f'; parent?: boolean; hiredAt?: number;
  /** بنود العقد كما في H4S4: استحقاق تذاكر الإجازة السنوية (بند العقد)، وغيره لاحقاً */
  contract?: { ticketsEntitled?: boolean; ticketsDays?: number; advanceSalary?: boolean };
}
export type StepStatus = 'pending' | 'current' | 'done' | 'returned' | 'rejected' | 'skipped';
export type StepMode = 'approve' | 'notify' | 'fulfil' | 'receipt' | 'system' | 'review' | 'input' | 'wait';
export interface StepDecision { actorId: string; action: 'approve' | 'return' | 'reject' | 'done'; at: number; note?: string; ref?: string; outcome?: string }
export interface Step {
  key: string; desk: Desk; title: T2; status: StepStatus; actorId?: string; at?: number; startedAt?: number; note?: string; notifyOnly?: boolean; slaHours?: number;
  /** v0.6: كيف استُخرج المعتمد، ومناصبه (تُعاد قراءة شاغليها عند الفتح)، ومن هم لحظة الفتح، والنصاب، وقرارات كل واحد، والسبب المقروء */
  mode?: StepMode; agent?: import('./policy').AgentRule; assigneeIds?: string[]; positionIds?: string[]; quorum?: 'any' | 'all' | 'majority'; decisions?: StepDecision[]; why?: T2;
  /** الشرط الذي طُبّقت به، والتصعيد، ومرجع التنفيذ، والاستحقاق المنفَّذ، وأوقات التذكير والتصعيد */
  when?: import('./policy').StepCondition; escalation?: import('./policy').Escalation; ref?: string; entitlementId?: string; remindedAt?: number; escalatedAt?: number;
  /** v0.9 (AS-01): دور الخطوة في رحلة الاحتياج، والمقطع الذي تنتمي إليه (يُتخطى إن لم تنشّطه نتيجة خطوة قرار سابقة)، ونتيجة خطوة القرار */
  role?: NeedRole; branch?: NeedBranch; outcome?: string;
  /** v0.12 (D-027): رقم الدفعة لخطوات الاستلام والتسليم المتكررة */
  batch?: number;
  /** v0.16 (CAP-02 خريطة الحالات §3 و§3-ب): معرّف خطوة المسار، ونموذج الخطوة كما التُقط لحظة التقديم، وما ملأه صاحبها وقائمة تحققه وتعديلاته على الطلب (قبل/بعد) والحقول التي طلب تصحيحها؛
      والشرط والاعتماد الآلي المؤجَّلان إلى لحظة الوصول (نتائج الخطوات السابقة)، والمجموعة المتوازية، وموعد الانتظار، والعقد وربطه */
  id?: string; form?: import('./policy').StepForm; values?: Record<string, string | string[] | boolean>; checks?: string[]; edits?: { field: string; label: T2; before: string; after: string }[]; returnFields?: string[]; majority?: boolean;
  cond?: import('./policy').Cond; auto?: import('./policy').Cond; group?: string; waitUntil?: string; wait?: { field?: string; days?: number }; contractId?: string; mapping?: Record<string, import('./policy').MapSource>;
}
export type ReqStatus = 'in_review' | 'returned' | 'rejected' | 'completed' | 'withdrawn';
export interface Field { key: string; label: T2; value: string;
  /** v0.15: القيمة بالإنجليزية إن اختلفت (خيارات القوائم وأسماء الهيكل) حتى يقرأ المعتمد بلغته */
  valueEn?: string }
/** v0.11: المرفق يحمل محطته في الرحلة (عرض مورّد، محضر مناقصات، مواصفات، توصية، استلام) حتى يجتمع ملف الشراء في مكان واحد */
/** v0.12 (P-13): المستند الصادر يحمل نوعه (يختار راسمه) ورمز نموذجه في مجموعة النماذج المطبوعة ومرجع سجله (المحضر أو السند) */
export type IssuedDocType = 'decision' | 'handover' | 'inspection' | 'serviceReceipt' | 'letter';
export interface Doc { id: string; kind: 'attachment' | 'issued'; title: T2; number?: string; at: number; stage?: T2; by?: string; type?: IssuedDocType; code?: string; refId?: string;
  /** v0.16: مستند خدمة مهيّأة بقالب — فقراته المدموجة بلغتين، ونوعه من المجموعة، وموقّعه، وصلاحيته، ونسخة إلى، ومعرّف المخرج الذي أصدره */
  body?: T2[]; docKind?: import('./policy').DocKind; signatory?: { name: T2; role: T2; at: number } | null; validUntil?: string; copyTo?: T2[]; outputId?: string }
export interface AuditEntry { at: number; who: string; what: T2 }
export interface LeaveInfo { typeId: string; from: string; to: string; days: number; workingDays: number; halfDay?: boolean; entitlements?: string[]; payBreakdown?: { pay: number; days: number }[];
  /** v0.7: طلب إلغاء لإجازة معتمدة (رقم الطلب الأصلي وسبب الإلغاء)، وعلى الأصل: أُلغيت */
  cancelOf?: string; cancelReason?: string; cancelled?: boolean }
/** تنفيذ استحقاق مرتبط (D-014): مهمة في صندوق الجهة المنفذة تُغلق بمرجع، أو إشعار فقط */
export interface Fulfilment { id: string; entitlementId: string; name: T2; mode: 'task' | 'notify'; assigneeIds: string[]; positionId?: string; status: 'pending' | 'done' | 'notified'; openedAt: number; dueAt?: number; at?: number; actorId?: string; ref?: string; note?: string; why?: T2 }
/* ——— v0.9 الاحتياج (AS-01): بنود بحالاتها، ومراحل الشراء بمراجعها من النظام المرجعي، وسند التسليم والاستلام، والعهدة ——— */
/** v0.10 (AS-01 2.0): فرع الشراء المنقّح — تجهيز الشراء (procurement) ← اعتماد الشراء بجدول الصلاحيات ← الموازنة: حجز الاعتماد ← [المناقصات] ← العروض ← التقييم ← [زيادة الحجز] ← اعتماد الترسية ← النظام: طلب الشراء آلياً ← أمر الشراء ← الاستلام ← التسليم */
export type NeedRole = 'coordinator' | 'chain' | 'entity' | 'store' | 'procurement' | 'purchaseApproval' | 'budget' | 'quotes' | 'evaluator' | 'budgetTopUp' | 'awardApproval' | 'tender' | 'pr' | 'po' | 'receipt' | 'receiptSign' | 'handover' | 'handoverSign';
/** المقاطع: المخزون / الشراء / المناقصات (طريقة الشراء مناقصة) / العروض (طريقة تحتاج عروضاً) / زيادة الحجز (العرض الفائز فوق المحجوز بأكثر من التسامح) / الترسية (ما لم يكن الشراء من عقد إطاري، وبالاستثناء إن كانت القاعدة كذلك D-024) / التوفير من رصيد الجهة الفنية (v0.11، D-023) */
export type NeedBranch = 'stock' | 'purchase' | 'tender' | 'quotes' | 'topUp' | 'award' | 'provided';
export type NeedLineStatus = 'open' | 'reserved' | 'issued' | 'purchasing' | 'received' | 'delivered' | 'cancelled' | 'provided';
/** البند: ما كتبه الطالب أو اختاره من كتالوج الاحتياجات (asked / catalogId)، وتحديد الصنف الذي تضعه الجهة الفنية أو المستودع (itemId أو بند نصي بمجموعة أصناف، والسعر التقديري للوحدة)؛ v0.11: البند الموفَّر من رصيد الجهة يحمل رصيده ومرجع التوفير */
export interface NeedLine { id: string; itemId?: string; name: T2; qty: number; unit: T2; status: NeedLineStatus; storeId?: string; reservationNo?: string; materialDocNo?: string; assetNo?: string; note?: string; catalogId?: string; asked?: T2; materialGroup?: string; unitPrice?: number; specifiedBy?: string; specifiedAt?: number; poolId?: string; provisionRef?: string;
  /** v0.12 (D-027): الكميات عبر الدفعات — المقبول تراكمياً من المورّد، والمسلَّم إلى المستفيد، والمرفوض، وما أُقفل من المتبقي بلا توريد */
  received?: number; handed?: number; rejected?: number; closed?: number }
/** v0.12 (D-026): بند في محضر الاستلام — المطلوب، والمستلَم سابقاً، والوارد الآن، والمقبول، والنتيجة */
export type ReceiptLineResult = 'ok' | 'note' | 'short' | 'rejected';
export interface NeedReceiptLine { lineId: string; ordered: number; before: number; delivered: number; accepted: number; result: ReceiptLineResult; note?: string }
/** محضر الاستلام (D-026): يولّده النظام من ملف الشراء ويكمله مسؤول الاستلام ويوقّعه (ومعه ممثل الجهة الطالبة وأخصائي المشتريات حين يلزم الفحص بلجنة)، ثم يصدر برقم ورمز تحقق ويُرحَّل الاستلام إلى النظام المرجعي ويعود رقمه */
export interface NeedReceipt {
  id: string; no?: string; kind: 'material' | 'service'; batch: number; at: number; by: string; status: 'signing' | 'issued';
  supplierNote?: { no?: string; date?: string }; attachment?: string; lines: NeedReceiptLine[]; result: 'ok' | 'note' | 'partial' | 'rejected'; notes?: string; remedyDays?: number;
  /** الخدمات: الفترة أو الدفعة وقيمتها ومعايير القبول بشاهدها، وهل هذا المحضر الأخير */
  period?: { from: string; to: string }; value?: number; criteria?: { text: string; evidence?: string; ok: boolean }[]; last?: boolean;
  /** الفحص بلجنة: من يوقّع، ومن وقّع فعلاً */
  committee?: boolean; signers: { personId: string; role: 'officer' | 'entity' | 'buyer' }[]; signatures: { personId: string; role: 'officer' | 'entity' | 'buyer'; at: number }[];
  /** ما عاد من النظام المرجعي عند الإصدار: مستند المادة (استلام) أو محضر استلام الخدمة، ومستند البوابة */
  erpNo?: string; erpAt?: number; docId?: string; issuedAt?: number;
  /** خطوة مسؤول الاستلام الأصلية (لتُنسخ للدفعة التالية بعد أن تتحول الخطوة إلى توقيع اللجنة) */
  officerStep?: { agent?: import('./policy').AgentRule; assigneeIds?: string[]; positionIds?: string[] };
}
/** العرض (v0.11): المورّد من قائمة شركاء الأعمال في النظام المرجعي (أو مورّد جديد يُنشأ فيه قبل أمر الشراء)، والعملة والمبلغ المعادل بالريال، والمرفق الإلزامي */
export interface NeedOffer { supplier: string; supplierId?: string; supplierNew?: boolean; amount: number; currency?: string; fxAmount?: number; validUntil?: string; note?: string; attachment?: string }
export interface NeedProcurement {
  /** تجهيز الشراء: التقدير النهائي وطريقة الشراء (بمفاتيحها التي يُقرأ بها المسار) والعقد الإطاري وملف الشراء المشترك (الدمج) والمقيّم */
  estimatedValue?: number; method?: string; methodName?: T2; methodFlags?: { offers: boolean; minOffers: number; tender: boolean; contract: boolean; higherBand: boolean }; methodWhy?: string; contractNo?: string; purchaseFile?: string; preparedAt?: number;
  evaluator?: { positionIds?: string[]; personIds: string[]; why: string; at: number };
  /** v0.11: تنبيه منع التجزئة (ق-08) لحظة التجهيز: احتياجات متشابهة من القطاع نفسه خلال نافذة الأيام يقترب مجموعها من شريحة أعلى */
  splitAlert?: { ids: string[]; total: number; days: number; band?: T2; at: number };
  /** v0.11 (D-024، D-025): سبب فتح اعتماد الترسية (انحرافات) أو اعتمادها آلياً، وتعذر الحد الأدنى للعروض بمبرر */
  awardWhy?: T2[]; awardAuto?: boolean; awardAutoAt?: number;
  /** اعتماد الشراء والترسية بجدول الصلاحيات: الشريحة التي حُلَّت بها الخطوة */
  band?: { id: string; name: T2; upTo: number | null }; awardBand?: { id: string; name: T2; upTo: number | null };
  /** الموازنة: حجز الاعتماد (مستند الأموال المخصّصة) وزياداته وتحريره عند الإلغاء */
  reservation?: { no: string; amount: number; at: number; topUps?: { at: number; from: number; to: number; no?: string }[]; released?: boolean; releasedAt?: number }; budgetRef?: string;
  /** العروض المسجَّلة، والتوصية (أو نتيجة المناقصات) بالمورّد والقيمة، والترسية */
  offers?: { count: number; at: number; note?: string; list?: NeedOffer[]; shortfall?: { min: number; why: string } }; recommendation?: { by: string; at: number; offer: string; amount?: number; note: string; attachment?: string }; award?: { supplier: string; amount: number; at: number; by?: string; supplierId?: string };
  tender?: { referred: boolean; ref?: string; result?: string; at?: number; supplier?: string; supplierId?: string; amount?: number; attachment?: string };
  /** v0.11: أمر التنفيذ على العقد الإطاري (أمر شراء يستهلك العقد) */
  releaseOrderNo?: string;
  /** v0.12 (D-026، D-027): محاضر الاستلام بدفعاتها، وإقفال المتبقي بلا توريد (مؤشر اكتمال التوريد على بند أمر الشراء) وما حُرِّر من الحجز */
  receipts?: NeedReceipt[]; deliveryCompleted?: { at: number; by: string; why: string; closedValue?: number; releasedAmount?: number };
  /** v0.12 (D-028): أرقام النظام المرجعي وصلت بالتكامل (محاكاة) لا بالكتابة */
  poSource?: 'erp' | 'manual';
  /** طلب الشراء يُنشئه النظام آلياً بعد الترسية (D-022) محرَّراً، ثم أمر الشراء والاستلام */
  prNo?: string; prAt?: number; prStatus?: 'released'; poNo?: string; poAt?: number; expectedAt?: string; expectedLog?: { at: number; from?: string; to: string; why: string }[]; receiptNo?: string; receiptAt?: number; serviceEntryNo?: string;
}
export interface NeedHandover { number?: string; startedBy?: string; startedAt?: number; signedBy?: string; signedAt?: number; issuerPositionId?: string; docId?: string;
  /** v0.12 (D-027): رقم الدفعة والبنود المسلَّمة فيها بكمياتها ومستندات صرفها */
  batch?: number; lines?: { lineId: string; qty: number; materialDocNo?: string; assetNo?: string; ref?: string }[] }
export interface NeedInfo {
  kind: 'material' | 'service'; categoryId: string; beneficiaryId: string; siteId: string; lines: NeedLine[]; justification: string; urgent?: boolean; estimatedValue?: number;
  /** عتبة المناقصات ونسبة التسامح اللتان قُيِّم بهما الطلب (من إصدار السياسة عند التقديم)، والقيمة الاسترشادية من الكتالوج؛ v0.11: قاعدة اعتماد الترسية (دائماً / بالاستثناء) ومصدر التوفر لحظة التقديم */
  tenderThreshold?: number; tolerancePct?: number; indicativeValue?: number; awardRule?: 'always' | 'exception'; availability?: NeedAvailability;
  /** الجهات المستخرجة عند التقديم (لعرض المسار المتوقع) */
  entityId?: string; storeId?: string; coordinatorStep?: boolean;
  procurement?: NeedProcurement; handover?: NeedHandover;
  /** v0.12: سجل السندات الصادرة (سند لكل دفعة تسليم)؛ `handover` هو الجاري أو الأخير */
  handovers?: NeedHandover[];
  /** v0.11 (D-023): وفّرت الجهة الفنية الاحتياج من رصيدها (مقاعد رخص، أو اشتراك، أو أمر تنفيذ على عقد إطاري) فلا مشتريات ولا موازنة */
  provision?: { by: string; at: number; note?: string; pools: { poolId: string; name: T2; qty: number; ref?: string; erpKind: PoolErpKind; releaseOrderNo?: string }[] };
  /** v0.11: تحويل الاحتياج إلى جهة فنية أخرى (تغيير الفئة) من داخل مهمة الجهة */
  rerouted?: { by: string; at: number; fromCategoryId: string; toCategoryId: string; note: string }[];
  /** الإلغاء بعد خطوة المشتريات: طلب وقرار */
  cancel?: { requestedAt: number; reason: string; decidedBy?: string; decidedAt?: number; accepted?: boolean; note?: string };
}
/** مصدر التوفر (v0.11، D-023): مستودع (موقع تخزين)، أو رصيد الجهة الفنية (مقاعد ورخص واشتراكات)، أو عقد إطاري قائم (أمر تنفيذ)، أو لا يوجد (يُشترى) */
export type NeedAvailability = 'store' | 'entity' | 'contract' | 'none';
/** كيف يُقيَّد رصيد الجهة في النظام المرجعي: مادة بمخزون (قياسي)، أو عقد كمية/قيمة باستهلاكه (قياسي)، أو سجل في البوابة وحدها (مخصص — لا كائن قياسي لتخصيص مقاعد الرخص) */
export type PoolErpKind = 'material' | 'contract' | 'portal';
/** سجل العهدة (D-019): قيد لكل صنف سُلِّم لموظف، مفتاحه رقم الموظف ورقم الصنف أو الأصل؛ v0.11: العهدة الرقمية (رخصة أو مقعد) بمرجعها */
export interface CustodyEntry { id: string; personId: string; requestId: string; lineId: string; name: T2; qty: number; itemId?: string; assetNo?: string; handoverNo: string; at: number; returnedAt?: number; ref?: string; digital?: boolean }
/** قوائم النظام المرجعي للاحتياج: المستودعات (مواقع التخزين)، والأصناف (السجل الرئيسي للصنف)، والمخزون بالمستودع؛ v0.11: شركاء الأعمال (المورّدون) والعقود الإطارية باستهلاكها، وأرصدة الجهات */
export interface ErpStorageLocation { id: string; name: T2; plant: string }
export interface ErpItem { id: string; name: T2; unit: T2; categoryHint: string; icon: string; custody: boolean; price?: number; specs?: T2 }
export interface ErpStock { itemId: string; storeId: string; qty: number }
export interface ErpSupplier { id: string; name: T2; city?: T2; blocked?: boolean }
export interface ErpContract { id: string; name: T2; supplierId: string; validTo: string; target: number; consumed: number; kind: 'value' | 'quantity'; unit?: T2 }
export interface PoolStock { poolId: string; qty: number }

export interface Request {
  id: string; serviceId: string; requesterId: string; createdAt: number; updatedAt: number; status: ReqStatus;
  steps: Step[]; fields: Field[]; docs: Doc[]; audit: AuditEntry[]; channel: 'app' | 'web';
  /** رقم إصدار السياسة الذي قُيّم به الطلب (D-009) وبيانات الإجازة إن كان طلب إجازة */
  policyVersion?: string; leave?: LeaveInfo;
  /** الخطوات التي لم تنطبق شروطها عند التقديم (للشفافية) وتنفيذ الاستحقاقات بعد الاكتمال */
  notApplied?: { title: T2; why: T2 }[]; fulfilments?: Fulfilment[];
  /** v0.7: طلب الإلغاء المرتبط بهذه الإجازة المعتمدة وحالته */
  cancellation?: { requestId: string; status: 'pending' | 'done' | 'rejected' | 'withdrawn' };
  /** v0.9: بيانات الاحتياج إن كان الطلب احتياجاً (AS-01) */
  need?: NeedInfo;
  /** v0.15 (CAP-02): الطلب على خدمة مهيّأة يلتقط اسمها ومخرجاتها لحظة تقديمه (D-009)، ومفتاح مستأجره (D-033)، وقيم النموذج الخام لإعادة عرضه، وسريّته؛ v0.16: ما أُصدر من مخرجاته، والتذكيرات المرسلة، والخدمة التالية المقترحة */
  title?: T2; tenant?: string; configured?: { serviceId: string; version: string; values: Record<string, string | string[] | boolean>; outputs: import('./policy').ServiceOutput[]; confidential?: boolean; hideRequester?: boolean; onBehalfOf?: string; reminded?: boolean; issued?: string[]; remindersSent?: string[]; followUp?: { serviceId: string; requestId?: string }; renewOf?: string };
}
/* ——— v0.16 (CAP-02 خريطة الحالات §4.8 و§6 و§8): السجلات المخصصة، وربط العقود، والمستأجرون ——— */
/** قيد في سجل مخصص: ما أصدره طلب مكتمل بأعمدته وتاريخ انتهائه وحالته؛ التجديد يربط القيد الجديد بالقديم */
export interface RegisterEntry { id: string; tenant: string; registerId: string; serviceId: string; requestId: string; personId: string; title: T2; values: Record<string, string>; issuedAt: number; expiresAt?: string; status: 'active' | 'expired' | 'renewed' | 'ended'; renewedBy?: string; reminded?: boolean; docNumber?: string }
export type Env = 'dev' | 'test' | 'prod';
/** ربط عقد بمستأجر وبيئة: الوجهة والنظام والعميل ومرجع الاعتماد (اسمه لا سرّه) والحالة؛ بالإضافة والإلغاء بتاريخ */
export interface ContractBinding { id: string; tenant: string; contractId: string; env: Env; destination: string; systemId: string; client: string; credentialRef: string; status: 'unbound' | 'bound' | 'tested'; testedAt?: number; testedBy?: string; note?: string; createdAt: number; by: string; endedAt?: string }
/** المستأجر: جهة تشغّل البوابة بمفتاحها وهويتها ونظامها المرجعي (مشترك مع الأمانة بعميل آخر، أو مستقل) وبيئاتها ومديريها ومصمّميها */
export interface Tenant { id: string; name: T2; short: T2; initials: T2; hue: Hue; status: 'onboarding' | 'active' | 'ended'; joinedAt: string; lang: 'ar' | 'en'; env: Env;
  erp: { mode: 'shared' | 'own'; systemId: string; client: string; envs: Record<Env, { host: string; status: 'unbound' | 'bound' | 'tested' }> };
  admins: string[]; designers: { positionId: string; domains: string[] | 'all' }[]; contact?: string; note?: string; createdAt: number; endedAt?: string }
/* ——— v0.13 «اليوم» (D-029…D-031): قصص القطاعات، والأخبار والتعاميم، وتأكيد الاطلاع، والتقويم — كائنات بوابة لا تمسّ النظام المرجعي ——— */
export type CoverArt = 'gems' | 'dunes' | 'arch' | 'star' | 'bokeh' | 'waves' | 'type' | 'grid';
export type Hue = 'green' | 'gold' | 'cream' | 'teal' | 'bronze' | 'night' | 'sage';
/** غلاف على الهوية (رسم إجرائي) حتى تأتي الصور الحقيقية من القطاعات */
export interface CoverSpec { art: CoverArt; hue: Hue; text?: string; seed?: number }
/** وسيطة اختارها الناشر من جهازه (تُحفظ في تخزين المتصفح بمعرّفها؛ في الإنتاج: مخزن ملفات البوابة) */
export interface StoryMedia { kind: 'image' | 'video'; id: string; w?: number; h?: number; durationMs?: number; size?: number; name?: string }
/** وسيطة منشور (v0.14): صورة أو فيديو بترتيبه في المعرض، ومصغّرة للفسيفساء، وإطار أول للفيديو، وتعليق ووصف للمكفوفين */
export interface PostMedia extends StoryMedia { thumbId?: string; posterId?: string; caption?: T2; alt?: T2 }
export interface StorySlide { id: string; cover: CoverSpec; caption: T2; sub?: T2; at: number; ms?: number; media?: StoryMedia }
/** قصة قطاع: مقاطع ينشرها منصب ناشر باسم القطاع، وتبقى مدة القصة (من سياسة الأخبار والقصص) */
export interface Story { id: string; sectorId: string; publisherId: string; slides: StorySlide[] }
export type PostKind = 'news' | 'circular' | 'event';
/** منشور: خبر أو تعميم أو فعالية باسم قطاع؛ التعميم قد يطلب تأكيد الاطلاع (D-031) بمهلة */
export interface Post {
  id: string; kind: PostKind; sectorId?: string; source: T2; title: T2; summary: T2; body: T2[]; cover: CoverSpec; at: number; readMin: number; publisherId?: string;
  requiresAck?: boolean; ackCount?: number; ackDue?: number; attachments?: { name: string; size: string }[]; link?: { label: T2; href: string }; eventAt?: number; place?: T2; number?: string;
  /** الوسائط (v0.14): صور وفيديو بترتيب الناشر؛ والغلاف أولها ما لم يُحدَّد غيره — والزخرفة تبقى غلافاً حين لا وسائط */
  media?: PostMedia[]; coverMediaId?: string;
  /** السحب (v0.13.1): المنشور لا يُحذف — يُسحب بسبب مكتوب، فيختفي من الشاشات ويبقى في سجل التأكيدات مختوماً بمن سحبه ومتى ولماذا */
  withdrawnAt?: number; withdrawnBy?: string; withdrawReason?: string;
}
export interface CalEvent { id: string; title: T2; at: number; kind: 'holiday' | 'event' | 'pay'; sub?: T2 }
/** ما يخص كل موظف من «اليوم»: آخر مقطع شاهده من كل قطاع، وتأكيدات اطلاعه بوقتها، وما أضافه إلى تقويمه، وما صرفه من «آخر ما حدث»؛ والتذكير المرسل لكل تعميم */
export interface CommsState { seen: Record<string, Record<string, string>>; acks: Record<string, Record<string, number>>; cal: Record<string, string[]>; dismissed: Record<string, string[]>; reminded: Record<string, number> }
export type NotifKind = 'task' | 'status' | 'document' | 'expiry' | 'reminder' | 'policy' | 'circular' | 'story';
export interface Notification { id: string; to: string; kind: NotifKind; at: number; title: T2; body: T2; link?: string; read: boolean }
export interface EmpDoc { id: string; title: T2; number: string; expiresAt: number; icon: 'passport' | 'id' | 'card' | 'licence' | 'contract' | 'insurance' }
export interface Payslip { id: string; month: T2; net: number; gross: number; deductions: number; issuedAt: number }
export interface Dependant { id: string; name: T2; relation: T2; docExpiresAt?: number }
export interface Balances { annual: number; sick: number; emergency: number; annualTotal: number }
export interface NotifPrefs { task: boolean; status: boolean; document: boolean; expiry: boolean; reminder: boolean; policy: boolean; circular?: boolean; story?: boolean }
/** v0.13: إطار الهاتف على الحاسوب أداة مراجعة للتصميم (تُفعَّل من الإعدادات على شاشة عريضة) */
export interface Settings { lang: 'ar' | 'en'; theme: 'auto' | 'light' | 'dark'; persona: PersonaKey; notifPrefs: NotifPrefs; actAs?: string; phoneFrame?: boolean; /** v0.17: حجم النص (لكل عين) */ textSize?: 'normal' | 'large' | 'xl' }
/** غياب مسجَّل في النظام المرجعي (تاريخ الإجازات السابقة) يُستخدم لحساب الدورات والشرائح */
export interface Absence { personId: string; typeId: string; from: string; to: string; days: number }
export interface State {
  version: number; settings: Settings; people: Person[]; requests: Request[]; notifications: Notification[];
  docs: Record<string, EmpDoc[]>; payslips: Record<string, Payslip[]>; dependants: Record<string, Dependant[]>; balances: Record<string, Balances>;
  absences: Absence[]; policy: import('./policy').PolicyState;
  /** v0.9: سياسة الاحتياج (سياسة واحدة لكل خدمة، P-11) بالنموذج نفسه، وسجل العهدة */
  needPolicy: import('./policy').PolicyState; custody: CustodyEntry[];
  /** الهيكل التنظيمي وفئات الموظفين: بيانات مرجعية من النظام المرجعي (للقراءة في البوابة) */
  org: { units: OrgUnit[]; positions: Position[] }; groups: EmployeeGroup[];
  /** بيانات مرجعية من النظام المرجعي للقراءة: أنواع الغياب والحضور بأرصدتها */
  erp: { absenceTypes: ErpAbsenceType[]; storageLocations: ErpStorageLocation[]; items: ErpItem[]; stock: ErpStock[]; suppliers?: ErpSupplier[]; contracts?: ErpContract[]; poolStock?: PoolStock[];
    /** v0.15: الموظفون السابقون (للطلب بالنيابة: شهادة الخدمة DC-02) — قراءة من النظام المرجعي */
    formerEmployees?: { id: string; empNo: string; name: T2; leftAt: string }[] };
  seq: number; nseq: number;
  /** v0.9: عدّاد أرقام النظام المرجعي التجريبية (الحجز، ومستند المادة، والأصل) مستقل عن أرقام الطلبات */
  erpSeq?: number;
  /** v0.13 «اليوم»: المنشورات والقصص والتقويم كائنات بوابة، وما يخص كل موظف منها، وسياسة الأخبار والقصص (سياسة ثالثة على آلة الإصدارات نفسها، P-11/P-12) */
  posts: Post[]; stories: Story[]; calendar: CalEvent[]; comms: CommsState; commsPolicy: import('./policy').PolicyState;
  /** v0.15 (CAP-02): مصمّم الخدمات سياسة رابعة على آلة الإصدارات نفسها، والمستأجر الذي تعمل به البوابة اليوم (D-033: واعٍ بالمستأجر، وتشغيل بمستأجر واحد) */
  designer: import('./policy').PolicyState; tenant: { id: string; name: T2 };
  /** v0.16: سجل المستأجرين، وربط العقود، والسجلات المخصصة */
  tenants: Tenant[]; contracts: { bindings: ContractBinding[] }; registers: RegisterEntry[];
}
