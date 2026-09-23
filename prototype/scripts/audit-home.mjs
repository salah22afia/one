// تدقيق الرئيسية الحالية (v0.12) قبل مختبر التصميم: لقطات كاملة الطول وقياس طول الصفحة لكل شخصية
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import path from 'node:path';
import fs from 'node:fs';
const file = 'file://' + path.resolve('dist/index.html');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
fs.mkdirSync('shots/audit-home', { recursive: true });
const out = [];
for (const [who, label] of [['P-AHMED', 'employee'], ['P-DEPT', 'manager'], ['P-MAJED', 'buyer'], ['admin', 'admin']]) {
  for (const [vp, tag] of [[{ width: 390, height: 844 }, 'phone'], [{ width: 1440, height: 900 }, 'desk']]) {
    for (const dark of [false, true]) {
      if (dark && tag === 'desk') continue;
      const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2, colorScheme: dark ? 'dark' : 'light' });
      const p = await ctx.newPage();
      await p.goto(file + '#/home', { waitUntil: 'load' }); await p.waitForTimeout(600);
      await p.evaluate((id) => { const s = JSON.parse(localStorage.getItem('usp-portal-v1')); if (id === 'admin') { s.settings.persona = 'admin'; s.settings.actAs = undefined; } else { const w = s.people.find((x) => x.id === id); s.settings.persona = w.persona; s.settings.actAs = id; } localStorage.setItem('usp-portal-v1', JSON.stringify(s)); }, who);
      await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1800);
      const h = await p.evaluate(() => document.documentElement.scrollHeight);
      const sections = await p.evaluate(() => Array.from(document.querySelectorAll('.home > *')).map((el) => ({ cls: el.className.toString().slice(0, 40), h: Math.round(el.getBoundingClientRect().height), txt: (el.textContent || '').trim().slice(0, 50) })));
      const name = `${label}-${tag}${dark ? '-dark' : ''}`;
      await p.screenshot({ path: `shots/audit-home/${name}.png`, fullPage: true });
      await p.screenshot({ path: `shots/audit-home/${name}-fold.png`, fullPage: false });
      out.push({ name, height: h, viewport: vp.height, screens: +(h / vp.height).toFixed(2), sections });
      await ctx.close();
    }
  }
}
fs.writeFileSync('shots/audit-home/summary.json', JSON.stringify(out, null, 2));
for (const o of out) console.log(o.name, 'height', o.height, '=', o.screens, 'screens');
await b.close();
