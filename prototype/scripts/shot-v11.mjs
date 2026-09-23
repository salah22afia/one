// v0.11 «أحتاج شيئاً» (AS-01 2.2): سيناريوهات القبول ق.ح-01 إلى ق.ح-24 آلياً عبر الواجهة نفسها — ما سبق في v0.10 على القاعدة الجديدة (اعتماد الترسية بالاستثناء D-024)، والتوفير من رصيد الجهة الفنية (D-023)، ومرفقات ملف الشراء والمورّد والعقد من قوائم النظام المرجعي، وتعذر الحد الأدنى للعروض (D-025)، والتحويل إلى جهة أخرى، وتنبيه التجزئة (ق-08)
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import path from 'node:path';
import fs from 'node:fs';
const file = 'file://' + path.resolve('dist/index.html');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
const errs = []; const checks = [];
const ok = (id, cond, detail) => { checks.push({ id, pass: !!cond, detail }); console.log(`${cond ? 'PASS' : 'FAIL'} ${id}: ${detail}`); };
const ph = { width: 400, height: 860 }; const lap = { width: 1440, height: 900 };
const toISO = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
const today = toISO(Date.now()); const tomorrow = toISO(Date.now() + 86400000); const in14 = toISO(Date.now() + 14 * 86400000); const in30 = toISO(Date.now() + 30 * 86400000);
fs.mkdirSync('shots/v11', { recursive: true });
const ATT = (n) => path.resolve(`shots/v11/tmp/${n}`);
const ctx = await b.newContext({ viewport: lap, deviceScaleFactor: 1, colorScheme: 'light' });
const p = await ctx.newPage();
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
p.on('pageerror', (e) => errs.push(e.message));
await p.goto(file + '#/home', { waitUntil: 'load' }); await p.waitForTimeout(900);
const shot = (n, full = true) => p.screenshot({ path: `shots/v11/v11-${n}.png`, fullPage: full });
const getState = () => p.evaluate(() => JSON.parse(localStorage.getItem('usp-portal-v1')));
const mutate = (fn) => p.evaluate((src) => { const s = JSON.parse(localStorage.getItem('usp-portal-v1')); (new Function('s', src))(s); localStorage.setItem('usp-portal-v1', JSON.stringify(s)); }, fn);
const asPerson = async (id, hash, vp = lap, wait = 1300) => { await mutate(`const who = s.people.find((x) => x.id === '${id}'); s.settings.persona = who.persona; s.settings.actAs = '${id}'; s.settings.lang = 'ar';`); await p.setViewportSize(vp); await p.goto(file + hash); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(wait); };
const asAdmin = async (hash, vp = lap) => { await mutate(`s.settings.persona = 'admin'; s.settings.actAs = undefined; s.settings.lang = 'ar';`); await p.setViewportSize(vp); await p.goto(file + hash); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1300); };
const req = async (id) => (await getState()).requests.find((r) => r.id === id);
const cur = (r) => r.steps.find((s) => s.status === 'current');
const notifs = async (personId, reqId) => (await getState()).notifications.filter((n) => n.to === personId && (!reqId || n.link?.includes(reqId) || n.title.ar.includes(reqId) || n.body.ar.includes(reqId)));
const audit = (r, k) => r.audit.some((a) => a.what.ar.includes(k));

/* ——— أدوات الواجهة ——— */
async function openTask(personId, reqId) {
  await asPerson(personId, '#/inbox');
  const rows = p.locator('.split .row'); const n = await rows.count();
  for (let i = 0; i < n; i++) { await rows.nth(i).locator('.cell').click(); await p.waitForTimeout(450); const txt = await p.locator('.split-detail .mono').first().textContent().catch(() => ''); if (txt.trim() === reqId) return true; }
  throw new Error(`task ${reqId} not found for ${personId} (${n} rows)`);
}
const primary = (text) => p.locator('.split-detail .btn.primary', { hasText: text });
const detailText = () => p.locator('.split-detail').textContent();
async function approve(personId, reqId) { await openTask(personId, reqId); await primary('اعتماد').first().click(); await p.waitForTimeout(700); }
/** الجهة الفنية: الاعتماد وتحديد الصنف — لكل بند رقم صنف (أو بند نصي بمجموعة وسعر) */
async function specify(personId, reqId, plan = {}, note, att) {
  await openTask(personId, reqId);
  if (att) await p.setInputFiles('#np-spec-att', ATT(att));
  const lines = p.locator('.split-detail .np-spec'); const n = await lines.count();
  for (let i = 0; i < n; i++) {
    const row = lines.nth(i); const txt = await row.textContent(); const key = Object.keys(plan).find((k) => txt.includes(k)); const sp = key ? plan[key] : null;
    if (sp?.itemId) { const pill = row.locator('.np-choice .pill', { hasText: 'رقم الصنف' }); if (await pill.count()) await pill.click(); await row.locator('select.select-in').selectOption(sp.itemId); }
    if (sp?.text !== undefined) { const pill = row.locator('.np-choice .pill', { hasText: 'بند نصي' }); if (await pill.count()) await pill.click(); await p.waitForTimeout(120); await row.locator('input[id^="sp-text-"]').fill(sp.text); if (sp.group) await row.locator('input[id^="sp-group-"]').fill(sp.group); }
    if (sp?.price !== undefined) await row.locator('input[id^="sp-price-"]').fill(String(sp.price));
    if (sp?.qty !== undefined) await row.locator('input[id^="sp-qty-"]').fill(String(sp.qty));
    await p.waitForTimeout(100);
  }
  if (note) await p.fill('#np-note', note);
  await primary('اعتماد وتحديد الصنف').click(); await p.waitForTimeout(700);
}
async function returnFromEntity(personId, reqId, note) { await openTask(personId, reqId); await p.fill('#np-note', note); await p.locator('.split-detail .btn.secondary', { hasText: 'إعادة بملاحظة' }).click(); await p.waitForTimeout(700); }
async function storeDecide(personId, reqId, plan, specs) {
  await openTask(personId, reqId);
  if (specs) { const rows = p.locator('.split-detail .np-spec'); const n = await rows.count(); for (let i = 0; i < n; i++) { const txt = await rows.nth(i).textContent(); const key = Object.keys(specs).find((k) => txt.includes(k)); if (key) await rows.nth(i).locator('select.select-in').selectOption(specs[key]); } await p.waitForTimeout(150); }
  const lines = p.locator('.split-detail .np-line:not(.np-spec)'); const n = await lines.count();
  for (let i = 0; i < n; i++) { const txt = await lines.nth(i).textContent(); const key = Object.keys(plan).find((k) => txt.includes(k)); const action = plan[key] || 'reserve'; await lines.nth(i).locator('.np-choice .pill', { hasText: action === 'reserve' ? 'حجز من المستودع' : 'تحويل إلى الشراء' }).click(); await p.waitForTimeout(120); }
  await primary('تأكيد قرار المستودع').click(); await p.waitForTimeout(700);
}
/** مكتب المشتريات: تجهيز الشراء */
async function prepare(personId, reqId, { est, method = 'عروض أسعار', why, contract, file: mergeFile, evaluator = 'entity', other, evalWhy = 'الجهة الفنية للفئة' }) {
  await openTask(personId, reqId);
  if (est !== undefined) await p.fill('#np-est', String(est));
  const pill = p.locator('.split-detail .chips .pill', { hasText: method }); if (await pill.isEnabled()) await pill.click(); await p.waitForTimeout(150);
  if (contract) { await p.selectOption('#np-contract', contract); await p.waitForTimeout(150); }
  await p.fill('#np-methodwhy', why);
  if (mergeFile) { await p.selectOption('#np-merge', mergeFile); await p.waitForTimeout(150); }
  if (await p.locator('#np-evalwhy').count()) {
    await p.locator('.split-detail .chips .pill', { hasText: evaluator === 'entity' ? 'الجهة الفنية للفئة' : evaluator === 'requester' ? 'مقدم الطلب' : 'جهة أسمّيها' }).click(); await p.waitForTimeout(150);
    if (evaluator === 'other') await p.selectOption('.split-detail .cell.stacked select.select-in', other);
    await p.fill('#np-evalwhy', evalWhy);
  }
  await primary('تجهيز الشراء وإرساله للاعتماد').click(); await p.waitForTimeout(700);
}
async function budget(personId, reqId, ref, amount) { await openTask(personId, reqId); if (ref) await p.fill('#np-budget', ref); if (amount !== undefined) await p.fill('#np-amount', String(amount)); const top = p.locator('.split-detail .btn.primary', { hasText: 'زيادة الحجز' }); if (await top.count()) await top.click(); else await primary('حجز الاعتماد وتأكيده').click(); await p.waitForTimeout(700); }
/** v0.11: المورّد من قائمة شركاء الأعمال (أو «جديد»)، والعملة، ومستند العرض إلزامي (setInputFiles على المدخل المخفي)، وعروض أقل من الحد بمبرر */
async function quotes(personId, reqId, offers, shortfallWhy) {
  await openTask(personId, reqId);
  for (let i = 0; i < offers.length; i++) {
    while ((await p.locator('.split-detail .np-offer-row').count()) < i + 1) { await p.locator('.split-detail .btn.soft', { hasText: 'إضافة عرض' }).click(); await p.waitForTimeout(120); }
    const row = p.locator('.split-detail .np-offer-row').nth(i); const o = offers[i];
    if (o.new) { await row.locator('select.np-offer-sup').selectOption('new'); await p.waitForTimeout(100); await row.locator('input.np-offer-new').fill(o.supplier); }
    else await row.locator('select.np-offer-sup').selectOption({ label: (await row.locator('select.np-offer-sup option').allTextContents()).find((x) => x.includes(o.supplier)) });
    if (o.currency) { await row.locator('select.np-offer-cur').selectOption(o.currency); await p.waitForTimeout(100); if (o.fx) await row.locator('input.np-offer-fx').fill(String(o.fx)); }
    await row.locator('input.np-offer-amt').fill(String(o.amount)); if (o.valid) await row.locator('input.np-offer-val').fill(o.valid);
    if (o.att !== null) await p.setInputFiles(`#np-att-${i}`, ATT(o.att || `offer-${(i % 5) + 1}.pdf`));
    await p.waitForTimeout(100);
  }
  if (shortfallWhy) await p.fill('#np-shortfall', shortfallWhy);
  await primary('تسجيل العروض').click(); await p.waitForTimeout(700);
}
async function evaluate(personId, reqId, supplier, note, att) { await openTask(personId, reqId); const row = p.locator('.split-detail .np-pick-row', { hasText: supplier }); if (await row.count()) await row.click(); else await p.fill('#np-offer', supplier); await p.fill('#np-evalnote', note); if (att) await p.setInputFiles('#np-evalatt', ATT(att)); await primary('إرسال التوصية').click(); await p.waitForTimeout(700); }
async function tender(personId, reqId, ref, result, supplier, amount) { await openTask(personId, reqId); await p.fill('#np-tref', ref); await p.fill('#np-tres', result); await p.selectOption('#np-tsup', { label: (await p.locator('#np-tsup option').allTextContents()).find((x) => x.includes(supplier)) }); await p.fill('#np-tamt', String(amount)); await p.setInputFiles('#np-tatt', ATT('minutes.pdf')); await primary('تسجيل نتيجة المناقصات').click(); await p.waitForTimeout(700); }
async function po(personId, reqId, poNo, exp) { await openTask(personId, reqId); await p.fill('#np-po', poNo); await p.fill('#np-exp', exp); await primary('تسجيل أمر الشراء').click(); await p.waitForTimeout(700); }
async function receipt(personId, reqId, ref, att) { await openTask(personId, reqId); await p.fill('#np-rec', ref); if (att) await p.setInputFiles('#np-recatt', ATT(att)); await primary('تأكيد الاستلام').click(); await p.waitForTimeout(700); }
async function handoverStart(personId, reqId) { await openTask(personId, reqId); await primary('ابدأ التسليم ووقّع').click(); await p.waitForTimeout(700); }
async function signOnPhone(personId, reqId, shotName) {
  await asPerson(personId, '#/inbox', ph);
  const rows = p.locator('.row'); const n = await rows.count(); let found = false;
  for (let i = 0; i < n && !found; i++) { await rows.nth(i).locator('.cell').click(); await p.waitForTimeout(700); const txt = await p.locator('.sheet .mono').first().textContent().catch(() => ''); if (txt.trim() === reqId) found = true; else { await p.keyboard.press('Escape'); await p.waitForTimeout(400); } }
  if (!found) throw new Error(`sign task ${reqId} not found for ${personId}`);
  if (shotName) await shot(shotName, false);
  await p.locator('.sheet .btn.primary', { hasText: 'أوقّع الاستلام' }).click(); await p.waitForTimeout(900);
}
/** المعالج: لمن وماذا (الكتالوج بأسماء مألوفة أو وصف حر) ثم التفاصيل ثم المراجعة والإرسال — يعيد رقم الطلب */
async function createNeed(requesterId, { beneficiaryId, cat, items = [], free = [], why, est, vp = lap, shotPrefix }) {
  await asPerson(requesterId, '#/new/AS-01', vp);
  if (beneficiaryId) { await p.locator('.chips .pill', { hasText: 'لموظف في وحدتي' }).click(); await p.waitForTimeout(200); await p.selectOption('#ben', beneficiaryId); await p.waitForTimeout(200); }
  await p.locator('.type-row', { hasText: cat }).click(); await p.waitForTimeout(600);
  for (const it of items) { for (let k = 0; k < (it.qty || 1); k++) { await p.locator('.need-k', { hasText: it.name }).first().click(); await p.waitForTimeout(150); } }
  for (const f of free) { await p.fill('.need-free input[aria-label="اسم المادة أو الخدمة"]', f.name); await p.fill('.need-free input.qty', String(f.qty || 1)); await p.locator('.need-free .btn', { hasText: 'إضافة بند' }).click(); await p.waitForTimeout(150); }
  const what = await p.locator('.page').textContent();
  if (shotPrefix) await shot(`${shotPrefix}-1-what`);
  await p.locator('.btn.primary.block', { hasText: 'التالي' }).click(); await p.waitForTimeout(600);
  await p.fill('#n-why', why); if (est) await p.fill('#n-est', String(est));
  if (shotPrefix) await shot(`${shotPrefix}-2-details`);
  await p.locator('.btn.primary.block', { hasText: 'المراجعة' }).click(); await p.waitForTimeout(700);
  const route = await p.locator('.route-preview').textContent().catch(() => ''); const skipped = await p.locator('.rp-skipped').textContent().catch(() => ''); const review = await p.locator('.page').textContent();
  if (shotPrefix) await shot(`${shotPrefix}-3-review`);
  await p.locator('.btn.primary.block', { hasText: 'إرسال الاحتياج' }).click(); await p.waitForTimeout(1600);
  const id = (await p.locator('.success-id').textContent()).trim();
  if (shotPrefix) await shot(`${shotPrefix}-4-sent`, false);
  return { id, route, skipped, what, review };
}
const linesOf = (r) => r.need.lines.map((l) => `${l.name.ar}:${l.status}:${l.itemId || l.materialGroup || '-'}`).join(' ');
const stepsOf = (r) => r.steps.map((s) => `${s.role || s.desk}:${s.status}`).join(' ');
const chainApprove = async (id) => { await approve('P-SARA', id); await approve('P-GM', id); await approve('P-ASG', id); };

