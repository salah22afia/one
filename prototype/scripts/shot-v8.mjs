// لقطات وسيناريوهات v0.8 «أساس الإدارة» (D-015 وD-016): إصدار بنطاق معلَن وسجل لكل كائن، ومتى يتاح النوع (موسم كـ«كونوا معهم»)، وإقفال الفترة الذي يقفل الاعتماد
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
async function open(name, vp, hash, opts = {}) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2, colorScheme: opts.dark ? 'dark' : 'light', hasTouch: !!opts.touch, isMobile: !!opts.touch });
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error') errs.push(name + ': ' + m.text()); });
  p.on('pageerror', (e) => errs.push(name + ': ' + e.message));
  await p.goto(file + '#/home', { waitUntil: 'load' }); await p.waitForTimeout(900);
  await setPersona(p, opts);
  await p.goto(file + hash, { waitUntil: 'load' }); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(opts.wait ?? 1500);
  return { p, ctx, shot: async (n, full = false) => p.screenshot({ path: `dist/v8-${name}${n ? '-' + n : ''}.png`, fullPage: full }) };
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
const go = async (p, hash, wait = 1500) => { await p.goto(file + hash); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(wait); };
const seg = (p, label) => p.locator('.policy .segmented').first().locator('button', { hasText: label }).first();
const tabs = async (p) => (await p.locator('.policy .segmented').first().locator('button').allTextContents()).map((x) => x.trim());
/** إصدار جديد عبر ورقة النطاق: نوع/مسار/استحقاق/التقويم/الكل، مع اختيار الكائن */
async function newVersion(p, kindText, pickText) {
  await p.locator('.ptl-card.new').click(); await p.waitForTimeout(900);
  await p.locator('.new-version .segmented button', { hasText: kindText }).click(); await p.waitForTimeout(300);
  if (pickText) { await p.locator('.new-version .scope-pick .pill', { hasText: pickText }).click(); await p.waitForTimeout(300); }
  await p.locator('.new-version .btn.primary').click(); await p.waitForTimeout(1300);
}
const closeSheet = async (p) => { await p.locator('.sheet .icon-btn').first().click().catch(() => {}); await p.waitForTimeout(700); };
const save = async (p, why = 'تعديل') => { await p.locator('.sb-why').fill(why); await p.locator('.savebar .btn').click(); await p.waitForTimeout(900); };
async function schedule(p, from, reason) { await p.locator('.section-head .btn.soft').click(); await p.waitForTimeout(900); await p.locator('#sc-from').fill(from); await p.locator('#sc-reason').fill(reason); await p.locator('#sc-ref').fill('قرار ٦٠/٢٠٢٦'); await p.waitForTimeout(300); await p.locator('.sheet .btn.primary.block').click(); await p.waitForTimeout(1500); }
async function openTask(p, id) {
  await go(p, '#/inbox', 1500);
  const rows = p.locator('.row .cell'); const n = await rows.count();
  for (let i = 0; i < n; i++) { await rows.nth(i).click(); await p.waitForTimeout(600); const idTxt = await p.locator('.split-detail .mono').first().textContent().catch(() => ''); if (idTxt.includes(id)) return true; }
  return false;
}

