// تدقيق مستقل لـ v0.8 → v0.8.1 «أساس الإدارة»: حالات الحافة في سلسلة الإصدارات، ونوافذ الإتاحة، وقفل الفترة؛ والهاتف والداكن والإنجليزية للمكوّنات الجديدة
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import path from 'node:path';
import fs from 'node:fs';
const file = 'file://' + path.resolve('dist/index.html');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
const errs = []; const checks = [];
const ok = (id, cond, detail) => { checks.push({ id, pass: !!cond, detail }); console.log(`${cond ? 'PASS' : 'FAIL'} ${id}: ${detail}`); };
const ph = { width: 400, height: 860 }; const lap = { width: 1440, height: 900 };
const toISO = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
const fromISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = fromISO(s); d.setDate(d.getDate() + n); return toISO(d); };
const today = toISO(Date.now());
const AR = /[؀-ۿ]/;
async function open(name, vp, hash, opts = {}) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2, colorScheme: opts.dark ? 'dark' : 'light', hasTouch: !!opts.touch, isMobile: !!opts.touch });
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error') errs.push(name + ': ' + m.text()); });
  p.on('pageerror', (e) => errs.push(name + ': ' + e.message));
  await p.goto(file + '#/home', { waitUntil: 'load' }); await p.waitForTimeout(900);
  await setPersona(p, opts);
  await p.goto(file + hash, { waitUntil: 'load' }); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(opts.wait ?? 1500);
  return { p, ctx, shot: async (n, full = false) => p.screenshot({ path: `dist/a8-${name}${n ? '-' + n : ''}.png`, fullPage: full }) };
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
const getState = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('usp-portal-v1')));
const go = async (p, hash, wait = 1500) => { await p.goto(file + hash); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(wait); if (hash.startsWith('#/new/')) resetCal(); };
const seg = (p, label) => p.locator('.policy .segmented').first().locator('button', { hasText: label }).first();
const tabs = async (p) => (await p.locator('.policy .segmented').first().locator('button').allTextContents()).map((x) => x.trim());
async function newVersion(p, kindText, pickText) {
  await p.locator('.ptl-card.new').click(); await p.waitForTimeout(900);
  await p.locator('.new-version .segmented button', { hasText: kindText }).click(); await p.waitForTimeout(300);
  if (pickText) { await p.locator('.new-version .scope-pick .pill', { hasText: pickText }).click(); await p.waitForTimeout(300); }
  await p.locator('.new-version .btn.primary').click(); await p.waitForTimeout(1300);
}
const closeSheet = async (p) => { await p.locator('.sheet .icon-btn').first().click().catch(() => {}); await p.waitForTimeout(700); };
const save = async (p, why = 'تعديل') => { await p.locator('.sb-why').fill(why); await p.locator('.savebar .btn').click(); await p.waitForTimeout(900); };
/** يفتح بطاقة نوع باسمه في لسان الأنواع ويغيّر أول رقم فيه (نافذة التقديم بعد الانتهاء) */
async function bump(p, typeText, val) { await seg(p, 'أنواع').click(); await p.waitForTimeout(500); await p.locator('.pt-card', { hasText: typeText }).first().click(); await p.waitForTimeout(900); await p.locator('.sheet input[type="number"]').first().fill(val); await p.waitForTimeout(300); await closeSheet(p); }
async function openSched(p, from, reason = 'x', ref = 'y') { await p.locator('.section-head .btn.soft').click(); await p.waitForTimeout(900); await p.locator('#sc-from').fill(from); await p.locator('#sc-reason').fill(reason); await p.locator('#sc-ref').fill(ref); await p.waitForTimeout(400); }
const schedState = async (p) => ({ txt: await p.locator('.sheet').textContent(), disabled: await p.locator('.sheet .btn.primary.block').isDisabled() });
async function schedule(p, from, reason) { await openSched(p, from, reason, 'قرار ٧٠/٢٠٢٦'); await p.locator('.sheet .btn.primary.block').click(); await p.waitForTimeout(1500); }
async function approveAwaiting(p, note = 'موافق') { await setPersona(p, { as: 'P-HRGM' }); await go(p, '#/admin/policy', 1400); await p.locator('.ptl-card.awaiting').click(); await p.waitForTimeout(800); await p.locator('.approvebar .sb-why').fill(note); await p.locator('.approvebar .btn.primary').click(); await p.waitForTimeout(1200); }
async function returnAwaiting(p, note = 'أعد النظر') { await setPersona(p, { as: 'P-HRGM' }); await go(p, '#/admin/policy', 1400); await p.locator('.ptl-card.awaiting').click(); await p.waitForTimeout(800); await p.locator('.approvebar .sb-why').fill(note); await p.locator('.approvebar .btn.secondary').click(); await p.waitForTimeout(1200); }
const day = (p, n) => p.locator('.cal-day', { hasText: new RegExp(`^${n}$`) }).first();
let calCur = { y: new Date().getFullYear(), m: new Date().getMonth() };
const resetCal = () => { calCur = { y: new Date().getFullYear(), m: new Date().getMonth() }; };
async function pickDate(p, iso) {
  const target = fromISO(iso);
  let diff = (target.getFullYear() - calCur.y) * 12 + (target.getMonth() - calCur.m);
  while (diff > 0) { await p.locator('.cal-head .icon-btn[aria-label="next"]').click(); await p.waitForTimeout(400); diff--; }
  while (diff < 0) { await p.locator('.cal-head .icon-btn[aria-label="prev"]').click(); await p.waitForTimeout(400); diff++; }
  calCur = { y: target.getFullYear(), m: target.getMonth() };
  await day(p, target.getDate()).click(); await p.waitForTimeout(350);
}
async function submitLeave(p, { typeText, from, to, ents = [], hero = false }) {
  await go(p, '#/new/TM-01', 1400);
  if (hero) await p.locator('.type-hero', { hasText: typeText }).first().click(); else await p.locator('.type-row', { hasText: typeText }).first().click();
  await p.waitForTimeout(800); await p.locator('.btn.primary.block').click(); await p.waitForTimeout(900);
  await pickDate(p, from); if (to !== from) await pickDate(p, to); await p.waitForTimeout(1500);
  for (const e of ents) { await p.locator('.ent-cell', { hasText: e }).locator('input.checkbox').check(); await p.waitForTimeout(300); }
  await p.locator('.btn.primary.block').click(); await p.waitForTimeout(800);
  if (await p.locator('input[type="file"]').count()) { const tmp = path.resolve('dist/proof.pdf'); fs.writeFileSync(tmp, '%PDF-1.4\n%demo\n'); await p.locator('input[type="file"]').setInputFiles(tmp); await p.waitForTimeout(400); }
  await p.locator('.btn.primary.block').click(); await p.waitForTimeout(800);
  await p.locator('.btn.primary.block').click(); await p.waitForTimeout(2300);
  return (await p.locator('.success-id').textContent().catch(() => '')) || '';
}
async function openTask(p, id) {
  await go(p, '#/inbox', 1500);
  const rows = p.locator('.row .cell'); const n = await rows.count();
  for (let i = 0; i < n; i++) { await rows.nth(i).click(); await p.waitForTimeout(600); const idTxt = await p.locator('.split-detail .mono').first().textContent().catch(() => ''); if (idTxt.includes(id)) return true; }
  return false;
}
const noOverflow = async (p, w = 400) => { const x = await p.evaluate(() => ({ doc: document.documentElement.scrollWidth, sheet: (() => { const s = document.querySelector('.sheet'); return s ? [s.scrollWidth, s.clientWidth] : null; })() })); return { okDoc: x.doc <= w, okSheet: !x.sheet || x.sheet[0] <= x.sheet[1] + 1, x }; };

