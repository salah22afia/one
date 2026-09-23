// بيانات تجريبية: هيكل تنظيمي (وحدات ومناصب وشاغلون وشاغر وإنابة) كما يصل من النظام المرجعي، وأشخاص وهميون، وطلبات مبنية بالمحرك نفسه (لا حالات مصطنعة)
import type { State, Person, Field, OrgUnit, Position, EmployeeGroup, ErpAbsenceType, ErpStorageLocation, ErpItem, ErpStock, ErpSupplier, ErpContract, PoolStock } from '../domain/types';
import { createRequest, decide, expiryNotification, policyActiveNotification, leaveSteps } from '../domain/engine';
import { seedPolicy, seedNeedPolicy, seedCommsPolicy, TENANT_DEFAULT, activeVersion, evaluateLeave, toISO, fromISO } from '../domain/policy';
import { seedDesignerPolicy, seedTenants, seedBindings } from './designerSeed';
import { seedPosts, seedStories, seedCalendar } from './commsSeed';
import { circularNotification, commsTick } from '../domain/comms';
import { createNeed, storeDecision, specifyDecision, procurementDecision, quotesDecision, evaluationDecision, budgetDecision, poDecision, handoverStart, handoverSign, provideDecision, receiptStart } from '../domain/need';

const DAY = 86400000, H = 3600000;
export const STATE_VERSION = 20;
const t2 = (ar: string, en: string) => ({ ar, en });

/* ——— مجموعات الموظفين ومجموعاتها الفرعية (التعيين التنظيمي في H4S4، للقراءة) ——— */
const GROUPS: EmployeeGroup[] = [
  { id: '1', name: t2('موظف رسمي', 'Official employee'), subgroups: [{ id: '11', name: t2('رسمي · إداري', 'Official · administrative') }, { id: '12', name: t2('رسمي · تخصصي', 'Official · specialist') }] },
  { id: '2', name: t2('متعاقد', 'Contract employee'), subgroups: [{ id: '21', name: t2('متعاقد · محلي', 'Contract · local') }, { id: '22', name: t2('متعاقد · دولي', 'Contract · international') }] },
];

/* ——— أنواع الغياب والحضور في النظام المرجعي (H4S4، تجميع 01؛ رموز تجريبية بصيغة SAP الرباعية): تُقرأ للعرض والربط ولا تُنشأ في البوابة ——— */
const ERP_ABSENCE_TYPES: ErpAbsenceType[] = [
  { grouping: '01', subtype: '0100', kind: 'absence', name: t2('إجازة سنوية', 'Annual leave'), quotaType: '10', quotaName: t2('رصيد الإجازة السنوية', 'Annual leave quota'), unit: 'day' },
  { grouping: '01', subtype: '0110', kind: 'absence', name: t2('إجازة اضطرارية', 'Emergency leave'), quotaType: '11', quotaName: t2('رصيد الإجازة الاضطرارية', 'Emergency leave quota'), unit: 'day' },
  { grouping: '01', subtype: '0200', kind: 'absence', name: t2('إجازة مرضية', 'Sick leave'), unit: 'day' },
  { grouping: '01', subtype: '0210', kind: 'absence', name: t2('مرافقة مريض داخل المدينة', 'Patient escort (inside)'), unit: 'day' },
  { grouping: '01', subtype: '0220', kind: 'absence', name: t2('مرافقة مريض خارج المدينة', 'Patient escort (abroad)'), unit: 'day' },
  { grouping: '01', subtype: '0300', kind: 'absence', name: t2('إجازة اختبارات', 'Exam leave'), unit: 'day' },
  { grouping: '01', subtype: '0310', kind: 'absence', name: t2('كونوا معهم (نصف يوم)', 'Be with them (half day)'), unit: 'day' },
  { grouping: '01', subtype: '0400', kind: 'absence', name: t2('إجازة حج', 'Hajj leave'), unit: 'day' },
  { grouping: '01', subtype: '0410', kind: 'absence', name: t2('إجازة زواج', 'Marriage leave'), unit: 'day' },
  { grouping: '01', subtype: '0420', kind: 'absence', name: t2('إجازة أمومة', 'Maternity leave'), unit: 'day' },
  { grouping: '01', subtype: '0430', kind: 'absence', name: t2('إجازة عدة', 'Iddah leave'), unit: 'day' },
  { grouping: '01', subtype: '0440', kind: 'absence', name: t2('إجازة وفاة', 'Bereavement leave'), unit: 'day' },
  { grouping: '01', subtype: '0500', kind: 'absence', name: t2('إجازة استثنائية بلا راتب', 'Exceptional unpaid leave'), unit: 'day' },
  { grouping: '01', subtype: '0530', kind: 'absence', name: t2('إجازة دراسية', 'Study leave'), unit: 'day' },
  { grouping: '01', subtype: '0600', kind: 'absence', name: t2('غياب بلا إذن', 'Unauthorised absence'), unit: 'day' },
  { grouping: '01', subtype: '0800', kind: 'attendance', name: t2('انتداب / مهمة عمل', 'Business trip / assignment'), unit: 'day' },
  { grouping: '01', subtype: '0810', kind: 'attendance', name: t2('تدريب', 'Training'), unit: 'day' },
  { grouping: '01', subtype: '0820', kind: 'attendance', name: t2('عمل عن بُعد', 'Remote work'), unit: 'day' },
];

