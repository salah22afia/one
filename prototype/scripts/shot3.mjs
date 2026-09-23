import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import path from 'node:path';
const file = 'file://' + path.resolve('dist/index.html');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
const errs = [];
async function shot(name, vp, hash, opts = {}) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2, colorScheme: opts.dark ? 'dark' : 'light', hasTouch: !!opts.touch, isMobile: !!opts.touch });
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error') errs.push(name + ': ' + m.text()); });
  p.on('pageerror', (e) => errs.push(name + ': ' + e.message));
  await p.goto(file + hash, { waitUntil: 'load' }); await p.waitForTimeout(opts.wait ?? 1600);
  if (opts.persona) { await p.evaluate((pk) => { const s = JSON.parse(localStorage.getItem('usp-portal-v1')); s.settings.persona = pk; localStorage.setItem('usp-portal-v1', JSON.stringify(s)); }, opts.persona); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1600); }
  if (opts.run) await opts.run(p);
  await p.screenshot({ path: `dist/v3-${name}.png`, fullPage: !!opts.full });
  await ctx.close();
}
const ph = { width: 400, height: 860 };
await shot('home-phone', ph, '#/home', { full: true, touch: true });
await shot('home-phone-scrolled', ph, '#/home', { touch: true, run: async (p) => { await p.evaluate(() => window.scrollTo({ top: 220 })); await p.waitForTimeout(600); } });
await shot('inbox-phone', ph, '#/inbox', { persona: 'manager', touch: true });
await shot('inbox-phone-sheet', ph, '#/inbox', { persona: 'manager', touch: true, run: async (p) => { await p.click('.swipe-front'); await p.waitForTimeout(900); } });
await shot('services-phone', ph, '#/services', { full: true, touch: true });
await shot('request-phone', ph, '#/requests/REQ-2026-0387', { full: true, touch: true });
await shot('me-phone', ph, '#/me', { touch: true });
await shot('me-phone-dark', ph, '#/me', { dark: true, touch: true });
await shot('new-phone', ph, '#/new/TM-01', { touch: true });
await shot('home-desk', { width: 1440, height: 900 }, '#/home');
await shot('inbox-desk', { width: 1440, height: 900 }, '#/inbox', { persona: 'manager' });
await shot('services-desk', { width: 1440, height: 900 }, '#/services');
await shot('request-desk', { width: 1440, height: 900 }, '#/requests/REQ-2026-0387');
await shot('me-desk-dark', { width: 1440, height: 900 }, '#/me', { dark: true });
await b.close();
console.log('errors:', errs.length ? errs : 'none');
