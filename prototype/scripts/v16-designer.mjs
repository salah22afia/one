// v0.16 مصمّم الخدمات بخريطة الحالات الكاملة (CAP-02 §3-ب): الاختبار الفاصل ق.ص-02 (خطاب التعريف من الشاشة بلا شيفرة)، ونماذج الخطوات، والشرائح، والاعتماد الآلي،
// والخطوات المتوازية، والسجل والتجديد، والحصة، والقوالب والنسخ والاستيراد، والمستأجرون، والعقود، والمحاكاة، وبوابة التصميم
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import path from 'node:path';
import fs from 'node:fs';
const file = 'file://' + path.resolve('dist/index.html');
const OUT = process.argv[2] || 'shots/v16'; fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const errors = []; const rows = [];
const ok = (name, pass, detail = '') => { rows.push({ name, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`); };
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
const clickTab = async (name) => { const seg = p.locator('.dzs-main .segmented').first(); const inDz = await seg.count(); await (inDz ? seg.locator('button', { hasText: name }).first() : p.getByRole('button', { name }).first()).click(); await p.waitForTimeout(500); };
const today = await p.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
const plus = (n) => { const d = new Date(Date.now() + n * 86400000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const primary = () => p.locator('.lb-split-detail .btn.primary.block, .lb-split-detail .btn.danger.block').first();
const openTask = async (text) => { await p.locator('.lrow', { hasText: text }).first().click(); await p.waitForTimeout(700); };

/* ═══ 1) البذرة: الخدمات الأربع سارية ويراها الموظف ═══ */
let s = await st();
ok('seed-services', s.designer.versions.length === 2 && s.designer.versions[1].content.designer.services.map((x) => x.id).join(',') === 'DC-03,DC-01,PR-07,HA-09', s.designer.versions[1].content.designer.services.map((x) => x.id).join(','));
ok('seed-tenants-contracts', s.tenants.length === 2 && s.contracts.bindings.length === 6 && Array.isArray(s.registers), `${s.tenants.length} tenants · ${s.contracts.bindings.length} bindings`);

/* ═══ 2) الاختبار الفاصل ق.ص-02: خطاب تعريف يُبنى من الشاشة بلا سطر شيفرة — بيانات من ملف الموظف، ونعم/لا، ويظهر إذا، وقالب دمج، وموقّع منصب، ونموذج خطوة بقائمة تحقق وحقل ═══ */
await become('admin', '#/admin/designer');
await p.locator('.ptl-card.new').click(); await p.waitForTimeout(800);
await clickTab(/الخدمات المهيّأة/);
await p.locator('.npc-add').first().click(); await p.waitForTimeout(600);
await p.locator('#nw-domain').selectOption('DC'); await p.locator('#nw-ar').fill('خطاب تعريف (اختبار ق.ص-02)'); await p.locator('#nw-en').fill('Employment letter (test)');
await p.locator('.lb-sheet .btn.primary, .sheet .btn.primary').last().click(); await p.waitForTimeout(1200);
s = await st(); const NEW = s.designer.versions[2].content.designer.services.find((x) => x.source === 'new')?.id;
ok('qs02-created', !!NEW && (await p.url()).includes(`#/admin/designer/svc/${NEW}`), `${NEW}`);
await p.locator('#dz-desc-ar').fill('خطاب يعرّف بك لجهة تسمّيها.');
await clickTab(/^النموذج/);
await p.locator('#dz-sec-0-ar').fill('بياناتي'); await p.locator('.dz-sec-titles input[dir=ltr]').first().fill('My data');
const addField = async (kindLabel, labelAr, labelEn) => { await p.locator('.dz-add').first().click(); await p.waitForTimeout(500); await p.locator('.dz-pal', { hasText: kindLabel }).first().click(); await p.waitForTimeout(600); if (labelAr !== undefined) await p.locator('#dz-f-label-ar').fill(labelAr); if (labelEn !== undefined) await p.locator('#dz-f-label-en').fill(labelEn); };
await addField('من ملف الموظف', 'الاسم', 'Name'); await p.locator('#dz-f-profile').selectOption('name'); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
await addField('من ملف الموظف', 'الوظيفة', 'Position'); await p.locator('#dz-f-profile').selectOption('title'); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
await addField('نص قصير', 'الجهة الموجَّه إليها', 'Addressee'); await p.locator('#dz-f-required').check(); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
await addField('نعم / لا', 'يُذكر الراتب؟', 'Mention the salary?'); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
await addField('من ملف الموظف', 'الراتب الأساسي', 'Basic salary'); await p.locator('#dz-f-profile').selectOption('basicSalary');
/* يظهر إذا: نعم/لا = نعم */
await p.locator('.dz-cond').first().locator('.btn.quiet').click(); await p.waitForTimeout(300);
const condRow = p.locator('.dz-cond').first().locator('.dz-cond-row').first();
await condRow.locator('select').nth(1).selectOption({ label: 'يُذكر الراتب؟' }); await condRow.locator('select').nth(2).selectOption('eq'); await condRow.locator('select').last().selectOption('yes');
await p.screenshot({ path: `${OUT}/v16-1-field-showif.png` });
await p.keyboard.press('Escape'); await p.waitForTimeout(300);
/* المسار: إشعار المدير ثم تنفيذ شؤون الموظفين بنموذج خطوة (قائمة تحقق + حقل رقم الصادر) */
await clickTab(/^المسار/);
await p.locator('.dz-presets .pill', { hasText: 'شؤون الموظفين مباشرة' }).click(); await p.waitForTimeout(400);
await p.locator('.dz-step-form').last().click(); await p.waitForTimeout(600);
await p.locator('.sheet .btn.quiet', { hasText: 'إضافة بند' }).click(); await p.waitForTimeout(200);
await p.locator('#dz-chk-0-ar').fill('طابقت الوظيفة بآخر إجراء موظف'); await p.locator('.dz-opt input[dir=ltr]').last().fill('Position matches the latest action');
await p.locator('.dz-add-step-field').click(); await p.waitForTimeout(500); await p.locator('.dz-pal', { hasText: 'نص قصير' }).first().click(); await p.waitForTimeout(500);
await p.locator('#dz-f-label-ar').fill('رقم الصادر'); await p.locator('#dz-f-label-en').fill('Outgoing reference'); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
await p.screenshot({ path: `${OUT}/v16-2-step-form.png` });
await p.keyboard.press('Escape'); await p.waitForTimeout(400);
/* المخرجات: مستند بقالب دمج — فقرة بحقول من الملف والنموذج والخطوة، وموقّع منصب رئيس شؤون الموظفين */
await clickTab(/^المخرجات/);
await p.locator('.dz-add-out-document').click(); await p.waitForTimeout(500);
await p.locator('#dz-para-0-ar').fill('إلى: '); await p.locator('#dz-para-0-ar').focus();
await p.locator('.dz-tokens .pill', { hasText: 'الجهة الموجَّه إليها' }).click(); await p.waitForTimeout(150);
await p.locator('.dz-add-para').click(); await p.waitForTimeout(200);
await p.locator('#dz-para-1-ar').fill('تشهد الأمانة العامة بأن '); await p.locator('#dz-para-1-ar').focus();
await p.locator('.dz-tokens .pill', { hasText: /^الاسم$/ }).first().click(); await p.locator('#dz-para-1-ar').press('End'); await p.locator('#dz-para-1-ar').type(' يعمل بوظيفة '); await p.locator('.dz-tokens .pill', { hasText: /^المنصب$/ }).first().click();
await p.locator('.dz-add-para').click(); await p.waitForTimeout(200);
await p.locator('#dz-para-2-ar').fill('الراتب الأساسي: '); await p.locator('#dz-para-2-ar').focus(); await p.locator('.dz-tokens .pill', { hasText: 'الراتب الأساسي' }).first().click();
await p.locator('.dz-para textarea[dir=ltr]').nth(0).fill('To: {{f:f-text-3}}'); await p.locator('.dz-para textarea[dir=ltr]').nth(1).fill('The General Secretariat certifies that {{p:name}} works as {{p:title}}.'); await p.locator('.dz-para textarea[dir=ltr]').nth(2).fill('Basic salary: {{p:basicSalary}}');
await p.locator('.dz-output select.select-in').filter({ hasText: 'آخر من اعتمد' }).first().selectOption('position'); await p.waitForTimeout(300);
await p.locator('.dz-output .chips select.select-in').first().selectOption('S-211'); await p.waitForTimeout(300);
await p.screenshot({ path: `${OUT}/v16-3-template.png`, fullPage: true });
s = await st();
await p.locator('.savebar .sb-why').fill('الاختبار الفاصل ق.ص-02'); await p.locator('.savebar .btn.primary').click(); await p.waitForTimeout(900);
s = await st(); const q = s.designer.versions[2].content.designer.services.find((x) => x.id === NEW);
ok('qs02-saved', !!q && q.sections[0].fields.length === 5 && q.route.length === 2 && q.route[1].form?.fields?.length === 1 && q.route[1].form?.checks?.length === 1 && q.outputs.length === 1 && (q.outputs[0].template?.paragraphs || []).length === 3, q ? `${q.sections[0].fields.length} fields · steps ${q.route.length} · out ${q.outputs.length} · paras ${(q.outputs[0].template?.paragraphs || []).length} · tokens ${JSON.stringify(q.outputs[0].template?.paragraphs?.map((x) => x.ar))}` : 'missing');
ok('qs02-showif-cond', !!q && JSON.stringify(q.sections[0].fields[4].rules?.showIf) === JSON.stringify({ field: 'f-yesno-4', op: 'eq', value: 'yes' }), JSON.stringify(q?.sections[0].fields[4].rules?.showIf));
/* فحص السلامة يقبل، والجدولة اليوم */
await clickTab(/فحص السلامة/); const problems = await p.locator('.cell-lead.danger').count(); ok('qs02-safety-ok', problems === 0, `${problems} problems ${problems ? JSON.stringify(await p.locator('.cell-lead.danger').locator('xpath=..').allInnerTexts()) : ''}`);
await p.goto(file + '#/admin/designer'); await p.waitForTimeout(900);
await p.locator('.btn.soft', { hasText: 'جدولة' }).click(); await p.waitForTimeout(600);
await p.locator('#dsc-from').fill(today); await p.locator('#dsc-reason').fill('الاختبار الفاصل ق.ص-02'); await p.locator('#dsc-ref').fill('CAP-02 2.0');
await p.locator('.lb-sheet .btn.primary.block, .sheet .btn.primary.block').last().click(); await p.waitForTimeout(1000);
s = await st(); ok('qs02-scheduled', s.designer.versions[2].scheduled && s.designer.versions[2].from === today, `from ${s.designer.versions[2].from}`);
/* الموظف يطلبها: بيانات الملف مقروءة، والراتب يظهر عند نعم، والمستند يصدر بالقالب بعد تنفيذ شؤون الموظفين بقائمة التحقق والحقل */
await become('P-AHMED', `#/new/${NEW}`, { width: 390, height: 844 });
ok('qs02-profile-shown', (await p.locator('.cf-profile', { hasText: 'أحمد' }).count()) === 1, 'الاسم من الملف');
ok('qs02-salary-hidden', (await p.locator('.cf-profile', { hasText: 'الراتب' }).count()) === 0, 'الراتب مخفي حتى نعم');
await p.locator('#cf-f-text-3').fill('بنك الرياض'); await p.locator('#cf-f-yesno-4 button', { hasText: 'نعم' }).click(); await p.waitForTimeout(300);
ok('qs02-salary-shown', (await p.locator('.cf-profile', { hasText: 'الراتب' }).count()) === 1, 'الراتب ظهر بعد نعم (يظهر إذا)');
await p.screenshot({ path: `${OUT}/v16-4-qs02-form.png`, fullPage: true });
await p.locator('.cfr .btn.primary.block').first().click(); await p.waitForTimeout(600); await p.locator('.cfr .btn.primary.block').first().click(); await p.waitForTimeout(1400);
s = await st(); let q1 = s.requests.find((r) => r.serviceId === NEW); ok('qs02-request', !!q1 && q1.fields.some((f) => f.key === 'f-profile-1' && f.value.includes('أحمد')) && q1.steps.find((x) => x.status === 'current')?.mode === 'fulfil', q1 ? q1.fields.map((f) => `${f.key}=${f.value}`).join(' · ') : 'missing');
const hrStep = q1.steps.find((x) => x.status === 'current');
await become(hrStep.assigneeIds[0], '#/inbox', { width: 1440, height: 900 });
await openTask('خطاب تعريف (اختبار');
await p.screenshot({ path: `${OUT}/v16-5-qs02-task.png`, fullPage: true });
await primary().click(); await p.waitForTimeout(500);
ok('qs02-checks-block', (await p.locator('.lb-split-detail .notice', { hasText: 'علّم كل بنود' }).count()) === 1 || (await p.locator('.lb-split-detail .field-err, .lb-split-detail .notice.danger').count()) >= 1, 'القرار ممنوع حتى تُعلَّم بنود التحقق');
await p.locator('.cf-checkrow input').first().check();
await p.locator('#cf-s-text-1').fill('OUT-2026-0091');
await primary().click(); await p.waitForTimeout(1200);
s = await st(); q1 = s.requests.find((r) => r.serviceId === NEW); const qdoc = q1.docs.find((d) => d.kind === 'issued');
ok('qs02-document-merged', q1.status === 'completed' && !!qdoc && (qdoc.body || []).length === 3 && qdoc.body[0].ar.includes('بنك الرياض') && qdoc.body[1].ar.includes('أحمد') && qdoc.body[2].ar.includes('SAR') && q1.steps.find((x) => x.id === 'hr')?.values?.['s-text-1'] === 'OUT-2026-0091' && (q1.steps.find((x) => x.id === 'hr')?.checks || []).length === 1, qdoc ? JSON.stringify(qdoc.body?.map((x) => x.ar)) : `${q1.status} · no doc`);
await become('P-AHMED', `#/requests/${q1.id}`, { width: 390, height: 844 });
await p.locator('.seal-act').first().click(); await p.waitForTimeout(1200);
ok('qs02-docsheet', (await p.locator('.docsheet').count()) === 1 && (await p.locator('.docsheet .sh-para, .docsheet .sh-lead').count()) === 3, 'ثلاث فقرات مدموجة على ورقة الهوية');
await p.screenshot({ path: `${OUT}/v16-6-qs02-doc.png`, fullPage: true });

/* ═══ 3) PR-07 الضيافة: نموذج على صفحات بجدول ومجموع محسوب ← المدير بخيار قرار وحقل يظهر إذا ← شريحة القيمة ← تنفيذ بحقول ← إشعار مدموج وتقويم ═══ */
await become('P-AHMED', '#/new/PR-07', { width: 390, height: 844 });
ok('pr07-paged', (await p.locator('.cf-pager').count()) === 1 && (await p.locator('.steps .num').innerText()).includes('1'), await p.locator('.steps .num').innerText());
await p.locator('#cf-occasion').fill('زيارة وفد اللجنة الفنية');
await p.locator('.cf-table .btn.quiet').click(); await p.waitForTimeout(200); await p.locator('.cf-table .btn.quiet').click(); await p.waitForTimeout(200);
const rowsL = p.locator('.cf-row'); ok('pr07-table-rows', (await rowsL.count()) === 2, `${await rowsL.count()} rows`);
await rowsL.nth(0).locator('input').nth(0).fill('سالم'); await rowsL.nth(0).locator('input').nth(1).fill('وزارة المالية'); await rowsL.nth(0).locator('input').nth(2).fill('2');
await rowsL.nth(1).locator('input').nth(0).fill('نورة'); await rowsL.nth(1).locator('input').nth(1).fill('وزارة المالية'); await rowsL.nth(1).locator('input').nth(2).fill('2');
ok('pr07-count-computed', (await p.locator('.cf-profile.calc .v').first().innerText()).trim() === '2', await p.locator('.cf-profile.calc .v').first().innerText());
await p.screenshot({ path: `${OUT}/v16-7-pr07-page1.png`, fullPage: true });
await p.locator('.cf-pager .btn.primary').click(); await p.waitForTimeout(600);
ok('pr07-page2', (await p.locator('#cf-estCost').count()) === 1, 'الصفحة الثانية');
await p.locator('#cf-dates').fill(plus(5)); await p.locator('#cf-dates-to').fill(plus(6)); await p.locator('#cf-estCost').fill('3000'); await p.waitForTimeout(200);
ok('pr07-per-guest', (await p.locator('.cf-profile.calc .v').last().innerText()).replace(/,/g, '').trim() === '1500', await p.locator('.cf-profile.calc .v').last().innerText());
await p.locator('.cf-pager .btn.primary').click(); await p.waitForTimeout(700);
ok('pr07-review', (await p.locator('.route-preview').count()) === 1, 'المعاينة');
await p.screenshot({ path: `${OUT}/v16-8-pr07-review.png`, fullPage: true });
await p.locator('.cfr .btn.primary.block').first().click(); await p.waitForTimeout(1400);
s = await st(); let pr = s.requests.find((r) => r.serviceId === 'PR-07');
ok('pr07-created', !!pr && pr.steps.find((x) => x.status === 'current')?.id === 'mgr' && pr.fields.some((f) => f.key === 'guests' && f.value.includes('2')), pr ? pr.fields.map((f) => `${f.key}=${f.value}`).join(' · ') : 'missing');
/* المدير: خيارات القرار — «موافقة بدرجة أقل» يُظهر حقل الدرجة المعتمدة ويلزمه؛ وتعديل التكلفة التقديرية */
await become('P-MONA', '#/inbox', { width: 1440, height: 900 });
await openTask('طلب ضيافة');
ok('pr07-outcomes-shown', (await p.locator('.cf-outcome').count()) === 3, `${await p.locator('.cf-outcome').count()} options`);
ok('pr07-table-shown', (await p.locator('.lb-split-detail .cf-tbl-view tr').count()) >= 3, 'جدول الضيوف في المهمة');
await p.locator('#oc-lower').click(); await p.waitForTimeout(300);
ok('pr07-step-field-showif', (await p.locator('#cf-approvedClass').count()) === 1, 'حقل الدرجة المعتمدة ظهر مع خيار «بدرجة أقل»');
await p.locator('.cf-checkrow input').first().check();
await p.locator('#cf-estCost').fill('2500');
await p.screenshot({ path: `${OUT}/v16-9-pr07-manager.png`, fullPage: true });
await p.locator('#cf-decide').click(); await p.waitForTimeout(500);
ok('pr07-required-step-field', (await p.locator('#cf-approvedClass').count()) === 1 && (await p.locator('.lb-split-detail .field-err, .lb-split-detail .field.invalid').count()) >= 1, 'الدرجة المعتمدة إلزامية عند هذا الخيار');
await p.locator('#cf-approvedClass button', { hasText: 'عادية' }).click();
await p.locator('#cf-decide').click(); await p.waitForTimeout(1200);
s = await st(); pr = s.requests.find((r) => r.serviceId === 'PR-07'); const mgrS = pr.steps.find((x) => x.id === 'mgr');
ok('pr07-outcome-recorded', mgrS.status === 'done' && mgrS.outcome === 'lower' && mgrS.values?.approvedClass === 'std' && (mgrS.edits || []).length === 1 && pr.configured.values.estCost === '2500' && pr.audit.some((a) => a.what.ar.includes('عدّل')), `${mgrS.outcome} · ${JSON.stringify(mgrS.values)} · edits ${JSON.stringify(mgrS.edits)}`);
const auth = pr.steps.find((x) => x.id === 'auth');
ok('pr07-band-department', auth.status === 'current' && (auth.assigneeIds || []).includes('P-DEPT'), `${auth.status} → ${auth.assigneeIds}`);
await become('P-DEPT', '#/inbox'); await openTask('طلب ضيافة'); await p.locator('#cf-decide').click(); await p.waitForTimeout(1000);
s = await st(); pr = s.requests.find((r) => r.serviceId === 'PR-07'); const proc = pr.steps.find((x) => x.id === 'proc');
ok('pr07-to-procurement', proc.status === 'current' && (proc.assigneeIds || []).includes('P-MAJED'), `${proc.status} → ${proc.assigneeIds}`);
await become('P-MAJED', '#/inbox'); await openTask('طلب ضيافة');
await p.locator('#cf-s-venue, #cf-venue').first().fill('فندق الفيصلية'); await p.locator('#cf-s-actual, #cf-actual').first().fill('2300');
await p.locator('#cf-decide').click(); await p.waitForTimeout(1200);
s = await st(); pr = s.requests.find((r) => r.serviceId === 'PR-07');
const notif = s.notifications.find((n) => n.to === 'P-AHMED' && n.title.ar.includes('فندق الفيصلية'));
ok('pr07-completed-notify-merged', pr.status === 'completed' && !!notif && notif.body.ar.includes('2,300') && notif.body.ar.includes('عادية'), notif ? `${notif.title.ar} · ${notif.body.ar}` : `${pr.status} · no merged notification`);
ok('pr07-calendar-event', s.calendar.some((e) => e.id === `CE-${pr.id}-cal`) && (s.comms.cal['P-AHMED'] || []).includes(`CE-${pr.id}-cal`), 'حدث الضيافة في تقويم أحمد');
/* اعتماد آلي: ضيافة صغيرة (500 ريال) تتخطى صاحب الصلاحية بقرار نظام */
await become('P-AHMED', '#/new/PR-07', { width: 390, height: 844 });
await p.locator('#cf-occasion').fill('ضيافة اجتماع قصير'); await p.locator('.cf-table .btn.quiet').click(); await p.waitForTimeout(200);
await p.locator('.cf-row').nth(0).locator('input').nth(0).fill('خالد'); await p.locator('.cf-row').nth(0).locator('input').nth(1).fill('الديوان'); await p.locator('.cf-row').nth(0).locator('input').nth(2).fill('1');
await p.locator('.cf-pager .btn.primary').click(); await p.waitForTimeout(500);
await p.locator('#cf-dates').fill(plus(3)); await p.locator('#cf-dates-to').fill(plus(3)); await p.locator('#cf-estCost').fill('500');
await p.locator('.cf-pager .btn.primary').click(); await p.waitForTimeout(600); await p.locator('.cfr .btn.primary.block').first().click(); await p.waitForTimeout(1200);
await become('P-MONA', '#/inbox', { width: 1440, height: 900 }); await openTask('طلب ضيافة'); await p.locator('#oc-full').click(); await p.locator('.cf-checkrow input').first().check(); await p.locator('#cf-decide').click(); await p.waitForTimeout(1000);
s = await st(); const pr2 = s.requests.filter((r) => r.serviceId === 'PR-07').find((r) => r.configured.values.estCost === '500'); const auth2 = pr2.steps.find((x) => x.id === 'auth');
ok('pr07-auto-approve', auth2.status === 'done' && auth2.actorId === 'system' && auth2.outcome === '__auto' && pr2.steps.find((x) => x.id === 'proc')?.status === 'current', `${auth2.status} by ${auth2.actorId} · ${auth2.note}`);

/* ═══ 4) HA-09 التصريح: توقيع إلزامي وحقل مخفي عن المدير، وخطوتان متوازيتان بشرط، وسجل بتاريخ انتهاء ومستند تصريح بقيم الخطوات، وإشعار إلى «من حقل»، والتجديد من سجلاتي ═══ */
await become('P-AHMED', '#/new/HA-09', { width: 390, height: 844 });
await p.locator('#cf-fullName').fill('يوسف عبدالله'); await p.locator('#cf-idNo').fill('2345678901'); await p.locator('#cf-company').fill('شركة الحلول المتقدمة'); await p.locator('#cf-role button', { hasText: 'متعاون' }).click();
await p.locator('#cf-idCopy').setInputFiles({ name: 'id.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') });
await p.locator('#cf-period').fill(plus(2)); await p.locator('#cf-period-to').fill(plus(60));
await p.locator('.cf-chips .pill', { hasText: 'المبنى الرئيس' }).click(); await p.locator('#cf-needAccount button', { hasText: 'نعم' }).click();
ok('ha09-host-default-me', (await p.locator('#cf-host').inputValue()) === 'P-AHMED', `host=${await p.locator('#cf-host').inputValue()}`);
await p.locator('.cfr .btn.primary.block').first().click(); await p.waitForTimeout(500);
ok('ha09-signature-required', (await p.locator('.cf-sign.bad').count()) === 1, 'التوقيع إلزامي');
await p.locator('#cf-sign').click(); await p.waitForTimeout(200);
ok('ha09-signed', (await p.locator('.cf-sign.on .cf-signed').count()) === 1, 'وُقّع باسمه ووقته');
await p.screenshot({ path: `${OUT}/v16-10-ha09-form.png`, fullPage: true });
await p.locator('.cfr .btn.primary.block').first().click(); await p.waitForTimeout(600);
ok('ha09-route-parallel-preview', (await p.locator('.route-preview').count()) === 1, 'المعاينة تعرض الخطوتين المتوازيتين');
await p.locator('.cfr .btn.primary.block').first().click(); await p.waitForTimeout(1400);
s = await st(); let ha = s.requests.find((r) => r.serviceId === 'HA-09');
ok('ha09-created', !!ha && ha.steps.find((x) => x.status === 'current')?.id === 'mgr', ha ? ha.steps.map((x) => `${x.id || x.key}:${x.status}`).join(',') : 'missing');
await become('P-DEPT', '#/inbox', { width: 1440, height: 900 }); await openTask('تصريح دخول');
ok('ha09-hidden-field', (await p.locator('.lb-split-detail .summary-row', { hasText: '2345678901' }).count()) === 0 && (await p.locator('.lb-split-detail', { hasText: 'مخفية' }).count()) === 1, 'رقم الهوية مخفي عن المدير');
await p.locator('#cf-decide').click(); await p.waitForTimeout(1200);
s = await st(); ha = s.requests.find((r) => r.serviceId === 'HA-09');
const gsS = ha.steps.find((x) => x.id === 'gs'); const itS = ha.steps.find((x) => x.id === 'it');
ok('ha09-parallel-open', gsS.status === 'current' && itS.status === 'current' && ha.status === 'in_review', `gs ${gsS.status} · it ${itS.status}`);
await become(gsS.assigneeIds[0], '#/inbox'); await openTask('تصريح دخول');
ok('ha09-parallel-note', (await p.locator('.lb-split-detail .notice', { hasText: 'متوازية' }).count()) === 1, 'إشعار الخطوة المتوازية');
await p.locator('#cf-s-badge, #cf-badge').first().fill('B-0421'); await p.locator('#cf-decide').click(); await p.waitForTimeout(1000);
s = await st(); ha = s.requests.find((r) => r.serviceId === 'HA-09');
ok('ha09-waits-for-second', ha.status === 'in_review' && ha.steps.find((x) => x.id === 'gs').status === 'done' && ha.steps.find((x) => x.id === 'it').status === 'current', ha.steps.map((x) => `${x.id || x.key}:${x.status}`).join(','));
await become(itS.assigneeIds[0], '#/inbox'); await openTask('تصريح دخول');
await p.locator('#cf-s-account, #cf-account').first().fill('yousef.ext'); await p.locator('#cf-decide').click(); await p.waitForTimeout(1200);
s = await st(); ha = s.requests.find((r) => r.serviceId === 'HA-09'); const permit = ha.docs.find((d) => d.kind === 'issued'); const entry = s.registers.find((e) => e.requestId === ha.id);
ok('ha09-completed-register', ha.status === 'completed' && !!entry && entry.registerId === 'permits' && entry.status === 'active' && entry.expiresAt === plus(60) && entry.values.fullName === 'يوسف عبدالله', entry ? `${entry.id} · ${entry.expiresAt} · ${JSON.stringify(entry.values)}` : `${ha.status} · no entry`);
ok('ha09-permit-merged', !!permit && permit.docKind === 'permit' && permit.validUntil === plus(60) && (permit.body || [])[1]?.ar.includes('B-0421') && (permit.body || [])[1]?.ar.includes('yousef.ext'), permit ? JSON.stringify(permit.body?.map((x) => x.ar)) : 'no permit');
const hostN = s.notifications.find((n) => n.to === 'P-AHMED' && n.title.ar.includes('صدر تصريح دخول لـيوسف'));
ok('ha09-notify-field', !!hostN, hostN ? hostN.body.ar : 'no notification to the host from field');
await become('P-AHMED', '#/me', { width: 390, height: 844 });
ok('ha09-my-registers', (await p.locator('.rg-row', { hasText: 'سجل تصاريح الدخول' }).count()) === 1 && (await p.locator('.rg-renew').count()) === 1, 'سجلاتي في ملفي مع زر التجديد');
await p.screenshot({ path: `${OUT}/v16-11-my-registers.png`, fullPage: true });
await p.locator('.rg-renew').first().click(); await p.waitForTimeout(1000);
ok('ha09-renew-prefill', (await p.url()).includes(`#/new/HA-09/renew/${entry.id}`) && (await p.locator('#cf-fullName').inputValue()) === 'يوسف عبدالله' && (await p.locator('.notice', { hasText: 'تجديد القيد' }).count()) === 1, await p.url());
/* الحصة: HA-09 حتى 5 في السنة تظهر ملاحظة؛ وDC-01 طلب جارٍ واحد يمنع الثاني */
ok('ha09-quota-note', (await p.locator('.notice', { hasText: 'الحصة' }).count()) === 1, 'ملاحظة الحصة على النموذج');
await become('P-AHMED', '#/new/DC-01');
await p.locator('#cf-addressee').fill('بنك البلاد'); await p.locator('#cf-purpose').selectOption('bank');
await p.locator('.cfr .btn.primary.block').first().click(); await p.waitForTimeout(500);
ok('dc01-declaration-required', (await p.locator('#cf-__decl').count()) === 1, 'الإقرار النهائي في المراجعة');
await p.locator('.cfr .btn.primary.block').last().click(); await p.waitForTimeout(400);
ok('dc01-declaration-blocks', (await p.locator('.cf-check.bad').count()) === 1, 'لا إرسال بلا إقرار');
await p.locator('#cf-__decl').check(); await p.locator('.cfr .btn.primary.block').last().click(); await p.waitForTimeout(1300);
s = await st(); const dc1 = s.requests.find((r) => r.serviceId === 'DC-01'); ok('dc01-created-notify-mgr', !!dc1 && dc1.steps.find((x) => x.id === 'mgr')?.status === 'done' && dc1.steps.find((x) => x.status === 'current')?.id === 'hr', dc1 ? dc1.steps.map((x) => `${x.id || x.key}:${x.status}`).join(',') : 'missing');
await become('P-AHMED', '#/new/DC-01');
ok('dc01-limit-open', (await p.locator('.notice.danger', { hasText: 'طلب جارٍ' }).count()) === 1 && (await p.locator('.cfr .btn.primary.block').first().isDisabled()), 'الحصة: طلب جارٍ واحد فقط');
await p.screenshot({ path: `${OUT}/v16-12-dc01-limit.png`, fullPage: true });

/* ═══ 5) القوالب والنسخ والاستيراد ═══ */
await become('admin', '#/admin/designer', { width: 1440, height: 900 });
await p.locator('.ptl-card.new').click(); await p.waitForTimeout(800);
await clickTab(/القوالب/);
ok('templates-listed', (await p.locator('.dz-use-tpl').count()) === 8, `${await p.locator('.dz-use-tpl').count()} templates`);
await p.screenshot({ path: `${OUT}/v16-13-templates.png`, fullPage: true });
await p.locator('.pt-card.dz-tpl', { hasText: 'استفسار' }).locator('.dz-use-tpl').click(); await p.waitForTimeout(1200);
s = await st(); const tpl = s.designer.versions[3].content.designer.services.find((x) => x.source === 'template');
ok('template-used', !!tpl && tpl.route[0].mode === 'review' && (await p.url()).includes(`#/admin/designer/svc/${tpl.id}`), tpl ? `${tpl.id} · ${tpl.route[0].mode}` : 'missing');
await clickTab(/فحص السلامة/); ok('template-safety-ok', (await p.locator('.cell-lead.danger').count()) === 0, 'قالب سليم من أول لحظة');
await clickTab(/المحاكاة/); await p.locator('#dz-sim-run').click(); await p.waitForTimeout(700);
ok('simulation-runs', (await p.locator('.route-preview').count()) === 1 && (await p.locator('.cell', { hasText: 'يستطيع الطلب' }).count()) === 1, 'المحاكاة: المسار والأهلية');
await p.screenshot({ path: `${OUT}/v16-14-simulation.png`, fullPage: true });
await p.goto(file + '#/admin/designer'); await p.waitForTimeout(900); await clickTab(/الخدمات المهيّأة/);
await p.locator('.dz-card-wrap', { hasText: 'خطاب لجهة خارجية' }).locator('.dz-card-tools .icon-btn').first().click(); await p.waitForTimeout(500);
await p.locator('#cl-ar').fill('خطاب لجهة خارجية — نسخة'); await p.locator('#cl-en').fill('External letter — copy');
await p.locator('.sheet .btn.primary.block, .lb-sheet .btn.primary.block').last().click(); await p.waitForTimeout(1200);
s = await st(); const cl = s.designer.versions[3].content.designer.services.find((x) => x.source === 'clone');
ok('clone-created', !!cl && cl.id !== 'DC-03' && cl.sections.length === 2 && cl.outputs.length === 1, cl ? `${cl.id} · ${cl.name.ar}` : 'missing');
await p.goto(file + '#/admin/designer'); await p.waitForTimeout(900); await clickTab(/الخدمات المهيّأة/);
const exported = await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('usp-portal-v1')); const svc = s.designer.versions[1].content.designer.services.find((x) => x.id === 'HA-09'); return JSON.stringify({ format: 'usp-service/1', service: { ...svc, id: 'HA-09', name: { ar: 'تصريح مستورد', en: 'Imported permit' } } }); });
await p.locator('.dz-import').click(); await p.waitForTimeout(500); await p.locator('#imp-json').fill(exported); await p.locator('.sheet .btn.primary.block, .lb-sheet .btn.primary.block').last().click(); await p.waitForTimeout(1200);
s = await st(); const imp = s.designer.versions[3].content.designer.services.find((x) => x.source === 'import');
ok('import-created', !!imp && imp.id === 'HA-10' && imp.tenant === 'GCC-SG' && imp.route.length === 3, imp ? `${imp.id} · ${imp.route.length} steps` : 'missing');
await p.screenshot({ path: `${OUT}/v16-15-services-tools.png`, fullPage: true });

