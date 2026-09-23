// فحص سريع لـ v0.10: البذرة تُبنى بلا أخطاء، والاحتياجات المزروعة في مواضعها، ولوحات المهام الجديدة تُرسم
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import path from 'node:path';
const file = 'file://' + path.resolve('dist/index.html');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const errs = []; const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p = await ctx.newPage();
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', (e) => errs.push(e.message));
await p.goto(file + '#/home', { waitUntil: 'load' }); await p.waitForTimeout(1200);
const st = await p.evaluate(() => JSON.parse(localStorage.getItem('usp-portal-v1')));
console.log('version', st.version, 'requests', st.requests.length, 'erpSeq', st.erpSeq);
for (const r of st.requests.filter((r) => r.need)) { const cur = r.steps.find((s) => s.status === 'current'); console.log(r.id, r.status, cur ? `${cur.role}:${(cur.assigneeIds || []).join(',')}` : '-', 'PR', r.need.procurement?.prNo || '-', 'res', r.need.procurement?.reservation?.no || '-', r.need.lines.map((l) => `${l.name.ar}:${l.status}:${l.itemId || '-'}:${l.unitPrice || '-'}`).join(' | ')); }
const mutate = (fn) => p.evaluate((src) => { const s = JSON.parse(localStorage.getItem('usp-portal-v1')); (new Function('s', src))(s); localStorage.setItem('usp-portal-v1', JSON.stringify(s)); }, fn);
const as = async (id, hash) => { await mutate(`const w = s.people.find((x) => x.id === '${id}'); s.settings.persona = w.persona; s.settings.actAs = '${id}';`); await p.goto(file + hash); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1000); };
await as('P-DEPT', '#/new/AS-01'); await p.locator('.type-row', { hasText: 'مادة تقنية' }).click(); await p.waitForTimeout(500); await p.screenshot({ path: 'shots/probe-v10-wizard.png', fullPage: true });
console.log('catalog tiles', await p.locator('.need-k').count());
await as('P-MAJED', '#/inbox'); await p.locator('.split .row .cell').first().click(); await p.waitForTimeout(500); await p.screenshot({ path: 'shots/probe-v10-majed.png', fullPage: true });
await as('P-ITS', '#/inbox'); console.log('ITS tasks', await p.locator('.split .row').count()); await p.locator('.split .row .cell').first().click().catch(() => {}); await p.waitForTimeout(500); await p.screenshot({ path: 'shots/probe-v10-its.png', fullPage: true });
await as('P-DEPT', '#/requests/REQ-2026-0398'); await p.screenshot({ path: 'shots/probe-v10-req.png', fullPage: true });
await as('P-OMAR', '#/admin/need'); await mutate(`s.settings.persona='admin'; s.settings.actAs=undefined;`); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(900); await p.locator('.segmented button', { hasText: 'الكتالوج' }).click(); await p.waitForTimeout(400); await p.screenshot({ path: 'shots/probe-v10-policy.png', fullPage: true });
console.log('errors', errs.length, errs.slice(0, 5));
await b.close();
