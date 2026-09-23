/* v0.16 البذرة الابتدائية لمصمّم الخدمات (CAP-02): أربع خدمات مهيّأة مثالاً تُظهر خريطة الحالات —
   DC-03 خطاب لجهة خارجية (من v0.15، بقالب مستند الآن)، وDC-01 خطاب تعريف (الاختبار الفاصل ق.ص-02: بيانات من ملف الموظف، وقالب دمج، ونموذج خطوة لشؤون الموظفين، وخدمة تالية)،
   وPR-07 طلب ضيافة (جدول ضيوف ومجموع محسوب، وخيارات قرار بحقل، وشريحة قيمة، ونموذج تنفيذ بمرجع، وإشعار مهيّأ)، وHA-09 تصريح دخول شخص خارجي (خطوتان متوازيتان بشرط، وسجل بتاريخ انتهاء وتنبيه وتجديد، وتذكير قبل البدء، وحدث تقويم).
   ومعها سجل المستأجرين (الأمانة العامة + جهة مثال قيد الانضمام) وربط العقود في بيئة التطوير. */
import type { T2, Tenant, ContractBinding } from '../domain/types';
import { TENANT_DEFAULT, toISO, type ConfiguredService, type PolicyContent, type PolicyState, type PolicyVersion, type Escalation } from '../domain/policy';

const t2 = (ar: string, en: string): T2 => ({ ar, en });
const DAY = 86400000;
const esc: Escalation = { remindAtPct: 80, after: 'notifyManager' };

