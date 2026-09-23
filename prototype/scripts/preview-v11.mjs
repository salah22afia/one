// معاينات v0.11 بدقة مضاعفة للتسليم: التوفير من رصيد الجهة، وتوقيع المستفيد، والعهدة الرقمية، وصف العرض الجديد، واعتماد الترسية عند انحراف، وسياسة الاحتياج (رصيد الجهات، الموردون والعقود، القواعد)
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import path from 'node:path';
import fs from 'node:fs';
const file = 'file://' + path.resolve('dist/index.html');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
const ph = { width: 400, height: 860 }; const lap = { width: 1440, height: 900 };
fs.mkdirSync('shots/v11-preview', { recursive: true });
const ctx = await b.newContext({ viewport: lap, deviceScaleFactor: 2, colorScheme: 'light' }); const p = await ctx.newPage();
await p.goto(file + '#/home', { waitUntil: 'load' }); await p.waitForTimeout(800);
const mutate = (fn) => p.evaluate((src) => { const s = JSON.parse(localStorage.getItem('usp-portal-v1')); (new Function('s', src))(s); localStorage.setItem('usp-portal-v1', JSON.stringify(s)); }, fn);
const as = async (id, hash, vp = lap, dark = false) => { await mutate(id === 'admin' ? `s.settings.persona = 'admin'; s.settings.actAs = undefined; s.settings.theme = '${dark ? 'dark' : 'light'}';` : `const w = s.people.find((x) => x.id === '${id}'); s.settings.persona = w.persona; s.settings.actAs = '${id}'; s.settings.theme = '${dark ? 'dark' : 'light'}';`); await p.setViewportSize(vp); await p.goto(file + hash); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1500); };
const shot = (n, full = true) => p.screenshot({ path: `shots/v11-preview/${n}.png`, fullPage: full });
const openTask = async (who, id) => { await as(who, '#/inbox'); const rows = p.locator('.split .row'); const n = await rows.count(); for (let i = 0; i < n; i++) { await rows.nth(i).locator('.cell').click(); await p.waitForTimeout(450); const t = await p.locator('.split-detail .mono').first().textContent().catch(() => ''); if (t.trim() === id) return; } throw new Error('task ' + id + ' not found for ' + who); };

