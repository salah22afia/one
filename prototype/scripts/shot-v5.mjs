// لقطات v0.5: الموافقة الثانية (D-010)، وإشعارات الجدولة والسريان، وتصدير الإصدار مستنداً، وقرار الإجازة، ودورات الأجر في ملفي
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import path from 'node:path';
import fs from 'node:fs';
const file = 'file://' + path.resolve('dist/index.html');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
const errs = []; const checks = [];
const ok = (id, cond, detail) => { checks.push({ id, pass: !!cond, detail }); console.log(`${cond ? 'PASS' : 'FAIL'} ${id}: ${detail}`); };
const ph = { width: 400, height: 860 }; const lap = { width: 1440, height: 900 };
async function open(name, vp, hash, opts = {}) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2, colorScheme: opts.dark ? 'dark' : 'light', hasTouch: !!opts.touch, isMobile: !!opts.touch });
  const p = await ctx.newPage();
  await p.addInitScript(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
  p.on('console', (m) => { if (m.type() === 'error') errs.push(name + ': ' + m.text()); });
  p.on('pageerror', (e) => errs.push(name + ': ' + e.message));
  await p.goto(file + '#/home', { waitUntil: 'load' }); await p.waitForTimeout(900);
  await setPersona(p, opts);
  await p.goto(file + hash, { waitUntil: 'load' }); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(opts.wait ?? 1500);
  return { p, ctx, shot: async (n, full = false) => p.screenshot({ path: `dist/v5-${name}${n ? '-' + n : ''}.png`, fullPage: full }) };
}
async function setPersona(p, { persona, lang, as, mutate } = {}) {
  await p.evaluate(({ persona, lang, as, mutate }) => {
    const s = JSON.parse(localStorage.getItem('usp-portal-v1'));
    if (persona) { s.settings.persona = persona; s.settings.actAs = undefined; } if (lang) s.settings.lang = lang;
    if (as) { const who = s.people.find((x) => x.id === as); s.settings.persona = who.persona; s.settings.actAs = as; }
    if (mutate) { const f = new Function('s', mutate); f(s); }
    localStorage.setItem('usp-portal-v1', JSON.stringify(s));
  }, { persona, lang, as, mutate });
}
const seg = (p, label) => p.locator('.segmented button', { hasText: label });
/** يجهّز إصداراً مجدولاً 2026.2 بالمفتاح مفعّلاً (مدير النظام) */
async function scheduleWithApproval(p, shot) {
  await p.locator('.gov-cell input.switch').check(); await p.waitForTimeout(600);
  await p.locator('.ptl-card.new').click(); await p.waitForTimeout(900); await p.locator('.new-version .segmented button', { hasText: 'السياسة كلها' }).click(); await p.waitForTimeout(300); await p.locator('.new-version .btn.primary').click(); await p.waitForTimeout(1200);
  await p.locator('.pt-card:not(.new)').first().click(); await p.waitForTimeout(900);
  await p.locator('.sheet input[type="number"]').first().fill('15'); await p.waitForTimeout(300);
  await p.locator('.sheet .icon-btn').first().click().catch(() => {}); await p.waitForTimeout(800);
  await p.locator('.sb-why').fill('تعميم الأمانة رقم ١٢/٢٠٢٦ بتمديد نافذة التقديم'); await p.locator('.savebar .btn').click(); await p.waitForTimeout(1000);
  await p.locator('.section-head .btn.soft').click(); await p.waitForTimeout(900); if (shot) await shot('2-schedule-sheet');
  await p.locator('#sc-from').fill('2026-10-01'); await p.locator('#sc-reason').fill('تمديد نافذة التقديم للإجازة الاعتيادية إلى ١٥ يوم عمل'); await p.locator('#sc-ref').fill('تعميم ١٢/٢٠٢٦');
  await p.locator('.sheet .btn.primary.block').click(); await p.waitForTimeout(1500);
}