/* ——— الوحدات: قطاع ← إدارتان عامتان ← إدارات ← أقسام؛ ولكل وحدة منصب رئيس ——— */
const UNITS: OrgUnit[] = [
  { id: 'O-300', name: t2('قطاع الشؤون الإدارية والمالية', 'Administrative & Financial Affairs Sector'), level: 'sector', chiefPositionId: 'S-300' },
  { id: 'O-100', name: t2('الإدارة العامة للشؤون المالية والإدارية', 'GA for Financial & Administrative Affairs'), level: 'ga', parentId: 'O-300', chiefPositionId: 'S-100' },
  { id: 'O-110', name: t2('إدارة تمكين الأعمال', 'Business Enablement Department'), level: 'department', parentId: 'O-100', chiefPositionId: 'S-110' },
  { id: 'O-111', name: t2('قسم التمكين الرقمي وذكاء الأعمال', 'Digital Enablement & BI Section'), level: 'section', parentId: 'O-110', chiefPositionId: 'S-111' },
  { id: 'O-112', name: t2('قسم البيانات ولوحات المعلومات والتقارير', 'Data, Dashboards & Reports Section'), level: 'section', parentId: 'O-110', chiefPositionId: 'S-112' },
  { id: 'O-120', name: t2('إدارة الشؤون المالية', 'Financial Affairs Department'), level: 'department', parentId: 'O-100', chiefPositionId: 'S-120' },
  { id: 'O-121', name: t2('قسم الرواتب', 'Payroll Section'), level: 'section', parentId: 'O-120', chiefPositionId: 'S-121' },
  { id: 'O-122', name: t2('قسم الانتدابات والاستحقاقات', 'Assignments & Entitlements Section'), level: 'section', parentId: 'O-120', chiefPositionId: 'S-122' },
  { id: 'O-130', name: t2('إدارة المشتريات', 'Procurement Department'), level: 'department', parentId: 'O-100', chiefPositionId: 'S-130' },
  { id: 'O-131', name: t2('قسم المستودعات', 'Stores Section'), level: 'section', parentId: 'O-130', chiefPositionId: 'S-1302' },
  { id: 'O-123', name: t2('قسم الموازنة', 'Budget Section'), level: 'section', parentId: 'O-120', chiefPositionId: 'S-123' },
  /* v0.9 (AS-01): الجهات الفنية ومكتب أبوظبي — تقنية المعلومات والخدمات العامة تحت الإدارة العامة للشؤون المالية والإدارية، والمراسم والإعلامية إدارتان في القطاع */
  { id: 'O-140', name: t2('إدارة تقنية المعلومات', 'Information Technology Department'), level: 'department', parentId: 'O-100', chiefPositionId: 'S-140' },
  { id: 'O-141', name: t2('قسم المستودع التقني', 'Technical Store Section'), level: 'section', parentId: 'O-140', chiefPositionId: 'S-1402' },
  { id: 'O-150', name: t2('إدارة الخدمات العامة', 'General Services Department'), level: 'department', parentId: 'O-100', chiefPositionId: 'S-150' },
  { id: 'O-160', name: t2('إدارة المراسم', 'Protocol Department'), level: 'department', parentId: 'O-300', chiefPositionId: 'S-160' },
  { id: 'O-170', name: t2('الإدارة الإعلامية', 'Media Department'), level: 'department', parentId: 'O-300', chiefPositionId: 'S-170' },
  { id: 'O-190', name: t2('مكتب أبوظبي', 'Abu Dhabi Office'), level: 'department', parentId: 'O-300', chiefPositionId: 'S-190' },
  { id: 'O-200', name: t2('الإدارة العامة للموارد البشرية', 'GA for Human Resources'), level: 'ga', parentId: 'O-300', chiefPositionId: 'S-200' },
  { id: 'O-210', name: t2('إدارة الموارد البشرية', 'Human Resources Department'), level: 'department', parentId: 'O-200', chiefPositionId: 'S-210' },
  { id: 'O-211', name: t2('قسم شؤون الموظفين', 'Personnel Affairs Section'), level: 'section', parentId: 'O-210', chiefPositionId: 'S-211' },
];
/* ——— المناصب: ثابتة في الهيكل؛ الشاغل يتغير، وبعضها شاغر (S-120 بنائب، وS-130 بلا نائب) ——— */
const POSITIONS: Position[] = [
  { id: 'S-300', title: t2('الأمين العام المساعد للشؤون الإدارية والمالية', 'Assistant Secretary-General, Administrative & Financial Affairs'), unitId: 'O-300', holderId: 'P-ASG' },
  { id: 'S-100', title: t2('المدير العام للشؤون المالية والإدارية', 'Director General, Financial & Administrative Affairs'), unitId: 'O-100', holderId: 'P-GM' },
  { id: 'S-110', title: t2('مدير إدارة تمكين الأعمال', 'Director, Business Enablement'), unitId: 'O-110', holderId: 'P-DEPT' },
  { id: 'S-111', title: t2('رئيس قسم التمكين الرقمي وذكاء الأعمال', 'Head of Digital Enablement & BI'), unitId: 'O-111', holderId: 'P-MONA' },
  { id: 'S-1111', title: t2('محلل بيانات أول', 'Senior Data Analyst'), unitId: 'O-111', holderId: 'P-AHMED' },
  { id: 'S-1112', title: t2('أخصائي تحليل أعمال', 'Business Analyst'), unitId: 'O-111', holderId: 'P-SARA' },
  { id: 'S-1113', title: t2('مطور تطبيقات', 'Application Developer'), unitId: 'O-111', holderId: 'P-FAHAD' },
  { id: 'S-1114', title: t2('أخصائي نظم', 'Systems Specialist'), unitId: 'O-111', holderId: 'P-KHALID' },
  { id: 'S-112', title: t2('رئيس قسم البيانات ولوحات المعلومات والتقارير', 'Head of Data, Dashboards & Reports'), unitId: 'O-112', holderId: 'P-OMAR' },
  { id: 'S-120', title: t2('مدير إدارة الشؤون المالية', 'Director, Financial Affairs'), unitId: 'O-120', deputyPositionId: 'S-121' },
  { id: 'S-121', title: t2('رئيس قسم الرواتب', 'Head of Payroll'), unitId: 'O-121', holderId: 'P-PAYM' },
  { id: 'S-1211', title: t2('أخصائي رواتب', 'Payroll Specialist'), unitId: 'O-121', holderId: 'P-PAYS' },
  { id: 'S-122', title: t2('رئيس قسم الانتدابات والاستحقاقات', 'Head of Assignments & Entitlements'), unitId: 'O-122', holderId: 'P-FIN' },
  { id: 'S-130', title: t2('مدير إدارة المشتريات', 'Director, Procurement'), unitId: 'O-130' },
  { id: 'S-1301', title: t2('أخصائي المشتريات والمستودعات', 'Procurement & Stores Specialist'), unitId: 'O-130', holderId: 'P-MAJED' },
  { id: 'S-1302', title: t2('أمين المستودع العام', 'General Store Keeper'), unitId: 'O-131', holderId: 'P-STORE1' },
  { id: 'S-123', title: t2('رئيس قسم الموازنة', 'Head of Budget'), unitId: 'O-123', holderId: 'P-BUDG' },
  { id: 'S-140', title: t2('مدير إدارة تقنية المعلومات', 'Director, Information Technology'), unitId: 'O-140', holderId: 'P-ITM' },
  { id: 'S-1401', title: t2('أخصائي دعم تقني', 'Technical Support Specialist'), unitId: 'O-140', holderId: 'P-ITS' },
  { id: 'S-1402', title: t2('أمين المستودع التقني', 'Technical Store Keeper'), unitId: 'O-141', holderId: 'P-STORE2' },
  { id: 'S-150', title: t2('مدير إدارة الخدمات العامة', 'Director, General Services'), unitId: 'O-150', holderId: 'P-GSM' },
  { id: 'S-1501', title: t2('أخصائي خدمات عامة', 'General Services Specialist'), unitId: 'O-150', holderId: 'P-GSS' },
  { id: 'S-160', title: t2('مدير إدارة المراسم', 'Director, Protocol'), unitId: 'O-160', holderId: 'P-PROTM' },
  { id: 'S-170', title: t2('مدير الإدارة الإعلامية', 'Director, Media'), unitId: 'O-170', holderId: 'P-MEDM' },
  { id: 'S-190', title: t2('مسؤول الاستلام والتسليم — مكتب أبوظبي', 'Receipt & Handover Officer — Abu Dhabi Office'), unitId: 'O-190', holderId: 'P-AUH' },
  { id: 'S-200', title: t2('المدير العام للموارد البشرية', 'Director General, Human Resources'), unitId: 'O-200', holderId: 'P-HRGM' },
  { id: 'S-210', title: t2('مدير إدارة الموارد البشرية', 'Director, Human Resources'), unitId: 'O-210', holderId: 'P-HRDM' },
  { id: 'S-211', title: t2('رئيس قسم شؤون الموظفين', 'Head of Personnel Affairs'), unitId: 'O-211', holderId: 'P-HRSH' },
  { id: 'S-2111', title: t2('أخصائي أول شؤون موظفين', 'Senior Personnel Affairs Specialist'), unitId: 'O-211', holderId: 'P-NOURA' },
  { id: 'S-2112', title: t2('أخصائي شؤون موظفين', 'Personnel Affairs Specialist'), unitId: 'O-211', holderId: 'P-HRS2' },
];

