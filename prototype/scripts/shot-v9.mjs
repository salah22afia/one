// v0.9 «أحتاج شيئاً» (AS-01): سيناريوهات القبول ق.ح-01 إلى ق.ح-14 آلياً عبر الواجهة نفسها (المعالج، والمهام، والمكاتب، والتوقيع على الهاتف، ومركز سياسة الاحتياج)
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import path from 'node:path';
import fs from 'node:fs';
const file = 'file://' + path.resolve('dist/index.html');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
const errs = []; const checks = [];
const ok = (id, cond, detail) => { checks.push({ id, pass: !!cond, detail }); console.log(`${cond ? 'PASS' : 'FAIL'} ${id}: ${detail}`); };
const ph = { width: 400, height: 860 }; const lap = { width: 1440, height: 900 };
const toISO = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
const today = toISO(Date.now()); const tomorrow = toISO(Date.now() + 86400000); const in14 = toISO(Date.now() + 14 * 86400000);
fs.mkdirSync('shots/v9', { recursive: true });
const ctx = await b.newContext({ viewport: lap, deviceScaleFactor: 1, colorScheme: 'light' });
const p = await ctx.newPage();
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
p.on('pageerror', (e) => errs.push(e.message));
await p.goto(file + '#/home', { waitUntil: 'load' }); await p.waitForTimeout(900);
const shot = (n, full = true) => p.screenshot({ path: `shots/v9/v9-${n}.png`, fullPage: full });
const getState = () => p.evaluate(() => JSON.parse(localStorage.getItem('usp-portal-v1')));
const mutate = (fn) => p.evaluate((src) => { const s = JSON.parse(localStorage.getItem('usp-portal-v1')); (new Function('s', src))(s); localStorage.setItem('usp-portal-v1', JSON.stringify(s)); }, fn);
const asPerson = async (id, hash, vp = lap, wait = 1300) => { await mutate(`const who = s.people.find((x) => x.id === '${id}'); s.settings.persona = who.persona; s.settings.actAs = '${id}'; s.settings.lang = 'ar';`); await p.setViewportSize(vp); await p.goto(file + hash); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(wait); };
const asAdmin = async (hash, vp = lap) => { await mutate(`s.settings.persona = 'admin'; s.settings.actAs = undefined; s.settings.lang = 'ar';`); await p.setViewportSize(vp); await p.goto(file + hash); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1300); };
const req = async (id) => (await getState()).requests.find((r) => r.id === id);
const cur = (r) => r.steps.find((s) => s.status === 'current');
const notifs = async (personId, reqId) => (await getState()).notifications.filter((n) => n.to === personId && (!reqId || n.link?.includes(reqId) || n.title.ar.includes(reqId) || n.body.ar.includes(reqId)));

/* ——— أدوات الواجهة ——— */
/** فتح مهمة طلب بعينه في «مهامي» (حاسوب: اللوح المنقسم) */
async function openTask(personId, reqId) {
  await asPerson(personId, '#/inbox');
  const rows = p.locator('.split .row'); const n = await rows.count();
  for (let i = 0; i < n; i++) { await rows.nth(i).locator('.cell').click(); await p.waitForTimeout(450); const txt = await p.locator('.split-detail .mono').first().textContent().catch(() => ''); if (txt.trim() === reqId) return true; }
  throw new Error(`task ${reqId} not found for ${personId} (${n} rows)`);
}
const primary = (text) => p.locator('.split-detail .btn.primary', { hasText: text });
async function approve(personId, reqId) { await openTask(personId, reqId); await primary('اعتماد').click(); await p.waitForTimeout(700); }
async function returnTask(personId, reqId, note) { await openTask(personId, reqId); await p.fill('#decision-note', note); await p.locator('.split-detail .btn.secondary', { hasText: 'إعادة' }).click(); await p.waitForTimeout(700); }
async function storeDecide(personId, reqId, plan) { await openTask(personId, reqId); const lines = p.locator('.split-detail .np-line'); const n = await lines.count(); for (let i = 0; i < n; i++) { const txt = await lines.nth(i).textContent(); const key = Object.keys(plan).find((k) => txt.includes(k)); const action = plan[key] || 'reserve'; await lines.nth(i).locator('.np-choice .pill', { hasText: action === 'reserve' ? 'حجز من المستودع' : 'تحويل إلى الشراء' }).click(); await p.waitForTimeout(120); } await primary('تأكيد قرار المستودع').click(); await p.waitForTimeout(700); }
async function procurement(personId, reqId, { pr, est, offers, evaluator = 'entity', other, why, merge }) {
  await openTask(personId, reqId);
  if (merge) { await p.selectOption('#np-merge', merge); await p.waitForTimeout(200); } else await p.fill('#np-pr', pr);
  await p.fill('#np-est', String(est)); await p.fill('#np-offers', String(offers));
  await p.locator('.split-detail .chips .pill', { hasText: evaluator === 'entity' ? 'الجهة الفنية للفئة' : evaluator === 'requester' ? 'مقدم الطلب' : 'جهة أسمّيها' }).click(); await p.waitForTimeout(150);
  if (evaluator === 'other') await p.selectOption('.split-detail select.select-in', other);
  await p.fill('#np-evalwhy', why); await primary('تسجيل طلب الشراء والعروض').click(); await p.waitForTimeout(700);
}
async function evaluate(personId, reqId, offer, note) { await openTask(personId, reqId); await p.fill('#np-offer', offer); await p.fill('#np-evalnote', note); await primary('إرسال التوصية').click(); await p.waitForTimeout(700); }
async function budget(personId, reqId, ref) { await openTask(personId, reqId); await p.fill('#np-budget', ref); await primary('تأكيد الاعتماد').click(); await p.waitForTimeout(700); }
async function tender(personId, reqId, ref, result) { await openTask(personId, reqId); await p.fill('#np-tref', ref); await p.fill('#np-tres', result); await primary('تسجيل نتيجة المناقصات').click(); await p.waitForTimeout(700); }
async function po(personId, reqId, poNo, exp) { await openTask(personId, reqId); await p.fill('#np-po', poNo); await p.fill('#np-exp', exp); await primary('تسجيل أمر الشراء').click(); await p.waitForTimeout(700); }
async function receipt(personId, reqId, ref) { await openTask(personId, reqId); await p.fill('#np-rec', ref); await primary('تأكيد الاستلام').click(); await p.waitForTimeout(700); }
async function handoverStart(personId, reqId) { await openTask(personId, reqId); await primary('ابدأ التسليم ووقّع').click(); await p.waitForTimeout(700); }
/** التوقيع على الهاتف: المهمة في ورقة سفلية */
async function signOnPhone(personId, reqId, shotName) {
  await asPerson(personId, '#/inbox', ph);
  const rows = p.locator('.row'); const n = await rows.count(); let found = false;
  for (let i = 0; i < n && !found; i++) { await rows.nth(i).locator('.cell').click(); await p.waitForTimeout(700); const txt = await p.locator('.sheet .mono').first().textContent().catch(() => ''); if (txt.trim() === reqId) found = true; else { await p.keyboard.press('Escape'); await p.waitForTimeout(400); } }
  if (!found) throw new Error(`sign task ${reqId} not found for ${personId}`);
  if (shotName) await shot(shotName, false);
  await p.locator('.sheet .btn.primary', { hasText: 'أوقّع الاستلام' }).click(); await p.waitForTimeout(900);
}
/** المعالج: لمن وماذا ثم التفاصيل ثم المراجعة والإرسال — يعيد رقم الطلب */
async function createNeed(requesterId, { beneficiaryId, cat, items = [], free = [], why, est, vp = lap, shotPrefix }) {
  await asPerson(requesterId, '#/new/AS-01', vp);
  if (beneficiaryId) { await p.locator('.chips .pill', { hasText: 'لموظف في وحدتي' }).click(); await p.waitForTimeout(200); await p.selectOption('#ben', beneficiaryId); await p.waitForTimeout(200); }
  await p.locator('.type-row', { hasText: cat }).click(); await p.waitForTimeout(600);
  for (const it of items) { for (let k = 0; k < (it.qty || 1); k++) { await p.locator('.group .cell', { hasText: it.id }).first().click(); await p.waitForTimeout(150); } }
  for (const f of free) { await p.fill('.need-free input[aria-label="اسم المادة أو الخدمة"]', f.name); await p.fill('.need-free input.qty', String(f.qty || 1)); await p.locator('.need-free .btn', { hasText: 'إضافة بند' }).click(); await p.waitForTimeout(150); }
  if (shotPrefix) await shot(`${shotPrefix}-1-what`);
  await p.locator('.btn.primary.block', { hasText: 'التالي' }).click(); await p.waitForTimeout(600);
  await p.fill('#n-why', why); if (est) await p.fill('#n-est', String(est));
  if (shotPrefix) await shot(`${shotPrefix}-2-details`);
  await p.locator('.btn.primary.block', { hasText: 'المراجعة' }).click(); await p.waitForTimeout(700);
  const route = await p.locator('.route-preview').textContent().catch(() => ''); const skipped = await p.locator('.rp-skipped').textContent().catch(() => '');
  if (shotPrefix) await shot(`${shotPrefix}-3-review`);
  await p.locator('.btn.primary.block', { hasText: 'إرسال الاحتياج' }).click(); await p.waitForTimeout(1600);
  const id = (await p.locator('.success-id').textContent()).trim();
  if (shotPrefix) await shot(`${shotPrefix}-4-sent`, false);
  return { id, route, skipped };
}
const linesOf = (r) => r.need.lines.map((l) => `${l.name.ar}:${l.status}`).join(' ');
const stepsOf = (r) => r.steps.map((s) => `${s.role || s.desk}:${s.status}`).join(' ');

