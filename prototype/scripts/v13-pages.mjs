// لقطات صفحات المختبر 0.3 وقياسها: كل مسار × شخصية × هاتف/حاسوب (+ داكن وإنجليزي لبعضها)، مع الفيض الأفقي وأخطاء وحدة التحكم
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import path from 'node:path';
import fs from 'node:fs';
const file = 'file://' + path.resolve('dist/index.html');
const OUT = process.argv[2] || 'shots/v13-pages'; fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
const PH = { width: 390, height: 844 }, DK = { width: 1440, height: 900 };
const errors = []; const out = [];
async function open({ who = 'P-AHMED', vp = PH, dark = false, lang = 'ar', hash = '#/home' }) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2, colorScheme: dark ? 'dark' : 'light', hasTouch: vp.width < 600 }); const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error') errors.push({ who, hash, vp: vp.width, text: m.text().slice(0, 200) }); }); p.on('pageerror', (e) => errors.push({ who, hash, vp: vp.width, text: String(e).slice(0, 200) }));
  await p.goto(file + '#/home', { waitUntil: 'load' }); await p.waitForTimeout(400);
  await p.evaluate(({ who, lang }) => { const s = JSON.parse(localStorage.getItem('usp-portal-v1')); if (who === 'admin') { s.settings.persona = 'admin'; s.settings.actAs = undefined; } else { const w = s.people.find((x) => x.id === who); s.settings.persona = w.persona; s.settings.actAs = who; } s.settings.lang = lang; s.settings.theme = 'auto'; localStorage.setItem('usp-portal-v1', JSON.stringify(s));  }, { who, lang });
  await p.goto(file + hash); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1700);
  return { ctx, p };
}
const ids = await (async () => { const { ctx, p } = await open({}); const r = await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('usp-portal-v1')); const mine = s.requests.filter((x) => x.requesterId === 'P-AHMED').sort((a, b) => b.createdAt - a.createdAt); return { leave: mine.find((x) => x.leave && x.status === 'in_review')?.id, ret: mine.find((x) => x.status === 'returned')?.id, done: mine.find((x) => x.status === 'completed' && x.leave)?.id, need: s.requests.find((x) => x.requesterId === 'P-DEPT' && x.need && x.status === 'in_review')?.id }; }); await ctx.close(); return r; })();
console.log('ids', ids);
const PAGES = [
  ['P-MONA', '#/inbox', 'inbox-manager'], ['P-AHMED', '#/inbox', 'inbox-employee'], ['P-MAJED', '#/inbox', 'inbox-buyer'],
  ['P-AHMED', '#/services', 'services'], ['P-AHMED', '#/services/TM', 'services-domain'], ['P-AHMED', '#/services/q/إجازة', 'services-search'],
  ['P-AHMED', '#/requests', 'requests'], ['P-AHMED', `#/requests/${ids.leave}`, 'request-leave'], ['P-AHMED', `#/requests/${ids.ret}`, 'request-returned'], ['P-AHMED', `#/requests/${ids.done}`, 'request-done'], ['P-DEPT', `#/requests/${ids.need}`, 'request-need'],
  ['P-AHMED', '#/me', 'me'], ['P-AHMED', '#/me/docs', 'me-docs'], ['P-AHMED', '#/me/data', 'me-data'], ['P-AHMED', '#/me/balances', 'me-balances'], ['P-AHMED', '#/me/pay', 'me-pay'], ['P-AHMED', '#/me/settings', 'me-settings'], ['P-AHMED', '#/me/leaves', 'me-leaves'],
  ['P-AHMED', '#/notifications', 'notifications'], ['P-MONA', '#/notifications', 'notifications-manager'],
  ['P-AHMED', '#/new/TM-01', 'new-leave'], ['P-AHMED', '#/new/AS-01', 'new-need'], ['P-MAJED', '#/desk/procurement', 'desk-procurement'], ['admin', '#/admin', 'admin-policy'],
];
for (const [who, hash, tag] of PAGES) {
  for (const vp of [PH, DK]) {
    const { ctx, p } = await open({ who, vp, hash });
    const m = await p.evaluate(() => ({ h: document.documentElement.scrollHeight, sw: document.documentElement.scrollWidth }));
    const name = `${tag}-${vp.width < 600 ? 'phone' : 'desk'}`;
    await p.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
    out.push({ name, height: m.h, screens: +(m.h / vp.height).toFixed(2), scrollWidth: m.sw, overflow: m.sw > vp.width });
    await ctx.close();
  }
}
fs.writeFileSync(`${OUT}/summary.json`, JSON.stringify({ out, errors }, null, 2));
/* حالات: مهمة مفتوحة في اللوح، ومستند في المحفظة مقدَّم، وخيط تنبيهات مفتوح، وداكن وإنجليزي لبعض الصفحات */
{
  const { ctx, p } = await open({ who: 'P-MONA', hash: '#/inbox' }); await p.locator('.lrow').first().click(); await p.waitForTimeout(900); await p.screenshot({ path: `${OUT}/state-task-sheet-phone.png` }); await ctx.close();
}
{
  const { ctx, p } = await open({ hash: '#/me/docs' }); await p.locator('.pass').nth(2).click({ position: { x: 60, y: 30 } }); await p.waitForTimeout(800); await p.screenshot({ path: `${OUT}/state-docs-front-phone.png`, fullPage: true }); await ctx.close();
}
{
  const { ctx, p } = await open({ hash: '#/notifications' }); const th = p.locator('.nt-row').filter({ has: p.locator('.lb-chev') }).first(); if (await th.count()) { await th.click(); await p.waitForTimeout(700); } await p.screenshot({ path: `${OUT}/state-notif-thread-phone.png`, fullPage: true }); await ctx.close();
}
for (const [hash, tag] of [['#/inbox', 'inbox-manager'], ['#/requests', 'requests'], ['#/me', 'me'], ['#/me/docs', 'me-docs'], ['#/services', 'services']]) {
  const who = tag === 'inbox-manager' ? 'P-MONA' : 'P-AHMED';
  let o = await open({ who, hash, dark: true }); await o.p.screenshot({ path: `${OUT}/${tag}-phone-dark.png`, fullPage: true }); await o.ctx.close();
  o = await open({ who, hash, lang: 'en' }); const m = await o.p.evaluate(() => ({ sw: document.documentElement.scrollWidth })); out.push({ name: `${tag}-phone-en`, height: 0, screens: 0, scrollWidth: m.sw, overflow: m.sw > 390 }); await o.p.screenshot({ path: `${OUT}/${tag}-phone-en.png`, fullPage: true }); await o.ctx.close();
}
fs.writeFileSync(`${OUT}/summary.json`, JSON.stringify({ out, errors }, null, 2));
for (const o of out) console.log(`${o.overflow ? 'FAIL' : 'PASS'} ${o.name}: ${o.height}px = ${o.screens} screens · sw ${o.scrollWidth}`);
console.log(`console errors: ${errors.length}`); for (const e of errors.slice(0, 10)) console.log('  ', e.who, e.hash, e.vp, e.text);
await b.close();