const PEOPLE: Person[] = [
  { id: 'P-AHMED', empNo: '2101', name: 'أحمد بن سعود الدوسري', nameEn: 'Ahmed Al-Dosari', title: 'محلل بيانات أول', titleEn: 'Senior Data Analyst', unit: 'إدارة تمكين الأعمال', unitEn: 'Business Enablement Department', initials: { ar: 'أ', en: 'AD' }, persona: 'employee', positionId: 'S-1111', group: '1', subgroup: '12', location: 'riyadh', nationality: 'SA', gender: 'm', parent: true, hiredAt: Date.UTC(2023, 0, 1), contract: { ticketsEntitled: true } },
  { id: 'P-MONA', empNo: '1840', name: 'منى عبدالله القحطاني', nameEn: 'Mona Al-Qahtani', title: 'رئيسة قسم التمكين الرقمي وذكاء الأعمال', titleEn: 'Head of Digital Enablement & BI', unit: 'إدارة تمكين الأعمال', unitEn: 'Business Enablement Department', initials: { ar: 'م', en: 'MQ' }, persona: 'manager', positionId: 'S-111', group: '1', subgroup: '11', location: 'riyadh', nationality: 'SA', gender: 'f', hiredAt: Date.UTC(2016, 0, 10) },
  { id: 'P-NOURA', empNo: '1922', name: 'نورة سعد الحربي', nameEn: 'Noura Al-Harbi', title: 'أخصائي أول شؤون موظفين', titleEn: 'Senior Personnel Affairs Specialist', unit: 'إدارة الموارد البشرية', unitEn: 'Human Resources Department', initials: { ar: 'ن', en: 'NH' }, persona: 'hr', positionId: 'S-2111', group: '1', subgroup: '12', location: 'riyadh', nationality: 'SA', gender: 'f', hiredAt: Date.UTC(2019, 8, 1) },
  { id: 'P-MAJED', empNo: '2044', name: 'ماجد سالم العمري', nameEn: 'Majed Al-Amri', title: 'أخصائي المشتريات والمستودعات', titleEn: 'Procurement & Stores Specialist', unit: 'إدارة المشتريات', unitEn: 'Procurement Department', initials: { ar: 'م', en: 'MA' }, persona: 'buyer', positionId: 'S-1301', group: '2', subgroup: '21', location: 'riyadh', nationality: 'SA', gender: 'm', hiredAt: Date.UTC(2021, 4, 1) },
  { id: 'P-SARA', empNo: '2188', name: 'سارة يوسف عبدالله', nameEn: 'Sara Abdullah', title: 'أخصائي تحليل أعمال', titleEn: 'Business Analyst', unit: 'إدارة تمكين الأعمال', unitEn: 'Business Enablement Department', initials: { ar: 'س', en: 'SA' }, persona: 'employee', positionId: 'S-1112', group: '2', subgroup: '22', location: 'riyadh', nationality: 'JO', gender: 'f', parent: false, hiredAt: Date.UTC(2025, 1, 15), contract: { ticketsEntitled: true } },
  { id: 'P-FAHAD', empNo: '2203', name: 'فهد ناصر العجمي', nameEn: 'Fahad Al-Ajmi', title: 'مطور تطبيقات', titleEn: 'Application Developer', unit: 'إدارة تمكين الأعمال', unitEn: 'Business Enablement Department', initials: { ar: 'ف', en: 'FA' }, persona: 'employee', positionId: 'S-1113', group: '1', subgroup: '12', onLeaveToday: true, location: 'abudhabi', nationality: 'SA', gender: 'm', parent: true, hiredAt: Date.UTC(2022, 9, 1), contract: { ticketsEntitled: true } },
  { id: 'P-KHALID', empNo: '2251', name: 'خالد بن ناصر السبيعي', nameEn: 'Khalid Al-Subaie', title: 'أخصائي نظم', titleEn: 'Systems Specialist', unit: 'إدارة تمكين الأعمال', unitEn: 'Business Enablement Department', initials: { ar: 'خ', en: 'KS' }, persona: 'employee', positionId: 'S-1114', group: '2', subgroup: '21', location: 'riyadh', nationality: 'SA', gender: 'm', parent: false, hiredAt: Date.UTC(2024, 6, 1) },
  { id: 'P-DEPT', empNo: '1502', name: 'عبدالرحمن بن فهد الشمري', nameEn: 'Abdulrahman Al-Shammari', title: 'مدير إدارة تمكين الأعمال', titleEn: 'Director, Business Enablement', unit: 'إدارة تمكين الأعمال', unitEn: 'Business Enablement Department', initials: { ar: 'ع', en: 'AS' }, persona: 'employee', positionId: 'S-110', group: '1', subgroup: '11', location: 'riyadh', nationality: 'SA', gender: 'm', hiredAt: Date.UTC(2012, 2, 1) },
  { id: 'P-GM', empNo: '1101', name: 'عبدالله بن محمد العتيبي', nameEn: 'Abdullah Al-Otaibi', title: 'المدير العام للشؤون المالية والإدارية', titleEn: 'Director General, Financial & Administrative Affairs', unit: 'الإدارة العامة للشؤون المالية والإدارية', unitEn: 'GA for Financial & Administrative Affairs', initials: { ar: 'ع', en: 'AO' }, persona: 'employee', positionId: 'S-100', group: '1', subgroup: '11', location: 'riyadh', nationality: 'SA', gender: 'm', hiredAt: Date.UTC(2008, 0, 1) },
  { id: 'P-HRGM', empNo: '1108', name: 'هند بنت سعد الراشد', nameEn: 'Hind Al-Rashed', title: 'المدير العام للموارد البشرية', titleEn: 'Director General, Human Resources', unit: 'الإدارة العامة للموارد البشرية', unitEn: 'GA for Human Resources', initials: { ar: 'هـ', en: 'HR' }, persona: 'employee', positionId: 'S-200', group: '1', subgroup: '11', location: 'riyadh', nationality: 'SA', gender: 'f', hiredAt: Date.UTC(2010, 5, 1) },
  { id: 'P-HRDM', empNo: '1310', name: 'سلطان بن عبدالعزيز الدخيل', nameEn: 'Sultan Al-Dakheel', title: 'مدير إدارة الموارد البشرية', titleEn: 'Director, Human Resources', unit: 'إدارة الموارد البشرية', unitEn: 'Human Resources Department', initials: { ar: 'س', en: 'SD' }, persona: 'employee', positionId: 'S-210', group: '1', subgroup: '11', location: 'riyadh', nationality: 'SA', gender: 'm', hiredAt: Date.UTC(2013, 8, 1) },
  { id: 'P-HRSH', empNo: '1611', name: 'علي بن أحمد البوعينين', nameEn: 'Ali Al-Buainain', title: 'رئيس قسم شؤون الموظفين', titleEn: 'Head of Personnel Affairs', unit: 'إدارة الموارد البشرية', unitEn: 'Human Resources Department', initials: { ar: 'ع', en: 'AB' }, persona: 'employee', positionId: 'S-211', group: '1', subgroup: '11', location: 'riyadh', nationality: 'BH', gender: 'm', hiredAt: Date.UTC(2015, 3, 1) },
  { id: 'P-HRS2', empNo: '2310', name: 'تركي بن محمد العنزي', nameEn: 'Turki Al-Anazi', title: 'أخصائي شؤون موظفين', titleEn: 'Personnel Affairs Specialist', unit: 'إدارة الموارد البشرية', unitEn: 'Human Resources Department', initials: { ar: 'ت', en: 'TA' }, persona: 'employee', positionId: 'S-2112', group: '2', subgroup: '21', location: 'riyadh', nationality: 'SA', gender: 'm', hiredAt: Date.UTC(2024, 0, 15) },
  { id: 'P-PAYM', empNo: '1420', name: 'بدر بن سالم القحطاني', nameEn: 'Badr Al-Qahtani', title: 'رئيس قسم الرواتب', titleEn: 'Head of Payroll', unit: 'إدارة الشؤون المالية', unitEn: 'Financial Affairs Department', initials: { ar: 'ب', en: 'BQ' }, persona: 'employee', positionId: 'S-121', group: '1', subgroup: '11', location: 'riyadh', nationality: 'SA', gender: 'm', hiredAt: Date.UTC(2014, 1, 1) },
  { id: 'P-PAYS', empNo: '2275', name: 'ريم بنت خالد الزهراني', nameEn: 'Reem Al-Zahrani', title: 'أخصائي رواتب', titleEn: 'Payroll Specialist', unit: 'إدارة الشؤون المالية', unitEn: 'Financial Affairs Department', initials: { ar: 'ر', en: 'RZ' }, persona: 'employee', positionId: 'S-1211', group: '1', subgroup: '12', location: 'riyadh', nationality: 'SA', gender: 'f', hiredAt: Date.UTC(2023, 7, 1) },
  { id: 'P-FIN', empNo: '1705', name: 'نايف بن عبدالله الحارثي', nameEn: 'Nayef Al-Harthi', title: 'رئيس قسم الانتدابات والاستحقاقات', titleEn: 'Head of Assignments & Entitlements', unit: 'إدارة الشؤون المالية', unitEn: 'Financial Affairs Department', initials: { ar: 'ن', en: 'NH' }, persona: 'employee', positionId: 'S-122', group: '1', subgroup: '11', location: 'riyadh', nationality: 'SA', gender: 'm', hiredAt: Date.UTC(2017, 10, 1) },
  { id: 'P-ASG', empNo: '1003', name: 'سعود بن عبدالله المنصور', nameEn: 'Saud Al-Mansour', title: 'الأمين العام المساعد للشؤون الإدارية والمالية', titleEn: 'Assistant Secretary-General, Administrative & Financial Affairs', unit: 'قطاع الشؤون الإدارية والمالية', unitEn: 'Administrative & Financial Affairs Sector', initials: { ar: 'س', en: 'SM' }, persona: 'employee', positionId: 'S-300', group: '1', subgroup: '11', location: 'riyadh', nationality: 'SA', gender: 'm', hiredAt: Date.UTC(2005, 0, 1) },
  { id: 'P-STORE1', empNo: '2402', name: 'يوسف بن حمد الغامدي', nameEn: 'Yousef Al-Ghamdi', title: 'أمين المستودع العام', titleEn: 'General Store Keeper', unit: 'إدارة المشتريات', unitEn: 'Procurement Department', initials: { ar: 'ي', en: 'YG' }, persona: 'employee', positionId: 'S-1302', group: '2', subgroup: '21', location: 'riyadh', nationality: 'SA', gender: 'm', hiredAt: Date.UTC(2020, 2, 1) },
  { id: 'P-BUDG', empNo: '1633', name: 'لمياء بنت عبدالله السديري', nameEn: 'Lamia Al-Sudairi', title: 'رئيسة قسم الموازنة', titleEn: 'Head of Budget', unit: 'إدارة الشؤون المالية', unitEn: 'Financial Affairs Department', initials: { ar: 'ل', en: 'LS' }, persona: 'employee', positionId: 'S-123', group: '1', subgroup: '11', location: 'riyadh', nationality: 'SA', gender: 'f', hiredAt: Date.UTC(2014, 8, 1) },
  { id: 'P-ITM', empNo: '1290', name: 'محمد بن سعد الجبر', nameEn: 'Mohammed Al-Jabr', title: 'مدير إدارة تقنية المعلومات', titleEn: 'Director, Information Technology', unit: 'إدارة تقنية المعلومات', unitEn: 'Information Technology Department', initials: { ar: 'م', en: 'MJ' }, persona: 'employee', positionId: 'S-140', group: '1', subgroup: '11', location: 'riyadh', nationality: 'SA', gender: 'm', hiredAt: Date.UTC(2011, 0, 1) },
  { id: 'P-ITS', empNo: '2330', name: 'عبدالعزيز بن خالد المطيري', nameEn: 'Abdulaziz Al-Mutairi', title: 'أخصائي دعم تقني', titleEn: 'Technical Support Specialist', unit: 'إدارة تقنية المعلومات', unitEn: 'Information Technology Department', initials: { ar: 'ع', en: 'AM' }, persona: 'employee', positionId: 'S-1401', group: '2', subgroup: '21', location: 'riyadh', nationality: 'SA', gender: 'm', hiredAt: Date.UTC(2023, 3, 1) },
  { id: 'P-STORE2', empNo: '2377', name: 'حسن بن علي العلي', nameEn: 'Hassan Al-Ali', title: 'أمين المستودع التقني', titleEn: 'Technical Store Keeper', unit: 'إدارة تقنية المعلومات', unitEn: 'Information Technology Department', initials: { ar: 'ح', en: 'HA' }, persona: 'employee', positionId: 'S-1402', group: '2', subgroup: '21', location: 'riyadh', nationality: 'BH', gender: 'm', hiredAt: Date.UTC(2022, 0, 15) },
  { id: 'P-GSM', empNo: '1355', name: 'فيصل بن ناصر الدوسري', nameEn: 'Faisal Al-Dosari', title: 'مدير إدارة الخدمات العامة', titleEn: 'Director, General Services', unit: 'إدارة الخدمات العامة', unitEn: 'General Services Department', initials: { ar: 'ف', en: 'FD' }, persona: 'employee', positionId: 'S-150', group: '1', subgroup: '11', location: 'riyadh', nationality: 'SA', gender: 'm', hiredAt: Date.UTC(2012, 5, 1) },
  { id: 'P-GSS', empNo: '2461', name: 'منصور بن عبدالله الشهري', nameEn: 'Mansour Al-Shehri', title: 'أخصائي خدمات عامة', titleEn: 'General Services Specialist', unit: 'إدارة الخدمات العامة', unitEn: 'General Services Department', initials: { ar: 'م', en: 'MS' }, persona: 'employee', positionId: 'S-1501', group: '2', subgroup: '21', location: 'riyadh', nationality: 'SA', gender: 'm', hiredAt: Date.UTC(2024, 1, 1) },
  { id: 'P-PROTM', empNo: '1218', name: 'طلال بن فهد العنقري', nameEn: 'Talal Al-Anqari', title: 'مدير إدارة المراسم', titleEn: 'Director, Protocol', unit: 'إدارة المراسم', unitEn: 'Protocol Department', initials: { ar: 'ط', en: 'TA' }, persona: 'employee', positionId: 'S-160', group: '1', subgroup: '11', location: 'riyadh', nationality: 'SA', gender: 'm', hiredAt: Date.UTC(2010, 9, 1) },
  { id: 'P-MEDM', empNo: '1266', name: 'دانة بنت محمد الفهيد', nameEn: 'Dana Al-Fuhaid', title: 'مديرة الإدارة الإعلامية', titleEn: 'Director, Media', unit: 'الإدارة الإعلامية', unitEn: 'Media Department', initials: { ar: 'د', en: 'DF' }, persona: 'employee', positionId: 'S-170', group: '1', subgroup: '11', location: 'riyadh', nationality: 'SA', gender: 'f', hiredAt: Date.UTC(2013, 2, 1) },
  { id: 'P-AUH', empNo: '2150', name: 'راشد بن سالم الكعبي', nameEn: 'Rashed Al-Kaabi', title: 'مسؤول الاستلام والتسليم — مكتب أبوظبي', titleEn: 'Receipt & Handover Officer — Abu Dhabi Office', unit: 'مكتب أبوظبي', unitEn: 'Abu Dhabi Office', initials: { ar: 'ر', en: 'RK' }, persona: 'employee', positionId: 'S-190', group: '2', subgroup: '22', location: 'abudhabi', nationality: 'AE', gender: 'm', hiredAt: Date.UTC(2019, 4, 1) },
  { id: 'P-OMAR', empNo: '1008', name: 'عمر المسعي', nameEn: 'Omar Al-Musai', title: 'رئيس قسم البيانات ولوحات المعلومات والتقارير · مدير النظام', titleEn: 'Head of Data, Dashboards & Reports · System admin', unit: 'إدارة تمكين الأعمال', unitEn: 'Business Enablement Department', initials: { ar: 'ع', en: 'OM' }, persona: 'admin', positionId: 'S-112', group: '1', subgroup: '11', location: 'riyadh', nationality: 'SA', gender: 'm', hiredAt: Date.UTC(2015, 0, 1) },
];