/* ═══ ق.ح-01 مادة تقنية متوفرة لمستفيد (أحمد) — وبوابة المستوى لأحمد نفسه ═══ */
{
  await asPerson('P-AHMED', '#/new/AS-01', ph); const gate = await p.locator('.need-gate').textContent(); await shot('01-gate-ahmed-phone', false);
  ok('ق.ح-01-a', gate.includes('اطلبه من مديرك') && gate.includes('مدير إدارة'), `Ahmed (specialist) sees «اطلبه من مديرك» with the minimum level: "${gate.replace(/\s+/g, ' ').slice(0, 110)}"`);
  const { id, route, skipped } = await createNeed('P-DEPT', { beneficiaryId: 'P-AHMED', cat: 'مادة تقنية', items: [{ id: 'M-100201' }], why: 'جهاز لأحمد بدل جهازه المتعطل', vp: ph, shotPrefix: '01-wizard' });
  const r0 = await req(id); const chain = r0.steps.filter((s) => s.role === 'chain').map((s) => s.assigneeIds[0]);
  ok('ق.ح-01-b', /^REQ-2026-\d{4}$/.test(id) && route.includes('مراجعة منسّق القطاع') && route.includes('سارة') && route.includes('عبدالله بن محمد العتيبي') && route.includes('سعود بن عبدالله المنصور') && route.includes('إن توفر في المستودع') && route.includes('إن لم يتوفر') && !route.includes('اعتماد مدير الإدارة') && chain.join() === 'P-GM,P-ASG' && !r0.steps.some((s) => s.assigneeIds?.includes('P-DEPT') && s.role !== undefined && s.role !== 'handoverSign'), `${id} created; preview shows م5 with the coordinator, the chain above Abdulrahman (GM → sector head, never himself) and both branches; chain=${chain.join('→')}; skipped="${skipped.replace(/\s+/g, ' ').slice(0, 80)}"`);
  const benNotif = await notifs('P-AHMED', id);
  ok('ق.ح-01-c', benNotif.some((n) => n.title.ar.startsWith('طلب لك')), `Ahmed (beneficiary) was told «طلب لك عبدالرحمن…» (${benNotif.length} notifications)`);
  await approve('P-SARA', id); await shot('01-coordinator-sara'); let r = await req(id);
  ok('ق.ح-01-d', cur(r)?.role === 'chain' && cur(r).assigneeIds[0] === 'P-GM', `Sara (sector coordinator) approved → now with the Director General (${stepsOf(r).slice(0, 90)}…)`);
  await approve('P-GM', id); await approve('P-ASG', id); r = await req(id);
  ok('ق.ح-01-e', cur(r)?.role === 'entity' && (cur(r).assigneeIds.includes('P-ITM') || cur(r).assigneeIds.includes('P-ITS')), `GM and sector head approved → IT (specifications) task: ${cur(r)?.assigneeIds.join(',')}`);
  await openTask('P-ITS', id); await shot('01-it-task'); await primary('اعتماد').click(); await p.waitForTimeout(700); r = await req(id);
  ok('ق.ح-01-f', cur(r)?.role === 'store' && cur(r).assigneeIds[0] === 'P-STORE2', `IT approved the specifications → technical store keeper Hassan has the availability task`);
  await openTask('P-STORE2', id); const avail = await p.locator('.split-detail .np-line').first().textContent(); await shot('01-store-panel');
  await storeDecide('P-STORE2', id, { 'حاسوب': 'reserve' }); r = await req(id); const st = (await getState()).erp.stock.find((x) => x.itemId === 'M-100201' && x.storeId === '1020');
  ok('ق.ح-01-g', avail.includes('المتاح: 2') && r.need.lines[0].status === 'reserved' && /^2000\d{4}$/.test(r.need.lines[0].reservationNo) && st.qty === 1 && r.steps.find((s) => s.role === 'store').outcome === 'available' && cur(r)?.role === 'handover', `store saw «المتاح: 2», reserved (reservation ${r.need.lines[0].reservationNo}, stock 2→${st.qty}); now: handover (purchase branch pending to be skipped)`);
  await handoverStart('P-STORE2', id); r = await req(id);
  ok('ق.ح-01-h', cur(r)?.role === 'handoverSign' && cur(r).assigneeIds[0] === 'P-AHMED' && r.need.handover.startedBy === 'P-STORE2' && (await notifs('P-AHMED', id)).some((n) => n.title.ar.includes('وقّع الاستلام')), `Hassan started the handover and signed → Ahmed has «وقّع الاستلام» on his phone`);
  await signOnPhone('P-AHMED', id, '01-sign-phone'); r = await req(id); const s1 = await getState(); const custody = s1.custody.filter((c) => c.requestId === id);
  ok('ق.ح-01-i', r.status === 'completed' && r.steps.filter((s) => s.branch === 'purchase' || s.branch === 'tender').every((s) => s.status === 'skipped') && r.need.lines[0].status === 'delivered' && /^49000\d{5}$/.test(r.need.lines[0].materialDocNo) && /^4000\d{5}$/.test(r.need.lines[0].assetNo) && r.docs.some((d) => d.kind === 'issued' && /^\d{3} \/ 2026$/.test(d.number)) && custody.length === 1 && custody[0].personId === 'P-AHMED' && (await notifs('P-AHMED')).some((n) => n.title.ar.includes('قُيِّد في عهدتك')), `Ahmed signed → ${r.status} (${stepsOf(r)}); material document ${r.need.lines[0].materialDocNo}, asset ${r.need.lines[0].assetNo}, handover note ${r.docs.find((d) => d.kind === 'issued')?.number}, custody entry for Ahmed + «قُيِّد في عهدتك»`);
  await asPerson('P-AHMED', `#/requests/${id}`, ph); await p.locator('.seal .seal-act').first().click(); await p.waitForTimeout(1200); const doc = await p.locator('.sheet').textContent(); await shot('01-handover-note-phone', false); await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  ok('ق.ح-01-j', doc.includes('سند تسليم واستلام') && doc.includes('المسلِّم') && doc.includes('حسن بن علي العلي') && doc.includes('المستلم') && doc.includes('أحمد بن سعود الدوسري') && doc.includes(r.need.lines[0].materialDocNo) && doc.includes(r.need.lines[0].assetNo) && /رمز التحقق|VER-/.test(doc), `the handover note carries both signatures, the material document, the asset number and a verification code`);
  await asPerson('P-AHMED', '#/me', ph); const meTxt = await p.locator('.page').textContent(); await asPerson('P-AHMED', '#/me/custody', ph); const cTxt = await p.locator('.page').textContent(); await shot('01-custody-phone');
  ok('ق.ح-01-k', meTxt.includes('عهدتي') && meTxt.includes('حاسوب محمول 14 بوصة') && cTxt.includes(r.need.lines[0].assetNo) && cTxt.includes(r.docs.find((d) => d.kind === 'issued').number), `«عهدتي» in ملفي and the custody page show the laptop with its asset number and note number`);
  globalThis.R01 = id;
}

