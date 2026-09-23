// v0.12 «أحتاج شيئاً» (AS-01 2.3): سيناريوهات القبول ق.ح-01 إلى ق.ح-31 آلياً عبر الواجهة نفسها — محضر الاستلام يولّده النظام (D-026)، والاستلام على دفعات وإقفال المتبقي (D-027)، وأرقام النظام المرجعي بالتكامل (D-028)، والمستندات بهوية مجموعة النماذج المطبوعة (P-13)؛ وما سبق — ما سبق في v0.10 على القاعدة الجديدة (اعتماد الترسية بالاستثناء D-024)، والتوفير من رصيد الجهة الفنية (D-023)، ومرفقات ملف الشراء والمورّد والعقد من قوائم النظام المرجعي، وتعذر الحد الأدنى للعروض (D-025)، والتحويل إلى جهة أخرى، وتنبيه التجزئة (ق-08)
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
fs.mkdirSync('shots/v12q', { recursive: true });
const ATT = (n) => path.resolve(`shots/v12q/tmp/${n}`);
const ctx = await b.newContext({ viewport: lap, deviceScaleFactor: 1, colorScheme: 'light' });
const p = await ctx.newPage();
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
p.on('pageerror', (e) => errs.push(e.message));
await p.goto(file + '#/home', { waitUntil: 'load' }); await p.waitForTimeout(900);
const shot = (n, full = true) => p.screenshot({ path: `shots/v12q/v12-${n}.png`, fullPage: full });
const getState = () => p.evaluate(() => JSON.parse(localStorage.getItem('usp-portal-v1')));
const mutate = (fn) => p.evaluate((src) => { const s = JSON.parse(localStorage.getItem('usp-portal-v1')); (new Function('s', src))(s); localStorage.setItem('usp-portal-v1', JSON.stringify(s)); }, fn);
const asPerson = async (id, hash, vp = lap, wait = 1300) => { await mutate(`const who = s.people.find((x) => x.id === '${id}'); s.settings.persona = who.persona; s.settings.actAs = '${id}'; s.settings.lang = 'ar';`); await p.setViewportSize(vp); await p.goto(file + hash); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(wait); };
const asAdmin = async (hash, vp = lap) => { await mutate(`s.settings.persona = 'admin'; s.settings.actAs = undefined; s.settings.lang = 'ar';`); await p.setViewportSize(vp); await p.goto(file + hash); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1300); };
const req = async (id) => (await getState()).requests.find((r) => r.id === id);
const cur = (r) => r.steps.find((s) => s.status === 'current');
const notifs = async (personId, reqId) => (await getState()).notifications.filter((n) => n.to === personId && (!reqId || n.link?.includes(reqId) || n.title.ar.includes(reqId) || n.body.ar.includes(reqId)));
const audit = (r, k) => r.audit.some((a) => a.what.ar.includes(k));
const tasksOf = async (personId) => { const st = await getState(); return st.requests.filter((r) => r.status === 'in_review' && r.steps.some((x) => x.status === 'current' && (x.assigneeIds || []).includes(personId) && !(x.decisions || []).some((d) => d.actorId === personId))).map((r) => r.id); };

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
/** v0.12 (D-028): أمر الشراء من النظام المرجعي — لا رقم يُكتب؛ الرقم يعود من المحاكاة (poNo يُتجاهل ويبقى للتوافق) */
async function po(personId, reqId, _poNo, exp) { await openTask(personId, reqId); if (await p.locator('#np-po').count()) { await p.fill('#np-po', _poNo || '4500019999'); } if (exp) await p.fill('#np-exp', exp); const btn = (await p.locator('.split-detail .btn.primary', { hasText: 'أُنشئ في النظام المرجعي' }).count()) ? primary('أُنشئ في النظام المرجعي') : primary('تسجيل أمر الشراء'); await btn.click(); await p.waitForTimeout(700); }
/** v0.12 (D-026): محضر الاستلام — يُملأ ويُعاين ويُوقَّع؛ opts.lines بالاسم: { delivered, accepted, result, note }؛ للخدمات opts.last/status/value/from/to */
async function receipt(personId, reqId, _ref, att, opts = {}) {
  await openTask(personId, reqId);
  if (att) await p.setInputFiles('#np-recatt', ATT(att));
  const rows = p.locator('.split-detail .np-rec'); const n = await rows.count();
  for (let i = 0; i < n; i++) { const row = rows.nth(i); const txt = await row.textContent(); const key = Object.keys(opts.lines || {}).find((k) => txt.includes(k)); const L = key ? opts.lines[key] : null; if (!L) continue;
    if (L.delivered !== undefined) await row.locator('input[id^="rec-del-"]').fill(String(L.delivered)); if (L.accepted !== undefined) await row.locator('input[id^="rec-acc-"]').fill(String(L.accepted));
    if (L.result) { await row.locator('select.np-rec-result').selectOption(L.result); await p.waitForTimeout(120); } if (L.note) await row.locator('input[id^="rec-note-"]').fill(L.note); }
  if (opts.supNo) await p.fill('#rec-supno', opts.supNo);
  if (opts.from) await p.fill('#rec-from', opts.from); if (opts.to) await p.fill('#rec-to', opts.to); if (opts.value !== undefined) await p.fill('#rec-value', String(opts.value));
  if (opts.status) await p.selectOption('#rec-status', opts.status);
  if (opts.last !== undefined) { const cb = p.locator('#rec-last'); if ((await cb.isChecked()) !== opts.last) await cb.click({ force: true }); }
  if (opts.notes) await p.fill('#rec-notes', opts.notes);
  await p.locator('#np-rec-preview').click(); await p.waitForTimeout(900);
  if (opts.shot) await shot(opts.shot);
  await p.locator('#np-rec-sign').click(); await p.waitForTimeout(800);
}
async function receiptSign(personId, reqId, shotName) { await openTask(personId, reqId); if (shotName) await shot(shotName); await primary('أوقّع المحضر').click(); await p.waitForTimeout(800); }
async function closeRemainder(personId, reqId, why) { await openTask(personId, reqId); await p.locator('#np-closeopen').click(); await p.waitForTimeout(200); await p.fill('#np-closewhy', why); await p.locator('#np-closebtn').click(); await p.waitForTimeout(800); }
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