/* ——— v0.9 قوائم النظام المرجعي للاحتياج: مواقع التخزين (1010 العام، 1020 التقني — قيم عمر)، والأصناف من السجل الرئيسي للصنف، والمخزون بالمستودع ——— */
const STORAGE_LOCATIONS: ErpStorageLocation[] = [{ id: '1010', name: t2('المستودع العام', 'General store'), plant: 'GS01' }, { id: '1020', name: t2('المستودع التقني', 'Technical store'), plant: 'GS01' }, { id: '1030', name: t2('مستودع المطبوعات والهدايا', 'Publications & gifts store'), plant: 'GS01' }];
const ITEMS: ErpItem[] = [
  { id: 'M-100201', name: t2('حاسوب محمول 14 بوصة', 'Laptop 14"'), unit: t2('جهاز', 'unit'), categoryHint: 'techMaterial', icon: 'box', custody: true, price: 4800, specs: t2('ذاكرة 16 غ.ب · تخزين 512 غ.ب', '16 GB RAM · 512 GB SSD') },
  { id: 'M-100202', name: t2('شاشة 27 بوصة', 'Monitor 27"'), unit: t2('جهاز', 'unit'), categoryHint: 'techMaterial', icon: 'box', custody: true, price: 1350, specs: t2('دقة 2K', '2K resolution') },
  { id: 'M-100203', name: t2('حامل حاسوب محمول', 'Laptop stand'), unit: t2('قطعة', 'pc'), categoryHint: 'techMaterial', icon: 'box', custody: true, price: 180 },
  { id: 'M-100204', name: t2('سماعة رأس بميكروفون', 'Headset with microphone'), unit: t2('قطعة', 'pc'), categoryHint: 'techMaterial', icon: 'box', custody: true, price: 320 },
  { id: 'M-100205', name: t2('حبر طابعة HP 26A', 'HP 26A toner'), unit: t2('عبوة', 'cartridge'), categoryHint: 'techMaterial', icon: 'box', custody: false, price: 260 },
  { id: 'M-100206', name: t2('جهاز عرض', 'Projector'), unit: t2('جهاز', 'unit'), categoryHint: 'techMaterial', icon: 'box', custody: true, price: 3900 },
  { id: 'M-200301', name: t2('كرسي مكتب', 'Office chair'), unit: t2('قطعة', 'pc'), categoryHint: 'generalMaterial', icon: 'box', custody: true, price: 950 },
  { id: 'M-200302', name: t2('مكتب', 'Desk'), unit: t2('قطعة', 'pc'), categoryHint: 'generalMaterial', icon: 'box', custody: true, price: 2200 },
  { id: 'M-200303', name: t2('ورق A4 (كرتون)', 'A4 paper (box)'), unit: t2('كرتون', 'box'), categoryHint: 'generalMaterial', icon: 'box', custody: false, price: 95 },
  { id: 'M-300401', name: t2('علبة هدايا رسمية', 'Official gift box'), unit: t2('علبة', 'box'), categoryHint: 'protocolMaterial', icon: 'ribbon', custody: false, price: 420 },
  { id: 'M-400501', name: t2('كاميرا فيديو', 'Video camera'), unit: t2('جهاز', 'unit'), categoryHint: 'mediaMaterial', icon: 'globe', custody: true, price: 8900 },
];
const STOCK: ErpStock[] = [
  { itemId: 'M-100203', storeId: '1020', qty: 6 }, { itemId: 'M-100204', storeId: '1020', qty: 3 }, { itemId: 'M-100205', storeId: '1020', qty: 12 }, { itemId: 'M-100201', storeId: '1020', qty: 2 }, { itemId: 'M-100202', storeId: '1020', qty: 0 },
  { itemId: 'M-200303', storeId: '1010', qty: 40 }, { itemId: 'M-200301', storeId: '1010', qty: 0 }, { itemId: 'M-300401', storeId: '1010', qty: 25 },
];

