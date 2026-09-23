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
const today = toISO(Date.now());
async function open(name, vp, hash, opts = {}) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2, colorScheme: opts.dark ? 'dark' : 'light', hasTouch: !!opts.touch, isMobile: !!opts.touch });
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error') errs.push(name + ': ' + m.text()); });
  p.on('pageerror', (e) => errs.push(name + ': ' + e.message));
  await p.goto(file + '#/home', { waitUntil: 'load' }); await p.waitForTimeout(900);
  await setPersona(p, opts);
  await p.goto(file + hash, { waitUntil: 'load' }); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(opts.wait ?? 1500);
  return { p, ctx, shot: async (n, full = false) => p.screenshot({ path: `dist/v6-${name}${n ? '-' + n : ''}.png`, fullPage: full }) };
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

/* ═══ ١) مدير النظام (حاسوب): المسارات بمحرر الخطوة، والهيكل والمناصب، ثم مسودة تُغيّر مسارين وتسري اليوم ═══ */
{
  const { p, ctx, shot } = await open('admin', lap, '#/admin/policy', { persona: 'admin', mutate: "s.balances['P-AHMED'].annual = 45;" });
  await seg(p, 'المسارات').click(); await p.waitForTimeout(900); await shot('1-routes', true);
  const routesTxt = await p.locator('.route-ed').allTextContents();
  ok('ق.م-00-editor', routesTxt.length === 4 && routesTxt[3].includes('السلسلة الإدارية حتى المدير العام') && routesTxt[3].includes('فريق قسم شؤون الموظفين') && routesTxt[1].includes('إشعار المدير المباشر'), `4 routes rendered with agent rules: "${routesTxt[3].slice(0, 90)}…"`);
  await seg(p, 'الهيكل').click(); await p.waitForTimeout(900); await shot('2-org', true);
  const orgTxt = await p.locator('.org-tree').textContent();
  ok('ق.م-00-org', orgTxt.includes('مدير إدارة الشؤون المالية') && orgTxt.includes('شاغر') && orgTxt.includes('النائب: رئيس قسم الرواتب') && orgTxt.includes('بلا نائب') && orgTxt.includes('يقوم مقامه: عبدالله بن محمد العتيبي'), 'org tree shows units, positions, holders, a vacancy with a deputy and one without (acting superior)');
  // مسودة: R1 يكسب خطوة «المدير العام» بشرط المدة > 30 يوماً؛ وR3 تصبح خطوته الثانية منصبين بنصاب «أي واحد»
  await p.locator('.ptl-card.new').click(); await p.waitForTimeout(900); await p.locator('.new-version .segmented button', { hasText: 'السياسة كلها' }).click(); await p.waitForTimeout(300); await p.locator('.new-version .btn.primary').click(); await p.waitForTimeout(1200);
  await seg(p, 'المسارات').click(); await p.waitForTimeout(900);
  const r1 = p.locator('.route-ed').nth(0);
  await r1.locator('.kbd-row .btn.quiet').click(); await p.waitForTimeout(500);
  const r1s2 = r1.locator('.rt-steps .rt-step').nth(1);
  await r1s2.locator('label:has-text("من يقرر") select').selectOption('orgHead'); await p.waitForTimeout(300);
  await r1s2.locator('label:has-text("المستوى") select').selectOption('ga'); await p.waitForTimeout(300);
  await r1s2.locator('label:has-text("شرط التطبيق") select').selectOption('days'); await p.waitForTimeout(300);
  await r1s2.locator('label:has-text("القيمة") input').fill('30'); await p.waitForTimeout(300);
  const r3 = p.locator('.route-ed').nth(2); const r3s2 = r3.locator('.rt-steps .rt-step').nth(1);
  await r3s2.locator('label:has-text("من يقرر") select').selectOption('positions'); await p.waitForTimeout(300);
  await r3s2.locator('label:has-text("المناصب") select').selectOption('S-211'); await p.waitForTimeout(300);
  await r3s2.locator('label:has-text("المناصب") select').selectOption('S-2111'); await p.waitForTimeout(400);
  await p.evaluate(() => document.querySelectorAll('.route-ed')[0]?.scrollIntoView({ block: 'start' })); await p.waitForTimeout(300); await shot('3-edit-r1', false);
  await p.evaluate(() => document.querySelectorAll('.route-ed')[2]?.scrollIntoView({ block: 'start' })); await p.waitForTimeout(300); await shot('4-edit-r3', false);
  const r1Txt = await r1.textContent(); const r3Txt = await r3.textContent();
  ok('ق.م-00-edit', r1Txt.includes('اعتماد المدير العام') && r1Txt.includes('تُقرأ: المدة (أيام) أكبر من 30') && r3Txt.includes('رئيس قسم شؤون الموظفين أو أخصائي أول شؤون موظفين') && r3Txt.includes('يكفي أي واحد'), 'step editor: org-head step with a days>30 condition; two positions with "any" quorum');
  await p.locator('.sb-why').fill('اعتماد المدير العام للإجازات الطويلة، وتوزيع تدقيق الاختبارات على منصبين'); await p.locator('.savebar .btn').click(); await p.waitForTimeout(1000);
  // ماذا يتغير: تسميات مقروءة
  await seg(p, 'ماذا يتغير').click(); await p.waitForTimeout(900); await shot('5-diff', true);
  const diffTxt = await p.locator('.diff-row').allTextContents();
  ok('ق.م-00-diff', diffTxt.some((x) => x.includes('المدير المباشر · الخطوة 2 · من يعتمد')) && diffTxt.some((x) => x.includes('المناصب')), `diff rows: ${diffTxt.length} · "${diffTxt[0]?.slice(0, 70)}"`);
  // الجدولة: تسري اليوم
  await p.locator('.section-head .btn.soft').click(); await p.waitForTimeout(900);
  await p.locator('#sc-from').fill(today); await p.locator('#sc-reason').fill('تفعيل اعتماد المدير العام للإجازات الطويلة ونصاب التدقيق'); await p.locator('#sc-ref').fill('قرار ٤٤/٢٠٢٦');
  await p.locator('.sheet .btn.primary.block').click(); await p.waitForTimeout(1500);
  const status = await p.locator('.pv-line .pill').first().textContent();
  ok('ق.م-09-a', status.includes('سارٍ'), `new version status: ${status}`);
  // ق.م-08 + ق.م-11: المحاكاة لأحمد: ١٠ أيام لا تمر على المدير العام، و٣٥ يوماً تمر؛ وتُقرأ أسباب الاستخراج
  await seg(p, 'المحاكاة').click(); await p.waitForTimeout(900);
  await sel(p, 'الموظف').selectOption('P-AHMED'); await sel(p, 'النوع').selectOption('annual');
  await p.locator('label:has-text("من") input[type="date"]').first().fill('2026-11-01'); await p.locator('label:has-text("إلى") input[type="date"]').first().fill('2026-11-10');
  await p.locator('.btn.primary', { hasText: 'شغّل المحاكاة' }).click(); await p.waitForTimeout(1200); await shot('6-sim-10d', true);
  const sim10 = await p.locator('.sim-route').textContent();
  await p.locator('label:has-text("إلى") input[type="date"]').first().fill('2026-12-05'); await p.locator('.btn.primary', { hasText: 'شغّل المحاكاة' }).click(); await p.waitForTimeout(1200); await shot('7-sim-35d', true);
  const sim35 = await p.locator('.sim-route').textContent();
  ok('ق.م-08', sim10.includes('خطوات لا تنطبق') && sim10.includes('اعتماد المدير العام') && sim10.includes('الشرط لم يتحقق') && !sim10.split('خطوات لا تنطبق')[0].includes('المدير العام') && sim35.split('خطوات لا تنطبق')[0].includes('اعتماد المدير العام') && sim35.includes('عبدالله بن محمد العتيبي'), '10 days: GM step listed as not applied (condition); 35 days: GM step resolved to Abdullah Al-Otaibi');
  ok('ق.م-11', sim10.includes('منى عبدالله القحطاني') && sim10.includes('المدير المباشر (رئيس قسم التمكين الرقمي وذكاء الأعمال)'), 'simulation shows the person and why: line manager = head of the requester\'s unit');
  // ق.م-01: من يقرأ الموظف
  ok('ق.م-01', sim10.includes('اعتماد المدير المباشر') && sim10.includes('منى عبدالله القحطاني'), 'line-manager step resolves to Mona for Ahmed');
  // ق.م-03: السلسلة الإدارية حتى المدير العام لمنى (مديرها المباشر هو مدير الإدارة): خطوتان لا ثلاث
  await sel(p, 'الموظف').selectOption('P-MONA'); await sel(p, 'النوع').selectOption('exceptional');
  await p.locator('label:has-text("من") input[type="date"]').first().fill('2026-11-01'); await p.locator('label:has-text("إلى") input[type="date"]').first().fill('2026-11-30');
  await p.locator('.btn.primary', { hasText: 'شغّل المحاكاة' }).click(); await p.waitForTimeout(1200); await shot('8-sim-chain-mona', true);
  const simMona = await p.locator('.sim-route .rp-item').allTextContents();
  ok('ق.م-03', simMona[0].includes('اعتماد مدير الإدارة') && simMona[0].includes('عبدالرحمن') && simMona[1].includes('اعتماد المدير العام') && simMona[1].includes('عبدالله بن محمد العتيبي') && simMona[2].includes('هند'), `chain for Mona = 2 links (department director, director general) then HR: ${simMona.slice(0, 3).map((x) => x.slice(0, 34)).join(' | ')}`);
  // ق.م-07: المعتمد المستخرج هو الطالب نفسه → يُتخطى إلى المستوى التالي مع السبب (نورة تطلب مرضية: فريق شؤون الموظفين بلا نورة)
  await sel(p, 'الموظف').selectOption('P-NOURA'); await sel(p, 'النوع').selectOption('sick');
  await p.locator('label:has-text("من") input[type="date"]').first().fill('2026-11-02'); await p.locator('label:has-text("إلى") input[type="date"]').first().fill('2026-11-03');
  await p.locator('.btn.primary', { hasText: 'شغّل المحاكاة' }).click(); await p.waitForTimeout(1200); await shot('9-sim-self', true);
  const simNoura = await p.locator('.sim-route').textContent();
  ok('ق.م-07', simNoura.includes('فريق قسم شؤون الموظفين: 2 أعضاء') && !simNoura.split('فريق قسم شؤون الموظفين')[1]?.includes('نورة') && simNoura.includes('علي بن أحمد البوعينين'), 'requester excluded from her own pool; Ali and Turki remain');
  // ق.م-12: الشرائح بفئات النظام المرجعي: سارة (متعاقد) دورة سنة؛ أحمد (رسمي) دورة سنتين — بلا حقل يدوي
  await sel(p, 'الموظف').selectOption('P-SARA'); await p.locator('.btn.primary', { hasText: 'شغّل المحاكاة' }).click(); await p.waitForTimeout(1200);
  const cycSara = await p.locator('.tb-legend').textContent(); const groupSara = await p.locator('.section-label', { hasText: 'الدورة الحالية' }).textContent();
  await sel(p, 'الموظف').selectOption('P-AHMED'); await p.locator('.btn.primary', { hasText: 'شغّل المحاكاة' }).click(); await p.waitForTimeout(1200); await shot('10-sim-cycle-ahmed', true);
  const cycAhmed = await p.locator('.tb-legend').textContent(); const groupAhmed = await p.locator('.section-label', { hasText: 'الدورة الحالية' }).textContent();
  ok('ق.م-12', groupSara.includes('متعاقد') && cycSara.includes('2026-05-10 → 2027-05-09') && groupAhmed.includes('موظف رسمي') && cycAhmed.includes('2026-03-02 → 2028-03-01'), `Sara: ${groupSara.trim()} · ${cycSara.replace(/\s+/g, ' ').trim()} · Ahmed: ${groupAhmed.trim()} · ${cycAhmed.replace(/\s+/g, ' ').trim()}`);
  await ctx.close();
}

