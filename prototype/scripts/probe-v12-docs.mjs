import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import path from 'node:path';
const file = 'file://' + path.resolve('dist/index.html');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const errs = [];
const vp = process.argv[2] === 'phone' ? { width: 400, height: 860 } : { width: 1440, height: 900 }; const tag = process.argv[2] === 'phone' ? 'ph' : 'lap';
const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2, colorScheme: process.argv[3] === 'dark' ? 'dark' : 'light' });
const p = await ctx.newPage(); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', (e) => errs.push(e.message));
await p.goto(file + '#/home', { waitUntil: 'load' }); await p.waitForTimeout(900);
const st = await p.evaluate(() => JSON.parse(localStorage.getItem('usp-portal-v1')));
const mutate = (fn) => p.evaluate((src) => { const s = JSON.parse(localStorage.getItem('usp-portal-v1')); (new Function('s', src))(s); localStorage.setItem('usp-portal-v1', JSON.stringify(s)); }, fn);
const go = async (who, hash) => { await mutate(`const w = s.people.find((x) => x.id === '${who}'); s.settings.persona = w ? w.persona : 'admin'; s.settings.actAs = ${who === 'admin' ? 'undefined' : `'${who}'`}; s.settings.lang = '${process.argv[4] || 'ar'}';`); await p.goto(file + hash); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1300); };
const shotSheet = async (name) => { await p.addStyleTag({ content: '.sheet{position:static!important;max-height:none!important;transform:none!important;box-shadow:none!important}' }); const el = p.locator('.sheet .doc-preview').first(); await el.scrollIntoViewIfNeeded(); await p.waitForTimeout(700); await el.screenshot({ path: `shots/v12/doc-${name}-${tag}.png` }); };
const last = st.requests.find((r) => r.need && (r.need.procurement?.receipts || []).length);
await go('P-DEPT', `#/requests/${last.id}`);
const open = p.locator('button, a', { hasText: 'افتح المستند' });
await open.first().click(); await p.waitForTimeout(1200); await shotSheet('inspection'); await p.keyboard.press('Escape'); await p.waitForTimeout(500); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1200);
await open.nth(1).click(); await p.waitForTimeout(1200); await shotSheet('handover'); await p.keyboard.press('Escape'); await p.waitForTimeout(500); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1200);
// leave decision: a completed leave of Ahmed
const lv = st.requests.find((r) => r.leave && r.status === 'completed' && r.docs.some((d) => d.kind === 'issued'));
await go(lv.requesterId, `#/requests/${lv.id}`);
await p.locator('button, a', { hasText: 'افتح المستند' }).first().click(); await p.waitForTimeout(1200); await shotSheet('decision');
// policy document
await go('admin', '#/admin/policy'); await p.locator('.ptl-card').first().click(); await p.waitForTimeout(600); await p.locator('.pv-line .btn.quiet').first().click().catch(() => {}); await p.waitForTimeout(1300); if (await p.locator('.sheet .doc-preview').count()) await shotSheet('policy');
console.log('errors', errs);
await b.close();
