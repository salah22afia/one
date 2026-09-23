import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import path from 'node:path';
const file = 'file://' + path.resolve('dist/index.html');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
const errs = [];
async function shot(name, vp, opts = {}) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2, colorScheme: opts.dark ? 'dark' : 'light' });
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error') errs.push(name + ': ' + m.text()); });
  p.on('pageerror', (e) => errs.push(name + ': ' + e.message));
  await p.goto(file + '#/home', { waitUntil: 'load' }); await p.waitForTimeout(600);
  await p.screenshot({ path: `dist/hero-${name}.png`, clip: opts.clip });
  await ctx.close();
}
await shot('desk', { width: 1440, height: 900 }, { clip: { x: 0, y: 0, width: 1440, height: 420 } });
await shot('phone', { width: 400, height: 860 }, { clip: { x: 0, y: 0, width: 400, height: 360 } });
await shot('desk-dark', { width: 1440, height: 900 }, { dark: true, clip: { x: 0, y: 0, width: 1440, height: 420 } });
await b.close();
console.log('errors:', errs.length ? errs : 'none');