/* ═══ ٢) الطلبات بعد الإصدار الجديد: الجاري يكمل بمساره (ق.م-09)، والنصاب «أي واحد» (ق.م-04)، والشاغر (ق.م-06) ═══ */
{
  const { p, ctx, shot } = await open('flow', lap, '#/home', { persona: 'admin' });
  // نعيد بناء الإصدار الجديد مباشرة في الحالة (كما فعله المحرر في المشهد الأول) لأن كل سياق يبدأ من بيانات جديدة
  await setPersona(p, { persona: 'employee', mutate: `
    s.balances['P-AHMED'].annual = 45;
    const v1 = s.policy.versions[0]; const c = JSON.parse(JSON.stringify(v1.content));
    c.routes[0].steps.push({ agent: { kind: 'orgHead', level: 'ga' }, mode: 'approve', slaHours: 48, when: { field: 'days', op: 'gt', value: 30 }, escalation: { remindAtPct: 80, after: 'notifyManager' } });
    c.routes[2].steps[1] = { agent: { kind: 'positions', positionIds: ['S-211', 'S-2111'], quorum: 'any' }, mode: 'approve', slaHours: 48, escalation: { remindAtPct: 80, after: 'notifyManager' } };
    s.policy.versions.push({ id: 'V-2', number: '2026.2', from: '${today}', scheduled: true, createdBy: 'P-OMAR', createdAt: Date.now(), reason: 'اعتماد المدير العام للإجازات الطويلة ونصاب التدقيق', reference: 'قرار ٤٤/٢٠٢٦', content: c, changes: [], baseId: 'V-1', notifiedScheduled: true, notifiedActive: true });
  ` });
  // ق.م-09: طلب أحمد الجاري (سنوية ١٢ يوماً عند منى) يبقى بخطواته المُلتقطة تحت 2026.1
  await go(p, '#/requests', 1200);
  await p.locator('.cell', { hasText: 'طلب إجازة' }).first().click(); await p.waitForTimeout(1200); await shot('1-inflight', true);
  const oldRail = await railText(p, '.page'); const oldVer = await p.locator('.leave-card').textContent();
  // طلب جديد ٣٥ يوماً يمر على المدير العام بالإصدار الجديد
  const idLong = await submitLeave(p, { typeText: 'الإجازة السنوية', from: '2026-11-01', to: '2026-12-05', hero: true });
  await go(p, `#/requests/${idLong}`, 1200); await shot('2-new-long', true);
  const newRail = await railText(p, '.page'); const newVer = await p.locator('.leave-card').textContent();
  ok('ق.م-09', oldVer.includes('2026.1') && !oldRail.some((x) => x.includes('المدير العام')) && newVer.includes('2026.2') && newRail.some((x) => x.includes('اعتماد المدير العام') && x.includes('عبدالله')), `in-flight keeps 2026.1 without a GM step; new ${idLong} under 2026.2 has "${newRail.find((x) => x.includes('المدير العام'))?.slice(0, 60)}"`);
  // ق.م-04: اختبارات أحمد → منى ثم (علي أو نورة)؛ اعتماد نورة يقفلها ويُبلَّغ علي
  const idExam = await submitLeave(p, { typeText: 'إجازة الاختبارات', from: addDays(today, 3), to: addDays(today, 3) });
  await setPersona(p, { persona: 'manager' }); const fm = await openTask(p, idExam); await p.locator('.split-detail .btn.primary.block', { hasText: 'اعتماد' }).click(); await p.waitForTimeout(1200);
  await setPersona(p, { as: 'P-HRSH' }); const fAli = await openTask(p, idExam); await shot('3-quorum-any-ali', true);
  const aliWhy = await p.locator('.split-detail .task-why').textContent().catch(() => '');
  await setPersona(p, { persona: 'hr' }); const fNoura = await openTask(p, idExam);
  await p.locator('.split-detail .btn.primary.block', { hasText: 'اعتماد' }).click(); await p.waitForTimeout(1200);
  await setPersona(p, { as: 'P-HRSH' }); const stillAli = await openTask(p, idExam); await go(p, '#/notifications', 1200); await shot('4-quorum-any-ali-notified', true);
  const aliNotif = await p.locator('.page').textContent();
  ok('ق.م-04', fm && fAli && fNoura && aliWhy.includes('يكفي أحدكم') && aliWhy.includes('نورة') && !stillAli && aliNotif.includes(`أُغلقت مهمة طلب إجازة ${idExam}`) && aliNotif.includes('قررها نورة'), `task at both (Ali sees "${aliWhy.trim().slice(0, 60)}…"); after Noura approved it left Ali's inbox and he was notified`);
  // ق.م-06: طلب ماجد (منصب مديره شاغر بلا نائب) وصل إلى المدير العام مع السبب في المسار
  await setPersona(p, { as: 'P-GM' }); await go(p, '#/inbox', 1500);
  await p.locator('.row .cell', { hasText: 'ماجد' }).first().click(); await p.waitForTimeout(900); await shot('5-vacant-gm', true);
  const gmWhy = await p.locator('.split-detail .task-why').textContent().catch(() => ''); const gmRail = await railText(p);
  ok('ق.م-06', gmWhy.includes('شاغر ولا نائب؛ إلى الرئيس الأعلى') && gmRail.some((x) => x.includes('عبدالله بن محمد العتيبي')), `GM inbox: "${gmWhy.trim().slice(0, 90)}"`);
  await ctx.close();
}