/* ——— v0.11 (P-10): شركاء الأعمال (المورّدون) والعقود الإطارية من النظام المرجعي للقراءة — العرض يختار المورّد بمفتاحه، والعقد يُستهلك بأوامر التنفيذ؛ وأرصدة الجهات (تشغيل) ——— */
const SUPPLIERS: ErpSupplier[] = [
  { id: 'BP-1000201', name: t2('شركة المكاتب الحديثة', 'Modern Offices Co.'), city: t2('الرياض', 'Riyadh') }, { id: 'BP-1000202', name: t2('معرض الأثاث الوطني', 'National Furniture Gallery'), city: t2('الرياض', 'Riyadh') }, { id: 'BP-1000203', name: t2('مؤسسة التجهيزات المكتبية', 'Office Fit-out Est.'), city: t2('الدمام', 'Dammam') },
  { id: 'BP-1000301', name: t2('الموزّع المعتمد الأول', 'First Authorised Distributor'), city: t2('الرياض', 'Riyadh') }, { id: 'BP-1000302', name: t2('شركة الحلول الرقمية', 'Digital Solutions Co.'), city: t2('جدة', 'Jeddah') }, { id: 'BP-1000303', name: t2('مؤسسة التقنية المتقدمة', 'Advanced Technology Est.'), city: t2('الرياض', 'Riyadh') },
  { id: 'BP-1000401', name: t2('مكتب الترجمة المعتمد', 'Certified Translation Bureau'), city: t2('الرياض', 'Riyadh') }, { id: 'BP-1000402', name: t2('دار اللغات', 'Languages House'), city: t2('الرياض', 'Riyadh') }, { id: 'BP-1000403', name: t2('مركز الترجمة الحديث', 'Modern Translation Centre'), city: t2('جدة', 'Jeddah') },
  { id: 'BP-1000501', name: t2('شركة المنصات الرقمية', 'Digital Platforms Co.'), city: t2('الرياض', 'Riyadh') }, { id: 'BP-1000502', name: t2('شركة الأجهزة السمعية والبصرية', 'Audio-Visual Systems Co.'), city: t2('الرياض', 'Riyadh') }, { id: 'BP-1000503', name: t2('معرض أبوظبي للأثاث', 'Abu Dhabi Furniture Gallery'), city: t2('أبوظبي', 'Abu Dhabi') },
];
const CONTRACTS: ErpContract[] = [
  { id: '4600001234', name: t2('العقد الإطاري للأجهزة السمعية والبصرية وصيانتها', 'Audio-visual equipment & maintenance framework contract'), supplierId: 'BP-1000502', validTo: '2027-06-30', target: 250000, consumed: 61000, kind: 'value' },
  { id: '4600001250', name: t2('العقد الإطاري للقرطاسية والمستلزمات المكتبية', 'Stationery & office supplies framework contract'), supplierId: 'BP-1000203', validTo: '2027-03-31', target: 120000, consumed: 88500, kind: 'value' },
  { id: '4600001180', name: t2('عقد صيانة الطابعات (منتهٍ)', 'Printer maintenance contract (expired)'), supplierId: 'BP-1000301', validTo: '2026-06-30', target: 60000, consumed: 60000, kind: 'value' },
];
const POOL_STOCK: PoolStock[] = [{ poolId: 'POOL-M365', qty: 14 }, { poolId: 'POOL-ACROBAT', qty: 3 }];

const F = (key: string, ar: string, en: string, value: string): Field => ({ key, label: { ar, en }, value });

