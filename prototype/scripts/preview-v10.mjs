// معاينات v0.10 بدقة مضاعفة للتسليم: المعالج بالكتالوج (هاتف)، وتحديد الصنف (حاسوب)، وتجهيز الشراء (حاسوب)، واعتماد الشراء بملخصه (هاتف)، والعروض والتقييم (حاسوب)، والطلب بمقاطعه الستة (هاتف)، وجدول الصلاحيات في سياسة الاحتياج (حاسوب)
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import path from 'node:path';
import fs from 'node:fs';
const file = 'file://' + path.resolve('dist/index.html');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
const ph = { width: 400, height: 860 }; const lap = { width: 1440, height: 900 };
fs.mkdirSync('shots/v10-preview', { recursive: true });
const ctx = await b.newContext({ viewport: lap, deviceScaleFactor: 2, colorScheme: 'light' }); const p = await ctx.newPage();
await p.goto(file + '#/home', { waitUntil: 'load' }); await p.waitForTimeout(800);
const mutate = (fn) => p.evaluate((src) => { const s = JSON.parse(localStorage.getItem('usp-portal-v1')); (new Function('s', src))(s); localStorage.setItem('usp-portal-v1', JSON.stringify(s)); }, fn);
const as = async (id, hash, vp = lap, dark = false) => { await mutate(id === 'admin' ? `s.settings.persona = 'admin'; s.settings.actAs = undefined; s.settings.theme = '${dark ? 'dark' : 'light'}';` : `const w = s.people.find((x) => x.id === '${id}'); s.settings.persona = w.persona; s.settings.actAs = '${id}'; s.settings.theme = '${dark ? 'dark' : 'light'}';`); await p.setViewportSize(vp); await p.goto(file + hash); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1500); };
const shot = (n, full = true) => p.screenshot({ path: `shots/v10-preview/${n}.png`, fullPage: full });
const openTask = async (who, id) => { await as(who, '#/inbox'); const rows = p.locator('.split .row'); const n = await rows.count(); for (let i = 0; i < n; i++) { await rows.nth(i).locator('.cell').click(); await p.waitForTimeout(450); const t = await p.locator('.split-detail .mono').first().textContent().catch(() => ''); if (t.trim() === id) return; } throw new Error('task ' + id + ' not found for ' + who); };
const primary = (text) => p.locator('.split-detail .btn.primary', { hasText: text });
/* 1 المعالج على الهاتف: الكتالوج بأسماء مألوفة وسعر استرشادي، ثم المراجعة بمسارها */
await as('P-DEPT', '#/new/AS-01', ph);
await p.locator('.chips .pill', { hasText: 'لموظف في وحدتي' }).click(); await p.waitForTimeout(200); await p.selectOption('#ben', 'P-AHMED');
await p.locator('.type-row', { hasText: 'مادة تقنية' }).click(); await p.waitForTimeout(600); await p.locator('.need-k', { hasText: 'حاسوب محمول' }).first().click(); await p.waitForTimeout(300);
await shot('معاينة v0.10 — أحتاج شيئاً على الهاتف (كتالوج بأسماء مألوفة وسعر استرشادي)');
await p.locator('.btn.primary.block', { hasText: 'التالي' }).click(); await p.waitForTimeout(500); await p.fill('#n-why', 'جهاز لأحمد بدل جهازه المتعطل'); await p.locator('.btn.primary.block', { hasText: 'المراجعة' }).click(); await p.waitForTimeout(1600);
await shot('معاينة v0.10 — المراجعة والمسار المنقّح بمقاطعه (هاتف)');
await p.locator('.btn.primary.block', { hasText: 'إرسال الاحتياج' }).click(); await p.waitForTimeout(1500); const id = (await p.locator('.success-id').textContent()).trim();
for (const who of ['P-SARA', 'P-GM', 'P-ASG']) { await openTask(who, id); await primary('اعتماد').first().click(); await p.waitForTimeout(600); }
/* 2 تحديد الصنف عند تقنية المعلومات (حاسوب) */
await openTask('P-ITS', id); await p.waitForTimeout(600); await shot('معاينة v0.10 — الجهة الفنية: الاعتماد وتحديد الصنف (حاسوب)');
await primary('اعتماد وتحديد الصنف').click(); await p.waitForTimeout(600);
await openTask('P-STORE2', id); await p.locator('.split-detail .np-choice .pill', { hasText: 'تحويل إلى الشراء' }).click(); await primary('تأكيد قرار المستودع').click(); await p.waitForTimeout(600);
/* 3 تجهيز الشراء (حاسوب) */
await openTask('P-MAJED', id); await p.fill('#np-methodwhy', 'الطراز متاح لدى ثلاثة موزّعين معتمدين'); await p.locator('.split-detail .chips .pill', { hasText: 'الجهة الفنية للفئة' }).click(); await p.fill('#np-evalwhy', 'الجهة الفنية للفئة'); await p.waitForTimeout(300);
await shot('معاينة v0.10 — مكتب المشتريات: تجهيز الشراء وطريقته (حاسوب)');
await primary('تجهيز الشراء وإرساله للاعتماد').click(); await p.waitForTimeout(600);
/* 4 اعتماد الشراء بملخصه على الهاتف */
await as('P-GM', '#/inbox', ph); const rows = p.locator('.row'); const n = await rows.count(); for (let i = 0; i < n; i++) { await rows.nth(i).locator('.cell').click(); await p.waitForTimeout(700); const t = await p.locator('.sheet .mono').first().textContent().catch(() => ''); if (t.trim() === id) break; await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
await shot('معاينة v0.10 — اعتماد الشراء بجدول الصلاحيات وملخص الشراء (هاتف)', false);
await p.locator('.sheet .btn.primary', { hasText: 'اعتماد' }).first().click(); await p.waitForTimeout(700);
await openTask('P-BUDG', id); await p.fill('#np-budget', 'FM-2026-0501'); await shot('معاينة v0.10 — الموازنة: الاعتماد المبدئي وحجز الاعتماد (حاسوب)'); await primary('حجز الاعتماد وتأكيده').click(); await p.waitForTimeout(600);
/* 5 العروض والتقييم */
await openTask('P-MAJED', id); const offers = [['شركة التقنية الأولى', '4650'], ['موزّع الأجهزة المعتمد', '4790'], ['مؤسسة الحاسبات', '4880']]; for (let i = 0; i < 3; i++) { const row = p.locator('.split-detail .np-offer-row').nth(i); await row.locator('input').nth(0).fill(offers[i][0]); await row.locator('input').nth(1).fill(offers[i][1]); }
await shot('معاينة v0.10 — مكتب المشتريات: جمع العروض (حاسوب)'); await primary('تسجيل العروض').click(); await p.waitForTimeout(600);
await openTask('P-ITS', id); await p.locator('.split-detail .np-pick-row').first().click(); await p.fill('#np-evalnote', 'مطابق للمعيار والأقل سعراً'); await shot('معاينة v0.10 — التقييم الفني والتوصية (حاسوب)'); await primary('إرسال التوصية').click(); await p.waitForTimeout(600);
await openTask('P-GM', id); await primary('اعتماد').first().click(); await p.waitForTimeout(800);
await openTask('P-MAJED', id); await p.fill('#np-po', '4500013001'); await p.fill('#np-exp', new Date(Date.now() + 12 * 86400000).toISOString().slice(0, 10)); await primary('تسجيل أمر الشراء').click(); await p.waitForTimeout(600);
/* 6 الطلب بمقاطعه الستة على الهاتف */
await as('P-DEPT', `#/requests/${id}`, ph); await shot('معاينة v0.10 — الطلب بمقاطعه الستة وطلب الشراء الآلي (هاتف)');
await as('P-DEPT', `#/requests/${id}`, ph, true); await shot('معاينة v0.10 — الطلب (هاتف داكن)');
/* 7 سياسة الاحتياج: الكتالوج وجدول الصلاحيات وطرق الشراء (حاسوب) */
await as('admin', '#/admin/need'); await p.locator('.segmented button', { hasText: 'الصلاحيات' }).click(); await p.waitForTimeout(600); await shot('معاينة v0.10 — سياسة الاحتياج: جدول الصلاحيات (حاسوب)');
await p.locator('.segmented button', { hasText: 'طرق الشراء' }).click(); await p.waitForTimeout(600); await shot('معاينة v0.10 — سياسة الاحتياج: طرق الشراء (حاسوب)');
await ctx.close(); await b.close(); console.log('done', id);