/* ═══ ق.ح-01 مادة تقنية من الكتالوج متوفرة لمستفيد (أحمد) — بوابة المستوى، والسعر الاسترشادي، وتحديد الصنف ═══ */
{
  await asPerson('P-AHMED', '#/new/AS-01', ph); const gate = await p.locator('.need-gate').textContent(); await shot('01-gate-ahmed-phone', false);
  ok('ق.ح-01-a', gate.includes('اطلبه من مديرك') && gate.includes('مدير إدارة'), `Ahmed (specialist) sees «اطلبه من مديرك» with the minimum level`);
  const { id, route, what, review } = await createNeed('P-DEPT', { beneficiaryId: 'P-AHMED', cat: 'مادة تقنية', items: [{ name: 'حاسوب محمول (معيار الموظف)' }], why: 'جهاز لأحمد بدل جهازه المتعطل', vp: ph, shotPrefix: '01-wizard' });
  const r0 = await req(id); const L = r0.need.lines[0]; const chain = r0.steps.filter((s) => s.role === 'chain').map((s) => s.assigneeIds[0]);
  ok('ق.ح-01-b', /^REQ-2026-\d{4}$/.test(id) && !what.includes('M-100201') && what.includes('السعر الاسترشادي') && what.includes('4,800') && review.includes('القيمة الاسترشادية') && L.catalogId === 'K-laptop' && L.itemId === 'M-100201' && L.unitPrice === 4800 && r0.need.indicativeValue === 4800 && r0.need.estimatedValue === 4800 && route.includes('الاعتماد وتحديد الصنف') && route.includes('تجهيز الشراء') && route.includes('اعتماد الشراء') && route.includes('حجز الاعتماد') && route.includes('إنشاء طلب الشراء') && route.includes('اعتماد الترسية') && chain.join() === 'P-GM,P-ASG', `${id}: the requester picked «حاسوب محمول» from the catalogue by name (no item number shown), with the indicative price 4,800; behind the screen the line carries K-laptop → M-100201; the preview shows the revised route (identification, preparation, purchase approval, reservation, automatic PR, award); chain=${chain.join('→')}`);
  await approve('P-SARA', id); await openTask('P-GM', id); const gmTask = await detailText(); await shot('01-gm-task-indicative'); await primary('اعتماد').first().click(); await p.waitForTimeout(700); await approve('P-ASG', id); let r = await req(id);
  ok('ق.ح-01-c', gmTask.includes('القيمة الاسترشادية') && gmTask.includes('4,800') && cur(r)?.role === 'entity' && cur(r).assigneeIds.includes('P-ITS'), `the GM approved the need seeing the indicative value 4,800 → now IT (approval + identification): ${cur(r)?.assigneeIds.join(',')}`);
  await openTask('P-ITS', id); const itPanel = await detailText(); const prefilled = await p.locator('.split-detail .np-spec select.select-in').inputValue(); await shot('01-it-identify-panel');
  await specify('P-ITS', id, {}, 'المعيار المعتمد'); r = await req(id); const L1 = r.need.lines[0];
  ok('ق.ح-01-d', itPanel.includes('الاعتماد وتحديد الصنف') && prefilled === 'M-100201' && L1.specifiedBy === 'P-ITS' && L1.itemId === 'M-100201' && audit(r, 'حُدِّد الصنف') && (await notifs('P-DEPT', id)).some((n) => n.title.ar.includes('حدّدت تقنية المعلومات صنف احتياجك')) && cur(r)?.role === 'store' && cur(r).assigneeIds[0] === 'P-STORE2', `IT's task is «الاعتماد وتحديد الصنف» with M-100201 prefilled from the catalogue; Abdulaziz confirmed → audit «حُدِّد الصنف», requester told «حدّدت تقنية المعلومات صنف احتياجك», now the technical store`);
  await openTask('P-STORE2', id); const avail = await p.locator('.split-detail .np-line').first().textContent(); await shot('01-store-panel');
  await storeDecide('P-STORE2', id, { 'حاسوب': 'reserve' }); r = await req(id); const st = (await getState()).erp.stock.find((x) => x.itemId === 'M-100201' && x.storeId === '1020');
  ok('ق.ح-01-e', avail.includes('المتاح: 2') && r.need.lines[0].status === 'reserved' && /^2000\d{4}$/.test(r.need.lines[0].reservationNo) && st.qty === 1 && r.steps.find((s) => s.role === 'store').outcome === 'available' && cur(r)?.role === 'handover', `store saw «المتاح: 2» on the identified item, reserved (reservation ${r.need.lines[0].reservationNo}, stock 2→${st.qty}); now: handover`);
  await handoverStart('P-STORE2', id); await signOnPhone('P-AHMED', id, '01-sign-phone'); r = await req(id); const custody = (await getState()).custody.filter((c) => c.requestId === id);
  ok('ق.ح-01-f', r.status === 'completed' && r.steps.filter((s) => s.branch && s.branch !== 'stock').every((s) => s.status === 'skipped') && !r.need.procurement?.prNo && r.need.lines[0].status === 'delivered' && /^49000\d{5}$/.test(r.need.lines[0].materialDocNo) && /^4000\d{5}$/.test(r.need.lines[0].assetNo) && r.docs.some((d) => d.kind === 'issued') && custody.length === 1 && custody[0].personId === 'P-AHMED', `Ahmed signed → ${r.status}; the whole purchase branch (13 steps incl. the automatic PR) was skipped with reasons; material document ${r.need.lines[0].materialDocNo}, asset ${r.need.lines[0].assetNo}, custody for Ahmed`);
  await asPerson('P-AHMED', `#/requests/${id}`, ph); const pg = await p.locator('.page').textContent(); await shot('01-request-phone');
  ok('ق.ح-01-g', pg.includes('الطلب') && pg.includes('الاعتماد') && pg.includes('التجهيز') && pg.includes('التسليم') && pg.includes('ما طلبه الطالب') && pg.includes('حاسوب محمول (معيار الموظف)') && pg.includes('حاسوب محمول 14 بوصة'), `the request page groups the journey into segments (الطلب، الاعتماد، التجهيز، التسليم) and keeps the catalogue name «حاسوب محمول (معيار الموظف)» beside the identified master item «حاسوب محمول 14 بوصة»`);
  globalThis.R01 = id;
}