await mutate(`const today = new Date().toISOString().slice(0, 10); const v = s.needPolicy.versions.filter((x) => x.scheduled && x.from <= today).sort((a, b) => (a.from < b.from ? 1 : -1))[0]; v.content.need.rules.minOffers = 2; v.content.need.methods.forEach((m) => { if (m.offers) m.minOffers = 2; });`);
/* ═══ ق.ح-25 محضر الاستلام يولّده النظام (D-026) والاستلام على دفعات (D-027): الاحتياج المزروع REQ-2026-0400 (عشر سماعات، وصلت ست) ═══ */
{
  const id = 'REQ-2026-0400'; let r = await req(id); const p0 = r.need.procurement; const rc1 = p0.receipts?.[0];
  ok('ق.ح-25-a', rc1?.status === 'issued' && /^INS-2026-\d{3}$/.test(rc1.no) && /^50000004\d\d$/.test(rc1.erpNo) && rc1.lines[0].accepted === 6 && r.need.lines[0].received === 6 && r.need.lines[0].handed === 6 && r.need.handovers?.length === 1 && /^ST-2026-\d{4}$/.test(r.need.handovers[0].number) && cur(r)?.role === 'receipt' && cur(r).batch === 2 && cur(r).assigneeIds.includes('P-STORE2') && r.docs.some((d) => d.type === 'inspection' && d.code === 'FR-PR-04') && r.docs.some((d) => d.type === 'handover' && d.code === 'FR-PR-01'), `seeded: inspection record ${rc1?.no} posted as material document ${rc1?.erpNo} for 6 of 10, handover note ${r.need.handovers?.[0]?.number} signed for the 6, and batch 2 receipt open at the technical store`);
  await asPerson('P-DEPT', `#/requests/${id}`); const pg = await p.locator('.page').textContent(); await shot('25-request-partial');
  await p.locator('button, a', { hasText: 'افتح المستند' }).first().click(); await p.waitForTimeout(1300); const sheet = await p.locator('.sheet .doc-preview').textContent(); await p.evaluate(() => document.querySelector('.sheet .doc-preview')?.scrollIntoView({ block: 'start' })); await shot('25-inspection-sheet', false);
  ok('ق.ح-25-b', pg.includes('6 / 10') && pg.includes(rc1.no) && pg.includes(r.need.handovers[0].number) && pg.includes('الدفعة 2') && sheet.includes('General Secretariat') && sheet.includes('الأمانة العامة') && sheet.includes('محضر فحص واستلام') && sheet.includes(rc1.no) && sheet.includes(rc1.erpNo) && sheet.includes('المطلوب') && sheet.includes('المقبول') && sheet.includes('موقّع إلكترونياً') && sheet.includes('GS-') && sheet.includes('FR-PR-04') && sheet.includes('صدر إلكترونياً'), `the requester sees «6 / 10», both documents and «الدفعة 2»; the inspection record opens on the booklet identity: bilingual letterhead, meta block, badge, table, electronic seal, GS verification code and form code FR-PR-04`);
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  /* الدفعة 2: وصلت أربع، قُبلت ثلاث (واحدة تالفة) — معاينة ثم توقيع؛ لا لجنة (3,200 دون حد الفحص) فيصدر فوراً */
  await openTask('P-STORE2', id); await shot('25-receipt-panel');
  await receipt('P-STORE2', id, null, 'delivery.pdf', { lines: { 'سماعة': { delivered: 4, accepted: 3, result: 'short', note: 'واحدة تالفة الغلاف تُستبدل' } }, supNo: 'DN-77901', notes: 'تبقى واحدة يورّدها المورّد مع البديل', shot: '25-receipt-preview' }); r = await req(id);
  const rc2 = r.need.procurement.receipts[1]; const buyerN = (await notifs('P-MAJED', id)).filter((n) => n.title.ar.includes('متابعة مع المورّد'));
  console.log('DBG25c', JSON.stringify({ rc2, line: r.need.lines[0], aud: r.audit.slice(-4).map((a) => a.what.ar), buyerN: buyerN.map((n) => n.title.ar + '|' + n.body.ar), docs: r.docs.map((d) => d.type + ':' + d.title.ar) }));
  ok('ق.ح-25-c', rc2?.status === 'issued' && rc2.batch === 2 && rc2.result === 'partial' && rc2.lines[0].delivered === 4 && rc2.lines[0].accepted === 3 && rc2.lines[0].before === 6 && rc2.signatures.length === 1 && /^50000004\d\d$/.test(rc2.erpNo) && rc2.erpNo !== rc1.erpNo && rc2.remedyDays === 5 && r.need.lines[0].received === 9 && r.need.lines[0].rejected === 1 && r.need.lines[0].status === 'purchasing' && audit(r, 'استُلم 9 من 10') && audit(r, 'يعالجه المورّد خلال 5 أيام') && buyerN.length >= 1 && buyerN[0].body.ar.includes('ناقص') && r.docs.filter((d) => d.type === 'inspection').length === 2 && r.docs.some((d) => d.stage?.ar.includes('إشعار التسليم')), `batch 2: 4 delivered, 3 accepted (record ${rc2?.no}, material document ${rc2?.erpNo}) → 9 of 10, 1 rejected with a 5-day remedy, procurement notified to follow up, the supplier's note attached`);
  const steps = r.steps.map((x) => `${x.role || x.desk}${x.batch ? '#' + x.batch : ''}:${x.status}`);
  ok('ق.ح-25-d', cur(r)?.role === 'handover' && cur(r).batch === 2 && r.steps.some((x) => x.role === 'receipt' && x.batch === 3 && x.status === 'pending') && r.steps.some((x) => x.role === 'handover' && x.batch === 3 && x.status === 'pending') && r.steps.filter((x) => x.role === 'receipt').length === 3, `after a partial receipt the engine opened handover of batch 2 and inserted receipt + handover of batch 3 (rule «عند كل استلام»): ${steps.filter((x) => /receipt|handover/.test(x)).join(' → ')}`);
  await handoverStart('P-STORE2', id); await signOnPhone('P-DEPT', id, '25-sign-batch2'); r = await req(id); const c = (await getState()).custody.filter((x) => x.requestId === id);
  ok('ق.ح-25-e', r.need.handovers.length === 2 && r.need.handovers[1].batch === 2 && r.need.handovers[1].lines[0].qty === 3 && r.need.handovers[1].number !== r.need.handovers[0].number && r.need.lines[0].handed === 9 && c.length === 2 && c[1].qty === 3 && c[1].handoverNo === r.need.handovers[1].number && r.docs.filter((d) => d.type === 'handover').length === 2 && cur(r)?.role === 'receipt' && cur(r).batch === 3 && r.status === 'in_review', `handover note ${r.need.handovers[1].number} for the 3 (batch 2) signed by Abdulrahman → custody has two entries (6 + 3); the request stays open at batch 3 receipt`);
  globalThis.R25 = id;
}