/* ═══ ٣) نصاب «الكل» ورفض أحدهما (ق.م-05)، وتغيّر الشاغل أثناء مهمة (ق.م-10) ═══ */
{
  const { p, ctx, shot } = await open('quorum-all', lap, '#/home', { persona: 'employee' });
  await setPersona(p, { as: 'P-FAHAD', mutate: `
    const v1 = s.policy.versions[0]; const c = JSON.parse(JSON.stringify(v1.content));
    c.routes[2].steps[1] = { agent: { kind: 'positions', positionIds: ['S-211', 'S-2111'], quorum: 'all' }, mode: 'approve', slaHours: 48 };
    s.policy.versions.push({ id: 'V-2', number: '2026.2', from: '${today}', scheduled: true, createdBy: 'P-OMAR', createdAt: Date.now(), reason: 'تدقيق مزدوج لإجازة الاختبارات', reference: 'قرار ٤٥/٢٠٢٦', content: c, changes: [], baseId: 'V-1', notifiedScheduled: true, notifiedActive: true });
  ` });
  const idExam = await submitLeave(p, { typeText: 'إجازة الاختبارات', from: addDays(today, 5), to: addDays(today, 5) });
  await setPersona(p, { persona: 'manager' }); await openTask(p, idExam); await p.locator('.split-detail .btn.primary.block', { hasText: 'اعتماد' }).click(); await p.waitForTimeout(1200);
  await setPersona(p, { persona: 'hr' }); await openTask(p, idExam); await shot('1-all-noura', true);
  const nouraWhy = await p.locator('.split-detail .task-why').textContent();
  await p.locator('.split-detail .btn.primary.block', { hasText: 'اعتماد' }).click(); await p.waitForTimeout(1200);
  await setPersona(p, { as: 'P-HRSH' }); await openTask(p, idExam); await shot('2-all-ali-partial', true);
  const aliWhy = await p.locator('.split-detail .task-why').textContent(); const railPartial = await railText(p);
  await p.locator('#decision-note').fill('موعد الاختبار غير موثّق'); await p.locator('.split-detail .btn.danger').click(); await p.waitForTimeout(1200);
  await setPersona(p, { as: 'P-FAHAD' }); await go(p, `#/requests/${idExam}`, 1200); await shot('3-all-rejected', true);
  const st = await p.locator('.kbd-row .pill').first().textContent(); const railRej = await railText(p, '.page');
  await go(p, '#/notifications', 1000); const fahadNotif = await p.locator('.page').textContent();
  await setPersona(p, { persona: 'hr' }); await go(p, '#/notifications', 1000); const nouraNotif = await p.locator('.page').textContent();
  ok('ق.م-05', nouraWhy.includes('يلزم اعتماد الكل') && aliWhy.includes('اعتمد حتى الآن: نورة') && railPartial.some((x) => x.includes('(1/2)')) && st.includes('مرفوض') && railRej.some((x) => x.includes('علي') && x.includes('موعد الاختبار غير موثّق')) && fahadNotif.includes('موعد الاختبار غير موثّق') && nouraNotif.includes(`أُغلقت مهمة طلب إجازة ${idExam}`) && nouraNotif.includes('رفضها علي'), `all-quorum: Noura approved (1/2), Ali rejected → request rejected; Fahad got the reason; Noura told the task closed`);
  // ق.م-10: يتغيّر شاغل منصب رئيس القسم (S-111) أثناء مهمة سارة السنوية → المهمة تنتقل إلى الشاغل الجديد بسطر في السجل
  await setPersona(p, { persona: 'admin' }); await go(p, '#/admin/policy', 1400); await seg(p, 'الهيكل').click(); await p.waitForTimeout(900);
  const row = p.locator('.org-pos', { hasText: 'رئيس قسم التمكين الرقمي' }).first(); await row.locator('select').selectOption('P-HRS2'); await p.waitForTimeout(1000);
  await p.evaluate(() => document.querySelector('.org-tree')?.scrollIntoView({ block: 'start' })); await shot('4-holder-changed', true);
  const rowTxt = await p.locator('.org-pos', { hasText: 'رئيس قسم التمكين الرقمي' }).first().textContent();
  await setPersona(p, { as: 'P-HRS2' }); const turkiHas = await openTask(p, 'REQ-2026-0389'); await shot('5-turki-inbox', true);
  const turkiRail = await railText(p); const turkiAudit = await (async () => { await go(p, '#/requests/REQ-2026-0389', 1200); return (await p.locator('.page').textContent()); })();
  await setPersona(p, { persona: 'manager' }); const monaHas = await openTask(p, 'REQ-2026-0389');
  ok('ق.م-10', rowTxt.includes('تركي') && turkiHas && turkiRail.some((x) => x.includes('تركي')) && turkiAudit.includes('تغيّر شاغل رئيس قسم التمكين الرقمي وذكاء الأعمال؛ انتقلت المهمة إلى تركي') && !monaHas, `S-111 → Turki: Sara's task moved to him with an audit line; Mona no longer has it`);
  await ctx.close();
}

