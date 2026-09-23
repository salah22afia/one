/* v0.13 «اليوم»: بذرة المنشورات والقصص والتقويم (تجريبية للعرض؛ الأغلفة رسوم على الهوية حتى تأتي الصور الحقيقية من القطاعات).
   القطاعات الناشرة ومناصبها في سياسة الأخبار والقصص (domain/policy.ts: seedCommsPolicy). */
import type { T2, Post, Story, CalEvent } from '../domain/types';

const t2 = (ar: string, en: string): T2 => ({ ar, en });
const H = 3600000, D = 86400000;

export function seedStories(now: number): Story[] {
  return [
    { id: 'st-sg', sectorId: 'SEC-SG', publisherId: 'P-MEDM', slides: [
      { id: 's-sg-1', cover: { art: 'type', hue: 'green', text: '٩٦' }, caption: t2('الثلاثاء 22 سبتمبر: احتفال الأمانة العامة باليوم الوطني السعودي', 'Tuesday 22 September: the Secretariat celebrates Saudi National Day'), sub: t2('البهو الرئيسي · 9:00 صباحاً', 'Main lobby · 9:00 am'), at: now - 2 * H },
      { id: 's-sg-2', cover: { art: 'gems', hue: 'green' }, caption: t2('بوابة الخدمات الموحدة تبدأ موجتها الأولى: إجازتك واحتياجك من مكان واحد', 'The unified services portal starts its first wave: your leave and your needs from one place'), at: now - 2 * H + 60000 },
    ] },
    { id: 'st-it', sectorId: 'SEC-140', publisherId: 'P-ITS', slides: [
      { id: 's-it-1', cover: { art: 'star', hue: 'teal' }, caption: t2('تحديث الشبكة اللاسلكية في المبنى الرئيسي هذا الأسبوع', 'Wi-Fi upgrade in the main building this week'), sub: t2('قد ينقطع الاتصال دقائق بين 5 و6 مساءً', 'Brief disconnections between 5 and 6 pm'), at: now - 4 * H },
      { id: 's-it-2', cover: { art: 'bokeh', hue: 'teal' }, caption: t2('ورشة الأمن السيبراني للموظفين: الأربعاء 10 صباحاً، قاعة التدريب', 'Cybersecurity workshop for staff: Wednesday 10 am, training hall'), at: now - 4 * H + 90000 },
      { id: 's-it-3', cover: { art: 'grid', hue: 'night' }, caption: t2('صورة من غرفة الخوادم بعد التحديث', 'From the server room after the upgrade'), at: now - 4 * H + 120000 },
    ] },
    { id: 'st-hr', sectorId: 'SEC-200', publisherId: 'P-HRS2', slides: [
      { id: 's-hr-1', cover: { art: 'dunes', hue: 'gold' }, caption: t2('فتح باب الترشيح لبرنامج القيادات الواعدة 2027', 'Nominations open for the Emerging Leaders programme 2027'), sub: t2('حتى 15 أكتوبر · عبر مديرك المباشر', 'Until 15 October · through your line manager'), at: now - 6 * H },
      { id: 's-hr-2', cover: { art: 'waves', hue: 'sage' }, caption: t2('سياسة الإجازات 2026.2 تسري من 1 أكتوبر: اقرأ التعميم وأكّد اطلاعك', 'Leave policy 2026.2 takes effect 1 October: read the circular and acknowledge it'), at: now - 6 * H + 60000 },
    ] },
    { id: 'st-af', sectorId: 'SEC-300', publisherId: 'P-SARA', slides: [
      { id: 's-af-1', cover: { art: 'arch', hue: 'cream' }, caption: t2('الرواتب تُودع الخميس 24 سبتمبر', 'Salaries are deposited Thursday 24 September'), at: now - 9 * H },
      { id: 's-af-2', cover: { art: 'gems', hue: 'gold' }, caption: t2('تكريم فريق التحول الرقمي على إنجاز سجل الإجراءات', 'The digital transformation team honoured for completing the procedures register'), at: now - 9 * H + 60000 },
    ] },
    { id: 'st-pr', sectorId: 'SEC-160', publisherId: 'P-PROTM', slides: [
      { id: 's-pr-1', cover: { art: 'arch', hue: 'bronze' }, caption: t2('تجهيزات القاعة الكبرى لاجتماعات الأسبوع القادم', 'Preparing the Grand Hall for next week’s meetings'), at: now - 20 * H },
    ] },
    { id: 'st-ad', sectorId: 'SEC-190', publisherId: 'P-AUH', slides: [
      { id: 's-ad-1', cover: { art: 'bokeh', hue: 'night' }, caption: t2('مكتب أبوظبي: ساعات العمل الجديدة من الأحد', 'Abu Dhabi office: new working hours from Sunday'), sub: t2('8:00 – 3:30', '8:00 – 3:30'), at: now - 22 * H },
      { id: 's-ad-2', cover: { art: 'dunes', hue: 'night' }, caption: t2('غروب من نافذة المكتب الجديد', 'Sunset from the new office window'), at: now - 22 * H + 60000 },
    ] },
  ];
}