/* ═══ ق.ح-26 إقفال المتبقي بلا توريد (D-027): المورّد لا يستطيع توريد السماعة الأخيرة — من مسؤول الاستلام في الدفعة 3 ═══ */
{
  const id = globalThis.R25; let r = await req(id); const resBefore = r.need.procurement.reservation.amount;
  await closeRemainder('P-STORE2', id, 'أبلغ المورّد بانقطاع الصنف؛ لا بديل خلال المهلة'); r = await req(id); const dc = r.need.procurement.deliveryCompleted; const bn = (await notifs('P-BUDG', id)).filter((n) => n.title.ar.includes('حُرِّر'));
  ok('ق.ح-26', r.status === 'completed' && dc && dc.why.includes('انقطاع') && r.need.lines[0].closed === 1 && r.need.lines[0].received === 9 && r.need.lines[0].status === 'delivered' && dc.releasedAmount === 320 && r.need.procurement.reservation.amount === resBefore - 320 && audit(r, 'مؤشر اكتمال التوريد') && audit(r, 'حُرِّر من حجز الاعتماد') && bn.length === 1 && r.steps.find((x) => x.role === 'handover' && x.batch === 3)?.status === 'skipped' && (await notifs('P-DEPT', id)).some((n) => n.title.ar.includes('أُقفل المتبقي')), `remainder (1 headset, SAR 320) closed with a reason → delivery-completed indicator on the PO item, SAR 320 released from the reservation (${resBefore} → ${r.need.procurement.reservation.amount}), budget and requester notified, batch-3 handover skipped, need completed`);
  await asPerson('P-DEPT', `#/requests/${id}`); const pg = await p.locator('.page').textContent(); await shot('26-request-closed');
  ok('ق.ح-26-b', pg.includes('إقفال المتبقي') && pg.includes('انقطاع') && pg.includes('9 / 10'), `the request page shows the closed remainder with its reason and «9 / 10»`);
}

