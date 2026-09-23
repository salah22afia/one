import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import path from 'node:path';
const file = 'file://' + path.resolve('dist/index.html');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
async function shot(name, vp, hash, dark, persona) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 1, colorScheme: dark ? 'dark' : 'light' });
  const p = await ctx.newPage(); await p.goto(file + hash, { waitUntil: 'load' }); await p.waitForTimeout(400);
  if (persona) { await p.evaluate((pk) => { const s = JSON.parse(localStorage.getItem('usp-portal-v1')); s.settings.persona = pk; localStorage.setItem('usp-portal-v1', JSON.stringify(s)); }, persona); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(400); }
  await p.screenshot({ path: `dist/shot-${name}.png` }); await ctx.close();
}
await shot('home-dark', { width: 400, height: 860 }, '#/home', true);
await shot('home-manager', { width: 400, height: 860 }, '#/home', false, 'manager');
await shot('me-desktop', { width: 1280, height: 900 }, '#/me', false);
await b.close();
