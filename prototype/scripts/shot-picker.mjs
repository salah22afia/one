// لقطات v0.4.1: شاشة اختيار نوع الإجازة الجديدة
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import path from 'node:path';
const file = 'file://' + path.resolve('dist/index.html');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const errs = [];
async function open(name, vp, hash, opts = {}) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2, colorScheme: opts.dark ? 'dark' : 'light', hasTouch: !!opts.touch, isMobile: !!opts.touch });
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error') errs.push(name + ': ' + m.text()); }); p.on('pageerror', (e) => errs.push(name + ': ' + e.message));
  await p.goto(file + '#/home', { waitUntil: 'load' }); await p.waitForTimeout(800);
  await p.evaluate(({ persona, lang, as }) => { const s = JSON.parse(localStorage.getItem('usp-portal-v1')); if (persona) s.settings.persona = persona; if (lang) s.settings.lang = lang; if (as) { const who = s.people.find((x) => x.id === as); s.settings.persona = who.persona; s.settings.actAs = as; } localStorage.setItem('usp-portal-v1', JSON.stringify(s)); }, { persona: opts.persona, lang: opts.lang, as: opts.as });
  await p.goto(file + hash, { waitUntil: 'load' }); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1800);
  return { p, ctx, shot: async (n, full = false) => p.screenshot({ path: `dist/v41-${name}${n ? '-' + n : ''}.png`, fullPage: full }) };
}
const ph = { width: 400, height: 860 }; const lap = { width: 1440, height: 900 };
{ const { p, ctx, shot } = await open('ahmed-phone', ph, '#/new/TM-01', { touch: true }); await shot('picker', true);
  await p.locator('.section-label button').click(); await p.waitForTimeout(800); await shot('picker-unavail', true);
  await p.locator('.type-row').nth(1).click(); await p.waitForTimeout(1200); await shot('row-sheet'); await ctx.close(); }
{ const { p, ctx, shot } = await open('sara-phone-dark', ph, '#/new/TM-01', { touch: true, as: 'P-SARA', dark: true }); await shot('picker', true); await ctx.close(); }
{ const { p, ctx, shot } = await open('fahad-desk', lap, '#/new/TM-01', { as: 'P-FAHAD' }); await shot('picker', true);
  await p.locator('.type-hero').first().click(); await p.waitForTimeout(1000); await shot('picker-annual'); await ctx.close(); }
{ const { p, ctx, shot } = await open('ahmed-desk-en', lap, '#/new/TM-01', { lang: 'en' }); await p.locator('.type-row').nth(0).click(); await p.waitForTimeout(1000); await shot('picker-sick', true); await ctx.close(); }
{ const { p, ctx, shot } = await open('policy-desk', lap, '#/admin/policy', { persona: 'admin' }); await shot('types', true);
  await p.locator('.pt-card:not(.new)').nth(3).click(); await p.waitForTimeout(1000); await shot('editor'); await ctx.close(); }
{ const { p, ctx, shot } = await open('inbox-r4', lap, '#/inbox', { as: 'P-GM' }); /* v0.6: خطوة المدير العام عند شاغل منصبه لا عند شخصية المدير */ await p.locator('.row .cell', { hasText: 'خالد' }).first().click(); await p.waitForTimeout(1000); await p.evaluate(() => document.querySelector('.split-detail')?.scrollTo(0, 400)); await shot('khalid'); await ctx.close(); }
await b.close(); console.log('errors:', errs.length ? errs : 'none');