/* ═══ ق.ح-02 مادة عامة غير متوفرة: كرسي مكتب — فرع الشراء المنقّح كاملاً حتى العهدة ═══ */
{
  const { id, route } = await createNeed('P-DEPT', { cat: 'مادة عامة', items: [{ name: 'كرسي مكتب' }], why: 'كرسي بدل التالف في مكتبي', shotPrefix: '02-wizard' });
  ok('ق.ح-02-a', route.includes('الاعتماد وتحديد الصنف') && route.includes('فيصل') && route.includes('المستودع: التوفر والحجز') && route.includes('يوسف') && route.includes('عند انحراف فقط (وإلا آلياً)') && route.includes('إن احتاجت الطريقة عروضاً') && !route.includes('إن وفّرته الجهة الفنية من رصيدها'), `${id}: route shows General Services (Faisal), the general store (Yousef) and the conditional purchase steps — award approval «عند انحراف فقط (وإلا آلياً)» (D-024); no entity-pool segment for a store-backed material`);
  await chainApprove(id); await specify('P-GSM', id, {}, 'مطابق للمواصفة');
  await storeDecide('P-STORE1', id, { 'كرسي': 'purchase' }); let r = await req(id);
  ok('ق.ح-02-b', r.steps.find((s) => s.role === 'store').outcome === 'unavailable' && r.need.lines[0].status === 'purchasing' && cur(r)?.role === 'procurement' && (await notifs('P-DEPT', id)).some((n) => n.title.ar.includes('تحوّل إلى الشراء')), `general store: «غير متوفر» → line to purchase, now with procurement (preparation); requester told`);
  await openTask('P-MAJED', id); const prepTxt = await detailText(); await shot('02-prepare-panel');
  await prepare('P-MAJED', id, { est: 950, method: 'عروض أسعار', why: 'الأثاث متاح لدى عدة موردين', evaluator: 'entity', evalWhy: 'الأثاث من اختصاص الخدمات العامة' }); r = await req(id); const pr0 = r.need.procurement;
  ok('ق.ح-02-c', prepTxt.includes('تجهيز الشراء') && prepTxt.includes('عروض أسعار') && prepTxt.includes('عقد إطاري قائم') && prepTxt.includes('شراء مباشر بمبرر') && prepTxt.includes('مناقصة') && pr0.method === 'quotes' && pr0.methodFlags.offers && pr0.methodFlags.minOffers === 3 && /^PF-/.test(pr0.purchaseFile) && pr0.band?.id === 'B1' && cur(r)?.role === 'purchaseApproval' && cur(r).assigneeIds.join() === 'P-GM' && cur(r).why.ar.includes('حتى 500 ألف') && (await notifs('P-DEPT', id)).some((n) => n.title.ar.includes('تسلّم مكتب المشتريات')), `Majed prepared the purchase: estimate 950, method «عروض أسعار» (3 offers), evaluator = General Services → purchase approval resolved by the delegation table to band B1 (procurement director; vacant → the GM acts): «${cur(r)?.why.ar.slice(0, 90)}»`);
  await openTask('P-GM', id); const sumTxt = await p.locator('.split-detail .np-sum').textContent(); await shot('02-purchase-approval'); await primary('اعتماد').first().click(); await p.waitForTimeout(700); r = await req(id);
  ok('ق.ح-02-d', sumTxt.includes('ملخص الشراء') && sumTxt.includes('عروض أسعار') && sumTxt.includes('950') && cur(r)?.role === 'budget' && cur(r).assigneeIds[0] === 'P-BUDG', `the GM saw the purchase summary (method, estimate, band) and approved → budget (Lamia)`);
  await openTask('P-BUDG', id); const bTxt = await detailText(); const amt = await p.locator('#np-amount').inputValue(); await shot('02-budget-reserve'); await budget('P-BUDG', id, 'FM-2026-0417'); r = await req(id);
  ok('ق.ح-02-e', bTxt.includes('حجز الاعتماد') && amt === '950' && r.need.procurement.reservation?.no === 'FM-2026-0417' && r.need.procurement.reservation.amount === 950 && r.steps.find((s) => s.role === 'tender').status === 'skipped' && audit(r, 'ليست مناقصة') && cur(r)?.role === 'quotes' && (await notifs('P-DEPT', id)).some((n) => n.title.ar.includes('حُجز اعتماد احتياجك')), `Lamia reserved FM-2026-0417 for the prefilled 950 (funds reservation) → tender skipped («ليست مناقصة») → now: collecting offers; requester told «حُجز اعتماد احتياجك»`);
  await openTask('P-MAJED', id); await shot('02-quotes-panel'); await quotes('P-MAJED', id, [{ supplier: 'شركة المكاتب الحديثة', amount: 920, valid: in30 }, { supplier: 'معرض الأثاث الوطني', amount: 980, valid: in30 }, { supplier: 'مؤسسة التجهيزات المكتبية', amount: 1010 }]); r = await req(id);
  ok('ق.ح-02-f', r.need.procurement.offers.count === 3 && r.need.procurement.offers.list[0].supplier === 'شركة المكاتب الحديثة' && r.need.procurement.offers.list[0].supplierId === 'BP-1000201' && r.need.procurement.offers.list.every((o) => o.attachment) && r.docs.filter((d) => d.kind === 'attachment' && d.stage?.ar.startsWith('عرض')).length === 3 && cur(r)?.role === 'evaluator' && cur(r).assigneeIds.includes('P-GSM') && (await notifs('P-DEPT', id)).some((n) => n.title.ar.includes('طُلبت العروض')), `three offers recorded (920 / 980 / 1,010), each supplier picked from the ERP business-partner list (BP-1000201…) with its offer document attached (3 docs in the purchase file) → technical evaluation by General Services; requester told`);
  await openTask('P-GSM', id); await shot('02-evaluate-panel'); await evaluate('P-GSM', id, 'معرض الأثاث الوطني', 'الأعلى جودة مع ضمان خمس سنوات؛ فرق السعر 60 ريالاً', 'offer-2.pdf'); r = await req(id);
  ok('ق.ح-02-g', r.need.procurement.recommendation?.offer === 'معرض الأثاث الوطني' && r.need.procurement.recommendation.amount === 980 && r.steps.find((s) => s.role === 'budgetTopUp').status === 'skipped' && audit(r, 'ضمن المبلغ المحجوز') && cur(r)?.role === 'awardApproval' && cur(r).assigneeIds.join() === 'P-GM' && r.need.procurement.awardWhy?.some((w) => w.ar.includes('ليس الأدنى')) && !r.need.procurement.awardAuto, `Faisal recommended 980 — NOT the lowest (920) — within the 950 + 10% tolerance → top-up skipped; the deviation «ليس الأدنى» opens award approval with the same band (GM acting) instead of automatic award`);
  await openTask('P-GM', id); const awTxt = await p.locator('.split-detail .np-sum').textContent(); await shot('02-award-approval'); await primary('اعتماد').first().click(); await p.waitForTimeout(800); r = await req(id); const pr = r.need.procurement;
  ok('ق.ح-02-h', awTxt.includes('معرض الأثاث الوطني') && awTxt.includes('980') && awTxt.includes('سبب فتح اعتماد الترسية') && awTxt.includes('ليس الأدنى') && awTxt.includes('ملف الشراء') && /^1000\d{4}$/.test(pr.prNo) && pr.prStatus === 'released' && pr.award?.supplier === 'معرض الأثاث الوطني' && pr.award.supplierId === 'BP-1000202' && pr.award.amount === 980 && r.steps.find((s) => s.role === 'pr').status === 'done' && r.steps.find((s) => s.role === 'pr').actorId === 'system' && audit(r, 'أنشأ النظام طلب الشراء') && audit(r, '(BP-1000202)') && audit(r, 'يخصم من حجز الاعتماد FM-2026-0417') && cur(r)?.role === 'po' && (await notifs('P-DEPT', id)).some((n) => n.title.ar.includes(`أُنشئ طلب الشراء ${pr.prNo}`)), `the GM saw why the award needed him («ليس الأدنى») and the purchase file, approved → the system created PR ${pr.prNo} automatically (released, supplier BP-1000202 and price from the award, consuming reservation FM-2026-0417) → now: purchase order; requester told`);
  await po('P-MAJED', id, '4500012901', in14); r = await req(id);
  ok('ق.ح-02-i', r.need.procurement.poNo === '4500012901' && cur(r)?.role === 'receipt' && cur(r).assigneeIds[0] === 'P-STORE1' && (await notifs('P-DEPT', id)).some((n) => n.title.ar.includes('4500012901')), `PO 4500012901 with expected ${in14} → receipt task at the general store`);
  await asPerson('P-DEPT', `#/requests/${id}`); const pg = await p.locator('.page').textContent(); await shot('02-request-stages');
  ok('ق.ح-02-j', pg.includes(pr.prNo) && pg.includes('FM-2026-0417') && pg.includes('4500012901') && pg.includes('ملخص الشراء') && pg.includes('الشراء') && pg.includes('التوريد') && pg.includes('مراجع النظام المرجعي') && pg.includes('عروض أسعار'), `the request page shows the segments, the purchase summary with the offers table, and the references (reservation, PR, PO)`);
  await receipt('P-STORE1', id, '5000012345', 'delivery.pdf'); await handoverStart('P-STORE1', id); await signOnPhone('P-DEPT', id); r = await req(id); const c = (await getState()).custody.filter((x) => x.requestId === id);
  ok('ق.ح-02-k', r.status === 'completed' && r.need.lines[0].status === 'delivered' && c.length === 1 && c[0].personId === 'P-DEPT' && r.need.handover.number && r.docs.filter((d) => d.kind === 'attachment').length === 5, `goods receipt (delivery note attached) → handover signed → completed, custody recorded, note ${r.need.handover.number}; the purchase file holds 5 attachments (3 offers, recommendation, delivery note)`);
  globalThis.R02 = id; globalThis.PR02 = pr.prNo;
}

/* ═══ ق.ح-03 خدمة تقنية بوصف حر: رخص برمجيات (م7) — بند نصي بمجموعة أصناف ═══ */
{
  const { id, route, skipped } = await createNeed('P-DEPT', { cat: 'خدمة تقنية', free: [{ name: 'رخصة برنامج التحليل الإحصائي', qty: 10 }], why: 'رخص لفريق التحليل', shotPrefix: '03-wizard' });
  let r = await req(id);
  ok('ق.ح-03-a', r.need.kind === 'service' && !r.steps.some((s) => s.role === 'store') && !r.steps.some((s) => s.role === 'handover' && s.branch !== 'provided') && r.steps.some((s) => s.role === 'handover' && s.branch === 'provided') && r.need.lines[0].status === 'purchasing' && r.need.lines[0].asked?.ar === 'رخصة برنامج التحليل الإحصائي' && !route.includes('المستودع') && skipped === '', `${id}: service route م7 — no store and no stock handover, only the conditional «provided from the entity pool» handover; the requester's own words are kept as «ما طلبه الطالب»`);
  await chainApprove(id); await openTask('P-ITM', id); await shot('03-it-text-item'); await specify('P-ITM', id, { 'رخصة': { text: 'رخص SPSS Statistics (سنة)', group: 'SW-LIC', price: 4500 } }, 'الاشتراك السنوي'); r = await req(id); const L = r.need.lines[0];
  ok('ق.ح-03-b', !L.itemId && L.materialGroup === 'SW-LIC' && L.unitPrice === 4500 && L.name.ar === 'رخص SPSS Statistics (سنة)' && L.asked.ar === 'رخصة برنامج التحليل الإحصائي' && r.need.estimatedValue === 45000 && cur(r)?.role === 'procurement', `IT identified the service as a text item with material group SW-LIC at 4,500 × 10 = 45,000 (no product master); the requester's words stay beside it`);
  await prepare('P-MAJED', id, { est: 45000, why: 'رخص متاحة لدى أكثر من موزّع', evaluator: 'entity', evalWhy: 'الرخص التقنية تقيّمها تقنية المعلومات' }); await approve('P-GM', id); await budget('P-BUDG', id, 'FM-2026-0418'); await quotes('P-MAJED', id, [{ supplier: 'الموزّع المعتمد', amount: 44000 }, { supplier: 'شركة البرمجيات', amount: 46500, new: true }, { supplier: 'مؤسسة التحليل', amount: 45900, new: true }]); r = await req(id);
  ok('ق.ح-03-c', cur(r)?.role === 'evaluator' && cur(r).assigneeIds.includes('P-ITM') && cur(r).assigneeIds.includes('P-ITS'), `prepared, approved, reserved and three offers recorded → IT evaluates (${cur(r)?.assigneeIds.join(',')})`);
  await evaluate('P-ITS', id, 'الموزّع المعتمد', 'الأدنى والوحيد المعتمد من المطوّر'); r = await req(id); const autoStep = r.steps.find((s) => s.role === 'awardApproval');
  ok('ق.ح-03-d', autoStep.status === 'done' && autoStep.actorId === 'system' && r.need.procurement.awardAuto && audit(r, 'اعتُمدت الترسية آلياً بقاعدة الاستثناء') && /^1000\d{4}$/.test(r.need.procurement.prNo) && cur(r)?.role === 'po' && (await notifs('P-DEPT', id)).some((n) => n.body.ar.includes('اعتُمدت الترسية آلياً')), `D-024: the lowest compliant offer within the estimate with all three offers → the award was approved automatically by the system (no second approval) and PR ${r.need.procurement.prNo} created at once → purchase order; requester told`);
  await po('P-MAJED', id, '4500012902', in14); r = await req(id);
  ok('ق.ح-03-d2', cur(r)?.role === 'receipt' && (cur(r).assigneeIds.includes('P-ITM') || cur(r).assigneeIds.includes('P-ITS')), `PO → service receipt task with IT`);
  await receipt('P-ITS', id, '1000004567'); r = await req(id);
  ok('ق.ح-03-e', r.status === 'completed' && r.need.procurement.serviceEntryNo === '1000004567' && r.need.lines[0].status === 'delivered' && !(await getState()).custody.some((c) => c.requestId === id) && !r.docs.some((d) => d.kind === 'issued'), `IT confirmed the service (entry sheet 1000004567) → completed, no custody, no handover note`);
  await asPerson('P-DEPT', `#/requests/${id}`); await shot('03-service-request');
}

/* ═══ ق.ح-04 خدمة غير تقنية: ترجمة (لا جهة فنية؛ المشتريات تعيّن مقدم الطلب مقيّماً) ═══ */
{
  const { id, skipped } = await createNeed('P-DEPT', { cat: 'خدمة عامة', items: [{ name: 'ترجمة' }], why: 'الترجمة للنسخة الإنجليزية من التقرير (120 صفحة)', est: 18000 });
  let r = await req(id);
  ok('ق.ح-04-a', !r.steps.some((s) => s.role === 'entity') && skipped.includes('لا جهة فنية لهذه الفئة') && r.need.lines[0].catalogId === 'K-translation', `${id}: «ترجمة» from the catalogue; no technical entity — the identification step is listed as not applicable`);
  await chainApprove(id);
  await openTask('P-MAJED', id); const chips = await p.locator('.split-detail .cell.stacked').last().textContent(); await shot('04-procurement-freedom');
  await prepare('P-MAJED', id, { est: 18000, why: 'خدمة متاحة لدى مكاتب معتمدة', evaluator: 'requester', evalWhy: 'لا جهة فنية؛ الطالب أقدر على تقييم جودة الترجمة' }); r = await req(id);
  ok('ق.ح-04-b', !chips.includes('الجهة الفنية للفئة') && chips.includes('مقدم الطلب') && chips.includes('جهة أسمّيها') && r.need.procurement.evaluator.personIds.join() === 'P-DEPT' && audit(r, 'المقيّم: عبدالرحمن'), `procurement freedom: no entity option; Majed named the requester as evaluator with a recorded reason`);
  await approve('P-GM', id); await budget('P-BUDG', id, 'FM-2026-0419'); await quotes('P-MAJED', id, [{ supplier: 'مكتب الترجمة المعتمد', amount: 17500 }, { supplier: 'دار اللغات', amount: 18900 }, { supplier: 'مركز الترجمة الحديث', amount: 18200 }]); r = await req(id);
  ok('ق.ح-04-c', cur(r)?.role === 'evaluator' && cur(r).assigneeIds.join() === 'P-DEPT', `the requester evaluates the offers himself`);
  await evaluate('P-DEPT', id, 'مكتب الترجمة المعتمد', 'الأدنى وجودة عينة الترجمة أعلى'); await po('P-MAJED', id, '4500012903', in14); r = await req(id);
  ok('ق.ح-04-d', cur(r)?.role === 'receipt' && cur(r).assigneeIds.join() === 'P-DEPT' && r.need.procurement.award?.supplier === 'مكتب الترجمة المعتمد' && r.need.procurement.awardAuto, `lowest offer → automatic award → automatic PR → PO → the requester receives the service himself`);
  await receipt('P-DEPT', id, '1000004568'); r = await req(id);
  ok('ق.ح-04-e', r.status === 'completed' && r.need.procurement.serviceEntryNo === '1000004568', `service entry sheet 1000004568 → completed`);
}