/* ═══ ق.ح-27 الفحص بلجنة (D-026): 12 حاسوباً محمولاً (57,600 فوق حد الفحص 50,000) — يوقّع أمين المستودع ثم ممثل الجهة الطالبة (المقيّم) ثم أخصائي المشتريات، ويصدر بالتوقيع الأخير ═══ */
{
  const { id } = await createNeed('P-DEPT', { cat: 'مادة تقنية', items: [{ name: 'حاسوب محمول', qty: 12 }], why: 'تجهيز الموظفين الجدد في القطاع' });
  await chainApprove(id); await specify('P-ITS', id, { 'حاسوب': { itemId: 'M-100201' } }, 'المعيار المعتمد'); await storeDecide('P-STORE2', id, { 'حاسوب': 'purchase' });
  await prepare('P-MAJED', id, { est: 57600, why: 'أجهزة متاحة لدى الموزّعين المعتمدين', evaluator: 'entity', evalWhy: 'الجهة الفنية للفئة' }); await approve('P-GM', id); await budget('P-BUDG', id, 'FM-2026-0430', 57600);
  await quotes('P-MAJED', id, [{ supplier: 'الموزّع المعتمد الأول', amount: 56400 }, { supplier: 'شركة الحلول الرقمية', amount: 58800 }]); await evaluate('P-ITS', id, 'الموزّع المعتمد الأول', 'الأدنى ومطابق للمعيار'); await po('P-MAJED', id, null, in14); let r = await req(id);
  ok('ق.ح-27-a', cur(r)?.role === 'receipt' && cur(r).assigneeIds.includes('P-STORE2') && r.need.procurement.award?.amount === 56400, `12 laptops awarded at 56,400 → receipt at the technical store`);
  await openTask('P-STORE2', id); const hint = await p.locator('.split-detail').textContent();
  await receipt('P-STORE2', id, null, null, { lines: { 'حاسوب': { delivered: 12, accepted: 12 } }, supNo: 'DN-78002', shot: '27-committee-preview' }); r = await req(id); const rc = r.need.procurement.receipts[0];
  console.log('DBG27b', JSON.stringify({ rc, cur: cur(r), itsN: (await notifs('P-ITS', id)).map((n) => n.title.ar), majN: (await notifs('P-MAJED', id)).map((n) => n.title.ar) }));
  ok('ق.ح-27-b', rc?.status === 'signing' && rc.committee && rc.signers.length === 3 && rc.signers.map((x) => x.personId).join() === 'P-STORE2,P-ITS,P-MAJED' && rc.signatures.length === 1 && !rc.no && !rc.erpNo && cur(r)?.role === 'receiptSign' && cur(r).quorum === 'all' && cur(r).assigneeIds.join() === 'P-ITS,P-MAJED' && (await notifs('P-ITS', id)).some((n) => n.title.ar.includes('وقّع محضر')) && (await notifs('P-MAJED', id)).some((n) => n.title.ar.includes('وقّع محضر')), `value above the inspection threshold → committee: the storekeeper signed first, the record waits (no number yet) for the requesting-side representative (Abdulaziz, the evaluator) and the buyer (Majed), both notified`);
  await receiptSign('P-ITS', id, '27-sign-entity'); r = await req(id); const rcMid = r.need.procurement.receipts[0];
  ok('ق.ح-27-c', rcMid.status === 'signing' && rcMid.signatures.length === 2 && cur(r)?.role === 'receiptSign' && !(await tasksOf('P-ITS')).includes(id) && (await tasksOf('P-MAJED')).includes(id), `Abdulaziz signed → still waiting for Majed (his task gone, Majed's remains)`);
  await receiptSign('P-MAJED', id); r = await req(id); const rcDone = r.need.procurement.receipts[0];
  console.log('DBG27d', JSON.stringify({ no: rcDone.no, erp: rcDone.erpNo, sigs: rcDone.signatures.length, st: rcDone.status, line: r.need.lines[0], cur: cur(r)?.role, nrec: r.steps.filter((x) => x.role === 'receipt').length, aud: r.audit.slice(-3).map((a) => a.what.ar) }));
  ok('ق.ح-27-d', rcDone.status === 'issued' && rcDone.signatures.length === 3 && /^INS-2026-\d{3}$/.test(rcDone.no) && /^50000004\d\d$/.test(rcDone.erpNo) && audit(r, 'بتوقيع حسن') && audit(r, 'عبدالعزيز') && audit(r, 'ماجد') && r.need.lines[0].received === 12 && r.need.lines[0].status === 'received' && cur(r)?.role === 'handover' && r.steps.filter((x) => x.role === 'receipt').length === 1, `Majed's signature issued record ${rcDone.no} with three signatures and posted material document ${rcDone.erpNo}; all 12 received → handover, no further batch`);
  await asPerson('P-DEPT', `#/requests/${id}`); await p.locator('button, a', { hasText: 'افتح المستند' }).first().click(); await p.waitForTimeout(1300); const sheet = await p.locator('.sheet .doc-preview').textContent(); await p.evaluate(() => document.querySelector('.sheet .dp-sign')?.scrollIntoView({ block: 'center' })); await shot('27-committee-sheet', false);
  ok('ق.ح-27-e', sheet.includes('اجتمعت لجنة الفحص والاستلام') && sheet.includes('حسن') && sheet.includes('عبدالعزيز') && sheet.includes('ماجد') && sheet.includes('ممثل الجهة الطالبة') && sheet.includes('ممثل المشتريات') && sheet.includes('توقيع إلكتروني موثّق') && hint.includes('الفحص بلجنة'), `the issued record reads as a committee record with the three names and roles, seal + two verified electronic signatures; the storekeeper's panel had said «الفحص بلجنة» before signing`);
}

