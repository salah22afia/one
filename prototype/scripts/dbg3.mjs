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

{
  const { p, ctx, shot } = await open('vis', lap, '#/admin/policy', { persona: 'admin' });
  await p.locator('.ptl-card.new').click(); await p.waitForTimeout(900); await p.locator('.new-version .segmented button', { hasText: 'السياسة كلها' }).click(); await p.waitForTimeout(300); await p.locator('.new-version .btn.primary').click(); await p.waitForTimeout(1200);
  await p.locator('.pt-card.new').click(); await p.waitForTimeout(900); await shot('1-newtype');
  await p.locator('#nt-erp').selectOption('01|0530'); await p.waitForTimeout(400); await shot('2-newtype-picked');
  await p.locator('.sheet .icon-btn').first().click().catch(() => {}); await p.waitForTimeout(600);
  await p.locator('.pt-card', { hasText: 'الإجازة السنوية' }).click(); await p.waitForTimeout(900); await shot('3-editor');
  await p.locator('.sheet .icon-btn').first().click().catch(() => {}); await p.waitForTimeout(600);
  await p.locator('.pt-card.new').click(); await p.waitForTimeout(700); await p.locator('#nt-ar').fill('إجازة تفرغ'); await p.locator('#nt-en').fill('Sabbatical'); await p.locator('.sheet .btn.primary.block').click(); await p.waitForTimeout(1200); await shot('4-editor-unlinked');
  await p.locator('.sheet .icon-btn').first().click().catch(() => {}); await p.waitForTimeout(600);
  await p.locator('.section-head .btn.soft').click(); await p.waitForTimeout(900); await p.locator('#sc-from').fill(today); await p.waitForTimeout(300); await shot('5-sched-blocked');
  await ctx.close();
  const ph1 = await open('vis-phone', ph, '#/admin/policy', { persona: 'admin', touch: true });
  await ph1.p.locator('.ptl-card.new').click(); await ph1.p.waitForTimeout(900); await ph1.p.locator('.new-version .segmented button', { hasText: 'السياسة كلها' }).click(); await ph1.p.waitForTimeout(300); await ph1.p.locator('.new-version .btn.primary').click(); await ph1.p.waitForTimeout(1200);
  await ph1.p.locator('.pt-card.new').click(); await ph1.p.waitForTimeout(900); await ph1.p.locator('#nt-erp').selectOption('01|0530'); await ph1.p.waitForTimeout(400); await ph1.shot('1-newtype');
  await ph1.p.locator('.sheet .icon-btn').first().click().catch(() => {}); await ph1.p.waitForTimeout(600);
  await ph1.p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await ph1.p.waitForTimeout(800); await ph1.shot('2-list');
  await ph1.ctx.close();
}
await b.close();
