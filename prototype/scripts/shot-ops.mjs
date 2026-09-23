// لقطات v0.4.2: التشغيل (النوافذ الموسمية والمجموعات)، والدورة التقويمية، والاستحقاقات الجديدة
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
  await p.evaluate(({ persona, lang, as }) => { const s = JSON.parse(localStorage.getItem('usp-portal-v1')); if (persona) s.settings.persona = persona; if (lang) s.settings.lang = lang; if (as) { for (const x of s.people) if (x.persona === 'employee') x.persona = 'x'; s.people.find((x) => x.id === as).persona = 'employee'; } localStorage.setItem('usp-portal-v1', JSON.stringify(s)); }, { persona: opts.persona, lang: opts.lang, as: opts.as });
  await p.goto(file + hash, { waitUntil: 'load' }); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1800);
  return { p, ctx, shot: async (n, full = false) => p.screenshot({ path: `dist/v42-${name}${n ? '-' + n : ''}.png`, fullPage: full }) };
}
const day = (p, n) => p.locator('.cal-day', { hasText: new RegExp(`^${n}$`) }).first();
const nextMonth = async (p) => { await p.locator('.cal-head .icon-btn[aria-label="next"]').click(); await p.waitForTimeout(500); };
const ph = { width: 400, height: 860 }; const lap = { width: 1440, height: 900 };
/* التشغيل على الحاسوب: فتح نافذة كونوا معهم وتعديل مجموعة */
{ const { p, ctx, shot } = await open('ops-desk', lap, '#/admin/policy', { persona: 'admin' });
  await p.locator('.segmented button', { hasText: 'التشغيل' }).click(); await p.waitForTimeout(900); await shot('1-closed', true);
  await p.locator('.cell.stacked input.switch').first().check(); await p.locator('input[type="date"]').first().fill('2026-09-13'); await p.locator('input[type="date"]').nth(1).fill('2026-09-24');
  await p.locator('.btn.soft', { hasText: 'تطبيق' }).click(); await p.waitForTimeout(1400); await shot('2-opened', true);
  await ctx.close(); }
/* بعد الفتح: أحمد (أب) يرى كونوا معهم متاحة */
{ const { p, ctx, shot } = await open('ahmed-after-open', ph, '#/new/TM-01', { touch: true });
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('usp-portal-v1')); s.policy.windows.withThem = { open: true, from: '2026-09-13', to: '2026-09-24', changedBy: 'P-OMAR', changedAt: Date.now() }; localStorage.setItem('usp-portal-v1', JSON.stringify(s)); });
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1500); await shot('picker', true);
  await p.locator('.type-row', { hasText: 'كونوا معهم' }).click(); await p.waitForTimeout(1200); await shot('withthem');
  await ctx.close(); }
/* أحمد قبل الفتح: كونوا معهم مطوية بسبب النافذة المغلقة */
{ const { p, ctx, shot } = await open('ahmed-closed', ph, '#/new/TM-01', { touch: true }); await p.locator('.section-label button').click(); await p.waitForTimeout(800); await p.evaluate(() => document.querySelector('.type-row.off')?.scrollIntoView({ block: 'center' })); await p.waitForTimeout(400); await shot('unavail'); await ctx.close(); }
/* فهد: إجازة سنوية 30 يوماً → تذاكر (خارج موطنه) + راتب مقدّم (عضو المجموعة) */
{ const { p, ctx, shot } = await open('fahad-30', lap, '#/new/TM-01', { as: 'P-FAHAD' });
  await p.locator('.type-hero').first().click(); await p.waitForTimeout(800); await p.locator('.btn.primary.block').click(); await p.waitForTimeout(900);
  await nextMonth(p); await day(p, 4).click(); await p.waitForTimeout(300); await nextMonth(p); await day(p, 2).click(); await p.waitForTimeout(2000); await shot('2-dates', true); await ctx.close(); }
/* سارة (أردنية في الرياض): تذاكر عند 5 أيام فأكثر؛ الدورة المرضية بسنوات تقويمية */
{ const { p, ctx, shot } = await open('sara-tickets', ph, '#/new/TM-01', { touch: true, as: 'P-SARA' });
  await p.locator('.type-hero').first().click(); await p.waitForTimeout(800); await p.locator('.btn.primary.block').click(); await p.waitForTimeout(900);
  await nextMonth(p); await day(p, 18).click(); await p.waitForTimeout(300); await day(p, 22).click(); await p.waitForTimeout(2000); await shot('2-dates', true); await ctx.close(); }
{ const { p, ctx, shot } = await open('sara-cycle', lap, '#/new/TM-01', { as: 'P-SARA' });
  await p.locator('.type-row').first().click(); await p.waitForTimeout(1200); await shot('sick-detail'); await ctx.close(); }
await b.close(); console.log('errors:', errs.length ? errs : 'none');