export function buildSeed(now = Date.now()): State {
  let s: State = {
    version: STATE_VERSION,
    settings: { lang: 'ar', theme: 'auto', persona: 'employee', notifPrefs: { task: true, status: true, document: true, expiry: true, reminder: true, policy: true, circular: true, story: true } },
    people: PEOPLE, org: { units: UNITS, positions: POSITIONS }, groups: GROUPS, erp: { absenceTypes: ERP_ABSENCE_TYPES, storageLocations: STORAGE_LOCATIONS, items: ITEMS, stock: STOCK, suppliers: SUPPLIERS, contracts: CONTRACTS, poolStock: POOL_STOCK, formerEmployees: [{ id: 'X-1001', empNo: '10231', name: t2('عبدالعزيز الحربي', 'Abdulaziz Al-Harbi'), leftAt: '2025-11-30' }, { id: 'X-1002', empNo: '10187', name: t2('منيرة القحطاني', 'Munira Al-Qahtani'), leftAt: '2026-03-15' }] }, requests: [], notifications: [], seq: 380, nseq: 0,
    docs: {
      'P-AHMED': [
        { id: 'DOC-1', title: { ar: 'جواز السفر', en: 'Passport' }, number: 'A•••••712', expiresAt: now + 175 * DAY, icon: 'passport' },
        { id: 'DOC-2', title: { ar: 'الهوية الوطنية', en: 'National ID' }, number: '10•••••••34', expiresAt: now + 960 * DAY, icon: 'id' },
        { id: 'DOC-3', title: { ar: 'البطاقة الإدارية', en: 'Administrative card' }, number: 'GS-••••-2201', expiresAt: now + 19 * DAY, icon: 'card' },
        { id: 'DOC-4', title: { ar: 'رخصة القيادة', en: 'Driving licence' }, number: '••••••51', expiresAt: now + 14 * DAY, icon: 'licence' },
        { id: 'DOC-5', title: { ar: 'عقد العمل', en: 'Employment contract' }, number: 'C-2023-118', expiresAt: now + 349 * DAY, icon: 'contract' },
        { id: 'DOC-6', title: { ar: 'بطاقة التأمين الطبي', en: 'Medical insurance card' }, number: 'MI-••••-0093', expiresAt: now + 106 * DAY, icon: 'insurance' },
      ],
    },
    payslips: {
      'P-AHMED': [
        { id: 'PS-2026-09', month: { ar: 'سبتمبر 2026', en: 'September 2026' }, gross: 18500, deductions: 1850, net: 16650, issuedAt: now - 1 * DAY },
        { id: 'PS-2026-08', month: { ar: 'أغسطس 2026', en: 'August 2026' }, gross: 18500, deductions: 1850, net: 16650, issuedAt: now - 31 * DAY },
        { id: 'PS-2026-07', month: { ar: 'يوليو 2026', en: 'July 2026' }, gross: 18500, deductions: 2100, net: 16400, issuedAt: now - 62 * DAY },
      ],
    },
    dependants: {
      'P-AHMED': [
        { id: 'DEP-1', name: { ar: 'ريم', en: 'Reem' }, relation: { ar: 'زوجة', en: 'Spouse' }, docExpiresAt: now + 220 * DAY },
        { id: 'DEP-2', name: { ar: 'سعود', en: 'Saud' }, relation: { ar: 'ابن', en: 'Son' }, docExpiresAt: now + 40 * DAY },
      ],
    },
    balances: { 'P-AHMED': { annual: 21.5, annualTotal: 30, sick: 30, emergency: 5 }, 'P-SARA': { annual: 12, annualTotal: 30, sick: 30, emergency: 5 }, 'P-FAHAD': { annual: 30, annualTotal: 30, sick: 30, emergency: 5 }, 'P-KHALID': { annual: 9, annualTotal: 30, sick: 30, emergency: 5 }, 'P-MAJED': { annual: 18, annualTotal: 30, sick: 30, emergency: 5 } },
    // سجل الإجازات المسجَّلة في النظام المرجعي (يحدد دورات الأجر المتدرج): سارة متعاقدة واستهلكت 28 من 30 يوماً بأجر كامل
    absences: [
      { personId: 'P-AHMED', typeId: 'sick', from: '2026-03-02', to: '2026-03-06', days: 5 },
      { personId: 'P-AHMED', typeId: 'annual', from: '2026-05-17', to: '2026-05-21', days: 5 },
      { personId: 'P-AHMED', typeId: 'sick', from: '2026-06-14', to: '2026-06-18', days: 5 },
      { personId: 'P-SARA', typeId: 'sick', from: '2026-05-10', to: '2026-05-31', days: 22 },
      { personId: 'P-SARA', typeId: 'sick', from: '2026-07-01', to: '2026-07-06', days: 6 },
      { personId: 'P-FAHAD', typeId: 'hajj', from: '2025-06-05', to: '2025-06-24', days: 20 },
    ],
    policy: seedPolicy(now), needPolicy: seedNeedPolicy(now), custody: [],
    /* v0.13 «اليوم»: المنشورات والقصص والتقويم، وما يخص كل موظف منها، وسياسة الأخبار والقصص */
    posts: seedPosts(now), stories: seedStories(now), calendar: seedCalendar(now), comms: { seen: {}, acks: {}, cal: {}, dismissed: {}, reminded: {} }, commsPolicy: seedCommsPolicy(now),
    /* v0.15 (CAP-02): مصمّم الخدمات سياسة رابعة، والمستأجر الواحد اليوم: الأمانة العامة (D-033) */
    designer: seedDesignerPolicy(now), tenant: { id: TENANT_DEFAULT, name: t2('الأمانة العامة لمجلس التعاون', 'GCC General Secretariat') },
    /* v0.16 (CAP-02 خريطة الحالات §6 و§8): سجل المستأجرين، وربط العقود في بيئة التطوير، والسجلات المخصصة */
    tenants: seedTenants(now), contracts: { bindings: seedBindings(now) }, registers: [],
  };
  const policyNow = activeVersion(s.policy, toISO(now));
  const groupNames = { group: (id: string) => GROUPS.find((g) => g.id === id)?.name.ar || id, subgroup: (id: string) => GROUPS.flatMap((g) => g.subgroups).find((x) => x.id === id)?.name.ar || id };
  /** طلب إجازة مبني بالمسار الذي تحدده السياسة الفعلية، بقواعد الاستخراج من الهيكل (كما يفعل التطبيق عند التقديم) */
  const leave = (personId: string, typeId: string, from: string, to: string, at: number, note = '', attachment?: string, entitlements?: string[]) => {
    const type = policyNow.content.types.find((t) => t.id === typeId)!; const person = s.people.find((p) => p.id === personId)!;
    const ev = evaluateLeave({ content: policyNow.content, person, type, from, to, today: toISO(at), absences: s.absences, balances: s.balances[personId], ops: s.policy });
    const info = { typeId, from, to, days: ev.days, workingDays: ev.workingDays, entitlements, payBreakdown: ev.sick?.slices };
    const built = leaveSteps(s, person, policyNow.content, type.route, info, at, groupNames);
    return createRequest(s, { serviceId: 'TM-01', requesterId: personId, at, attachment, steps: built.steps, notApplied: built.notApplied, policyVersion: policyNow.number, leave: info, fields: [F('type', 'نوع الإجازة', 'Leave type', type.name.ar), F('from', 'من', 'From', from), F('to', 'إلى', 'To', to), F('days', 'الأيام', 'Days', String(ev.days)), F('note', 'ملاحظة', 'Note', note)].filter((f) => f.value) });
  };
  let r;
  // سريان الإصدار الابتدائي من سياسة الإجازات (1 سبتمبر): إشعار مدير السياسة وشؤون الموظفين
  s = policyActiveNotification(s, policyNow, Math.min(now - 1 * H, fromISO(policyNow.from).getTime() + 8 * H));
  // R12 (v0.9): احتياج مكتمل قبل شهر — عبدالرحمن (مدير الإدارة) طلب حامل حاسوب لأحمد؛ منسّق القطاع، ثم السلسلة، ثم تقنية المعلومات، ثم المستودع التقني (متوفر فحُجز)، ثم التسليم والاستلام بتوقيع الطرفين وقيد العهدة
  [s, r] = createNeed(s, { requesterId: 'P-DEPT', beneficiaryId: 'P-AHMED', categoryId: 'techMaterial', lines: [{ catalogId: 'K-stand', name: t2('حامل حاسوب محمول', 'Laptop stand'), qty: 1 }], justification: 'وضعية العمل على المكتب', at: now - 30 * DAY });
  s = decide(s, r.id, 'approve', 'P-SARA', undefined, now - 30 * DAY + 3 * H);
  s = decide(s, r.id, 'approve', 'P-GM', undefined, now - 29 * DAY);
  s = decide(s, r.id, 'approve', 'P-ASG', undefined, now - 29 * DAY + 4 * H);
  s = specifyDecision(s, r.id, 'P-ITS', { specs: [{ lineId: 'L1', itemId: 'M-100203' }], note: 'المواصفات مناسبة' }, now - 28 * DAY);
  s = storeDecision(s, r.id, 'P-STORE2', [{ lineId: 'L1', action: 'reserve' }], now - 27 * DAY);
  s = handoverStart(s, r.id, 'P-STORE2', now - 26 * DAY);
  s = handoverSign(s, r.id, 'P-AHMED', now - 26 * DAY + 2 * H);
  // R11: إجازة مكتملة قبل ٢٠ يوماً
  [s, r] = leave('P-AHMED', 'emergency', '2026-08-30', '2026-08-30', now - 20 * DAY, 'ظرف عائلي');
  s = decide(s, r.id, 'approve', 'P-MONA', undefined, now - 19 * DAY);
  // R13: إجازة مرضية لسارة اعتمدتها شؤون الموظفين مباشرة (المدير أُشعر فقط)
  [s, r] = leave('P-SARA', 'sick', '2026-09-06', '2026-09-07', now - 10 * DAY, '', 'medical-report.pdf');
  s = decide(s, r.id, 'approve', 'P-NOURA', undefined, now - 10 * DAY + 6 * H);
  // R5: تحديث مستند مكتمل
  [s, r] = createRequest(s, { serviceId: 'MD-05', requesterId: 'P-AHMED', at: now - 12 * DAY, attachment: 'iqama-renewed.pdf', fields: [F('doc', 'المستند', 'Document', 'بطاقة التأمين الطبي'), F('number', 'الرقم الجديد', 'New number', 'MI-••••-0093'), F('expires', 'تاريخ الانتهاء', 'Expiry date', '2026-12-31')] });
  s = decide(s, r.id, 'approve', 'P-NOURA', undefined, now - 11 * DAY);
  // R4: انتداب أُعيد للاستكمال
  [s, r] = createRequest(s, { serviceId: 'FN-01', requesterId: 'P-AHMED', at: now - 8 * DAY, fields: [F('dest', 'الوجهة', 'Destination', 'جدة'), F('from', 'من', 'From', '2026-09-28'), F('to', 'إلى', 'To', '2026-09-30'), F('purpose', 'الغرض', 'Purpose', 'ورشة عمل تحليل البيانات مع الجهات المعنية')] });
  s = decide(s, r.id, 'approve', 'P-MONA', undefined, now - 7 * DAY);
  s = decide(s, r.id, 'return', 'P-FIN', 'أرفق خطاب الدعوة أو برنامج الورشة لإثبات المدة', now - 6 * DAY);
  // R3 (v0.9): شاشة 27 بوصة لأحمد — غير متوفرة في المستودع التقني فتحوّلت إلى الشراء؛ عند مكتب المشتريات الآن
  [s, r] = createNeed(s, { requesterId: 'P-DEPT', beneficiaryId: 'P-AHMED', categoryId: 'techMaterial', lines: [{ catalogId: 'K-monitor', name: t2('شاشة مكتب', 'Desk monitor'), qty: 1 }], justification: 'العمل على لوحات المعلومات بشاشتين', at: now - 6 * DAY });
  s = decide(s, r.id, 'approve', 'P-SARA', undefined, now - 6 * DAY + 2 * H);
  s = decide(s, r.id, 'approve', 'P-GM', undefined, now - 5 * DAY);
  s = decide(s, r.id, 'approve', 'P-ASG', undefined, now - 5 * DAY + 3 * H);
  s = specifyDecision(s, r.id, 'P-ITS', { specs: [{ lineId: 'L1', itemId: 'M-100202' }], note: 'دقة 2K مناسبة للوحات المعلومات' }, now - 4 * DAY);
  s = storeDecision(s, r.id, 'P-STORE2', [{ lineId: 'L1', action: 'purchase' }], now - 3 * DAY, 'لا شاشات 27 بوصة في المخزون');
  // R8: انتداب خالد عند الانتدابات
  [s, r] = createRequest(s, { serviceId: 'FN-01', requesterId: 'P-KHALID', at: now - 4 * DAY, attachment: 'invitation.pdf', fields: [F('dest', 'الوجهة', 'Destination', 'الدوحة'), F('from', 'من', 'From', '2026-10-04'), F('to', 'إلى', 'To', '2026-10-06'), F('purpose', 'الغرض', 'Purpose', 'اجتماع فريق النظم المشترك')] });
  s = decide(s, r.id, 'approve', 'P-MONA', undefined, now - 3 * DAY);
  // R2: خطاب تعريف مكتمل قبل ٣ أيام (مهمة تنفيذ عند شؤون الموظفين أُغلقت بمرجع)
  [s, r] = createRequest(s, { serviceId: 'DC-01', requesterId: 'P-AHMED', at: now - 3 * DAY, fields: [F('to', 'الجهة الموجه إليها', 'Addressed to', 'بنك الرياض'), F('lang', 'اللغة', 'Language', 'العربية'), F('salary', 'يتضمن الراتب', 'Includes salary', 'نعم')] });
  s = decide(s, r.id, 'done', 'P-NOURA', undefined, now - 3 * DAY + 2 * H, 'LTR-2026-0412');
  // R6: إجازة سارة بانتظار المدير
  [s, r] = leave('P-SARA', 'annual', '2026-10-11', '2026-10-15', now - 2 * DAY);
  // R10: حساب فهد البنكي بانتظار شؤون الموظفين
  [s, r] = createRequest(s, { serviceId: 'MD-02', requesterId: 'P-FAHAD', at: now - 2 * DAY + 4 * H, attachment: 'bank-letter.pdf', fields: [F('iban', 'الآيبان الجديد', 'New IBAN', 'SA•• •••• •••• •••• 4471'), F('bank', 'البنك', 'Bank', 'مصرف الراجحي')] });
  // R1: إجازة أحمد بانتظار المدير
  [s, r] = leave('P-AHMED', 'annual', '2026-09-27', '2026-10-08', now - 1 * DAY, 'سفر عائلي');
  // R14: إجازة استثنائية لخالد على المسار الموسّع، عند المدير العام الآن
  [s, r] = leave('P-KHALID', 'exceptional', '2026-11-01', '2027-01-31', now - 3 * DAY, 'دراسة', 'asg-decision.pdf');
  s = decide(s, r.id, 'approve', 'P-MONA', undefined, now - 3 * DAY + 4 * H);
  s = decide(s, r.id, 'approve', 'P-DEPT', undefined, now - 2 * DAY + 2 * H);
  // R7 (v0.9): سلطان (مدير إدارة الموارد البشرية) طلب حبر طابعة لقسم شؤون الموظفين — عند منسّق القطاع الآن
  [s, r] = createNeed(s, { requesterId: 'P-HRDM', beneficiaryId: 'P-NOURA', categoryId: 'techMaterial', lines: [{ catalogId: 'K-toner', name: t2('حبر طابعة', 'Printer toner'), qty: 2 }], justification: 'طابعة قسم شؤون الموظفين', at: now - 1 * DAY + 3 * H });
  // R9: خطاب سارة بانتظار شؤون الموظفين
  [s, r] = createRequest(s, { serviceId: 'DC-01', requesterId: 'P-SARA', at: now - 5 * H, fields: [F('to', 'الجهة الموجه إليها', 'Addressed to', 'سفارة المملكة المتحدة'), F('lang', 'اللغة', 'Language', 'الإنجليزية'), F('salary', 'يتضمن الراتب', 'Includes salary', 'نعم')] });
  // R16 (v0.7): إجازة سنوية معتمدة لأحمد في المستقبل — تُلغى من صفحتها (قبل بدايتها، بلا اعتماد، يُبلَّغ المدير)
  [s, r] = leave('P-AHMED', 'annual', '2026-12-20', '2026-12-24', now - 5 * DAY, 'إجازة نهاية العام');
  s = decide(s, r.id, 'approve', 'P-MONA', undefined, now - 5 * DAY + 5 * H);
  // R15: إجازة ماجد السنوية: مديره المباشر منصب شاغر بلا نائب فانتقلت إلى المدير العام (ق.م-06)
  [s, r] = leave('P-MAJED', 'annual', '2026-10-18', '2026-10-22', now - 7 * H, 'مناسبة عائلية');
  // ——— v0.9: احتياجان إضافيان يُنشآن آخراً حتى تبقى أرقام الطلبات السابقة كما هي لسكربتات الانحدار (أرقام النظام المرجعي التجريبية لها عدّادها الخاص erpSeq) ———
  // R3-ب (v0.10): خدمة تقنية — رخص تحليل بيانات لقسم أحمد؛ جُهِّز الشراء (عروض أسعار) واعتُمد وحُجز الاعتماد وسُجِّلت ثلاثة عروض، وينتظر التقييم الفني (تقنية المعلومات) الآن
  [s, r] = createNeed(s, { requesterId: 'P-DEPT', beneficiaryId: 'P-DEPT', categoryId: 'techService', lines: [{ name: t2('رخص Power BI Pro (سنة)', 'Power BI Pro licences (1 year)'), qty: 10, unit: t2('رخصة', 'licence') }], justification: 'لوحات المعلومات التنفيذية للقطاع', estimatedValue: 42000, at: now - 8 * DAY });
  s = decide(s, r.id, 'approve', 'P-SARA', undefined, now - 8 * DAY + 2 * H);
  s = decide(s, r.id, 'approve', 'P-GM', undefined, now - 7 * DAY);
  s = decide(s, r.id, 'approve', 'P-ASG', undefined, now - 7 * DAY + 5 * H);
  s = specifyDecision(s, r.id, 'P-ITS', { specs: [{ lineId: 'L1', text: 'رخص Power BI Pro (سنة)', materialGroup: 'SW-LIC', unitPrice: 4200 }], note: 'الاشتراك السنوي أنسب' }, now - 6 * DAY);
  s = procurementDecision(s, r.id, 'P-MAJED', { estimatedValue: 42000, methodId: 'quotes', methodWhy: 'رخص متاحة لدى أكثر من موزّع معتمد', evaluatorPersonIds: ['P-ITS'], evaluatorWhy: 'الجهة الفنية للفئة' }, now - 5 * DAY);
  s = decide(s, r.id, 'approve', 'P-GM', 'بالإنابة عن مدير إدارة المشتريات (المنصب شاغر)', now - 5 * DAY + 4 * H);
  s = budgetDecision(s, r.id, 'P-BUDG', 'FM-2026-0760', now - 4 * DAY, undefined, 42000);
  s = quotesDecision(s, r.id, 'P-MAJED', { offers: [{ supplier: 'الموزّع المعتمد الأول', supplierId: 'BP-1000301', amount: 41500, validUntil: toISO(now + 30 * DAY), attachment: 'عرض-الموزع-المعتمد.pdf' }, { supplier: 'شركة الحلول الرقمية', supplierId: 'BP-1000302', amount: 43800, validUntil: toISO(now + 21 * DAY), attachment: 'عرض-الحلول-الرقمية.pdf' }, { supplier: 'مؤسسة التقنية المتقدمة', supplierId: 'BP-1000303', amount: 40900, validUntil: toISO(now + 14 * DAY), attachment: 'عرض-التقنية-المتقدمة.pdf' }] }, now - 3 * DAY);
  // R3-ج (v0.10): كرسي مكتب لفهد في مكتب أبوظبي — لا مستودع هناك فيُورَّد مباشرة؛ مرّ بفرع الشراء كاملاً (التجهيز والاعتماد والحجز والعروض والتقييم والترسية آلياً بقاعدة الاستثناء D-024 وطلب الشراء الآلي) وصدر أمر الشراء وينتظر الاستلام عند مسؤول المكتب
  [s, r] = createNeed(s, { requesterId: 'P-DEPT', beneficiaryId: 'P-FAHAD', categoryId: 'generalMaterial', lines: [{ catalogId: 'K-chair', name: t2('كرسي مكتب', 'Office chair'), qty: 1 }], justification: 'كرسي مكتب أبوظبي متهالك', at: now - 12 * DAY });
  s = decide(s, r.id, 'approve', 'P-SARA', undefined, now - 12 * DAY + 2 * H);
  s = decide(s, r.id, 'approve', 'P-GM', undefined, now - 11 * DAY);
  s = decide(s, r.id, 'approve', 'P-ASG', undefined, now - 11 * DAY + 3 * H);
  s = specifyDecision(s, r.id, 'P-GSS', { specs: [{ lineId: 'L1', itemId: 'M-200301' }], note: 'مطابق للمواصفة المعتمدة للكراسي' }, now - 10 * DAY);
  s = procurementDecision(s, r.id, 'P-MAJED', { estimatedValue: 950, methodId: 'quotes', methodWhy: 'أثاث متاح لدى عدة موردين في أبوظبي', evaluatorPersonIds: ['P-GSS'], evaluatorWhy: 'الجهة الفنية للفئة' }, now - 9 * DAY);
  s = decide(s, r.id, 'approve', 'P-GM', undefined, now - 9 * DAY + 3 * H);
  s = budgetDecision(s, r.id, 'P-BUDG', 'FM-2026-0771', now - 8 * DAY, undefined, 950);
  s = quotesDecision(s, r.id, 'P-MAJED', { offers: [{ supplier: 'معرض أبوظبي للأثاث', supplierId: 'BP-1000503', amount: 980, attachment: 'عرض-معرض-أبوظبي.pdf' }, { supplier: 'شركة المكاتب الحديثة', supplierId: 'BP-1000201', amount: 920, attachment: 'عرض-المكاتب-الحديثة.pdf' }, { supplier: 'مؤسسة التجهيزات المكتبية', supplierId: 'BP-1000203', amount: 960, attachment: 'عرض-التجهيزات-المكتبية.pdf' }] }, now - 8 * DAY + 5 * H);
  s = evaluationDecision(s, r.id, 'P-GSS', { offer: 'شركة المكاتب الحديثة', note: 'الأقل سعراً مع ضمان سنتين' }, now - 7 * DAY);
  /* الترسية اعتُمدت آلياً (أدنى عرض ضمن الحجز والعروض مكتملة) وأُنشئ طلب الشراء؛ ثم أمر الشراء */
  s = poDecision(s, r.id, 'P-MAJED', { expectedAt: toISO(now + 4 * DAY) }, now - 6 * DAY);
  // R3-د (v0.11، D-023): مقعد Microsoft 365 لخالد — تقنية المعلومات وفّرته من رصيدها بلا شراء، ووقّع خالد الاستلام فقُيِّد في عهدته الرقمية
  [s, r] = createNeed(s, { requesterId: 'P-DEPT', beneficiaryId: 'P-KHALID', categoryId: 'techService', lines: [{ catalogId: 'K-m365', name: t2('مقعد Microsoft 365 (بريد ومكتب)', 'Microsoft 365 seat (mail & office)'), qty: 1 }], justification: 'موظف جديد في قسم النظم يحتاج بريداً ومكتباً', at: now - 4 * DAY });
  s = decide(s, r.id, 'approve', 'P-SARA', undefined, now - 4 * DAY + 2 * H);
  s = decide(s, r.id, 'approve', 'P-GM', undefined, now - 3 * DAY);
  s = decide(s, r.id, 'approve', 'P-ASG', undefined, now - 3 * DAY + 3 * H);
  s = provideDecision(s, r.id, 'P-ITS', { items: [{ lineId: 'L1', poolId: 'POOL-M365', ref: 'M365-E3-0147' }], note: 'خُصِّص المقعد من الاتفاقية المؤسسية' }, now - 2 * DAY);
  s = handoverSign(s, r.id, 'P-KHALID', now - 2 * DAY + 1 * H);
  // R3-هـ (v0.12، D-027): عشر سماعات رأس لقسم التمكين الرقمي — اشتُريت، ووصلت ست منها فصدر محضر فحص واستلام للدفعة الأولى وسُلِّمت بسند، وتنتظر الدفعة الثانية عند المستودع التقني
  [s, r] = createNeed(s, { requesterId: 'P-DEPT', beneficiaryId: 'P-DEPT', categoryId: 'techMaterial', lines: [{ catalogId: 'K-headset', name: t2('سماعة رأس للاجتماعات', 'Meeting headset'), qty: 10 }], justification: 'سماعات اجتماعات لفريق التمكين الرقمي', at: now - 16 * DAY });
  s = decide(s, r.id, 'approve', 'P-SARA', undefined, now - 16 * DAY + 2 * H);
  s = decide(s, r.id, 'approve', 'P-GM', undefined, now - 15 * DAY);
  s = decide(s, r.id, 'approve', 'P-ASG', undefined, now - 15 * DAY + 3 * H);
  s = specifyDecision(s, r.id, 'P-ITS', { specs: [{ lineId: 'L1', itemId: 'M-100204' }], note: 'المعيار المعتمد للسماعات' }, now - 14 * DAY);
  s = storeDecision(s, r.id, 'P-STORE2', [{ lineId: 'L1', action: 'purchase' }], now - 13 * DAY, 'لا سماعات في المخزون');
  s = procurementDecision(s, r.id, 'P-MAJED', { estimatedValue: 3200, methodId: 'quotes', methodWhy: 'متاحة لدى عدة موردين', evaluatorPersonIds: ['P-ITS'], evaluatorWhy: 'الجهة الفنية للفئة' }, now - 12 * DAY);
  s = decide(s, r.id, 'approve', 'P-GM', undefined, now - 12 * DAY + 3 * H);
  s = budgetDecision(s, r.id, 'P-BUDG', 'FM-2026-0752', now - 11 * DAY, undefined, 3200);
  s = quotesDecision(s, r.id, 'P-MAJED', { offers: [{ supplier: 'الموزّع المعتمد الأول', supplierId: 'BP-1000301', amount: 3100, attachment: 'عرض-الموزع-المعتمد-سماعات.pdf' }, { supplier: 'شركة الحلول الرقمية', supplierId: 'BP-1000302', amount: 3300, attachment: 'عرض-الحلول-الرقمية-سماعات.pdf' }, { supplier: 'مؤسسة التقنية المتقدمة', supplierId: 'BP-1000303', amount: 3250, attachment: 'عرض-التقنية-المتقدمة-سماعات.pdf' }] }, now - 10 * DAY);
  s = evaluationDecision(s, r.id, 'P-ITS', { offer: 'الموزّع المعتمد الأول', note: 'الأدنى ومطابق للمعيار' }, now - 9 * DAY);
  s = poDecision(s, r.id, 'P-MAJED', { expectedAt: toISO(now - 3 * DAY) }, now - 8 * DAY);
  s = receiptStart(s, r.id, 'P-STORE2', { supplierNote: { no: 'DN-77812', date: toISO(now - 3 * DAY) }, lines: [{ lineId: 'L1', delivered: 6, accepted: 6, result: 'ok' }], notes: 'وصلت ست سماعات من عشر؛ يورّد المورّد الباقي خلال أسبوع' }, now - 3 * DAY);
  s = handoverStart(s, r.id, 'P-STORE2', now - 3 * DAY + 2 * H);
  s = handoverSign(s, r.id, 'P-DEPT', now - 3 * DAY + 3 * H);
  // v0.13: التعاميم التي تطلب التأكيد تُبلَّغ لحظة نشرها، والتذكير بعد المهلة لمن لم يؤكد (13/2026 نُشر قبل ستة أيام فذُكِّر به قبل ثلاثة)
  for (const p of s.posts) s = circularNotification(s, p);
  s = commsTick(s, now - 3 * DAY);
  // تنبيهات انتهاء المستندات
  s = expiryNotification(s, 'P-AHMED', { ar: 'رخصة القيادة', en: 'Driving licence' }, 14, now - 1 * H, '#/me/docs');
  s = expiryNotification(s, 'P-AHMED', { ar: 'البطاقة الإدارية', en: 'Administrative card' }, 19, now - 2 * DAY, '#/me/docs');
  // ترتيب التنبيهات زمنياً، وتعليم القديمة مقروءة
  s.notifications = s.notifications.slice().sort((a, b) => b.at - a.at).map((n) => (now - n.at > 3 * DAY ? { ...n, read: true } : n));
  return s;
}