/* ═══ ق.ح-02 مادة غير تقنية غير متوفرة: كرسي مكتب → الشراء كاملاً حتى العهدة ═══ */
{
  const { id, route } = await createNeed('P-DEPT', { cat: 'مادة عامة', items: [{ id: 'M-200301' }], why: 'كرسي بدل التالف في مكتبي', shotPrefix: '02-wizard' });
  ok('ق.ح-02-a', route.includes('اعتماد الجهة الفنية') && route.includes('فيصل') && route.includes('المستودع: التوفر والحجز') && route.includes('يوسف'), `${id}: route shows General Services (Faisal) and the general store (Yousef)`);
  await approve('P-SARA', id); await approve('P-GM', id); await approve('P-ASG', id); await approve('P-GSM', id);
  await storeDecide('P-STORE1', id, { 'كرسي': 'purchase' }); let r = await req(id);
  ok('ق.ح-02-b', r.steps.find((s) => s.role === 'store').outcome === 'unavailable' && r.need.lines[0].status === 'purchasing' && cur(r)?.role === 'procurement' && r.steps.find((s) => s.role === 'handover' && s.branch === 'stock').status === 'skipped' && (await notifs('P-DEPT', id)).some((n) => n.title.ar.includes('تحوّل إلى الشراء')), `general store: «غير متوفر» → line to purchase, stock handover skipped, now with procurement; requester told «تحوّل إلى الشراء»`);
  await openTask('P-MAJED', id); await shot('02-procurement-panel');
  await procurement('P-MAJED', id, { pr: '10004601', est: 950, offers: 3, evaluator: 'entity', why: 'الأثاث من اختصاص الخدمات العامة' }); r = await req(id);
  ok('ق.ح-02-c', r.need.procurement.prNo === '10004601' && r.need.procurement.offers.count === 3 && cur(r)?.role === 'evaluator' && cur(r).assigneeIds.includes('P-GSM') && (await notifs('P-DEPT', id)).some((n) => n.title.ar.includes('10004601')), `Majed created PR 10004601, 3 offers, evaluator = General Services (${cur(r)?.assigneeIds.join(',')}); requester told`);
  await evaluate('P-GSM', id, 'العرض 2 — شركة المكاتب الحديثة', 'أفضل سعر بمواصفات مطابقة'); r = await req(id);
  ok('ق.ح-02-d', r.need.procurement.recommendation?.offer.includes('العرض 2') && cur(r)?.role === 'budget' && cur(r).assigneeIds[0] === 'P-BUDG', `Faisal recommended offer 2 → budget (Lamia)`);
  await openTask('P-BUDG', id); await shot('02-budget-panel'); await budget('P-BUDG', id, 'FM-2026-0417'); r = await req(id);
  ok('ق.ح-02-e', r.need.procurement.budgetRef === 'FM-2026-0417' && r.steps.find((s) => s.role === 'tender').status === 'skipped' && cur(r)?.role === 'po', `budget confirmed FM-2026-0417; value below the threshold → tender skipped («${r.audit.find((a) => a.what.ar.includes('تُخُطِّيت'))?.what.ar.slice(0, 60)}»); now: purchase order`);
  await po('P-MAJED', id, '4500012901', in14); r = await req(id);
  ok('ق.ح-02-f', r.need.procurement.poNo === '4500012901' && r.need.procurement.expectedAt === in14 && cur(r)?.role === 'receipt' && cur(r).assigneeIds[0] === 'P-STORE1' && (await notifs('P-DEPT', id)).some((n) => n.title.ar.includes('4500012901')), `PO 4500012901 with expected ${in14} → receipt task at the general store; requester told`);
  await asPerson('P-DEPT', `#/requests/${id}`); const pg = await p.locator('.page').textContent(); await shot('02-request-stages');
  ok('ق.ح-02-g', pg.includes('10004601') && pg.includes('FM-2026-0417') && pg.includes('4500012901') && pg.includes('التوريد المتوقع') && pg.includes(in14) && pg.includes('مراجع النظام المرجعي'), `the request page shows the stages with PR, budget ref, PO and the expected date`);
  await receipt('P-STORE1', id, '5000012345'); r = await req(id);
  ok('ق.ح-02-h', r.need.procurement.receiptNo === '5000012345' && r.need.lines[0].status === 'received' && cur(r)?.role === 'handover' && cur(r).assigneeIds[0] === 'P-STORE1', `goods receipt 5000012345 → line «received» → handover by Yousef`);
  await handoverStart('P-STORE1', id); await signOnPhone('P-DEPT', id); r = await req(id); const c = (await getState()).custody.filter((x) => x.requestId === id);
  ok('ق.ح-02-i', r.status === 'completed' && r.need.lines[0].status === 'delivered' && c.length === 1 && c[0].personId === 'P-DEPT' && r.need.handover.number && r.docs.some((d) => d.kind === 'issued'), `handover signed by Abdulrahman → completed, custody recorded (${c[0]?.assetNo}), note ${r.need.handover.number}`);
  globalThis.R02 = id;
}

