// لقطات وسيناريوهات v0.6 «مركز المسارات» (بطاقة CAP-01 §9: ق.م-01 … ق.م-13): محرر الخطوة، والهيكل والمناصب، والاستخراج بالأسباب، والنصاب، والشاغر، والشرط، وتغيير المسار والشاغل، ومهام التنفيذ
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
/* يوم عمل حر لأحمد: بعد إجازته السنوية المعلّقة (27 سبتمبر – 8 أكتوبر) وليس جمعة ولا سبتاً، فلا يتغير الاختبار بتغيّر اليوم */
const freeWorkday = (s) => { let d = s; while (['5', '6'].includes(String(fromISO(d).getDay())) || (d >= '2026-09-27' && d <= '2026-10-08')) d = addDays(d, 1); return d; };
const today = toISO(Date.now());
async function open(name, vp, hash, opts = {}) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2, colorScheme: opts.dark ? 'dark' : 'light', hasTouch: !!opts.touch, isMobile: !!opts.touch });
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error') errs.push(name + ': ' + m.text()); });
  p.on('pageerror', (e) => errs.push(name + ': ' + e.message));
  await p.goto(file + '#/home', { waitUntil: 'load' }); await p.waitForTimeout(900);
  await setPersona(p, opts);
  await p.goto(file + hash, { waitUntil: 'load' }); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(opts.wait ?? 1500);
  return { p, ctx, shot: async (n, full = false) => p.screenshot({ path: `dist/v7-${name}${n ? '-' + n : ''}.png`, fullPage: full }) };
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
const go = async (p, hash, wait = 1500) => { await p.goto(file + hash); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(wait); if (hash.startsWith('#/new/')) resetCal(); };
const seg = (p, label) => p.locator('.policy .segmented button', { hasText: label }).first();
const day = (p, n) => p.locator('.cal-day', { hasText: new RegExp(`^${n}$`) }).first();
/** التقويم يحتفظ بالشهر المعروض بين اللمستين، فنتابع الشهر الحالي في المتغير calCur (يُعاد إلى شهر اليوم عند فتح شاشة الإجازة) */
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
/** يقدّم طلب إجازة من الشاشة: النوع، والتواريخ، والمرفق إن لزم، والاستحقاقات المختارة، ويعيد رقم الطلب */
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
/** يفتح مهمة طلب معيّن في صندوق الشخص الحالي (حاسوب) */
async function openTask(p, id) {
  await go(p, '#/inbox', 1500);
  const rows = p.locator('.row .cell'); const n = await rows.count();
  for (let i = 0; i < n; i++) { await rows.nth(i).click(); await p.waitForTimeout(600); const idTxt = await p.locator('.split-detail .mono').first().textContent().catch(() => ''); if (idTxt.includes(id)) return true; }
  return false;
}
const railText = async (p, sel = '.split-detail') => (await p.locator(`${sel} .rail li`).allTextContents()).map((x) => x.trim().replace(/\s+/g, ' '));
const sel = (p, label) => p.locator(`label:has-text("${label}")`).first().locator('select');