/* ═══ ق.ح-28 خدمة على دفعات (D-027): صيانة أجهزة العرض سنةً — محضر استلام خدمة للربع الأول (ليس الأخير) ثم المحضر الأخير؛ أخصائي المشتريات يوقّع كل محضر ═══ */
{
  const { id } = await createNeed('P-DEPT', { cat: 'خدمة تقنية', free: [{ name: 'عقد صيانة أجهزة العرض (سنة)', qty: 1 }], why: 'صيانة دورية لقاعات الاجتماعات' });
  await chainApprove(id); await specify('P-ITS', id, { 'صيانة': { text: 'صيانة أجهزة العرض (سنة، أربع زيارات)', group: 'SRV-MNT', price: 12000 } }, 'عقد سنوي بزيارات ربعية');
  await prepare('P-MAJED', id, { est: 12000, why: 'خدمة متاحة لدى أكثر من مورّد', evaluator: 'entity', evalWhy: 'الجهة الفنية للفئة' }); await approve('P-GM', id); await budget('P-BUDG', id, 'FM-2026-0431', 12000);
  await quotes('P-MAJED', id, [{ supplier: 'شركة الحلول الرقمية', amount: 11800 }, { supplier: 'مؤسسة التقنية المتقدمة', amount: 12400 }]); await evaluate('P-ITS', id, 'شركة الحلول الرقمية', 'الأدنى وخبرة سابقة'); await po('P-MAJED', id, null, in30); let r = await req(id);
  ok('ق.ح-28-a', cur(r)?.role === 'receipt' && cur(r).assigneeIds.includes('P-ITS') && r.need.kind === 'service', `service PO → receipt with IT (service owner)`);
  await receipt('P-ITS', id, null, null, { from: today, to: in30, value: 2950, status: 'ok', last: false, notes: 'الزيارة الأولى أُنجزت', shot: '28-service-preview' }); await receiptSign('P-MAJED', id); r = await req(id); const rc1 = r.need.procurement.receipts[0];
  ok('ق.ح-28-b', rc1?.status === 'issued' && /^REC-2026-\d{3}$/.test(rc1.no) && /^10000045\d\d$/.test(rc1.erpNo) && rc1.value === 2950 && rc1.last === false && rc1.signatures.length === 2 && r.status === 'in_review' && r.need.lines[0].status === 'purchasing' && cur(r)?.role === 'receipt' && cur(r).batch === 2 && r.docs.some((d) => d.type === 'serviceReceipt' && d.code === 'FR-PR-05'), `first-quarter service record ${rc1?.no} (not final) issued with the buyer's co-signature and posted as service entry sheet ${rc1?.erpNo}; the need stays open at receipt batch 2`);
  await receipt('P-ITS', id, null, null, { from: in30, to: in30, value: 8850, status: 'note', last: true, notes: 'اكتملت الزيارات؛ تأخرت الأخيرة يومين' }); await receiptSign('P-MAJED', id); r = await req(id); const rc2 = r.need.procurement.receipts[1];
  ok('ق.ح-28-c', rc2?.status === 'issued' && rc2.last === true && rc2.result === 'note' && rc2.erpNo !== rc1.erpNo && r.status === 'completed' && r.need.lines[0].status === 'delivered' && r.docs.filter((d) => d.type === 'serviceReceipt').length === 2 && r.steps.filter((x) => x.role === 'receipt' || x.role === 'receiptSign').length === 2, `final record ${rc2?.no} (with notes) closed the service: two service records, need completed, no handover`);
}