export function seedServices(at: number): ConfiguredService[] {
  const dc03: ConfiguredService = {
    id: 'DC-03', tenant: TENANT_DEFAULT, kind: 'configured', source: 'catalog', domain: 'DC', icon: 'letter', tone: 'g-bronze',
    name: t2('خطاب لجهة خارجية', 'Letter to an external party'), description: t2('خطاب بصيغة معتمدة يُوجَّه إلى سفارة أو بنك أو جهة تعليمية، بلغة واحدة أو باللغتين، يعتمده مديرك وتُصدره شؤون الموظفين برمز تحقق.', 'A letter in an approved format addressed to an embassy, a bank or an educational institution, in one language or both; approved by your manager and issued by personnel affairs with a verification code.'),
    onBehalf: 'none', owner: { positionId: 'S-211' }, beforeYouStart: [t2('اسم الجهة كما تريده في الخطاب', 'The party name as you want it in the letter'), t2('مستند من الجهة إن كان عندها نموذج', "A document from the party if it has a form")],
    sections: [
      { id: 'sec-to', title: t2('الجهة الموجَّه إليها', 'Addressee'), fields: [
        { id: 'partyKind', kind: 'choice', label: t2('نوع الجهة', 'Kind of party'), source: 'manual', options: [{ id: 'embassy', name: t2('سفارة', 'Embassy') }, { id: 'bank', name: t2('بنك', 'Bank') }, { id: 'edu', name: t2('جهة تعليمية', 'Educational institution') }, { id: 'other', name: t2('جهة أخرى', 'Other') }], rules: { required: true }, inDoc: true },
        { id: 'partyName', kind: 'text', label: t2('اسم الجهة', 'Party name'), placeholder: t2('مثال: سفارة المملكة المتحدة', 'e.g. the UK Embassy'), rules: { required: true, minLen: 3, maxLen: 80 }, inDoc: true },
        { id: 'country', kind: 'choice', label: t2('الدولة', 'Country'), source: 'erp', erpList: 'countries', rules: { requiredIf: { field: 'partyKind', op: 'eq', value: 'embassy' }, showIf: { field: 'partyKind', op: 'eq', value: 'embassy' } }, inDoc: true },
      ] },
      { id: 'sec-what', title: t2('الخطاب', 'The letter'), fields: [
        { id: 'purpose', kind: 'textarea', label: t2('الغرض من الخطاب', 'Purpose of the letter'), hint: t2('سطر أو سطران يقولان لماذا تحتاجه الجهة', 'A line or two on why the party needs it'), rules: { required: true, minLen: 10, maxLen: 400 }, inDoc: true },
        { id: 'lang', kind: 'choice', label: t2('لغة الخطاب', 'Letter language'), source: 'manual', options: [{ id: 'ar', name: t2('العربية', 'Arabic') }, { id: 'en', name: t2('الإنجليزية', 'English') }, { id: 'both', name: t2('اللغتان', 'Both') }], rules: { required: true }, inDoc: true },
        { id: 'salary', kind: 'checkbox', label: t2('يذكر الراتب الأساسي', 'Mention the basic salary'), hint: t2('لا يُذكر الراتب إلا إن طلبتَه', 'The salary is mentioned only if you ask'), inDoc: true },
        { id: 'needBy', kind: 'date', label: t2('تحتاجه قبل', 'Needed by'), rules: { dateRel: 'todayOrFuture' } },
        { id: 'attach', kind: 'attachment', label: t2('مستند من الجهة (اختياري)', 'A document from the party (optional)'), rules: { maxFiles: 2, fileKinds: ['pdf', 'image'], maxMB: 8 } },
        { id: 'note', kind: 'guidance', label: t2('يصدر الخطاب على ورقة الأمانة الرسمية برقم ورمز تحقق، وتجده في طلبك جاهزاً للتحميل بعد إصداره.', 'The letter is issued on the official Secretariat sheet with a number and a verification code, and you find it in your request ready to download.') },
      ] },
    ],
    route: [
      { id: 'mgr', agent: { kind: 'lineManager' }, mode: 'approve', slaHours: 48, escalation: esc },
      { id: 'hr', agent: { kind: 'pool', unitId: 'O-211' }, mode: 'fulfil', slaHours: 72, escalation: esc, title: t2('إصدار الخطاب من شؤون الموظفين', 'Letter issued by personnel affairs') },
    ],
    outputs: [{ id: 'doc', kind: 'document', title: t2('خطاب لجهة خارجية', 'Letter to an external party'), prefix: 'DC', issueAt: 'end', template: { docKind: 'letter', signatory: { kind: 'position', positionId: 'S-211' }, paragraphs: [
      t2('إلى: {{f:partyName}}', 'To: {{f:partyName}}'),
      t2('تشهد الأمانة العامة لمجلس التعاون لدول الخليج العربية بأن السيد/ة {{p:name}} ({{p:empNo}}) يعمل لديها بوظيفة {{p:title}} في {{p:unit}} منذ {{p:hiredAt}}.', 'The General Secretariat of the Cooperation Council for the Arab States of the Gulf certifies that {{p:name}} ({{p:empNo}}) is employed as {{p:title}} in {{p:unit}} since {{p:hiredAt}}.'),
      t2('وقد أُعطي هذا الخطاب بناءً على طلبه للغرض التالي: {{f:purpose}}', 'This letter is given at the employee’s request for the following purpose: {{f:purpose}}'),
      t2('ولا تتحمل الأمانة العامة أي مسؤولية تجاه الغير بموجب هذا الخطاب.', 'The General Secretariat bears no liability towards third parties under this letter.'),
    ] } }],
    createdAt: at - 5 * DAY,
  };
  /* الاختبار الفاصل ق.ص-02: خطاب التعريف بلا سطر شيفرة — بيانات من ملف الموظف، وقالب دمج، ونموذج خطوة لشؤون الموظفين، وخدمة تالية مقترحة */
  const dc01: ConfiguredService = {
    id: 'DC-01', tenant: TENANT_DEFAULT, kind: 'configured', source: 'catalog', domain: 'DC', icon: 'idcard', tone: 'g-green',
    name: t2('خطاب تعريف', 'Employment letter'), description: t2('خطاب يعرّف بك وبوظيفتك وتاريخ تعيينك، بالراتب أو من دونه، لجهة تسمّيها؛ يُشعَر مديرك وتُصدره شؤون الموظفين خلال ثلاثة أيام عمل برمز تحقق.', 'A letter confirming your employment, position and hire date, with or without your salary, to a party you name; your manager is informed and personnel affairs issues it within three working days with a verification code.'),
    onBehalf: 'none', owner: { positionId: 'S-211' }, limit: { count: 1, per: 'open' }, beforeYouStart: [t2('اسم الجهة التي تريد الخطاب لها', 'The party the letter is for'), t2('هل تريد ذكر الراتب؟ (يُقرأ من النظام المرجعي عند الإصدار)', 'Do you want the salary mentioned? (read from the system of record at issue)')],
    sections: [
      { id: 'me', title: t2('بياناتي كما في النظام المرجعي', 'My data as in the system of record'), hint: t2('تُقرأ من ملفك ولا تُكتب؛ إن كان فيها خطأ فصحّحه من «تحديث بياناتي»', 'Read from your record, not typed; if something is wrong fix it from “Update my data”'), fields: [
        { id: 'pName', kind: 'profile', profileKey: 'name', label: t2('الاسم', 'Name'), inDoc: true },
        { id: 'pNo', kind: 'profile', profileKey: 'empNo', label: t2('الرقم الوظيفي', 'Employee number'), inDoc: true },
        { id: 'pTitle', kind: 'profile', profileKey: 'title', label: t2('الوظيفة', 'Position'), inDoc: true },
        { id: 'pUnit', kind: 'profile', profileKey: 'unit', label: t2('الوحدة', 'Unit'), inDoc: true },
        { id: 'pHired', kind: 'profile', profileKey: 'hiredAt', label: t2('تاريخ التعيين', 'Hire date'), inDoc: true },
      ] },
      { id: 'to', title: t2('الخطاب', 'The letter'), fields: [
        { id: 'addressee', kind: 'text', label: t2('الجهة الموجَّه إليها', 'Addressee'), placeholder: t2('مثال: بنك الرياض', 'e.g. Riyad Bank'), rules: { required: true, minLen: 3, maxLen: 80 }, inDoc: true },
        { id: 'purpose', kind: 'choice', label: t2('الغرض', 'Purpose'), source: 'manual', options: [{ id: 'bank', name: t2('تمويل أو حساب بنكي', 'Bank financing or account') }, { id: 'embassy', name: t2('تأشيرة', 'Visa') }, { id: 'rent', name: t2('عقد إيجار', 'Tenancy contract') }, { id: 'other', name: t2('غرض آخر', 'Another purpose') }], rules: { required: true }, inDoc: true },
        { id: 'purposeOther', kind: 'text', label: t2('اذكر الغرض', 'State the purpose'), rules: { showIf: { field: 'purpose', op: 'eq', value: 'other' }, requiredIf: { field: 'purpose', op: 'eq', value: 'other' }, maxLen: 120 }, inDoc: true },
        { id: 'lang', kind: 'choice', label: t2('لغة الخطاب', 'Letter language'), source: 'manual', options: [{ id: 'ar', name: t2('العربية', 'Arabic') }, { id: 'en', name: t2('الإنجليزية', 'English') }], rules: { required: true }, default: { kind: 'static', value: 'ar' }, inDoc: true },
        { id: 'salary', kind: 'yesno', label: t2('يُذكر الراتب الأساسي؟', 'Mention the basic salary?'), rules: { required: true }, default: { kind: 'static', value: 'no' }, inDoc: true },
        { id: 'pSalary', kind: 'profile', profileKey: 'basicSalary', label: t2('الراتب الأساسي (من النظام المرجعي)', 'Basic salary (from the system of record)'), rules: { showIf: { field: 'salary', op: 'eq', value: 'yes' } }, inDoc: true },
        { id: 'needBy', kind: 'date', label: t2('تحتاجه قبل', 'Needed by'), rules: { dateRel: 'todayOrFuture' } },
      ] },
    ],
    declaration: t2('أقرّ بأن الخطاب لاستعمالي الشخصي لدى الجهة المذكورة.', 'I confirm the letter is for my own use with the party named.'),
    route: [
      { id: 'mgr', agent: { kind: 'lineManager' }, mode: 'notify', slaHours: 0 },
      { id: 'hr', agent: { kind: 'pool', unitId: 'O-211' }, mode: 'fulfil', slaHours: 72, escalation: esc, title: t2('إصدار الخطاب من شؤون الموظفين', 'Letter issued by personnel affairs'),
        form: { guidance: t2('تحقق من مطابقة الوظيفة والوحدة لآخر إجراء موظف، ثم أصدر الخطاب؛ الرقم المرجعي في الصادر اختياري', 'Check the position and unit against the latest personnel action, then issue; the outgoing reference is optional'), checks: [{ id: 'c1', text: t2('طابقت الوظيفة والوحدة بآخر إجراء موظف', 'Position and unit match the latest personnel action') }], fields: [{ id: 'outRef', kind: 'text', label: t2('رقم الصادر (اختياري)', 'Outgoing reference (optional)'), rules: { maxLen: 30 } }], allowed: ['approve', 'return'] } },
    ],
    outputs: [
      { id: 'doc', kind: 'document', title: t2('خطاب تعريف', 'Employment letter'), prefix: 'EL', issueAt: 'end', template: { docKind: 'letter', signatory: { kind: 'position', positionId: 'S-211' }, validity: { days: 90 }, copyTo: [t2('ملف الموظف', 'Employee file')], paragraphs: [
        t2('إلى: {{f:addressee}}', 'To: {{f:addressee}}'),
        t2('تشهد الأمانة العامة لمجلس التعاون لدول الخليج العربية بأن السيد/ة {{p:name}}، الرقم الوظيفي {{p:empNo}}، يعمل لديها بوظيفة {{p:title}} في {{p:unit}} اعتباراً من {{p:hiredAt}}، وما زال على رأس العمل حتى تاريخه.', 'The General Secretariat of the Cooperation Council for the Arab States of the Gulf certifies that {{p:name}}, employee number {{p:empNo}}, is employed as {{p:title}} in {{p:unit}} since {{p:hiredAt}} and remains in service to date.'),
        t2('الراتب الأساسي: {{f:pSalary}}', 'Basic salary: {{f:pSalary}}'),
        t2('وقد أُعطي هذا الخطاب بناءً على طلبه لتقديمه إلى الجهة المذكورة ({{f:purpose}}{{f:purposeOther}})، دون أدنى مسؤولية على الأمانة العامة تجاه الغير.', 'This letter is given at the employee’s request for presentation to the party named ({{f:purpose}}{{f:purposeOther}}), without any liability on the General Secretariat towards third parties.'),
      ] } },
      { id: 'next', kind: 'followUp', serviceId: 'DC-03', mode: 'suggest', title: t2('خطاب لجهة خارجية', 'Letter to an external party') },
    ],
    notifications: [{ id: 'n1', when: 'completed', to: 'lineManager', title: t2('صدر خطاب تعريف لـ{{r:requester}}', 'Employment letter issued for {{r:requester}}'), body: t2('الطلب {{r:number}} · الجهة: {{f:addressee}}', 'Request {{r:number}} · addressee: {{f:addressee}}') }],
    createdAt: at - 2 * DAY,
  };
  /* PR-07 الضيافة: خيارات قرار بحقل، وشريحة قيمة، وجدول ومجموع، ونموذج تنفيذ */
  const pr07: ConfiguredService = {
    id: 'PR-07', tenant: TENANT_DEFAULT, kind: 'configured', source: 'catalog', domain: 'PR', icon: 'sparkle', tone: 'g-gold',
    name: t2('طلب ضيافة', 'Hospitality request'), description: t2('ضيافة لوفد أو ضيوف: عدد الضيوف وتواريخهم ودرجة الضيافة والتكلفة التقديرية؛ يعتمدها مديرك ثم صاحب الصلاحية بحسب القيمة، وتنفّذها المشتريات بمرجع الحجز.', 'Hospitality for a delegation or guests: guests, dates, class and estimated cost; approved by your manager then by the authority for the value, and executed by procurement with the booking reference.'),
    onBehalf: 'team', owner: { positionId: 'S-1301' }, paged: true,
    sections: [
      { id: 'who', title: t2('الضيوف', 'Guests'), fields: [
        { id: 'occasion', kind: 'text', label: t2('المناسبة', 'Occasion'), placeholder: t2('مثال: زيارة وفد اللجنة الفنية', 'e.g. technical committee delegation visit'), rules: { required: true, minLen: 5, maxLen: 120 }, inDoc: true },
        { id: 'guests', kind: 'table', label: t2('قائمة الضيوف', 'Guest list'), maxRows: 20, minRows: 1, rules: { required: true }, columns: [{ id: 'name', kind: 'text', label: t2('الاسم', 'Name'), required: true }, { id: 'org', kind: 'text', label: t2('الجهة', 'Organisation'), required: true }, { id: 'nights', kind: 'number', label: t2('الليالي', 'Nights'), required: true }] },
        { id: 'count', kind: 'computed', label: t2('عدد الضيوف', 'Number of guests'), formula: { op: 'count', fields: ['guests'] } },
      ] },
      { id: 'when', title: t2('الموعد والدرجة', 'Dates and class'), fields: [
        { id: 'dates', kind: 'daterange', label: t2('من – إلى', 'From – to'), rules: { required: true, dateRel: 'todayOrFuture', maxDays: 14 } },
        { id: 'klass', kind: 'choice', label: t2('درجة الضيافة', 'Hospitality class'), source: 'manual', options: [{ id: 'std', name: t2('عادية', 'Standard') }, { id: 'vip', name: t2('كبار الشخصيات', 'VIP') }], rules: { required: true }, default: { kind: 'static', value: 'std' } },
        { id: 'estCost', kind: 'money', label: t2('التكلفة التقديرية', 'Estimated cost'), currency: 'SAR', decimals: 0, rules: { required: true, min: 100, max: 500000 } },
        { id: 'perGuest', kind: 'computed', label: t2('التكلفة لكل ضيف (تقديري)', 'Cost per guest (estimate)'), formula: { op: 'divide', fields: ['estCost', 'count'] } },
        { id: 'notes', kind: 'textarea', label: t2('ملاحظات', 'Notes'), rules: { maxLen: 300 } },
      ] },
    ],
    route: [
      { id: 'mgr', agent: { kind: 'lineManager' }, mode: 'approve', slaHours: 48, escalation: esc, title: t2('اعتماد المدير المباشر', 'Line manager approval'),
        form: { outcomes: [{ id: 'full', name: t2('موافقة كما طُلب', 'Approve as requested'), effect: 'approve', tone: 'ok' }, { id: 'lower', name: t2('موافقة بدرجة أقل', 'Approve at a lower class'), effect: 'approve', tone: 'warn' }, { id: 'no', name: t2('رفض', 'Reject'), effect: 'reject', tone: 'danger' }],
          fields: [{ id: 'approvedClass', kind: 'choice', label: t2('الدرجة المعتمدة', 'Approved class'), source: 'manual', options: [{ id: 'std', name: t2('عادية', 'Standard') }, { id: 'vip', name: t2('كبار الشخصيات', 'VIP') }], rules: { showIf: { field: '__outcome', op: 'eq', value: 'lower' }, requiredIf: { field: '__outcome', op: 'eq', value: 'lower' } } }],
          editable: ['estCost'], checks: [{ id: 'c1', text: t2('المناسبة ضمن خطة الإدارة أو بتكليف', "The occasion is in the department's plan or by assignment") }], noteRequired: false, reasons: [{ id: 'budget', name: t2('لا اعتماد كافٍ', 'Insufficient budget') }, { id: 'timing', name: t2('توقيت غير مناسب', 'Bad timing') }] } },
      { id: 'auth', agent: { kind: 'band', amountField: 'estCost', bands: [{ upTo: 5000, agent: { kind: 'orgHead', level: 'department' } }, { upTo: 50000, agent: { kind: 'orgHead', level: 'ga' } }, { upTo: null, agent: { kind: 'orgHead', level: 'sector' } }] }, mode: 'approve', slaHours: 48, escalation: esc, title: t2('اعتماد صاحب الصلاحية بحسب القيمة', 'Authority approval by value'), auto: { field: 'estCost', op: 'lt', value: '1000' } },
      { id: 'proc', agent: { kind: 'pool', unitId: 'O-130' }, mode: 'fulfil', slaHours: 96, escalation: esc, title: t2('تنفيذ المشتريات: الحجز', 'Procurement: booking'),
        form: { fields: [{ id: 'venue', kind: 'text', label: t2('الفندق أو المكان', 'Hotel or venue'), rules: { required: true, maxLen: 80 } }, { id: 'actual', kind: 'money', label: t2('التكلفة الفعلية', 'Actual cost'), currency: 'SAR', decimals: 0, rules: { required: true, min: 0 } }, { id: 'conf', kind: 'attachment', label: t2('تأكيد الحجز', 'Booking confirmation'), rules: { maxFiles: 1, fileKinds: ['pdf', 'image'], maxMB: 8 } }] } },
    ],
    outputs: [{ id: 'cal', kind: 'calendar', title: t2('ضيافة', 'Hospitality'), dateField: 'dates' }],
    notifications: [{ id: 'n1', when: 'completed', to: 'requester', title: t2('حُجزت الضيافة: {{s:proc.venue}}', 'Hospitality booked: {{s:proc.venue}}'), body: t2('التكلفة الفعلية {{s:proc.actual}} · الدرجة المعتمدة {{s:mgr.approvedClass}} · الطلب {{r:number}}', 'Actual cost {{s:proc.actual}} · approved class {{s:mgr.approvedClass}} · request {{r:number}}') }],
    reminders: [{ id: 'r1', field: 'dates', daysBefore: 2, to: 'requester', text: t2('ضيافتك بعد يومين: {{f:occasion}}', 'Your hospitality is in two days: {{f:occasion}}') }],
    createdAt: at - 2 * DAY,
  };
  /* HA-09 تصريح دخول: خطوتان متوازيتان (الخدمات العامة والتقنية بشرط)، وسجل بتاريخ انتهاء وتنبيه وتجديد بالخدمة نفسها، وتذكير قبل البدء */
  const ha09: ConfiguredService = {
    id: 'HA-09', tenant: TENANT_DEFAULT, kind: 'configured', source: 'catalog', domain: 'HA', icon: 'shield', tone: 'g-teal',
    name: t2('تصريح دخول شخص خارجي', 'External person access permit'), description: t2('تصريح دخول ومكتب لمتعاون أو زائر طويل الأمد بمدة محددة، وبطاقة من الخدمات العامة، وحساب تقني إن لزم؛ يُسجَّل في سجل التصاريح ويُنبَّه قبل انتهائه.', 'An access permit and a desk for a contractor or long-term visitor for a set period, a badge from general services and an IT account if needed; recorded in the permits register with a reminder before expiry.'),
    onBehalf: 'none', owner: { positionId: 'S-150' }, limit: { count: 5, per: 'year' },
    sections: [
      { id: 'person', title: t2('الشخص', 'The person'), fields: [
        { id: 'fullName', kind: 'text', label: t2('الاسم الكامل', 'Full name'), rules: { required: true, minLen: 5, maxLen: 80 } },
        { id: 'idNo', kind: 'text', label: t2('رقم الهوية أو الجواز', 'ID or passport number'), rules: { required: true, minLen: 6, maxLen: 20, unique: true } },
        { id: 'company', kind: 'text', label: t2('الجهة', 'Organisation'), rules: { required: true, maxLen: 80 } },
        { id: 'role', kind: 'choice', label: t2('الصفة', 'Role'), source: 'manual', options: [{ id: 'contractor', name: t2('متعاون', 'Contractor') }, { id: 'consultant', name: t2('مستشار', 'Consultant') }, { id: 'visitor', name: t2('زائر', 'Visitor') }], rules: { required: true } },
        { id: 'idCopy', kind: 'attachment', label: t2('صورة الهوية', 'ID copy'), rules: { required: true, maxFiles: 1, fileKinds: ['pdf', 'image'], maxMB: 8 } },
      ] },
      { id: 'access', title: t2('الدخول', 'Access'), fields: [
        { id: 'period', kind: 'daterange', label: t2('مدة التصريح', 'Permit period'), rules: { required: true, dateRel: 'todayOrFuture', maxDays: 180 } },
        { id: 'areas', kind: 'multichoice', label: t2('المناطق', 'Areas'), source: 'manual', options: [{ id: 'main', name: t2('المبنى الرئيس', 'Main building') }, { id: 'it', name: t2('مركز البيانات', 'Data centre') }, { id: 'store', name: t2('المستودعات', 'Stores') }], rules: { required: true } },
        { id: 'needAccount', kind: 'yesno', label: t2('يحتاج حساباً تقنياً؟', 'Needs an IT account?'), rules: { required: true }, default: { kind: 'static', value: 'no' } },
        { id: 'host', kind: 'person', label: t2('الموظف المسؤول عنه', 'Responsible employee'), orgFilter: 'sector', rules: { required: true }, default: { kind: 'me' } },
        { id: 'sign', kind: 'signature', label: t2('أوقّع بمسؤوليتي عن الشخص مدة التصريح', 'I sign as responsible for the person during the permit') , rules: { required: true } },
      ] },
    ],
    route: [
      { id: 'mgr', agent: { kind: 'orgHead', level: 'department' }, mode: 'approve', slaHours: 48, escalation: esc, form: { hidden: ['idNo'] } },
      { id: 'gs', group: 'g1', agent: { kind: 'pool', unitId: 'O-150' }, mode: 'fulfil', slaHours: 48, escalation: esc, title: t2('الخدمات العامة: البطاقة والمكتب', 'General services: badge and desk'), form: { fields: [{ id: 'badge', kind: 'text', label: t2('رقم البطاقة', 'Badge number'), rules: { required: true, maxLen: 12 } }, { id: 'desk', kind: 'text', label: t2('المكتب', 'Desk'), rules: { maxLen: 20 } }] } },
      { id: 'it', group: 'g1', agent: { kind: 'pool', unitId: 'O-140' }, mode: 'fulfil', slaHours: 48, escalation: esc, title: t2('تقنية المعلومات: الحساب', 'IT: the account'), cond: { field: 'needAccount', op: 'eq', value: 'yes' }, form: { fields: [{ id: 'account', kind: 'text', label: t2('اسم الحساب', 'Account name'), rules: { required: true, maxLen: 30 } }] } },
    ],
    outputs: [
      { id: 'reg', kind: 'register', registerId: 'permits', title: t2('سجل تصاريح الدخول', 'Access permits register'), columns: ['fullName', 'company', 'role', 'areas', 'host'], expiryField: 'period', remindDays: 14, renewService: 'HA-09' },
      { id: 'doc', kind: 'document', title: t2('تصريح دخول', 'Access permit'), prefix: 'AP', issueAt: 'end', template: { docKind: 'permit', signatory: { kind: 'position', positionId: 'S-150' }, validity: { field: 'period' }, paragraphs: [t2('يُصرَّح للسيد/ة {{f:fullName}} ({{f:company}} — {{f:role}}) بدخول مباني الأمانة العامة في المناطق: {{f:areas}}، خلال المدة {{f:period}}، تحت مسؤولية {{f:host}}.', '{{f:fullName}} ({{f:company}} — {{f:role}}) is permitted to enter the General Secretariat premises in: {{f:areas}}, during {{f:period}}, under the responsibility of {{f:host}}.'), t2('رقم البطاقة: {{s:gs.badge}} · المكتب: {{s:gs.desk}} · الحساب التقني: {{s:it.account}}', 'Badge: {{s:gs.badge}} · desk: {{s:gs.desk}} · IT account: {{s:it.account}}')] } },
    ],
    reminders: [{ id: 'r1', field: 'period', daysBefore: 1, to: 'requester', text: t2('يبدأ تصريح {{f:fullName}} غداً', "{{f:fullName}}'s permit starts tomorrow") }],
    notifications: [{ id: 'n1', when: 'completed', to: 'field', fieldId: 'host', title: t2('صدر تصريح دخول لـ{{f:fullName}}', 'Access permit issued for {{f:fullName}}'), body: t2('أنت المسؤول عنه خلال {{f:period}} · الطلب {{r:number}}', 'You are responsible during {{f:period}} · request {{r:number}}') }],
    createdAt: at - 2 * DAY,
  };
  return [dc03, dc01, pr07, ha09];
}