/* ١) مدير النظام: تفعيل الموافقة الثانية وجدولة إصدار → «بانتظار الموافقة الثانية» (حاسوب) */
{
  const { p, ctx, shot } = await open('gov-desk', lap, '#/admin/policy', { persona: 'admin' });
  await shot('1-governance-off');
  await scheduleWithApproval(p, shot);
  await shot('3-awaiting', true);
  const status = await p.locator('.pv-line .pill').first().textContent();
  const govFoot = await p.locator('.gov-cell .cell-sub').first().textContent();
  ok('v5-gov-1', status.includes('بانتظار الموافقة الثانية') && govFoot.includes('هند'), `status="${status}" · approver="${govFoot.slice(0, 60)}"`);
  // التنبيهات لدى المعتمد (شاغل المنصب المعتمد: المدير العام للموارد البشرية): مهمة الموافقة الثانية
  await setPersona(p, { as: 'P-HRGM' }); await p.goto(file + '#/home'); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1500); await shot('4-hr-home');
  const homeTxt = await p.locator('.waiting').textContent();
  await p.goto(file + '#/inbox'); await p.waitForTimeout(1200); await shot('5-hr-inbox');
  const inboxTxt = await p.locator('.page').textContent();
  ok('v5-gov-2', homeTxt.includes('الموافقة الثانية على الإصدار 2026.2') && inboxTxt.includes('الموافقة الثانية على الإصدار 2026.2'), 'policy task shown on home and in the inbox for the acting HR persona');
  await p.locator('.cell', { hasText: 'الموافقة الثانية على الإصدار' }).first().click(); await p.waitForTimeout(1500);
  await p.locator('.ptl-card.awaiting').click().catch(() => {}); await p.waitForTimeout(800); await shot('6-approvebar', true);
  const hasBar = await p.locator('.approvebar').count();
  // الإعادة بلا ملاحظة تُرفض، ثم الاعتماد بملاحظة
  await p.locator('.approvebar .btn.secondary').click(); await p.waitForTimeout(400); const invalid = await p.locator('.approvebar .sb-why.invalid').count();
  await p.locator('.approvebar .sb-why').fill('روجعت التغييرات؛ لا ملاحظات'); await p.locator('.approvebar .btn.primary').click(); await p.waitForTimeout(1200); await shot('7-approved', true);
  const st2 = await p.locator('.pv-line .pill').first().textContent(); const appr = await p.locator('.pv-approval').textContent();
  ok('v5-gov-3', hasBar === 1 && invalid === 1 && st2.includes('مجدول') && appr.includes('اعتمده') && appr.includes('هند'), `bar=${hasBar} · returnWithoutNote=${invalid} · status="${st2}" · "${appr.trim().slice(0, 70)}"`);
  // إشعار مدير السياسة بالاعتماد وبالجدولة
  await setPersona(p, { persona: 'admin' }); await p.goto(file + '#/notifications'); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1500); await shot('8-admin-notifs');
  const nt = await p.locator('.page').textContent();
  ok('v5-gov-4', nt.includes('اعتمد هند الإصدار 2026.2') && nt.includes('جُدوِل الإصدار 2026.2'), 'admin notified of approval and scheduling');
  // السريان: بتقديم تاريخ الإصدار إلى اليوم يصل إشعار «سرى الإصدار» عند الفتح
  await setPersona(p, { mutate: `const v = s.policy.versions.find((x) => x.number === '2026.2'); v.from = new Date().toISOString().slice(0, 10); v.notifiedActive = false;` });
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1500); await shot('9-active-notif');
  const nt2 = await p.locator('.page').textContent();
  ok('v5-gov-5', nt2.includes('سرى الإصدار 2026.2'), 'activation notification on open');
  await ctx.close();
}
/* ٢) الإعادة إلى المسودة بملاحظة (هاتف) */
{
  const { p, ctx, shot } = await open('gov-phone', ph, '#/admin/policy', { persona: 'admin', touch: true });
  await p.evaluate(() => document.querySelector('.gov-cell')?.scrollIntoView({ block: 'center' })); await p.waitForTimeout(400); await shot('1-governance');
  await scheduleWithApproval(p); await shot('2-awaiting');
  await setPersona(p, { as: 'P-HRGM' }); await p.goto(file + '#/inbox'); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1500); await shot('3-hr-inbox');
  await p.goto(file + '#/admin/policy'); await p.waitForTimeout(1200); await p.locator('.ptl-card.awaiting').click().catch(() => {}); await p.waitForTimeout(800);
  await p.locator('.approvebar .sb-why').fill('يلزم توضيح أثر التمديد على الطلبات المتأخرة قبل السريان'); await shot('4-approvebar');
  await p.locator('.approvebar .btn.secondary').click(); await p.waitForTimeout(1200);
  await setPersona(p, { persona: 'admin' }); await p.goto(file + '#/admin/policy'); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1500); await shot('5-returned', false);
  const appr = await p.locator('.pv-approval').textContent(); const st = await p.locator('.pv-line .pill').first().textContent();
  ok('v5-gov-6', st.includes('مسودة') && appr.includes('أُعيد إلى المسودة') && appr.includes('يلزم توضيح'), `status="${st}" · "${appr.trim().slice(0, 80)}"`);
  await p.goto(file + '#/notifications'); await p.waitForTimeout(1200); await shot('6-admin-notif');
  await ctx.close();
}
/* ٣) تصدير الإصدار مستنداً (حاسوب وهاتف) وطباعته */
{
  const { p, ctx, shot } = await open('export-desk', lap, '#/admin/policy', { persona: 'admin' });
  await p.locator('.pv-line .btn.quiet').click(); await p.waitForTimeout(1300); await shot('1-doc');
  await p.evaluate(() => document.querySelector('.sheet .dp-foot')?.scrollIntoView({ block: 'center' })); await p.waitForTimeout(500); await shot('2-doc-foot');
  const docTxt = await p.locator('.sheet .doc-preview').textContent();
  ok('v5-export-1', docTxt.includes('سياسة الإجازات') && docTxt.includes('2026.1') && docTxt.includes('الإجازة السنوية') && docTxt.includes('المسارات المعيارية') && docTxt.includes('GS-'), 'policy document has header, types, routes and verification');
  await p.locator('.sheet .btn.soft', { hasText: 'طباعة' }).click(); await p.waitForTimeout(400);
  const printing = await p.evaluate(() => ({ cls: document.body.classList.contains('printing'), host: !!document.querySelector('#print-host .doc-preview'), printed: window.__printed }));
  await p.emulateMedia({ media: 'print' }); await p.waitForTimeout(200); await p.screenshot({ path: 'dist/v5-export-desk-3-print.png', fullPage: true }); await p.emulateMedia({ media: 'screen' });
  ok('v5-export-2', printing.cls && printing.host && printing.printed === 1, `printing=${JSON.stringify(printing)}`);
  await ctx.close();
}
{
  const { p, ctx, shot } = await open('export-phone-en', ph, '#/admin/policy', { persona: 'admin', touch: true, lang: 'en', dark: true });
  await p.locator('.pv-line .btn.quiet').click(); await p.waitForTimeout(1300); await shot('1-doc');
  await ctx.close();
}
/* ٤) قرار الإجازة: مستند TM-01 بالهوية الرسمية (هاتف وحاسوب، عربي وإنجليزي) */
{
  const { p, ctx, shot } = await open('decision-phone', ph, '#/requests', { touch: true });
  await seg(p, 'المكتملة').click(); await p.waitForTimeout(800);
  await p.locator('.cell', { hasText: 'طلب إجازة' }).first().click(); await p.waitForTimeout(1300);
  await p.locator('.seal .btn').first().click(); await p.waitForTimeout(1500); await shot('1-decision');
  await p.evaluate(() => document.querySelector('.sheet .dp-sign')?.scrollIntoView({ block: 'center' })); await p.waitForTimeout(500); await shot('2-decision-sign');
  const txt = await p.locator('.sheet .doc-preview').textContent();
  ok('v5-decision-1', txt.includes('قرار إجازة') && txt.includes('أولاً') && txt.includes('أحمد بن سعود الدوسري') && (txt.includes('الإجازة الاضطرارية') || txt.includes('الإجازة السنوية')) && txt.includes('سلسلة الاعتماد') && txt.includes('منى') && txt.includes('2026.1'), 'leave decision built from the request');
  await p.locator('.sheet .btn.soft', { hasText: 'طباعة' }).click(); await p.waitForTimeout(400);
  const printing = await p.evaluate(() => ({ cls: document.body.classList.contains('printing'), host: !!document.querySelector('#print-host .doc-preview'), printed: window.__printed }));
  await p.emulateMedia({ media: 'print' }); await p.waitForTimeout(200); await p.screenshot({ path: 'dist/v5-decision-phone-3-print.png', fullPage: true }); await p.emulateMedia({ media: 'screen' });
  ok('v5-decision-2', printing.cls && printing.host && printing.printed === 1, `printing=${JSON.stringify(printing)}`);
  await ctx.close();
}
{
  const { p, ctx, shot } = await open('decision-desk-en', lap, '#/requests', { lang: 'en' });
  await seg(p, 'Completed').click(); await p.waitForTimeout(800);
  await p.locator('.cell', { hasText: 'Leave request' }).first().click(); await p.waitForTimeout(1300);
  await p.locator('.seal .btn').first().click(); await p.waitForTimeout(1500); await shot('1-decision');
  await ctx.close();
}
/* ٥) ملفي: دورات الأجر المتدرج — سارة قرب نهاية الشريحة، وأحمد ضمنها؛ والتنبيهات المبكرة */
{
  const { p, ctx, shot } = await open('cycles-sara', ph, '#/me/balances', { touch: true, as: 'P-SARA' });
  await p.evaluate(() => document.getElementById('sec-cycles')?.scrollIntoView({ block: 'start' })); await p.waitForTimeout(700); await shot('1-cycles');
  const txt = await p.locator('.cyc.near').first().textContent().catch(() => '');
  ok('v5-cycles-1', txt.includes('قرب نهاية الشريحة') && txt.includes('30') && txt.includes('75%'), `"${txt.trim().slice(0, 90)}"`);
  await p.goto(file + '#/notifications'); await p.waitForTimeout(1200); await shot('2-notifs');
  const nt = await p.locator('.page').textContent();
  ok('v5-cycles-2', nt.includes('اقتربت من نهاية شريحة الأجر الكامل'), 'employee early-warning notification');
  await ctx.close();
}
{
  const { p, ctx, shot } = await open('cycles-ahmed-desk', lap, '#/me/balances', {});
  await p.evaluate(() => document.getElementById('sec-cycles')?.scrollIntoView({ block: 'center' })); await p.waitForTimeout(700); await shot('1-cycles');
  const txt = await p.locator('.cyc').first().textContent();
  ok('v5-cycles-3', txt.includes('ضمن الشريحة الأولى') && txt.includes('10'), `"${txt.trim().slice(0, 80)}"`);
  await setPersona(p, { persona: 'hr' }); await p.goto(file + '#/notifications'); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1500); await shot('2-hr-notifs');
  const nt = await p.locator('.page').textContent();
  ok('v5-cycles-4', nt.includes('سارة يقترب من نهاية شريحة') && nt.includes('سرى الإصدار 2026.1'), 'HR gets the early warning and the policy activation notice');
  await ctx.close();
}
/* ٦) الداكن والإنجليزي: مركز السياسات بالحوكمة */
{
  const { p, ctx, shot } = await open('gov-desk-en-dark', lap, '#/admin/policy', { persona: 'admin', lang: 'en', dark: true });
  await shot('1');
  await ctx.close();
}
await b.close();
fs.writeFileSync('dist/v5-results.json', JSON.stringify({ checks, errs }, null, 2));
console.log('errors:', errs.length ? errs : 'none');
console.log(checks.every((c) => c.pass) ? 'ALL PASS' : 'SOME FAILED');