/* ═══ ١) نوع جديد يتاح في موسم (ق.أ-01، سؤال عمر «أنشئ نوعاً مثل كونوا معهم في فترة»): يُضبط عند الإنشاء، ويظهر في التشغيل بعد السريان، ويُفتح بتاريخيه فيراه الموظف ═══ */
{
  const { p, ctx, shot } = await open('season', lap, '#/admin/policy', { persona: 'admin' });
  await newVersion(p, 'السياسة كلها');
  await seg(p, 'أنواع').click(); await p.waitForTimeout(600); await p.locator('.pt-card.new').click(); await p.waitForTimeout(900);
  await p.locator('#nt-erp').selectOption('01|0530'); await p.waitForTimeout(400);
  const autoName = await p.locator('#nt-ar').inputValue();
  await p.locator('.sheet .avail-ed .segmented button', { hasText: 'موسم' }).click(); await p.waitForTimeout(400);
  await p.locator('.sheet .avail-ed input[dir="rtl"]').fill('موسم الصيف'); await p.locator('.sheet .avail-ed input[dir="ltr"]').fill('Summer season'); await p.waitForTimeout(300);
  const sheetTxt = await p.locator('.sheet').textContent(); await shot('1-new-type-season', true);
  await p.locator('.sheet .btn.primary.block').click(); await p.waitForTimeout(1200);
  const editorTxt = await p.locator('.sheet').textContent(); const availOn = await p.locator('.sheet .avail-ed .segmented button[aria-pressed="true"]').textContent(); await shot('2-editor-season', true);
  await closeSheet(p); await save(p, 'نوع جديد للموسم الصيفي'); await schedule(p, today, 'إضافة إجازة موسمية جديدة');
  await seg(p, 'التشغيل').click(); await p.waitForTimeout(900);
  const winRow = p.locator('.cell.stacked', { hasText: 'موسم الصيف' }).first(); const winTxt = await winRow.textContent().catch(() => '');
  // الموظف قبل فتح النافذة: النوع مطوي تحت «غير متاحة لك الآن» بسببه
  await setPersona(p, { persona: 'employee' }); await go(p, '#/new/TM-01', 1400);
  await p.locator('.section-label button', { hasText: 'عرض' }).click().catch(() => {}); await p.waitForTimeout(600); const beforeTxt = await p.locator('.page').textContent(); await shot('3-picker-closed', true);
  // مدير النظام يفتح النافذة بتاريخيها من التشغيل
  await setPersona(p, { persona: 'admin' }); await go(p, '#/admin/policy', 1400); await seg(p, 'التشغيل').click(); await p.waitForTimeout(900);
  const row = p.locator('.cell.stacked', { hasText: 'موسم الصيف' }).first(); await row.locator('input.switch').check(); await row.locator('input[type="date"]').nth(0).fill(today); await row.locator('input[type="date"]').nth(1).fill(addDays(today, 30)); await row.locator('.btn.soft').click(); await p.waitForTimeout(900); await shot('4-ops-window-open', true);
  const opsTxt = await p.locator('.page').textContent();
  await setPersona(p, { persona: 'employee' }); await go(p, '#/new/TM-01', 1400); const afterRows = await p.locator('.type-row').allTextContents(); await shot('5-picker-open', true);
  ok('ق.أ-01', autoName.length > 0 && sheetTxt.includes('متى يتاح هذا النوع؟') && sheetTxt.includes('مثل «كونوا معهم»') && editorTxt.includes('جديد في هذه المسودة') && availOn.includes('موسم') && winTxt.includes('موسم الصيف') && winTxt.includes('مغلقة') && beforeTxt.includes('نافذة موسم الصيف مغلقة الآن') && opsTxt.includes('فتح نافذة') && afterRows.some((x) => x.includes(autoName)), `new type «${autoName}» created as a season («موسم الصيف») from the new-type sheet; after scheduling it appears in Operations closed; the employee sees it folded with the reason; opening the window with dates makes it available`);
  await ctx.close();
}

