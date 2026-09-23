// تدقيق كل صفحات البوابة الرسمية (v0.12) قبل مختبر التصميم 0.3: لقطة كاملة الطول + طول الصفحة بالشاشات + عدد الصناديق والصفوف لكل مسار وشخصية على الهاتف والحاسوب
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import path from 'node:path';
import fs from 'node:fs';
const file = 'file://' + path.resolve('dist/index.html');
const OUT = 'shots/audit-pages'; fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
const PH = { width: 390, height: 844 }, DK = { width: 1440, height: 900 };
const out = [];
async function shoot(who, hash, tag, vp) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2, hasTouch: vp.width < 600 }); const p = await ctx.newPage();
  await p.goto(file + '#/home', { waitUntil: 'load' }); await p.waitForTimeout(500);
  await p.evaluate((id) => { const s = JSON.parse(localStorage.getItem('usp-portal-v1')); if (id === 'admin') { s.settings.persona = 'admin'; s.settings.actAs = undefined; } else { const w = s.people.find((x) => x.id === id); s.settings.persona = w.persona; s.settings.actAs = id; } s.settings.lang = 'ar'; s.settings.theme = 'auto'; localStorage.setItem('usp-portal-v1', JSON.stringify(s)); }, who);
  await p.goto(file + hash); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1600);
  const m = await p.evaluate(() => ({ h: document.documentElement.scrollHeight, sw: document.documentElement.scrollWidth, groups: document.querySelectorAll('.group, .card, .idcard').length, cells: document.querySelectorAll('.cell').length, titles: Array.from(document.querySelectorAll('h1, h2, .large-title, .sec-h')).map((e) => (e.textContent || '').trim().slice(0, 30)).filter(Boolean).slice(0, 12) }));
  const name = `${tag}-${vp.width < 600 ? 'phone' : 'desk'}`;
  await p.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  out.push({ name, who, hash, height: m.h, screens: +(m.h / vp.height).toFixed(2), scrollWidth: m.sw, groups: m.groups, cells: m.cells, titles: m.titles });
  await ctx.close();
}
const firstReq = await (async () => { const ctx = await b.newContext({ viewport: PH }); const p = await ctx.newPage(); await p.goto(file + '#/home', { waitUntil: 'load' }); await p.waitForTimeout(500); const id = await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('usp-portal-v1')); const r = s.requests.filter((x) => x.requesterId === 'P-AHMED').sort((a, b) => b.createdAt - a.createdAt); return { leave: r.find((x) => x.leave)?.id, need: r.find((x) => x.need)?.id, mona: s.requests.find((x) => x.requesterId === 'P-SARA' && x.leave)?.id }; }); await ctx.close(); return id; })();
console.log('ids', firstReq);
const PAGES = [
  ['P-AHMED', '#/inbox', 'inbox-employee'], ['P-MONA', '#/inbox', 'inbox-manager'], ['P-MAJED', '#/inbox', 'inbox-buyer'],
  ['P-AHMED', '#/services', 'services'], ['P-AHMED', '#/services/q/إجازة', 'services-search'], ['P-AHMED', '#/services/TM', 'services-domain'],
  ['P-AHMED', '#/requests', 'requests'], ['P-AHMED', `#/requests/${firstReq.leave}`, 'request-leave'], ['P-AHMED', `#/requests/${firstReq.need}`, 'request-need'],
  ['P-AHMED', '#/me', 'me'], ['P-AHMED', '#/me/leaves', 'me-leaves'], ['P-AHMED', '#/me/custody', 'me-custody'],
  ['P-AHMED', '#/notifications', 'notifications'], ['P-MONA', '#/notifications', 'notifications-manager'],
  ['P-AHMED', '#/new/TM-01', 'new-leave'], ['P-AHMED', '#/new/AS-01', 'new-need'], ['P-AHMED', '#/new/DC-01', 'new-letter'],
  ['P-MAJED', '#/desk/procurement', 'desk-procurement'], ['admin', '#/admin', 'admin-policy'], ['admin', '#/admin/need', 'admin-need'],
];
for (const [who, hash, tag] of PAGES) { for (const vp of [PH, DK]) { try { await shoot(who, hash, tag, vp); } catch (e) { console.log('ERR', tag, vp.width, String(e).slice(0, 120)); } } }
fs.writeFileSync(`${OUT}/summary.json`, JSON.stringify(out, null, 2));
for (const o of out) console.log(`${o.name}: ${o.height}px = ${o.screens} screens · boxes ${o.groups} · cells ${o.cells} · ${o.titles.join(' | ')}`);
await b.close();
