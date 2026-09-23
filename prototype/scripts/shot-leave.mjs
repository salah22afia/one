// لقطات v0.4: معالج الإجازة ومركز السياسات — هاتف وحاسوب، عربي وإنجليزي، فاتح وداكن
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import path from 'node:path';
const file = 'file://' + path.resolve('dist/index.html');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
const errs = [];
const ph = { width: 400, height: 860 }; const lap = { width: 1440, height: 900 };
async function open(name, vp, hash, opts = {}) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2, colorScheme: opts.dark ? 'dark' : 'light', hasTouch: !!opts.touch, isMobile: !!opts.touch });
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error') errs.push(name + ': ' + m.text()); });
  p.on('pageerror', (e) => errs.push(name + ': ' + e.message));
  await p.goto(file + '#/home', { waitUntil: 'load' }); await p.waitForTimeout(900);
  await p.evaluate(({ persona, lang, as }) => {
    const s = JSON.parse(localStorage.getItem('usp-portal-v1'));
    if (persona) s.settings.persona = persona; if (lang) s.settings.lang = lang;
    if (as) { for (const x of s.people) if (x.persona === 'employee') x.persona = 'x'; s.people.find((x) => x.id === as).persona = 'employee'; }
    localStorage.setItem('usp-portal-v1', JSON.stringify(s));
  }, { persona: opts.persona, lang: opts.lang, as: opts.as });
  await p.goto(file + hash, { waitUntil: 'load' }); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(opts.wait ?? 1500);
  return { p, ctx, shot: async (n, full = false) => p.screenshot({ path: `dist/v4-${name}${n ? '-' + n : ''}.png`, fullPage: full }) };
}
const day = (p, n) => p.locator('.cal-day', { hasText: new RegExp(`^${n}$`) }).first();
const nextMonth = async (p) => { await p.locator('.cal-head .icon-btn[aria-label="next"]').click(); await p.waitForTimeout(500); };