/* ═══ ق.ح-03 خدمة تقنية: رخص برمجيات (م7) ═══ */
{
  const { id, route, skipped } = await createNeed('P-DEPT', { cat: 'خدمة تقنية', free: [{ name: 'رخصة برنامج التحليل الإحصائي', qty: 10 }], why: 'رخص لفريق التحليل', est: 45000, shotPrefix: '03-wizard' });
  let r = await req(id);
  ok('ق.ح-03-a', r.need.kind === 'service' && !r.steps.some((s) => s.role === 'store') && !r.steps.some((s) => s.role === 'handover') && r.need.lines[0].status === 'purchasing' && !route.includes('المستودع') && skipped === '', `${id}: service route م7 — no store or handover steps; line starts «قيد الشراء»`);
  await approve('P-SARA', id); await approve('P-GM', id); await approve('P-ASG', id); await approve('P-ITM', id);
  await procurement('P-MAJED', id, { pr: '10004602', est: 45000, offers: 3, evaluator: 'entity', why: 'الرخص التقنية تقيّمها تقنية المعلومات' }); r = await req(id);
  ok('ق.ح-03-b', cur(r)?.role === 'evaluator' && cur(r).assigneeIds.includes('P-ITM') && cur(r).assigneeIds.includes('P-ITS'), `IT approved the specs; procurement named IT as evaluator (${cur(r)?.assigneeIds.join(',')})`);
  await evaluate('P-ITS', id, 'العرض 1 — الموزع المعتمد', 'الوحيد المعتمد من المطوّر'); await budget('P-BUDG', id, 'FM-2026-0418'); await po('P-MAJED', id, '4500012902', in14); r = await req(id);
  ok('ق.ح-03-c', cur(r)?.role === 'receipt' && (cur(r).assigneeIds.includes('P-ITM') || cur(r).assigneeIds.includes('P-ITS')), `evaluation, budget and PO done → service receipt task with IT (${cur(r)?.assigneeIds.join(',')})`);
  await receipt('P-ITS', id, '1000004567'); r = await req(id);
  ok('ق.ح-03-d', r.status === 'completed' && r.need.procurement.serviceEntryNo === '1000004567' && r.need.lines[0].status === 'delivered' && !(await getState()).custody.some((c) => c.requestId === id) && !r.docs.some((d) => d.kind === 'issued'), `IT confirmed the service (entry sheet 1000004567) → completed, no custody, no handover note`);
  await asPerson('P-DEPT', `#/requests/${id}`); await shot('03-service-request');
}

/* ═══ ق.ح-04 خدمة غير تقنية: ترجمة (م8: لا جهة فنية، المشتريات تعيّن مقدم الطلب مقيّماً) ═══ */
{
  const { id, skipped } = await createNeed('P-DEPT', { cat: 'خدمة عامة', free: [{ name: 'ترجمة تقرير سنوي (120 صفحة)', qty: 1 }], why: 'الترجمة للنسخة الإنجليزية من التقرير', est: 18000 });
  let r = await req(id);
  ok('ق.ح-04-a', !r.steps.some((s) => s.role === 'entity') && skipped.includes('لا جهة فنية لهذه الفئة'), `${id}: no technical entity — the entity step is listed as not applicable («لا جهة فنية لهذه الفئة»)`);
  await approve('P-SARA', id); await approve('P-GM', id); await approve('P-ASG', id);
  await openTask('P-MAJED', id); const chips = await p.locator('.split-detail .chips').textContent(); await shot('04-procurement-freedom');
  await procurement('P-MAJED', id, { pr: '10004603', est: 18000, offers: 2, evaluator: 'requester', why: 'لا جهة فنية؛ الطالب أقدر على تقييم جودة الترجمة' }); r = await req(id);
  ok('ق.ح-04-b', !chips.includes('الجهة الفنية للفئة') && chips.includes('مقدم الطلب') && chips.includes('جهة أسمّيها') && cur(r)?.role === 'evaluator' && cur(r).assigneeIds.join() === 'P-DEPT' && r.need.procurement.evaluator.why.includes('لا جهة فنية') && r.audit.some((a) => a.what.ar.includes('عُيِّن المقيّم')), `procurement freedom: no entity option; Majed named the requester as evaluator and the reason is recorded in the audit`);
  await evaluate('P-DEPT', id, 'العرض 2 — مكتب الترجمة المعتمد', 'جودة عينة الترجمة أعلى'); await budget('P-BUDG', id, 'FM-2026-0419'); await po('P-MAJED', id, '4500012903', in14); r = await req(id);
  ok('ق.ح-04-c', cur(r)?.role === 'receipt' && cur(r).assigneeIds.join() === 'P-DEPT', `the requester receives the service himself (receipt task with Abdulrahman)`);
  await receipt('P-DEPT', id, '1000004568'); r = await req(id);
  ok('ق.ح-04-d', r.status === 'completed' && r.need.procurement.serviceEntryNo === '1000004568', `service entry sheet 1000004568 → completed`);
}

