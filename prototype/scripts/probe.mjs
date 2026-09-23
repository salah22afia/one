import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import path from 'node:path';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
const p = await b.newPage({ viewport: { width: 400, height: 860 } });
await p.goto('file://' + path.resolve('dist/index.html') + '#/requests/REQ-2026-0387', { waitUntil: 'load' }); await p.waitForTimeout(400);
const r = await p.evaluate(() => { const li = document.querySelector('.rail li'); const cs = getComputedStyle(li, '::before'); const l = li.getBoundingClientRect(); return { content: cs.content, pos: cs.position, top: cs.top, bottom: cs.bottom, left: cs.left, right: cs.right, width: cs.width, bg: cs.backgroundColor, display: cs.display, liH: l.height, insetInlineStart: cs.insetInlineStart, gridArea: cs.gridArea }; });
console.log(r); await b.close();