/* ═══ ٤) الاستحقاق المختار ومهمة التنفيذ (ق.م-13): فهد يطلب ٣٠ يوماً مع راتب مقدّم وتذاكر ═══ */
{
  const { p, ctx, shot } = await open('fulfil', lap, '#/home', { as: 'P-FAHAD' });
  await go(p, '#/new/TM-01', 1400); await p.locator('.type-hero').first().click(); await p.waitForTimeout(800); await p.locator('.btn.primary.block').click(); await p.waitForTimeout(900);
  await pickDate(p, '2026-11-01'); await pickDate(p, '2026-11-30'); await p.waitForTimeout(1500);
  await p.evaluate(() => document.querySelector('.ent-cell')?.scrollIntoView({ block: 'center' })); await p.waitForTimeout(300); await shot('1-entitlements');
  const entTxt = await p.locator('.ent-cell').allTextContents();
  await p.locator('.ent-cell', { hasText: 'راتب الإجازة المقدّم' }).locator('input.checkbox').check(); await p.locator('.ent-cell', { hasText: 'تذاكر' }).locator('input.checkbox').check(); await p.waitForTimeout(500);
  await p.evaluate(() => window.scrollTo(0, 0)); await shot('2-route-with-fulfil', true);
  const preview = await p.locator('aside .route-preview').textContent();
  await p.locator('.btn.primary.block').click(); await p.waitForTimeout(800); await p.locator('.btn.primary.block').click(); await p.waitForTimeout(800); await shot('3-review', true);
  await p.locator('.btn.primary.block').click(); await p.waitForTimeout(2300);
  const id = (await p.locator('.success-id').textContent().catch(() => '')) || '';
  ok('ق.م-13-a', entTxt.some((x) => x.includes('راتب الإجازة المقدّم') && x.includes('ينفّذه فريق قسم الرواتب') && x.includes('قبل بداية الإجازة بـ5 أيام')) && entTxt.some((x) => x.includes('تذاكر') && x.includes('ينفّذه فريق قسم الانتدابات والاستحقاقات')) && preview.includes('تنفيذ: راتب الإجازة المقدّم') && preview.includes('بدر') , `entitlement checkboxes name the executing team and timing; route preview shows fulfilment steps · ${id}`);
  // المدير يعتمد → الطلب مكتمل وصدر القرار → مهمة تنفيذ عند الرواتب (بدر وريم) وعند الانتدابات (نايف)
  await setPersona(p, { persona: 'manager' }); await openTask(p, id); await p.locator('.split-detail .btn.primary.block', { hasText: 'اعتماد' }).click(); await p.waitForTimeout(1500);
  await setPersona(p, { as: 'P-PAYS' }); const reemHas = await openTask(p, id); await shot('4-payroll-task', true);
  const taskPill = await p.locator('.row.selected .pill').first().textContent().catch(() => ''); const reemRail = await railText(p);
  await p.locator('#fulfil-ref').fill('PY-2026-1187'); await p.locator('.split-detail .btn.primary.block', { hasText: 'تم التنفيذ' }).click(); await p.waitForTimeout(1500);
  await setPersona(p, { as: 'P-FIN' }); const nayefHas = await openTask(p, id); await p.locator('#fulfil-ref').fill('TK-2026-0331'); await p.locator('.split-detail .btn.primary.block', { hasText: 'تم التنفيذ' }).click(); await p.waitForTimeout(1500);
  await setPersona(p, { as: 'P-FAHAD' }); await go(p, `#/requests/${id}`, 1400); await shot('5-request-fulfilled', true);
  const card = await p.locator('.leave-card').textContent(); const rail = await railText(p, '.page'); const audit = await p.locator('.page').textContent();
  await go(p, '#/notifications', 1000); const notif = await p.locator('.page').textContent();
  ok('ق.م-13-b', reemHas && taskPill.includes('مهمة تنفيذ') && reemRail.some((x) => x.includes('تنفيذ: راتب الإجازة المقدّم')) && nayefHas && card.includes('راتب مقدّم · نُفِّذ PY-2026-1187') && card.includes('تذاكر الإجازة · نُفِّذ TK-2026-0331') && rail.some((x) => x.includes('ريم') && x.includes('PY-2026-1187')) && audit.includes('نُفِّذ: تنفيذ: راتب الإجازة المقدّم · المرجع PY-2026-1187') && notif.includes('نُفِّذ: تنفيذ: راتب الإجازة المقدّم'), `payroll task fulfilled with a reference by Reem; tickets by Nayef; request and notifications show "نُفِّذ" with the references`);
  // القرار الرسمي يذكر الاستحقاقات وسلسلة الاعتماد بالمنصب
  await go(p, `#/requests/${id}`, 1200); await p.locator('.seal-act').first().click(); await p.waitForTimeout(1200); await shot('6-decision', true);
  const doc = await p.locator('.doc-preview').first().textContent();
  ok('ق.م-13-c', doc.includes('راتب الإجازة المقدّم') && doc.includes('رئيس قسم التمكين الرقمي') && doc.includes('PY-2026-1187'), 'decision document lists the entitlements and the approval chain by position with fulfilment references');
  await ctx.close();
}