/** الإصدار الابتدائي لسياسة المصمّم: 2026.1 من 15 سبتمبر (DC-03)، و2026.2 من اليوم (DC-01 وPR-07 وHA-09 بخريطة الحالات) */
export function seedDesignerPolicy(at: number): PolicyState {
  const all = seedServices(at); const dc03 = all[0];
  const base = { types: [], routes: [], entitlements: [], calendar: { weekend: { riyadh: [5, 6], abudhabi: [6, 0] }, holidays: [] }, warnings: { tierPct: 80, tierDays: 5 } } as Omit<PolicyContent, 'designer'>;
  const c1: PolicyContent = { ...base, designer: { services: [{ ...dc03, outputs: [{ ...dc03.outputs[0], template: undefined }] }] } };
  const c2: PolicyContent = { ...base, designer: { services: all } };
  const v1: PolicyVersion = { id: 'V-1', number: '2026.1', from: '2026-09-15', scheduled: true, createdBy: 'P-OMAR', createdAt: at - 5 * DAY, reason: 'الإصدار الابتدائي لمصمّم الخدمات: خدمة مهيّأة واحدة مثالاً (DC-03 خطاب لجهة خارجية) من الجرد ق.ص-01', reference: 'بطاقة القدرة CAP-02 · 1.1', content: c1, changes: [], notifiedScheduled: true, notifiedActive: true, scope: { kind: 'all' } };
  const v2: PolicyVersion = { id: 'V-2', number: '2026.2', from: toISO(at - 1 * DAY), scheduled: true, createdBy: 'P-OMAR', createdAt: at - 2 * DAY, reason: 'خريطة الحالات الكاملة (CAP-02 §3-ب): خطاب التعريف من المصمّم (ق.ص-02)، وطلب الضيافة بخيارات القرار وشرائح القيمة، وتصريح الدخول بالخطوات المتوازية والسجل؛ وقالب مستند لخطاب الجهة الخارجية', reference: 'بطاقة القدرة CAP-02 · 2.0', content: c2, changes: [], baseId: 'V-1', notifiedScheduled: true, notifiedActive: true, scope: { kind: 'all' } };
  return { versions: [v1, v2], governance: { secondApprover: false, approverPositionId: 'S-100' }, windows: {}, groups: {}, opsLog: [] };
}