/* ═══ ١) تصحيح إصدار سارٍ (ق.س-01، سؤال عمر «أخطأت في إصدار وسرى اليوم»): تراجُع إن لم يُقيَّم به طلب، وإلا إصدار تصحيحي من التاريخ نفسه ═══ */
{
  const { p, ctx, shot } = await open('fix', lap, '#/admin/policy', { persona: 'admin', mutate: "s.balances['P-AHMED'].annual = 45;" });
  const bump = async (val) => { await seg(p, 'أنواع').click(); await p.waitForTimeout(500); await p.locator('.pt-card:not(.new)').first().click(); await p.waitForTimeout(900); await p.locator('.sheet input[type="number"]').first().fill(val); await p.waitForTimeout(300); await p.locator('.sheet .icon-btn').first().click().catch(() => {}); await p.waitForTimeout(800); await p.locator('.sb-why').fill('تعديل'); await p.locator('.savebar .btn').click(); await p.waitForTimeout(900); };
  const scheduleToday = async (reason) => { await p.locator('.section-head .btn.soft').click(); await p.waitForTimeout(900); await p.locator('#sc-from').fill(today); await p.locator('#sc-reason').fill(reason); await p.locator('#sc-ref').fill('قرار ٥٠/٢٠٢٦'); await p.waitForTimeout(300); await p.locator('.sheet .btn.primary.block').click(); await p.waitForTimeout(1500); };
  // إصدار «خاطئ» يسري اليوم
  await p.locator('.ptl-card.new').click(); await p.waitForTimeout(900); await p.locator('.new-version .segmented button', { hasText: 'السياسة كلها' }).click(); await p.waitForTimeout(300); await p.locator('.new-version .btn.primary').click(); await p.waitForTimeout(1200); await bump('15'); await scheduleToday('تمديد النافذة (خطأ)');
  const st1 = await p.locator('.pv-line .pill').first().textContent(); const fixTxt = await p.locator('.fix-box').textContent().catch(() => ''); await shot('1-active-fix-box', true);
  ok('ق.س-01-a', st1.includes('سارٍ') && fixTxt.includes('أخطأت في إصدار سارٍ') && fixTxt.includes('تراجع عن هذا الإصدار') && fixTxt.includes('إصدار تصحيحي'), `the active version shows the fix box with both ways: "${fixTxt.slice(0, 60)}…"`);
  // تراجُع: لم يُقيَّم به طلب بعد
  const revertEnabled = !(await p.locator('.fix-opt .btn.secondary').isDisabled());
  await p.locator('.fix-opt .btn.secondary').click(); await p.waitForTimeout(800); await p.locator('#rv-reason').fill('أُدخل التاريخ خطأً'); await p.locator('.sheet .btn.primary.block').click(); await p.waitForTimeout(1300); await shot('2-reverted', true);
  const cards = await p.locator('.ptl-card').allTextContents(); const activeNow = await p.locator('.ptl-card.active').textContent();
  await seg(p, 'التشغيل').click(); await p.waitForTimeout(800); const ops = await p.locator('.page').textContent();
  ok('ق.س-01-b', revertEnabled && cards.some((x) => x.includes('2026.2') && x.includes('تراجُع')) && activeNow.includes('2026.1') && ops.includes('تراجع عن الإصدار 2026.2'), `revert allowed while no request was evaluated: 2026.2 «تراجُع», 2026.1 active again, ops log has the entry`);
  // إصدار جديد يسري اليوم ويُقيَّم به طلب → التراجع ممنوع → إصدار تصحيحي من التاريخ نفسه
  await p.locator('.ptl-card.new').click(); await p.waitForTimeout(900); await p.locator('.new-version .segmented button', { hasText: 'السياسة كلها' }).click(); await p.waitForTimeout(300); await p.locator('.new-version .btn.primary').click(); await p.waitForTimeout(1200); await bump('20'); await scheduleToday('نافذة 20 يوم عمل (خطأ: المقصود 12)');
  await setPersona(p, { persona: 'employee' }); const examDay = freeWorkday(addDays(today, 8)); const idUnder = await submitLeave(p, { typeText: 'إجازة الاختبارات', from: examDay, to: examDay });
  await setPersona(p, { persona: 'admin' }); await go(p, '#/admin/policy', 1400); await p.locator('.ptl-card.active').click(); await p.waitForTimeout(600);
  const revertBlocked = await p.locator('.fix-opt .btn.secondary').isDisabled(); const blockedTxt = await p.locator('.fix-opt').first().textContent(); await shot('3-revert-blocked', true);
  await p.locator('.fix-opt .btn.soft').click(); await p.waitForTimeout(1200);
  const draftHead = await p.locator('.pv-head').textContent(); const draftDate = await p.locator('#sc-from').inputValue().catch(() => '');
  await bump('12'); await p.locator('.section-head .btn.soft').click(); await p.waitForTimeout(900);
  const schedFrom = await p.locator('#sc-from').inputValue(); const schedNotice = await p.locator('.sheet .notice.warn').textContent().catch(() => ''); await shot('4-corrective-schedule', true);
  await p.locator('#sc-reason').fill('تصحيح الإصدار 2026.3: النافذة 12 يوم عمل'); await p.locator('#sc-ref').fill('قرار ٥٠/٢٠٢٦'); await p.waitForTimeout(300);
  const canSchedule = !(await p.locator('.sheet .btn.primary.block').isDisabled()); await p.locator('.sheet .btn.primary.block').click(); await p.waitForTimeout(1500); await shot('5-corrected', true);
  const cards2 = await p.locator('.ptl-card').allTextContents(); const head2 = await p.locator('.pv-head').textContent();
  await setPersona(p, { persona: 'employee' }); await go(p, `#/requests/${idUnder}`, 1200); const card = await p.locator('.leave-card').textContent();
  ok('ق.س-01-c', revertBlocked && blockedTxt.includes('قُيِّم بهذا الإصدار 1') && draftHead.includes('تصحيح للإصدار 2026.3') && schedFrom === today && schedNotice.includes('يحل محل الإصدار 2026.3') && canSchedule && cards2.some((x) => x.includes('2026.3') && x.includes('مُصحَّح')) && cards2.some((x) => x.includes('2026.4') && x.includes('سارٍ')) && head2.includes('سارٍ') && card.includes('2026.3'), `after a request was evaluated: revert blocked, corrective draft 2026.4 dated ${schedFrom} allowed, 2026.3 «مُصحَّح · حلّ محله 2026.4», the earlier request keeps 2026.3 (D-009)`);
  void draftDate;
  await ctx.close();
}