/* ═══ ٤ب) الفئات ومهام التنفيذ في المحرر (v0.6.1/v0.6.2): نطاق الاستحقاق يتغير في مسودة فيتغير من يراه ═══ */
{
  const { p, ctx, shot } = await open('ents', lap, '#/admin/policy', { persona: 'admin' });
  await seg(p, 'الاستحقاقات').click(); await p.waitForTimeout(900); await shot('1-ents', true);
  const entsTxt = await p.locator('.ent-ed').allTextContents();
  ok('ق.م-13-d', entsTxt.length === 2 && entsTxt[1].includes('موظف رسمي') && entsTxt[1].includes('قسم الرواتب') && entsTxt[1].includes('قبل بداية الإجازة') && entsTxt[0].includes('خارج الموطن'), 'entitlements tab shows scope (groups from H4S4), executing office, timing and mode');
  await seg(p, 'أنواع').click(); await p.waitForTimeout(800); await p.locator('.pt-card').first().click(); await p.waitForTimeout(900); await p.evaluate(() => document.querySelector('.sheet .scope')?.scrollIntoView({ block: 'center' })); await p.waitForTimeout(400); await shot('2-type-scope');
  await p.locator('.sheet .icon-btn').first().click().catch(() => {}); await p.waitForTimeout(600);
  // مسودة: راتب الإجازة المقدّم للمتعاقدين أيضاً → المحاكاة لسارة (متعاقد) تُظهر مهمة التنفيذ
  await p.locator('.ptl-card.new').click(); await p.waitForTimeout(900); await p.locator('.new-version .segmented button', { hasText: 'السياسة كلها' }).click(); await p.waitForTimeout(300); await p.locator('.new-version .btn.primary').click(); await p.waitForTimeout(1200); await seg(p, 'الاستحقاقات').click(); await p.waitForTimeout(900);
  await p.locator('.ent-ed').nth(1).locator('.scope-row').first().locator('.pill', { hasText: 'متعاقد' }).click(); await p.waitForTimeout(500); await shot('3-scope-edit', true);
  await seg(p, 'المحاكاة').click(); await p.waitForTimeout(900);
  await sel(p, 'الموظف').selectOption('P-SARA'); await sel(p, 'النوع').selectOption('annual');
  await p.locator('label:has-text("من") input[type="date"]').first().fill('2027-02-01'); await p.locator('label:has-text("إلى") input[type="date"]').first().fill('2027-03-02');
  await p.locator('.btn.primary', { hasText: 'شغّل المحاكاة' }).click(); await p.waitForTimeout(1200); await shot('4-sim-sara-advance', true);
  const sim = await p.locator('.sim-route').textContent();
  ok('ق.م-12-b', sim.includes('تنفيذ: راتب الإجازة المقدّم') && sim.includes('تنفيذ: تذاكر الإجازة السنوية'), 'after widening the scope to contract employees in the draft, Sara (contract, outside home) gets both fulfilment steps in the simulation');
  await ctx.close();
}

