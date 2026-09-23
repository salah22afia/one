// تحقق المختبر: لا فيض أفقي على عروض 360/390/400/430/768/1024/1440 (عربي وإنجليزي)، والحركة المخفَّضة تعمل بلا أخطاء، وكل الحالات تُفتح وتُغلق، وحجم الملف
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import path from 'node:path';
import fs from 'node:fs';
const file = 'file://' + path.resolve('dist/index.html');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
const errors = []; const rows = [];
async function open({ who = 'P-AHMED', width = 390, height = 844, lang = 'ar', reduced = false, dark = false }) {
  const ctx = await b.newContext({ viewport: { width, height }, deviceScaleFactor: 1, colorScheme: dark ? 'dark' : 'light', reducedMotion: reduced ? 'reduce' : 'no-preference', hasTouch: width < 600 });
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error') errors.push({ who, width, lang, text: m.text().slice(0, 200) }); });
  p.on('pageerror', (e) => errors.push({ who, width, lang, text: String(e).slice(0, 200) }));
  await p.goto(file + '#/home', { waitUntil: 'load' }); await p.waitForTimeout(400);
  await p.evaluate(({ who, lang }) => {
    const s = JSON.parse(localStorage.getItem('usp-portal-v1'));
    if (who === 'admin') { s.settings.persona = 'admin'; s.settings.actAs = undefined; } else { const w = s.people.find((x) => x.id === who); s.settings.persona = w.persona; s.settings.actAs = who; }
    s.settings.lang = lang; s.settings.theme = 'auto'; localStorage.setItem('usp-portal-v1', JSON.stringify(s)); 
  }, { who, lang });
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1500);
  return { ctx, p };
}
const over = async (p) => p.evaluate(() => {
  const root = document.querySelector('.app-root'); const bad = [];
  const clipped = (el) => { for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) { const o = getComputedStyle(a).overflowX; if (o === 'hidden' || o === 'clip' || o === 'auto' || o === 'scroll') return true; } return false; };
  for (const el of document.querySelectorAll('.lb-home *')) { if (el instanceof SVGElement && el.tagName !== 'svg') continue; const r = el.getBoundingClientRect(); if ((r.right > window.innerWidth + 1 || r.left < -1) && getComputedStyle(el).position !== 'fixed' && !clipped(el)) bad.push((el.getAttribute('class') || el.tagName).slice(0, 30)); }
  return { doc: document.documentElement.scrollWidth, root: root ? root.scrollWidth : 0, bad: bad.slice(0, 5) };
});
/* 1) الفيض الأفقي على كل العروض، عربي وإنجليزي، لكل الشخصيات */
for (const lang of ['ar', 'en']) for (const width of [360, 390, 400, 430, 768, 1024, 1440]) for (const who of ['P-AHMED', 'P-MONA', 'P-SARA', 'admin']) {
  const { ctx, p } = await open({ who, width, height: width < 600 ? 844 : 900, lang });
  const o = await over(p); rows.push({ check: 'overflow', lang, width, who, ok: o.doc <= width && o.root <= width && o.bad.length === 0, detail: `doc ${o.doc} root ${o.root} ${o.bad.join(',')}` });
  await ctx.close();
}
/* 1-ب) صفحات المختبر 0.3: لا فيض على الهاتف الضيق والعريض، عربيةً وإنجليزية */
for (const lang of ['ar', 'en']) for (const width of [360, 430]) for (const [who, hash] of [['P-MONA', '#/inbox'], ['P-AHMED', '#/requests'], ['P-AHMED', '#/services'], ['P-AHMED', '#/me'], ['P-AHMED', '#/me/docs'], ['P-AHMED', '#/notifications'], ['P-AHMED', '#/requests/REQ-2026-0391']]) {
  const { ctx, p } = await open({ who, width, height: 844, lang });
  await p.goto(file + hash); await p.waitForTimeout(1200);
  const o = await p.evaluate(() => { const root = document.querySelector('.app-root'); return { doc: document.documentElement.scrollWidth, root: root ? root.scrollWidth : 0 }; });
  rows.push({ check: 'page-overflow', lang, width, who: hash, ok: o.doc <= width && o.root <= width, detail: `doc ${o.doc} root ${o.root}` });
  await ctx.close();
}
/* 2) الحركة المخفَّضة: الرئيسية والعارض والقارئ واللوح تعمل */
for (const lang of ['ar', 'en']) {
  const { ctx, p } = await open({ width: 390, lang, reduced: true });
  const home = await p.locator('.lb-home').count(); rows.push({ check: 'reduced-home', lang, width: 390, who: 'P-AHMED', ok: home === 1, detail: `home ${home}` });
  await p.locator('.stry').first().click(); await p.waitForTimeout(500); const viewer = await p.locator('.stv').count(); await p.locator('.stv-x').click(); await p.waitForTimeout(300);
  await p.locator('.pc').first().click(); await p.waitForTimeout(500); const reader = await p.locator('.lb-sheet.reader').count(); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await p.locator('.lb-island').click(); await p.waitForTimeout(500); const sheet = await p.locator('.lb-sheet').count(); await p.keyboard.press('Escape'); await p.waitForTimeout(1200);
  const closed = await p.locator('.lb-sheet, .stv').count();
  rows.push({ check: 'reduced-states', lang, width: 390, who: 'P-AHMED', ok: viewer === 1 && reader === 1 && sheet === 1 && closed === 0, detail: `viewer ${viewer} reader ${reader} sheet ${sheet} left open ${closed}` });
  await ctx.close();
}
/* 3) الداكن + إنجليزي + حاسوب: العارض بالجيران، والبحث بالمفتاح */
{
  const { ctx, p } = await open({ width: 1440, height: 900, lang: 'en', dark: true });
  await p.locator('.stry').first().click(); await p.waitForTimeout(600); const peeks = await p.locator('.stv-peek').count(); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(500); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await p.keyboard.press('Meta+k'); await p.waitForTimeout(500); const search = await p.locator('#uspq').count(); await p.keyboard.press('Escape');
  rows.push({ check: 'desk-dark-en', lang: 'en', width: 1440, who: 'P-AHMED', ok: peeks >= 1 && search === 1, detail: `peeks ${peeks} search ${search}` });
  await ctx.close();
}
/* 4) تفاعل اللمس: النقر في العارض يتقدم، والسحب لأسفل يغلق */
{
  const { ctx, p } = await open({ width: 390, lang: 'ar' });
  await p.locator('.stry').first().click(); await p.waitForTimeout(600);
  const bars = await p.locator('.stv-bar').count(); await p.mouse.click(60, 500); await p.waitForTimeout(400);
  const idx = await p.evaluate(() => Array.from(document.querySelectorAll('.stv-bar i')).findIndex((i) => getComputedStyle(i).transform !== 'none' && !getComputedStyle(i).transform.startsWith('matrix(1,')));
  await p.mouse.move(195, 300); await p.mouse.down(); for (let i = 1; i <= 8; i++) { await p.mouse.move(195, 300 + i * 40); await p.waitForTimeout(16); } await p.mouse.up(); await p.waitForTimeout(1600);
  const closed = await p.locator('.stv').count();
  rows.push({ check: 'viewer-gestures', lang: 'ar', width: 390, who: 'P-AHMED', ok: bars >= 1 && closed === 0, detail: `bars ${bars} progressed-index ${idx} viewer left open ${closed}` });
  await ctx.close();
}
const size = fs.statSync('dist/artifact.html').size;
rows.push({ check: 'bundle', lang: '-', width: 0, who: '-', ok: size < 2.5e6, detail: `${Math.round(size / 1024)} KB (الميزانية 2.5 م.ب منذ v0.16 مع المصمّم الكامل والمستأجرين والعقود؛ حد النشر 16 م.ب)` });
fs.writeFileSync('shots/v13/verify.json', JSON.stringify({ rows, errors }, null, 2));
let fail = 0; for (const r of rows) { if (!r.ok) fail++; if (!r.ok || (r.check !== 'overflow' && r.check !== 'page-overflow')) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.check} ${r.lang} ${r.width} ${r.who}: ${r.detail}`); }
console.log(`overflow checks: ${rows.filter((r) => r.check === 'overflow').length} (${rows.filter((r) => r.check === 'overflow' && !r.ok).length} FAIL) · page overflow checks: ${rows.filter((r) => r.check === 'page-overflow').length} (${rows.filter((r) => r.check === 'page-overflow' && !r.ok).length} FAIL)`);
console.log(`TOTAL ${rows.length} checks · ${rows.length - fail} PASS / ${fail} FAIL · console errors ${errors.length}`); for (const e of errors.slice(0, 8)) console.log('  ', e.who, e.width, e.lang, e.text);
await b.close();
