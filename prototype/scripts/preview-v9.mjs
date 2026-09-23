// معاينات v0.9 بدقة مضاعفة للتسليم: المعالج (هاتف)، ولوحة المستودع (حاسوب)، والسند (هاتف)، ومكتب المشتريات (حاسوب)، وسياسة الاحتياج (حاسوب)، وعهدتي (هاتف داكن)
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import path from 'node:path';
import fs from 'node:fs';
const file = 'file://' + path.resolve('dist/index.html');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
const ph = { width: 400, height: 860 }; const lap = { width: 1440, height: 900 };
fs.mkdirSync('shots/v9-preview', { recursive: true });
const ctx = await b.newContext({ viewport: lap, deviceScaleFactor: 2, colorScheme: 'light' }); const p = await ctx.newPage();
await p.goto(file + '#/home', { waitUntil: 'load' }); await p.waitForTimeout(800);
const mutate = (fn) => p.evaluate((src) => { const s = JSON.parse(localStorage.getItem('usp-portal-v1')); (new Function('s', src))(s); localStorage.setItem('usp-portal-v1', JSON.stringify(s)); }, fn);
const as = async (id, hash, vp = lap, dark = false) => { await mutate(id === 'admin' ? `s.settings.persona = 'admin'; s.settings.actAs = undefined; s.settings.theme = '${dark ? 'dark' : 'light'}';` : `const w = s.people.find((x) => x.id === '${id}'); s.settings.persona = w.persona; s.settings.actAs = '${id}'; s.settings.theme = '${dark ? 'dark' : 'light'}';`); await p.setViewportSize(vp); await p.goto(file + hash); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1500); };
const shot = (n, full = true) => p.screenshot({ path: `shots/v9-preview/${n}.png`, fullPage: full });
/* 1 المعالج على الهاتف: المراجعة بمسار بمقاطعه */
await as('P-DEPT', '#/new/AS-01', ph);
await p.locator('.chips .pill', { hasText: 'لموظف في وحدتي' }).click(); await p.waitForTimeout(200); await p.selectOption('#ben', 'P-AHMED');
await p.locator('.type-row', { hasText: 'مادة تقنية' }).click(); await p.waitForTimeout(600); await p.locator('.group .cell', { hasText: 'M-100201' }).first().click(); await p.waitForTimeout(300);
await shot('معاينة v0.9 — أحتاج شيئاً على الهاتف (الكتالوج والتوفر)');
await p.locator('.btn.primary.block', { hasText: 'التالي' }).click(); await p.waitForTimeout(500); await p.fill('#n-why', 'جهاز لأحمد بدل جهازه المتعطل'); await p.locator('.btn.primary.block', { hasText: 'المراجعة' }).click(); await p.waitForTimeout(1600);
await shot('معاينة v0.9 — المراجعة والمسار المتوقع بمقاطعه (هاتف)');
/* 2 لوحة المستودع في مهامي (حاسوب) — حسن على R3-ج؟ لا: الطلب R388 عند المشتريات؛ نُنشئ حالة المستودع بتقديم الطلب أعلاه واعتماده حتى المستودع */
await p.locator('.btn.primary.block', { hasText: 'إرسال الاحتياج' }).click(); await p.waitForTimeout(1500); const id = (await p.locator('.success-id').textContent()).trim();
const openTask = async (who) => { await as(who, '#/inbox'); const rows = p.locator('.split .row'); const n = await rows.count(); for (let i = 0; i < n; i++) { await rows.nth(i).locator('.cell').click(); await p.waitForTimeout(450); const t = await p.locator('.split-detail .mono').first().textContent().catch(() => ''); if (t.trim() === id) return; } };
for (const who of ['P-SARA', 'P-GM', 'P-ASG', 'P-ITS']) { await openTask(who); await p.locator('.split-detail .btn.primary', { hasText: 'اعتماد' }).click(); await p.waitForTimeout(600); }
await openTask('P-STORE2'); await p.waitForTimeout(800); await shot('معاينة v0.9 — قرار المستودع في مهامي (حاسوب)');
await p.locator('.split-detail .np-choice .pill', { hasText: 'حجز من المستودع' }).click(); await p.locator('.split-detail .btn.primary', { hasText: 'تأكيد قرار المستودع' }).click(); await p.waitForTimeout(600);
await openTask('P-STORE2'); await p.locator('.split-detail .btn.primary', { hasText: 'ابدأ التسليم ووقّع' }).click(); await p.waitForTimeout(600);
/* 3 التوقيع على الهاتف والسند */
await as('P-AHMED', '#/inbox', ph); await p.locator('.row .cell').first().click(); await p.waitForTimeout(900); await shot('معاينة v0.9 — وقّع الاستلام على الهاتف', false);
await p.locator('.sheet .btn.primary', { hasText: 'أوقّع الاستلام' }).click(); await p.waitForTimeout(1000);
await as('P-AHMED', `#/requests/${id}`, ph); await p.locator('.seal .seal-act').first().click(); await p.waitForTimeout(1300); await shot('معاينة v0.9 — سند التسليم والاستلام (هاتف)', false);
await p.keyboard.press('Escape');
await as('P-AHMED', '#/me/custody', ph, true); await shot('معاينة v0.9 — عهدتي (هاتف داكن)');
/* 4 مكتب المشتريات (حاسوب) */
await as('P-MAJED', '#/desk/procurement'); await shot('معاينة v0.9 — مكتب المشتريات (حاسوب)');
/* 5 سياسة الاحتياج (حاسوب) */
await as('admin', '#/admin/need'); await shot('معاينة v0.9 — سياسة الاحتياج (حاسوب)');
await p.locator('.pt-card', { hasText: 'مادة تقنية' }).click(); await p.waitForTimeout(800); await shot('معاينة v0.9 — محرر الفئة في ورقة (حاسوب)', false);
await ctx.close(); await b.close(); console.log('done', id);
