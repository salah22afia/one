// لقطات المختبر وقياس طول الرئيسية وأخطاء المتصفح: هاتف/حاسوب × شخصيات × عربي/إنجليزي × فاتح/داكن، وحالات (العارض، القارئ، لوح المختبر، إطار الهاتف)
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import path from 'node:path';
import fs from 'node:fs';
const file = 'file://' + path.resolve('dist/index.html');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
const OUT = process.argv[2] || 'shots/v13'; fs.mkdirSync(OUT, { recursive: true });
const errors = []; const results = [];
const PH = { width: 390, height: 844 }, DK = { width: 1440, height: 900 };
async function open({ who = 'P-AHMED', vp = PH, dark = false, lang = 'ar', hash = '#/home', phone = false }) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2, colorScheme: dark ? 'dark' : 'light', hasTouch: vp.width < 600 });
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error') errors.push({ who, vp: vp.width, text: m.text().slice(0, 200) }); });
  p.on('pageerror', (e) => errors.push({ who, vp: vp.width, text: String(e).slice(0, 200) }));
  await p.goto(file + '#/home', { waitUntil: 'load' }); await p.waitForTimeout(500);
  await p.evaluate(({ who, lang, phone }) => {
    const s = JSON.parse(localStorage.getItem('usp-portal-v1'));
    if (who === 'admin') { s.settings.persona = 'admin'; s.settings.actAs = undefined; } else { const w = s.people.find((x) => x.id === who); s.settings.persona = w.persona; s.settings.actAs = who; }
    s.settings.lang = lang; s.settings.theme = 'auto'; s.settings.phoneFrame = phone; localStorage.setItem('usp-portal-v1', JSON.stringify(s));
  }, { who, lang, phone });
  await p.goto(file + hash); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1900);
  return { ctx, p };
}
async function measure(p, name, vp) {
  const r = await p.evaluate(() => { const home = document.querySelector('.lb-home'); const h = home ? home.getBoundingClientRect().height : 0; return { h: Math.round(h), doc: document.documentElement.scrollHeight, sw: document.documentElement.scrollWidth }; });
  results.push({ name, homeHeight: r.h, docHeight: r.doc, viewport: vp.height, screens: +(r.doc / vp.height).toFixed(2), scrollWidth: r.sw, overflow: r.sw > vp.width });
  return r;
}
/* الشخصيات على الهاتف والحاسوب */
for (const who of ['P-AHMED', 'P-MONA', 'P-DEPT', 'P-SARA', 'P-MAJED', 'admin']) {
  for (const [vp, tag] of [[PH, 'phone'], [DK, 'desk']]) {
    const { ctx, p } = await open({ who, vp });
    await measure(p, `${who}-${tag}`, vp);
    await p.screenshot({ path: `${OUT}/${who}-${tag}.png`, fullPage: true });
    await p.screenshot({ path: `${OUT}/${who}-${tag}-fold.png` });
    await ctx.close();
  }
}
/* داكن وإنجليزي على الهاتف والحاسوب (أحمد) */
for (const [vp, tag] of [[PH, 'phone'], [DK, 'desk']]) {
  let o = await open({ vp, dark: true }); await measure(o.p, `dark-${tag}`, vp); await o.p.screenshot({ path: `${OUT}/dark-${tag}.png`, fullPage: true }); await o.ctx.close();
  o = await open({ vp, lang: 'en' }); await measure(o.p, `en-${tag}`, vp); await o.p.screenshot({ path: `${OUT}/en-${tag}.png`, fullPage: true }); await o.ctx.close();
}
/* الحالات: عارض القصص، والقارئ مع تأكيد الاطلاع، ولوح المختبر، والمبادئ، وجزيرة البحث، والمؤلّف (سارة)، وإطار الهاتف على الحاسوب */
{
  const { ctx, p } = await open({});
  await p.locator('.stry').first().click(); await p.waitForTimeout(900); await p.screenshot({ path: `${OUT}/state-story-viewer-phone.png` });
  await p.mouse.click(60, 500); await p.waitForTimeout(700); await p.screenshot({ path: `${OUT}/state-story-viewer-phone-2.png` });
  await p.locator('.stv-x').click(); await p.waitForTimeout(500);
  await p.locator('.pc').first().click(); await p.waitForTimeout(900); await p.screenshot({ path: `${OUT}/state-reader-phone.png` });
  await p.locator('.rd-x').click(); await p.waitForTimeout(500);
  /* تعميم يطلب تأكيد الاطلاع */
  await p.locator('.pc:has(.pc-ack > *)').first().scrollIntoViewIfNeeded(); await p.locator('.pc:has(.pc-ack > *)').first().click(); await p.waitForTimeout(900); await p.screenshot({ path: `${OUT}/state-reader-circular-phone.png` });
  const rd = p.locator('.lb-sheet.reader'); await rd.evaluate((el) => el.scrollTo(0, el.scrollHeight)); await p.waitForTimeout(400); await p.screenshot({ path: `${OUT}/state-reader-phone-bottom.png` });
  const ackBtn = p.locator('.rd-ack .btn.primary'); if (await ackBtn.count()) { await ackBtn.click(); await p.waitForTimeout(1200); await p.screenshot({ path: `${OUT}/state-reader-phone-acked.png` }); }
  await p.locator('.rd-x').click(); await p.waitForTimeout(600); await p.screenshot({ path: `${OUT}/state-home-after-ack-phone.png`, fullPage: true });
  await p.locator('.lb-island').click(); await p.waitForTimeout(700); await p.fill('#uspq', 'إجازة'); await p.waitForTimeout(400); await p.screenshot({ path: `${OUT}/state-search-phone.png` });
  await p.keyboard.press('Escape'); await p.waitForTimeout(500);
  await p.goto(file + '#/me/settings'); await p.waitForTimeout(1200); await p.screenshot({ path: `${OUT}/state-settings-phone.png`, fullPage: true });
  await p.goto(file + '#/home'); await p.waitForTimeout(1200);
  /* التمرير: الشريط العلوي الزجاجي وتصاغر شريط الألسنة */
  await p.evaluate(() => window.scrollTo({ top: 420 })); await p.waitForTimeout(700); await p.screenshot({ path: `${OUT}/state-scrolled-phone.png` });
  await ctx.close();
}
{
  const { ctx, p } = await open({ who: 'P-MEDM' });
  await p.locator('.stry.add').click(); await p.waitForTimeout(800); await p.screenshot({ path: `${OUT}/state-composer-phone.png` });
  await p.locator('.lb-cover-pick').nth(2).click(); await p.fill('.lb-field textarea', 'اجتماع فريق التمكين الرقمي صباح اليوم'); await p.locator('.lb-sheet .btn.primary').click(); await p.waitForTimeout(900); await p.screenshot({ path: `${OUT}/state-composer-published-phone.png` });
  await ctx.close();
}
{
  const { ctx, p } = await open({ vp: DK });
  await p.locator('.stry').first().click(); await p.waitForTimeout(900); await p.screenshot({ path: `${OUT}/state-story-viewer-desk.png` });
  if (await p.locator('.stv-peek.next').count()) { await p.locator('.stv-peek.next').click(); await p.waitForTimeout(900); await p.screenshot({ path: `${OUT}/state-story-viewer-desk-2.png` }); }
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  await p.locator('.pc').first().click(); await p.waitForTimeout(900); await p.screenshot({ path: `${OUT}/state-reader-desk.png` });
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  await ctx.close();
}
{
  const { ctx, p } = await open({ vp: DK, phone: true });
  await p.screenshot({ path: `${OUT}/state-phone-frame-desk.png` });
  await p.locator('.app-root').evaluate((el) => el.scrollTo({ top: 380 })); await p.waitForTimeout(700); await p.screenshot({ path: `${OUT}/state-phone-frame-desk-scrolled.png` });
  await p.locator('.stry').first().click(); await p.waitForTimeout(900); await p.screenshot({ path: `${OUT}/state-phone-frame-desk-story.png` });
  await ctx.close();
}
fs.writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, errors }, null, 2));
for (const r of results) console.log(`${r.overflow ? 'FAIL' : 'PASS'} ${r.name}: doc ${r.docHeight}px = ${r.screens} screens · home ${r.homeHeight}px · scrollWidth ${r.scrollWidth}`);
console.log(`console errors: ${errors.length}`); for (const e of errors.slice(0, 10)) console.log('  ', e.who, e.vp, e.text);
await b.close();