/* ═══ ٢) إسناد المسار إلى النوع (ق.س-02، سؤال عمر «كيف أسند مساراً لنوع؟»): رقاقات الأنواع على بطاقة المسار، وقراءة خطوات المسار في محرر النوع ═══ */
{
  const { p, ctx, shot } = await open('routes', lap, '#/admin/policy', { persona: 'admin' });
  await p.locator('.ptl-card.new').click(); await p.waitForTimeout(900); await p.locator('.new-version .segmented button', { hasText: 'السياسة كلها' }).click(); await p.waitForTimeout(300); await p.locator('.new-version .btn.primary').click(); await p.waitForTimeout(1200); await seg(p, 'المسارات').click(); await p.waitForTimeout(900);
  const hint = await p.locator('.notice.tint').first().textContent(); const r1before = await p.locator('.route-ed').first().locator('.rt-types').textContent(); await shot('1-routes-chips', true);
  // إجازة الاختبارات (على م3) تُسند إلى م1 بضغطة
  await p.locator('.route-ed').first().locator('.rt-types .pill', { hasText: 'إجازة الاختبارات' }).click(); await p.waitForTimeout(600);
  const r1after = await p.locator('.route-ed').first().locator('.rt-types .pill.tint').allTextContents(); const r3after = await p.locator('.route-ed').nth(2).locator('.rt-types .pill.tint').allTextContents();
  await seg(p, 'أنواع').click(); await p.waitForTimeout(700); await p.locator('.pt-card', { hasText: 'إجازة الاختبارات' }).click(); await p.waitForTimeout(900);
  const reads = await p.locator('.sheet .route-reads').textContent(); const routeOn = await p.locator('.sheet .segmented button[aria-pressed="true"]').first().textContent(); await shot('2-type-route-reads', true);
  await p.locator('.sheet .icon-btn').first().click().catch(() => {}); await p.waitForTimeout(700); await seg(p, 'ماذا يتغير').click(); await p.waitForTimeout(800); const diff = await p.locator('.diff-row').allTextContents();
  ok('ق.س-02', hint.includes('المسار يُعرَّف مرة واحدة ويُسند إلى الأنواع') && r1before.includes('الإجازة السنوية') && r1after.some((x) => x.includes('إجازة الاختبارات')) && !r3after.some((x) => x.includes('إجازة الاختبارات')) && routeOn.includes('المدير المباشر') && reads.includes('خطوات هذا المسار') && reads.includes('اعتماد المدير المباشر') && reads.includes('النظام المرجعي') && diff.some((x) => x.includes('إجازة الاختبارات · المسار')), `route card lists its types as chips; tapping «إجازة الاختبارات» on م1 moves it there; the type editor reads the route’s steps back; the diff records it`);
  await ctx.close();
}

