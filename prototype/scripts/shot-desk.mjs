import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import path from 'node:path';
const file = 'file://' + path.resolve('dist/index.html');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
const routes = [['home','#/home',null],['inbox','#/inbox','manager'],['services','#/services',null],['request','#/requests/REQ-2026-0387',null],['me','#/me',null],['requests','#/requests',null]];
for (const [name, hash, persona] of routes) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage(); await p.goto(file + hash, { waitUntil: 'load' }); await p.waitForTimeout(400);
  if (persona) { await p.evaluate((pk) => { const s = JSON.parse(localStorage.getItem('usp-portal-v1')); s.settings.persona = pk; localStorage.setItem('usp-portal-v1', JSON.stringify(s)); }, persona); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(400); }
  await p.screenshot({ path: `dist/desk-${name}.png` }); await ctx.close();
}
await b.close(); console.log('ok');
