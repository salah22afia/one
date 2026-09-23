// لقطات وسيناريوهات v0.6 «مركز المسارات» (بطاقة CAP-01 §9: ق.م-01 … ق.م-13): محرر الخطوة، والهيكل والمناصب، والاستخراج بالأسباب، والنصاب، والشاغر، والشرط، وتغيير المسار والشاغل، ومهام التنفيذ
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import path from 'node:path';
import fs from 'node:fs';
const file = 'file://' + path.resolve('dist/index.html');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
const errs = []; const checks = [];
const ok = (id, cond, detail) => { checks.push({ id, pass: !!cond, detail }); console.log(`${cond ? 'PASS' : 'FAIL'} ${id}: ${detail}`); };
const ph = { width: 400, height: 860 }; const lap = { width: 1440, height: 900 };
const toISO = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
const fromISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = fromISO(s); d.setDate(d.getDate() + n); return toISO(d); };
const today = toISO(Date.now());
async function open(name, vp, hash, opts = {}) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2, colorScheme: opts.dark ? 'dark' : 'light', hasTouch: !!opts.touch, isMobile: !!opts.touch });
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error') errs.push(name + ': ' + m.text()); });
  p.on('pageerror', (e) => errs.push(name + ': ' + e.message));
  await p.goto(file + '#/home', { waitUntil: 'load' }); await p.waitForTimeout(900);
  await setPersona(p, opts);
  await p.goto(file + hash, { waitUntil: 'load' }); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(opts.wait ?? 1500);
  return { p, ctx, shot: async (n, full = false) => p.screenshot({ path: `dist/v6-${name}${n ? '-' + n : ''}.png`, fullPage: full }) };
}
async function setPersona(p, { persona, lang, as, mutate } = {}) {
  await p.evaluate(({ persona, lang, as, mutate }) => {
    const s = JSON.parse(localStorage.getItem('usp-portal-v1'));
    if (persona) { s.settings.persona = persona; s.settings.actAs = undefined; } if (lang) s.settings.lang = lang;
    if (as) { const who = s.people.find((x) => x.id === as); s.settings.persona = who.persona; s.settings.actAs = as; }
    if (mutate) { const f = new Function('s', mutate); f(s); }
    localStorage.setItem('usp-portal-v1', JSON.stringify(s));
  }, { persona, lang, as, mutate });
}
const go = async (p, hash, wait = 1500) => { await p.goto(file + hash); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(wait); if (hash.startsWith('#/new/')) resetCal(); };
const seg = (p, label) => p.locator('.policy .segmented button', { hasText: label }).first();
const day = (p, n) => p.locator('.cal-day', { hasText: new RegExp(`^${n}$`) }).first();
/** التقويم يحتفظ بالشهر المعروض بين اللمستين، فنتابع الشهر الحالي في المتغير calCur (يُعاد إلى شهر اليوم عند فتح شاشة الإجازة) */
let calCur = { y: new Date().getFullYear(), m: new Date().getMonth() };
const resetCal = () => { calCur = { y: new Date().getFullYear(), m: new Date().getMonth() }; };
async function pickDate(p, iso) {
  const target = fromISO(iso);
  let diff = (target.getFullYear() - calCur.y) * 12 + (target.getMonth() - calCur.m);
  while (diff > 0) { await p.locator('.cal-head .icon-btn[aria-label="next"]').click(); await p.waitForTimeout(400); diff--; }
  while (diff < 0) { await p.locator('.cal-head .icon-btn[aria-label="prev"]').click(); await p.waitForTimeout(400); diff++; }
  calCur = { y: target.getFullYear(), m: target.getMonth() };
  await day(p, target.getDate()).click(); await p.waitForTimeout(350);
}
/** يقدّم طلب إجازة من الشاشة: النوع، والتواريخ، والمرفق إن لزم، والاستحقاقات المختارة، ويعيد رقم الطلب */
async function submitLeave(p, { typeText, from, to, ents = [], hero = false }) {
  await go(p, '#/new/TM-01', 1400);
  if (hero) await p.locator('.type-hero', { hasText: typeText }).first().click(); else await p.locator('.type-row', { hasText: typeText }).first().click();
  await p.waitForTimeout(800); await p.locator('.btn.primary.block').click(); await p.waitForTimeout(900);
  await pickDate(p, from); if (to !== from) await pickDate(p, to); await p.waitForTimeout(1500);
  for (const e of ents) { await p.locator('.ent-cell', { hasText: e }).locator('input.checkbox').check(); await p.waitForTimeout(300); }
  await p.locator('.btn.primary.block').click(); await p.waitForTimeout(800);
  if (await p.locator('input[type="file"]').count()) { const tmp = path.resolve('dist/proof.pdf'); fs.writeFileSync(tmp, '%PDF-1.4\n%demo\n'); await p.locator('input[type="file"]').setInputFiles(tmp); await p.waitForTimeout(400); }
  await p.locator('.btn.primary.block').click(); await p.waitForTimeout(800);
  await p.locator('.btn.primary.block').click(); await p.waitForTimeout(2300);
  return (await p.locator('.success-id').textContent().catch(() => '')) || '';
}
/** يفتح مهمة طلب معيّن في صندوق الشخص الحالي (حاسوب) */
async function openTask(p, id) {
  await go(p, '#/inbox', 1500);
  const rows = p.locator('.row .cell'); const n = await rows.count();
  for (let i = 0; i < n; i++) { await rows.nth(i).click(); await p.waitForTimeout(600); const idTxt = await p.locator('.split-detail .mono').first().textContent().catch(() => ''); if (idTxt.includes(id)) return true; }
  return false;
}
const railText = async (p, sel = '.split-detail') => (await p.locator(`${sel} .rail li`).allTextContents()).map((x) => x.trim().replace(/\s+/g, ' '));
const sel = (p, label) => p.locator(`label:has-text("${label}")`).first().locator('select');

