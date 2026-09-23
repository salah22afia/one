// v0.17 «النظرة العميقة»: لقطات كاملة لكل شاشة على الهاتف والحاسوب، بلغتين وفي الوضعين، مع كواشف آلية عامة:
// (1) عنصر مقصوص بحاوية (حلقات، أيقونات، رقاقات) · (2) نص فوق نص أو رقاقة فوق نص في أي مكان · (3) أهداف لمس صغيرة على الهاتف · (4) نص أصغر من 11px · (5) فيض أفقي · (6) أخطاء وحدة التحكم
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import path from 'node:path';
import fs from 'node:fs';
const file = 'file://' + path.resolve('dist/index.html');
const OUT = process.argv[2] || 'shots/v17'; fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const SCREENS = [
  { n: '01-home', h: '#/home', as: 'P-AHMED' }, { n: '01b-home-manager', h: '#/home', as: 'P-MONA' }, { n: '01c-home-admin', h: '#/home', admin: true },
  { n: '02-inbox', h: '#/inbox', as: 'P-MONA' }, { n: '02b-inbox-hr', h: '#/inbox', as: 'P-NOURA' }, { n: '02c-inbox-buyer', h: '#/inbox', as: 'P-MAJED' },
  { n: '03-services', h: '#/services', as: 'P-AHMED' }, { n: '03b-services-domain', h: '#/services/TM', as: 'P-AHMED' },
  { n: '04-requests', h: '#/requests', as: 'P-AHMED' }, { n: '05-request-leave', h: 'REQ-LEAVE', as: 'P-AHMED' }, { n: '05b-request-need', h: 'REQ-NEED', as: 'P-DEPT' }, { n: '05c-request-returned', h: 'REQ-RET', as: 'P-AHMED' },
  { n: '06-me', h: '#/me', as: 'P-AHMED' }, { n: '06b-me-leaves', h: '#/me/leaves', as: 'P-AHMED' }, { n: '06c-me-docs', h: '#/me/docs', as: 'P-AHMED' }, { n: '06d-me-data', h: '#/me/data', as: 'P-AHMED' }, { n: '06e-me-balances', h: '#/me/balances', as: 'P-AHMED' }, { n: '06f-me-pay', h: '#/me/pay', as: 'P-AHMED' }, { n: '06g-me-settings', h: '#/me/settings', as: 'P-AHMED' }, { n: '06h-me-custody', h: '#/me/custody', as: 'P-AHMED' },
  { n: '07-notifications', h: '#/notifications', as: 'P-AHMED' },
  { n: '08-new-leave', h: '#/new/TM-01', as: 'P-AHMED' }, { n: '09-new-need', h: '#/new/AS-01', as: 'P-DEPT' }, { n: '10-new-dc01', h: '#/new/DC-01', as: 'P-AHMED' }, { n: '10b-new-pr07', h: '#/new/PR-07', as: 'P-AHMED' }, { n: '10c-new-ha09', h: '#/new/HA-09', as: 'P-AHMED' },
  { n: '11-post-reader', h: 'POST', as: 'P-AHMED' },
  { n: '12-admin-policy', h: '#/admin/policy', admin: true }, { n: '12b-admin-need', h: '#/admin/need', admin: true }, { n: '12c-admin-comms', h: '#/admin/comms', admin: true },
  { n: '13-designer', h: '#/admin/designer', admin: true }, { n: '13b-designer-svc', h: '#/admin/designer/svc/PR-07', admin: true }, { n: '13c-tenants', h: '#/admin/tenants', admin: true }, { n: '13d-contracts', h: '#/admin/contracts', admin: true }, { n: '13e-registers', h: '#/admin/registers', admin: true },
  { n: '16-admin', h: '#/admin', admin: true }, { n: '16b-admin-org', h: '#/admin/policy/org', admin: true },
  { n: '14-desk-store', h: '#/desk/store', as: 'P-STORE2' }, { n: '14b-desk-procurement', h: '#/desk/procurement', as: 'P-MAJED' },
  { n: '15-design', h: '#/design', as: 'P-AHMED' },
];
const VIEWS = [
  { tag: 'phone', vp: { width: 390, height: 844 }, lang: 'ar', dark: false, mobile: true },
  { tag: 'desk', vp: { width: 1440, height: 900 }, lang: 'ar', dark: false, mobile: false },
  { tag: 'phone-dark', vp: { width: 390, height: 844 }, lang: 'ar', dark: true, mobile: true, only: /^(01|02|04|05|06|07|08|10|13|16)/ },
  { tag: 'phone-en', vp: { width: 390, height: 844 }, lang: 'en', dark: false, mobile: true, only: /^(01|02|03|04|05|06|07|08|10|13|16)/ },
  { tag: 'desk-en', vp: { width: 1440, height: 900 }, lang: 'en', dark: false, mobile: false, only: /^(01|02|05|06|13|16)/ },
  { tag: 'small', vp: { width: 360, height: 780 }, lang: 'ar', dark: false, mobile: true, only: /^(01|02|04|05|06|08|10)/ },
  /* حجم النص «أكبر» من الإعدادات: لا فيض أفقي ولا قصّ على الهاتف */
  { tag: 'phone-xl', vp: { width: 390, height: 844 }, lang: 'ar', dark: false, mobile: true, text: 'xl', only: /^(01|02|03|04|05|06|07|08|10)/ },
].filter((v) => !process.env.VIEWS || process.env.VIEWS.split(',').includes(v.tag));
const results = []; const errors = [];
const resolveHash = async (p, h) => {
  if (h === 'REQ-LEAVE') return p.evaluate(() => `#/requests/${JSON.parse(localStorage.getItem('usp-portal-v1')).requests.find((r) => r.requesterId === 'P-AHMED' && r.leave && r.status === 'completed')?.id}`);
  if (h === 'REQ-NEED') return p.evaluate(() => `#/requests/${JSON.parse(localStorage.getItem('usp-portal-v1')).requests.find((r) => r.need?.procurement?.poNo)?.id}`);
  if (h === 'POST') return p.evaluate(() => `#/home/post/${JSON.parse(localStorage.getItem('usp-portal-v1')).posts.find((x) => !x.withdrawnAt && x.media && x.media.length)?.id || JSON.parse(localStorage.getItem('usp-portal-v1')).posts[0].id}`);
  if (h === 'REQ-RET') return p.evaluate(() => `#/requests/${JSON.parse(localStorage.getItem('usp-portal-v1')).requests.find((r) => r.requesterId === 'P-AHMED' && r.status === 'returned')?.id}`);
  return h;
};
for (const v of VIEWS) {
  const ctx = await b.newContext({ viewport: v.vp, deviceScaleFactor: 1, hasTouch: v.mobile, isMobile: v.mobile, colorScheme: v.dark ? 'dark' : 'light' });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push({ view: v.tag, text: String(e).slice(0, 160) })); p.on('console', (m) => { if (m.type() === 'error') errors.push({ view: v.tag, text: m.text().slice(0, 160) }); });
  await p.goto(file + '#/home', { waitUntil: 'load' }); await p.waitForTimeout(600);
  for (const sc of SCREENS) {
    if (v.only && !v.only.test(sc.n)) continue;
    await p.evaluate(({ as, admin, lang, dark, text }) => { const s = JSON.parse(localStorage.getItem('usp-portal-v1')); s.settings.lang = lang; s.settings.theme = dark ? 'dark' : 'light'; s.settings.textSize = text || 'normal'; if (admin) { s.settings.persona = 'admin'; s.settings.actAs = undefined; } else { const w = s.people.find((x) => x.id === as); s.settings.persona = w.persona; s.settings.actAs = as; } localStorage.setItem('usp-portal-v1', JSON.stringify(s)); }, { as: sc.as, admin: !!sc.admin, lang: v.lang, dark: v.dark, text: v.text });
    const hash = await resolveHash(p, sc.h);
    await p.goto(file + hash); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1500);
    const r = await p.evaluate(({ mobile }) => {
      const issues = []; const vis = (el) => { const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) return false; const rr = el.getBoundingClientRect(); return rr.width > 0 && rr.height > 0; };
      const inFixed = (el) => { for (let a = el; a && a !== document.body; a = a.parentElement) { const pos = getComputedStyle(a).position; if (pos === 'fixed' || pos === 'sticky') return true; if (a.getAttribute('aria-hidden') === 'true') return true; } return false; };
      const txt = (el) => (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
      /* (1) مقصوص: عنصر يتجاوز حاوية تقصّ */
      const clipCandidates = Array.from(document.querySelectorAll('.ring, .qicon, .pill, .avatar, .cell-lead, .ring-c, .wg-ring-n, .badge, .count, .n, .tk, .st-ring, .rqh-ring, .seal, .stamp, .th-top, .ptl-card .n'));
      for (const el of clipCandidates) {
        if (!vis(el) || inFixed(el)) continue; const er = el.getBoundingClientRect();
        let inHScroll = false, inVScroll = false; /* داخل شريط يتمرَّر أفقياً (أو رأسياً) ما بعده لا يُعدّ قصّاً في ذلك المحور */
        for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
          const cs = getComputedStyle(a); const ox = cs.overflowX, oy = cs.overflowY; if (ox === 'visible' && oy === 'visible') continue;
          const ar = a.getBoundingClientRect(); const scrollable = (ox === 'auto' || ox === 'scroll') && a.scrollWidth > a.clientWidth + 1; const vscroll = (oy === 'auto' || oy === 'scroll') && a.scrollHeight > a.clientHeight + 1;
          if (scrollable) inHScroll = true; if (vscroll) inVScroll = true;
          const cutX = !inHScroll && (ox !== 'visible') && (er.left < ar.left - 1 || er.right > ar.right + 1); const cutY = !inVScroll && (oy !== 'visible') && (er.top < ar.top - 1 || er.bottom > ar.bottom + 1);
          if (cutX || cutY) { issues.push({ kind: 'clipped', what: `${el.className.toString().slice(0, 30)} «${txt(el)}»`, by: a.className.toString().slice(0, 40), dx: Math.round(Math.max(ar.left - er.left, er.right - ar.right)), dy: Math.round(Math.max(ar.top - er.top, er.bottom - ar.bottom)) }); break; }
        }
      }
      /* (2) تداخل: أوراق نص وأرقام ورقاقات لا يجمع بينها نسب */
      const leaves = Array.from(document.querySelectorAll('body *')).filter((el) => { if (!vis(el) || inFixed(el)) return false; const tag = el.tagName; if (['SVG', 'PATH', 'CIRCLE', 'RECT', 'G', 'LINE', 'POLYLINE', 'SCRIPT', 'STYLE', 'INPUT', 'TEXTAREA', 'SELECT', 'OPTION', 'CANVAS', 'VIDEO', 'IMG', 'USE', 'DEFS', 'LINEARGRADIENT', 'STOP', 'CLIPPATH', 'MASK'].includes(tag)) return false; const hasText = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim().length > 0); return hasText; });
      const rectsOf = (el) => { const out = []; for (const n of el.childNodes) { if (n.nodeType !== 3 || !n.textContent.trim()) continue; const rg = document.createRange(); rg.selectNodeContents(n); for (const rr of rg.getClientRects()) if (rr.width > 1 && rr.height > 1) out.push(rr); } return out; };
      const items = leaves.map((el) => ({ el, rs: rectsOf(el), box: el.getBoundingClientRect() })).filter((x) => x.rs.length);
      /* خط Cairo صندوقه أطول من سطره بـ3–4px فلا يُعدّ تداخلاً إلا ما تجاوز 5px في المحورين */
      const cross = (a, d, pad = 5) => !(a.bottom <= d.top + pad || d.bottom <= a.top + pad || a.right <= d.left + pad || d.right <= a.left + pad);
      const seen = new Set();
      for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
        const A = items[i], B = items[j]; if (!cross(A.box, B.box, 0)) continue; if (A.el.parentElement === B.el.parentElement && Math.abs(A.box.top - B.box.top) > 4) continue; if (A.el.contains(B.el) || B.el.contains(A.el)) continue;
        let hit = false; for (const ra of A.rs) { for (const rb of B.rs) if (cross(ra, rb)) { const vInt = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top); if (vInt < 9) continue; /* تقاطع صناديق Cairo لسطرين متجاورين لا تقاطع حروف */ hit = true; break; } if (hit) break; }
        if (!hit) continue; const key = `${txt(A.el)}|${txt(B.el)}`; if (seen.has(key)) continue; seen.add(key);
        issues.push({ kind: 'overlap', a: txt(A.el), b: txt(B.el), ca: A.el.className.toString().slice(0, 30), cb: B.el.className.toString().slice(0, 30) });
      }
      /* (3) أهداف لمس صغيرة على الهاتف · (4) نص صغير */
      let small = []; let tiny = [];
      if (mobile) { for (const el of document.querySelectorAll('button, a[href], [role=button], input[type=checkbox], input[type=radio], select')) { if (!vis(el) || inFixed(el)) continue; const rr = el.getBoundingClientRect(); if (rr.height < 32 || rr.width < 32) small.push(`${el.className.toString().slice(0, 24)} «${txt(el) || el.getAttribute('aria-label') || ''}» ${Math.round(rr.width)}×${Math.round(rr.height)}`); } }
      for (const x of items) { const fs = parseFloat(getComputedStyle(x.el).fontSize); if (fs < 11) tiny.push(`${x.el.className.toString().slice(0, 24)} «${txt(x.el)}» ${fs}px`); }
      const root = document.querySelector('.app-root') || document.documentElement;
      return { issues, small: Array.from(new Set(small)).slice(0, 12), smallN: new Set(small).size, tiny: Array.from(new Set(tiny)).slice(0, 12), tinyN: new Set(tiny).size, overflow: Math.max(0, root.scrollWidth - root.clientWidth, document.documentElement.scrollWidth - document.documentElement.clientWidth), height: document.documentElement.scrollHeight };
    }, { mobile: v.mobile });
    await p.screenshot({ path: `${OUT}/${sc.n}-${v.tag}.png`, fullPage: true });
    results.push({ screen: sc.n, view: v.tag, ...r });
    const flag = r.issues.length || r.overflow > 0;
    console.log(`${flag ? 'LOOK' : 'ok  '} ${sc.n} ${v.tag} · h=${r.height} · overflow ${r.overflow} · clipped ${r.issues.filter((x) => x.kind === 'clipped').length} · overlap ${r.issues.filter((x) => x.kind === 'overlap').length} · small ${r.smallN} · tiny ${r.tinyN}${r.issues.length ? '\n     ' + r.issues.slice(0, 6).map((x) => JSON.stringify(x)).join('\n     ') : ''}`);
  }
  await ctx.close();
}
await b.close();
fs.writeFileSync(`${OUT}/deeplook.json`, JSON.stringify({ results, errors }, null, 2));
const flagged = results.filter((r) => r.issues.length || r.overflow > 0);
console.log(`\nTOTAL ${results.length} shots · ${flagged.length} to look at · console errors ${errors.length}`);
if (errors.length) console.log(errors.slice(0, 6).map((e) => `${e.view}: ${e.text}`).join('\n'));
