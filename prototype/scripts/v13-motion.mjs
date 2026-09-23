// تدقيق الحركة في المختبر: يلتقط إطارات متتابعة أثناء كل انتقال (تبديل لسان، دفع/رجوع، لوح، عارض القصص، تمرير الرأس، المحفظة، خيط التنبيهات)
// ويجمعها شريطاً واحداً لكل حالة (shots/v13-motion/*.png) مع قياس: أقصى عرض للمستند أثناء الانتقال (لا فيض أفقي)، وأخطاء وحدة التحكم.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import path from 'node:path';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const file = 'file://' + path.resolve('dist/index.html');
const OUT = process.argv[2] || 'shots/v13-motion'; fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
const errors = []; const rows = [];
async function open({ who = 'P-AHMED', width = 390, height = 844, lang = 'ar', dark = false, hash = '#/home', reduced = false }) {
  const ctx = await b.newContext({ viewport: { width, height }, deviceScaleFactor: 1, colorScheme: dark ? 'dark' : 'light', hasTouch: width < 600, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error') errors.push({ who, hash, text: m.text().slice(0, 200) }); }); p.on('pageerror', (e) => errors.push({ who, hash, text: String(e).slice(0, 200) }));
  await p.goto(file + '#/home', { waitUntil: 'load' }); await p.waitForTimeout(300);
  await p.evaluate(({ who, lang }) => { const s = JSON.parse(localStorage.getItem('usp-portal-v1')); if (who === 'admin') { s.settings.persona = 'admin'; s.settings.actAs = undefined; } else { const w = s.people.find((x) => x.id === who); s.settings.persona = w.persona; s.settings.actAs = who; } s.settings.lang = lang; s.settings.theme = 'auto'; localStorage.setItem('usp-portal-v1', JSON.stringify(s));  }, { who, lang });
  await p.goto(file + hash); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1600);
  return { ctx, p };
}
/** يلتقط n إطاراً كل step مللي ثانية ويعيدها مع أقصى عرض للمستند خلالها */
async function film(p, n = 12, step = 45) {
  const frames = []; let maxW = 0; let minW = 1e9;
  for (let i = 0; i < n; i++) {
    const t0 = Date.now();
    frames.push(await p.screenshot({ type: 'png' }));
    const w = await p.evaluate(() => document.documentElement.scrollWidth); maxW = Math.max(maxW, w); minW = Math.min(minW, w);
    const dt = Date.now() - t0; if (dt < step) await p.waitForTimeout(step - dt);
  }
  return { frames, maxW, minW };
}
async function scene(name, p, act, { n = 12, step = 45, cols = 6, scale = 0.5, cropH = 0, width = 390 } = {}) {
  await act();
  const { frames, maxW, minW } = await film(p, n, step);
  const dir = `${OUT}/frames/${name}`; fs.mkdirSync(dir, { recursive: true }); frames.forEach((f, i) => fs.writeFileSync(`${dir}/${String(i).padStart(2, '0')}.png`, f));
  execFileSync('python3', ['scripts/strip.py', dir, `${OUT}/${name}.png`, String(cols), String(scale), String(cropH)]);
  const ok = maxW <= width; rows.push({ name, ok, detail: `docWidth ${minW}…${maxW} (viewport ${width})` });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}: ${rows[rows.length - 1].detail}`);
}
const ids = await (async () => { const { ctx, p } = await open({}); const r = await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('usp-portal-v1')); const mine = s.requests.filter((x) => x.requesterId === 'P-AHMED').sort((a, b) => b.createdAt - a.createdAt); return { leave: mine.find((x) => x.leave && x.status === 'in_review')?.id, ret: mine.find((x) => x.status === 'returned')?.id }; }); await ctx.close(); return r; })();

/* 1) تبديل لسان: الرئيسية → مهامي → الخدمات */
{ const { ctx, p } = await open({}); await scene('tab-home-to-inbox', p, () => p.locator('.lb-tabbar .tab').nth(1).click()); await scene('tab-inbox-to-services', p, () => p.locator('.lb-tabbar .tab').nth(2).click()); await ctx.close(); }
/* 2) دفع ورجوع: طلباتي → صفحة الطلب → رجوع */
{ const { ctx, p } = await open({ hash: '#/requests' }); await scene('push-request', p, () => p.locator('.rq').first().click(), { n: 14 }); await p.waitForTimeout(600); await scene('pop-request', p, () => p.locator('.lp-top .back-btn').click(), { n: 14 }); await ctx.close(); }
/* 2-ب) الدفع بالإنجليزية (الاتجاه معكوس) */
{ const { ctx, p } = await open({ hash: '#/requests', lang: 'en' }); await scene('push-request-en', p, () => p.locator('.rq').first().click(), { n: 10 }); await ctx.close(); }
/* 3) ملفي → المحفظة (دفع) → تقديم بطاقة (layout) */
{ const { ctx, p } = await open({ hash: '#/me' }); await scene('push-me-docs', p, () => p.locator('.mw').nth(1).click(), { n: 12 }); await p.waitForTimeout(700); await scene('wallet-front', p, () => p.locator('.pass').nth(2).click({ position: { x: 60, y: 30 } }), { n: 14, step: 40 }); await ctx.close(); }
/* 4) لوح المهمة من الصف (مديرة) وإغلاقه */
{ const { ctx, p } = await open({ who: 'P-MONA', hash: '#/inbox' }); await scene('sheet-task-open', p, () => p.locator('.lrow').first().click(), { n: 12 }); await p.waitForTimeout(500); await scene('sheet-task-close', p, () => p.keyboard.press('Escape'), { n: 12 }); await ctx.close(); }
/* 5) عارض القصص: فتح (تكبير) ثم إغلاق */
{ const { ctx, p } = await open({}); await scene('story-open', p, () => p.locator('.stry').first().click(), { n: 12, step: 40 }); await p.waitForTimeout(400); await scene('story-close', p, () => p.locator('.stv-x').click(), { n: 10, step: 40 }); await ctx.close(); }
/* 6) تمرير الرئيسية: الرأس يتنفس، والشريط الزجاجي يظهر، وشريط الألسنة يتصاغر ثم يعود */
{ const { ctx, p } = await open({}); await scene('home-scroll-down', p, async () => { for (let i = 0; i < 8; i++) { await p.mouse.wheel(0, 40); await p.waitForTimeout(30); } }, { n: 12, step: 60, cropH: 844 }); await scene('home-scroll-up', p, async () => { for (let i = 0; i < 8; i++) { await p.mouse.wheel(0, -40); await p.waitForTimeout(30); } }, { n: 10, step: 60 }); await ctx.close(); }
/* 6-ب) تمرير صفحة بعنوان كبير: العنوان يذوب في الشريط الزجاجي وزر الرجوع يبقى */
{ const { ctx, p } = await open({ hash: `#/requests/${ids.leave}` }); await scene('page-scroll-title', p, async () => { for (let i = 0; i < 6; i++) { await p.mouse.wheel(0, 40); await p.waitForTimeout(30); } }, { n: 10, step: 60 }); await ctx.close(); }
/* 7) خيط التنبيهات يُفتح */
{ const { ctx, p } = await open({ hash: '#/notifications' }); const th = p.locator('.nt-row').filter({ has: p.locator('.lb-chev') }).first(); await scene('notif-thread', p, () => th.click(), { n: 10, step: 45 }); await ctx.close(); }
/* 8) الحاسوب: تبديل من الشريط الجانبي، وفتح مهمة في التفاصيل */
{ const { ctx, p } = await open({ width: 1440, height: 900, who: 'P-MONA' }); await scene('desk-side-inbox', p, () => p.locator('.lb-side .side-item').nth(1).click(), { n: 10, cols: 5, scale: 0.3, width: 1440 }); await p.waitForTimeout(400); await scene('desk-task-select', p, () => p.locator('.lrow').nth(1).click(), { n: 8, cols: 4, scale: 0.3, width: 1440 }); await ctx.close(); }
/* 8-ب) الرجوع يستعيد موضع التمرير (الخدمات → مجال → رجوع)، وزر الرجوع في الشريط الزجاجي يعمل بعد التمرير (التنبيهات) */
{
  const { ctx, p } = await open({ hash: '#/services' });
  await p.mouse.move(195, 500); for (let i = 0; i < 14; i++) { await p.mouse.wheel(0, 60); await p.waitForTimeout(25); } await p.waitForTimeout(400);
  const before = await p.evaluate(() => window.scrollY);
  await p.locator('.dm').last().click(); await p.waitForTimeout(900);
  const onDetail = await p.evaluate(() => window.scrollY);
  await scene('pop-restore-film', p, () => p.locator('.lp-top .back-btn').click(), { n: 8, step: 30 }); await p.waitForTimeout(500);
  const after = await p.evaluate(() => window.scrollY); const mini = await p.locator('.lb-tabs.mini').count();
  const ok = before > 100 && onDetail === 0 && Math.abs(after - before) < 4 && mini === 0;
  rows.push({ name: 'pop-restores-scroll', ok, detail: `list ${before} → detail ${onDetail} → back ${after} · tabbar mini ${mini}` }); console.log(`${ok ? 'PASS' : 'FAIL'} pop-restores-scroll: ${rows[rows.length - 1].detail}`);
  await ctx.close();
}
{
  const { ctx, p } = await open({ hash: '#/notifications' });
  await p.mouse.move(195, 500); for (let i = 0; i < 6; i++) { await p.mouse.wheel(0, 60); await p.waitForTimeout(25); } await p.waitForTimeout(400);
  const y = await p.evaluate(() => window.scrollY); const barO = await p.evaluate(() => getComputedStyle(document.querySelector('.lp-bar')).opacity); await p.locator('.lp-bar .back-btn').click(); await p.waitForTimeout(600);
  const hash = await p.evaluate(() => location.hash); const ok2 = Number(barO) > 0.9 && hash === '#/home';
  rows.push({ name: 'glass-bar-back', ok: ok2, detail: `scrollY ${y} · bar opacity ${barO} · after click ${hash}` }); console.log(`${ok2 ? 'PASS' : 'FAIL'} glass-bar-back: ${rows[rows.length - 1].detail}`);
  await ctx.close();
}
/* 9) الحركة المخفَّضة: الدفع تلاشٍ بلا انزلاق */
{ const { ctx, p } = await open({ hash: '#/requests', reduced: true }); await scene('reduced-push', p, () => p.locator('.rq').first().click(), { n: 8 }); await ctx.close(); }
fs.writeFileSync(`${OUT}/summary.json`, JSON.stringify({ rows, errors }, null, 2));
console.log(`TOTAL ${rows.length} scenes · ${rows.filter((r) => r.ok).length} PASS / ${rows.filter((r) => !r.ok).length} FAIL · console errors ${errors.length}`); for (const e of errors.slice(0, 8)) console.log('  ', e.who, e.hash, e.text);
await b.close();