/* ═══ ق.ح-29 القواعد الجديدة في مركز السياسات وأرقام النظام المرجعي بالإدخال اليدوي احتياطاً (D-028) ═══ */
{
  await asAdmin('#/admin/need'); await p.locator('.ptl-card.draft').first().click().catch(() => {}); await p.waitForTimeout(500); await p.locator('.segmented button', { hasText: 'القواعد' }).click(); await p.waitForTimeout(500);
  const rules = await p.locator('.npc-rules').textContent(); await shot('29-rules');
  ok('ق.ح-29-a', rules.includes('حد الفحص بلجنة') && rules.includes('التسليم للمستفيد') && rules.includes('عند كل استلام') && rules.includes('بعد اكتمال الاستلام') && rules.includes('مهلة معالجة') && rules.includes('مهلة التوريد') && rules.includes('أرقام النظام المرجعي') && rules.includes('بالتكامل') && rules.includes('إدخال يدوي') && (await p.locator('#np-inspection').inputValue()) === '50000', `the rules tab carries the v0.12 rules: inspection threshold 50,000, handover mode, remedy days, lead days, and the ERP-numbers switch`);
  await p.locator('.segmented button', { hasText: 'الفئات' }).click(); await p.waitForTimeout(400); await p.locator('.pt-card', { hasText: 'مادة تقنية' }).first().click(); await p.waitForTimeout(600); const catSheet = await p.locator('.sheet').textContent(); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  ok('ق.ح-29-b', catSheet.includes('تتطلب فحصاً بلجنة'), `a material category carries the «تتطلب فحصاً بلجنة» switch`);
  /* التبديل إلى الإدخال اليدوي (احتياط) على الإصدار الساري مباشرةً — اختباراً للسلوك لا للجدولة */
  await mutate(`const today = new Date().toISOString().slice(0, 10); const v = s.needPolicy.versions.filter((x) => x.scheduled && x.from <= today).sort((a, b) => (a.from < b.from ? 1 : -1))[0]; v.content.need.rules.erpNumbers = 'manual';`);
  const { id } = await createNeed('P-DEPT', { cat: 'مادة عامة', items: [{ name: 'كرسي مكتب' }], why: 'كرسي بديل' });
  await chainApprove(id); await specify('P-GSS', id, { 'كرسي': { itemId: 'M-200301' } }); await storeDecide('P-STORE1', id, { 'كرسي': 'purchase' });
  await prepare('P-MAJED', id, { est: 950, why: 'أثاث', evaluator: 'entity', evalWhy: 'أثاث' }); await approve('P-GM', id); await budget('P-BUDG', id, 'FM-2026-0432'); await quotes('P-MAJED', id, [{ supplier: 'شركة المكاتب الحديثة', amount: 920 }, { supplier: 'مؤسسة التجهيزات المكتبية', amount: 960 }]); await evaluate('P-GSS', id, 'شركة المكاتب الحديثة', 'الأدنى');
  await openTask('P-MAJED', id); const manualField = await p.locator('#np-po').count(); await shot('29-po-manual');
  await po('P-MAJED', id, '4500777001', in14); let r = await req(id);
  ok('ق.ح-29-c', manualField === 1 && r.need.procurement.poNo === '4500777001' && r.need.procurement.poSource === 'manual' && audit(r, 'يدوياً'), `with the manual switch on, the PO panel asks for the number and records it as manual (${r.need.procurement.poNo})`);
  await mutate(`const today = new Date().toISOString().slice(0, 10); const v = s.needPolicy.versions.filter((x) => x.scheduled && x.from <= today).sort((a, b) => (a.from < b.from ? 1 : -1))[0]; v.content.need.rules.erpNumbers = 'integration';`);
  const pgReq = await (async () => { await asPerson('P-DEPT', `#/requests/${id}`); return p.locator('.page').textContent(); })();
  ok('ق.ح-29-d', pgReq.includes('4500777001') && pgReq.includes('إدخال يدوي'), `the request page marks the manually entered PO`);
}

