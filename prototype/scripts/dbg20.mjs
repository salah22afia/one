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
  ok('ق.ح-20-b', modes.includes('اعتماد وتحديد الصنف') && modes.includes('متوفر لدينا') && modes.includes('ليست من اختصاصنا') && panel.includes('مقاعد Microsoft 365 E3') && panel.includes(`المتبقي: ${stock0}`) && entityStep.outcome === 'provided' && r.need.provision?.pools[0].poolId === 'POOL-M365' && r.need.lines[0].status === 'provided' && r.need.lines[0].provisionRef === 'M365-E3-0148' && stock1 === stock0 - 1 && audit(r, 'وُفِّر من رصيدها') && ['procurement', 'purchaseApproval', 'budget', 'quotes', 'evaluator', 'awardApproval', 'pr', 'po', 'receipt'].every((role) => r.steps.find((s) => s.role === role).status === 'skipped') && audit(r, 'وُفِّر الاحتياج من رصيد الجهة الفنية؛ لا حاجة إلى هذه الخطوة') && cur(r)?.role === 'handoverSign' && cur(r).assigneeIds.join() === 'P-AHMED' && r.need.handover?.startedBy === 'P-ITS' && (await notifs('P-AHMED', id)).some((n) => n.title.ar.includes('متوفر لدى تقنية المعلومات')), `IT's task offers three outcomes; Abdulaziz chose «متوفر لدينا»: the pool panel showed «مقاعد Microsoft 365 E3 · المتبقي ${stock0}» → the seat was deducted (${stock0} → ${stock1}) with reference M365-E3-0148, every purchase/budget step was skipped with the reason «وُفِّر الاحتياج من رصيد الجهة», IT signed as issuer and Ahmed's «وقّع الاستلام» task opened; Ahmed told «متوفر لدى تقنية المعلومات»`);
  
  const st20 = await getState(); const r20 = st20.requests.find((x) => x.id === id);
  console.log('MODES', modes); console.log('PANEL', panel.slice(0, 400)); console.log('stock', stock0, stock1);
  console.log('entity', JSON.stringify(entityStep)); console.log('provision', JSON.stringify(r20.need.provision)); console.log('line', JSON.stringify(r20.need.lines[0]));
  console.log('steps', r20.steps.map((s) => (s.role || s.key) + ':' + s.status).join(' ')); console.log('cur', JSON.stringify(cur(r20))); console.log('handover', JSON.stringify(r20.need.handover));
  console.log('audit', r20.audit.map((a) => a.what.ar).join(' | ')); console.log('notifs', (await notifs('P-AHMED', id)).map((n) => n.title.ar).join(' | '));
}
await ctx.close(); await b.close();
