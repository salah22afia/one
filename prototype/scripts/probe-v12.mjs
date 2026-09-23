import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import path from 'node:path';
const file = 'file://' + path.resolve('dist/index.html');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const errs = [];
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, colorScheme: 'light' });
const p = await ctx.newPage(); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', (e) => errs.push(e.message));
await p.goto(file + '#/home', { waitUntil: 'load' }); await p.waitForTimeout(900);
const st = await p.evaluate(() => JSON.parse(localStorage.getItem('usp-portal-v1')));
const needs = st.requests.filter((r) => r.need);
const last = needs[0];
console.log('version', st.version, 'requests', st.requests.length, 'needs', needs.length);
for (const r of needs.slice(0, 2)) console.log(r.id, r.status, JSON.stringify(r.steps.map((s) => `${s.key}:${s.role || s.desk}:${s.status}${s.batch ? '#' + s.batch : ''}`)));
console.log('receipts', JSON.stringify((last.need.procurement.receipts || []).map((x) => ({ no: x.no, st: x.status, erp: x.erpNo, res: x.result, lines: x.lines })), null, 0));
console.log('lines', JSON.stringify(last.need.lines.map((l) => ({ id: l.id, st: l.status, qty: l.qty, rec: l.received, handed: l.handed }))));
console.log('handovers', JSON.stringify((last.need.handovers || []).map((h) => ({ no: h.number, b: h.batch, lines: h.lines }))));
console.log('docs', JSON.stringify(last.docs.map((d) => `${d.kind}:${d.type || ''}:${d.number || d.title.ar}`)));
console.log('po', last.need.procurement.poNo, last.need.procurement.poSource);
const mutate = (fn) => p.evaluate((src) => { const s = JSON.parse(localStorage.getItem('usp-portal-v1')); (new Function('s', src))(s); localStorage.setItem('usp-portal-v1', JSON.stringify(s)); }, fn);
await mutate(`s.settings.persona = 'manager'; s.settings.actAs = 'P-DEPT'; s.settings.lang = 'ar';`);
await p.goto(file + `#/requests/${last.id}`); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1300);
await p.screenshot({ path: 'shots/v12/probe-request.png', fullPage: true });
// open the inspection doc
const docBtns = p.locator('.seal .btn, .seal-act'); console.log('doc buttons', await docBtns.count());
const docsList = await p.locator('.doc-row, .docs .cell, [class*="doc"]').count(); console.log('doc-ish elements', docsList);
const txt = await p.locator('main.content').textContent(); console.log('has INS', txt.includes('INS-2026'), 'has ST', txt.includes('ST-2026'), 'progress', txt.includes('6 من 10') || txt.includes('6 / 10'));
// try clicking the first "افتح المستند"
const open = p.locator('button, a', { hasText: 'افتح المستند' }); console.log('open buttons', await open.count());
if (await open.count()) { await open.first().click(); await p.waitForTimeout(1500); await p.screenshot({ path: 'shots/v12/probe-doc1.png', fullPage: true }); const sheet = await p.locator('.sheet .doc-preview').textContent().catch(() => ''); console.log('sheet1', sheet.slice(0, 300)); await p.locator('.sheet .icon-btn').first().click().catch(() => {}); await p.waitForTimeout(500); }
if (await open.count() > 1) { await open.nth(1).click(); await p.waitForTimeout(1500); await p.screenshot({ path: 'shots/v12/probe-doc2.png', fullPage: true }); const sheet = await p.locator('.sheet .doc-preview').textContent().catch(() => ''); console.log('sheet2', sheet.slice(0, 300)); }
console.log('errors', errs);
await b.close();