/* ═══ 6) المستأجرون: إنشاء مستأجر وتبديل السياق (عزل الخدمات) ═══ */
await p.goto(file + '#/admin/tenants'); await p.waitForTimeout(900);
ok('tenants-screen', (await p.locator('.tn-card').count()) === 2, `${await p.locator('.tn-card').count()} tenants`);
await p.locator('.ptl-card.new').click(); await p.waitForTimeout(500);
await p.locator('#tn-key').fill('GCC-T2'); await p.locator('#tn-ar').fill('الجهة التجريبية الثالثة'); await p.locator('#tn-en').fill('Third test entity');
await p.locator('.sheet .btn.primary.block, .lb-sheet .btn.primary.block').last().click(); await p.waitForTimeout(900);
s = await st(); ok('tenant-created', s.tenants.length === 3 && s.tenants[2].id === 'GCC-T2' && s.tenants[2].status === 'onboarding', s.tenants.map((t) => t.id).join(','));
await p.locator('#tn-status').selectOption('active'); await p.locator('#tn-sysid').fill('H4S'); await p.waitForTimeout(300);
await p.screenshot({ path: `${OUT}/v16-16-tenants.png`, fullPage: true });
await p.locator('#tn-switch').click(); await p.waitForTimeout(1200);
s = await st(); ok('tenant-switched', s.tenant.id === 'GCC-T2' && (await p.url()).includes('#/admin/designer'), s.tenant.id);
await clickTab(/الخدمات المهيّأة/);
ok('tenant-isolated', (await p.locator('.pt-card').count()) === 0, 'لا خدمات للمستأجر الجديد');
await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('usp-portal-v1')); s.tenant = { id: 'GCC-SG', name: s.tenants[0].name }; localStorage.setItem('usp-portal-v1', JSON.stringify(s)); });

