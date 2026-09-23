// تدقيق تخطيط عام على الهاتف (400px): لا نص ولا رقاقة تتجاوز حدود خليتها أو تتقاطع مع رقاقة أخرى، ولا تمدد أفقي للصفحة — على الشاشات الرئيسية بعين الموظف والمدير والإداري، فاتحاً وداكناً
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import path from 'node:path';
const file = 'file://' + path.resolve(process.env.FILE || 'dist/index.html');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
const SCREENS = [
  { name: 'home-employee', hash: '#/home', persona: 'employee' }, { name: 'requests', hash: '#/requests', persona: 'employee' }, { name: 'me', hash: '#/me', persona: 'employee' }, { name: 'me-leaves', hash: '#/me/leaves', persona: 'employee' },
  { name: 'notifications', hash: '#/notifications', persona: 'employee' }, { name: 'new-leave', hash: '#/new/TM-01', persona: 'employee' }, { name: 'services', hash: '#/services', persona: 'employee' },
  { name: 'inbox-manager', hash: '#/inbox', persona: 'manager' }, { name: 'inbox-hr', hash: '#/inbox', persona: 'hr' }, { name: 'home-manager', hash: '#/home', persona: 'manager' },
  { name: 'policy', hash: '#/admin/policy', persona: 'admin' }, { name: 'request-page', hash: 'REQ', persona: 'employee' },
  /* v0.9 الاحتياج: المعالج، والعهدة، وسياسة الاحتياج، ومكتبا المشتريات والمستودع، وصفحة احتياج مكتمل، ومهام المستودع */
  { name: 'new-need', hash: '#/new/AS-01', as: 'P-DEPT' }, { name: 'me-custody', hash: '#/me/custody', persona: 'employee' }, { name: 'admin-need', hash: '#/admin/need', persona: 'admin' },
  { name: 'desk-procurement', hash: '#/desk/procurement', persona: 'buyer' }, { name: 'desk-store', hash: '#/desk/store', as: 'P-STORE2' }, { name: 'need-request', hash: 'NEED', persona: 'employee' }, { name: 'inbox-store', hash: '#/inbox', as: 'P-AUH' },
  /* v0.10: مهام التجهيز (المشتريات) والتقييم الفني (الجهة الفنية) وصفحة احتياج في الشراء */
  { name: 'inbox-buyer', hash: '#/inbox', as: 'P-MAJED' }, { name: 'inbox-it', hash: '#/inbox', as: 'P-ITS' }, { name: 'need-purchase', hash: 'NEEDP', persona: 'employee' },
];
const results = [];
for (const dark of [false, true]) for (const sc of SCREENS) {
  const ctx = await b.newContext({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true, colorScheme: dark ? 'dark' : 'light' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(file + '#/home', { waitUntil: 'load' }); await p.waitForTimeout(700);
  await p.evaluate(({ persona, as }) => { const s = JSON.parse(localStorage.getItem('usp-portal-v1')); if (as) { const w = s.people.find((x) => x.id === as); s.settings.persona = w.persona; s.settings.actAs = as; } else { s.settings.persona = persona; s.settings.actAs = undefined; } localStorage.setItem('usp-portal-v1', JSON.stringify(s)); }, { persona: sc.persona, as: sc.as });
  let hash = sc.hash;
  if (hash === 'NEEDP') { const id = await p.evaluate(() => JSON.parse(localStorage.getItem('usp-portal-v1')).requests.find((r) => r.need?.procurement?.poNo)?.id); hash = `#/requests/${id}`; }
  if (hash === 'NEED') { const id = await p.evaluate(() => JSON.parse(localStorage.getItem('usp-portal-v1')).requests.find((r) => r.need && r.status === 'completed')?.id); hash = `#/requests/${id}`; }
  if (hash === 'REQ') { const id = await p.evaluate(() => JSON.parse(localStorage.getItem('usp-portal-v1')).requests.find((r) => r.requesterId === 'P-AHMED' && r.leave && r.status === 'completed')?.id); hash = `#/requests/${id}`; }
  await p.goto(file + hash); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1600);
  const r = await p.evaluate(() => {
    const out = []; const docW = document.documentElement.scrollWidth;
    const cells = Array.from(document.querySelectorAll('.cell, .row, .pt-card, .ptl-card, .tile, .type-row, .type-hero, .erp-row, .hist-row, .need-card, .desk-row, .custody-card, .np-line, .ns, .nc-lines li'));
    for (const c of cells) {
      const cb = c.getBoundingClientRect(); if (cb.width === 0 || cb.height === 0) continue;
      const kids = Array.from(c.querySelectorAll('.pill, .cell-title, .cell-sub, .lh-dates, .num, .mono, b, span')).filter((el) => el.children.length === 0 && (el.textContent || '').trim().length > 0);
      for (const el of kids) { const eb = el.getBoundingClientRect(); if (eb.width === 0) continue; if (eb.left < cb.left - 1 || eb.right > cb.right + 1) out.push({ kind: 'outside', cell: c.className.slice(0, 40), text: (el.textContent || '').trim().slice(0, 40) }); }
      const pills = Array.from(c.querySelectorAll('.pill')).map((pl) => ({ el: pl, r: pl.getBoundingClientRect() }));
      const texts = Array.from(c.querySelectorAll('.cell-title, .cell-sub, .lh-dates')).map((tx) => ({ el: tx, r: tx.getBoundingClientRect() }));
      for (const pl of pills) for (const tx of texts) { if (pl.el.contains(tx.el) || tx.el.contains(pl.el)) continue; const a = pl.r, d = tx.r; const cross = !(a.bottom <= d.top + 1 || d.bottom <= a.top + 1 || a.right <= d.left + 1 || d.right <= a.left + 1); if (cross) { const range = document.createRange(); range.selectNodeContents(tx.el); const rects = Array.from(range.getClientRects()); const real = rects.some((rr) => !(a.bottom <= rr.top + 1 || rr.bottom <= a.top + 1 || a.right <= rr.left + 1 || rr.right <= a.left + 1)); if (real) out.push({ kind: 'pill-over-text', cell: c.className.slice(0, 40), pill: (pl.el.textContent || '').trim().slice(0, 30), text: (tx.el.textContent || '').trim().slice(0, 40) }); } }
    }
    return { docW, issues: out };
  });
  results.push({ screen: sc.name, dark, docW: r.docW, issues: r.issues, errs });
  if (r.issues.length) await p.screenshot({ path: `dist/ov-${sc.name}${dark ? '-dark' : ''}.png`, fullPage: true });
  await ctx.close();
}
await b.close();
let bad = 0;
for (const r of results) { const n = r.issues.length + (r.docW > 400 ? 1 : 0) + r.errs.length; bad += n; console.log(`${n ? 'FAIL' : 'PASS'} ${r.screen}${r.dark ? ' (dark)' : ''}: scrollWidth=${r.docW}${r.issues.length ? ' · ' + JSON.stringify(r.issues.slice(0, 4)) : ''}${r.errs.length ? ' · errors: ' + r.errs.join('; ') : ''}`); }
console.log(`\n${results.length - results.filter((r) => r.issues.length || r.docW > 400 || r.errs.length).length}/${results.length} screens clean`);
