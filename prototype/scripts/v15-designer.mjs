// v0.15 مصمّم الخدمات (CAP-02): مدير النظام يبني خدمة من الشاشة بلا شيفرة، وفحص السلامة يمنع، والجدولة تسري، والموظف يقدّم، والمسار يمر بمحرك CAP-01 — ق.ص-04 وق.ص-05 وق.ص-08
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import path from 'node:path';
import fs from 'node:fs';
const file = 'file://' + path.resolve('dist/index.html');
const OUT = process.argv[2] || 'shots/v15'; fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const errors = []; const rows = [];
const ok = (name, pass, detail = '') => { rows.push({ name, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`); };
const KEY = 'usp-portal-v1';
/* سياق واحد لكل الفحوص (التخزين محلي للسياق): نبدّل الشخصية بتعديل الإعدادات ثم إعادة التحميل */
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const p = await ctx.newPage();
p.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
await p.goto(file + '#/home', { waitUntil: 'load' }); await p.waitForTimeout(500);
const become = async (who, hash, vp) => {
  if (vp) await p.setViewportSize(vp);
  await p.evaluate((who) => { const s = JSON.parse(localStorage.getItem('usp-portal-v1')); if (who === 'admin') { s.settings.persona = 'admin'; s.settings.actAs = undefined; } else { const w = s.people.find((x) => x.id === who); s.settings.persona = w.persona; s.settings.actAs = who; } localStorage.setItem('usp-portal-v1', JSON.stringify(s)); }, who);
  await p.goto(file + hash); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1200);
};
const st = async () => p.evaluate(() => JSON.parse(localStorage.getItem('usp-portal-v1')));
const overflow = async () => p.evaluate(() => { const root = document.querySelector('.app-root') || document.body; return Math.max(0, root.scrollWidth - root.clientWidth); });
const clickTab = async (name) => { await p.getByRole('button', { name }).first().click(); await p.waitForTimeout(500); };

/* 1) مدير النظام: مسودة جديدة، وخدمة جديدة برمز جديد (WP-05 طلب بطاقة مواقف) */
await become('admin', '#/admin/designer');
/* v0.16: البذرة تحمل إصدارين (2026.1 و2026.2) فالمسودة هي الإصدار الثالث؛ يُقاس من طول السلسلة قبل الإنشاء لا برقم ثابت */
let s = await st(); const BASE = s.designer.versions.length;
await p.locator('.ptl-card.new').click(); await p.waitForTimeout(800);
s = await st(); ok('draft-created', s.designer.versions.length === BASE + 1 && !s.designer.versions[BASE].scheduled, `versions ${s.designer.versions.length}`);
await clickTab(/الخدمات المهيّأة/);
await p.locator('.npc-add').first().click(); await p.waitForTimeout(600);
await p.locator('#nw-domain').selectOption('WP'); await p.locator('#nw-ar').fill('طلب بطاقة مواقف'); await p.locator('#nw-en').fill('Parking card request');
await p.screenshot({ path: `${OUT}/v15-1-new-service.png` });
await p.locator('.lb-sheet .btn.primary, .sheet .btn.primary').last().click(); await p.waitForTimeout(1200);
s = await st(); const draft = s.designer.versions[BASE]; const svc0 = draft.content.designer.services.find((x) => x.id === 'WP-05');
ok('service-created', !!svc0, svc0 ? svc0.id : 'missing');
ok('opened-designer', (await p.url()).includes('#/admin/designer/svc/WP-05'), await p.url());
/* 2) الأساسيات ← النموذج: قسم بحقول من اللوحة (اختيار، نص بنمط لوحة، تاريخ في المستقبل، مرفق، إقرار) */
await p.locator('#dz-desc-ar').fill('بطاقة دخول مواقف المقر الرئيسي لموظفي الأمانة؛ تصدرها الخدمات العامة خلال ثلاثة أيام عمل.');
await clickTab(/^النموذج/);
await p.locator('#dz-sec-0-ar').fill('بيانات المركبة'); await p.locator('#dz-sec-0-ar').press('Tab');
const addField = async (kindLabel, labelAr, labelEn) => {
  await p.locator('.dz-add').first().click(); await p.waitForTimeout(500);
  await p.locator('.dz-pal', { hasText: kindLabel }).first().click(); await p.waitForTimeout(600);
  await p.locator('#dz-f-label-ar').fill(labelAr); if (labelEn !== undefined) await p.locator('#dz-f-label-en').fill(labelEn);
};
await addField('اختيار واحد', 'نوع المركبة', 'Vehicle kind');
await p.locator('#dz-opt-0-ar').fill('سيارة خاصة'); await p.locator('.dz-opt input[dir=ltr]').nth(0).fill('Private car');
await p.locator('#dz-opt-1-ar').fill('دراجة نارية'); await p.locator('.dz-opt input[dir=ltr]').nth(1).fill('Motorcycle');
await p.locator('#dz-f-required').check();
await p.screenshot({ path: `${OUT}/v15-2-field-sheet.png` });
await p.keyboard.press('Escape'); await p.waitForTimeout(500);
await addField('نص قصير', 'رقم اللوحة', 'Plate number');
await p.locator('.type-editor select.select-in').filter({ hasText: 'بلا نمط' }).first().selectOption('plate'); await p.locator('#dz-f-required').check();
await p.keyboard.press('Escape'); await p.waitForTimeout(400);
await addField('تاريخ', 'تاريخ بدء الحاجة', 'Needed from');
await p.locator('.type-editor select.select-in').filter({ hasText: 'أي تاريخ' }).first().selectOption('todayOrFuture'); await p.locator('#dz-f-required').check();
await p.keyboard.press('Escape'); await p.waitForTimeout(400);
await addField('مرفق', 'صورة استمارة المركبة', 'Vehicle registration copy');
await p.keyboard.press('Escape'); await p.waitForTimeout(400);
/* حقل بلا تسمية إنجليزية: يجب أن يمنعه فحص السلامة (ق.ص-05) */
await addField('خانة إقرار', 'أقرّ بأن المركبة باسمي', undefined);
await p.keyboard.press('Escape'); await p.waitForTimeout(400);
await p.screenshot({ path: `${OUT}/v15-3-form-editor.png`, fullPage: true });
/* المسار من مسار معياري: المدير ثم تنفيذ جهة (الخدمات العامة) */
await clickTab(/^المسار/);
await p.locator('.dz-presets .pill', { hasText: 'المدير ثم تنفيذ جهة' }).click(); await p.waitForTimeout(400);
await p.screenshot({ path: `${OUT}/v15-4-route.png`, fullPage: true });
await clickTab(/^المخرج/);
/* v0.16: المخرجات قائمة مركّبة — سجل بتاريخ انتهاء من حقل التاريخ */
await p.locator('.dz-add-out-register').click(); await p.waitForTimeout(400);
await p.locator('.dz-output').last().locator('select.select-in').filter({ has: p.locator('option', { hasText: 'تاريخ' }) }).last().selectOption({ index: 1 }).catch(() => {});
/* الحفظ */
await p.locator('.savebar .sb-why').fill('خدمة جديدة من المصمّم: بطاقة مواقف'); await p.locator('.savebar .btn.primary').click(); await p.waitForTimeout(900);
s = await st(); const svc1 = s.designer.versions[BASE].content.designer.services.find((x) => x.id === 'WP-05');
ok('service-saved', !!svc1 && svc1.sections[0].fields.length === 5 && svc1.route.length === 2 && svc1.outputs.some((o) => o.kind === 'register'), svc1 ? `${svc1.sections[0].fields.length} fields · ${svc1.route.length} steps · ${svc1.outputs.map((o) => o.kind).join('+')}` : 'missing');
ok('change-log', s.designer.versions[BASE].changes.length > 5, `${s.designer.versions[BASE].changes.length} changes`);
/* 3) فحص السلامة يمنع الجدولة (حقل بلا تسمية إنجليزية) */
await clickTab(/فحص السلامة/);
await p.screenshot({ path: `${OUT}/v15-5-safety.png` });
ok('safety-lists-problem', (await p.locator('.cell-lead.danger').count()) >= 1, 'عيب واحد على الأقل');
await p.goto(file + '#/admin/designer'); await p.waitForTimeout(1000);
await p.locator('.btn.soft', { hasText: 'جدولة' }).click(); await p.waitForTimeout(600);
await p.locator('#dsc-reason').fill('خدمة بطاقة المواقف'); await p.locator('#dsc-ref').fill('طلب الخدمات العامة');
ok('schedule-blocked', await p.locator('.lb-sheet .btn.primary.block, .sheet .btn.primary.block').last().isDisabled(), 'الزر معطّل حتى يُصلَح العيب');
await p.screenshot({ path: `${OUT}/v15-6-schedule-blocked.png` });
await p.keyboard.press('Escape'); await p.waitForTimeout(400);
/* إصلاح العيب ثم الجدولة اليوم */
await p.goto(file + '#/admin/designer/svc/WP-05'); await p.waitForTimeout(1000);
await clickTab(/^النموذج/);
await p.locator('.dz-field-main', { hasText: 'أقرّ بأن' }).click(); await p.waitForTimeout(500);
await p.locator('#dz-f-label-en').fill('I confirm the vehicle is registered in my name'); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
await p.locator('.savebar .btn.primary').click(); await p.waitForTimeout(800);
await p.goto(file + '#/admin/designer'); await p.waitForTimeout(1000);
await p.locator('.btn.soft', { hasText: 'جدولة' }).click(); await p.waitForTimeout(600);
const today = await p.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
await p.locator('#dsc-from').fill(today); await p.locator('#dsc-reason').fill('خدمة بطاقة المواقف'); await p.locator('#dsc-ref').fill('طلب الخدمات العامة');
await p.locator('.lb-sheet .btn.primary.block, .sheet .btn.primary.block').last().click(); await p.waitForTimeout(1000);
s = await st(); ok('scheduled-active', s.designer.versions[BASE].scheduled && s.designer.versions[BASE].from === today, `from ${s.designer.versions[BASE].from}`);
await p.screenshot({ path: `${OUT}/v15-7-scheduled.png` });
/* 4) الموظف: الخدمة في «الخدمات» ويقدّمها على الهاتف؛ التحقق يرفض ثم يقبل (ق.ص-08) */
await become('P-AHMED', '#/services', { width: 390, height: 844 });
await p.locator('#lbsvq').fill('مواقف'); await p.waitForTimeout(500);
ok('employee-sees-service', (await p.locator('.lrow', { hasText: 'طلب بطاقة مواقف' }).count()) === 1, 'ظهرت في البحث كخدمة متاحة');
await p.locator('.lrow', { hasText: 'طلب بطاقة مواقف' }).click(); await p.waitForTimeout(1000);
ok('form-opens', (await p.url()).includes('#/new/WP-05') && (await p.locator('.cfr').count()) === 1, await p.url());
await p.screenshot({ path: `${OUT}/v15-8-employee-form.png`, fullPage: true });
await p.locator('.cfr .btn.primary.block').first().click(); await p.waitForTimeout(500);
ok('validation-blocks', (await p.locator('.error-summary li').count()) >= 3, `${await p.locator('.error-summary li').count()} أخطاء`);
await p.locator('.cf-seg button', { hasText: 'سيارة خاصة' }).click();
await p.locator('#cf-f-text-2').fill('12345'); await p.locator('.cfr .btn.primary.block').first().click(); await p.waitForTimeout(400);
ok('pattern-plate', (await p.locator('.field.invalid').count()) >= 1, 'رقم اللوحة بلا أحرف يُرفض بالنمط');
await p.locator('#cf-f-text-2').fill('أ ب ج 1234');
await p.locator('#cf-f-date-3').fill(today);
await p.locator('#cf-f-checkbox-5').check();
await p.locator('.cfr .btn.primary.block').first().click(); await p.waitForTimeout(700);
ok('review-step', (await p.locator('.route-preview').count()) === 1, (await p.locator('.route-preview').count()) === 1 ? 'المعاينة و«من سيعتمد ولماذا»' : await p.locator('.error-summary').innerText().catch(() => 'no summary'));
await p.screenshot({ path: `${OUT}/v15-9-employee-review.png`, fullPage: true });
await p.locator('.cfr .btn.primary.block').first().click(); await p.waitForTimeout(1500);
s = await st(); const req = s.requests.find((r) => r.serviceId === 'WP-05');
ok('request-created', !!req && req.title?.ar === 'طلب بطاقة مواقف' && req.policyVersion === s.designer.versions[BASE].number && req.configured?.version === req.policyVersion && req.tenant === 'GCC-SG', req ? `${req.id} · v${req.policyVersion} · ${req.steps.map((x) => x.status).join(',')}` : 'missing');
ok('fields-bilingual', !!req && req.fields.some((f) => f.key === 'f-choice-1' && f.value === 'سيارة خاصة' && f.valueEn === 'Private car'), JSON.stringify(req?.fields.map((f) => [f.key, f.value, f.valueEn])));
await p.screenshot({ path: `${OUT}/v15-10-success.png` });
/* 5) المدير يعتمد من مهامي، ثم الخدمات العامة تنفّذ بمرجع، فيكتمل الطلب ويُسجَّل بتاريخ انتهاء */
await become('P-MONA', '#/inbox', { width: 1440, height: 900 });
ok('manager-task', (await p.locator('.lrow', { hasText: 'طلب بطاقة مواقف' }).count()) >= 1, 'المهمة عند المدير المباشر');
await p.locator('.lrow', { hasText: 'طلب بطاقة مواقف' }).first().click(); await p.waitForTimeout(700);
await p.screenshot({ path: `${OUT}/v15-11-manager-task.png` });
await p.locator('.lb-split-detail .btn.primary.block').first().click(); await p.waitForTimeout(900);
s = await st(); const r2 = s.requests.find((r) => r.serviceId === 'WP-05'); const cur = r2.steps.find((x) => x.status === 'current');
ok('to-fulfil', cur && cur.mode === 'fulfil' && (cur.assigneeIds || []).length > 0, cur ? `${cur.title.ar} → ${cur.assigneeIds}` : 'no current');
const gs = cur.assigneeIds[0];
await become(gs, '#/inbox');
await p.locator('.lrow', { hasText: 'طلب بطاقة مواقف' }).first().click(); await p.waitForTimeout(700);
await p.locator('#fulfil-ref').fill('PK-2026-0417'); await p.locator('.lb-split-detail .btn.primary.block').first().click(); await p.waitForTimeout(900);
s = await st(); const r3 = s.requests.find((r) => r.serviceId === 'WP-05');
ok('completed-record', r3.status === 'completed' && r3.audit.some((a) => a.what.ar.includes('بتاريخ انتهاء')), `${r3.status} · ${r3.audit[r3.audit.length - 1].what.ar}`);
/* 6) ق.ص-04: إصدار ثانٍ يُلغي حقلاً بتاريخ الغد؛ الطلب القديم يحتفظ بإصداره وحقله */
await become('admin', '#/admin/designer');
await p.locator('.ptl-card.new').click(); await p.waitForTimeout(800);
await p.goto(file + '#/admin/designer/svc/WP-05'); await p.waitForTimeout(1000);
await clickTab(/^النموذج/);
await p.locator('.dz-field-main', { hasText: 'صورة استمارة' }).click(); await p.waitForTimeout(500);
const tomorrow = await p.evaluate(() => { const d = new Date(Date.now() + 86400000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
ok('end-date-not-remove', (await p.locator('.type-editor input[type=date]').count()) >= 1 && (await p.locator('.type-editor .btn.quiet', { hasText: 'حذف' }).count()) === 0, 'حقل من الإصدار الساري: إلغاء بتاريخ لا حذف (P-12)');
await p.locator('.type-editor input[type=date]').last().fill(tomorrow); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
await p.locator('.savebar .sb-why').fill('إلغاء المرفق'); await p.locator('.savebar .btn.primary').click(); await p.waitForTimeout(800);
await p.goto(file + '#/admin/designer'); await p.waitForTimeout(900);
await clickTab(/ماذا يتغير/);
ok('diff-named', (await p.locator('.diff-row', { hasText: 'صورة استمارة' }).count()) >= 1, 'الفرق مسمّى بالخدمة والحقل');
await p.screenshot({ path: `${OUT}/v15-12-diff.png` });
await p.locator('.btn.soft', { hasText: 'جدولة' }).click(); await p.waitForTimeout(600);
await p.locator('#dsc-from').fill(tomorrow); await p.locator('#dsc-reason').fill('إلغاء مرفق الاستمارة'); await p.locator('#dsc-ref').fill('ملاحظة الخدمات العامة');
await p.locator('.lb-sheet .btn.primary.block, .sheet .btn.primary.block').last().click(); await p.waitForTimeout(900);
s = await st(); const r4 = s.requests.find((r) => r.serviceId === 'WP-05');
ok('old-request-keeps-version', r4.policyVersion === s.designer.versions[BASE].number && s.designer.versions[BASE + 1].scheduled, `request v${r4.policyVersion} · v3 scheduled from ${s.designer.versions[BASE + 1].from}`);
/* 7) ق.ص-08: النموذج يجتاز بوابة التصميم — الهاتف والحاسوب، والعربية والإنجليزية، والداكن — بلا فيض أفقي */
const gate = [];
for (const [lang, theme, vp] of [['ar', 'light', { width: 390, height: 844 }], ['en', 'dark', { width: 390, height: 844 }], ['en', 'light', { width: 1440, height: 900 }], ['ar', 'dark', { width: 1440, height: 900 }]]) {
  await p.setViewportSize(vp);
  await p.evaluate(({ lang, theme }) => { const s = JSON.parse(localStorage.getItem('usp-portal-v1')); s.settings.lang = lang; s.settings.theme = theme; const w = s.people.find((x) => x.id === 'P-AHMED'); s.settings.persona = w.persona; s.settings.actAs = 'P-AHMED'; localStorage.setItem('usp-portal-v1', JSON.stringify(s)); }, { lang, theme });
  await p.goto(file + '#/new/WP-05'); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1100);
  const of = await overflow(); gate.push(of); await p.screenshot({ path: `${OUT}/v15-13-gate-${lang}-${theme}-${vp.width}.png`, fullPage: vp.width < 600 });
}
ok('design-gate', gate.every((x) => x === 0), `overflow ${gate.join('/')}`);
/* 8) المصمّم على الهاتف بلا فيض */
await p.setViewportSize({ width: 390, height: 844 });
await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('usp-portal-v1')); s.settings.lang = 'ar'; s.settings.theme = 'light'; s.settings.persona = 'admin'; s.settings.actAs = undefined; localStorage.setItem('usp-portal-v1', JSON.stringify(s)); });
await p.goto(file + '#/admin/designer/svc/WP-05'); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1100);
const o1 = await overflow(); await clickTab(/^النموذج/); const o2 = await overflow(); await clickTab(/^المسار/); const o3 = await overflow(); await clickTab(/المعاينة/); const o4 = await overflow();
await p.screenshot({ path: `${OUT}/v15-14-designer-phone-preview.png`, fullPage: true });
ok('designer-phone-no-overflow', [o1, o2, o3, o4].every((x) => x === 0), `${o1}/${o2}/${o3}/${o4}`);
/* 9) الخدمة المهيّأة المثال (DC-03) من البذرة: تقديم ← اعتماد المدير ← تنفيذ شؤون الموظفين ← مستند على ورقة الهوية */
await p.setViewportSize({ width: 390, height: 844 });
await become('P-AHMED', '#/new/DC-03');
await p.locator('#cf-partyKind').selectOption('bank'); await p.locator('#cf-partyName').fill('بنك الرياض'); await p.locator('#cf-purpose').fill('لغرض فتح حساب توفير وتقديم ما يثبت جهة العمل.');
await p.locator('.cf-seg button', { hasText: 'العربية' }).click();
ok('showif-hidden', (await p.locator('#cf-country').count()) === 0, 'حقل الدولة لا يظهر إلا للسفارة (يظهر إذا)');
await p.locator('#cf-partyKind').selectOption('embassy'); await p.waitForTimeout(300);
ok('showif-shown', (await p.locator('#cf-country').count()) === 1, 'حقل الدولة ظهر للسفارة');
await p.locator('#cf-country').selectOption('GB'); await p.locator('#cf-partyName').fill('سفارة المملكة المتحدة');
await p.locator('.cfr .btn.primary.block').first().click(); await p.waitForTimeout(600);
await p.locator('.cfr .btn.primary.block').first().click(); await p.waitForTimeout(1400);
s = await st(); const dc = s.requests.find((r) => r.serviceId === 'DC-03');
ok('dc03-created', !!dc && dc.fields.some((f) => f.key === 'country' && f.valueEn === 'United Kingdom'), dc ? dc.fields.map((f) => f.value).join(' · ') : 'missing');
await become('P-MONA', '#/inbox', { width: 1440, height: 900 });
await p.locator('.lrow', { hasText: 'خطاب لجهة خارجية' }).first().click(); await p.waitForTimeout(600);
await p.locator('.lb-split-detail .btn.primary.block').first().click(); await p.waitForTimeout(900);
s = await st(); const dc2 = s.requests.find((r) => r.serviceId === 'DC-03'); const hrStep = dc2.steps.find((x) => x.status === 'current');
await become(hrStep.assigneeIds[0], '#/inbox');
await p.locator('.lrow', { hasText: 'خطاب لجهة خارجية' }).first().click(); await p.waitForTimeout(600);
await p.locator('#fulfil-ref').fill('HR-LT-2026-118'); await p.locator('.lb-split-detail .btn.primary.block').first().click(); await p.waitForTimeout(900);
s = await st(); const dc3 = s.requests.find((r) => r.serviceId === 'DC-03'); const issued = dc3.docs.find((d) => d.kind === 'issued');
ok('dc03-document', dc3.status === 'completed' && !!issued && /^DC-\d+\/\d{4}$/.test(issued.number || ''), issued ? `${issued.number} · ${issued.title.ar}` : 'no document');
await become('P-AHMED', `#/requests/${dc3.id}`, { width: 390, height: 844 });
await p.locator('.seal-act').first().click(); await p.waitForTimeout(1200);
ok('dc03-docsheet', (await p.locator('.docsheet').count()) >= 1, 'المستند على ورقة الهوية');
await p.screenshot({ path: `${OUT}/v15-15-dc03-document.png`, fullPage: true });
/* 10) الدليل: «ابنِها في المصمّم» لخدمة مهيّأة من الجرد (WP-04 طلب مركبة) */
await become('admin', '#/admin/designer', { width: 1440, height: 900 });
await p.locator('.ptl-card.new').click(); await p.waitForTimeout(800);
await p.locator('#dzq').fill('مركبة'); await p.waitForTimeout(400);
const buildBtn = p.locator('.dz-row', { hasText: 'WP-04' }).locator('.btn.primary');
ok('catalog-build-button', (await buildBtn.count()) === 1, 'زر البناء يظهر للمهيّأة غير المبنيّة في المسودة');
if (await buildBtn.count()) { await buildBtn.click(); await p.waitForTimeout(1000); ok('catalog-build-opens', (await p.url()).includes('svc/WP-04'), await p.url()); }
fs.writeFileSync(`${OUT}/designer.json`, JSON.stringify({ rows, errors }, null, 2));
const fail = rows.filter((r) => !r.pass).length;
console.log(`TOTAL ${rows.length} · ${rows.length - fail} PASS / ${fail} FAIL · console errors ${errors.length}`);
for (const e of errors.slice(0, 8)) console.log('  ERR', e);
await b.close();
