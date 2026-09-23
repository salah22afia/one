import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import path from 'node:path';
const file = 'file://' + path.resolve('dist/index.html');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
const errs = [];
async function shot(name, vp, hash, opts = {}) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 1, colorScheme: opts.dark ? 'dark' : 'light' });
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error') errs.push(name + ': ' + m.text()); });
  p.on('pageerror', (e) => errs.push(name + ': ' + e.message));
  await p.goto(file + hash, { waitUntil: 'load' }); await p.waitForTimeout(500);
  if (opts.persona) { await p.evaluate((pk) => { const s = JSON.parse(localStorage.getItem('usp-portal-v1')); s.settings.persona = pk; localStorage.setItem('usp-portal-v1', JSON.stringify(s)); }, opts.persona); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(500); }
  if (opts.click) { await p.click(opts.click); await p.waitForTimeout(600); }
  await p.screenshot({ path: `dist/shot-${name}.png`, fullPage: !!opts.full });
  await ctx.close();
}
const ph = { width: 400, height: 860 };
await shot('home-phone', ph, '#/home', { full: true });
await shot('inbox-manager-phone', ph, '#/inbox', { persona: 'manager', click: '.cell' });
await shot('services-phone', ph, '#/services', { full: true });
await shot('request-phone', ph, '#/requests/REQ-2026-0387', { full: true });
await shot('me-phone-dark', ph, '#/me', { dark: true, full: true });
await shot('new-phone', ph, '#/new/TM-01', { full: true });
await shot('home-desktop', { width: 1280, height: 900 }, '#/home');
await shot('design-desktop', { width: 1280, height: 900 }, '#/design', { full: true });
await b.close();
console.log('errors:', errs.length ? errs : 'none');