const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null; const run = (k) => !ONLY || ONLY.includes(k);
/* ═══ أ) سلامة سلسلة الإصدارات (ت.س): مسودة بلا تغيير، والجدولة خلف الموافقة الثانية، والتطبيق فوق الطرف، والتعارض، والتراجع مع إصدار لاحق، ومسودتان بعد الإعادة ═══ */
if (run('chain')) {
  const { p, ctx, shot } = await open('chain', lap, '#/admin/policy', { persona: 'admin' });
  // ت.س-01 مسودة بلا تغيير لا تُجدوَل
  await newVersion(p, 'السياسة كلها'); await openSched(p, addDays(today, 15));
  const e = await schedState(p); await shot('1-empty-blocked', true); await closeSheet(p);
  ok('ت.س-01', e.disabled && e.txt.includes('لم تغيّر هذه المسودة شيئاً بعد') && e.txt.includes('لا تغييرات بعد'), `an empty draft cannot be scheduled: button disabled, reason shown`);
  // ت.س-02 الموافقة الثانية مفعّلة: 2026.2 (نافذة السنوية 15) تنتظر → مسودة المسار لا تُجدوَل قبل البتّ
  await p.locator('.gov-cell input.switch').check(); await p.waitForTimeout(600);
  await bump(p, 'الإجازة السنوية', '15'); await save(p, 'تمديد نافذة التقديم'); await schedule(p, today, 'تمديد نافذة التقديم للسنوية');
  const stA = await p.locator('.pv-line .pill').first().textContent();
  await newVersion(p, 'مسار واحد', 'شؤون الموظفين مباشرة');
  await p.locator('.route-ed .inline-in').first().fill('شؤون الموظفين مباشرة (محدَّث)'); await p.waitForTimeout(300); await save(p, 'تسمية المسار');
  await openSched(p, addDays(today, 3)); const aw = await schedState(p); await shot('2-awaiting-blocks', true); await closeSheet(p);
  ok('ت.س-02', stA.includes('بانتظار الموافقة الثانية') && aw.disabled && aw.txt.includes('ينتظر الإصدار 2026.2 الموافقة الثانية'), `while 2026.2 awaits second approval, scheduling another version is refused naming it: "${aw.txt.match(/ينتظر الإصدار[^.]*\./)?.[0] || ''}"`);
  // ت.س-03 بعد الاعتماد: المسودة قديمة الأساس (2026.1) وتمسّ المسار فقط → تُطبَّق فوق 2026.2 عند الجدولة، ويبقى تغيير السنوية فيها، وسجلها يُعاد حسابه
  await approveAwaiting(p); await setPersona(p, { persona: 'admin' }); await go(p, '#/admin/policy', 1400);
  await openSched(p, addDays(today, 3), 'تسمية المسار'); const rb = await schedState(p); await shot('3-rebase-notice', true);
  await p.locator('.sheet .btn.primary.block').click(); await p.waitForTimeout(1500);
  const headB = await p.locator('.pv-head').textContent(); await shot('4-rebased-header', true);
  await seg(p, 'أنواع').click(); await p.waitForTimeout(600); const annualB = await p.locator('.pt-card', { hasText: 'الإجازة السنوية' }).first().textContent();
  await seg(p, 'ماذا يتغير').click(); await p.waitForTimeout(700); const diffB = await p.locator('.diff-row').allTextContents();
  await seg(p, 'التشغيل').click(); await p.waitForTimeout(700); const opsB = await p.locator('.page').textContent();
  const sB = await getState(p); const vB = sB.policy.versions.find((v) => v.number === '2026.3');
  ok('ت.س-03', !rb.disabled && rb.txt.includes('أُنشئت هذه المسودة على 2026.1 وصدر بعدها 2026.2') && rb.txt.includes('شؤون الموظفين مباشرة') && headB.includes('أُنشئت على 2026.1 وطُبِّقت فوق 2026.2') && annualB.includes('15') && diffB.length >= 1 && diffB.every((x) => !x.includes('الإجازة السنوية')) && opsB.includes('طُبِّقت المسودة 2026.3 فوق الإصدار 2026.2') && vB.baseId === sB.policy.versions.find((v) => v.number === '2026.2').id && vB.content.types.find((t) => t.id === 'annual').windowAfterEnd === 15, `stale route draft rebased onto 2026.2: notice, header line, annual keeps 15 (baseId=${vB.baseId}, annual=${vB.content.types.find((t) => t.id === 'annual').windowAfterEnd}), diff has ${diffB.length} route rows only, ops log entry`);
  // ت.س-04 تعارض: مسودة قديمة الأساس تمسّ السنوية التي غيّرها 2026.2 → تُرفض باسم الكائن والإصدار
  await approveAwaiting(p);
  await setPersona(p, { persona: 'admin', mutate: "const v1 = s.policy.versions[0]; const c = JSON.parse(JSON.stringify(v1.content)); c.types.find((t) => t.id === 'annual').windowAfterEnd = 20; s.policy.versions.push({ id: 'V-STALE', number: '2026.4', from: '2026-12-01', scheduled: false, createdBy: 'P-HRSH', createdAt: Date.now(), reason: '', reference: '', content: c, changes: [{ at: Date.now(), by: 'P-HRSH', path: 'types.annual.windowAfterEnd', label: { ar: 'الإجازة السنوية · نافذة التقديم بعد الانتهاء (أيام عمل)', en: 'Annual leave · window' }, before: '10', after: '20', why: 'قديمة' }], baseId: v1.id, scope: { kind: 'all' } });" });
  await go(p, '#/admin/policy', 1400); await p.locator('.ptl-card.draft').first().click(); await p.waitForTimeout(600);
  await openSched(p, addDays(today, 40)); const cf = await schedState(p); await shot('5-conflict', true); await closeSheet(p);
  ok('ت.س-04', cf.disabled && cf.txt.includes('تعارض') && cf.txt.includes('الإجازة السنوية — في الإصدار 2026.2') && cf.txt.includes('الطرف الحالي 2026.3'), `a stale draft touching what 2026.2 changed is refused: "${cf.txt.match(/تعارض[^:]*:/)?.[0] || ''}" + row naming the object and version`);
  await p.locator('.section-head .btn.quiet').click(); await p.waitForTimeout(900); // إلغاء المسودة القديمة
  // ت.س-05 التراجع عن 2026.2 (سارٍ، بلا طلبات) ممنوع لأن 2026.3 المجدول بُني عليه
  await p.locator('.ptl-card.active').click(); await p.waitForTimeout(600); const fixTxt = await p.locator('.fix-box').textContent(); const revertDisabled = await p.locator('.fix-opt .btn.secondary').isDisabled(); await shot('6-revert-blocked-later', true);
  ok('ت.س-05', revertDisabled && fixTxt.includes('يوجد إصدار بعده (2026.3 من ' + addDays(today, 3) + ')'), `reverting 2026.2 is blocked because 2026.3 was built on it: "${fixTxt.match(/لا يجوز التراجع[^.]*\./)?.[0] || ''}"`);
  // ت.س-06 مسودتان بعد إعادة إصدار منتظر: الحفظ والجدولة على المختارة وحدها
  await newVersion(p, 'السياسة كلها'); await bump(p, 'إجازة الاختبارات', '12'); await save(p, 'نافذة الاختبارات'); await schedule(p, addDays(today, 10), 'نافذة الاختبارات 12');
  await newVersion(p, 'نوع إجازة واحد', 'الإجازة السنوية'); await bump(p, 'الإجازة السنوية', '18'); await save(p, 'السنوية 18');
  await returnAwaiting(p, 'أعد النظر في نافذة الاختبارات'); await setPersona(p, { persona: 'admin' }); await go(p, '#/admin/policy', 1400);
  const draftCards = await p.locator('.ptl-card.draft').count(); await shot('7-two-drafts', true);
  await p.locator('.ptl-card.draft').nth(1).click(); await p.waitForTimeout(700); const selD = await p.locator('.pv-line .num').first().textContent();
  await bump(p, 'الإجازة السنوية', '19'); await save(p, 'السنوية 19'); const subs = await p.locator('.ptl-card.draft .ptl-sub').allTextContents();
  const sTwo = await getState(p); const dC = sTwo.policy.versions.find((v) => v.number === '2026.5'); const dD = sTwo.policy.versions.find((v) => v.number === '2026.6');
  await p.locator('.ptl-card.draft').first().click(); await p.waitForTimeout(700); await seg(p, 'ماذا يتغير').click(); await p.waitForTimeout(600); const diffC = await p.locator('.diff-row').allTextContents();
  ok('ت.س-06', draftCards === 2 && selD.includes('2026.6') && dC.content.types.find((t) => t.id === 'exam').windowAfterEnd === 12 && dC.content.types.find((t) => t.id === 'annual').windowAfterEnd === 15 && dD.content.types.find((t) => t.id === 'annual').windowAfterEnd === 19 && diffC.some((x) => x.includes('إجازة الاختبارات')) && !diffC.some((x) => x.includes('الإجازة السنوية')), `two drafts after a return (2026.5 returned, 2026.6 type-scoped): saving on the selected 2026.6 changes it alone (annual 19) while 2026.5 keeps exam 12 / annual 15; subs=${JSON.stringify(subs)}`);
  await ctx.close();
}