/* ═══ ق.ح-05 فوق عتبة المناقصات: مناقصة إلزامية ولجنة بنصاب الكل + ق.ح-09-ج الإلغاء بعد أمر الشراء يحرّر الحجز ═══ */
{
  const { id } = await createNeed('P-DEPT', { cat: 'خدمة تقنية', free: [{ name: 'منصة تحليلات مؤسسية (اشتراك 3 سنوات)', qty: 1 }], why: 'منصة موحدة للتقارير', est: 620000 });
  await chainApprove(id); await specify('P-ITM', id, { 'منصة': { text: 'منصة تحليلات مؤسسية — اشتراك 3 سنوات', group: 'SW-SAAS', price: 620000 } });
  await openTask('P-MAJED', id); const forced = await detailText(); const quotesDisabled = await p.locator('.split-detail .chips .pill', { hasText: 'عروض أسعار' }).isDisabled(); await shot('05-forced-tender');
  await prepare('P-MAJED', id, { est: 620000, method: 'مناقصة', why: 'فوق العتبة' }); let r = await req(id);
  ok('ق.ح-05-a', forced.includes('القيمة فوق عتبة المناقصات') && quotesDisabled && r.need.procurement.methodFlags.tender && !r.need.procurement.methodFlags.offers && r.need.procurement.band?.id === 'B2' && cur(r)?.role === 'purchaseApproval' && cur(r).quorum === 'all' && cur(r).assigneeIds.includes('P-ASG') && cur(r).assigneeIds.includes('P-GM'), `620,000 > 500,000: the method is forced to «مناقصة» (other methods disabled) and the purchase approval goes to band B2 — the tender committee (sector head + GM, all must approve)`);
  await approve('P-ASG', id); r = await req(id); const stillCurrent = cur(r)?.role === 'purchaseApproval' && (cur(r).decisions || []).length === 1;
  await approve('P-GM', id); r = await req(id);
  ok('ق.ح-05-b', stillCurrent && cur(r)?.role === 'budget', `Saud approved first (step stays open for the quorum), then Abdullah → both approvals recorded → budget`);
  await budget('P-BUDG', id, 'FM-2026-0420'); r = await req(id);
  ok('ق.ح-05-c', cur(r)?.role === 'tender' && r.steps.find((s) => s.role === 'quotes').status === 'pending' && (await notifs('P-DEPT', id)).some((n) => n.body.ar.includes('أُحيل إلى إجراء المناقصات')), `after the reservation the request goes to the tender procedure; requester told «أُحيل إلى إجراء المناقصات»`);
  await openTask('P-MAJED', id); await shot('05-tender-panel'); await tender('P-MAJED', id, 'TND-2026-07', 'رست على العرض 3', 'شركة المنصات الرقمية', 598000); r = await req(id);
  ok('ق.ح-05-d', r.need.procurement.tender.ref === 'TND-2026-07' && r.need.procurement.tender.supplierId === 'BP-1000501' && r.need.procurement.tender.attachment === 'minutes.pdf' && r.docs.some((d) => d.stage?.ar.includes('محضر')) && r.need.procurement.recommendation?.amount === 598000 && r.steps.find((s) => s.role === 'quotes').status === 'skipped' && r.steps.find((s) => s.role === 'evaluator').status === 'skipped', `tender TND-2026-07 recorded with the winner from the ERP supplier list (BP-1000501, 598,000) and the committee minutes attached → offers and evaluation skipped (the committee did that)`);
  const awS = r.steps.find((s) => s.role === 'awardApproval');
  ok('ق.ح-05-e', awS.status === 'done' && awS.actorId === 'system' && audit(r, 'رست عليه لجنة المناقصات') && /^1000\d{4}$/.test(r.need.procurement.prNo) && r.need.procurement.award?.supplier === 'شركة المنصات الرقمية' && r.need.procurement.award.supplierId === 'BP-1000501' && r.need.procurement.award.amount === 598000 && cur(r)?.role === 'po', `the committee decision IS the award (D-024): no second approval — automatic PR ${r.need.procurement.prNo} for شركة المنصات الرقمية at 598,000 → purchase order`);
  await po('P-MAJED', id, '4500012904', in14); await asPerson('P-DEPT', `#/requests/${id}`); const stages = await p.locator('.need-stages').textContent(); await shot('05-request-tender-stage');
  ok('ق.ح-05-f', stages.includes('إجراء المناقصات') && stages.includes('TND-2026-07') && stages.includes('4500012904') && stages.includes('لجنة المناقصات') === false || stages.includes('اعتماد الترسية'), `the requester sees the tender stage with its reference, the award and the PO`);
  /* ق.ح-09-ج: بعد أمر الشراء يطلب الإلغاء فيقرره مكتب المشتريات ويُحرَّر حجز الاعتماد */
  const canBtn = p.locator('.btn', { hasText: 'طلب إلغاء الاحتياج' }); const hasCancel = await canBtn.count();
  await canBtn.click(); await p.waitForTimeout(600); await p.fill('#nc-reason', 'تغيّرت الحاجة بعد اعتماد منصة الأمانة الموحدة'); await shot('09c-cancel-sheet', false); await p.locator('.sheet .btn.primary', { hasText: 'إرسال طلب الإلغاء' }).click(); await p.waitForTimeout(700);
  const majedTask = (await notifs('P-MAJED', id)).some((n) => n.title.ar.includes('إلغاء'));
  await asPerson('P-MAJED', '#/desk/procurement'); const deskTxt = await p.locator('.page').textContent(); await shot('09c-desk-cancel');
  await p.locator('.desk-row', { hasText: id }).first().click(); await p.waitForTimeout(600); await p.fill('#dk-cnote', 'أمر الشراء لم يُنفَّذ بعد؛ أُلغي لدى المورد'); await p.locator('.split-detail .btn.danger', { hasText: 'قبول الإلغاء' }).click(); await p.waitForTimeout(800); r = await req(id);
  ok('ق.ح-09-c', hasCancel === 1 && majedTask && deskTxt.includes('طلب الإلغاء عند المشتريات') && r.status === 'withdrawn' && r.need.cancel.accepted && r.need.lines[0].status === 'cancelled' && r.need.procurement.reservation.released && audit(r, 'حُرِّر حجز الاعتماد FM-2026-0420') && (await notifs('P-DEPT', id)).some((n) => n.title.ar.includes('أُلغي احتياجك')), `after the PO the requester asked to cancel → Majed accepted → withdrawn, line cancelled, funds reservation FM-2026-0420 released («${r.audit.find((a) => a.what.ar.includes('حُرِّر'))?.what.ar.slice(0, 80)}»)`);
}

/* ═══ ق.ح-06 توفر جزئي: شاشتان (غير متوفرتين) وحامل (متوفر) في طلب واحد ═══ */
{
  const { id } = await createNeed('P-DEPT', { cat: 'مادة تقنية', items: [{ name: 'شاشة مكتب', qty: 2 }, { name: 'حامل حاسوب محمول' }], why: 'تجهيز مكتب المحلل الجديد', shotPrefix: '06-wizard' });
  let r = await req(id);
  ok('ق.ح-06-a', r.need.lines.length === 2 && r.need.lines[0].qty === 2 && r.need.lines[1].qty === 1 && r.need.indicativeValue === 2880, `${id}: two catalogue lines — monitors ×2 and stand ×1, indicative 2,880`);
  await chainApprove(id); await specify('P-ITM', id);
  await openTask('P-STORE2', id); const monitorLine = await p.locator('.split-detail .np-line', { hasText: 'شاشة' }).textContent(); const reserveDisabled = await p.locator('.split-detail .np-line', { hasText: 'شاشة' }).locator('.pill', { hasText: 'حجز' }).isDisabled();
  await storeDecide('P-STORE2', id, { 'شاشة': 'purchase', 'حامل': 'reserve' }); r = await req(id); await shot('06-store-partial');
  ok('ق.ح-06-b', monitorLine.includes('المتاح: 0') && reserveDisabled && r.steps.find((s) => s.role === 'store').outcome === 'partial' && r.need.lines[0].status === 'purchasing' && r.need.lines[1].status === 'reserved' && cur(r)?.role === 'handover', `monitors «المتاح: 0» (reserve disabled) → to purchase; stand reserved → «partial»; first the stock handover`);
  await handoverStart('P-STORE2', id); await signOnPhone('P-DEPT', id); r = await req(id);
  ok('ق.ح-06-c', r.status === 'in_review' && r.need.lines[1].status === 'delivered' && r.need.lines[0].status === 'purchasing' && cur(r)?.role === 'procurement' && (await getState()).custody.filter((c) => c.requestId === id).length === 1, `the stand was handed over (custody 1) while the request stays open for the monitors — now with procurement`);
  await prepare('P-MAJED', id, { est: 2700, why: 'شاشات', evaluator: 'entity', evalWhy: 'شاشات تقنية' }); await approve('P-GM', id); await budget('P-BUDG', id, 'FM-2026-0421'); await quotes('P-MAJED', id, [{ supplier: 'شركة الشاشات', amount: 2600, new: true }, { supplier: 'موزّع التقنية', amount: 2750, new: true }, { supplier: 'مؤسسة العرض', amount: 2690, new: true }]); await evaluate('P-ITS', id, 'شركة الشاشات', 'مطابق'); r = await req(id); const pr = r.need.procurement.prNo;
  await po('P-MAJED', id, '4500012905', in14); await receipt('P-STORE2', id, '5000012346'); await handoverStart('P-STORE2', id); await signOnPhone('P-DEPT', id); r = await req(id); const cc = (await getState()).custody.filter((c) => c.requestId === id);
  ok('ق.ح-06-d', /^1000\d{4}$/.test(pr) && r.status === 'completed' && r.need.lines.every((l) => l.status === 'delivered') && r.docs.filter((d) => d.kind === 'issued').length === 2 && cc.length === 2, `after the purchase branch (PR ${pr}), receipt and a second handover both lines are delivered → completed; two handover notes, custody entries ${cc.length}`);
  await asPerson('P-DEPT', `#/requests/${id}`); await shot('06-request-two-notes');
}

/* ═══ ق.ح-07 السلسلة إلى رأس القطاع — المحاكاة في مركز سياسة الاحتياج ═══ */
{
  await asAdmin('#/admin/need'); await p.locator('.segmented button', { hasText: 'المحاكاة' }).click(); await p.waitForTimeout(600);
  await p.selectOption('.ed-row select.select-in >> nth=0', 'P-DEPT'); await p.waitForTimeout(500); const simDept = await p.locator('.route-preview').textContent();
  await p.selectOption('.ed-row select.select-in >> nth=0', 'P-MONA'); await p.waitForTimeout(500); const gateMona = await p.locator('.notice.warn').textContent().catch(() => '');
  await p.selectOption('.ed-row select.select-in >> nth=0', 'P-ITM'); await p.waitForTimeout(500); const simIt = await p.locator('.route-preview').textContent(); await shot('07-simulator');
  ok('ق.ح-07', simDept.includes('اعتماد المدير العام') && simDept.includes('عبدالله بن محمد العتيبي') && simDept.includes('اعتماد رأس القطاع') && simDept.includes('سعود') && !simDept.includes('اعتماد مدير الإدارة') && simDept.includes('اعتماد الشراء') && simDept.includes('اعتماد الترسية') && gateMona.includes('مدير إدارة') && simIt.includes('عبدالعزيز بن خالد المطيري') && !simIt.includes('اعتماد مدير الإدارة'), `simulator: Abdulrahman's chain = GM → sector head, never himself, then the revised purchase branch; Mona gated; the IT director's own request goes to his specialist`);
}

/* ═══ ق.ح-08 مكتب بلا مستودع: كرسي لفهد في أبوظبي ═══ */
{
  const { id, skipped } = await createNeed('P-DEPT', { beneficiaryId: 'P-FAHAD', cat: 'مادة عامة', items: [{ name: 'كرسي مكتب' }], why: 'كرسي لمكتب فهد في أبوظبي', shotPrefix: '08-wizard' });
  let r = await req(id);
  ok('ق.ح-08-a', r.need.siteId === 'abudhabi' && !r.need.storeId && !r.steps.some((s) => s.role === 'store') && skipped.includes('لا مستودع في مكتب أبوظبي') && r.need.lines[0].status === 'purchasing', `${id}: Abu Dhabi has no store → store step not applicable; the line starts «purchasing»`);
  await chainApprove(id); await specify('P-GSM', id);
  await prepare('P-MAJED', id, { est: 950, why: 'أثاث', evaluator: 'entity', evalWhy: 'أثاث' }); await approve('P-GM', id); await budget('P-BUDG', id, 'FM-2026-0422'); await quotes('P-MAJED', id, [{ supplier: 'معرض أبوظبي', amount: 940 }, { supplier: 'شركة الأثاث', amount: 990, new: true }, { supplier: 'مؤسسة المكاتب', amount: 960, new: true }]); await evaluate('P-GSM', id, 'معرض أبوظبي', 'توريد إلى أبوظبي'); await po('P-MAJED', id, '4500012906', in14); r = await req(id);
  ok('ق.ح-08-b', cur(r)?.role === 'receipt' && cur(r).assigneeIds.join() === 'P-AUH', `receipt task with Rashed, the Abu Dhabi receipt & handover officer`);
  await receipt('P-AUH', id, '5000012347'); await handoverStart('P-AUH', id); r = await req(id);
  ok('ق.ح-08-c', cur(r)?.role === 'handoverSign' && cur(r).assigneeIds.join() === 'P-FAHAD' && r.need.handover.startedBy === 'P-AUH', `Rashed received and started the handover → Fahad signs`);
  await signOnPhone('P-FAHAD', id, '08-fahad-sign'); r = await req(id); const c = (await getState()).custody.filter((x) => x.requestId === id);
  ok('ق.ح-08-d', r.status === 'completed' && c.length === 1 && c[0].personId === 'P-FAHAD' && r.need.handover.issuerPositionId === 'S-190', `Fahad signed → completed; custody for Fahad; issuer position S-190`);
}

