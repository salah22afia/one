// وسائط المنشور (v0.14): الناشر يضيف عدة صور وفيديو، والفسيفساء والعارض والبطاقة والحدود من السياسة
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import path from 'node:path';
import fs from 'node:fs';
const file = 'file://' + path.resolve('dist/index.html');
const OUT = process.argv[2] || 'shots/v14'; fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
const errors = []; const rows = [];
const ok = (name, pass, detail = '') => { rows.push({ name, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`); };

async function open(who = 'P-MEDM', hash = '#/home', vp = { width: 390, height: 844 }) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2, hasTouch: vp.width < 600, permissions: [] });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
  await p.goto(file + '#/home', { waitUntil: 'load' }); await p.waitForTimeout(450);
  await p.evaluate((who) => { const s = JSON.parse(localStorage.getItem('usp-portal-v1')); if (who === 'admin') { s.settings.persona = 'admin'; s.settings.actAs = undefined; } else { const w = s.people.find((x) => x.id === who); s.settings.persona = w.persona; s.settings.actAs = who; } localStorage.setItem('usp-portal-v1', JSON.stringify(s)); }, who);
  await p.goto(file + hash); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1500);
  return { ctx, p };
}
/* ملفات اختبار تُولَّد في المتصفح: صور بألوان مختلفة وفيديو قصير حقيقي */
const MAKE_FILES = `async (n) => {
  const files = [];
  for (let i = 0; i < n; i++) {
    const c = document.createElement('canvas'); c.width = 1200 + i * 10; c.height = 800; const g = c.getContext('2d');
    g.fillStyle = ['#0b4a2f','#b5944d','#2f7c7a','#7c9a84','#9c7a4b','#24303a','#1f8a58'][i % 7]; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#fff'; g.font = 'bold 220px sans-serif'; g.textAlign = 'center'; g.fillText(String(i + 1), c.width / 2, c.height / 2 + 80);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9));
    files.push(new File([blob], 'photo-' + (i + 1) + '.jpg', { type: 'image/jpeg' }));
  }
  return files;
}`;
const MAKE_VIDEO = `async () => {
  const c = document.createElement('canvas'); c.width = 640; c.height = 360; const g = c.getContext('2d');
  const stream = c.captureStream(24); const rec = new MediaRecorder(stream, { mimeType: 'video/webm' });
  const chunks = []; rec.ondataavailable = (e) => chunks.push(e.data);
  rec.start();
  let t = 0; const iv = setInterval(() => { t += 1; g.fillStyle = '#0b4a2f'; g.fillRect(0, 0, 640, 360); g.fillStyle = '#e0c88a'; g.beginPath(); g.arc(320 + Math.sin(t / 3) * 120, 180, 60, 0, 7); g.fill(); }, 40);
  await new Promise((r) => setTimeout(r, 1200)); clearInterval(iv); rec.stop();
  await new Promise((r) => { rec.onstop = r; });
  const blob = new Blob(chunks, { type: 'video/webm' });
  return new File([blob], 'clip.webm', { type: 'video/webm' });
}`;

/* 1) المؤلّف: سبع صور وفيديو */
{
  const { ctx, p } = await open();
  await p.locator('.lb-link.add').scrollIntoViewIfNeeded(); await p.locator('.lb-link.add').click(); await p.waitForTimeout(800);
  ok('composer-media-block', (await p.locator('.pcx-mempty').count()) === 1, 'زر إضافة الوسائط ظاهر للخبر');
  /* حقن الملفات مباشرة في حقل الملف */
  const dt = await p.evaluateHandle(`(async () => { const mk = ${MAKE_FILES}; const mv = ${MAKE_VIDEO}; const fs = await mk(7); fs.push(await mv()); const dt = new DataTransfer(); for (const f of fs) dt.items.add(f); return dt; })()`);
  await p.locator('.pcx-media input[type=file]').evaluate((el, dt) => { el.files = dt.files; el.dispatchEvent(new Event('change', { bubbles: true })); }, dt);
  await p.waitForTimeout(4000);
  const tiles = await p.locator('.pcx-mi').count();
  ok('composer-8-items', tiles === 8, `${tiles} عنصراً في الشريط`);
  ok('composer-cover-first', (await p.locator('.pcx-mi.cover').first().locator('.pcx-mc').count()) === 1, 'أول عنصر عليه شارة الغلاف');
  ok('composer-video-duration', (await p.locator('.pcx-mi .gal-dur').count()) >= 1, 'مدة الفيديو على بلاطته');
  await p.screenshot({ path: `${OUT}/v14-1-composer-strip.png` });
  /* تحرير وسيطة: تعليق ووصف وتقديمها */
  await p.locator('.pcx-mi').nth(2).locator('.gal-t').click(); await p.waitForTimeout(700);
  await p.locator('.pcx-f input').nth(0).fill('توقيع مذكرة التفاهم في مقر الأمانة');
  await p.locator('.pcx-f input').nth(2).fill('صورة جماعية بعد التوقيع');
  await p.screenshot({ path: `${OUT}/v14-2-media-editor.png` });
  const makeCover = p.locator('.btn.soft.block');
  if (await makeCover.count()) { await makeCover.click(); await p.waitForTimeout(600); }
  ok('make-cover', (await p.locator('.pcx-mi.cover .gal-t').first().getAttribute('aria-label')) === 'photo-3.jpg', 'الصورة الثالثة صارت الغلاف');
  /* اكتب ثم انشر */
  await p.locator('.pcx-f input').first().fill('الأمانة العامة توقّع مذكرة تفاهم مع جامعة الملك سعود');
  await p.locator('.pcx-f textarea').first().fill('تعاون في التدريب والبحوث، ووقّعها الأمين العام المساعد للشؤون الإدارية والمالية.');
  await p.locator('.pcx-f textarea').nth(1).fill('وقّعت الأمانة العامة اليوم مذكرة تفاهم.\nيشمل التعاون برامج تدريبية مشتركة.');
  const sheet = p.locator('.lb-sheet').first(); await sheet.evaluate((el) => el.scrollTo(0, el.scrollHeight)); await p.waitForTimeout(500);
  await p.screenshot({ path: `${OUT}/v14-3-composer-preview.png` });
  await p.locator('.pcx .btn.primary.block').click(); await p.waitForTimeout(1600);
  const st = await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('usp-portal-v1')); const post = s.posts[0]; return { n: (post.media || []).length, cover: post.coverMediaId, first: post.media?.[0]?.id, caps: (post.media || []).filter((m) => m.caption?.ar).length, vids: (post.media || []).filter((m) => m.kind === 'video').length }; });
  ok('published-media', st.n === 8 && st.cover === st.first && st.vids === 1, JSON.stringify(st));
  await p.screenshot({ path: `${OUT}/v14-4-home-card.png`, fullPage: true });
  ok('card-badge', (await p.locator('.pc-media').count()) >= 1, 'شارة الوسائط على البطاقة');
  /* 2) القارئ في السياق نفسه (التخزين لا يُشارَك بين السياقات) */
  await p.locator('.pc').first().click(); await p.waitForTimeout(1200);
  const rest = await p.locator('.rd-gal .gal-t').count();
  ok('reader-gallery', rest === 4, `${rest} بلاطات (٤ مع «+ن»)`);
  ok('reader-more', (await p.locator('.gal-more').count()) === 1, 'بلاطة «+٣»');
  await p.locator('.rd-gal').scrollIntoViewIfNeeded(); await p.waitForTimeout(400);
  await p.screenshot({ path: `${OUT}/v14-5-reader-gallery.png` });
  await p.locator('.rd-gal .gal-t').first().click(); await p.waitForTimeout(900);
  ok('viewer-open', (await p.locator('.mv').count()) === 1, 'العارض فُتح');
  const count1 = await p.locator('.mv-count').innerText();
  await p.screenshot({ path: `${OUT}/v14-6-viewer.png` });
  /* سحب إلى التالي */
  const box = await p.locator('.mv-stage').boundingBox();
  await p.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2); await p.mouse.down();
  for (let i = 1; i <= 8; i++) { await p.mouse.move(box.x + box.width * 0.8 - i * 30, box.y + box.height / 2); await p.waitForTimeout(16); }
  await p.mouse.up(); await p.waitForTimeout(700);
  const count2 = await p.locator('.mv-count').innerText();
  ok('viewer-swipe', count1 !== count2, `${count1.trim()} → ${count2.trim()}`);
  /* سحب لأسفل للإغلاق */
  await p.mouse.move(box.x + box.width / 2, box.y + box.height * 0.4); await p.mouse.down();
  for (let i = 1; i <= 8; i++) { await p.mouse.move(box.x + box.width / 2, box.y + box.height * 0.4 + i * 30); await p.waitForTimeout(16); }
  await p.mouse.up(); await p.waitForTimeout(800);
  ok('viewer-swipe-close', (await p.locator('.mv').count()) === 0, 'السحب لأسفل أغلق العارض');
  await ctx.close();
}
/* 3) السياسة: التعميم بلا وسائط، والحد الأقصى */
{
  const { ctx, p } = await open();
  await p.locator('.lb-link.add').scrollIntoViewIfNeeded(); await p.locator('.lb-link.add').click(); await p.waitForTimeout(800);
  await p.locator('.segmented.sm button').nth(1).click(); await p.waitForTimeout(500);
  ok('circular-no-media', (await p.locator('.pcx-mempty').count()) === 0 && (await p.locator('.notice').count()) >= 1, 'التعميم لا يحمل وسائط بحسب السياسة');
  await p.screenshot({ path: `${OUT}/v14-7-circular-no-media.png` });
  await ctx.close();
}
/* 4) شاشة الإدارة: القواعد والمفتاح */
{
  const { ctx, p } = await open('admin', '#/admin/comms', { width: 1440, height: 900 });
  await p.getByRole('button', { name: /القواعد/ }).click(); await p.waitForTimeout(700);
  const ids = await p.evaluate(() => ['cp-pmax', 'cp-pimg', 'cp-pvsec', 'cp-pvid'].filter((i) => document.getElementById(i)).length);
  ok('policy-rules', ids === 4, `${ids} من 4 حقول وسائط المنشور`);
  await p.screenshot({ path: `${OUT}/v14-8-policy-rules.png` });
  await ctx.close();
}
fs.writeFileSync(`${OUT}/postmedia.json`, JSON.stringify({ rows, errors }, null, 2));
const fail = rows.filter((r) => !r.pass).length;
console.log(`TOTAL ${rows.length} · ${rows.length - fail} PASS / ${fail} FAIL · console errors ${errors.length}`);
for (const e of errors.slice(0, 6)) console.log('  ERR', e);
await b.close();
