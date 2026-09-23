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


{
  const { id } = await createNeed('P-DEPT', { cat: 'خدمة تقنية', free: [{ name: 'رخصة برنامج التحليل الإحصائي', qty: 10 }], why: 'رخص لفريق التحليل', est: 45000 });
  await approve('P-SARA', id); await approve('P-GM', id); await approve('P-ASG', id); await approve('P-ITM', id);
  let r = await req(id); console.log('cur', cur(r)?.role, cur(r)?.assigneeIds, 'entity', r.need.entityId, 'est', r.need.estimatedValue);
  await openTask('P-MAJED', id);
  const dis = async (l) => console.log(l, 'disabled', await p.locator('.split-detail .btn.primary').last().isDisabled());
  await p.fill('#np-pr', '10004602'); await dis('pr'); await p.fill('#np-est', '45000'); await dis('est'); await p.fill('#np-offers', '3'); await dis('offers');
  await p.fill('#np-evalwhy', 'x'); await dis('why (entity default)');
  await p.locator('.split-detail .chips .pill', { hasText: 'مقدم الطلب' }).click(); await p.waitForTimeout(200); await dis('requester chip');
  console.log('chips', await p.locator('.split-detail .chips .pill').allTextContents());
  await p.locator('.split-detail .chips .pill', { hasText: 'الجهة الفنية للفئة' }).click(); await p.waitForTimeout(200);
  await p.fill('#np-evalwhy', 'x');
  console.log('vals', await p.evaluate(() => ['np-pr','np-est','np-offers','np-evalwhy'].map((k) => k + '=' + document.getElementById(k)?.value)));
  console.log('disabled', await p.locator('.split-detail .btn.primary').last().isDisabled(), await p.locator('.split-detail .btn.primary').allTextContents());
  await shot('dbg-proc');
}
await ctx.close(); await b.close();