/* ═══ ق.ح-09 (أ، ب) الإعادة من لوحة الجهة الفنية والسحب ═══ */
{
  const { id } = await createNeed('P-DEPT', { cat: 'مادة تقنية', items: [{ name: 'جهاز عرض لقاعة' }], why: 'جهاز عرض لقاعة الاجتماعات' });
  await chainApprove(id);
  await returnFromEntity('P-ITM', id, 'حدد الدقة المطلوبة ونوع المدخلات'); let r = await req(id);
  await asPerson('P-DEPT', `#/requests/${id}`); const pg = await p.locator('.page').textContent(); await shot('09a-returned');
  ok('ق.ح-09-a', r.status === 'returned' && pg.includes('حدد الدقة المطلوبة') && pg.includes('استكمال وإعادة الإرسال'), `IT returned the request from the identification panel with a note → «returned» with the note and the resubmit button`);
  const w = await createNeed('P-DEPT', { cat: 'مادة عامة', items: [{ name: 'مكتب' }], why: 'مكتب إضافي' });
  await approve('P-SARA', w.id); await asPerson('P-DEPT', `#/requests/${w.id}`); const wb = p.locator('.btn', { hasText: 'سحب الطلب' }); const canW = await wb.count(); await wb.click(); await p.waitForTimeout(700); r = await req(w.id);
  await asPerson('P-DEPT', `#/requests/${globalThis.R02}`); const noW = await p.locator('.btn', { hasText: 'سحب الطلب' }).count();
  ok('ق.ح-09-b', canW === 1 && r.status === 'withdrawn' && noW === 0, `before procurement the requester can withdraw (${w.id} → withdrawn); a purchased need has no withdraw button`);
}

/* ═══ ق.ح-10 الطالب في الصورة: تنبيهات كل مرحلة، وتغيير الموعد المتوقع من المكتب ═══ */
{
  const id = globalThis.R02; const ns = await notifs('P-DEPT', id); const titles = ns.map((n) => n.title.ar + ' ' + n.body.ar);
  const stages = ['تحوّل إلى الشراء', 'تسلّم مكتب المشتريات', 'حُجز اعتماد', 'طُلبت العروض', 'قُيِّمت العروض', 'أُنشئ طلب الشراء', '4500012901', 'وصلت المواد', 'سند التسليم'];
  const hit = stages.filter((k) => titles.some((t) => t.includes(k)));
  const { id: id2 } = await createNeed('P-DEPT', { cat: 'مادة عامة', items: [{ name: 'مكتب' }], why: 'مكتب للموظف الجديد' });
  await chainApprove(id2); await specify('P-GSM', id2); await storeDecide('P-STORE1', id2, { 'مكتب': 'purchase' });
  await prepare('P-MAJED', id2, { est: 2200, why: 'أثاث', evaluator: 'entity', evalWhy: 'أثاث' }); await approve('P-GM', id2); await budget('P-BUDG', id2, 'FM-2026-0423'); await quotes('P-MAJED', id2, [{ supplier: 'معرض المكاتب', amount: 2150, new: true }, { supplier: 'شركة الأثاث', amount: 2300, new: true }, { supplier: 'مؤسسة التجهيز', amount: 2250, new: true }]); await evaluate('P-GSM', id2, 'معرض المكاتب', 'مطابق'); await po('P-MAJED', id2, '4500012907', in14);
  const later = toISO(Date.now() + 28 * 86400000);
  await asPerson('P-MAJED', '#/desk/procurement'); await p.locator('.segmented button', { hasText: 'في الشراء' }).click(); await p.waitForTimeout(400); await p.locator('.desk-row', { hasText: id2 }).first().click(); await p.waitForTimeout(600);
  await p.fill('#dk-exp', later); await p.fill('#dk-why', 'تأخر الشحن من المورد أسبوعين'); await shot('10-desk-expected'); await p.locator('.split-detail .btn.soft', { hasText: 'حفظ' }).click(); await p.waitForTimeout(700);
  const r2 = await req(id2); const n2 = await notifs('P-DEPT', id2);
  await asPerson('P-DEPT', `#/requests/${id2}`); const pg = await p.locator('.need-stages').textContent(); await shot('10-request-expected');
  ok('ق.ح-10', hit.length === stages.length && r2.need.procurement.expectedAt === later && r2.need.procurement.expectedLog.length === 2 && n2.some((n) => n.title.ar.includes('تغيّر موعد توريد')) && pg.includes(later) && pg.includes('1 تغيير'), `the requester was notified at every stage of ${id} (${hit.length}/${stages.length}: ${hit.join(' / ')}); Majed changed the expected date of ${id2} → requester told and the request shows the new date`);
  globalThis.R10 = id2;
}

/* ═══ ق.ح-11 دمج احتياجين (كراسي) في ملف شراء واحد → طلب شراء مشترك ═══ */
{
  const a = await createNeed('P-DEPT', { beneficiaryId: 'P-AHMED', cat: 'مادة عامة', items: [{ name: 'كرسي مكتب' }], why: 'كرسي لأحمد' });
  const s2 = await createNeed('P-DEPT', { beneficiaryId: 'P-SARA', cat: 'مادة عامة', items: [{ name: 'كرسي مكتب' }], why: 'كرسي لسارة' });
  for (const id of [a.id, s2.id]) { await chainApprove(id); await specify('P-GSM', id); await storeDecide('P-STORE1', id, { 'كرسي': 'purchase' }); }
  await prepare('P-MAJED', a.id, { est: 950, why: 'أثاث', evaluator: 'entity', evalWhy: 'أثاث' }); const ra0 = await req(a.id); const fileA = ra0.need.procurement.purchaseFile;
  await openTask('P-MAJED', s2.id); const mergeOpts = await p.locator('#np-merge option').allTextContents(); await shot('11-merge-select');
  await prepare('P-MAJED', s2.id, { est: 950, why: 'دُمج مع احتياج أحمد — كراسي متطابقة', file: fileA, evaluator: 'entity', evalWhy: 'أثاث' });
  for (const id of [a.id, s2.id]) { await approve('P-GM', id); await budget('P-BUDG', id, id === a.id ? 'FM-2026-0424' : 'FM-2026-0425'); await quotes('P-MAJED', id, [{ supplier: 'شركة المكاتب الحديثة', amount: 900 }, { supplier: 'معرض الأثاث', amount: 960, new: true }, { supplier: 'مؤسسة التجهيز', amount: 990, new: true }]); await evaluate('P-GSM', id, 'شركة المكاتب الحديثة', 'مطابق'); }
  const ra = await req(a.id); const rs = await req(s2.id);
  await asPerson('P-DEPT', `#/requests/${s2.id}`); const pg = await p.locator('.page').textContent(); await shot('11-merged-request');
  ok('ق.ح-11', mergeOpts.some((o) => o.includes(fileA) && o.includes(a.id)) && rs.need.procurement.purchaseFile === fileA && ra.need.procurement.prNo && ra.need.procurement.prNo === rs.need.procurement.prNo && ra.id !== rs.id && pg.includes('مدمج مع') && pg.includes(a.id), `Majed merged Sara's chair into Ahmed's purchase file ${fileA}; after both awards the system created ONE requisition ${ra.need.procurement.prNo} shared by the two needs, each keeping its own number and status; the request page shows «مدمج مع ${a.id}»`);
}