/* ═══ ٧) الموظف يعرف أن طلبه اعتُمد (ق.م-17، سؤال عمر): «جديد لك» في الرئيسية، ونص التنبيه، وفتحه يقرؤه ويذهب إلى الطلب؛ والترحيل بالرمز في سجل الطلب (ق.م-16-d) ═══ */
{
  const { p, ctx, shot } = await open('news', lap, '#/home', { persona: 'employee', mutate: "s.balances['P-AHMED'].annual = 45; s.notifications = s.notifications.map((n) => ({ ...n, read: true }));" });
  const id = await submitLeave(p, { typeText: 'الإجازة السنوية', from: addDays(today, 40), to: addDays(today, 44), hero: true });
  await go(p, '#/home', 1500); const news0 = await p.locator('.area-news .cell').allTextContents();
  await setPersona(p, { persona: 'manager' }); const fm = await openTask(p, id); console.log('fm', fm, id); await shot('dbg-mgr', true); console.log((await p.locator('.split-detail').textContent().catch(() => 'NO DETAIL')).slice(0, 200)); await p.locator('.split-detail .btn.primary.block', { hasText: 'اعتماد' }).click({ timeout: 8000 }); await p.waitForTimeout(1200);
  await setPersona(p, { persona: 'employee' }); await go(p, '#/home', 1500); await shot('1-home-step-approved', true);
  const news1 = await p.locator('.area-news .cell').allTextContents();
  await setPersona(p, { persona: 'employee' }); await go(p, `#/requests/${id}`, 1200); console.log('RAIL', await railText(p, '.page'));
  await setPersona(p, { persona: 'hr' }); const fh = await openTask(p, id); console.log('fh', fh); await shot('dbg-hr', true); console.log('rows', await p.locator('.row .cell').allTextContents()); console.log((await p.locator('.split-detail').textContent().catch(() => 'NO DETAIL')).slice(0, 300)); console.log('btns', await p.locator('.split-detail .btn').allTextContents()); await p.locator('.split-detail .btn.primary.block', { hasText: 'اعتماد' }).click({ timeout: 8000 }); await p.waitForTimeout(1500);
  await setPersona(p, { persona: 'employee' }); await go(p, '#/home', 1500); await shot('2-home-approved', true);
  const news2 = await p.locator('.area-news .cell').allTextContents();
  ok('ق.م-17-a', fm && fh && news0.some((x) => x.includes('استلمنا طلب إجازة')) && news1.some((x) => x.includes('اعتُمد طلب إجازة') && x.includes('اعتماد المدير المباشر') && x.includes('اعتمده') && x.includes('الخطوة الأخيرة')) && news2.some((x) => x.includes('اعتُمدت إجازتك: الإجازة السنوية') && x.includes('صدر قرار الإجازة')), `Home «جديد لك» after each decision: received → step approved by the manager (last step left) → leave approved with the decision number: ${JSON.stringify(news2.map((x) => x.slice(0, 50)))}`);
  await p.locator('.area-news .cell', { hasText: 'اعتُمدت إجازتك' }).first().click(); await p.waitForTimeout(1300); await shot('3-request-approved', true);
  const url = p.url(); const reqTxt = await p.locator('.page').textContent(); const audit = await p.locator('.page main .cell').allTextContents();
  await go(p, '#/home', 1200); const news3 = await p.locator('.area-news .cell').allTextContents();
  await go(p, '#/notifications', 1200); const notifTxt = await p.locator('.page').textContent();
  ok('ق.م-17-b', url.includes(`#/requests/${id}`) && reqTxt.includes('مكتمل') && reqTxt.includes('قرار إجازة') && news3.length === news2.length - 1 && notifTxt.includes('اعتُمدت إجازتك'), `opening the item goes to the request (completed, decision issued), marks it read (${news2.length} → ${news3.length}), and it stays in the notifications list`);
  ok('ق.م-16-d', audit.some((x) => x.includes('سُجِّل الغياب في النظام المرجعي') && x.includes('نوع الغياب 0100')), `the system step posts by the H4S4 code, not the name: "${audit.find((x) => x.includes('النظام المرجعي'))?.slice(0, 90)}"`);
  // الهاتف: القسم نفسه يظهر تحت بطاقة «بانتظارك»
  const ph1 = await open('news-phone', ph, '#/home', { persona: 'employee', touch: true, mutate: "s.notifications = s.notifications.map((n) => ({ ...n, read: true })); s.notifications.unshift({ id: 'N-DEMO', to: 'P-AHMED', kind: 'document', at: Date.now(), title: { ar: 'اعتُمدت إجازتك: الإجازة السنوية', en: 'Your leave is approved: Annual leave' }, body: { ar: '2026-11-01 → 2026-11-05 (5 أيام) · صدر قرار الإجازة رقم LD-2026-0001 وسُجِّلت في النظام المرجعي.', en: '' }, link: '#/requests', read: false });" });
  const phTxt = await ph1.p.locator('.area-news').textContent().catch(() => ''); await ph1.shot('1', true);
  const w = await ph1.p.evaluate(() => document.documentElement.scrollWidth);
  ok('ق.م-17-phone', phTxt.includes('جديد لك') && phTxt.includes('اعتُمدت إجازتك') && w <= 400, `phone Home shows «جديد لك» with the approval (scrollWidth=${w})`);
  await ph1.ctx.close();
  await ctx.close();
}

await b.close();
fs.writeFileSync('dist/v64-results.json', JSON.stringify({ today, checks, errs }, null, 2));
console.log('errors:', errs.length ? errs : 'none');
console.log(checks.every((r) => r.pass) ? 'ALL PASS' : 'SOME FAILED');
