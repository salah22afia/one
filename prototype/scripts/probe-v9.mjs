// معاينة سريعة لشاشات v0.9 قبل سيناريوهات القبول: المعالج، والمكاتب، والعهدة، وسياسة الاحتياج، والمهمة، والطلب
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import path from 'node:path';
import fs from 'node:fs';
const file = 'file://' + path.resolve('dist/index.html');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
const errs = [];
const ph = { width: 400, height: 860 }; const lap = { width: 1440, height: 900 };
fs.mkdirSync('shots/probe-v9', { recursive: true });
async function open(name, vp, hash, opts = {}) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 1, colorScheme: opts.dark ? 'dark' : 'light', hasTouch: !!opts.touch, isMobile: !!opts.touch });
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error') errs.push(name + ': ' + m.text()); });
  p.on('pageerror', (e) => errs.push(name + ': ' + e.message));
  await p.goto(file + '#/home', { waitUntil: 'load' }); await p.waitForTimeout(700);
  await p.evaluate(({ persona, lang, as }) => { const s = JSON.parse(localStorage.getItem('usp-portal-v1')); if (persona) { s.settings.persona = persona; s.settings.actAs = undefined; } if (lang) s.settings.lang = lang; if (as) { const who = s.people.find((x) => x.id === as); s.settings.persona = who.persona; s.settings.actAs = as; } localStorage.setItem('usp-portal-v1', JSON.stringify(s)); }, opts);
  await p.goto(file + hash, { waitUntil: 'load' }); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(opts.wait ?? 1400);
  return { p, ctx, shot: (n, full = true) => p.screenshot({ path: `shots/probe-v9/${name}${n ? '-' + n : ''}.png`, fullPage: full }) };
}
const overflow = (p) => p.evaluate(() => { const w = document.documentElement.clientWidth; const bad = []; document.querySelectorAll('body *').forEach((el) => { const r = el.getBoundingClientRect(); if (r.width > 0 && (r.right > w + 1 || r.left < -1)) bad.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ').filter(Boolean).slice(0, 2).join('.')}@${Math.round(r.left)}-${Math.round(r.right)}`); }); return { w, sw: document.documentElement.scrollWidth, bad: bad.slice(0, 6) }; });
const shots = [
  ['new-need-ph', ph, '#/new/AS-01', { as: 'P-DEPT', touch: true }],
  ['new-need-gate-ph', ph, '#/new/AS-01', { as: 'P-MONA', touch: true }],
  ['new-need-desk', lap, '#/new/AS-01', { as: 'P-DEPT' }],
  ['inbox-sara-ph', ph, '#/inbox', { as: 'P-SARA', touch: true }],
  ['inbox-majed-desk', lap, '#/inbox', { as: 'P-MAJED' }],
  ['inbox-abdulaziz-desk', lap, '#/inbox', { as: 'P-ITS' }],
  ['inbox-rashed-ph', ph, '#/inbox', { as: 'P-AUH', touch: true }],
  ['req-r12-ph', ph, '#/requests/REQ-2026-0381', { as: 'P-AHMED', touch: true }],
  ['req-r3-desk', lap, '#/requests/REQ-2026-0388', { as: 'P-DEPT' }],
  ['desk-proc-desk', lap, '#/desk/procurement', { as: 'P-MAJED' }],
  ['desk-proc-ph', ph, '#/desk/procurement', { as: 'P-MAJED', touch: true }],
  ['desk-store-desk', lap, '#/desk/store', { as: 'P-STORE2' }],
  ['desk-store-ph', ph, '#/desk/store', { as: 'P-STORE2', touch: true }],
  ['custody-ph', ph, '#/me/custody', { as: 'P-AHMED', touch: true }],
  ['me-ahmed-ph', ph, '#/me', { as: 'P-AHMED', touch: true }],
  ['admin-need-desk', lap, '#/admin/need', { persona: 'admin' }],
  ['admin-need-ph', ph, '#/admin/need', { persona: 'admin', touch: true }],
  ['home-majed-ph', ph, '#/home', { as: 'P-MAJED', touch: true }],
  ['new-need-en-desk', lap, '#/new/AS-01', { as: 'P-DEPT', lang: 'en' }],
  ['desk-proc-dark-ph', ph, '#/desk/procurement', { as: 'P-MAJED', touch: true, dark: true }],
];
for (const [name, vp, hash, opts] of shots) {
  const { p, ctx, shot } = await open(name, vp, hash, opts);
  if (name.startsWith('new-need') && !name.includes('gate')) { await p.locator('.type-row').first().click().catch(() => {}); await p.waitForTimeout(600); }
  const ov = await overflow(p); await shot('');
  console.log(name, 'overflow:', ov.sw > ov.w + 1 ? 'YES ' + JSON.stringify(ov.bad) : 'no');
  await ctx.close();
}
// المعالج كاملاً بعين عبدالرحمن (هاتف): فئة → صنف → التالي → المبرر → المراجعة → إرسال
{
  const { p, ctx, shot } = await open('wizard', ph, '#/new/AS-01', { as: 'P-DEPT', touch: true });
  await p.locator('.type-row').first().click(); await p.waitForTimeout(600); await shot('1-cat');
  await p.locator('.group .cell', { hasText: 'M-100201' }).first().click(); await p.waitForTimeout(400); await shot('2-item');
  await p.locator('.btn.primary.block').click(); await p.waitForTimeout(700); await shot('3-details');
  await p.fill('#n-why', 'جهاز للموظف الجديد في القسم'); await p.locator('.btn.primary.block').click(); await p.waitForTimeout(700); await shot('4-review');
  await p.locator('.btn.primary.block').click(); await p.waitForTimeout(1600); await shot('5-done');
  const s = await p.evaluate(() => JSON.parse(localStorage.getItem('usp-portal-v1'))); const last = s.requests[s.requests.length - 1];
  console.log('created', last.id, last.need?.lines.map((l) => l.name.ar + '×' + l.qty), 'steps', last.steps.map((x) => `${x.role || x.desk}:${x.status}`).join(' '), 'notApplied', (last.notApplied || []).map((x) => x.why.ar));
  await ctx.close();
}
console.log('errors', errs.length, errs.slice(0, 5));
await b.close();