/* ١) أحمد: إجازة اعتيادية — هاتف، حتى الإرسال وصفحة الطلب */
{
  const { p, ctx, shot } = await open('wiz-ahmed-phone', ph, '#/new/TM-01', { touch: true });
  await shot('1-types', true);
  await p.locator('.type-hero').first().click(); await p.waitForTimeout(1200); await shot('1-annual');
  await p.locator('.btn.primary.block').click(); await p.waitForTimeout(900); await shot('2-calendar');
  await nextMonth(p); await nextMonth(p); await day(p, 1).click(); await p.waitForTimeout(300); await day(p, 5).click(); await p.waitForTimeout(2000); await shot('2-dates', true);
  await p.locator('.btn.primary.block').click(); await p.waitForTimeout(900); await shot('3-attach');
  await p.locator('.btn.primary.block').click(); await p.waitForTimeout(900); await shot('4-review', true);
  await p.locator('.btn.primary.block').click(); await p.waitForTimeout(2200); await shot('5-done');
  const id = await p.locator('.success-id').textContent(); console.log('created', id);
  await p.goto(file + `#/requests/${id}`); await p.waitForTimeout(1500); await shot('6-request', true);
  await ctx.close();
}
/* ٢) فهد (أبوظبي، يعمل خارج موطنه): ١٩ يوماً → تذاكر + راتب مقدّم — هاتف وحاسوب */
{
  const { p, ctx, shot } = await open('wiz-fahad-phone', ph, '#/new/TM-01', { touch: true, as: 'P-FAHAD' });
  await p.locator('.type-hero').first().click(); await p.waitForTimeout(800);
  await p.locator('.btn.primary.block').click(); await p.waitForTimeout(900);
  await nextMonth(p); await day(p, 4).click(); await p.waitForTimeout(300); await day(p, 19).click(); await p.waitForTimeout(2000); await shot('2-dates', true);
  const sw = p.locator('label.cell input.switch'); const n = await sw.count(); for (let i = 0; i < n; i++) await sw.nth(i).check(); await p.waitForTimeout(400);
  await p.locator('.btn.primary.block').click(); await p.waitForTimeout(900);
  await p.locator('.btn.primary.block').click(); await p.waitForTimeout(900); await shot('4-review', true);
  await ctx.close();
}
{
  const { p, ctx, shot } = await open('wiz-fahad-desk', lap, '#/new/TM-01', { as: 'P-FAHAD' });
  await p.locator('.type-hero').first().click(); await p.waitForTimeout(800); await shot('1-annual');
  await p.locator('.btn.primary.block').click(); await p.waitForTimeout(900);
  await nextMonth(p); await day(p, 4).click(); await p.waitForTimeout(300); await day(p, 19).click(); await p.waitForTimeout(2000); await shot('2-dates', true);
  await ctx.close();
}
/* ٣) سارة (متعاقدة): إجازة مرضية قرب نهاية شريحة الأجر الكامل — هاتف داكن وحاسوب */
{
  const { p, ctx, shot } = await open('wiz-sara-phone', ph, '#/new/TM-01', { touch: true, as: 'P-SARA', dark: true });
  await p.locator('.type-row').first().click(); await p.waitForTimeout(1200); await shot('1-sick');
  await p.locator('.btn.primary.block').click(); await p.waitForTimeout(900);
  await day(p, 20).click(); await p.waitForTimeout(300); await day(p, 24).click(); await p.waitForTimeout(2000); await shot('2-tiers', true);
  await ctx.close();
}
{
  const { p, ctx, shot } = await open('wiz-sara-desk-en', lap, '#/new/TM-01', { as: 'P-SARA', lang: 'en' });
  await p.locator('.type-row').first().click(); await p.waitForTimeout(800);
  await p.locator('.btn.primary.block').click(); await p.waitForTimeout(900);
  await day(p, 20).click(); await p.waitForTimeout(300); await day(p, 24).click(); await p.waitForTimeout(2000); await shot('2-tiers', true);
  await ctx.close();
}
/* ٤) الحج: نافذة هجرية (فهد أدى الحج ٢٠٢٥ → مانع «مرة واحدة») */
{
  const { p, ctx, shot } = await open('wiz-fahad-hajj', ph, '#/new/TM-01', { touch: true, as: 'P-FAHAD' });
  await p.locator('.section-label button').click(); await p.waitForTimeout(900); await p.evaluate(() => document.querySelector('.type-row.off')?.scrollIntoView({ block: 'center' })); await p.waitForTimeout(500); await shot('blocked');
  await ctx.close();
}
/* ٥) مركز السياسات: عمر (admin) — هاتف */
{
  const { p, ctx, shot } = await open('policy-phone', ph, '#/admin/policy', { touch: true, persona: 'admin' });
  await shot('1-types', true);
  await p.locator('.ptl-card.new').click(); await p.waitForTimeout(900); await p.locator('.new-version .segmented button', { hasText: 'السياسة كلها' }).click(); await p.waitForTimeout(300); await p.locator('.new-version .btn.primary').click(); await p.waitForTimeout(1200); await shot('2-draft');
  await p.locator('.pt-card:not(.new)').first().click(); await p.waitForTimeout(1000); await shot('3-editor', false);
  await p.locator('.sheet input[type="number"]').first().fill('15'); await p.waitForTimeout(300);
  await p.keyboard.press('Escape'); await p.waitForTimeout(700);
  await p.locator('.sheet .icon-btn').first().click().catch(() => {}); await p.waitForTimeout(800); await shot('4-savebar');
  await ctx.close();
}
/* ٦) مركز السياسات: حاسوب — مسودة، تحرير، فرق، جدولة، سجل، محاكاة */
{
  const { p, ctx, shot } = await open('policy-desk', lap, '#/admin/policy', { persona: 'admin' });
  await shot('1-types', true);
  await p.locator('.ptl-card.new').click(); await p.waitForTimeout(900); await p.locator('.new-version .segmented button', { hasText: 'السياسة كلها' }).click(); await p.waitForTimeout(300); await p.locator('.new-version .btn.primary').click(); await p.waitForTimeout(1200);
  await p.locator('.pt-card:not(.new)').first().click(); await p.waitForTimeout(1000); await shot('2-editor');
  await p.locator('.sheet input[type="number"]').first().fill('15'); await p.waitForTimeout(300);
  await p.locator('.sheet .icon-btn').first().click().catch(() => {}); await p.waitForTimeout(900); await shot('3-savebar');
  await p.locator('.sb-why').fill('تعميم الأمانة رقم ١٢/٢٠٢٦ بتمديد نافذة التقديم'); await p.locator('.savebar .btn').click(); await p.waitForTimeout(1200); await shot('4-saved');
  await p.locator('.segmented button', { hasText: 'ماذا يتغير' }).click(); await p.waitForTimeout(900); await shot('5-diff');
  await p.locator('.section-head .btn.soft').click(); await p.waitForTimeout(900); await shot('6-schedule-sheet');
  await p.locator('#sc-from').fill('2026-10-01'); await p.locator('#sc-reason').fill('تمديد نافذة التقديم للإجازة الاعتيادية إلى ١٥ يوم عمل'); await p.locator('#sc-ref').fill('تعميم ١٢/٢٠٢٦');
  await p.locator('.sheet .btn.primary.block').click(); await p.waitForTimeout(1500); await shot('7-scheduled', true);
  await p.locator('.segmented button', { hasText: 'سجل التغييرات' }).click(); await p.waitForTimeout(900); await shot('8-log');
  await p.locator('.segmented button', { hasText: 'المحاكاة' }).click(); await p.waitForTimeout(900);
  await p.locator('.select-in').first().selectOption('P-SARA'); await p.locator('.select-in').nth(1).selectOption('sick');
  await p.locator('input[type="date"]').first().fill('2026-09-20'); await p.locator('input[type="date"]').nth(1).fill('2026-09-24');
  await p.locator('.btn.primary', { hasText: 'شغّل' }).click(); await p.waitForTimeout(1600); await shot('9-sim', true);
  await p.locator('.segmented button', { hasText: 'المسارات' }).click(); await p.waitForTimeout(900); await shot('10-routes', true);
  await p.locator('.segmented button', { hasText: 'التقويم' }).click(); await p.waitForTimeout(900); await shot('11-calendar', true);
  await ctx.close();
}
/* ٧) مركز السياسات بالإنجليزية والداكن */
{
  const { p, ctx, shot } = await open('policy-desk-en-dark', lap, '#/admin/policy', { persona: 'admin', lang: 'en', dark: true });
  await shot('1-types', true);
  await p.locator('.pt-card:not(.new)').nth(2).click(); await p.waitForTimeout(1000); await shot('2-editor-sick');
  await ctx.close();
}
/* ٨) مهام المدير: بطاقة الإجازة في تفاصيل المهمة */
{
  const { p, ctx, shot } = await open('inbox-leave', lap, '#/inbox', { persona: 'manager' });
  await p.locator('.row .cell', { hasText: 'إجازة' }).first().click(); await p.waitForTimeout(1000); await shot('desk');
  await ctx.close();
}
{
  const { p, ctx, shot } = await open('inbox-leave-phone', ph, '#/inbox', { persona: 'manager', touch: true });
  await p.locator('.swipe-front', { hasText: 'إجازة' }).first().click(); await p.waitForTimeout(1000); await shot('sheet');
  await ctx.close();
}
/* ٩) ملفي بشخصية المدير: مدخل المركز */
{
  const { p, ctx, shot } = await open('me-admin', ph, '#/me', { persona: 'admin', touch: true });
  await p.evaluate(() => document.getElementById('sec-settings')?.scrollIntoView()); await p.waitForTimeout(700); await shot('settings');
  await ctx.close();
}
await b.close();
console.log('errors:', errs.length ? errs : 'none');
