// لقطات عناصر v0.8 للمراجعة البصرية (تُنفَّذ بعد shot-v8 المستقل)
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import path from 'node:path';
const file = 'file://' + path.resolve('dist/index.html');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const toISO = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
const today = toISO(Date.now()); const addDays = (s, n) => { const [y, m, d] = s.split('-').map(Number); const x = new Date(y, m - 1, d); x.setDate(x.getDate() + n); return toISO(x); };
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }); const p = await ctx.newPage();
await p.goto(file + '#/home', { waitUntil: 'load' }); await p.waitForTimeout(800);
await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('usp-portal-v1')); s.settings.persona = 'admin'; localStorage.setItem('usp-portal-v1', JSON.stringify(s)); });
await p.goto(file + '#/admin/policy'); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1400);
const seg = (label) => p.locator('.policy .segmented').first().locator('button', { hasText: label }).first();
// مسودة لنوع واحد وتعديل وجدولة
await p.locator('.ptl-card.new').click(); await p.waitForTimeout(800); await p.locator('.new-version .segmented button', { hasText: 'نوع إجازة واحد' }).click(); await p.locator('.new-version .scope-pick .pill', { hasText: 'إجازة الاختبارات' }).click(); await p.locator('.new-version .btn.primary').click(); await p.waitForTimeout(1200);
await p.locator('.pt-card:not(.new)').first().click(); await p.waitForTimeout(900); await p.locator('.sheet input[type="number"]').first().fill('15'); await p.waitForTimeout(300);
await p.locator('.sheet .avail-ed').screenshot({ path: 'dist/v8-el-availability.png' });
await p.locator('.sheet .icon-btn').first().click(); await p.waitForTimeout(600); await p.locator('.sb-why').fill('تمديد نافذة التقديم إلى 15 يوم عمل'); await p.locator('.savebar .btn').click(); await p.waitForTimeout(900);
await p.locator('.section-head .btn.soft').click(); await p.waitForTimeout(800); await p.locator('.sheet').screenshot({ path: 'dist/v8-el-schedule.png' });
await p.locator('#sc-from').fill(addDays(today, 20)); await p.locator('#sc-reason').fill('نافذة الاختبارات 15 يوم عمل'); await p.locator('#sc-ref').fill('قرار ٦٠/٢٠٢٦'); await p.locator('.sheet .btn.primary.block').click(); await p.waitForTimeout(1400);
await p.locator('.ptl').screenshot({ path: 'dist/v8-el-timeline.png' });
await p.locator('.ptl-card.active').click(); await p.waitForTimeout(600); await seg('أنواع').click(); await p.waitForTimeout(700);
await p.locator('.pt-card', { hasText: 'إجازة الاختبارات' }).first().screenshot({ path: 'dist/v8-el-type-card.png' });
await p.locator('.pt-card', { hasText: 'إجازة الاختبارات' }).first().click(); await p.waitForTimeout(900); await p.locator('.sheet .obj-hist').scrollIntoViewIfNeeded(); await p.waitForTimeout(400); await p.locator('.sheet .obj-hist').screenshot({ path: 'dist/v8-el-history.png' });
await p.locator('.sheet .icon-btn').first().click(); await p.waitForTimeout(600);
await p.locator('.ptl-card.scheduled').click(); await p.waitForTimeout(600); await p.locator('.pv-line .btn.quiet').click(); await p.waitForTimeout(1200); await p.locator('.sheet .dp-amend').screenshot({ path: 'dist/v8-el-amendment.png' }); await p.locator('.sheet .icon-btn').first().click(); await p.waitForTimeout(600);
// المسارات: سطر آخر تعديل وسجل المسار
await seg('المسارات').click(); await p.waitForTimeout(800); await p.locator('.route-ed').first().locator('.cell').first().screenshot({ path: 'dist/v8-el-route-head.png' });
await p.locator('.route-ed').first().locator('.pt-last-open').click(); await p.waitForTimeout(800); await p.locator('.sheet').screenshot({ path: 'dist/v8-el-route-history.png' }); await p.locator('.sheet .icon-btn').first().click(); await p.waitForTimeout(500);
// التشغيل: إقفال الفترة
await seg('التشغيل').click(); await p.waitForTimeout(800); await p.locator('#pc-until').fill('2026-10-15'); await p.locator('#pc-reason').fill('صُدِّر تقرير الحضور حتى منتصف أكتوبر'); await p.locator('#pc-ref').fill('HR-ATT-2026-10'); await p.waitForTimeout(500);
await p.locator('.period-close').screenshot({ path: 'dist/v8-el-close-form.png' });
await p.locator('.period-close .btn.primary').click(); await p.waitForTimeout(900);
await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('usp-portal-v1')); s.settings.persona = 'manager'; localStorage.setItem('usp-portal-v1', JSON.stringify(s)); });
await p.goto(file + '#/inbox'); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1400);
const rows = p.locator('.row .cell'); const n = await rows.count(); for (let i = 0; i < n; i++) { await rows.nth(i).click(); await p.waitForTimeout(500); const t = await p.locator('.split-detail .mono').first().textContent().catch(() => ''); if (t.includes('0391')) break; }
await p.locator('.split-detail').screenshot({ path: 'dist/v8-el-task-locked.png' });
// نوع جديد موسمي (ورقة الإنشاء)
await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('usp-portal-v1')); s.settings.persona = 'admin'; localStorage.setItem('usp-portal-v1', JSON.stringify(s)); });
await p.goto(file + '#/admin/policy'); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1400);
await p.locator('.ptl-card.new').click(); await p.waitForTimeout(800); await p.locator('.new-version').screenshot({ path: 'dist/v8-el-new-version.png' });
await p.locator('.new-version .segmented button', { hasText: 'السياسة كلها' }).click(); await p.locator('.new-version .btn.primary').click(); await p.waitForTimeout(1200);
await seg('أنواع').click(); await p.waitForTimeout(600); await p.locator('.pt-card.new').click(); await p.waitForTimeout(900); await p.locator('#nt-erp').selectOption('01|0530'); await p.waitForTimeout(300); await p.locator('.sheet .avail-ed .segmented button', { hasText: 'موسم' }).click(); await p.waitForTimeout(400); await p.locator('.sheet .avail-ed input[dir="rtl"]').fill('موسم الصيف'); await p.locator('.sheet .avail-ed input[dir="ltr"]').fill('Summer season'); await p.waitForTimeout(300);
await p.locator('.sheet .avail-ed').scrollIntoViewIfNeeded(); await p.locator('.sheet').screenshot({ path: 'dist/v8-el-new-type-season.png' });
await b.close(); console.log('views ok');
