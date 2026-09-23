import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import path from 'node:path';
const file = 'file://' + path.resolve('dist/index.html');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 400, height: 860 }, hasTouch: true, isMobile: true });
const p = await ctx.newPage(); await p.goto(file + '#/home', { waitUntil: 'load' }); await p.waitForTimeout(1500);
await p.evaluate(() => window.scrollTo({ top: 220 })); await p.waitForTimeout(800);
console.log(await p.evaluate(() => { const e = document.querySelector('.home-bar'); return { exists: !!e, style: e && e.getAttribute('style'), op: e && getComputedStyle(e).opacity, rect: e && JSON.stringify(e.getBoundingClientRect()), scrollY: window.scrollY, docScroll: document.documentElement.scrollTop, bodyScroll: document.body.scrollTop, se: document.scrollingElement === document.documentElement }; }));
await b.close();