/* ═══ ق.ح-12 + ق.ح-19 مركز سياسة الاحتياج: إضافة وإلغاء بتاريخ (جهة، مستودع، فئة، مقر، بند كتالوج، شريحة صلاحيات، قواعد) في إصدار مؤرخ ═══ */
{
  await asAdmin('#/admin/need'); await shot('12-policy-home');
  await p.locator('.ptl-card.new').click(); await p.waitForTimeout(800); const drafted = await p.locator('.ptl-card.draft').count();
  await p.locator('.segmented button', { hasText: 'الجهات الفنية' }).click(); await p.waitForTimeout(400); await p.locator('.npc-add').click(); await p.waitForTimeout(600);
  await p.fill('.sheet .ed-row input >> nth=0', 'الأثاث والتجهيزات'); await p.fill('.sheet .ed-row input >> nth=1', 'Furniture & Fit-out'); await p.selectOption('.sheet select.select-in', 'S-1501'); await p.waitForTimeout(200); await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  await p.locator('.segmented button', { hasText: 'المستودعات' }).click(); await p.waitForTimeout(400); await p.selectOption('.npc-add select', '1030'); await p.waitForTimeout(600); await p.selectOption('.sheet select.select-in', 'S-1302'); await p.waitForTimeout(200); await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  await p.locator('.segmented button', { hasText: 'الفئات' }).click(); await p.waitForTimeout(400); await p.locator('.npc-add').click(); await p.waitForTimeout(600);
  await p.fill('.sheet .ed-row input >> nth=0', 'أثاث'); await p.fill('.sheet .ed-row input >> nth=1', 'Furniture');
  const selects = p.locator('.sheet select.select-in'); await selects.nth(0).selectOption({ label: 'الأثاث والتجهيزات' }); await selects.nth(1).selectOption(''); await p.locator('.sheet input.switch').check(); await p.fill('.sheet textarea >> nth=0', 'أثاث المكاتب: تعتمده جهة الأثاث ويُصرف من مستودع المطبوعات والهدايا.');
  await shot('12-category-sheet', false); await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  await p.locator('.segmented button', { hasText: 'المقرات' }).click(); await p.waitForTimeout(400); await p.locator('.npc-add').click(); await p.waitForTimeout(600);
  await p.fill('.sheet .ed-row input >> nth=0', 'مكتب مسقط'); await p.fill('.sheet .ed-row input >> nth=1', 'Muscat office'); await p.selectOption('.sheet select.select-in', 'S-2112'); await p.waitForTimeout(200); await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  /* v0.10: بند كتالوج جديد بفئته ورقم صنفه وسعره */
  await p.locator('.segmented button', { hasText: 'الكتالوج' }).click(); await p.waitForTimeout(400); await p.locator('.npc-add').click(); await p.waitForTimeout(600);
  await p.fill('.sheet .ed-row input >> nth=0', 'كرسي اجتماعات'); await p.fill('.sheet .ed-row input >> nth=1', 'Meeting chair'); await p.locator('.sheet select.select-in').nth(0).selectOption('generalMaterial'); await p.waitForTimeout(200); await p.locator('.sheet select.select-in').nth(1).selectOption('M-200301'); await p.waitForTimeout(200); await p.fill('.sheet input[type="number"]', '780'); await shot('12-catalog-sheet', false); await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  /* v0.10: شريحة صلاحيات جديدة حتى 100 ألف بمنصب المدير العام */
  await p.locator('.segmented button', { hasText: 'الصلاحيات' }).click(); await p.waitForTimeout(400); await shot('12-authority-tab'); await p.locator('.npc-add').click(); await p.waitForTimeout(600);
  await p.fill('.sheet .ed-row input >> nth=0', 'حتى 100 ألف ريال: المدير العام'); await p.fill('.sheet .ed-row input >> nth=1', 'Up to SAR 100K: DG'); await p.fill('.sheet input[type="number"]', '100000'); await p.selectOption('.sheet select.select-in', 'S-100'); await p.waitForTimeout(200); await shot('12-band-sheet', false); await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  /* طريقة شراء: العدد الأدنى لعروض الأسعار 2 */
  await p.locator('.segmented button', { hasText: 'طرق الشراء' }).click(); await p.waitForTimeout(400); await p.locator('.pt-card', { hasText: 'عروض أسعار' }).click(); await p.waitForTimeout(600); await p.fill('.sheet input[type="number"]', '2'); await p.waitForTimeout(200); await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  /* إلغاء فئة بتاريخ */
  await p.locator('.segmented button', { hasText: 'الفئات' }).click(); await p.waitForTimeout(400); await p.locator('.pt-card', { hasText: 'مواد المراسم' }).click(); await p.waitForTimeout(600); await p.fill('.sheet input[type="date"]', tomorrow); await p.waitForTimeout(200); await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  /* القواعد: رؤساء الأقسام يفتحون، العدد الأدنى للعروض 2، التسامح 15% */
  await p.locator('.segmented button', { hasText: 'القواعد' }).click(); await p.waitForTimeout(400); await p.selectOption('.npc-rules select >> nth=0', 'section'); await p.fill('#np-minoffers', '2'); await p.fill('#np-tolerance', '15'); await p.waitForTimeout(300);
  const pendingTxt = await p.locator('.savebar .sb-n').textContent(); await p.fill('.savebar .sb-why', 'إضافة جهة الأثاث وفئتها ومستودع 1030 ومكتب مسقط وبند كتالوج وشريحة صلاحيات، وإلغاء مواد المراسم، وفتح الاحتياج لرؤساء الأقسام، وعروض أقل وتسامح أوسع'); await shot('12-savebar'); await p.locator('.savebar .btn.primary').click(); await p.waitForTimeout(800);
  await p.locator('.segmented button', { hasText: 'ماذا يتغير' }).click(); await p.waitForTimeout(500); const diffTxt = await p.locator('.page').textContent(); await shot('12-diff');
  await p.locator('.btn.soft', { hasText: 'جدولة السريان' }).click(); await p.waitForTimeout(700); await p.fill('#nsc-from', today); await p.fill('#nsc-reason', 'تحديث سياسة الاحتياج بعد تجربة v0.10'); await p.fill('#nsc-ref', 'تعميم 2026/41');
  const blocked = await p.locator('.sheet .notice.danger').textContent().catch(() => ''); const disabled = await p.locator('.sheet .btn.primary').isDisabled(); await shot('12-schedule-blocked', false); await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  await p.locator('.segmented button', { hasText: 'الفئات' }).click(); await p.waitForTimeout(400); await p.locator('.pt-card', { hasText: 'أثاث' }).first().click(); await p.waitForTimeout(600); await p.locator('.sheet select.select-in').nth(1).selectOption('1030'); await p.waitForTimeout(200); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await p.fill('.savebar .sb-why', 'ربط فئة الأثاث بمستودع 1030'); await p.locator('.savebar .btn.primary').click(); await p.waitForTimeout(700);
  await p.locator('.btn.soft', { hasText: 'جدولة السريان' }).click(); await p.waitForTimeout(700); await p.fill('#nsc-from', today); await p.fill('#nsc-reason', 'تحديث سياسة الاحتياج بعد تجربة v0.10'); await p.fill('#nsc-ref', 'تعميم 2026/41'); const enabled = !(await p.locator('.sheet .btn.primary').isDisabled()); await shot('12-schedule-ok', false); await p.locator('.sheet .btn.primary').click(); await p.waitForTimeout(900);
  const st = await getState(); const v2 = st.needPolicy.versions.find((v) => v.id === 'V-2'); const need2 = v2?.content.need; const old = st.requests.find((r) => r.id === globalThis.R01);
  await asAdmin('#/admin/need'); await shot('12-policy-after');
  await asPerson('P-MONA', '#/new/AS-01', ph); const monaOpens = await p.locator('.type-row').count(); await p.locator('.type-row', { hasText: 'مادة عامة' }).click(); await p.waitForTimeout(500); const cats = await p.locator('.page').textContent(); await shot('12-mona-opens-phone');
  ok('ق.ح-12', drafted === 1 && pendingTxt.length > 0 && diffTxt.includes('الأثاث والتجهيزات') && blocked.includes('فئة مادة بلا مستودع: أثاث') && disabled && enabled && v2 && v2.scheduled && v2.from === today && need2.entities.some((e) => e.name.ar === 'الأثاث والتجهيزات' && e.agent.positionIds.includes('S-1501')) && need2.categories.some((c) => c.name.ar === 'أثاث' && c.storeId === '1030' && c.custody) && need2.stores.some((s) => s.id === '1030') && need2.sites.some((s) => s.name.ar === 'مكتب مسقط') && need2.categories.find((c) => c.id === 'protocolMaterial').endedAt === tomorrow && need2.rules.openerMinLevel === 'section' && old.policyVersion === '2026.1' && monaOpens >= 6, `draft 2026.2: entity + category «أثاث» (store 1030, custody) + store 1030 + site «مكتب مسقط» + «مواد المراسم» end-dated ${tomorrow} + section heads may open — ${v2?.changes.length} logged changes; scheduling blocked while «أثاث» had no store, then scheduled from ${today}; old requests keep 2026.1; Mona (section head) can now open a need`);
  ok('ق.ح-19', need2.catalog.some((k) => k.name.ar === 'كرسي اجتماعات' && k.categoryId === 'generalMaterial' && k.itemIds.includes('M-200301') && k.price === 780) && need2.authority.some((b) => b.name.ar.includes('حتى 100 ألف') && b.upTo === 100000 && b.agent.positionIds.includes('S-100')) && need2.methods.find((m) => m.id === 'quotes').minOffers === 2 && need2.rules.minOffers === 2 && need2.rules.tolerancePct === 15 && cats.includes('كرسي اجتماعات') && cats.includes('780'), `the same version adds a catalogue entry «كرسي اجتماعات» (M-200301, 780) that Mona now sees in the wizard, a delegation band «حتى 100 ألف: المدير العام», the quotations method at 2 offers, and rules min offers 2 / tolerance 15%`);
}

/* ═══ ق.ح-13 التسليم على الهاتف + الطباعة ═══ */
{
  const r = await req(globalThis.R01);
  await asPerson('P-AHMED', `#/requests/${globalThis.R01}`, ph); await p.locator('.seal .seal-act').first().click(); await p.waitForTimeout(1000); const printBtn = await p.locator('.sheet .btn', { hasText: /طباعة|PDF|Print/ }).count(); const doc = await p.locator('.sheet').textContent(); await shot('13-handover-note-phone', false);
  ok('ق.ح-13', r.need.handover.startedBy === 'P-STORE2' && r.need.handover.signedBy === 'P-AHMED' && printBtn >= 1 && doc.includes('سند تسليم واستلام') && doc.includes(r.need.lines[0].assetNo), `Hassan started from his desk, Ahmed signed on his phone; the note carries the asset number and a print button`);
  await p.keyboard.press('Escape');
}

/* ═══ ق.ح-15 + ق.ح-16 وصف حر تحدده تقنية المعلومات برقم صنف، ثم شراء من عقد إطاري يتخطى العروض والترسية ═══ */
{
  const { id, what } = await createNeed('P-DEPT', { cat: 'مادة تقنية', free: [{ name: 'جهاز لعرض الشرائح في قاعة الاجتماعات الكبرى' }], why: 'قاعة الاجتماعات بلا جهاز عرض', shotPrefix: '15-free-text' });
  let r = await req(id);
  ok('ق.ح-15-a', what.includes('اختر من الكتالوج بأسماء مألوفة أو صف ما تحتاجه بكلماتك') && !r.need.lines[0].itemId && r.need.lines[0].asked?.ar.includes('جهاز لعرض الشرائح') && !r.need.estimatedValue, `${id}: free text «جهاز لعرض الشرائح…» with no item number and no value yet`);
  await chainApprove(id); await openTask('P-ITS', id); const before = await detailText(); await shot('15-it-maps-free-text');
  await specify('P-ITS', id, { 'جهاز': { itemId: 'M-100206' } }, 'جهاز العرض المعتمد للقاعات'); r = await req(id); const L = r.need.lines[0];
  ok('ق.ح-15-b', before.includes('وصف حر') && L.itemId === 'M-100206' && L.name.ar === 'جهاز عرض' && L.asked.ar.includes('جهاز لعرض الشرائح') && L.unitPrice === 3900 && r.need.estimatedValue === 3900 && cur(r)?.role === 'store', `IT mapped the requester's words to M-100206 «جهاز عرض» (price 3,900 from the master) — the words are kept beside the item; estimate 3,900`);
  await asPerson('P-DEPT', `#/requests/${id}`); const pg = await p.locator('.page').textContent(); await shot('15-request-asked');
  await storeDecide('P-STORE2', id, { 'جهاز': 'purchase' });
  await openTask('P-MAJED', id); await p.locator('.split-detail .chips .pill', { hasText: 'عقد إطاري قائم' }).click(); await p.waitForTimeout(200); const cOpts = await p.locator('#np-contract option').allTextContents(); await shot('16-contract-select');
  await prepare('P-MAJED', id, { est: 3900, method: 'عقد إطاري قائم', why: 'أجهزة العرض ضمن العقد الإطاري للأجهزة السمعية والبصرية', contract: '4600001234' }); r = await req(id); const pr0 = r.need.procurement; const c0 = (await getState()).erp.contracts.find((c) => c.id === '4600001234');
  ok('ق.ح-16-a', pg.includes('ما طلبه الطالب') && cOpts.some((o) => o.includes('4600001234') && o.includes('المتبقي 189,000')) && !cOpts.some((o) => o.includes('4600001180')) && pr0.method === 'contract' && pr0.methodFlags.contract && !pr0.methodFlags.offers && pr0.contractNo === '4600001234' && !pr0.evaluator && cur(r)?.role === 'purchaseApproval', `the request shows «ما طلبه الطالب»; the store had none → Majed chose «عقد إطاري قائم» and picked 4600001234 from the ERP contract list (remaining 189,000 shown; the expired 4600001180 not offered) → purchase approval (contract consumed so far ${c0.consumed.toLocaleString('en')})`);
  await approve('P-GM', id); await openTask('P-BUDG', id); const bTxt = await detailText(); await budget('P-BUDG', id, 'FM-2026-0426'); r = await req(id); const pr = r.need.procurement;
  const c1 = (await getState()).erp.contracts.find((c) => c.id === '4600001234');
  ok('ق.ح-16-b', bTxt.includes('4600001234') && ['tender', 'quotes', 'evaluator', 'budgetTopUp', 'awardApproval'].every((role) => r.steps.find((s) => s.role === role).status === 'skipped') && audit(r, 'لا تحتاج عروضاً') && audit(r, 'عقد إطاري قائم؛ لا ترسية') && /^1000\d{4}$/.test(pr.prNo) && pr.award?.supplier.includes('شركة الأجهزة السمعية والبصرية') && pr.award.supplierId === 'BP-1000502' && /^4500\d{6}$/.test(pr.releaseOrderNo) && audit(r, `أمر تنفيذ ${pr.releaseOrderNo} على العقد 4600001234`) && c1.consumed === 64900 && cur(r)?.role === 'po' && (await notifs('P-DEPT', id)).some((n) => n.title.ar.includes(`أُنشئ طلب الشراء ${pr.prNo}`)), `after the reservation the tender, offers, evaluation, top-up and award steps were all skipped with reasons; the system created PR ${pr.prNo} with the contract's supplier (BP-1000502) and release order ${pr.releaseOrderNo} against 4600001234, whose consumption rose 61,000 → ${c1.consumed.toLocaleString('en')} → purchase order`);
  await asPerson('P-DEPT', `#/requests/${id}`); await shot('16-contract-request');
}

/* ═══ ق.ح-17 نسبة التسامح: العرض الفائز فوق المحجوز بأكثر من 10% يعود إلى الموازنة لزيادة الحجز ═══ */
{
  const { id } = await createNeed('P-DEPT', { beneficiaryId: 'P-SARA', cat: 'مادة عامة', items: [{ name: 'مكتب' }], why: 'مكتب لسارة' });
  await chainApprove(id); await specify('P-GSM', id); await storeDecide('P-STORE1', id, { 'مكتب': 'purchase' });
  await prepare('P-MAJED', id, { est: 2000, why: 'أثاث', evaluator: 'entity', evalWhy: 'أثاث' }); await approve('P-GM', id); await budget('P-BUDG', id, 'FM-2026-0427', 2000);
  await quotes('P-MAJED', id, [{ supplier: 'معرض المكاتب', amount: 2400, new: true }, { supplier: 'شركة الأثاث', amount: 2500, new: true }, { supplier: 'مؤسسة التجهيز', amount: 2450, new: true }]); await evaluate('P-GSM', id, 'معرض المكاتب', 'الأقل سعراً'); let r = await req(id);
  ok('ق.ح-17-a', r.need.procurement.reservation.amount === 2000 && r.need.procurement.recommendation.amount === 2400 && cur(r)?.role === 'budgetTopUp' && cur(r).assigneeIds[0] === 'P-BUDG' && (await notifs('P-DEPT', id)).some((n) => n.body.ar.includes('لزيادة الحجز')), `reserved 2,000, recommended 2,400 (> 2,000 × 1.10) → back to budget for a top-up (Lamia); requester told`);
  await openTask('P-BUDG', id); const tTxt = await detailText(); const amt = await p.locator('#np-amount').inputValue(); await shot('17-topup-panel'); await budget('P-BUDG', id); r = await req(id);
  ok('ق.ح-17-b', tTxt.includes('زيادة حجز الاعتماد') && amt === '2400' && r.need.procurement.reservation.amount === 2400 && r.need.procurement.reservation.topUps.length === 1 && r.need.procurement.reservation.topUps[0].from === 2000 && cur(r)?.role === 'awardApproval' && r.need.procurement.awardWhy?.some((w) => w.ar.includes('تجاوزت التقدير المعتمد')) && (await notifs('P-DEPT', id)).some((n) => n.title.ar.includes('زادت الموازنة حجز الاعتماد')), `Lamia raised the reservation to the prefilled 2,400 (top-up logged 2,000 → 2,400) → award approval still opens because the award exceeds the APPROVED estimate by more than the tolerance (a deviation under D-024)`);
  await approve('P-GM', id); r = await req(id);
  ok('ق.ح-17-c', /^1000\d{4}$/.test(r.need.procurement.prNo) && r.need.procurement.award.amount === 2400 && cur(r)?.role === 'po', `award approved → PR ${r.need.procurement.prNo} at 2,400 → purchase order`);
}

