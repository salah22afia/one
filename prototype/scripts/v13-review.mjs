// نظرة شاملة أخيرة قبل الاعتماد: كل شاشات v0.13 على الهاتف والحاسوب، عربي وإنجليزي، فاتح وداكن — وفحص التماس بين شاشات «اليوم» والشاشات الرسمية داخل الهيكل نفسه
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import path from 'node:path';
import fs from 'node:fs';
const file = 'file://' + path.resolve('dist/index.html');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
const OUT = process.argv[2] || 'shots/v13-review'; fs.mkdirSync(OUT, { recursive: true });
const PH = { width: 390, height: 844 }, DK = { width: 1440, height: 900 };
const errors = []; const rows = [];

async function open({ who = 'P-AHMED', vp = PH, dark = false, lang = 'ar', hash = '#/home', phone = false }) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2, colorScheme: dark ? 'dark' : 'light', hasTouch: vp.width < 600 });
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error') errors.push({ hash, who, text: m.text().slice(0, 180) }); });
  p.on('pageerror', (e) => errors.push({ hash, who, text: String(e).slice(0, 180) }));
  await p.goto(file + '#/home', { waitUntil: 'load' }); await p.waitForTimeout(450);
  await p.evaluate(({ who, lang, phone }) => {
    const s = JSON.parse(localStorage.getItem('usp-portal-v1'));
    if (who === 'admin') { s.settings.persona = 'admin'; s.settings.actAs = undefined; } else { const w = s.people.find((x) => x.id === who); s.settings.persona = w.persona; s.settings.actAs = who; }
    s.settings.lang = lang; s.settings.theme = 'auto'; s.settings.phoneFrame = phone; localStorage.setItem('usp-portal-v1', JSON.stringify(s));
  }, { who, lang, phone });
  await p.goto(file + hash); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1700);
  return { ctx, p };
}
/** لقطة + قياسات التماس: هل تفيض الصفحة أفقياً؟ هل يغطي الشريط الزجاجي آخر المحتوى؟ هل الخلفية واحدة؟ */
async function shot(name, o) {
  const { ctx, p } = await open(o);
  const m = await p.evaluate(() => {
    const de = document.documentElement;
    const bar = document.querySelector('.lb-tabbar');
    const barTop = bar ? bar.getBoundingClientRect().top : null;
    const root = document.querySelector('.app-root');
    const bg = root ? getComputedStyle(root).backgroundColor : '';
    const page = document.querySelector('.page, .lb-page, .lb-home');
    const padBottom = page ? parseFloat(getComputedStyle(page).paddingBottom) : 0;
    const last = (() => { const el = page ? page.lastElementChild : null; return el ? Math.round(el.getBoundingClientRect().bottom) : 0; })();
    return { sw: de.scrollWidth, cw: de.clientWidth, doc: de.scrollHeight, barTop: barTop === null ? null : Math.round(barTop), bg, padBottom, last, cls: page ? page.className : '' };
  });
  rows.push({ name, overflowX: m.sw > m.cw + 1, scrollWidth: m.sw, clientWidth: m.cw, doc: m.doc, barTop: m.barTop, padBottom: m.padBottom, lastBottom: m.last, page: m.cls.slice(0, 40) });
  await p.screenshot({ path: `${OUT}/${name}.png` });
  await ctx.close();
}

/* 1) شاشات «اليوم» على الهاتف: عربي فاتح */
const PHONE = [
  ['01-home', { hash: '#/home' }],
  ['02-inbox', { hash: '#/inbox' }],
  ['03-services', { hash: '#/services' }],
  ['04-requests', { hash: '#/requests' }],
  ['05-request', { hash: '#/requests/REQ-2026-0001' }],
  ['06-me', { hash: '#/me' }],
  ['07-me-docs', { hash: '#/me/docs' }],
  ['08-me-settings', { hash: '#/me/settings' }],
  ['09-notifications', { hash: '#/notifications' }],
  /* التماس: شاشات رسمية داخل الهيكل الجديد */
  ['10-new-leave', { hash: '#/new/TM-01' }],
  ['11-new-need', { hash: '#/new/AS-01', who: 'P-DEPT' }],
  ['12-services-domain', { hash: '#/services/hr' }],
  ['13-admin-comms', { hash: '#/admin/comms', who: 'admin' }],
  ['14-admin-leave', { hash: '#/admin', who: 'admin' }],
  ['15-admin-need', { hash: '#/admin/need', who: 'admin' }],
  ['16-desk-store', { hash: '#/desk/store', who: 'P-SARA' }],
  ['17-design', { hash: '#/design' }],
];
for (const [n, o] of PHONE) await shot(n, o);
/* 2) داكن وإنجليزي على أهم الشاشات */
for (const [n, o] of [['01-home', { hash: '#/home' }], ['02-inbox', { hash: '#/inbox' }], ['06-me', { hash: '#/me' }], ['13-admin-comms', { hash: '#/admin/comms', who: 'admin' }], ['10-new-leave', { hash: '#/new/TM-01' }]]) {
  await shot(`${n}-dark`, { ...o, dark: true });
  await shot(`${n}-en`, { ...o, lang: 'en' });
}
/* 3) الحاسوب */
for (const [n, o] of [['01-home', { hash: '#/home' }], ['02-inbox', { hash: '#/inbox' }], ['04-requests', { hash: '#/requests' }], ['13-admin-comms', { hash: '#/admin/comms', who: 'admin' }], ['10-new-leave', { hash: '#/new/TM-01' }], ['06-me', { hash: '#/me' }]]) {
  await shot(`${n}-desk`, { ...o, vp: DK });
}
/* 4) إطار الهاتف على الحاسوب */
await shot('18-framed-desk', { hash: '#/home', vp: DK, phone: true });

fs.writeFileSync(`${OUT}/review.json`, JSON.stringify({ rows, errors }, null, 2));
const bad = rows.filter((r) => r.overflowX);
console.log('shots', rows.length, '| overflowX', bad.length, bad.map((b) => b.name).join(', '), '| console errors', errors.length);
for (const e of errors.slice(0, 8)) console.log('  ERR', e.hash, e.text);
await b.close();
