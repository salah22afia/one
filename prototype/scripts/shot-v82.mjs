// v0.8.2 «سجل إجازاتي» (ق.أ-08): السجل بعين الموظف على الحاسوب والهاتف، والتصفية بالسنة والنوع، والدمج بلا تكرار، وربط السطر بطلبه، والمعاينة في ملفي، والرابط من طلباتي، والإنجليزية
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import path from 'node:path';
import fs from 'node:fs';
const file = 'file://' + path.resolve('dist/index.html');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
const errs = []; const checks = [];
const ok = (id, cond, detail) => { checks.push({ id, pass: !!cond, detail }); console.log(`${cond ? 'PASS' : 'FAIL'} ${id}: ${detail}`); };
const ph = { width: 400, height: 860 }; const lap = { width: 1440, height: 900 };
const toISO = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
const today = toISO(Date.now());
const AR = /[؀-ۿ]/;
async function open(name, vp, hash, opts = {}) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2, colorScheme: opts.dark ? 'dark' : 'light', hasTouch: !!opts.touch, isMobile: !!opts.touch });
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error') errs.push(name + ': ' + m.text()); });
  p.on('pageerror', (e) => errs.push(name + ': ' + e.message));
  await p.goto(file + '#/home', { waitUntil: 'load' }); await p.waitForTimeout(900);
  await setPersona(p, opts);
  await p.goto(file + hash, { waitUntil: 'load' }); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(opts.wait ?? 1500);
  return { p, ctx, shot: async (n, full = false) => p.screenshot({ path: `dist/v82-${name}${n ? '-' + n : ''}.png`, fullPage: full }) };
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
const getState = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('usp-portal-v1')));
const go = async (p, hash, wait = 1500) => { await p.goto(file + hash); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(wait); };

/* ═══ ١) السجل بعين أحمد (حاسوب): الملخص، والدمج، والحالات، والتصفية، وفتح الطلب ═══ */
{
  const { p, ctx, shot } = await open('hist', lap, '#/me/leaves', { persona: 'employee' });
  const s = await getState(p); const me = s.settings.actAs || 'P-AHMED';
  const myReqs = s.requests.filter((r) => r.requesterId === 'P-AHMED' && r.leave && !r.leave.cancelOf);
  const myAbs = s.absences.filter((a) => a.personId === 'P-AHMED');
  const rows = await p.locator('.lh-row').allTextContents(); const tiles = await p.locator('.lh-tiles .tile').allTextContents(); await shot('1-desk', true);
  const dup = myAbs.filter((a) => myReqs.some((r) => r.status === 'completed' && r.leave.typeId === a.typeId && r.leave.from === a.from && r.leave.to === a.to)).length;
  const expected = myReqs.filter((r) => r.leave.from.startsWith('2026')).length + myAbs.filter((a) => a.from.startsWith('2026')).length - dup;
  const statuses = rows.map((x) => ['أُخذت', 'جارية الآن', 'قادمة', 'قيد الاعتماد', 'مُعادة إليك', 'مرفوضة', 'مسحوبة', 'طلب إلغاء جارٍ', 'ملغاة'].find((k) => x.includes(k)) || '?');
  ok('ق.أ-08-a', rows.length === expected && rows.length >= 4 && tiles.length === 3 && rows.some((x) => x.includes('مسجَّلة في النظام المرجعي')) && rows.some((x) => x.includes('قيد الاعتماد')) && rows.some((x) => x.includes('REQ-')) && !statuses.includes('?'), `Ahmed's 2026 history merges ${myAbs.length} posted absences and ${myReqs.length} portal requests into ${rows.length} rows (expected ${expected}, ${dup} deduplicated): statuses ${JSON.stringify(statuses)}; tiles ${JSON.stringify(tiles.map((x) => x.replace(/\s+/g, ' ')))}`);
  // التصفية بالنوع: المرضية وحدها
  const chips = await p.locator('.lh-types .pill').allTextContents();
  await p.locator('.lh-types .pill', { hasText: 'الإجازة المرضية' }).click(); await p.waitForTimeout(700); const sickRows = await p.locator('.lh-row').allTextContents(); await shot('2-filter-sick', true);
  await p.locator('.lh-types .pill', { hasText: 'الكل' }).click(); await p.waitForTimeout(500);
  // كل السنوات (إن وُجد أكثر من سنة) ثم فتح سطر له طلب
  const yearSeg = await p.locator('#lh-year, .segmented').first().locator('button').allTextContents().catch(() => []);
  const linked = p.locator('a.lh-row').first(); const linkedTxt = await linked.textContent(); await linked.click(); await p.waitForTimeout(1200);
  const url = p.url(); const pageTxt = await p.locator('.page').textContent();
  ok('ق.أ-08-b', chips.length >= 3 && sickRows.length >= 2 && sickRows.every((x) => x.includes('الإجازة المرضية')) && url.includes('#/requests/REQ-') && pageTxt.includes('طلب إجازة'), `type chips (${chips.length}) filter to ${sickRows.length} sick rows; a row with a request opens it (${url.split('#')[1]}) · "${linkedTxt.slice(0, 60)}" · years ${JSON.stringify(yearSeg)}`);
  // المعاينة في ملفي والرابط من طلباتي
  await go(p, '#/me', 1500); const prevRows = await p.locator('#sec-leaves ~ * .lh-row, .me-cols .lh-row').allTextContents().catch(() => []); const viewAll = await p.locator('a.cell', { hasText: 'السجل كاملاً' }).count(); await shot('3-me-preview', true);
  await go(p, '#/requests', 1200); const link = await p.locator('.req-links a').textContent(); await p.locator('.req-links a').click(); await p.waitForTimeout(1000); const backTitle = await p.locator('.page h1, .large-title, .page').first().textContent();
  ok('ق.أ-08-c', prevRows.length === 3 && viewAll >= 1 && link.includes('سجل إجازاتي') && backTitle.includes('سجل إجازاتي'), `ملفي shows the latest 3 leaves + «السجل كاملاً»; طلباتي links to the history (${prevRows.length} preview rows)`);
  void me;
  await ctx.close();
}