/* ═══ ٢) الإصدار بنطاق معلَن وسجل لكل كائن (ق.أ-02، D-016): مسودة لنوع واحد، رقاقات النطاق، «آخر تعديل»، سجل النوع، المسودة على طرف السلسلة، توسيع النطاق، ملحق التعديل ═══ */
{
  const { p, ctx, shot } = await open('scope', lap, '#/admin/policy', { persona: 'admin' });
  await p.locator('.ptl-card.new').click(); await p.waitForTimeout(900); const sheetTxt = await p.locator('.new-version').textContent(); await shot('1-new-version-sheet', true);
  await p.locator('.new-version .segmented button', { hasText: 'نوع إجازة واحد' }).click(); await p.waitForTimeout(300); await p.locator('.new-version .scope-pick .pill', { hasText: 'إجازة الاختبارات' }).click(); await p.waitForTimeout(300); await p.locator('.new-version .btn.primary').click(); await p.waitForTimeout(1300);
  const head = await p.locator('.pv-scope').textContent(); const tabsScoped = await tabs(p); const cards = await p.locator('.pt-card:not(.new)').count(); const notice = await p.locator('.notice.tint').first().textContent(); await shot('2-scoped-draft', true);
  // تعديل النوع الواحد وحفظه: رقاقة النطاق على بطاقة الإصدار، وورقة الجدولة تذكر النطاق
  await p.locator('.pt-card:not(.new)').first().click(); await p.waitForTimeout(900); await p.locator('.sheet input[type="number"]').first().fill('15'); await p.waitForTimeout(300); await closeSheet(p); await save(p, 'تمديد نافذة التقديم');
  const tl = await p.locator('.ptl-card.draft').textContent(); await p.locator('.section-head .btn.soft').click(); await p.waitForTimeout(900); const schedTxt = await p.locator('.sheet').textContent(); const D = addDays(today, 20); await shot('3-schedule-scope', true);
  await p.locator('#sc-from').fill(D); await p.locator('#sc-reason').fill('نافذة الاختبارات 15 يوم عمل'); await p.locator('#sc-ref').fill('قرار ٦٠/٢٠٢٦'); await p.waitForTimeout(300); await p.locator('.sheet .btn.primary.block').click(); await p.waitForTimeout(1500);
  const schedCard = await p.locator('.ptl-card.scheduled').textContent(); const headSched = await p.locator('.pv-scope').textContent();
  // «آخر تعديل» على بطاقة النوع وسجل النوع في محرره
  await p.locator('.ptl-card.active').click(); await p.waitForTimeout(700); await seg(p, 'أنواع').click(); await p.waitForTimeout(700);
  const examCard = p.locator('.pt-card', { hasText: 'إجازة الاختبارات' }).first(); const last = await examCard.locator('.pt-last').textContent(); const otherLast = await p.locator('.pt-card', { hasText: 'الإجازة السنوية' }).first().locator('.pt-last').textContent();
  await examCard.click(); await p.waitForTimeout(900); const hist = await p.locator('.sheet .obj-hist').textContent(); await shot('4-type-history', true); await closeSheet(p);
  ok('ق.أ-02-a', sheetTxt.includes('ما الذي يغيّره هذا الإصدار؟') && head.includes('نوع إجازة واحد: إجازة الاختبارات') && !tabsScoped.some((x) => x.includes('المسارات')) && !tabsScoped.some((x) => x.includes('الاستحقاقات')) && cards === 1 && notice.includes('لنوع واحد') && tl.includes('إجازة الاختبارات') && schedTxt.includes('نطاق الإصدار') && schedTxt.includes('تغيير واحد') && schedCard.includes('مجدول') && schedCard.includes('إجازة الاختبارات') && headSched.includes('يغيّر') && last.includes('آخر تعديل 2026.2') && last.includes('يسري من ' + D) && otherLast.includes('منذ الإصدار الابتدائي') && hist.includes('2026.2') && hist.includes('نافذة التقديم بعد الانتهاء') && hist.includes('15') && hist.includes('طلبات بهذا النوع'), `scoped draft for «إجازة الاختبارات»: editor limited to it (tabs ${tabsScoped.length}), scope chip on the timeline, schedule sheet names the scope; after scheduling 2026.2 from ${D}: the type card says «آخر تعديل 2026.2 · يسري من ${D}», other types «منذ الإصدار الابتدائي», the type’s history lists the change`);
  // المسودة التالية تُبنى على طرف السلسلة (2026.2 المجدول): تاريخها الافتراضي بعده، ولا تُجدوَل قبله
  await newVersion(p, 'السياسة كلها');
  // v0.8.1: مسودة بلا تغيير لا تُجدوَل، فنغيّر شيئاً أولاً
  await p.locator('.pt-card:not(.new)').first().click(); await p.waitForTimeout(900); await p.locator('.sheet input[type="number"]').first().fill('9'); await p.waitForTimeout(300); await closeSheet(p); await save(p, 'تعديل');
  await p.locator('.section-head .btn.soft').click(); await p.waitForTimeout(900);
  const defFrom = await p.locator('#sc-from').inputValue(); await p.locator('#sc-from').fill(addDays(today, 5)); await p.waitForTimeout(400); const errTxt = await p.locator('.sheet').textContent(); const disabledEarly = await p.locator('.sheet .btn.primary.block').isDisabled(); await shot('5-before-tip', true);
  await p.locator('#sc-from').fill(addDays(D, 1)); await p.locator('#sc-reason').fill('x'); await p.locator('#sc-ref').fill('y'); await p.waitForTimeout(400); const enabledLater = !(await p.locator('.sheet .btn.primary.block').isDisabled()); await closeSheet(p);
  await p.locator('.section-head .btn.quiet').click(); await p.waitForTimeout(900); // إلغاء المسودة
  // مسودة لمسار واحد ثم توسيع النطاق
  await newVersion(p, 'مسار واحد', 'شؤون الموظفين مباشرة'); const tabsRoute = await tabs(p); const routeCards = await p.locator('.route-ed').count(); const assignDisabled = await p.locator('.route-ed .rt-types .pill').first().isDisabled();
  await p.locator('.pv-scope .link-btn').click(); await p.waitForTimeout(900); const tabsAll = await tabs(p); const headAll = await p.locator('.pv-scope').textContent(); await shot('6-widened', true);
  await p.locator('.section-head .btn.quiet').click(); await p.waitForTimeout(900);
  // ملحق التعديل في مستند الإصدار المجدول
  await p.locator('.ptl-card.scheduled').click(); await p.waitForTimeout(700); await p.locator('.pv-line .btn.quiet').click(); await p.waitForTimeout(1200); const doc = await p.locator('.sheet').textContent(); await shot('7-amendment-sheet', true);
  ok('ق.أ-02-b', defFrom === addDays(D, 1) && errTxt.includes(`يوجد إصدار مجدول من ${D} (2026.2)`) && disabledEarly && enabledLater && tabsRoute.some((x) => x.includes('المسارات')) && !tabsRoute.some((x) => x.includes('أنواع')) && routeCards === 1 && assignDisabled && tabsAll.some((x) => x.includes('أنواع')) && tabsAll.some((x) => x.includes('الاستحقاقات')) && headAll.includes('السياسة كلها') && doc.includes('ملحق التعديل · 2026.2') && doc.includes('نطاق التعديل') && doc.includes('إجازة الاختبارات') && doc.includes('النص الكامل للسياسة بعد التعديل'), `next draft builds on the scheduled tip: default date ${defFrom}, a date before it is refused with the reason; a route-scoped draft shows one route with assignment off; widening restores all tabs; the exported document opens with the amendment sheet`);
  await ctx.close();
}