export function seedPosts(now: number): Post[] {
  return [
    { id: 'p-1', kind: 'circular', number: '14/2026', sectorId: 'SEC-200', publisherId: 'P-HRS2', source: t2('الإدارة العامة للموارد البشرية', 'GA for Human Resources'), title: t2('تحديث سياسة الإجازات: الإصدار 2026.2 يسري من 1 أكتوبر', 'Leave policy update: version 2026.2 takes effect 1 October'), summary: t2('نافذة الإجازة السنوية تصير 15 يوماً قبل بدايتها، وتُضاف الإجازة الدراسية بموسم. تأكيد الاطلاع مطلوب من الجميع.', 'The annual-leave window becomes 15 days before the start, and study leave is added with a season. Everyone must acknowledge.'),
      body: [t2('استناداً إلى صلاحيات مدير النظام في مركز السياسات، صدر الإصدار 2026.2 من سياسة الإجازات ويسري اعتباراً من 1 أكتوبر 2026 على الطلبات المقدَّمة من ذلك التاريخ؛ وتكمل الطلبات الجارية بإصدارها.', 'Under the policy centre’s governance, version 2026.2 of the leave policy was issued and applies from 1 October 2026 to requests submitted from that date; in-flight requests continue under their version.'), t2('ما تغيّر: أولاً، نافذة التقديم للإجازة السنوية 15 يوماً قبل بدايتها بدل 10. ثانياً، إضافة «إجازة دراسية» بموسم يشغّله مدير النظام. ثالثاً، تصحيح صياغة استحقاق التذاكر لمن يعمل خارج موطنه.', 'What changed: first, the annual-leave submission window is 15 days before the start instead of 10. Second, “study leave” is added with a season operated by the administrator. Third, the wording of the ticket entitlement for staff working outside their home country is corrected.'), t2('يرجى الاطلاع وتأكيد ذلك من الزر أدناه؛ يُسجَّل التأكيد باسمك ووقته في سجل التعميم.', 'Please read and confirm with the button below; the confirmation is recorded with your name and time in the circular’s register.')],
      cover: { art: 'waves', hue: 'sage' }, at: now - 1 * D, readMin: 2, requiresAck: true, ackCount: 132, ackDue: now + 6 * D, attachments: [{ name: 'سياسة الإجازات — الإصدار 2026.2.pdf', size: '1.2 MB' }, { name: 'ملحق التعديل.pdf', size: '180 KB' }], link: { label: t2('افتح مركز السياسات', 'Open the policy centre'), href: '#/admin/policy' } },
    { id: 'p-2', kind: 'event', sectorId: 'SEC-SG', publisherId: 'P-MEDM', source: t2('الإدارة الإعلامية', 'Media Department'), title: t2('احتفال الأمانة العامة باليوم الوطني السعودي الـ96', 'The Secretariat celebrates the 96th Saudi National Day'), summary: t2('الثلاثاء 22 سبتمبر في البهو الرئيسي: كلمة، وعرض، وضيافة. الحضور بالزي الوطني مرحَّب به.', 'Tuesday 22 September in the main lobby: a word, a show and hospitality. National dress is welcome.'),
      body: [t2('تدعو الإدارة الإعلامية جميع منسوبي الأمانة العامة إلى الاحتفال باليوم الوطني للمملكة العربية السعودية، الثلاثاء 22 سبتمبر 2026، من الساعة 9:00 إلى 11:00 صباحاً في البهو الرئيسي.', 'The Media Department invites all staff to celebrate the National Day of the Kingdom of Saudi Arabia on Tuesday 22 September 2026, 9:00–11:00 am in the main lobby.'), t2('البرنامج: كلمة الأمين العام المساعد، عرض مرئي، ثم ضيافة. الأربعاء 23 سبتمبر إجازة رسمية.', 'Programme: a word by the Assistant Secretary-General, a short film, then hospitality. 23 September is an official holiday.')],
      cover: { art: 'type', hue: 'green', text: '٩٦' }, at: now - 3 * H, readMin: 1, eventAt: now + 3 * D, place: t2('البهو الرئيسي', 'Main lobby') },
    { id: 'p-3', kind: 'news', sectorId: 'SEC-300', publisherId: 'P-SARA', source: t2('إدارة تمكين الأعمال', 'Business Enablement Department'), title: t2('بوابة الخدمات الموحدة: الموجة الأولى تبدأ بطلب الإجازة و«أحتاج شيئاً»', 'The unified services portal: wave one starts with leave and “I need something”'), summary: t2('إجراءان من مكان واحد على هاتفك وحاسوبك، بإشعار عند كل خطوة، ومستندات تصدر إلكترونياً برمز تحقق.', 'Two procedures from one place on your phone and computer, a notification at every step, and documents issued electronically with a verification code.'),
      body: [t2('بدأت الإدارة العامة للشؤون المالية والإدارية تشغيل الموجة الأولى من بوابة الخدمات الموحدة: طلب الإجازة بسياسة يديرها مدير النظام، وطلب الاحتياج من الكتالوج أو بالوصف حتى التسليم والاستلام.', 'The GA for Financial and Administrative Affairs started the first wave of the unified services portal: leave requests under an administrator-managed policy, and need requests from the catalogue or by description through to handover.'), t2('يُقاس نجاح الموجة بثلاثة أشياء: أن يعرف الموظف أين طلبه في كل لحظة، وألا يكتب رقماً يصدره النظام المرجعي، وأن يتغير كل معامل من الشاشة لا من الكود.', 'The wave is judged by three things: the employee always knows where the request is, nobody types a number the ERP issues, and every parameter changes from the screen, not the code.')],
      cover: { art: 'gems', hue: 'green' }, at: now - 2 * D, readMin: 3 },
    { id: 'p-4', kind: 'circular', number: '15/2026', sectorId: 'SEC-300', publisherId: 'P-SARA', source: t2('إدارة الخدمات العامة', 'General Services Department'), title: t2('صيانة مواقف الطابق السفلي من 20 إلى 24 سبتمبر', 'Basement car-park maintenance, 20–24 September'), summary: t2('تُغلق المواقف السفلية أسبوعاً؛ المواقف البديلة في الساحة الشرقية بتصريحكم الحالي.', 'The basement car park closes for a week; alternative parking in the east yard with your current permit.'),
      body: [t2('تُجرى أعمال صيانة أرضية المواقف السفلية من الأحد 20 حتى الخميس 24 سبتمبر. يرجى استخدام الساحة الشرقية، ويسري تصريح الدخول الحالي عليها.', 'Floor maintenance in the basement car park runs from Sunday 20 to Thursday 24 September. Please use the east yard; the current access permit applies.')],
      cover: { art: 'grid', hue: 'bronze' }, at: now - 5 * H, readMin: 1, requiresAck: false, attachments: [{ name: 'مخطط المواقف البديلة.pdf', size: '640 KB' }] },
    { id: 'p-5', kind: 'news', sectorId: 'SEC-300', publisherId: 'P-SARA', source: t2('مكتب المدير العام', 'Office of the Director General'), title: t2('تكريم فريق التحول الرقمي لإنجاز سجل الإجراءات', 'Digital transformation team honoured for the procedures register'), summary: t2('78 خدمة في 16 مجالاً وُصفت ورُتّبت في موجات؛ الفريق كرّمه المدير العام في اجتماع الإدارة.', '78 services in 16 domains described and sequenced into waves; the Director General honoured the team at the management meeting.'),
      body: [t2('كرّم المدير العام للشؤون المالية والإدارية فريق التحول الرقمي على إنجاز سجل الإجراءات الذي صار أساس بوابة الخدمات الموحدة.', 'The Director General honoured the digital transformation team for completing the procedures register that became the basis of the unified services portal.')],
      cover: { art: 'bokeh', hue: 'gold' }, at: now - 3 * D, readMin: 1 },
    { id: 'p-6', kind: 'event', sectorId: 'SEC-140', publisherId: 'P-ITS', source: t2('إدارة تقنية المعلومات', 'Information Technology Department'), title: t2('ورشة: الذكاء الاصطناعي في العمل الإداري', 'Workshop: AI in administrative work'), summary: t2('الأربعاء 30 سبتمبر، قاعة التدريب، 10–12. مقاعد محدودة؛ سجّل من الخدمات.', 'Wednesday 30 September, training hall, 10–12. Limited seats; register from Services.'),
      body: [t2('ورشة عملية لموظفي القطاع عن استخدام أدوات الذكاء الاصطناعي في الصياغة والتحليل وإعداد العروض، مع أمثلة من عملنا اليومي.', 'A hands-on workshop for sector staff on using AI tools for drafting, analysis and presentations, with examples from our daily work.')],
      cover: { art: 'star', hue: 'teal' }, at: now - 8 * H, readMin: 1, eventAt: now + 11 * D, place: t2('قاعة التدريب', 'Training hall') },
    { id: 'p-7', kind: 'news', sectorId: 'SEC-190', publisherId: 'P-AUH', source: t2('مكتب أبوظبي', 'Abu Dhabi Office'), title: t2('مكتب أبوظبي ينتقل إلى مقره الجديد', 'The Abu Dhabi office moves to its new premises'), summary: t2('ابتداءً من الأحد؛ العنوان الجديد في ملف المكتب، ومسؤول الاستلام والتسليم كما هو.', 'From Sunday; the new address is in the office profile, and the receipt-and-handover officer is unchanged.'),
      body: [t2('انتقل مكتب أبوظبي إلى مقره الجديد؛ التوريدات للمكتب تُوجَّه إلى العنوان الجديد تلقائياً من سياسة الاحتياج.', 'The Abu Dhabi office has moved; deliveries to the office are routed to the new address automatically from the need policy.')],
      cover: { art: 'arch', hue: 'night' }, at: now - 4 * D, readMin: 1 },
    { id: 'p-8', kind: 'circular', number: '13/2026', sectorId: 'SEC-200', publisherId: 'P-HRS2', source: t2('الإدارة العامة للموارد البشرية', 'GA for Human Resources'), title: t2('تحديث بيانات الاتصال في «ملفي» قبل نهاية سبتمبر', 'Update your contact details in “Me” before the end of September'), summary: t2('الهاتف، وجهة الاتصال في الطوارئ، والعنوان الوطني؛ تُقرأ من النظام المرجعي وتُصحَّح من البوابة.', 'Phone, emergency contact and national address; read from the ERP and corrected from the portal.'),
      body: [t2('يرجى مراجعة بيانات الاتصال في «ملفي» وتحديث ما تغيّر قبل 30 سبتمبر؛ التحديث يُرحَّل إلى النظام المرجعي بعد اعتماد شؤون الموظفين.', 'Please review your contact details in “Me” and update what changed before 30 September; updates post to the ERP after Personnel Affairs approval.')],
      cover: { art: 'dunes', hue: 'cream' }, at: now - 6 * D, readMin: 1, requiresAck: true, ackCount: 412, ackDue: now + 10 * D, link: { label: t2('افتح ملفي', 'Open Me'), href: '#/me' } },
  ];
}

export function seedCalendar(now: number): CalEvent[] {
  return [
    { id: 'c-1', title: t2('اليوم الوطني السعودي', 'Saudi National Day'), at: now + 4 * D, kind: 'holiday', sub: t2('إجازة رسمية', 'Official holiday') },
    { id: 'c-2', title: t2('إيداع الرواتب', 'Salary deposit'), at: now + 5 * D, kind: 'pay' },
    { id: 'c-3', title: t2('ورشة الذكاء الاصطناعي', 'AI workshop'), at: now + 11 * D, kind: 'event', sub: t2('قاعة التدريب · 10 ص', 'Training hall · 10 am') },
  ];
}