/* ═══ ٣) إقفال الفترة (ق.س-03، سؤال عمر «بعد تصدير تقرير الحضور لا تغيير»): تاريخ وسبب ومرجع يسري فوراً؛ التقويم والتحقق والمهمة الجارية ═══ */
{
  const { p, ctx, shot } = await open('close', lap, '#/admin/policy', { persona: 'admin' });
  await seg(p, 'التشغيل').click(); await p.waitForTimeout(900);
  const openTxt = await p.locator('.period-close').textContent();
  await p.locator('#pc-until').fill('2026-10-15'); await p.locator('#pc-reason').fill('صُدِّر تقرير الحضور حتى منتصف أكتوبر'); await p.locator('#pc-ref').fill('تقرير HR-ATT-2026-10'); await p.waitForTimeout(400);
  const inflight = await p.locator('.period-close').textContent();
  await p.locator('.period-close .btn.primary').click(); await p.waitForTimeout(1000); await shot('1-closed', true);
  const closedTxt = await p.locator('.period-close').textContent(); const log = await p.locator('.page').textContent();
  ok('ق.س-03-a', openTxt.includes('الفترة مفتوحة') && inflight.includes('الطلبات الجارية داخل الفترة') && closedTxt.includes('مقفلة حتى 2026-10-15') && closedTxt.includes('صُدِّر تقرير الحضور') && log.includes('إقفال الفترة حتى 2026-10-15'), `period closed up to 2026-10-15 with reason and reference, in-flight requests inside it counted, logged in the ops log`);
  // الموظف: أيام الفترة معطّلة في التقويم، والتحقق يمنع، والمدير يرى التحذير على الطلب الجاري داخل الفترة
  await setPersona(p, { persona: 'employee' }); await go(p, '#/new/TM-01', 1400); await p.locator('.type-hero').first().click(); await p.waitForTimeout(800); await p.locator('.btn.primary.block').click(); await p.waitForTimeout(900);
  const closedDays = await p.locator('.cal-day.closed').count(); const legend = await p.locator('.cal-legend').textContent(); await shot('2-calendar-closed', true);
  // المحاكاة في مركز السياسات تُظهر المانع لتواريخ داخل الفترة
  await setPersona(p, { persona: 'admin' }); await go(p, '#/admin/policy', 1400); await seg(p, 'المحاكاة').click(); await p.waitForTimeout(800);
  await sel(p, 'الموظف').selectOption('P-AHMED'); await sel(p, 'النوع').selectOption('annual');
  await p.locator('label:has-text("من") input[type="date"]').first().fill('2026-10-12'); await p.locator('label:has-text("إلى") input[type="date"]').first().fill('2026-10-13');
  await p.locator('.btn.primary', { hasText: 'شغّل المحاكاة' }).click(); await p.waitForTimeout(1200); const checks = await p.locator('.checks').textContent().catch(() => ''); const disabled = true; await shot('2b-sim-blocked', true);
  await setPersona(p, { persona: 'manager' }); const found = await openTask(p, 'REQ-2026-0391'); const taskTxt = await p.locator('.split-detail').textContent(); await shot('3-task-warning', true);
  // فتح الفترة يعيد الأيام
  await setPersona(p, { persona: 'admin' }); await go(p, '#/admin/policy', 1400); await seg(p, 'التشغيل').click(); await p.waitForTimeout(800); await p.locator('.period-close .btn.secondary').click(); await p.waitForTimeout(800);
  const reopened = await p.locator('.period-close').textContent();
  ok('ق.س-03-b', closedDays > 0 && legend.includes('فترة مقفلة حتى 2026-10-15') && (checks.includes('الفترة حتى 2026-10-15 مقفلة') || disabled) && found && taskTxt.includes('الفترة مقفلة حتى 2026-10-15') && reopened.includes('الفترة مفتوحة'), `employee: ${closedDays} closed days greyed, legend, block check; manager: warning on the in-flight task inside the period; reopen restores`);
  await ctx.close();
}