/* ═══ ق.ح-05 فوق عتبة المناقصات + ق.ح-09-ج الإلغاء بعد أمر الشراء ═══ */
{
  const { id } = await createNeed('P-DEPT', { cat: 'خدمة تقنية', free: [{ name: 'منصة تحليلات مؤسسية (اشتراك 3 سنوات)', qty: 1 }], why: 'منصة موحدة للتقارير', est: 620000 });
  await approve('P-SARA', id); await approve('P-GM', id); await approve('P-ASG', id); await approve('P-ITM', id);
  await procurement('P-MAJED', id, { pr: '10004604', est: 620000, offers: 4, evaluator: 'entity', why: 'منصة تقنية' }); await evaluate('P-ITM', id, 'العرض 3', 'الأكثر توافقاً مع البنية'); let r = await req(id);
  const before = cur(r);
  await budget('P-BUDG', id, 'FM-2026-0420'); r = await req(id);
  ok('ق.ح-05-a', before?.role === 'budget' && cur(r)?.role === 'tender' && r.need.procurement.tender?.referred && (await notifs('P-DEPT', id)).some((n) => n.body.ar.includes('أُحيل إلى إجراء المناقصات')), `value 620,000 > 500,000: after budget confirmation the request is referred to the tender procedure and the requester is told «أُحيل إلى إجراء المناقصات»`);
  await openTask('P-MAJED', id); await shot('05-tender-panel'); await tender('P-MAJED', id, 'TND-2026-07', 'رست على العرض 3 بقيمة 598,000'); r = await req(id);
  ok('ق.ح-05-b', r.need.procurement.tender.ref === 'TND-2026-07' && cur(r)?.role === 'po' && (await notifs('P-DEPT', id)).some((n) => n.title.ar.includes('اكتمل إجراء المناقصات')), `tender TND-2026-07 recorded with its result → purchase order next; requester told`);
  await po('P-MAJED', id, '4500012904', in14); await asPerson('P-DEPT', `#/requests/${id}`); const stages = await p.locator('.need-stages').textContent(); await shot('05-request-tender-stage');
  ok('ق.ح-05-c', stages.includes('إجراء المناقصات') && stages.includes('TND-2026-07') && stages.includes('4500012904'), `the requester sees the tender stage with its reference and the PO`);
  /* ق.ح-09-ج: بعد أمر الشراء يطلب الإلغاء فيقرره مكتب المشتريات */
  const canBtn = p.locator('.btn', { hasText: 'طلب إلغاء الاحتياج' }); const hasCancel = await canBtn.count();
  await canBtn.click(); await p.waitForTimeout(600); await p.fill('#nc-reason', 'تغيّرت الحاجة بعد اعتماد منصة الأمانة الموحدة'); await shot('09c-cancel-sheet', false); await p.locator('.sheet .btn.primary', { hasText: 'إرسال طلب الإلغاء' }).click(); await p.waitForTimeout(700);
  r = await req(id); const majedTask = (await notifs('P-MAJED', id)).some((n) => n.title.ar.includes('إلغاء'));
  await asPerson('P-MAJED', '#/desk/procurement'); const deskTxt = await p.locator('.page').textContent(); await shot('09c-desk-cancel');
  await p.locator('.desk-row', { hasText: id }).first().click(); await p.waitForTimeout(600); await p.fill('#dk-cnote', 'أمر الشراء لم يُنفَّذ بعد؛ أُلغي لدى المورد'); await p.locator('.split-detail .btn.danger', { hasText: 'قبول الإلغاء' }).click(); await p.waitForTimeout(800); r = await req(id);
  ok('ق.ح-09-c', hasCancel === 1 && majedTask && deskTxt.includes('طلب الإلغاء عند المشتريات') && r.status === 'withdrawn' && r.need.cancel.accepted && r.need.lines[0].status === 'cancelled' && (await notifs('P-DEPT', id)).some((n) => n.title.ar.includes('أُلغي احتياجك')), `after the PO the requester asked to cancel → task/notice reached Majed and the desk shows «طلب الإلغاء عند المشتريات»; Majed accepted → withdrawn, line cancelled, requester told`);
}

/* ═══ ق.ح-06 توفر جزئي: شاشتان (غير متوفرتين) وحامل (متوفر) في طلب واحد ═══ */
{
  const { id } = await createNeed('P-DEPT', { cat: 'مادة تقنية', items: [{ id: 'M-100202', qty: 2 }, { id: 'M-100203' }], why: 'تجهيز مكتب المحلل الجديد', shotPrefix: '06-wizard' });
  let r = await req(id);
  ok('ق.ح-06-a', r.need.lines.length === 2 && r.need.lines[0].qty === 2 && r.need.lines[1].qty === 1, `${id}: two lines — monitors ×2 and stand ×1 (${linesOf(r)})`);
  await approve('P-SARA', id); await approve('P-GM', id); await approve('P-ASG', id); await approve('P-ITM', id);
  await openTask('P-STORE2', id); const monitorLine = await p.locator('.split-detail .np-line', { hasText: 'شاشة' }).textContent(); const reserveDisabled = await p.locator('.split-detail .np-line', { hasText: 'شاشة' }).locator('.pill', { hasText: 'حجز' }).isDisabled();
  await storeDecide('P-STORE2', id, { 'شاشة': 'purchase', 'حامل': 'reserve' }); r = await req(id); await shot('06-store-partial');
  ok('ق.ح-06-b', monitorLine.includes('المتاح: 0') && reserveDisabled && r.steps.find((s) => s.role === 'store').outcome === 'partial' && r.need.lines[0].status === 'purchasing' && r.need.lines[1].status === 'reserved' && cur(r)?.role === 'handover', `monitors «المتاح: 0» (reserve disabled) → to purchase; stand reserved → outcome «partial»; first the stock handover (${linesOf(r)})`);
  await handoverStart('P-STORE2', id); await signOnPhone('P-DEPT', id); r = await req(id);
  ok('ق.ح-06-c', r.status === 'in_review' && r.need.lines[1].status === 'delivered' && r.need.lines[0].status === 'purchasing' && cur(r)?.role === 'procurement' && (await getState()).custody.filter((c) => c.requestId === id).length === 1, `the stand was handed over and signed (custody 1) while the request stays open for the monitors — now with procurement (${linesOf(r)})`);
  await procurement('P-MAJED', id, { pr: '10004605', est: 2700, offers: 3, evaluator: 'entity', why: 'شاشات تقنية' }); await evaluate('P-ITS', id, 'العرض 1', 'مطابق'); await budget('P-BUDG', id, 'FM-2026-0421'); await po('P-MAJED', id, '4500012905', in14); await receipt('P-STORE2', id, '5000012346'); await handoverStart('P-STORE2', id); await signOnPhone('P-DEPT', id); r = await req(id); const cc = (await getState()).custody.filter((c) => c.requestId === id);
  ok('ق.ح-06-d', r.status === 'completed' && r.need.lines.every((l) => l.status === 'delivered') && r.docs.filter((d) => d.kind === 'issued').length === 2 && cc.length === 2, `after purchase, receipt and a second handover both lines are delivered → completed; two handover notes (${r.docs.filter((d) => d.kind === 'issued').map((d) => d.number).join(' ، ')}), custody entries ${cc.length}`);
  await asPerson('P-DEPT', `#/requests/${id}`); await shot('06-request-two-notes');
}