/* ——— المستأجرون (D-033): الأمانة العامة سارية، وجهة مثال قيد الانضمام بلا موظفين حتى يُربط نظامها ——— */
export function seedTenants(at: number): Tenant[] {
  return [
    { id: TENANT_DEFAULT, name: t2('الأمانة العامة لمجلس التعاون', 'GCC General Secretariat'), short: t2('الأمانة العامة', 'General Secretariat'), initials: t2('أ', 'GS'), hue: 'green', status: 'active', joinedAt: '2026-09-16', lang: 'ar', env: 'dev',
      erp: { mode: 'own', systemId: 'H4S', client: '100', envs: { dev: { host: 'h4sdev.gcc-sg.local', status: 'tested' }, test: { host: 'h4sqas.gcc-sg.local', status: 'bound' }, prod: { host: '', status: 'unbound' } } }, admins: ['S-112'], designers: [{ positionId: 'S-211', domains: ['DC', 'HA', 'MD'] }], contact: 'P-OMAR', createdAt: at - 4 * DAY },
    { id: 'GCC-X', name: t2('الجهة الثانية (مثال للانضمام)', 'Second entity (onboarding example)'), short: t2('الجهة الثانية', 'Second entity'), initials: t2('ج', 'SE'), hue: 'teal', status: 'onboarding', joinedAt: toISO(at), lang: 'ar', env: 'dev',
      erp: { mode: 'shared', systemId: 'H4S', client: '200', envs: { dev: { host: 'h4sdev.gcc-sg.local', status: 'unbound' }, test: { host: '', status: 'unbound' }, prod: { host: '', status: 'unbound' } } }, admins: [], designers: [], note: 'مثال يوضح شاشة الانضمام: يُستبدل باسم الجهة الأولى المنضمّة وبياناتها؛ موظفوها وهيكلها يُقرآن من نظامها المرجعي عند الربط', createdAt: at },
  ];
}
/* ——— ربط العقود: بيئة التطوير للأمانة مربوطة (قراءة الموظف والراتب والغياب والبريد والأرشفة)، وما عداها غير مربوط ليُظهر فحص السلامة أثره ——— */
export function seedBindings(at: number): ContractBinding[] {
  const b = (id: string, contractId: string, status: ContractBinding['status'], destination: string): ContractBinding => ({ id, tenant: TENANT_DEFAULT, contractId, env: 'dev', destination, systemId: 'H4S', client: '100', credentialRef: 'BTP-DEST-H4S-DEV', status, testedAt: status === 'tested' ? at - 3 * DAY : undefined, testedBy: status === 'tested' ? 'P-OMAR' : undefined, createdAt: at - 4 * DAY, by: 'P-OMAR' });
  return [b('CB-1', 'hr.employeeRead', 'tested', 'H4S_DEV_ODATA'), b('CB-2', 'hr.salaryRead', 'tested', 'H4S_DEV_ODATA'), b('CB-3', 'hr.absencePost', 'tested', 'H4S_DEV_ODATA'), b('CB-4', 'mail.external', 'bound', 'MAIL_DEV'), b('CB-5', 'dms.archive', 'bound', 'DMS_DEV'), b('CB-6', 'hr.timeEventFix', 'bound', 'H4S_DEV_ODATA')];
}