/* ═══ ب) نوافذ الإتاحة (ت.إ): نافذة ثابتة ناقصة أو معكوسة، وأيام هجرية معكوسة، ونافذة قادمة، وموسم → دائماً يختفي من التشغيل ═══ */
if (run('avail')) {
  const { p, ctx, shot } = await open('avail', lap, '#/admin/policy', { persona: 'admin' });
  await newVersion(p, 'نوع إجازة واحد', 'إجازة الزواج');
  await p.locator('.pt-card:not(.new)').first().click(); await p.waitForTimeout(900);
  await p.locator('.sheet .avail-ed .segmented button', { hasText: 'بين تاريخين' }).click(); await p.waitForTimeout(400);
  const pillEmpty = await p.locator('.sheet .avail-live').textContent(); await shot('1-fixed-empty', true); await closeSheet(p); await save(p, 'نافذة ثابتة');
  await openSched(p, addDays(today, 15)); const s1 = await schedState(p); await shot('2-incomplete-blocked', true); await closeSheet(p);
  ok('ت.إ-01', pillEmpty.includes('التاريخان مطلوبان') && s1.disabled && s1.txt.includes('نافذة الإتاحة غير مكتملة') && s1.txt.includes('إجازة الزواج') && s1.txt.includes('التاريخان مطلوبان'), `a fixed window without dates: editor pill + scheduling refused naming the type`);
  await p.locator('.pt-card:not(.new)').first().click(); await p.waitForTimeout(900);
  await p.locator('.sheet .avail-ed input[type="date"]').nth(0).fill('2026-12-20'); await p.locator('.sheet .avail-ed input[type="date"]').nth(1).fill('2026-12-01'); await p.waitForTimeout(400);
  const pillRev = await p.locator('.sheet .avail-live').textContent(); await shot('3-fixed-reversed', true);
  await p.locator('.sheet .avail-ed input[type="date"]').nth(1).fill('2026-12-31'); await p.waitForTimeout(400); const pillUp = await p.locator('.sheet .avail-live').textContent();
  await closeSheet(p); await save(p, 'نافذة ديسمبر'); await openSched(p, addDays(today, 15)); const s2 = await schedState(p); await closeSheet(p);
  ok('ت.إ-02', pillRev.includes('تاريخ النهاية قبل البداية') && pillUp.includes('تفتح في 2026-12-20') && !s2.disabled && !s2.txt.includes('غير مكتملة'), `reversed dates flagged; a valid upcoming window says «تفتح في 2026-12-20» and scheduling is allowed`);
  // هجري معكوس
  await p.locator('.pt-card:not(.new)').first().click(); await p.waitForTimeout(900);
  await p.locator('.sheet .avail-ed .segmented button', { hasText: 'هجرية' }).click(); await p.waitForTimeout(400);
  await p.locator('.sheet .avail-ed input[type="number"]').nth(0).fill('25'); await p.locator('.sheet .avail-ed input[type="number"]').nth(1).fill('5'); await p.waitForTimeout(400);
  const pillH = await p.locator('.sheet .avail-live').textContent().catch(() => ''); await shot('4-hijri-reversed', true); await closeSheet(p); await save(p, 'هجري');
  await openSched(p, addDays(today, 15)); const s3 = await schedState(p); await closeSheet(p);
  ok('ت.إ-03', pillH.includes('اليوم الأخير قبل الأول') && s3.disabled && s3.txt.includes('إجازة الزواج') && s3.txt.includes('اليوم الأخير قبل الأول'), `reversed Hijri days flagged in the editor and block scheduling`);
  await p.locator('.section-head .btn.quiet').click(); await p.waitForTimeout(900);
  // موسم → دائماً: يختفي من التشغيل بعد السريان، ويُقبل الطلب بلا نافذة
  await newVersion(p, 'نوع إجازة واحد', 'كونوا معهم');
  await p.locator('.pt-card:not(.new)').first().click(); await p.waitForTimeout(900); await p.locator('.sheet .avail-ed .segmented button', { hasText: 'دائماً' }).click(); await p.waitForTimeout(400); await closeSheet(p); await save(p, 'كونوا معهم طوال السنة');
  await seg(p, 'ماذا يتغير').click(); await p.waitForTimeout(600); const diffS = await p.locator('.diff-row').allTextContents();
  await schedule(p, today, 'كونوا معهم بلا موسم'); await seg(p, 'التشغيل').click(); await p.waitForTimeout(800); const winTitles = await p.locator('.cell-title').allTextContents(); await shot('5-ops-without-season', true);
  await setPersona(p, { persona: 'employee' }); await go(p, '#/new/TM-01', 1400); await p.locator('.type-row', { hasText: 'كونوا معهم' }).first().click(); await p.waitForTimeout(900); const det = await p.locator('.type-detail').first().textContent(); const canGo = !(await p.locator('.btn.primary.block').first().isDisabled());
  ok('ت.إ-04', diffS.some((x) => x.includes('كونوا معهم') && x.includes('موسم')) && !winTitles.some((x) => x.includes('كونوا معهم ·')) && canGo && !det.includes('مغلقة'), `season → always: diff row, the type leaves the Operations windows list, and the employee can proceed without a window (${diffS.length} rows)`);
  await ctx.close();
}