/* ═══ 7) العقود: خدمة بخطوة نظام على عقد غير مربوط تُمنع في فحص السلامة، وبعد ربطه تُقبل ═══ */
await p.goto(file + `#/admin/designer/svc/${tpl.id}`); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1100);
await clickTab(/^المسار/);
await p.locator('.dz-add-step').click(); await p.waitForTimeout(300);
await p.locator('.rt-step:not(.sys)').last().locator('.dz-modes button', { hasText: 'نظام عبر عقد' }).click(); await p.waitForTimeout(300);
await p.locator('.rt-step:not(.sys)').last().locator('.dz-contract').selectOption('hr.qualificationPost'); await p.waitForTimeout(300);
await clickTab(/فحص السلامة/);
ok('contract-unbound-blocks', (await p.locator('.cell', { hasText: 'غير مربوط' }).count()) >= 1 && (await p.locator('.cell', { hasText: 'غير مربوطة' }).count()) >= 1, `${await p.locator('.cell-lead.danger').count()} problems (unbound + mapping)`);
await p.screenshot({ path: `${OUT}/v16-17-contract-safety.png`, fullPage: true });
await p.goto(file + '#/admin/contracts'); await p.waitForTimeout(900);
ok('contracts-screen', (await p.locator('.ct-card').count()) === 11, `${await p.locator('.ct-card').count()} contracts`);
await p.locator('.ct-card', { hasText: 'تسجيل مؤهل' }).locator('.ct-bind').click(); await p.waitForTimeout(500);
await p.locator('#ct-dest').fill('H4S_DEV_ODATA'); await p.locator('#ct-cred').fill('BTP-DEST-H4S-DEV'); await p.locator('#ct-save').click(); await p.waitForTimeout(700);
s = await st(); const bnd = s.contracts.bindings.find((x) => x.contractId === 'hr.qualificationPost' && !x.endedAt);
ok('contract-bound', !!bnd && bnd.status === 'bound' && bnd.env === 'dev', bnd ? `${bnd.id} ${bnd.status}` : 'missing');
await p.locator('.ct-card', { hasText: 'تسجيل مؤهل' }).locator('.ct-test').click(); await p.waitForTimeout(500);
s = await st(); ok('contract-tested', s.contracts.bindings.find((x) => x.id === bnd.id)?.status === 'tested', 'اختُبر');
await p.screenshot({ path: `${OUT}/v16-18-contracts.png`, fullPage: true });