/* ═══ ق.ح-07 السلسلة إلى رأس القطاع — المحاكاة في مركز سياسة الاحتياج بأسمائها وأسبابها ═══ */
{
  await asAdmin('#/admin/need'); await p.locator('.segmented button', { hasText: 'المحاكاة' }).click(); await p.waitForTimeout(600);
  await p.selectOption('.ed-row select.select-in >> nth=0', 'P-DEPT'); await p.waitForTimeout(500); const simDept = await p.locator('.route-preview').textContent();
  await p.selectOption('.ed-row select.select-in >> nth=0', 'P-MONA'); await p.waitForTimeout(500); const gateMona = await p.locator('.notice.warn').textContent().catch(() => '');
  await p.selectOption('.ed-row select.select-in >> nth=0', 'P-ITM'); await p.waitForTimeout(500); const simIt = await p.locator('.route-preview').textContent(); const skIt = await p.locator('.rp-skipped').textContent().catch(() => ''); await shot('07-simulator');
  ok('ق.ح-07', simDept.includes('اعتماد المدير العام') && simDept.includes('عبدالله بن محمد العتيبي') && simDept.includes('اعتماد رأس القطاع') && simDept.includes('سعود') && !simDept.includes('اعتماد مدير الإدارة') && gateMona.includes('مدير إدارة') && simIt.includes('اعتماد المدير العام') && simIt.includes('عبدالعزيز بن خالد المطيري') && !simIt.includes('اعتماد مدير الإدارة'), `simulator: Abdulrahman's chain = GM (Abdullah) → sector head (Saud), never himself; Mona (section head) is gated «${gateMona.slice(0, 50)}»; the IT director's own technical request: his chain starts at the GM and the entity step goes to his specialist (he never approves his own request)${skIt ? ' · ' + skIt.slice(0, 60) : ''}`);
}

/* ═══ ق.ح-08 مكتب بلا مستودع: كرسي لفهد في أبوظبي ═══ */
{
  const { id, skipped } = await createNeed('P-DEPT', { beneficiaryId: 'P-FAHAD', cat: 'مادة عامة', items: [{ id: 'M-200301' }], why: 'كرسي لمكتب فهد في أبوظبي', shotPrefix: '08-wizard' });
  let r = await req(id);
  ok('ق.ح-08-a', r.need.siteId === 'abudhabi' && !r.need.storeId && !r.steps.some((s) => s.role === 'store') && skipped.includes('لا مستودع في مكتب أبوظبي') && r.need.lines[0].status === 'purchasing', `${id}: Abu Dhabi has no store → the store step and the stock handover are not applicable («${skipped.replace(/\s+/g, ' ').slice(0, 70)}…»); the line starts «purchasing»`);
  await approve('P-SARA', id); await approve('P-GM', id); await approve('P-ASG', id); await approve('P-GSM', id);
  await procurement('P-MAJED', id, { pr: '10004606', est: 950, offers: 2, evaluator: 'entity', why: 'أثاث' }); await evaluate('P-GSM', id, 'العرض 1', 'توريد إلى أبوظبي'); await budget('P-BUDG', id, 'FM-2026-0422'); await po('P-MAJED', id, '4500012906', in14); r = await req(id);
  ok('ق.ح-08-b', cur(r)?.role === 'receipt' && cur(r).assigneeIds.join() === 'P-AUH', `receipt task with Rashed, the Abu Dhabi receipt & handover officer`);
  await receipt('P-AUH', id, '5000012347'); await handoverStart('P-AUH', id); r = await req(id);
  ok('ق.ح-08-c', cur(r)?.role === 'handoverSign' && cur(r).assigneeIds.join() === 'P-FAHAD' && r.need.handover.startedBy === 'P-AUH', `Rashed received and started the handover → Fahad signs`);
  await signOnPhone('P-FAHAD', id, '08-fahad-sign'); r = await req(id); const c = (await getState()).custody.filter((x) => x.requestId === id);
  ok('ق.ح-08-d', r.status === 'completed' && c.length === 1 && c[0].personId === 'P-FAHAD' && r.need.handover.issuerPositionId === 'S-190', `Fahad signed → completed; custody for Fahad; issuer position S-190 (Abu Dhabi officer)`);
}

/* ═══ ق.ح-09 (أ، ب) الإعادة والسحب ═══ */
{
  const { id } = await createNeed('P-DEPT', { cat: 'مادة تقنية', items: [{ id: 'M-100206' }], why: 'جهاز عرض لقاعة الاجتماعات' });
  await approve('P-SARA', id); await approve('P-GM', id); await approve('P-ASG', id);
  await returnTask('P-ITM', id, 'حدد الدقة المطلوبة ونوع المدخلات'); let r = await req(id);
  await asPerson('P-DEPT', `#/requests/${id}`); const pg = await p.locator('.page').textContent(); await shot('09a-returned');
  ok('ق.ح-09-a', r.status === 'returned' && pg.includes('حدد الدقة المطلوبة') && pg.includes('استكمال وإعادة الإرسال') && (await notifs('P-DEPT', id)).some((n) => n.kind === 'status'), `IT returned the request with a note → status «returned», the note and the resubmit button on the requester's page`);
  const w = await createNeed('P-DEPT', { cat: 'مادة عامة', items: [{ id: 'M-200302' }], why: 'مكتب إضافي' });
  await approve('P-SARA', w.id); await asPerson('P-DEPT', `#/requests/${w.id}`); const wb = p.locator('.btn', { hasText: 'سحب الطلب' }); const canW = await wb.count(); await wb.click(); await p.waitForTimeout(700); r = await req(w.id);
  await asPerson('P-DEPT', `#/requests/${globalThis.R02}`); const noW = await p.locator('.btn', { hasText: 'سحب الطلب' }).count();
  ok('ق.ح-09-b', canW === 1 && r.status === 'withdrawn' && noW === 0, `before procurement the requester can withdraw (${w.id} → withdrawn); a completed/purchased need has no withdraw button`);
}

/* ═══ ق.ح-10 الطالب في الصورة: تنبيهات كل مرحلة، وتغيير الموعد المتوقع من المكتب ═══ */
{
  const id = globalThis.R02; const ns = await notifs('P-DEPT', id); const titles = ns.map((n) => n.title.ar);
  const stages = ['تحوّل إلى الشراء', '10004601', 'أكّدت الموازنة', '4500012901', 'وصلت المواد', 'سند التسليم'];
  const hit = stages.filter((k) => titles.some((t) => t.includes(k)));
  /* تغيير الموعد المتوقع على طلب جارٍ بأمر شراء: احتياج جديد يصل إلى أمر الشراء */
  const { id: id2 } = await createNeed('P-DEPT', { cat: 'مادة عامة', items: [{ id: 'M-200302' }], why: 'مكتب للموظف الجديد' });
  await approve('P-SARA', id2); await approve('P-GM', id2); await approve('P-ASG', id2); await approve('P-GSM', id2); await storeDecide('P-STORE1', id2, { 'مكتب': 'purchase' });
  await procurement('P-MAJED', id2, { pr: '10004607', est: 2200, offers: 2, evaluator: 'entity', why: 'أثاث' }); await evaluate('P-GSM', id2, 'العرض 1', 'مطابق'); await budget('P-BUDG', id2, 'FM-2026-0423'); await po('P-MAJED', id2, '4500012907', in14);
  const later = toISO(Date.now() + 28 * 86400000);
  await asPerson('P-MAJED', '#/desk/procurement'); await p.locator('.segmented button', { hasText: 'في الشراء' }).click(); await p.waitForTimeout(400); await p.locator('.desk-row', { hasText: id2 }).first().click(); await p.waitForTimeout(600);
  await p.fill('#dk-exp', later); await p.fill('#dk-why', 'تأخر الشحن من المورد أسبوعين'); await shot('10-desk-expected'); await p.locator('.split-detail .btn.soft', { hasText: 'حفظ' }).click(); await p.waitForTimeout(700);
  const r2 = await req(id2); const n2 = await notifs('P-DEPT', id2);
  await asPerson('P-DEPT', `#/requests/${id2}`); const pg = await p.locator('.need-stages').textContent(); await shot('10-request-expected');
  ok('ق.ح-10', hit.length === stages.length && r2.need.procurement.expectedAt === later && r2.need.procurement.expectedLog.length === 2 && n2.some((n) => n.title.ar.includes('تغيّر موعد توريد')) && pg.includes(later) && pg.includes('1 تغيير'), `the requester was notified at every stage of ${id} (${hit.join(' / ')}); Majed changed the expected date of ${id2} to ${later} with a reason → requester told «تغيّر موعد توريد…» and the request shows the new date with its change count`);
  globalThis.R10 = id2;
}

