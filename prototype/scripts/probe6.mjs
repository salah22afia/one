import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import path from 'node:path';
const file = 'file://' + path.resolve('dist/index.html');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const errs = [];
for (const rm of ['reduce', 'no-preference']) {
  const ctx = await b.newContext({ viewport: { width: 400, height: 860 }, reducedMotion: rm, hasTouch: true, isMobile: true });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(rm + ': ' + e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(rm + ': ' + m.text()); });
  for (const h of ['#/home', '#/inbox', '#/services', '#/services/TM', '#/requests', '#/requests/REQ-2026-0387', '#/new/TM-01', '#/me', '#/notifications', '#/design']) { await p.goto(file + h, { waitUntil: 'load' }); await p.waitForTimeout(700); }
  // navigate via hash changes (transitions) without reload
  for (const h of ['#/home', '#/requests', '#/requests/REQ-2026-0387', '#/requests', '#/services', '#/services/TM', '#/services', '#/me', '#/design', '#/me', '#/home']) { await p.evaluate((x) => { location.hash = x; }, h); await p.waitForTimeout(450); }
  await p.evaluate(() => history.back()); await p.waitForTimeout(500);
  console.log(rm, 'ok, waiting count =', await p.evaluate(() => document.querySelector('.waiting .n b')?.textContent));
  await ctx.close();
}
await b.close(); console.log('errors:', errs.length ? errs : 'none');