/* ═══ 8) السجلات لمدير النظام ═══ */
await p.goto(file + '#/admin/registers'); await p.waitForTimeout(900);
ok('registers-list', (await p.locator('.pt-card', { hasText: 'سجل تصاريح الدخول' }).count()) === 1, 'سجل التصاريح');
await p.locator('.pt-card', { hasText: 'سجل تصاريح الدخول' }).click(); await p.waitForTimeout(800);
ok('register-entries', (await p.locator('.rg-row').count()) === 1, `${await p.locator('.rg-row').count()} entries`);
await p.locator('#rgq').fill('يوسف'); await p.waitForTimeout(400); ok('register-search', (await p.locator('.rg-row').count()) === 1, 'البحث بالقيمة');
await p.screenshot({ path: `${OUT}/v16-19-register.png`, fullPage: true });

/* ═══ 9) بوابة التصميم: الشاشات الجديدة بلا فيض أفقي على الهاتف والحاسوب، بلغتين ═══ */
const gate = [];
const screens = ['#/admin/designer', `#/admin/designer/svc/PR-07`, '#/admin/tenants', '#/admin/contracts', '#/admin/registers/permits', '#/new/PR-07', '#/new/HA-09', `#/requests/${ha.id}`];
for (const [lang, vp] of [['ar', { width: 390, height: 844 }], ['en', { width: 390, height: 844 }], ['en', { width: 1440, height: 900 }]]) {
  await p.setViewportSize(vp);
  for (const h of screens) {
    await p.evaluate(({ lang, admin }) => { const s = JSON.parse(localStorage.getItem('usp-portal-v1')); s.settings.lang = lang; if (admin) { s.settings.persona = 'admin'; s.settings.actAs = undefined; } else { s.settings.persona = 'employee'; s.settings.actAs = 'P-AHMED'; } localStorage.setItem('usp-portal-v1', JSON.stringify(s)); }, { lang, admin: h.startsWith('#/admin') });
    await p.goto(file + h); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(900);
    const o = await overflow(); gate.push([h, lang, vp.width, o]);
    if (h.includes('svc/PR-07')) { for (const tab of [/^النموذج|^Form/, /^المسار|^Route/, /^المخرجات|^Outputs/, /الإشعارات|Notifications/, /الإحصاءات|Statistics/]) { await clickTab(tab); gate.push([`${h} ${tab}`, lang, vp.width, await overflow()]); } }
    if (vp.width === 390 && lang === 'ar') await p.screenshot({ path: `${OUT}/v16-gate-${h.replace(/[#/]/g, '_')}.png`, fullPage: true });
  }
}
const bad = gate.filter((g) => g[3] > 0);
ok('design-gate', bad.length === 0, bad.length ? bad.map((g) => `${g[0]} ${g[1]} ${g[2]}: ${g[3]}px`).join(' | ') : `${gate.length} checks, 0 overflow`);
await p.setViewportSize({ width: 1440, height: 900 }); await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('usp-portal-v1')); s.settings.lang = 'ar'; s.settings.persona = 'admin'; s.settings.actAs = undefined; localStorage.setItem('usp-portal-v1', JSON.stringify(s)); });
await p.goto(file + '#/admin/designer/svc/PR-07'); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1000); await clickTab(/^المسار/); await p.screenshot({ path: `${OUT}/v16-20-route-editor.png`, fullPage: true });
await p.locator('.dz-step-form').first().click(); await p.waitForTimeout(600); await p.screenshot({ path: `${OUT}/v16-21-step-form-sheet.png` });

const pass = rows.filter((r) => r.pass).length;
console.log(`\nTOTAL ${rows.length} checks · ${pass} PASS / ${rows.length - pass} FAIL · console errors ${errors.length}`);
if (errors.length) console.log(errors.slice(0, 8).join('\n'));
fs.writeFileSync(`${OUT}/results.json`, JSON.stringify({ rows, errors }, null, 2));
await b.close();
process.exit(rows.length - pass === 0 && errors.length === 0 ? 0 : 1);
