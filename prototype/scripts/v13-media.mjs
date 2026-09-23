// مؤلّف القصة بالوسائط: صورة ثم فيديو من الجهاز، بمعاينة ونشر وعرض، والصوت، والبقاء بعد إعادة التحميل (IndexedDB)
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import path from 'node:path';
import fs from 'node:fs';
const file = 'file://' + path.resolve('dist/index.html');
const OUT = process.argv[2] || 'shots/v13'; fs.mkdirSync(OUT, { recursive: true });
const S = '/tmp/claude-0/-home-claude/106f252d-52d3-53d2-abf8-4f615a3e35bb/scratchpad';
const PHOTO = process.argv[3] || `${S}/test-photo.jpg`, VIDEO = process.argv[4] || `${S}/test-video.webm`; // chromium بلا H.264؛ في Chrome وSafari يعمل mp4
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
const errors = []; const rows = [];
/* قصتي تُفتح من أول مقطع؛ مقطعي الجديد آخرها */
const toLast = async (p) => { const n = await p.locator('.stv-bar').count(); for (let i = 1; i < n; i++) { await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(450); } }; const ok = (name, cond, detail = '') => { rows.push({ name, ok: !!cond, detail }); console.log(`${cond ? 'PASS' : 'FAIL'} ${name} ${detail}`); };
async function open({ vp = { width: 390, height: 844 }, lang = 'ar', ctx0 }) {
  const ctx = ctx0 || await b.newContext({ viewport: vp, deviceScaleFactor: 2, hasTouch: vp.width < 600 });
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); }); p.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  await p.goto(file + '#/home', { waitUntil: 'load' }); await p.waitForTimeout(400);
  await p.evaluate((lang) => { const s = JSON.parse(localStorage.getItem('usp-portal-v1')); const w = s.people.find((x) => x.id === 'P-MEDM'); s.settings.persona = w.persona; s.settings.actAs = 'P-MEDM'; s.settings.lang = lang; s.settings.theme = 'auto'; localStorage.setItem('usp-portal-v1', JSON.stringify(s));  }, lang);
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1600);
  return { ctx, p };
}
/* 1) الهاتف: صورة */
const { ctx, p } = await open({});
await p.locator('.stry.add').click(); await p.waitForTimeout(800); await p.screenshot({ path: `${OUT}/media-composer-empty-phone.png` });
await p.locator('input[type=file]').setInputFiles(PHOTO); await p.waitForTimeout(1200);
ok('photo-preview', await p.locator('.lb-sp img.stv-media').count() === 1, await p.locator('.lb-sp-badge').textContent());
await p.fill('.lb-field textarea', 'صباح الخير من فريق تمكين الأعمال'); await p.waitForTimeout(300); await p.screenshot({ path: `${OUT}/media-composer-photo-phone.png` });
await p.locator('.lb-sheet .btn.primary').click(); await p.waitForTimeout(1200); await p.screenshot({ path: `${OUT}/media-published-phone.png` });
await p.locator('.stry.mine').first().click(); await p.waitForTimeout(900); await toLast(p); await p.waitForTimeout(500);
ok('photo-in-viewer', await p.locator('.stv .stv-slide img.stv-media').count() === 1);
await p.screenshot({ path: `${OUT}/media-viewer-photo-phone.png` });
await p.locator('.stv-x').click(); await p.waitForTimeout(500);
/* 2) الهاتف: فيديو */
await p.locator('.stry.add').click(); await p.waitForTimeout(700);
await p.locator('input[type=file]').setInputFiles(VIDEO); await p.waitForTimeout(1500);
const badge = await p.locator('.lb-sp-badge').textContent();
ok('video-preview', await p.locator('.lb-sp video.stv-media').count() === 1 && /6/.test(badge || ''), badge);
const playing = await p.locator('.lb-sp video').evaluate((v) => !v.paused && v.muted); ok('video-preview-playing-muted', playing);
await p.locator('.lb-sp .stv-snd').click(); await p.waitForTimeout(200); ok('preview-unmute', await p.locator('.lb-sp video').evaluate((v) => !v.muted));
await p.fill('.lb-field textarea', 'جولة في مقر الإدارة الجديد'); await p.waitForTimeout(400); await p.screenshot({ path: `${OUT}/media-composer-video-phone.png` });
await p.locator('.lb-sheet .btn.primary').click(); await p.waitForTimeout(1500);
await p.locator('.stry.mine').first().click(); await p.waitForTimeout(900); await toLast(p); await p.waitForTimeout(900);
ok('video-in-viewer', await p.locator('.stv .stv-slide video.stv-media').count() === 1);
ok('viewer-video-playing', await p.locator('.stv video').evaluate((v) => !v.paused));
ok('viewer-bars', await p.locator('.stv-bar').count() >= 3, String(await p.locator('.stv-bar').count()));
await p.screenshot({ path: `${OUT}/media-viewer-video-phone.png` });
await p.locator('.stv .stv-snd:not(.stv-del)').click(); await p.waitForTimeout(200); ok('viewer-unmute', await p.locator('.stv video').evaluate((v) => !v.muted));
/* hold pauses the video */
await p.mouse.move(195, 420); await p.mouse.down(); await p.waitForTimeout(500); ok('hold-pauses-video', await p.locator('.stv video').evaluate((v) => v.paused)); await p.mouse.up(); await p.waitForTimeout(300); ok('release-resumes', await p.locator('.stv video').evaluate((v) => !v.paused));
await p.locator('.stv-x').click(); await p.waitForTimeout(400);
/* 3) البقاء بعد إعادة التحميل */
await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1600);
await p.locator('.stry.mine').first().click(); await p.waitForTimeout(900); await toLast(p); await p.waitForTimeout(1200);
ok('persists-after-reload', await p.locator('.stv .stv-slide video.stv-media, .stv .stv-slide img.stv-media').count() === 1);
await p.keyboard.press('Escape'); await p.waitForTimeout(300);
/* 4) حدود: ملف غير مدعوم */
fs.writeFileSync(`${S}/bad.txt`, 'x');
await p.locator('.stry.add').click(); await p.waitForTimeout(600); await p.locator('input[type=file]').setInputFiles(`${S}/bad.txt`); await p.waitForTimeout(400);
ok('bad-file-error', await p.locator('.lb-sp-err').count() === 1, await p.locator('.lb-sp-err').textContent());
await p.keyboard.press('Escape'); await p.waitForTimeout(300);
await ctx.close();
/* 5) الحاسوب: المؤلّف بعمودين والعارض بالفيديو */
{
  const { ctx, p } = await open({ vp: { width: 1440, height: 900 } });
  await p.locator('.stry.add').click(); await p.waitForTimeout(700); await p.locator('input[type=file]').setInputFiles(PHOTO); await p.waitForTimeout(1200);
  await p.fill('.lb-field textarea', 'صباح الخير من فريق تمكين الأعمال'); await p.waitForTimeout(300); await p.screenshot({ path: `${OUT}/media-composer-photo-desk.png` });
  await p.locator('.lb-sheet .btn.primary').click(); await p.waitForTimeout(1200);
  await p.locator('.stry.mine').first().click(); await p.waitForTimeout(900); await toLast(p); await p.waitForTimeout(600); await p.screenshot({ path: `${OUT}/media-viewer-photo-desk.png` });
  ok('desk-photo-in-viewer', await p.locator('.stv .stv-slide img.stv-media').count() === 1);
  await p.keyboard.press('Escape'); await ctx.close();
}
fs.writeFileSync(`${OUT}/media-results.json`, JSON.stringify({ rows, errors }, null, 2));
console.log(`TOTAL ${rows.length} · ${rows.filter((r) => r.ok).length} PASS / ${rows.filter((r) => !r.ok).length} FAIL · console errors ${errors.length}`); for (const e of errors.slice(0, 6)) console.log('  ', e);
await b.close();
