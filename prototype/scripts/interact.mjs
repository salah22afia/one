import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import path from 'node:path';
const file = 'file://' + path.resolve('dist/index.html');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const errs = [];
async function page(vp, hash, opts = {}) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2, hasTouch: !!opts.touch, isMobile: !!opts.touch, colorScheme: opts.dark ? 'dark' : 'light' });
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(file + hash, { waitUntil: 'load' }); await p.waitForTimeout(1200);
  if (opts.persona) { await p.evaluate((pk) => { const s = JSON.parse(localStorage.getItem('usp-portal-v1')); s.settings.persona = pk; localStorage.setItem('usp-portal-v1', JSON.stringify(s)); }, opts.persona); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1200); }
  return { p, ctx };
}
const ph = { width: 400, height: 860 };
// (a) swipe reveal on phone
{
  const { p, ctx } = await page(ph, '#/inbox', { touch: true, persona: 'manager' });
  const row = await p.locator('.swipe-front').first(); const box = await row.boundingBox();
  const y = box.y + box.height / 2; const x0 = box.x + 40;
  await p.mouse.move(x0, y); await p.mouse.down(); for (let i = 1; i <= 12; i++) { await p.mouse.move(x0 + i * 14, y); await p.waitForTimeout(16); } await p.mouse.up();
  await p.waitForTimeout(700); await p.screenshot({ path: 'dist/i-swipe.png' });
  // tap approve
  await p.locator('.swipe-act.ok').first().click(); await p.waitForTimeout(500); await p.screenshot({ path: 'dist/i-island.png' });
  await p.waitForTimeout(600); await p.screenshot({ path: 'dist/i-after.png' });
  await ctx.close();
}
// (c) desktop palette
{
  const { p, ctx } = await page({ width: 1440, height: 900 }, '#/home');
  await p.click('#deskq'); await p.keyboard.type('إجازة'); await p.waitForTimeout(500); await p.screenshot({ path: 'dist/i-palette.png' });
  await p.keyboard.press('Enter'); await p.waitForTimeout(900); await p.screenshot({ path: 'dist/i-palette-go.png' });
  await ctx.close();
}
// (d) new request → success
{
  const { p, ctx } = await page(ph, '#/new/DC-01', { touch: true });
  await p.selectOption('#f-to', { index: 0 }).catch(() => {});
  await p.fill('#f-to', 'بنك الرياض'); await p.selectOption('#f-lang', 'العربية'); await p.selectOption('#f-salary', 'نعم');
  await p.click('.btn.primary'); await p.waitForTimeout(800); await p.screenshot({ path: 'dist/i-review.png' });
  await p.click('.btn.primary'); await p.waitForTimeout(1900); await p.screenshot({ path: 'dist/i-success.png' });
  await ctx.close();
}
// (e) card flip
{
  const { p, ctx } = await page(ph, '#/me', { touch: true });
  await p.locator('.idcard-tilt').tap(); await p.waitForTimeout(900); await p.screenshot({ path: 'dist/i-flip.png' });
  await ctx.close();
}
// (f) page transition mid-flight (desktop): home → request detail
{
  const { p, ctx } = await page({ width: 1440, height: 900 }, '#/requests');
  await p.evaluate(() => { location.hash = '#/requests/REQ-2026-0387'; }); await p.waitForTimeout(120); await p.screenshot({ path: 'dist/i-transition.png' });
  await ctx.close();
}
await b.close(); console.log('errors:', errs.length ? errs : 'none');