/* ═══ ج) قفل الفترة (ت.ق): طلب إلغاء جارٍ داخل الفترة يُقفل اعتماده، ورقاقة القفل في قائمة المهام، ولا تذكير ولا تصعيد وهو مقفل، ويعود بعد الفتح ═══ */
if (run('lock')) {
  const { p, ctx, shot } = await open('lock', lap, '#/requests', { persona: 'employee', mutate: "s.balances['P-AHMED'].annual = 45; s.notifications = [];" });
  const id = await submitLeave(p, { typeText: 'الإجازة السنوية', from: '2026-10-12', to: '2026-11-11', ents: ['راتب الإجازة المقدّم'], hero: true });
  await setPersona(p, { persona: 'manager' }); await openTask(p, id); await p.locator('.split-detail .btn.primary.block', { hasText: 'اعتماد' }).click(); await p.waitForTimeout(1200);
  await setPersona(p, { as: 'P-PAYS' }); await openTask(p, id); await p.locator('#fulfil-ref').fill('PY-2026-3301'); await p.locator('.split-detail .btn.primary.block').click(); await p.waitForTimeout(1200);
  await setPersona(p, { persona: 'employee' }); await go(p, `#/requests/${id}`, 1300); await p.locator('.cancel-block .btn').click(); await p.waitForTimeout(900); await p.locator('#cancel-reason').fill('أُلغي السفر'); await p.locator('.sheet .btn.primary.block').click(); await p.waitForTimeout(1600);
  const cancelId = p.url().split('/').pop();
  // إقفال الفترة حتى نهاية أكتوبر
  await setPersona(p, { persona: 'admin' }); await go(p, '#/admin/policy', 1400); await seg(p, 'التشغيل').click(); await p.waitForTimeout(800);
  await p.locator('#pc-until').fill('2026-11-30'); await p.locator('#pc-reason').fill('صُدِّر تقرير نوفمبر'); await p.locator('#pc-ref').fill('HR-ATT-2026-11'); await p.waitForTimeout(500); const inflightTxt = await p.locator('.inflight').textContent().catch(() => '');
  await p.locator('.btn.primary', { hasText: 'إقفال الفترة' }).first().click(); await p.waitForTimeout(1000); await shot('1-closed', true);
  // مهمة الرواتب على الإلغاء: رقاقة في القائمة، وزر معطّل مع السبب
  await setPersona(p, { as: 'P-PAYS' }); await go(p, '#/inbox', 1500); const rowTxt = await p.locator('.row', { hasText: 'إلغاء إجازة' }).filter({ hasText: 'أحمد' }).first().textContent().catch(() => ''); await shot('2-inbox-lock-pill', true);
  const found = await openTask(p, cancelId); const detail = await p.locator('.split-detail').textContent(); const approveDisabled = await p.locator('.split-detail .btn.primary.block').first().isDisabled(); await shot('3-cancel-task-locked', true);
  ok('ت.ق-01', found && inflightTxt.includes('إلغاء') && rowTxt.includes('الفترة مقفلة') && approveDisabled && detail.includes('الفترة مقفلة حتى 2026-11-30'), `an in-flight cancellation dated inside the closed period: listed before closing (${inflightTxt.includes('إلغاء')}), lock pill in the inbox row (${rowTxt.includes('الفترة مقفلة')}), approval disabled (${approveDisabled}) with the reason (${detail.includes('الفترة مقفلة حتى 2026-11-30')}) · found=${found} · inflight="${inflightTxt.slice(0, 120)}" · row="${rowTxt.slice(0, 120)}"`);
  // المهلة: الخطوة بدأت قبل ١٠ أيام → لا تذكير ولا تصعيد وهي مقفلة؛ بعد الفتح يصل التأخر
  await setPersona(p, { as: 'P-PAYS', mutate: `const r = s.requests.find((x) => x.id === '${cancelId}'); const st = r.steps.find((x) => x.status === 'current'); st.startedAt = Date.now() - 10 * 86400000; s.notifications = [];` });
  await go(p, '#/notifications', 1500); const nLocked = await p.locator('.page').textContent(); const sL = await getState(p); const stL = sL.requests.find((x) => x.id === cancelId).steps.find((x) => x.status === 'current');
  await setPersona(p, { persona: 'admin' }); await go(p, '#/admin/policy', 1400); await seg(p, 'التشغيل').click(); await p.waitForTimeout(800); await p.locator('.btn', { hasText: 'فتح الفترة' }).first().click(); await p.waitForTimeout(1000);
  await setPersona(p, { as: 'P-PAYS' }); await go(p, '#/notifications', 1500); const nOpen = await p.locator('.page').textContent(); const sO = await getState(p); const stO = sO.requests.find((x) => x.id === cancelId).steps.find((x) => x.status === 'current'); await shot('4-overdue-after-reopen', true);
  ok('ت.ق-02', !nLocked.includes(cancelId) && !stL.remindedAt && !stL.escalatedAt && nOpen.includes(cancelId) && (stO.escalatedAt || stO.remindedAt), `while locked no reminder/escalation fires for the locked step (reminded=${!!stL.remindedAt}, escalated=${!!stL.escalatedAt}); after reopening the overdue notice arrives (escalated=${!!stO.escalatedAt})`);
  await ctx.close();
}