/* ═══ ق.ح-11 دمج احتياجين (كراسي) في طلب شراء واحد ═══ */
{
  const a = await createNeed('P-DEPT', { beneficiaryId: 'P-AHMED', cat: 'مادة عامة', items: [{ id: 'M-200301' }], why: 'كرسي لأحمد' });
  const s2 = await createNeed('P-DEPT', { beneficiaryId: 'P-SARA', cat: 'مادة عامة', items: [{ id: 'M-200301' }], why: 'كرسي لسارة' });
  for (const id of [a.id, s2.id]) { await approve('P-SARA', id); await approve('P-GM', id); await approve('P-ASG', id); await approve('P-GSM', id); await storeDecide('P-STORE1', id, { 'كرسي': 'purchase' }); }
  await procurement('P-MAJED', a.id, { pr: '10004608', est: 950, offers: 3, evaluator: 'entity', why: 'أثاث' });
  await openTask('P-MAJED', s2.id); const mergeOpts = await p.locator('#np-merge option').allTextContents(); await shot('11-merge-select');
  await procurement('P-MAJED', s2.id, { merge: '10004608', est: 950, offers: 3, evaluator: 'entity', why: 'دُمج مع احتياج أحمد — كراسي متطابقة' });
  const ra = await req(a.id); const rs = await req(s2.id);
  await asPerson('P-DEPT', `#/requests/${s2.id}`); const pg = await p.locator('.page').textContent(); await shot('11-merged-request');
  ok('ق.ح-11', mergeOpts.some((o) => o.includes('10004608') && o.includes(a.id)) && ra.need.procurement.prNo === '10004608' && rs.need.procurement.prNo === '10004608' && ra.id !== rs.id && cur(ra)?.role === 'evaluator' && cur(rs)?.role === 'evaluator' && pg.includes('مدمج مع') && pg.includes(a.id), `Majed merged Sara's chair into Ahmed's requisition 10004608 from the panel; both needs keep their own number and status and the request page shows «مدمج مع ${a.id}»`);
}

/* ═══ ق.ح-12 مركز سياسة الاحتياج: إضافة وإلغاء بتاريخ في إصدار مؤرخ، والطلبات الجارية تكمل بإصدارها، وفئة مادة بلا مستودع لا تُجدوَل ═══ */
{
  await asAdmin('#/admin/need'); await shot('12-policy-home');
  await p.locator('.ptl-card.new').click(); await p.waitForTimeout(800); const drafted = await p.locator('.ptl-card.draft').count();
  /* جهة فنية جديدة */
  await p.locator('.segmented button', { hasText: 'الجهات الفنية' }).click(); await p.waitForTimeout(400); await p.locator('.npc-add').click(); await p.waitForTimeout(600);
  await p.fill('.sheet .ed-row input >> nth=0', 'الأثاث والتجهيزات'); await p.fill('.sheet .ed-row input >> nth=1', 'Furniture & Fit-out'); await p.selectOption('.sheet select.select-in', 'S-1501'); await p.waitForTimeout(200); await shot('12-entity-sheet', false); await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  /* مستودع ثالث من قائمة النظام المرجعي */
  await p.locator('.segmented button', { hasText: 'المستودعات' }).click(); await p.waitForTimeout(400); await p.selectOption('.npc-add select', '1030'); await p.waitForTimeout(600); await p.selectOption('.sheet select.select-in', 'S-1302'); await p.waitForTimeout(200); await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  /* فئة «أثاث» بجهتها ومستودعها وعهدتها — أولاً بلا مستودع لاختبار منع الجدولة */
  await p.locator('.segmented button', { hasText: 'الفئات' }).click(); await p.waitForTimeout(400); await p.locator('.npc-add').click(); await p.waitForTimeout(600);
  await p.fill('.sheet .ed-row input >> nth=0', 'أثاث'); await p.fill('.sheet .ed-row input >> nth=1', 'Furniture');
  const selects = p.locator('.sheet select.select-in'); await selects.nth(0).selectOption({ label: 'الأثاث والتجهيزات' }); await selects.nth(1).selectOption(''); await p.locator('.sheet input.switch').check(); await p.fill('.sheet textarea >> nth=0', 'أثاث المكاتب: تعتمده جهة الأثاث ويُصرف من مستودع المطبوعات والهدايا.');
  await shot('12-category-sheet', false); await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  /* مقر جديد بمسؤول استلام */
  await p.locator('.segmented button', { hasText: 'المقرات' }).click(); await p.waitForTimeout(400); await p.locator('.npc-add').click(); await p.waitForTimeout(600);
  await p.fill('.sheet .ed-row input >> nth=0', 'مكتب مسقط'); await p.fill('.sheet .ed-row input >> nth=1', 'Muscat office'); await p.selectOption('.sheet select.select-in', 'S-2112'); await p.waitForTimeout(200); await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  /* إلغاء فئة بتاريخ */
  await p.locator('.segmented button', { hasText: 'الفئات' }).click(); await p.waitForTimeout(400); await p.locator('.pt-card', { hasText: 'مواد المراسم' }).click(); await p.waitForTimeout(600); await p.fill('.sheet input[type="date"]', tomorrow); await p.waitForTimeout(200); await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  /* رؤساء الأقسام يفتحون الاحتياج */
  await p.locator('.segmented button', { hasText: 'القواعد' }).click(); await p.waitForTimeout(400); await p.selectOption('.npc-rules select >> nth=0', 'section'); await p.waitForTimeout(300);
  const pendingTxt = await p.locator('.savebar .sb-n').textContent(); await p.fill('.savebar .sb-why', 'إضافة جهة الأثاث وفئتها ومستودع 1030 ومكتب مسقط، وإلغاء مواد المراسم، وفتح الاحتياج لرؤساء الأقسام'); await shot('12-savebar'); await p.locator('.savebar .btn.primary').click(); await p.waitForTimeout(800);
  await p.locator('.segmented button', { hasText: 'ماذا يتغير' }).click(); await p.waitForTimeout(500); const diffTxt = await p.locator('.page').textContent(); await shot('12-diff');
  /* الجدولة تُمنع: فئة مادة بلا مستودع */
  await p.locator('.btn.soft', { hasText: 'جدولة السريان' }).click(); await p.waitForTimeout(700); await p.fill('#nsc-from', today); await p.fill('#nsc-reason', 'تحديث سياسة الاحتياج بعد تجربة v0.9'); await p.fill('#nsc-ref', 'تعميم 2026/41');
  const blocked = await p.locator('.sheet .notice.danger').textContent().catch(() => ''); const disabled = await p.locator('.sheet .btn.primary').isDisabled(); await shot('12-schedule-blocked', false); await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  /* الإصلاح: مستودع الفئة 1030 ثم الجدولة */
  await p.locator('.segmented button', { hasText: 'الفئات' }).click(); await p.waitForTimeout(400); await p.locator('.pt-card', { hasText: 'أثاث' }).first().click(); await p.waitForTimeout(600); await p.locator('.sheet select.select-in').nth(1).selectOption('1030'); await p.waitForTimeout(200); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await p.fill('.savebar .sb-why', 'ربط فئة الأثاث بمستودع 1030'); await p.locator('.savebar .btn.primary').click(); await p.waitForTimeout(700);
  await p.locator('.btn.soft', { hasText: 'جدولة السريان' }).click(); await p.waitForTimeout(700); await p.fill('#nsc-from', today); await p.fill('#nsc-reason', 'تحديث سياسة الاحتياج بعد تجربة v0.9'); await p.fill('#nsc-ref', 'تعميم 2026/41'); const enabled = !(await p.locator('.sheet .btn.primary').isDisabled()); await shot('12-schedule-ok', false); await p.locator('.sheet .btn.primary').click(); await p.waitForTimeout(900);
  const st = await getState(); const v2 = st.needPolicy.versions.find((v) => v.id === 'V-2'); const need2 = v2?.content.need; const old = st.requests.find((r) => r.id === globalThis.R01);
  await asAdmin('#/admin/need'); await shot('12-policy-after');
  /* منى (رئيسة قسم) تفتح الاحتياج الآن، والفئة الملغاة تبقى في الطلبات القديمة وتختفي من المعالج غداً */
  await asPerson('P-MONA', '#/new/AS-01', ph); const monaOpens = await p.locator('.type-row').count(); const cats = await p.locator('.need-cats').textContent(); await shot('12-mona-opens-phone');
  ok('ق.ح-12', drafted === 1 && pendingTxt.length > 0 && diffTxt.includes('الأثاث والتجهيزات') && blocked.includes('فئة مادة بلا مستودع: أثاث') && disabled && enabled && v2 && v2.scheduled && v2.from === today && need2.entities.some((e) => e.name.ar === 'الأثاث والتجهيزات' && e.agent.positionIds.includes('S-1501')) && need2.categories.some((c) => c.name.ar === 'أثاث' && c.storeId === '1030' && c.custody) && need2.stores.some((s) => s.id === '1030') && need2.sites.some((s) => s.name.ar === 'مكتب مسقط' && s.receiverAgent?.positionIds.includes('S-2112')) && need2.categories.find((c) => c.id === 'protocolMaterial').endedAt === tomorrow && need2.rules.openerMinLevel === 'section' && v2.changes.length >= 8 && old.policyVersion === '2026.1' && monaOpens >= 6 && cats.includes('أثاث'), `draft 2026.2: new entity + category «أثاث» (entity, store 1030, custody) + store 1030 from the ERP list + site «مكتب مسقط» with a receiving officer + «مواد المراسم» end-dated ${tomorrow} + section heads may open — ${v2?.changes.length} logged changes; scheduling was blocked while «أثاث» had no store («${blocked.replace(/\s+/g, ' ').slice(0, 60)}»), then scheduled from ${today}; old requests keep 2026.1; Mona (section head) can now open a need and sees «أثاث»`);
}