/* ═══ ٢) الهاتف والإنجليزية والداكن ═══ */
{
  const { p, ctx, shot } = await open('phone', ph, '#/me/leaves', { persona: 'employee', touch: true });
  const w = await p.evaluate(() => document.documentElement.scrollWidth); await shot('1-phone', true);
  await p.locator('.lh-types .pill').nth(1).click().catch(() => {}); await p.waitForTimeout(500); await shot('2-phone-filter');
  await ctx.close();
  const { p: pe, ctx: ce, shot: se } = await open('en', lap, '#/me/leaves', { persona: 'employee', lang: 'en' });
  const enTxt = await pe.locator('.page').textContent(); await se('1-en', true);
  const enRows = await pe.locator('.lh-row').allTextContents();
  await ce.close();
  const { p: pd, ctx: cd, shot: sd } = await open('dark', lap, '#/me/leaves', { persona: 'employee', dark: true });
  await sd('1-dark', true); await cd.close();
  // ملفي على الهاتف داكناً (لقطة عمر): الرقاقة لا تزاحم التاريخ — لا عنصر يتجاوز حدود خليته
  const { p: pm, ctx: cm, shot: sm } = await open('phone-dark-me', ph, '#/me', { persona: 'employee', dark: true, touch: true });
  await pm.evaluate(() => document.querySelector('#sec-leaves')?.scrollIntoView()); await pm.waitForTimeout(600); await sm('1-me-leaves');
  const overlap = await pm.evaluate(() => Array.from(document.querySelectorAll('.lh-row')).map((row) => { const r = row.getBoundingClientRect(); const bad = Array.from(row.querySelectorAll('.lh-dates, .pill, .cell-title')).filter((el) => { const b = el.getBoundingClientRect(); return b.left < r.left - 1 || b.right > r.right + 1; }); const pill = row.querySelector('.pill')?.getBoundingClientRect(); const dates = row.querySelector('.lh-dates')?.getBoundingClientRect(); const cross = pill && dates ? !(pill.bottom <= dates.top || dates.bottom <= pill.top || pill.right <= dates.left || dates.right <= pill.left) : false; return { out: bad.length, cross }; }));
  await cm.close();
  ok('ق.أ-08-e', overlap.length >= 3 && overlap.every((o) => o.out === 0 && !o.cross), `on a dark phone the ملفي preview rows keep pill, title and dates inside the cell without overlap: ${JSON.stringify(overlap)}`);
  ok('ق.أ-08-d', w <= 400 && !AR.test(enTxt) && enRows.some((x) => x.includes('Taken')) && enRows.some((x) => x.includes('posted in the system of record')), `phone without horizontal overflow (scrollWidth=${w}); English screen has no Arabic (${enRows.length} rows)`);
}

await b.close();
fs.writeFileSync('dist/shot-v82-report.json', JSON.stringify({ checks, errs }, null, 2));
console.log(`\n${checks.filter((c) => c.pass).length}/${checks.length} passed · console errors: ${errs.length}`);
if (errs.length) console.log(errs.join('\n'));