/* ═══ ق.ح-18 الإلغاء بعد حجز الاعتماد وقبل طلب الشراء يحرّر الحجز ═══ */
{
  const { id } = await createNeed('P-DEPT', { beneficiaryId: 'P-AHMED', cat: 'مادة تقنية', items: [{ name: 'سماعة رأس للاجتماعات' }], why: 'سماعة للاجتماعات المرئية' });
  await chainApprove(id); await specify('P-ITS', id); await storeDecide('P-STORE2', id, { 'سماعة': 'purchase' });
  await prepare('P-MAJED', id, { est: 320, why: 'الطراز المطلوب غير متوفر', evaluator: 'entity', evalWhy: 'تقني' }); await approve('P-GM', id); await budget('P-BUDG', id, 'FM-2026-0428'); let r = await req(id);
  await asPerson('P-DEPT', `#/requests/${id}`); const canBtn = p.locator('.btn', { hasText: 'طلب إلغاء الاحتياج' }); const has = await canBtn.count(); await canBtn.click(); await p.waitForTimeout(600); await p.fill('#nc-reason', 'استُغني عنها'); await p.locator('.sheet .btn.primary', { hasText: 'إرسال طلب الإلغاء' }).click(); await p.waitForTimeout(700);
  await asPerson('P-MAJED', '#/desk/procurement'); await p.locator('.desk-row', { hasText: id }).first().click(); await p.waitForTimeout(600); const notice = await p.locator('.split-detail .notice.warn').textContent().catch(() => ''); await p.fill('#dk-cnote', 'لم يُنشأ طلب شراء بعد'); await p.locator('.split-detail .btn.danger', { hasText: 'قبول الإلغاء' }).click(); await p.waitForTimeout(800); r = await req(id);
  ok('ق.ح-18', has === 1 && cur((await getState()).requests.find((x) => x.id === id)) === undefined && r.status === 'withdrawn' && r.need.procurement.reservation.released && !r.need.procurement.prNo && audit(r, 'حُرِّر حجز الاعتماد FM-2026-0428') && notice.includes('لم يصدر أمر شراء بعد'), `cancelled after the reservation and before the PR: Majed accepted → withdrawn, reservation FM-2026-0428 released, no PR ever created`);
}

/* ═══ ق.ح-20 التوفر لدى الجهة الفنية (D-023): مقعد Microsoft 365 من الكتالوج — تقنية المعلومات توفّره من رصيدها بلا شراء ولا موازنة، ويوقّع المستفيد، وتُقيَّد عهدة رقمية ═══ */
{
  const stock0 = (await getState()).erp.poolStock.find((x) => x.poolId === 'POOL-M365').qty;
  const { id, route } = await createNeed('P-DEPT', { beneficiaryId: 'P-AHMED', cat: 'خدمة تقنية', items: [{ name: 'مقعد Microsoft 365' }], why: 'بريد ومكتب لأحمد بعد نقله إلى القسم', vp: ph, shotPrefix: '20-wizard' });
  let r = await req(id);
  ok('ق.ح-20-a', r.need.availability === 'entity' && r.need.lines[0].poolId === 'POOL-M365' && route.includes('إن وفّرته الجهة الفنية من رصيدها') && route.includes('التوفير من رصيد الجهة') && r.steps.some((s) => s.role === 'handover' && s.branch === 'provided') && !route.includes('4,800'), `${id}: catalogue entry «مقعد Microsoft 365» maps behind the screen to IT's pool; the route preview shows the new segment «إن وفّرته الجهة الفنية من رصيدها» before the purchase branch`);
  await chainApprove(id); await openTask('P-ITS', id); const modes = await p.locator('.split-detail .np-mode').textContent(); await shot('20-it-modes');
  await p.locator('.split-detail .np-mode .pill', { hasText: 'متوفر لدينا' }).click(); await p.waitForTimeout(300); const panel = await detailText(); await shot('20-it-provide-panel');
  await p.fill('input[id^="np-ref-"]', 'M365-E3-0148'); await p.fill('#np-pnote', 'مقعد من الاتفاقية المؤسسية'); await primary('توفير من رصيدنا وبدء التسليم').click(); await p.waitForTimeout(900); r = await req(id);
  const stock1 = (await getState()).erp.poolStock.find((x) => x.poolId === 'POOL-M365').qty; const entityStep = r.steps.find((s) => s.role === 'entity');
  ok('ق.ح-20-b', modes.includes('اعتماد وتحديد الصنف') && modes.includes('متوفر لدينا') && modes.includes('ليست من اختصاصنا') && panel.includes('مقاعد Microsoft 365 E3') && panel.includes(`المتبقي: ${stock0}`) && entityStep.outcome === 'provided' && r.need.provision?.pools[0].poolId === 'POOL-M365' && r.need.lines[0].status === 'provided' && r.need.lines[0].provisionRef === 'M365-E3-0148' && stock1 === stock0 - 1 && audit(r, 'وُفِّر من رصيدها') && ['procurement', 'purchaseApproval', 'budget', 'quotes', 'evaluator', 'awardApproval', 'pr', 'po', 'receipt'].every((role) => r.steps.find((s) => s.role === role).status === 'skipped') && audit(r, 'وُفِّر الاحتياج من رصيد الجهة الفنية؛ لا حاجة إلى هذه الخطوة') && r.steps.filter((s) => s.status === 'skipped').length >= 9 && cur(r)?.role === 'handoverSign' && cur(r).assigneeIds.join() === 'P-AHMED' && r.need.handover?.startedBy === 'P-ITS' && (await notifs('P-AHMED', id)).some((n) => n.title.ar.includes('متوفر لدى تقنية المعلومات')), `IT's task offers three outcomes; Abdulaziz chose «متوفر لدينا»: the pool panel showed «مقاعد Microsoft 365 E3 · المتبقي ${stock0}» → the seat was deducted (${stock0} → ${stock1}) with reference M365-E3-0148, every purchase/budget step was skipped with the reason «وُفِّر الاحتياج من رصيد الجهة», IT signed as issuer and Ahmed's «وقّع الاستلام» task opened; Ahmed told «متوفر لدى تقنية المعلومات»`);
  await signOnPhone('P-AHMED', id, '20-ahmed-sign'); r = await req(id); const c = (await getState()).custody.filter((x) => x.requestId === id);
  await asPerson('P-AHMED', '#/me/custody', ph); const cus = await p.locator('.page').textContent(); await shot('20-custody-digital', false);
  await asPerson('P-DEPT', `#/requests/${id}`); const pg = await p.locator('.page').textContent(); await shot('20-request-provided');
  ok('ق.ح-20-c', r.status === 'completed' && r.need.lines[0].status === 'delivered' && !r.need.lines[0].materialDocNo && c.length === 1 && c[0].digital && c[0].ref === 'M365-E3-0148' && !c[0].assetNo && r.docs.some((d) => d.kind === 'issued') && cus.includes('عهدة رقمية') && cus.includes('M365-E3-0148') && pg.includes('رصيد الجهة') && pg.includes('مقاعد Microsoft 365 E3') && audit(r, 'لا صرف من مستودع') && !r.need.procurement?.prNo, `Ahmed signed → completed with a handover note but NO material document, NO requisition and NO reservation; a digital custody entry (ref M365-E3-0148, no asset number) shows in «عهدتي»; the request page lists the pool and the reference under the references`);
  globalThis.R20 = id;
}

/* ═══ ق.ح-21 الرصيد لا يكفي → الجهة تعتمد وتحدد الصنف فيذهب إلى الشراء (المسار المعتاد)؛ ورصيد عقد إطاري (أمر تنفيذ) ═══ */
{
  const { id } = await createNeed('P-DEPT', { cat: 'خدمة تقنية', items: [{ name: 'رخصة Adobe Acrobat Pro', qty: 5 }], why: 'خمس رخص لفريق التقارير' });
  await chainApprove(id); await openTask('P-ITS', id); await p.locator('.split-detail .np-mode .pill', { hasText: 'متوفر لدينا' }).click(); await p.waitForTimeout(300);
  const short = await p.locator('.split-detail .np-provide').textContent(); const disabled = await primary('توفير من رصيدنا').isDisabled(); await shot('21-pool-short');
  await p.locator('.split-detail .np-mode .pill', { hasText: 'اعتماد وتحديد الصنف' }).click(); await p.waitForTimeout(300);
  await specify('P-ITS', id, { 'Acrobat': { text: 'رخص Adobe Acrobat Pro (سنة)', group: 'SW-LIC', price: 780 } }, 'الرصيد 3 فقط؛ تُشترى الخمس', 'spec.pdf'); let r = await req(id);
  ok('ق.ح-21-a', short.includes('المتبقي: 3') && short.includes('الرصيد لا يكفي') && disabled && cur(r)?.role === 'procurement' && r.docs.some((d) => d.stage?.ar.includes('المواصفات') && d.title.ar === 'spec.pdf') && r.need.estimatedValue === 3900, `pool has 3 Acrobat licences but 5 were asked: «الرصيد لا يكفي» and the provide button disabled → IT approved and identified instead (spec sheet attached) → procurement as usual at 3,900`);
  /* رصيد من عقد إطاري: صيانة أجهزة العرض — أمر تنفيذ آلي يستهلك العقد */
  const c0 = (await getState()).erp.contracts.find((c) => c.id === '4600001234').consumed;
  const m = await createNeed('P-DEPT', { cat: 'خدمة تقنية', free: [{ name: 'صيانة جهاز عرض قاعة الاجتماعات', qty: 1 }], why: 'الجهاز يتوقف بعد التشغيل' });
  await chainApprove(m.id); await openTask('P-ITM', m.id); await p.locator('.split-detail .np-mode .pill', { hasText: 'متوفر لدينا' }).click(); await p.waitForTimeout(300);
  await p.locator('.split-detail .np-provide select.select-in').selectOption('POOL-AVCARE'); await p.waitForTimeout(200); await shot('21-contract-pool'); await primary('توفير من رصيدنا وبدء التسليم').click(); await p.waitForTimeout(900); r = await req(m.id);
  const c1 = (await getState()).erp.contracts.find((c) => c.id === '4600001234').consumed; const prov = r.need.provision.pools[0];
  ok('ق.ح-21-b', prov.poolId === 'POOL-AVCARE' && prov.erpKind === 'contract' && /^4500\d{6}$/.test(prov.releaseOrderNo) && c1 === c0 + 1200 && audit(r, `أمر تنفيذ ${prov.releaseOrderNo} على العقد 4600001234`) && cur(r)?.role === 'handoverSign', `a pool backed by the framework contract: IT provided the maintenance visit → the system issued release order ${prov.releaseOrderNo} against contract 4600001234 (consumption ${c0.toLocaleString('en')} → ${c1.toLocaleString('en')}) → the requester signs`);
  await signOnPhone('P-DEPT', m.id); r = await req(m.id);
  ok('ق.ح-21-c', r.status === 'completed' && !(await getState()).custody.some((x) => x.requestId === m.id), `signed → completed; a maintenance visit is no custody`);
}