const primary = (text) => p.locator('.split-detail .btn.primary', { hasText: text });
const ATT = (n) => path.resolve(`shots/v11/tmp/${n}`);
/* 1 مقعد Microsoft 365 لأحمد: المعاينة تعرض مقطع التوفير (هاتف) */
await as('P-DEPT', '#/new/AS-01', ph);
await p.locator('.chips .pill', { hasText: 'لموظف في وحدتي' }).click(); await p.waitForTimeout(200); await p.selectOption('#ben', 'P-AHMED');
await p.locator('.type-row', { hasText: 'خدمة تقنية' }).click(); await p.waitForTimeout(600); await p.locator('.need-k', { hasText: 'مقعد Microsoft 365' }).first().click(); await p.waitForTimeout(300);
await p.locator('.btn.primary.block', { hasText: 'التالي' }).click(); await p.waitForTimeout(500); await p.fill('#n-why', 'بريد ومكتب لأحمد بعد نقله إلى القسم'); await p.locator('.btn.primary.block', { hasText: 'المراجعة' }).click(); await p.waitForTimeout(700);
await shot('معاينة v0.11 — المراجعة: مقطع «إن وفّرته الجهة الفنية من رصيدها» قبل الشراء (هاتف)');
await p.locator('.btn.primary.block', { hasText: 'إرسال الاحتياج' }).click(); await p.waitForTimeout(1500); const id = (await p.locator('.success-id').textContent()).trim();
for (const who of ['P-SARA', 'P-GM', 'P-ASG']) { await openTask(who, id); await primary('اعتماد').first().click(); await p.waitForTimeout(600); }
/* 2 مهمة تقنية المعلومات بثلاثة أوضاع، ولوحة التوفير من الرصيد (حاسوب) */
await openTask('P-ITS', id); await p.waitForTimeout(500); await shot('معاينة v0.11 — الجهة الفنية: ثلاثة أوضاع (اعتماد وتحديد، متوفر لدينا، ليست من اختصاصنا) (حاسوب)');
await p.locator('.split-detail .np-mode .pill', { hasText: 'متوفر لدينا' }).click(); await p.waitForTimeout(400); await p.fill('input[id^="np-ref-"]', 'M365-E3-0150');
await shot('معاينة v0.11 — التوفير من رصيد الجهة: الرصيد والمتبقي ومرجع التخصيص (حاسوب)');
await primary('توفير من رصيدنا وبدء التسليم').click(); await p.waitForTimeout(900);
/* 3 أحمد يوقّع على الهاتف ثم عهدته الرقمية */
await as('P-AHMED', '#/inbox', ph); { const rows = p.locator('.row'); const n = await rows.count(); for (let i = 0; i < n; i++) { await rows.nth(i).locator('.cell').click(); await p.waitForTimeout(700); const t = await p.locator('.sheet .mono').first().textContent().catch(() => ''); if (t.trim() === id) break; await p.keyboard.press('Escape'); await p.waitForTimeout(300); } }
await shot('معاينة v0.11 — المستفيد يوقّع استلام ما وُفِّر من الرصيد (هاتف)', false); await p.locator('.sheet .btn.primary', { hasText: 'أوقّع الاستلام' }).click(); await p.waitForTimeout(900);
await as('P-DEPT', `#/requests/${id}`, ph); await shot('معاينة v0.11 — الطلب: وُفِّر من رصيد الجهة وتُخُطِّي الشراء والموازنة (هاتف)');
await as('P-AHMED', '#/me/custody', ph); await shot('معاينة v0.11 — عهدتي: العهدة الرقمية بمرجعها (هاتف)', false);
/* 4 صف العرض الجديد: المورّد من القائمة والعملة والمستند (حاسوب) على احتياج كرسي */
await as('P-DEPT', '#/new/AS-01'); await p.locator('.type-row', { hasText: 'مادة عامة' }).click(); await p.waitForTimeout(600); await p.locator('.need-k', { hasText: 'كرسي مكتب' }).first().click(); await p.waitForTimeout(300);
await p.locator('.btn.primary.block', { hasText: 'التالي' }).click(); await p.waitForTimeout(500); await p.fill('#n-why', 'كرسي بدل التالف'); await p.locator('.btn.primary.block', { hasText: 'المراجعة' }).click(); await p.waitForTimeout(600); await p.locator('.btn.primary.block', { hasText: 'إرسال الاحتياج' }).click(); await p.waitForTimeout(1500); const id2 = (await p.locator('.success-id').textContent()).trim();
for (const who of ['P-SARA', 'P-GM', 'P-ASG']) { await openTask(who, id2); await primary('اعتماد').first().click(); await p.waitForTimeout(600); }
await openTask('P-GSM', id2); await primary('اعتماد وتحديد الصنف').click(); await p.waitForTimeout(600);
await openTask('P-STORE1', id2); await p.locator('.split-detail .np-choice .pill', { hasText: 'تحويل إلى الشراء' }).click(); await primary('تأكيد قرار المستودع').click(); await p.waitForTimeout(600);
await openTask('P-MAJED', id2); await p.fill('#np-methodwhy', 'الأثاث متاح لدى عدة موردين'); await p.locator('.split-detail .chips .pill', { hasText: 'الجهة الفنية للفئة' }).click(); await p.fill('#np-evalwhy', 'الأثاث من اختصاص الخدمات العامة'); await primary('تجهيز الشراء وإرساله للاعتماد').click(); await p.waitForTimeout(600);
await openTask('P-GM', id2); await primary('اعتماد').first().click(); await p.waitForTimeout(600);
await openTask('P-BUDG', id2); await p.fill('#np-budget', 'FM-2026-0511'); await primary('حجز الاعتماد وتأكيده').click(); await p.waitForTimeout(600);
await openTask('P-MAJED', id2);
const offers = [['BP-1000201', '920'], ['BP-1000202', '980'], ['new', '1010']];
for (let i = 0; i < 3; i++) { while ((await p.locator('.split-detail .np-offer-row').count()) < i + 1) { await p.locator('.split-detail .btn.soft', { hasText: 'إضافة عرض' }).click(); await p.waitForTimeout(120); } const row = p.locator('.split-detail .np-offer-row').nth(i); await row.locator('select.np-offer-sup').selectOption(offers[i][0]); if (offers[i][0] === 'new') { await p.waitForTimeout(100); await row.locator('input.np-offer-new').fill('مؤسسة الأثاث الجديدة'); } await row.locator('input.np-offer-amt').fill(offers[i][1]); if (i < 2) await p.setInputFiles(`#np-att-${i}`, ATT(`offer-${i + 1}.pdf`)); }
await shot('معاينة v0.11 — جمع العروض: المورّد من قائمة النظام المرجعي والعملة ومستند كل عرض (حاسوب)');
await p.setInputFiles('#np-att-2', ATT('offer-3.pdf')); await p.waitForTimeout(200); await primary('تسجيل العروض').click(); await p.waitForTimeout(700);
/* 5 التوصية بعرض ليس الأدنى → اعتماد الترسية بسببه (حاسوب) */
await openTask('P-GSM', id2); await p.locator('.split-detail .np-pick-row', { hasText: 'معرض الأثاث الوطني' }).click(); await p.fill('#np-evalnote', 'الأعلى جودة مع ضمان خمس سنوات'); await primary('إرسال التوصية').click(); await p.waitForTimeout(800);
await openTask('P-GM', id2); await p.waitForTimeout(400); await shot('معاينة v0.11 — اعتماد الترسية عند انحراف: السبب وملف الشراء في الملخص (حاسوب)');
/* 6 سياسة الاحتياج: رصيد الجهات، والموردون والعقود، والقواعد */
await as('admin', '#/admin/need'); await p.locator('.segmented button', { hasText: 'رصيد الجهات' }).click(); await p.waitForTimeout(600); await shot('معاينة v0.11 — سياسة الاحتياج: رصيد الجهات (حاسوب)');
await p.locator('.pt-card', { hasText: 'Microsoft 365' }).click(); await p.waitForTimeout(700); await shot('معاينة v0.11 — رصيد الجهة: التعريف بإصدار والرصيد الجاري تشغيلاً (حاسوب)', false); await p.keyboard.press('Escape'); await p.waitForTimeout(400);
await p.locator('.segmented button', { hasText: 'الموردون والعقود' }).click(); await p.waitForTimeout(600); await shot('معاينة v0.11 — سياسة الاحتياج: الموردون والعقود من النظام المرجعي (حاسوب)');
await p.locator('.segmented button', { hasText: 'القواعد' }).click(); await p.waitForTimeout(600); await shot('معاينة v0.11 — القواعد: اعتماد الترسية بالاستثناء والمرفق الإلزامي (حاسوب)');
await ctx.close(); await b.close(); console.log('done', id, id2);