/* ═══ ٤ج) نوع إجازة جديد من الشاشة (سؤال عمر: «لو أنشأت الموارد البشرية نوعاً جديداً؟»): يُضاف في مسودة، يُضبط، يُجدوَل، فيظهر للموظف ويُقدَّم عليه ═══ */
{
  const { p, ctx, shot } = await open('newtype', lap, '#/admin/policy', { persona: 'admin' });
  await p.locator('.ptl-card.new').click(); await p.waitForTimeout(900); await p.locator('.new-version .segmented button', { hasText: 'السياسة كلها' }).click(); await p.waitForTimeout(300); await p.locator('.new-version .btn.primary').click(); await p.waitForTimeout(1200);
  await p.locator('.pt-card.new').click(); await p.waitForTimeout(900); await shot('1-sheet');
  // v0.6.4: النوع يُختار من قائمة النظام المرجعي (الرمز 0530) فيُملأ اسمه منها
  await p.locator('#nt-erp').selectOption('01|0530'); await p.waitForTimeout(300);
  const autoAr = await p.locator('#nt-ar').inputValue(); const autoEn = await p.locator('#nt-en').inputValue();
  ok('ق.م-15-erp', autoAr === 'إجازة دراسية' && autoEn === 'Study leave', `picking code 0530 from the ERP list fills the name: "${autoAr}" / "${autoEn}"`);
  await p.locator('.sheet .segmented button', { hasText: 'المدير ثم شؤون الموظفين' }).click(); await p.waitForTimeout(200);
  await p.locator('.sheet .icon-pick').nth(6).click(); await p.locator('.sheet .tone-pick.g-teal').click(); await p.waitForTimeout(300); await shot('2-sheet-filled', true);
  await p.locator('.sheet .btn.primary.block').click(); await p.waitForTimeout(1200); await shot('3-editor', true);
  const editorTxt = await p.locator('.sheet').textContent();
  await p.locator('.sheet label:has-text("السقف الأقصى للطلب") input').fill('10'); await p.waitForTimeout(200);
  await p.locator('.sheet label:has-text("بالعربية") textarea').first().fill('عشرة أيام في السنة الدراسية لأداء متطلبات الدراسة، بإثبات القبول.'); await p.waitForTimeout(300);
  await p.locator('.sheet .icon-btn').first().click().catch(() => {}); await p.waitForTimeout(700);
  const cardTxt = await p.locator('.pt-card', { hasText: 'إجازة دراسية' }).textContent();
  await p.locator('.sb-why').fill('اعتماد إجازة دراسية جديدة بقرار الأمين العام المساعد'); await p.locator('.savebar .btn').click(); await p.waitForTimeout(1000);
  await seg(p, 'ماذا يتغير').click(); await p.waitForTimeout(900); await shot('4-diff', true);
  const diffTxt = await p.locator('.diff-row').allTextContents();
  await p.locator('.section-head .btn.soft').click(); await p.waitForTimeout(900);
  await p.locator('#sc-from').fill(today); await p.locator('#sc-reason').fill('إضافة الإجازة الدراسية إلى سياسة الإجازات'); await p.locator('#sc-ref').fill('قرار ٤٦/٢٠٢٦');
  await p.locator('.sheet .btn.primary.block').click(); await p.waitForTimeout(1500);
  const status = await p.locator('.pv-line .pill').first().textContent();
  ok('ق.م-15-a', editorTxt.includes('جديد في هذه المسودة') && editorTxt.includes('حذف النوع من المسودة') && cardTxt.includes('إجازة دراسية') && cardTxt.includes('0530') && diffTxt.some((x) => x.includes('إجازة دراسية · الاسم')) && diffTxt.some((x) => x.includes('إجازة دراسية · السقف الأقصى للطلب الواحد')) && status.includes('سارٍ'), `new type created in the draft, rules set, change log readable (${diffTxt.length} rows), version in force today`);
  // الموظف يراه في شاشة الاختيار ويقدّم عليه
  await setPersona(p, { persona: 'employee' }); await go(p, '#/new/TM-01', 1400);
  const picker = await p.locator('main').first().textContent();
  await p.locator('.type-row', { hasText: 'إجازة دراسية' }).first().click(); await p.waitForTimeout(900); await shot('5-picker', true);
  const detail = await p.locator('.type-detail').first().textContent();
  const id = await submitLeave(p, { typeText: 'إجازة دراسية', from: '2026-11-08', to: '2026-11-12' });
  await go(p, `#/requests/${id}`, 1200); await shot('6-request', true);
  const card = await p.locator('.leave-card').textContent(); const rail = await railText(p, '.page');
  ok('ق.م-15-b', picker.includes('إجازة دراسية') && detail.includes('اعتماد المدير المباشر') && detail.includes('اعتماد فريق قسم شؤون الموظفين') && detail.includes('عشرة أيام') && card.includes('إجازة دراسية') && card.includes('2026.2') && rail.some((x) => x.includes('منى')), `picker=${picker.includes('إجازة دراسية')} detail=${detail.includes('اعتماد المدير المباشر')}/${detail.includes('اعتماد فريق قسم شؤون الموظفين')}/${detail.includes('عشرة أيام')} card=${card.includes('إجازة دراسية')}/${card.includes('2026.2')} rail=${rail.some((x) => x.includes('منى'))} · ${id} · detail="${detail.slice(0, 160)}"`);
  // الوثيقة تذكره برمزه في النظام المرجعي
  await setPersona(p, { persona: 'admin' }); await go(p, '#/admin/policy', 1400); await p.locator('.ptl-card', { hasText: '2026.2' }).click(); await p.waitForTimeout(600); await p.locator('.pv-line .btn.quiet').click(); await p.waitForTimeout(1300);
  const doc = await p.locator('.sheet .doc-preview').textContent();
  ok('ق.م-15-c', doc.includes('إجازة دراسية') && doc.includes('نوع الغياب في النظام المرجعي: 0530'), 'the exported policy document lists the new type with its H4S4 absence-type code');
  await ctx.close();
}

