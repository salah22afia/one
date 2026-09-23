// فحص سريع لـ v0.11: البذرة تُبنى بلا أخطاء، والاحتياج الموفَّر من رصيد الجهة في البذرة، والشاشات الجديدة تُرسم
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import path from 'node:path';
const file = 'file://' + path.resolve('dist/index.html');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
const errs = []; const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p = await ctx.newPage();
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', (e) => errs.push(e.message));
await p.goto(file + '#/home', { waitUntil: 'load' }); await p.waitForTimeout(900);
const st = await p.evaluate(() => JSON.parse(localStorage.getItem('usp-portal-v1')));
console.log('version', st.version, 'requests', st.requests.length, 'custody', st.custody.length, 'poolStock', JSON.stringify(st.erp.poolStock));
const prov = st.requests.filter((r) => r.need?.provision); console.log('provided needs', prov.map((r) => `${r.id}:${r.status}:${r.steps.map((s) => (s.role || s.key) + ':' + s.status).join(' ')}`));
const auto = st.requests.filter((r) => r.need?.procurement?.awardAuto); console.log('auto-award needs', auto.map((r) => `${r.id}:${r.status}:cur=${r.steps.find((s) => s.status === 'current')?.role}`));
const dig = st.custody.filter((c) => c.digital); console.log('digital custody', JSON.stringify(dig));
for (const hash of ['#/admin/need', '#/inbox', '#/me/custody']) { await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('usp-portal-v1')); s.settings.persona = 'admin'; s.settings.actAs = undefined; localStorage.setItem('usp-portal-v1', JSON.stringify(s)); }); await p.goto(file + hash); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(900); console.log(hash, (await p.locator('.page').textContent()).length); }
console.log('errors', errs.length, errs.slice(0, 5)); await b.close();
