// فحص سريع لـ v0.15: لقطات للمصمّم وصفحة الخدمة ونموذج الموظف، وأخطاء المتصفح
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import path from 'node:path';
import fs from 'node:fs';
const file = 'file://' + path.resolve('dist/index.html');
const OUT = process.argv[2] || 'shots/v15-probe'; fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const errors = [];
async function open(who, hash, vp = { width: 390, height: 844 }, lang = 'ar') {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2, hasTouch: vp.width < 600 });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  await p.goto(file + '#/home', { waitUntil: 'load' }); await p.waitForTimeout(400);
  await p.evaluate(({ who, lang }) => { const s = JSON.parse(localStorage.getItem('usp-portal-v1')); if (who === 'admin') { s.settings.persona = 'admin'; s.settings.actAs = undefined; } else { const w = s.people.find((x) => x.id === who); s.settings.persona = w.persona; s.settings.actAs = who; } s.settings.lang = lang; localStorage.setItem('usp-portal-v1', JSON.stringify(s)); }, { who, lang });
  await p.goto(file + hash); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1200);
  return { ctx, p };
}
const overflow = async (p) => p.evaluate(() => { const root = document.querySelector('.app-root') || document.body; const w = root.clientWidth; return Math.max(0, root.scrollWidth - w); });
{
  const { ctx, p } = await open('admin', '#/admin/designer', { width: 1440, height: 900 });
  await p.screenshot({ path: `${OUT}/01-designer-catalog-desk.png`, fullPage: true }); console.log('catalog overflow', await overflow(p));
  await p.getByRole('button', { name: /الخدمات المهيّأة/ }).click(); await p.waitForTimeout(600);
  await p.screenshot({ path: `${OUT}/02-designer-services-desk.png`, fullPage: true });
  await p.goto(file + '#/admin/designer/svc/DC-03'); await p.waitForTimeout(1500);
  await p.screenshot({ path: `${OUT}/03-service-basics-desk.png`, fullPage: true }); console.log('svc overflow', await overflow(p));
  await p.getByRole('button', { name: /النموذج/ }).first().click(); await p.waitForTimeout(600);
  await p.screenshot({ path: `${OUT}/04-service-form-desk.png`, fullPage: true });
  await p.getByRole('button', { name: /المسار/ }).first().click(); await p.waitForTimeout(600);
  await p.screenshot({ path: `${OUT}/05-service-route-desk.png`, fullPage: true });
  await ctx.close();
}
{
  const { ctx, p } = await open('admin', '#/admin/designer');
  await p.screenshot({ path: `${OUT}/06-designer-phone.png`, fullPage: true }); console.log('phone catalog overflow', await overflow(p));
  await p.goto(file + '#/admin/designer/svc/DC-03'); await p.waitForTimeout(1200);
  await p.getByRole('button', { name: /النموذج/ }).first().click(); await p.waitForTimeout(600);
  await p.screenshot({ path: `${OUT}/07-service-form-phone.png`, fullPage: true }); console.log('phone svc overflow', await overflow(p));
  await p.getByRole('button', { name: /المعاينة/ }).first().click(); await p.waitForTimeout(800);
  await p.screenshot({ path: `${OUT}/08-service-preview-phone.png`, fullPage: true });
  await ctx.close();
}
{
  const { ctx, p } = await open('P-AHMED', '#/services');
  await p.screenshot({ path: `${OUT}/09-services-phone.png`, fullPage: true });
  await p.goto(file + '#/new/DC-03'); await p.waitForTimeout(1200);
  await p.screenshot({ path: `${OUT}/10-dc03-form-phone.png`, fullPage: true }); console.log('form overflow', await overflow(p));
  await p.locator('.btn.primary.block').first().click(); await p.waitForTimeout(600);
  await p.screenshot({ path: `${OUT}/11-dc03-errors-phone.png`, fullPage: true });
  await ctx.close();
}
{
  const { ctx, p } = await open('P-AHMED', '#/new/DC-03', { width: 390, height: 844 }, 'en');
  await p.screenshot({ path: `${OUT}/12-dc03-form-en.png`, fullPage: true });
  await ctx.close();
}
console.log('errors', errors.length); for (const e of errors.slice(0, 8)) console.log('  ERR', e);
await b.close();