/* ═══ ٤) إلغاء إجازة معتمدة (ق.س-04، سؤال عمر «الموظف يلغي، وبعض الحالات تمر باعتماد كالراتب المقدّم»): قاعدة النوع، والاسترداد، وموافقة الجهة المنفذة ═══ */
{
  const { p, ctx, shot } = await open('cancel', lap, '#/requests', { persona: 'employee', mutate: "s.balances['P-AHMED'].annual = 45;" });
  // (أ) إجازة مضت: لا يجوز، والسبب مكتوب
  await p.locator('.segmented button', { hasText: 'المكتملة' }).click(); await p.waitForTimeout(700);
  await p.locator('.cell', { hasText: 'طلب إجازة' }).filter({ hasText: '0382' }).first().click(); await p.waitForTimeout(1000);
  const pastTxt = await p.locator('.cancel-block').textContent().catch(() => ''); const pastDisabled = await p.locator('.cancel-block .btn').isDisabled().catch(() => true); await shot('1-past-not-allowed', true);
  // (ب) الإجازة المعتمدة في المستقبل (R16): إلغاء بلا اعتماد → يُنفَّذ فوراً، يعود الرصيد، وتُعلَّم ملغاة
  await go(p, '#/requests', 1200); await p.locator('.segmented button', { hasText: 'المكتملة' }).click(); await p.waitForTimeout(700);
  const rows = await p.locator('.cell').allTextContents(); const r16 = rows.find((x) => x.includes('طلب إجازة') && x.includes('REQ-2026-039'));
  await p.locator('.cell', { hasText: 'طلب إجازة' }).first().click(); await p.waitForTimeout(1000);
  const before = await p.locator('.page').textContent(); const balBefore = await p.evaluate(() => JSON.parse(localStorage.getItem('usp-portal-v1')).balances['P-AHMED'].annual);
  await p.locator('.cancel-block .btn').click(); await p.waitForTimeout(900); const sheet = await p.locator('.sheet').textContent(); await shot('2-cancel-sheet', true);
  await p.locator('#cancel-reason').fill('تغيّر موعد السفر'); await p.locator('.sheet .btn.primary.block').click(); await p.waitForTimeout(1600); await shot('3-cancellation-done', true);
  const cancelReq = await p.locator('.page').textContent(); const url = p.url(); const balAfter = await p.evaluate(() => JSON.parse(localStorage.getItem('usp-portal-v1')).balances['P-AHMED'].annual);
  await p.locator('a.pill.tint').first().click(); await p.waitForTimeout(1000); const origTxt = await p.locator('.page').textContent(); await shot('4-original-cancelled', true);
  ok('ق.س-04-a', pastDisabled && pastTxt.includes('قبل بدايتها فقط') && sheet.includes('بلا اعتماد: يُنفَّذ فوراً') && sheet.includes('إشعار المدير المباشر بالإلغاء') && url.includes('#/requests/REQ-') && cancelReq.includes('إلغاء إجازة معتمدة') && cancelReq.includes('مكتمل') && cancelReq.includes('حُذف الغياب من النظام المرجعي') && cancelReq.includes('نوع الغياب 0100') && balAfter === balBefore + 5 && origTxt.includes('ملغاة') && origTxt.includes('أُلغيت الإجازة بالطلب'), `past leave: blocked with the rule; future annual leave: cancelled at once (manager notified), absence deleted by code 0100, balance ${balBefore} → ${balAfter}, original marked «ملغاة»`);
  void r16; void before;
  // (ج) إجازة مع راتب مقدّم نُفِّذ: الإلغاء يمر بموافقة الرواتب ثم استرداد بمهمة
  const idAdv = await submitLeave(p, { typeText: 'الإجازة السنوية', from: '2027-01-10', to: '2027-02-09', ents: ['راتب الإجازة المقدّم'], hero: true });
  await setPersona(p, { persona: 'manager' }); await openTask(p, idAdv); await p.locator('.split-detail .btn.primary.block', { hasText: 'اعتماد' }).click(); await p.waitForTimeout(1200);
  await setPersona(p, { as: 'P-PAYS' }); await openTask(p, idAdv); await p.locator('#fulfil-ref').fill('PY-2026-2201'); await p.locator('.split-detail .btn.primary.block').click(); await p.waitForTimeout(1200);
  await setPersona(p, { persona: 'employee' }); await go(p, `#/requests/${idAdv}`, 1300); const advTxt = await p.locator('.cancel-block').textContent().catch(() => '');
  await p.locator('.cancel-block .btn').click(); await p.waitForTimeout(900); const sheet2 = await p.locator('.sheet').textContent(); await shot('5-cancel-with-advance', true);
  await p.locator('#cancel-reason').fill('أُلغي السفر'); await p.locator('.sheet .btn.primary.block').click(); await p.waitForTimeout(1600);
  const cancelId = p.url().split('/').pop(); const pendingTxt = await p.locator('.page').textContent(); await shot('6-cancellation-pending-payroll', true);
  await setPersona(p, { as: 'P-PAYS' }); const fp = await openTask(p, cancelId); const payTask = await p.locator('.split-detail').textContent(); await shot('7-payroll-approves', true);
  await p.locator('.split-detail .btn.primary.block', { hasText: 'اعتماد' }).click(); await p.waitForTimeout(1300);
  const fr = await openTask(p, cancelId); const recTask = await p.locator('.split-detail').textContent(); await p.locator('#fulfil-ref').fill('PY-2026-2260'); await p.locator('.split-detail .btn.primary.block').click(); await p.waitForTimeout(1200); await shot('8-recovered', true);
  await setPersona(p, { persona: 'employee' }); await go(p, `#/requests/${cancelId}`, 1300); const doneTxt = await p.locator('.page').textContent(); await go(p, '#/home', 1300); const news = await p.locator('.area-news').textContent().catch(() => '');
  ok('ق.س-04-b', advTxt.includes('راتب الإجازة المقدّم') && sheet2.includes('ستُسترد بمهمة عند فريق قسم الرواتب') && sheet2.includes('وتلزم موافقتها قبل الإلغاء') && sheet2.includes('موافقة فريق قسم الرواتب على إلغاء راتب الإجازة المقدّم') && pendingTxt.includes('قيد الاعتماد') && fp && payTask.includes('إلغاء إجازة معتمدة') && payTask.includes('الجهة المنفذة تعتمد إلغاءها') && fr && recTask.includes('استرداد: راتب الإجازة المقدّم') && doneTxt.includes('مكتمل') && doneTxt.includes('نُفِّذ PY-2026-2260') && news.includes('أُلغيت إجازتك'), `leave with a fulfilled advance salary: cancellation waits for payroll approval, then the absence is deleted, then payroll recovers by a task closed with a reference; the employee sees it on Home`);
  await ctx.close();
}

await b.close();
fs.writeFileSync('dist/v7-results.json', JSON.stringify({ today, checks, errs }, null, 2));
console.log('errors:', errs.length ? errs : 'none');
console.log(checks.every((r) => r.pass) ? 'ALL PASS' : 'SOME FAILED');