/* ═══ ق.ح-30 قاعدة التسليم «بعد اكتمال الاستلام» (D-027): لا تسليم بعد الدفعة الجزئية؛ تُدرج الدفعة التالية قبل التسليم ═══ */
{
  await mutate(`const today = new Date().toISOString().slice(0, 10); const v = s.needPolicy.versions.filter((x) => x.scheduled && x.from <= today).sort((a, b) => (a.from < b.from ? 1 : -1))[0]; v.content.need.rules.handoverMode = 'complete';`);
  const { id } = await createNeed('P-DEPT', { cat: 'مادة تقنية', items: [{ name: 'حبر طابعة', qty: 8 }], why: 'مخزون الطابعات للربع' });
  await chainApprove(id); await specify('P-ITS', id, { 'حبر': { itemId: 'M-100205' } }); await storeDecide('P-STORE2', id, { 'حبر': 'purchase' });
  await prepare('P-MAJED', id, { est: 2080, why: 'أحبار', evaluator: 'entity', evalWhy: 'الجهة الفنية' }); await approve('P-GM', id); await budget('P-BUDG', id, 'FM-2026-0433'); await quotes('P-MAJED', id, [{ supplier: 'الموزّع المعتمد الأول', amount: 2000 }, { supplier: 'شركة الحلول الرقمية', amount: 2100 }]); await evaluate('P-ITS', id, 'الموزّع المعتمد الأول', 'الأدنى'); await po('P-MAJED', id, null, in14);
  await receipt('P-STORE2', id, null, null, { lines: { 'حبر': { delivered: 5, accepted: 5 } } }); let r = await req(id);
  const order = r.steps.filter((x) => x.role === 'receipt' || x.role === 'handover' || x.role === 'handoverSign').map((x) => `${x.role}${x.batch ? '#' + x.batch : ''}:${x.status}`);
  ok('ق.ح-30-a', cur(r)?.role === 'receipt' && cur(r).batch === 2 && r.need.lines[0].received === 5 && r.need.lines[0].handed === undefined && r.steps.filter((x) => x.role === 'handover' && x.branch === 'purchase').length === 1, `rule «بعد اكتمال الاستلام»: after 5 of 8 the next step is receipt batch 2, not handover: ${order.join(' → ')}`);
  await receipt('P-STORE2', id, null, null, { lines: { 'حبر': { delivered: 3, accepted: 3 } } }); r = await req(id);
  ok('ق.ح-30-b', cur(r)?.role === 'handover' && r.need.lines[0].received === 8 && r.need.lines[0].status === 'received' && r.need.procurement.receipts.length === 2, `after the remaining 3 the handover opens once for all 8`);
  await handoverStart('P-STORE2', id); await signOnPhone('P-DEPT', id); r = await req(id);
  ok('ق.ح-30-c', r.status === 'completed' && r.need.handovers.length === 1 && r.need.handovers[0].lines[0].qty === 8 && r.need.lines[0].handed === 8, `one handover note for the 8 → completed`);
  await mutate(`const today = new Date().toISOString().slice(0, 10); const v = s.needPolicy.versions.filter((x) => x.scheduled && x.from <= today).sort((a, b) => (a.from < b.from ? 1 : -1))[0]; v.content.need.rules.handoverMode = 'each';`);
}

