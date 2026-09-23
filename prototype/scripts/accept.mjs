// سيناريوهات القبول المتبقية من بطاقة TM-01 §9: ق.ب-02 و03 و05 و15 — تُنفَّذ على البناء الحالي وتُثبَت بلقطات وتأكيدات نصية
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import path from 'node:path';
import fs from 'node:fs';
const file = 'file://' + path.resolve('dist/index.html');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
const errs = []; const results = [];
const ph = { width: 400, height: 860 }; const lap = { width: 1440, height: 900 };
const ok = (id, cond, detail) => { results.push({ id, pass: !!cond, detail }); console.log(`${cond ? 'PASS' : 'FAIL'} ${id}: ${detail}`); };

/* تواريخ السيناريوهات نسبةً إلى تاريخ اليوم (الرياض: الجمعة والسبت؛ العطلة 2026-09-23) */
const toISO = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
const fromISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = fromISO(s); d.setDate(d.getDate() + n); return toISO(d); };
const off = (s) => { const g = fromISO(s).getDay(); return g === 5 || g === 6 || s === '2026-09-23'; };
const addWD = (s, n) => { let d = s, k = 0; while (k < n) { d = addDays(d, 1); if (!off(d)) k++; } return d; };
const today = toISO(Date.now());
/* اليوم قد يكون عطلة (الجمعة/السبت)؛ عندها لا نهاية نافذة تساوي اليوم، فنأخذ أقرب نهاية نافذة في اليوم أو بعده (تبقى النافذة مفتوحة) */
let acceptTo = '', acceptLast = ''; for (let i = 40; i >= 0; i--) { const to = addDays(today, -i); const last = addWD(to, 10); if (last >= today) { acceptTo = to; acceptLast = last; break; } }
let blockTo = '', blockLast = ''; for (let i = 0; i < 40; i++) { const to = addDays(today, -i); const last = addWD(to, 10); if (last < today) { blockTo = to; blockLast = last; break; } }
const fromOf = (to) => addDays(to, -1);
console.log({ today, acceptTo, acceptLast, blockTo, blockLast });

async function open(name, vp, hash, opts = {}) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2, colorScheme: opts.dark ? 'dark' : 'light', hasTouch: !!opts.touch, isMobile: !!opts.touch });
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error') errs.push(name + ': ' + m.text()); });
  p.on('pageerror', (e) => errs.push(name + ': ' + e.message));
  await p.goto(file + '#/home', { waitUntil: 'load' }); await p.waitForTimeout(900);
  await setPersona(p, opts);
  await p.goto(file + hash, { waitUntil: 'load' }); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(opts.wait ?? 1500);
  return { p, ctx, shot: async (n, full = false) => p.screenshot({ path: `dist/accept-${name}${n ? '-' + n : ''}.png`, fullPage: full }) };
}
async function setPersona(p, { persona, lang, as } = {}) {
  await p.evaluate(({ persona, lang, as }) => {
    const s = JSON.parse(localStorage.getItem('usp-portal-v1'));
    if (persona) s.settings.persona = persona; if (lang) s.settings.lang = lang;
    if (as) { for (const x of s.people) if (x.persona === 'employee') x.persona = 'x'; s.people.find((x) => x.id === as).persona = 'employee'; }
    localStorage.setItem('usp-portal-v1', JSON.stringify(s));
  }, { persona, lang, as });
}
const day = (p, n) => p.locator('.cal-day', { hasText: new RegExp(`^${n}$`) }).first();
const nextMonth = async (p) => { await p.locator('.cal-head .icon-btn[aria-label="next"]').click(); await p.waitForTimeout(500); };
const prevMonth = async (p) => { await p.locator('.cal-head .icon-btn[aria-label="prev"]').click(); await p.waitForTimeout(500); };
/** ينتقل في التقويم إلى شهر التاريخ المطلوب ثم يضغط يومه */
async function pickDate(p, iso) {
  const target = fromISO(iso); const cur = new Date();
  let diff = (target.getFullYear() - cur.getFullYear()) * 12 + (target.getMonth() - cur.getMonth());
  while (diff > 0) { await nextMonth(p); diff--; } while (diff < 0) { await prevMonth(p); diff++; }
  await day(p, target.getDate()).click(); await p.waitForTimeout(350);
}
const checksText = async (p) => (await p.locator('.check').allTextContents()).join(' | ');