/* ═══ ٣) إقفال الفترة يقفل الاعتماد (ق.أ-03، D-015): المعلّق بالأسماء، وأقرب إقفال آمن، وزر الاعتماد معطّل مع السبب، والموظف يرى الانتظار، والفتح يعيد كل شيء ═══ */
{
  const { p, ctx, shot } = await open('lock', lap, '#/admin/policy', { persona: 'admin' });
  await seg(p, 'التشغيل').click(); await p.waitForTimeout(900);
  await p.locator('#pc-until').fill('2026-10-15'); await p.locator('#pc-reason').fill('صُدِّر تقرير الحضور حتى منتصف أكتوبر'); await p.locator('#pc-ref').fill('HR-ATT-2026-10'); await p.waitForTimeout(500);
  const form = await p.locator('.period-close').textContent(); const rows = await p.locator('.inflight-row').allTextContents(); await shot('1-close-form', true);
  await p.locator('.period-close .btn.primary').click(); await p.waitForTimeout(1000);
  // المدير: زر الاعتماد معطّل والسبب ظاهر؛ الإعادة والرفض متاحان
  await setPersona(p, { persona: 'manager' }); const found = await openTask(p, 'REQ-2026-0391'); const approveDisabled = await p.locator('.split-detail .btn.primary.block', { hasText: 'اعتماد' }).isDisabled(); const lockTxt = await p.locator('.split-detail .notice.danger').textContent().catch(() => ''); const canReturn = !(await p.locator('.split-detail .btn.secondary').isDisabled()); await shot('2-task-locked', true);
  // الموظف يرى أن اعتماد طلبه ينتظر فتح الفترة
  await setPersona(p, { persona: 'employee' }); await go(p, '#/requests/REQ-2026-0391', 1300); const reqTxt = await p.locator('.notice.warn').first().textContent().catch(() => ''); await shot('3-request-waiting', true);
  // الهاتف: السحب للاعتماد يفتح التفاصيل بدل أن يعتمد
  const ph1 = await open('lock-ph', ph, '#/inbox', { persona: 'manager', touch: true, mutate: "s.policy.periodClose = { until: '2026-10-15', reason: 'تقرير', reference: '', by: 'P-OMAR', at: Date.now() };" });
  const rowPh = ph1.p.locator('.row').first(); const box = await rowPh.boundingBox(); await ph1.p.mouse.move(box.x + 40, box.y + box.height / 2); await ph1.p.mouse.down(); await ph1.p.mouse.move(box.x + 200, box.y + box.height / 2, { steps: 8 }); await ph1.p.waitForTimeout(200);
  await ph1.p.screenshot({ path: 'dist/v8-lock-ph-swipe.png' }); await ph1.p.mouse.up(); await ph1.p.waitForTimeout(600);
  await ph1.p.locator('.swipe-action, .row .btn, .row button').first().click().catch(() => {}); await ph1.p.waitForTimeout(900);
  const phSheet = await ph1.p.locator('.sheet').textContent().catch(() => ''); const stillPending = await ph1.p.evaluate(() => JSON.parse(localStorage.getItem('usp-portal-v1')).requests.find((r) => r.id === 'REQ-2026-0391').status); await ph1.p.screenshot({ path: 'dist/v8-lock-ph-detail.png' }); await ph1.ctx.close();
  // فتح الفترة يعيد الاعتماد
  await setPersona(p, { persona: 'admin' }); await go(p, '#/admin/policy', 1400); await seg(p, 'التشغيل').click(); await p.waitForTimeout(800); await p.locator('.period-close .btn.secondary').click(); await p.waitForTimeout(800);
  await setPersona(p, { persona: 'manager' }); await openTask(p, 'REQ-2026-0391'); const approveEnabled = !(await p.locator('.split-detail .btn.primary.block', { hasText: 'اعتماد' }).isDisabled());
  ok('ق.أ-03', form.includes('أقرب إقفال آمن') && form.includes('الطلبات الجارية داخل الفترة') && rows.length >= 1 && rows.some((x) => x.includes('أحمد') && x.includes('REQ-2026-0391')) && found && approveDisabled && lockTxt.includes('لا يمكن اعتماد هذا الطلب حتى تفتح شؤون الموظفين الفترة') && canReturn && reqTxt.includes('اعتماد طلبك ينتظر فتحها') && stillPending === 'in_review' && (phSheet.includes('الفترة مقفلة') || phSheet === '') && approveEnabled, `close form lists in-flight requests by name (${rows.length}) and the earliest safe close; manager’s approve button is locked with the reason (return/reject still possible); the employee sees the wait; on the phone the swipe does not approve (${stillPending}); reopening unlocks approval`);
  await ctx.close();
}

await b.close();
fs.writeFileSync('dist/v8-results.json', JSON.stringify({ today, checks, errs }, null, 2));
console.log('errors:', errs.length ? errs : 'none');
console.log(checks.every((r) => r.pass) ? 'ALL PASS' : 'SOME FAILED');
