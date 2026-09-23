import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import path from 'node:path';
const file = 'file://' + path.resolve('dist/index.html');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const errs = [];
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, colorScheme: 'light' });
const p = await ctx.newPage(); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', (e) => errs.push(e.message));
await p.goto(file + '#/home', { waitUntil: 'load' }); await p.waitForTimeout(900);
const mutate = (fn) => p.evaluate((src) => { const s = JSON.parse(localStorage.getItem('usp-portal-v1')); (new Function('s', src))(s); localStorage.setItem('usp-portal-v1', JSON.stringify(s)); }, fn);
const go = async (who, hash) => { await mutate(`const w = s.people.find((x) => x.id === '${who}'); s.settings.persona = w.persona; s.settings.actAs = '${who}'; s.settings.lang = 'ar';`); await p.goto(file + hash); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1300); };
await go('P-STORE2', '#/inbox');
const rows = p.locator('.split .row'); const n = await rows.count(); console.log('rows', n);
for (let i = 0; i < n; i++) { await rows.nth(i).locator('.cell').click(); await p.waitForTimeout(450); const txt = await p.locator('.split-detail .mono').first().textContent().catch(() => ''); if (txt.trim() === 'REQ-2026-0400') break; }
await p.locator('.split-detail').screenshot({ path: 'shots/v12/probe-receipt-panel.png' });
await p.fill('#rec-del-L1', '4'); await p.fill('#rec-acc-L1', '3'); await p.locator('.split-detail select.np-rec-result').selectOption('short'); await p.waitForTimeout(200); await p.fill('#rec-note-L1', 'واحدة تالفة الغلاف');
await p.locator('#np-rec-preview').click(); await p.waitForTimeout(1200);
await p.locator('.split-detail').screenshot({ path: 'shots/v12/probe-receipt-preview.png' });
console.log('errors', errs);
await b.close();