/* ═══ ق.ح-22 «ليست من اختصاصنا»: كاميرا طُلبت كمادة تقنية → تقنية المعلومات تحوّلها إلى الإعلامية بتغيير الفئة، والمهمة تنتقل والمستودع يُعاد استخراجه ═══ */
{
  const { id } = await createNeed('P-DEPT', { cat: 'مادة تقنية', free: [{ name: 'كاميرا فيديو لتغطية الفعاليات' }], why: 'تغطية فعاليات القطاع' });
  await chainApprove(id); await openTask('P-ITS', id); await p.locator('.split-detail .np-mode .pill', { hasText: 'ليست من اختصاصنا' }).click(); await p.waitForTimeout(300);
  const opts = await p.locator('#np-reroute option').allTextContents(); await p.selectOption('#np-reroute', 'mediaMaterial'); await p.fill('#np-reroutewhy', 'كاميرات التغطية من اختصاص الإدارة الإعلامية'); await shot('22-reroute-panel'); await primary('تحويل الاحتياج').click(); await p.waitForTimeout(800); let r = await req(id);
  ok('ق.ح-22-a', opts.some((o) => o.includes('مواد إعلامية') && o.includes('الإعلامية')) && !opts.some((o) => o.includes('خدمة')) && r.need.categoryId === 'mediaMaterial' && r.need.entityId === 'MEDIA' && r.need.storeId === '1010' && cur(r)?.role === 'entity' && cur(r).assigneeIds.join() === 'P-MEDM' && r.steps.find((s) => s.role === 'store').assigneeIds.join() === 'P-STORE1' && r.need.rerouted?.length === 1 && audit(r, 'حُوِّل الاحتياج من «مادة تقنية»') && (await notifs('P-MEDM', id)).some((n) => n.title.ar.includes('حُوِّل إليكم')) && (await notifs('P-DEPT', id)).some((n) => n.title.ar.includes('حُوِّل احتياجك إلى الإعلامية')), `only same-kind categories with an entity were offered; IT re-routed to «مواد إعلامية»: the same task moved to Dana (Media), the store step now points at the general store 1010, Dana and the requester were told`);
  await specify('P-MEDM', id, { 'كاميرا': { itemId: 'M-400501' } }, 'الطراز المعتمد للتغطية'); r = await req(id);
  ok('ق.ح-22-b', r.need.lines[0].itemId === 'M-400501' && cur(r)?.role === 'store' && cur(r).assigneeIds.join() === 'P-STORE1', `Dana identified M-400501 → general store`);
}

/* ═══ ق.ح-23 تعذر الحد الأدنى للعروض (D-025): عرض واحد من اثنين (الحد صار 2 في 2026.2) بمبرر → اعتماد الترسية يصعد إلى الشريحة الأعلى ═══ */
{
  const { id } = await createNeed('P-DEPT', { beneficiaryId: 'P-SARA', cat: 'مادة تقنية', items: [{ name: 'جهاز عرض لقاعة' }], why: 'قاعة التدريب' });
  await chainApprove(id); await specify('P-ITS', id); await storeDecide('P-STORE2', id, { 'جهاز': 'purchase' });
  await prepare('P-MAJED', id, { est: 3900, why: 'أجهزة عرض', evaluator: 'entity', evalWhy: 'تقني' }); await approve('P-GM', id); await budget('P-BUDG', id, 'FM-2026-0430');
  await openTask('P-MAJED', id); const attBtn = await p.locator('.split-detail .np-offer-row .np-offer-att').count();
  /* عرض بلا مستند → الزر معطّل «أرفق مستند كل عرض» */
  await p.locator('.split-detail .np-offer-row').nth(0).locator('select.np-offer-sup').selectOption('BP-1000502'); await p.locator('.split-detail .np-offer-row').nth(0).locator('input.np-offer-amt').fill('3800'); await p.waitForTimeout(200);
  const noAttLabel = await p.locator('.split-detail .btn.primary').textContent(); const noAttDisabled = await p.locator('.split-detail .btn.primary').isDisabled(); await shot('23-attachment-required');
  await quotes('P-MAJED', id, [{ supplier: 'شركة الأجهزة السمعية والبصرية', amount: 3800, currency: 'USD', fx: 1013 }], 'الجهاز يورّده وكيل معتمد واحد في السوق'); let r = await req(id);
  ok('ق.ح-23-a', attBtn >= 1 && noAttLabel.includes('أرفق مستند كل عرض') && noAttDisabled && r.need.procurement.offers.count === 1 && r.need.procurement.offers.shortfall?.min === 2 && r.need.procurement.offers.shortfall.why.includes('وكيل معتمد واحد') && r.need.procurement.offers.list[0].currency === 'USD' && r.need.procurement.offers.list[0].fxAmount === 1013 && r.need.procurement.offers.list[0].amount === 3800 && r.need.procurement.offers.list[0].supplierId === 'BP-1000502' && audit(r, 'بمبرر: الجهاز يورّده وكيل معتمد واحد') && cur(r)?.role === 'evaluator', `an offer without its document keeps the button disabled («أرفق مستند كل عرض»); Majed then recorded 1 of the 2 required offers with a written justification (in USD 1,013 ≈ SAR 3,800, supplier BP-1000502) → evaluation`);
  await openTask('P-ITS', id); const evTxt = await detailText(); await evaluate('P-ITS', id, 'شركة الأجهزة السمعية والبصرية', 'الأدنى ومطابق'); r = await req(id);
  ok('ق.ح-23-b', evTxt.includes('الأدنى') && cur(r)?.role === 'awardApproval' && r.need.procurement.band?.name.ar.includes('حتى 100 ألف') && r.need.procurement.awardBand?.id === 'B1' && cur(r).why.ar.includes('الشريحة الأعلى') && r.need.procurement.awardWhy?.some((w) => w.ar.includes('عروض أقل من الحد الأدنى (1 من 2)')), `even though IT recommended the (only) offer, the shortfall is a deviation: the purchase was approved in the «حتى 100 ألف» band, but award approval opened one band UP (B1, the procurement director — vacant, so the GM acts) with the reason «عروض أقل من الحد الأدنى (1 من 2)»`);
  await openTask('P-GM', id); const cmTxt = await p.locator('.split-detail .np-sum').textContent(); await shot('23-higher-band-award'); await primary('اعتماد').first().click(); await p.waitForTimeout(700); r = await req(id);
  ok('ق.ح-23-c', cmTxt.includes('عروض أقل من الحد الأدنى') && cmTxt.includes('وكيل معتمد واحد') && cmTxt.includes('1,013') && cmTxt.includes('USD') && /^1000\d{4}$/.test(r.need.procurement.prNo) && cur(r)?.role === 'po', `the higher-band approver saw the shortfall, its justification and the foreign-currency offer in the summary, approved → PR ${r.need.procurement.prNo} → purchase order`);
}

/* ═══ ق.ح-24 تنبيه التجزئة (ق-08): مكتبان لموظفين من القطاع نفسه خلال 30 يوماً يبلغ مجموعهما شريحة أعلى (بعد إضافة شريحة «حتى 100 ألف» في ق.ح-12) ═══ */
{
  const a = await createNeed('P-DEPT', { beneficiaryId: 'P-AHMED', cat: 'مادة عامة', free: [{ name: 'تجهيز غرفة اجتماعات القسم (طاولة ومقاعد)', qty: 1 }], why: 'غرفة اجتماعات القسم' });
  await chainApprove(a.id); await specify('P-GSM', a.id, { 'تجهيز': { text: 'تجهيز غرفة اجتماعات', group: 'FURN', price: 60000 } }); await storeDecide('P-STORE1', a.id, { 'تجهيز': 'purchase' });
  await prepare('P-MAJED', a.id, { est: 60000, why: 'أثاث', evaluator: 'entity', evalWhy: 'أثاث' }); let ra = await req(a.id);
  const b2 = await createNeed('P-DEPT', { beneficiaryId: 'P-SARA', cat: 'مادة عامة', free: [{ name: 'تجهيز غرفة اجتماعات الإدارة (طاولة ومقاعد)', qty: 1 }], why: 'غرفة اجتماعات الإدارة' });
  await chainApprove(b2.id); await specify('P-GSM', b2.id, { 'تجهيز': { text: 'تجهيز غرفة اجتماعات', group: 'FURN', price: 60000 } }); await storeDecide('P-STORE1', b2.id, { 'تجهيز': 'purchase' });
  await openTask('P-MAJED', b2.id); await p.fill('#np-est', '60000'); await p.waitForTimeout(300); const warn = await p.locator('.split-detail .notice.warn').textContent().catch(() => ''); await shot('24-split-alert');
  await prepare('P-MAJED', b2.id, { est: 60000, why: 'أثاث', evaluator: 'entity', evalWhy: 'أثاث' }); let rb = await req(b2.id);
  await openTask('P-GM', b2.id); const gmTxt = await p.locator('.split-detail .np-sum').textContent(); await shot('24-approver-sees-alert');
  const total = rb.need.procurement.splitAlert?.total || 0;
  ok('ق.ح-24', !ra.need.procurement.splitAlert && ra.need.procurement.band?.name.ar.includes('حتى 100 ألف') && warn.includes('تنبيه التجزئة') && warn.includes(a.id) && total >= 120000 && warn.includes(total.toLocaleString('en')) && rb.need.procurement.splitAlert?.ids.includes(a.id) && rb.need.procurement.splitAlert.band?.ar.includes('500') && audit(rb, 'تنبيه التجزئة (ق-08)') && gmTxt.includes('تنبيه التجزئة') && gmTxt.includes(a.id), `the first 60,000 need alone sits in the «حتى 100 ألف» band with no alert (the sector's earlier furniture needs add only ~8,000); when the second 60,000 need from the same sector and category arrived within 30 days, Majed's panel warned «تنبيه التجزئة» naming ${a.id} and the combined ${total.toLocaleString('en')} (the next band «حتى 500 ألف»), the alert was recorded in the audit and the purchase approver sees it in the summary`);
}

/* ═══ ق.ح-14 بوابة المستوى: الشاشات هاتفاً وحاسوباً، عربية وإنجليزية، فاتحة وداكنة، مع تقليل الحركة ═══ */
{
  const pages = [['new', '#/new/AS-01', 'P-DEPT'], ['req', `#/requests/${globalThis.R02}`, 'P-DEPT'], ['inbox', '#/inbox', 'P-MAJED'], ['proc', '#/desk/procurement', 'P-MAJED'], ['store', '#/desk/store', 'P-STORE1'], ['custody', '#/me/custody', 'P-AHMED'], ['policy', '#/admin/need', 'admin']];
  const bad = [];
  for (const [name, hash, who] of pages) {
    for (const [vpName, vp] of [['ph', ph], ['lap', lap]]) for (const lang of ['ar', 'en']) for (const dark of [false, true]) {
      const c2 = await b.newContext({ viewport: vp, deviceScaleFactor: 1, colorScheme: dark ? 'dark' : 'light', reducedMotion: dark ? 'reduce' : 'no-preference', hasTouch: vpName === 'ph', isMobile: vpName === 'ph' });
      const q = await c2.newPage(); q.on('pageerror', (e) => errs.push('ق.ح-14 ' + e.message)); q.on('console', (m) => { if (m.type() === 'error') errs.push('ق.ح-14 ' + m.text()); });
      await q.goto(file + '#/home', { waitUntil: 'load' }); await q.waitForTimeout(500);
      const st = await getState(); await q.evaluate((s) => localStorage.setItem('usp-portal-v1', JSON.stringify(s)), st);
      await q.evaluate(({ who, lang }) => { const s = JSON.parse(localStorage.getItem('usp-portal-v1')); if (who === 'admin') { s.settings.persona = 'admin'; s.settings.actAs = undefined; } else { const w = s.people.find((x) => x.id === who); s.settings.persona = w.persona; s.settings.actAs = who; } s.settings.lang = lang; localStorage.setItem('usp-portal-v1', JSON.stringify(s)); }, { who, lang });
      await q.goto(file + hash); await q.reload({ waitUntil: 'load' }); await q.waitForTimeout(1400);
      if (name === 'new') { await q.locator('.type-row').first().click().catch(() => {}); await q.waitForTimeout(500); }
      if (name === 'policy') { await q.locator('.segmented button').nth(4).click().catch(() => {}); await q.waitForTimeout(500); }
      const ov = await q.evaluate(() => { const w = document.documentElement.clientWidth; const list = []; document.querySelectorAll('body *').forEach((el) => { const r = el.getBoundingClientRect(); if (r.width > 0 && (r.right > w + 1 || r.left < -1)) list.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ').filter(Boolean).slice(0, 2).join('.')}`); }); return { over: document.documentElement.scrollWidth > w + 1, list: list.slice(0, 4) }; });
      const empty = (await q.locator('.page').textContent().catch(() => '')).trim().length < 40;
      if (ov.over || empty) bad.push(`${name}/${vpName}/${lang}/${dark ? 'dark' : 'light'}: ${ov.over ? 'overflow ' + ov.list.join(',') : 'empty'}`);
      if ((lang === 'en' && !dark) || (lang === 'ar' && dark)) await q.screenshot({ path: `shots/v11/v11-14-${name}-${vpName}-${lang}-${dark ? 'dark' : 'light'}.png`, fullPage: true });
      await c2.close();
    }
  }
  ok('ق.ح-14', bad.length === 0, `${pages.length} screens × phone/desktop × ar/en × light/dark(+reduced motion) = ${pages.length * 8} renders: no horizontal overflow, no empty page${bad.length ? ' — ' + bad.join('; ') : ''}`);
}

await ctx.close();
console.log(`\nerrors ${errs.length}`); errs.slice(0, 8).forEach((e) => console.log('  ' + e));
const pass = checks.filter((c) => c.pass).length; console.log(`\n${pass}/${checks.length} PASS`);
fs.writeFileSync('shots/v11/v11-results.json', JSON.stringify({ at: new Date().toISOString(), checks, errors: errs }, null, 2));
await b.close();
process.exit(pass === checks.length && errs.length === 0 ? 0 : 1);