/* ═══ ق.ح-31 المستندات الثلاثة القائمة على هوية المجموعة (P-13): قرار الإجازة بصيغة القرار الإداري، وسند التسليم، ومستند إصدار السياسة ═══ */
{
  const st = await getState(); const lv = st.requests.find((r) => r.leave && r.status === 'completed' && r.docs.some((d) => d.kind === 'issued'));
  await asPerson(lv.requesterId, `#/requests/${lv.id}`); await p.locator('button, a', { hasText: 'افتح المستند' }).first().click(); await p.waitForTimeout(1300); const dec = await p.locator('.sheet .doc-preview').textContent(); await p.evaluate(() => document.querySelector('.sheet .doc-preview')?.scrollIntoView({ block: 'start' })); await shot('31-decision-sheet', false);
  ok('ق.ح-31-a', dec.includes('General Secretariat') && dec.includes('قرار إداري رقم') && /\d{3}\/2026/.test(dec) && dec.includes('قرار إجازة') && dec.includes('بشأن منح الموظف') && dec.includes('إن صاحب الصلاحية') && dec.includes('قرر ما يلي') && dec.includes('أولاً') && dec.includes('والله ولي التوفيق') && dec.includes('صاحب الصلاحية') && dec.includes('نسخة إلى') && dec.includes('سلسلة الاعتماد') && dec.includes('موقّع إلكترونياً') && dec.includes('FR-HR-01') && dec.includes('GS-') && dec.includes('محدود التداول'), `the leave decision reads as an administrative decision on the booklet identity: preamble, articles, closing, the actual signer with the electronic seal, «نسخة إلى», approval chain, FR-HR-01 and a GS verification code`);
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  const hv = st.requests.find((r) => r.need?.handovers?.length && r.need.provision);
  await asPerson(hv.need.beneficiaryId, `#/requests/${hv.id}`); await p.locator('button, a', { hasText: 'افتح المستند' }).first().click(); await p.waitForTimeout(1300); const hn = await p.locator('.sheet .doc-preview').textContent(); await shot('31-handover-provided', false);
  ok('ق.ح-31-b', hn.includes('سند تسليم واستلام') && /ST-2026-\d{4}/.test(hn) && hn.includes('من رصيدها بلا شراء') && hn.includes('FR-PR-01') && hn.includes('المستلم') && hn.includes('توقيع إلكتروني موثّق'), `the entity-pool handover note carries its ST number, the «من رصيدها بلا شراء» wording, the receiver's verified signature and FR-PR-01`);
  await asAdmin('#/admin/policy'); await p.locator('.ptl-card').first().click(); await p.waitForTimeout(600); await p.locator('.pv-line .btn.quiet').first().click(); await p.waitForTimeout(1300); const pol = await p.locator('.sheet .doc-preview').textContent(); await shot('31-policy-sheet', false);
  ok('ق.ح-31-c', pol.includes('General Secretariat') && pol.includes('سياسة الإجازات') && pol.includes('POL-LEAVE-') && pol.includes('وثيقة داخلية') && pol.includes('GS-') && !pol.includes('FR-'), `the policy version document carries the identity without a form code (not in the booklet) and is marked internal`);
}


await ctx.close();
console.log(`\nerrors ${errs.length}`); errs.slice(0, 8).forEach((e) => console.log('  ' + e));
const pass = checks.filter((c) => c.pass).length; console.log(`\n${pass}/${checks.length} PASS`);
await b.close();