/* ═══ ٥) بوابة المستوى (ق.م-14): الهاتف، والإنجليزية، والداكن ═══ */
{
  const { p, ctx, shot } = await open('phone', ph, '#/admin/policy', { persona: 'admin', touch: true });
  await seg(p, 'المسارات').click(); await p.waitForTimeout(900); await shot('1-routes', true);
  await seg(p, 'الهيكل').click(); await p.waitForTimeout(900); await shot('2-org', true);
  await seg(p, 'الاستحقاقات').click(); await p.waitForTimeout(900); await shot('2b-ents', true);
  const w = await p.evaluate(() => document.documentElement.scrollWidth); ok('ق.م-14-phone', w <= 400, `no horizontal overflow on the phone (scrollWidth=${w})`);
  await setPersona(p, { as: 'P-GM' }); await go(p, '#/inbox', 1400); await p.locator('.row .cell', { hasText: 'ماجد' }).first().click(); await p.waitForTimeout(900); await shot('3-gm-task-phone', true);
  await setPersona(p, { as: 'P-FAHAD' }); await go(p, '#/new/TM-01', 1400); await p.locator('.type-hero').first().click(); await p.waitForTimeout(900); await shot('4-detail-sheet');
  await ctx.close();
}
{
  const { p, ctx, shot } = await open('en-dark', lap, '#/admin/policy', { persona: 'admin', lang: 'en', dark: true });
  await p.locator('.policy .segmented button', { hasText: 'Standard routes' }).first().click(); await p.waitForTimeout(900); await shot('1-routes', true);
  const txt = await p.locator('.route-ed').first().textContent();
  await p.locator('.policy .segmented button', { hasText: 'Structure' }).first().click(); await p.waitForTimeout(900); await shot('2-org', true);
  await p.locator('.policy .segmented button', { hasText: 'Simulation' }).first().click(); await p.waitForTimeout(900);
  await sel(p, 'Employee').selectOption('P-MAJED'); await p.locator('label:has-text("From") input[type="date"]').first().fill('2026-11-01'); await p.locator('label:has-text("To") input[type="date"]').first().fill('2026-11-05');
  await p.locator('.btn.primary', { hasText: 'Run simulation' }).click(); await p.waitForTimeout(1200); await shot('3-sim', true);
  const sim = await p.locator('.sim-route').textContent();
  ok('ق.م-14-en', txt.includes('Line manager approval') && sim.includes('is vacant with no deputy; to the superior') && sim.includes('Abdullah Al-Otaibi'), `English: "${sim.slice(0, 120)}"`);
  await ctx.close();
}
/* ═══ ٦) الربط بالنظام المرجعي (ق.م-16، v0.6.4 — تعليمة عمر: «كل إجازة في SAP لها رقم؛ اجعلها دائماً مناسبة لـ SAP»): القائمة المرجعية للقراءة، ونوع بلا رمز لا يُجدوَل، والربط من المحرر، والرمز لا يُختار مرتين ═══ */
{
  const { p, ctx, shot } = await open('erp', lap, '#/admin/policy', { persona: 'admin' });
  await p.locator('.ptl-card.new').click(); await p.waitForTimeout(900); await p.locator('.new-version .segmented button', { hasText: 'السياسة كلها' }).click(); await p.waitForTimeout(300); await p.locator('.new-version .btn.primary').click(); await p.waitForTimeout(1200);
  const erpList = await p.locator('.erp-list .erp-row').allTextContents(); await shot('1-reference-list', true);
  ok('ق.م-16-a', erpList.length === 18 && erpList.some((x) => x.includes('0100') && x.includes('مرتبط بـ الإجازة السنوية') && x.includes('رصيد الإجازة السنوية')) && erpList.some((x) => x.includes('0600') && x.includes('غير مستخدم في السياسة')) && erpList.some((x) => x.includes('0800') && x.includes('حضور')), `the H4S4 absence/attendance list is shown read-only with its links: ${erpList.length} types`);
  // نوع جديد بلا رمز: تحذير في الورقة والمحرر والبطاقة، والجدولة ممنوعة باسم النوع
  await p.locator('.pt-card.new').click(); await p.waitForTimeout(900);
  const sheetWarn = await p.locator('.sheet .notice').first().textContent();
  await p.locator('#nt-ar').fill('إجازة تفرغ'); await p.locator('#nt-en').fill('Sabbatical'); await p.locator('.sheet .btn.primary.block').click(); await p.waitForTimeout(1200);
  const edWarn = await p.locator('.sheet').textContent(); await shot('2-editor-unlinked', true);
  await p.locator('.sheet .icon-btn').first().click().catch(() => {}); await p.waitForTimeout(700);
  const cardTxt = await p.locator('.pt-card', { hasText: 'إجازة تفرغ' }).textContent();
  await p.locator('.section-head .btn.soft').click(); await p.waitForTimeout(900);
  await p.locator('#sc-from').fill(today); await p.locator('#sc-reason').fill('تجربة'); await p.locator('#sc-ref').fill('—'); await p.waitForTimeout(300);
  const schedNotice = await p.locator('.sheet .notice.danger').textContent().catch(() => ''); const blocked = await p.locator('.sheet .btn.primary.block').isDisabled(); await shot('3-schedule-blocked', true);
  ok('ق.م-16-b', sheetWarn.includes('غير مرتبط بنوع غياب') && edWarn.includes('غير مرتبط بنوع غياب في النظام المرجعي') && cardTxt.includes('غير مرتبط بالنظام المرجعي') && schedNotice.includes('لا يمكن جدولة الإصدار') && schedNotice.includes('إجازة تفرغ') && blocked, `an unlinked type is flagged in the sheet, the editor and the card, and scheduling is blocked naming it: "${schedNotice.slice(0, 80)}…"`);
  // الربط من المحرر يفتح الجدولة، والقائمة المرجعية تعكسه، والرمز المستخدم لا يُعرض لنوع آخر
  await p.locator('.sheet .icon-btn').first().click().catch(() => {}); await p.waitForTimeout(600);
  await p.locator('.pt-card', { hasText: 'إجازة تفرغ' }).click(); await p.waitForTimeout(900);
  await p.locator('.sheet select.erp-sel').selectOption('01|0530'); await p.waitForTimeout(500);
  const linkedInfo = await p.locator('.sheet .erp-info').textContent(); const edWarnGone = (await p.locator('.sheet .notice.warn').count()) === 0; await shot('4-editor-linked', true);
  await p.locator('.sheet .icon-btn').first().click().catch(() => {}); await p.waitForTimeout(700);
  const listAfter = await p.locator('.erp-list .erp-row', { hasText: '0530' }).textContent();
  await p.locator('.pt-card.new').click(); await p.waitForTimeout(700); const optTaken = await p.locator('#nt-erp option[value="01|0530"]').isDisabled(); const optTxt = await p.locator('#nt-erp option[value="01|0530"]').textContent();
  await p.locator('.sheet .icon-btn').first().click().catch(() => {}); await p.waitForTimeout(600);
  await p.locator('.section-head .btn.soft').click(); await p.waitForTimeout(900);
  await p.locator('#sc-from').fill(today); await p.locator('#sc-reason').fill('تجربة'); await p.locator('#sc-ref').fill('—'); await p.waitForTimeout(300);
  const allowed = !(await p.locator('.sheet .btn.primary.block').isDisabled()); const noNotice = (await p.locator('.sheet .notice.danger').count()) === 0;
  ok('ق.م-16-c', linkedInfo.includes('0530') && linkedInfo.includes('إجازة دراسية') && linkedInfo.includes('بلا رصيد') && edWarnGone && listAfter.includes('مرتبط بـ إجازة تفرغ') && optTaken && optTxt.includes('مرتبط بـ إجازة تفرغ') && allowed && noNotice, `linking from the editor: info "${linkedInfo.slice(0, 60)}…", list reflects it, code 0530 disabled for other types, scheduling allowed`);
  await ctx.close();
}