/* ق.ب-02: إجازة سنوية انتهت قبل 11 يوم عمل → مانع «النافذة» بذكر آخر يوم كان مسموحاً فيه */
{
  const { p, ctx, shot } = await open('qb02', ph, '#/new/TM-01', { touch: true });
  await p.locator('.type-hero').first().click(); await p.waitForTimeout(800); await p.locator('.btn.primary.block').click(); await p.waitForTimeout(900);
  await pickDate(p, fromOf(blockTo)); await pickDate(p, blockTo); await p.waitForTimeout(1800);
  const txt = await checksText(p); const disabled = await p.locator('.btn.primary.block').isDisabled();
  await p.evaluate(() => document.querySelector('.checks')?.scrollIntoView({ block: 'center' })); await p.waitForTimeout(400); await shot('block');
  ok('ق.ب-02', txt.includes('انتهت نافذة التقديم') && txt.includes(blockLast) && disabled, `to=${blockTo} → "${txt.match(/انتهت نافذة التقديم[^|]*/)?.[0]?.trim()}" · next disabled=${disabled}`);
  await ctx.close();
}
/* ق.ب-03: انتهت قبل 10 أيام عمل بالضبط → يُقبل ويُرسل */
{
  const { p, ctx, shot } = await open('qb03', ph, '#/new/TM-01', { touch: true });
  await p.locator('.type-hero').first().click(); await p.waitForTimeout(800); await p.locator('.btn.primary.block').click(); await p.waitForTimeout(900);
  await pickDate(p, fromOf(acceptTo)); await pickDate(p, acceptTo); await p.waitForTimeout(1800);
  const txt = await checksText(p); const enabled = !(await p.locator('.btn.primary.block').isDisabled());
  await p.evaluate(() => document.querySelector('.checks')?.scrollIntoView({ block: 'center' })); await p.waitForTimeout(400); await shot('checks');
  await p.locator('.btn.primary.block').click(); await p.waitForTimeout(800); await p.locator('.btn.primary.block').click(); await p.waitForTimeout(800); await p.locator('.btn.primary.block').click(); await p.waitForTimeout(2300);
  const id = (await p.locator('.success-id').textContent().catch(() => '')) || '';
  await shot('sent');
  ok('ق.ب-03', enabled && txt.includes('يمكن تقديم هذه الإجازة حتى') && txt.includes(acceptLast) && /^REQ-/.test(id), `to=${acceptTo} → "${txt.match(/يمكن تقديم[^|]*/)?.[0]?.trim()}" · sent ${id}`);
  await ctx.close();
}
/* ق.ب-05: إجازة اختبارات → مهمة للمدير، وبعد اعتماده مهمة لشؤون الموظفين */
{
  const { p, ctx, shot } = await open('qb05', lap, '#/new/TM-01', {});
  await p.locator('.type-row', { hasText: 'إجازة الاختبارات' }).click(); await p.waitForTimeout(800); await p.locator('.btn.primary.block').click(); await p.waitForTimeout(900);
  const examDay = addDays(today, 4); /* قبل إجازة أحمد السنوية الجارية (27 سبتمبر) حتى لا يتداخل */ await pickDate(p, examDay); await pickDate(p, examDay); await p.waitForTimeout(1500);
  await p.locator('.btn.primary.block').click(); await p.waitForTimeout(800);
  const tmp = path.resolve('dist/exam-proof.pdf'); fs.writeFileSync(tmp, '%PDF-1.4\n%demo\n');
  await p.locator('input[type="file"]').setInputFiles(tmp); await p.waitForTimeout(400);
  await p.locator('.btn.primary.block').click(); await p.waitForTimeout(800); await shot('review');
  await p.locator('.btn.primary.block').click(); await p.waitForTimeout(2300);
  const id = (await p.locator('.success-id').textContent().catch(() => '')) || '';
  // المدير: المهمة في مهامي
  await setPersona(p, { persona: 'manager' }); await p.goto(file + '#/inbox'); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1500);
  const rows = p.locator('.row .cell', { hasText: 'أحمد' }); const n = await rows.count(); let foundMgr = false;
  for (let i = 0; i < n; i++) { await rows.nth(i).click(); await p.waitForTimeout(700); const card = await p.locator('.split-detail .leave-card').textContent().catch(() => ''); const idTxt = await p.locator('.split-detail .mono').first().textContent().catch(() => ''); if (card.includes('الاختبارات') && idTxt.includes(id)) { foundMgr = true; break; } }
  const mgrStep = await p.locator('.split-detail .rail li.current .t').textContent().catch(() => '');
  await shot('manager');
  await p.locator('.split-detail .btn.primary.block', { hasText: 'اعتماد' }).click(); await p.waitForTimeout(1200);
  // شؤون الموظفين: المهمة التالية
  await setPersona(p, { persona: 'hr' }); await p.goto(file + '#/inbox'); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1500);
  const rows2 = p.locator('.row .cell', { hasText: 'أحمد' }); const n2 = await rows2.count(); let foundHr = false;
  for (let i = 0; i < n2; i++) { await rows2.nth(i).click(); await p.waitForTimeout(700); const idTxt = await p.locator('.split-detail .mono').first().textContent().catch(() => ''); if (idTxt.includes(id)) { foundHr = true; break; } }
  const hrStep = await p.locator('.split-detail .rail li.current .t').textContent().catch(() => '');
  const doneStep = await p.locator('.split-detail .rail li.done .s').nth(1).textContent().catch(() => '');
  await shot('hr');
  ok('ق.ب-05', foundMgr && mgrStep.includes('المدير المباشر') && foundHr && hrStep.includes('شؤون الموظفين'), `${id} · عند المدير: "${mgrStep}" · بعد اعتماده عند: "${hrStep}" (${doneStep.trim()})`);
  await ctx.close();
}
/* ق.ب-15: تواريخ تتداخل مع طلب جارٍ (إجازة أحمد السنوية 27 سبتمبر – 8 أكتوبر بانتظار المدير) */
{
  const { p, ctx, shot } = await open('qb15', ph, '#/new/TM-01', { touch: true });
  await p.locator('.type-hero').first().click(); await p.waitForTimeout(800); await p.locator('.btn.primary.block').click(); await p.waitForTimeout(900);
  await pickDate(p, '2026-10-05'); await pickDate(p, '2026-10-07'); await p.waitForTimeout(1800);
  const txt = await checksText(p); const disabled = await p.locator('.btn.primary.block').isDisabled();
  await p.evaluate(() => document.querySelector('.checks')?.scrollIntoView({ block: 'center' })); await p.waitForTimeout(400); await shot('block');
  ok('ق.ب-15', txt.includes('طلب إجازة جارٍ يتداخل') && txt.includes('2026-09-27') && disabled, `"${txt.match(/لديك طلب[^|]*/)?.[0]?.trim()}" · next disabled=${disabled}`);
  await ctx.close();
}
await b.close();
fs.writeFileSync('dist/accept-results.json', JSON.stringify({ today, results, errs }, null, 2));
console.log('errors:', errs.length ? errs : 'none');
console.log(results.every((r) => r.pass) ? 'ALL PASS' : 'SOME FAILED');
