import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import path from 'node:path';
const file = 'file://' + path.resolve('dist/index.html');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const errs = [];
async function shot(name, vp, hash, opts = {}) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2, hasTouch: !!opts.touch, isMobile: !!opts.touch });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(file + hash, { waitUntil: 'load' }); await p.waitForTimeout(800);
  await p.evaluate((pk) => { const s = JSON.parse(localStorage.getItem('usp-portal-v1')); s.settings.lang = 'en'; if (pk) s.settings.persona = pk; localStorage.setItem('usp-portal-v1', JSON.stringify(s)); }, opts.persona || null);
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1500);
  if (opts.run) await opts.run(p);
  await p.screenshot({ path: `dist/en-${name}.png` }); await ctx.close();
}
await shot('home-phone', { width: 400, height: 860 }, '#/home', { touch: true });
await shot('inbox-swipe', { width: 400, height: 860 }, '#/inbox', { touch: true, persona: 'manager', run: async (p) => { const box = await p.locator('.swipe-front').first().boundingBox(); const y = box.y + box.height / 2; const x0 = box.x + box.width - 30; await p.mouse.move(x0, y); await p.mouse.down(); await p.mouse.move(x0 - 20, y, { steps: 4 }); await p.mouse.move(x0 - 170, y, { steps: 16 }); await p.mouse.up(); await p.waitForTimeout(700); } });
await shot('home-desk', { width: 1440, height: 900 }, '#/home');
await shot('transition', { width: 1440, height: 900 }, '#/requests', { run: async (p) => { await p.evaluate(() => { location.hash = '#/requests/REQ-2026-0387'; }); await p.waitForTimeout(110); } });
await b.close(); console.log('errors:', errs.length ? errs : 'none');