/* ═══ د) الهاتف (ت.ه): المكوّنات الجديدة بلا تمدد أفقي — ورقة الإصدار الجديد، والمسودة المحدودة، ومحرر الإتاحة، وسجل النوع، ونموذج الإقفال، وملحق التعديل ═══ */
if (run('phone')) {
  const { p, ctx, shot } = await open('phone', ph, '#/admin/policy', { persona: 'admin', touch: true });
  const res = {};
  await p.locator('.ptl-card.new').click(); await p.waitForTimeout(900); res.newVersion = await noOverflow(p); await shot('1-new-version', true);
  await p.locator('.new-version .segmented button', { hasText: 'نوع إجازة واحد' }).click(); await p.waitForTimeout(300); await p.locator('.new-version .scope-pick .pill', { hasText: 'إجازة الحج' }).click(); await p.waitForTimeout(300); await p.locator('.new-version .btn.primary').click(); await p.waitForTimeout(1300);
  res.scoped = await noOverflow(p); await shot('2-scoped-draft', true);
  await p.locator('.pt-card:not(.new)').first().click(); await p.waitForTimeout(1000); res.editor = await noOverflow(p); await shot('3-type-editor-hijri', true);
  await p.locator('.sheet .avail-ed .segmented button', { hasText: 'بين تاريخين' }).click(); await p.waitForTimeout(400); res.fixed = await noOverflow(p); await shot('4-editor-fixed', true);
  await p.locator('.sheet .avail-ed .segmented button', { hasText: 'موسم' }).click(); await p.waitForTimeout(400); res.season = await noOverflow(p); await shot('5-editor-season', true);
  await closeSheet(p); await p.locator('.section-head .btn.quiet').click(); await p.waitForTimeout(900);
  await seg(p, 'المسارات').click(); await p.waitForTimeout(800); await p.locator('.route-ed .pt-last').first().click(); await p.waitForTimeout(900); res.history = await noOverflow(p); await shot('6-route-history', true); await closeSheet(p);
  await seg(p, 'التشغيل').click(); await p.waitForTimeout(800); await p.locator('#pc-until').fill('2026-10-15'); await p.waitForTimeout(500); res.close = await noOverflow(p); await shot('7-close-form', true);
  await p.locator('.pv-line .btn.quiet').click(); await p.waitForTimeout(1200); res.doc = await noOverflow(p); await shot('8-document', true); await closeSheet(p);
  const bad = Object.entries(res).filter(([, v]) => !v.okDoc || !v.okSheet);
  ok('ت.ه-01', bad.length === 0, bad.length ? `overflow in: ${bad.map(([k, v]) => `${k} ${JSON.stringify(v.x)}`).join('; ')}` : `no horizontal overflow in ${Object.keys(res).length} new views on a 400px phone`);
  await ctx.close();
}

