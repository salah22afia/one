import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import path from 'node:path';
const file = 'file://' + path.resolve('dist/index.html');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 400, height: 860 }, hasTouch: true, isMobile: true });
const p = await ctx.newPage(); await p.goto(file + '#/home', { waitUntil: 'load' }); await p.waitForTimeout(1500);
console.log(await p.evaluate(() => { const b = document.querySelector('.waiting .n b'); const s = b && b.firstElementChild; return { b: b && getComputedStyle(b).fontSize, span: s && getComputedStyle(s).fontSize, html: b && b.outerHTML, cls: b && b.parentElement.className, rules: b && [...document.styleSheets].flatMap(ss => { try { return [...ss.cssRules]; } catch { return []; } }).filter(r => r.selectorText && r.selectorText.includes('.n b')).map(r => r.cssText) }; }));
await b.close();
