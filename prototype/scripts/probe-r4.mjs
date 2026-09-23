import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import path from 'node:path';
const file = 'file://' + path.resolve('dist/index.html');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await (await b.newContext()).newPage();
await p.goto(file + '#/home', { waitUntil: 'load' }); await p.waitForTimeout(800);
const out = await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('usp-portal-v1')); const r = s.requests.find((x) => x.id === 'REQ-2026-0392'); return { version: s.version, steps: r.steps.map((st) => `${st.desk}${st.notifyOnly ? '(notify)' : ''}:${st.status}`), r4: s.policy.versions[0].content.routes[3].steps.map((x) => `${x.desk}${x.notifyOnly ? '(notify)' : ''}`) }; });
console.log(JSON.stringify(out, null, 1)); await b.close();