/* ═══ هـ) الداكن: لقطات للمكوّنات الجديدة (تُراجع بالعين) ═══ */
if (run('dark')) {
  const { p, ctx, shot } = await open('dark', lap, '#/admin/policy', { persona: 'admin', dark: true });
  await newVersion(p, 'نوع إجازة واحد', 'إجازة الحج'); await shot('1-scoped-draft', true);
  await p.locator('.pt-card:not(.new)').first().click(); await p.waitForTimeout(1000); await shot('2-editor-hijri', true); await closeSheet(p);
  await openSched(p, addDays(today, 15)); await shot('3-schedule-empty', true); await closeSheet(p);
  await p.locator('.section-head .btn.quiet').click(); await p.waitForTimeout(900);
  await seg(p, 'التشغيل').click(); await p.waitForTimeout(800); await p.locator('#pc-until').fill('2026-10-15'); await p.waitForTimeout(500); await shot('4-close-form', true);
  await ctx.close();
}

/* ═══ و) الإنجليزية (ت.ن): لا تسرّب عربي في المكوّنات الجديدة ═══ */
if (run('en')) {
  const { p, ctx, shot } = await open('en', lap, '#/admin/policy', { persona: 'admin', lang: 'en' });
  const leaks = [];
  const check = async (name, sel) => { const t = (await p.locator(sel).allTextContents()).join(' '); if (AR.test(t)) leaks.push(`${name}: "${t.match(/[؀-ۿ][^A-Za-z]{0,30}/)?.[0]}"`); };
  await p.locator('.ptl-card.new').click(); await p.waitForTimeout(900); await check('new-version', '.new-version'); await shot('1-new-version', true);
  await p.locator('.new-version .segmented button', { hasText: 'One leave type' }).click(); await p.waitForTimeout(300); await p.locator('.new-version .scope-pick .pill', { hasText: 'Hajj' }).click(); await p.waitForTimeout(300); await p.locator('.new-version .btn.primary').click(); await p.waitForTimeout(1300);
  await check('scope-line', '.pv-scope'); await check('notice', '.notice.tint'); await check('type-card', '.pt-card .pt-last'); await shot('2-scoped', true);
  await p.locator('.pt-card:not(.new)').first().click(); await p.waitForTimeout(1000); await check('avail-editor', '.avail-ed'); await check('history', '.obj-hist'); await shot('3-editor', true); await closeSheet(p);
  await p.locator('.section-head .btn.soft').click(); await p.waitForTimeout(900); await p.locator('#sc-from').fill(addDays(today, 15)); await p.waitForTimeout(400); await check('schedule', '.sheet .notice'); await shot('4-schedule', true); await closeSheet(p);
  await p.locator('.section-head .btn.quiet').click(); await p.waitForTimeout(900);
  await p.locator('.policy .segmented').first().locator('button', { hasText: 'Operations' }).first().click(); await p.waitForTimeout(800); await p.locator('#pc-until').fill('2026-10-15'); await p.waitForTimeout(500); await check('close-form', '.inflight'); await check('safe-close', '.cell', ); await shot('5-close-form', true);
  ok('ت.ن-01', leaks.length === 0, leaks.length ? `Arabic leaked into English UI: ${leaks.join(' | ')}` : 'no Arabic in the new components in English');
  await ctx.close();
}

await b.close();
fs.writeFileSync('dist/audit-v8-report.json', JSON.stringify({ checks, errs }, null, 2));
console.log(`\n${checks.filter((c) => c.pass).length}/${checks.length} passed · console errors: ${errs.length}`);
if (errs.length) console.log(errs.join('\n'));