/* ═══ ٧) الموظف يعرف أن طلبه اعتُمد (ق.م-17، سؤال عمر): «جديد لك» في الرئيسية، ونص التنبيه، وفتحه يقرؤه ويذهب إلى الطلب؛ والترحيل بالرمز في سجل الطلب (ق.م-16-d) ═══ */
{
  const { p, ctx, shot } = await open('news', lap, '#/home', { persona: 'employee', mutate: "s.balances['P-AHMED'].annual = 45; s.notifications = s.notifications.map((n) => ({ ...n, read: true }));" });
  // إجازة الاختبارات: خطوتان بشريتان (المدير ثم فريق شؤون الموظفين) ليظهر «اعتُمدت خطوة» ثم «اعتُمدت إجازتك»
  const id = await submitLeave(p, { typeText: 'إجازة الاختبارات', from: addDays(today, 6), to: addDays(today, 6) });
  await go(p, '#/home', 1500); const news0 = await p.locator('.area-news .cell').allTextContents();
  await setPersona(p, { persona: 'manager' }); const fm = await openTask(p, id); await p.locator('.split-detail .btn.primary.block', { hasText: 'اعتماد' }).click(); await p.waitForTimeout(1200);
  await setPersona(p, { persona: 'employee' }); await go(p, '#/home', 1500); await shot('1-home-step-approved', true);
  const news1 = await p.locator('.area-news .cell').allTextContents();
  await setPersona(p, { persona: 'hr' }); const fh = await openTask(p, id); await p.locator('.split-detail .btn.primary.block', { hasText: 'اعتماد' }).click(); await p.waitForTimeout(1500);
  await setPersona(p, { persona: 'employee' }); await go(p, '#/home', 1500); await shot('2-home-approved', true);
  const news2 = await p.locator('.area-news .cell').allTextContents();
  ok('ق.م-17-a', fm && fh && news0.some((x) => x.includes('استلمنا طلب إجازة')) && news1.some((x) => x.includes('اعتُمد طلب إجازة') && x.includes('اعتماد المدير المباشر') && x.includes('اعتمده') && x.includes('الخطوة الأخيرة')) && news2.some((x) => x.includes('اعتُمدت إجازتك: إجازة الاختبارات') && x.includes('صدر قرار الإجازة')), `Home «جديد لك» after each decision: received → step approved by the manager (last step left) → leave approved with the decision number: ${JSON.stringify(news2.map((x) => x.slice(0, 50)))}`);
  await p.locator('.area-news .cell', { hasText: 'اعتُمدت إجازتك' }).first().click(); await p.waitForTimeout(1300); await shot('3-request-approved', true);
  const url = p.url(); const reqTxt = await p.locator('.page').textContent(); const audit = await p.locator('.page main .cell').allTextContents();
  await go(p, '#/home', 1200); const news3 = await p.locator('.area-news .cell').allTextContents();
  await go(p, '#/notifications', 1200); const notifTxt = await p.locator('.page').textContent();
  ok('ق.م-17-b', url.includes(`#/requests/${id}`) && reqTxt.includes('مكتمل') && reqTxt.includes('قرار إجازة') && news3.length === news2.length - 1 && notifTxt.includes('اعتُمدت إجازتك'), `opening the item goes to the request (completed, decision issued), marks it read (${news2.length} → ${news3.length}), and it stays in the notifications list`);
  ok('ق.م-16-d', audit.some((x) => x.includes('سُجِّل الغياب في النظام المرجعي') && x.includes('نوع الغياب 0300')), `the system step posts by the H4S4 code, not the name: "${audit.find((x) => x.includes('النظام المرجعي'))?.slice(0, 90)}"`);
  // الهاتف: القسم نفسه يظهر تحت بطاقة «بانتظارك»
  const ph1 = await open('news-phone', ph, '#/home', { persona: 'employee', touch: true, mutate: "s.notifications = s.notifications.map((n) => ({ ...n, read: true })); s.notifications.unshift({ id: 'N-DEMO', to: 'P-AHMED', kind: 'document', at: Date.now(), title: { ar: 'اعتُمدت إجازتك: الإجازة السنوية', en: 'Your leave is approved: Annual leave' }, body: { ar: '2026-11-01 → 2026-11-05 (5 أيام) · صدر قرار الإجازة رقم LD-2026-0001 وسُجِّلت في النظام المرجعي.', en: '' }, link: '#/requests', read: false });" });
  const phTxt = await ph1.p.locator('.area-news').textContent().catch(() => ''); await ph1.shot('1', true);
  const w = await ph1.p.evaluate(() => document.documentElement.scrollWidth);
  ok('ق.م-17-phone', phTxt.includes('جديد لك') && phTxt.includes('اعتُمدت إجازتك') && w <= 400, `phone Home shows «جديد لك» with the approval (scrollWidth=${w})`);
  await ph1.ctx.close();
  await ctx.close();
}

await b.close();
fs.writeFileSync('dist/v6-results.json', JSON.stringify({ today, checks, errs }, null, 2));
console.log('errors:', errs.length ? errs : 'none');
console.log(checks.every((r) => r.pass) ? 'ALL PASS' : 'SOME FAILED');