/* ═══ ق.ح-13 التسليم على الهاتف (تم في ق.ح-01/06/08) + الطباعة ═══ */
{
  const r = await req(globalThis.R01);
  await asPerson('P-AHMED', `#/requests/${globalThis.R01}`, ph); await p.locator('.seal .seal-act').first().click(); await p.waitForTimeout(1000); const printBtn = await p.locator('.sheet .btn', { hasText: /طباعة|PDF|Print/ }).count(); const still = await p.locator('.print-portal, .print-only').count().catch(() => 0);
  ok('ق.ح-13', r.need.handover.startedBy === 'P-STORE2' && r.need.handover.signedBy === 'P-AHMED' && r.need.handover.signedAt > r.need.handover.startedAt && printBtn >= 1, `Hassan started from his desk, Ahmed signed on his phone (issuer ${r.need.handover.startedAt < r.need.handover.signedAt ? 'before' : 'after'} receiver); the note has a print button (${printBtn}) and the issue + custody happened in the same audit line`);
  await p.keyboard.press('Escape'); void still;
}

/* ═══ ق.ح-14 بوابة المستوى: الشاشات الجديدة هاتفاً وحاسوباً، عربية وإنجليزية، فاتحة وداكنة، مع تقليل الحركة ═══ */
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
      const ov = await q.evaluate(() => { const w = document.documentElement.clientWidth; const list = []; document.querySelectorAll('body *').forEach((el) => { const r = el.getBoundingClientRect(); if (r.width > 0 && (r.right > w + 1 || r.left < -1)) list.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ').filter(Boolean).slice(0, 2).join('.')}`); }); return { over: document.documentElement.scrollWidth > w + 1, list: list.slice(0, 4) }; });
      const empty = (await q.locator('.page').textContent().catch(() => '')).trim().length < 40;
      if (ov.over || empty) bad.push(`${name}/${vpName}/${lang}/${dark ? 'dark' : 'light'}: ${ov.over ? 'overflow ' + ov.list.join(',') : 'empty'}`);
      if ((lang === 'en' && !dark) || (lang === 'ar' && dark)) await q.screenshot({ path: `shots/v9/v9-14-${name}-${vpName}-${lang}-${dark ? 'dark' : 'light'}.png`, fullPage: true });
      await c2.close();
    }
  }
  ok('ق.ح-14', bad.length === 0, `${pages.length} new screens × phone/desktop × ar/en × light/dark(+reduced motion) = ${pages.length * 8} renders: no horizontal overflow, no empty page${bad.length ? ' — ' + bad.join('; ') : ''}`);
}

await ctx.close();
console.log(`\nerrors ${errs.length}`); errs.slice(0, 8).forEach((e) => console.log('  ' + e));
const pass = checks.filter((c) => c.pass).length; console.log(`\n${pass}/${checks.length} PASS`);
fs.writeFileSync('shots/v9/v9-results.json', JSON.stringify({ at: new Date().toISOString(), checks, errors: errs }, null, 2));
await b.close();
process.exit(pass === checks.length && errs.length === 0 ? 0 : 1);
