// v0.18 «مركز الإدارة»: صفحة إدارة واحدة تجمع كل ما يخصّ المشرف، وشريط أقسام الإدارة على كل شاشة إدارة، ومعاينة القالب والمستند قبل الحفظ،
// وطيّ «أخطأت في إصدار سارٍ؟»، وطيّ دليل الخدمات على الحاسوب، وسطر إدارة واحد في «أنا»، وحجم النص (ملاحظتا عمر بعد v0.17)
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import path from 'node:path';
import fs from 'node:fs';
const file = 'file://' + path.resolve('dist/index.html');
const OUT = process.argv[2] || 'shots/v18'; fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const errors = []; const rows = [];
const ok = (name, pass, detail = '') => { rows.push({ name, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`); };
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const p = await ctx.newPage();
p.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
await p.goto(file + '#/home', { waitUntil: 'load' }); await p.waitForTimeout(500);
const become = async (who, hash, vp) => {
  if (vp) await p.setViewportSize(vp);
  await p.evaluate((who) => { const s = JSON.parse(localStorage.getItem('usp-portal-v1')); if (who === 'admin') { s.settings.persona = 'admin'; s.settings.actAs = undefined; } else { const w = s.people.find((x) => x.id === who); s.settings.persona = w.persona; s.settings.actAs = who; } localStorage.setItem('usp-portal-v1', JSON.stringify(s)); }, who);
  await p.goto(file + hash); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1200);
};
const setLang = async (lang) => { await p.evaluate((lang) => { const s = JSON.parse(localStorage.getItem('usp-portal-v1')); s.settings.lang = lang; localStorage.setItem('usp-portal-v1', JSON.stringify(s)); }, lang); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1000); };
const overflow = async () => p.evaluate(() => { const root = document.querySelector('.app-root') || document.body; return Math.max(0, root.scrollWidth - root.clientWidth, document.documentElement.scrollWidth - document.documentElement.clientWidth); });
const clickTab = async (name) => { const seg = p.locator('.dzs-main .segmented').first(); const inDz = await seg.count(); await (inDz ? seg.locator('button', { hasText: name }).first() : p.getByRole('button', { name }).first()).click(); await p.waitForTimeout(500); };
const count = (sel) => p.locator(sel).count();
const hash = () => p.evaluate(() => location.hash);

/* ═══ 1) مركز الإدارة: صفحة واحدة تجمع كل شيء ═══ */
await become('admin', '#/admin');
ok('center-renders', (await count('.adm-grid')) === 1 && (await count('.adm-main')) === 1 && (await count('.adm-side')) === 1);
ok('center-nav-10', (await count('.adm-nav .adm-chip')) === 10 && (await count('.adm-nav .adm-chip.on')) === 1 && (await p.locator('.adm-nav .adm-chip.on').textContent()).includes('الإدارة'), `${await count('.adm-nav .adm-chip')} chips`);
ok('center-tiles-4', (await count('.adm-tiles .adm-tile')) === 4, `${await count('.adm-tiles .adm-tile')} tiles`);
ok('center-tiles-live', (await count('.adm-tiles .adm-tile .pill')) >= 4, 'كل بطاقة سياسة تعرض حالة الإصدار');
ok('center-stats', (await count('.adm-stats .adm-stat')) >= 4 && (await count('.adm-stats .adm-stat b')) >= 4);
const focusN = await count('.fc-list .fc-row'); const quiet = await count('.adm-quiet');
ok('center-focus', focusN > 0 || quiet === 1, `${focusN} focus items · quiet ${quiet}`);
ok('center-structure-6', (await count('.adm-side .lrow-list .lrow')) === 6, `${await count('.adm-side .lrow-list .lrow')} rows`);
ok('center-overflow-0', (await overflow()) === 0);
await p.screenshot({ path: `${OUT}/v18-1-center-desk.png`, fullPage: true });

/* الشريط الجانبي: سطر إدارة واحد لا خمسة */
const sideAdmin = await count('.side-item[href="#/admin"]'); const sideOld = await count('.side-item[href="#/admin/policy"], .side-item[href="#/admin/designer"], .side-item[href="#/admin/tenants"], .side-item[href="#/admin/contracts"], .side-item[href="#/admin/need"]');
ok('sidebar-one-admin-entry', sideAdmin === 1 && sideOld === 0, `admin ${sideAdmin} · old ${sideOld}`);
ok('sidebar-admin-current', (await p.locator('.side-item[href="#/admin"]').getAttribute('aria-current')) === 'page');
const sideCount = await p.locator('.side-item[href="#/admin"] .count').count();
ok('sidebar-admin-focus-count', focusN === 0 ? sideCount === 0 : sideCount === 1 && Number(await p.locator('.side-item[href="#/admin"] .count').textContent()) === focusN, `count ${sideCount} vs focus ${focusN}`);

/* بند التركيز يقود إلى مكانه، و«متأخّر» ينزل إلى قسم المتابعة داخل الصفحة */
if (focusN) {
  const first = p.locator('.fc-list .fc-row').first(); const href = await first.getAttribute('href');
  await first.click(); await p.waitForTimeout(700);
  const h = await hash();
  ok('focus-row-navigates', href === '#/admin#overdue' ? h.startsWith('#/admin') : h === href, `${href} → ${h}`);
  await become('admin', '#/admin');
}

/* ═══ 2) شريط الأقسام على كل شاشة إدارة، والرجوع إلى المركز ═══ */
const NAV = [['#/admin/policy', 'سياسة الإجازات'], ['#/admin/need', 'سياسة الاحتياج'], ['#/admin/comms', 'الأخبار والقصص'], ['#/admin/designer', 'مصمّم الخدمات'], ['#/admin/tenants', 'المستأجرون'], ['#/admin/contracts', 'عقود التكامل'], ['#/admin/registers', 'السجلات'], ['#/admin/policy/org', 'الهيكل والمناصب'], ['#/admin/policy/ops', 'التشغيل']];
for (const [href, label] of NAV) {
  await p.locator(`.adm-nav .adm-chip[href="${href}"]`).click(); await p.waitForTimeout(900);
  const h = await hash(); const navs = await count('.adm-nav'); const on = await p.locator('.adm-nav .adm-chip.on').allTextContents();
  ok(`nav-${href.replace('#/admin/', '').replace('/', '-')}`, h === href && navs === 1 && on.length === 1 && on[0].includes(label), `${h} · navs ${navs} · on «${on.join('|')}»`);
}
/* الهيكل والمناصب: الرابط يفتح اللسان مباشرة */
await p.goto(file + '#/admin/policy/org'); await p.waitForTimeout(900);
ok('org-opens-tab', (await p.locator('.segmented button[aria-pressed="true"]').first().textContent()).includes('الهيكل'), await p.locator('.segmented button[aria-pressed="true"]').first().textContent());
await p.goto(file + '#/admin/policy/ops'); await p.waitForTimeout(900);
ok('ops-opens-tab', (await p.locator('.segmented button[aria-pressed="true"]').first().textContent()).includes('التشغيل'));
/* زر الرجوع في شاشة إدارة يعود إلى المركز */
await p.goto(file + '#/admin/tenants'); await p.waitForTimeout(700);
await p.locator('.back-btn').first().click(); await p.waitForTimeout(700);
ok('back-to-center', (await hash()) === '#/admin', await hash());

/* ═══ 3) «أخطأت في إصدار سارٍ؟» مطويّ حتى يُطلب ═══ */
await p.goto(file + '#/admin/policy'); await p.waitForTimeout(900);
ok('fix-box-folded', (await count('.fix-box.folded')) === 1 && (await count('.fix-opts')) === 0);
await p.locator('.fix-toggle').click(); await p.waitForTimeout(400);
ok('fix-box-unfolds', (await count('.fix-box.folded')) === 0 && (await count('.fix-opts')) === 1 && (await p.locator('.fix-toggle').getAttribute('aria-expanded')) === 'true');
await p.locator('.fix-toggle').click(); await p.waitForTimeout(400);
ok('fix-box-folds-again', (await count('.fix-box.folded')) === 1);

/* ═══ 4) مصمّم الخدمات: دليل الخدمات مطويّ على الحاسوب ويُفتح بالنقر أو بالبحث ═══ */
await p.goto(file + '#/admin/designer'); await p.waitForTimeout(900);
const domHeads = await count('.dz-domhead'); const foldedHeads = await count('.dz-domhead.folded');
ok('catalog-folded-desk', domHeads > 0 && foldedHeads === domHeads, `${foldedHeads}/${domHeads} folded`);
await p.locator('.dz-domhead').first().click(); await p.waitForTimeout(500);
ok('catalog-unfold-one', (await count('.dz-domhead.folded')) === domHeads - 1 && (await count('.dz-row')) > 0, `${await count('.dz-row')} rows`);
await p.locator('.dz-domhead').first().click(); await p.waitForTimeout(400);
await p.locator('#dzq').fill('خطاب'); await p.waitForTimeout(600);
ok('catalog-search-unfolds', (await count('.dz-domhead.folded')) === 0 && (await count('.dz-row')) > 0, `${await count('.dz-row')} rows for «خطاب»`);
await p.locator('#dzq').fill(''); await p.waitForTimeout(400);
await p.screenshot({ path: `${OUT}/v18-2-catalog-folded.png` });

/* ═══ 5) معاينة القالب قبل استخدامه ═══ */
await clickTab(/^القوالب/);
const tplBtns = await count('.dz-tpl-preview');
ok('tpl-preview-buttons', tplBtns >= 8, `${tplBtns} buttons`);
await p.locator('.dz-tpl-preview').first().click(); await p.waitForTimeout(900);
ok('tpl-preview-sheet', (await count('.sheet .dz-tplprev')) === 1 && (await count('.sheet .dz-phone-sm .lb-official')) === 1, 'لوح المعاينة بشاشة الموظف');
ok('tpl-preview-summary', (await count('.sheet .dz-tplprev-sum .section-label')) === 3 && (await count('.sheet .dz-tplprev-sum .cell')) >= 3, `${await count('.sheet .dz-tplprev-sum .cell')} cells`);
ok('tpl-preview-form-live', (await count('.sheet .dz-phone-sm .cf-field, .sheet .dz-phone-sm input, .sheet .dz-phone-sm .segmented, .sheet .dz-phone-sm textarea, .sheet .dz-phone-sm select')) > 0, 'النموذج يُرسم بحقوله');
await p.screenshot({ path: `${OUT}/v18-3-template-preview.png` });
let s = await p.evaluate(() => JSON.parse(localStorage.getItem('usp-portal-v1')));
const before = s.designer.versions.map((v) => (v.content.designer?.services || []).length).join(',');
await p.keyboard.press('Escape'); await p.waitForTimeout(500);
s = await p.evaluate(() => JSON.parse(localStorage.getItem('usp-portal-v1')));
ok('tpl-preview-saves-nothing', (await count('.sheet .dz-tplprev')) === 0 && s.designer.versions.map((v) => (v.content.designer?.services || []).length).join(',') === before, `services per version ${before}`);
/* كل القوالب الثمانية تُعاين بلا خطأ */
let tplErrors = 0;
for (let i = 0; i < tplBtns; i++) { const n0 = errors.length; await p.locator('.dz-tpl-preview').nth(i).click(); await p.waitForTimeout(500); if ((await count('.sheet .dz-tplprev')) !== 1 || errors.length > n0) tplErrors++; await p.keyboard.press('Escape'); await p.waitForTimeout(350); }
ok('tpl-preview-all', tplErrors === 0, `${tplBtns} previews · ${tplErrors} failed`);

/* ═══ 6) معاينة المستند قبل الحفظ داخل المصمّم ═══ */
await p.goto(file + '#/admin/designer/svc/DC-01'); await p.waitForTimeout(1200);
ok('doc-mode-switch-present', (await count('.dz-prev-mode')) === 1 && (await count('.dz-prev-mode button')) === 2);
ok('doc-basics-shows-screen', (await count('.dz-phone')) === 1 && (await count('.dz-docprev')) === 0, 'في «الأساسيات» شاشة الموظف');
await clickTab(/^المخرجات/);
ok('doc-outputs-shows-document', (await count('.dz-docprev .doc-preview')) === 1 && (await count('.dz-phone')) === 0, 'في «المخرجات» المستند نفسه');
const docText = await p.locator('.dz-docprev .doc-preview').textContent();
ok('doc-merged-sample', docText.includes('أحمد') && !docText.includes('{{') && docText.length > 80, `${docText.length} chars · has name ${docText.includes('أحمد')} · raw tokens ${docText.includes('{{')}`);
const footprint = () => p.evaluate(() => { const s = JSON.parse(localStorage.getItem('usp-portal-v1')); return `${s.requests.length} reqs · ${s.requests.reduce((n, r) => n + (r.docs || []).length, 0)} docs · ${(s.registers || []).length} reg`; });
const fpBefore = await footprint();
await p.screenshot({ path: `${OUT}/v18-4-doc-preview-pane.png` });
/* المفتاح يعيد شاشة الموظف ثم المستند */
await p.locator('.dz-prev-mode button').first().click(); await p.waitForTimeout(500);
ok('doc-switch-to-screen', (await count('.dz-phone')) === 1 && (await count('.dz-docprev')) === 0);
await p.locator('.dz-prev-mode button').last().click(); await p.waitForTimeout(500);
ok('doc-switch-to-doc', (await count('.dz-docprev .doc-preview')) === 1);
/* زر «معاينة المستند» في بطاقة المخرج يفتح اللوح */
ok('doc-sheet-button', (await count('.dz-doc-preview')) >= 1);
await p.locator('.dz-doc-preview').first().click(); await p.waitForTimeout(800);
ok('doc-sheet-opens', (await count('.sheet .dz-docsheet .doc-preview')) === 1);
await p.screenshot({ path: `${OUT}/v18-5-doc-preview-sheet.png` });
await p.keyboard.press('Escape'); await p.waitForTimeout(400);
/* تغيير الشخص يغيّر المعاينة */
const opt = await p.locator('.dz-preview-head select option').nth(1).getAttribute('value');
await p.locator('.dz-preview-head select').selectOption(opt); await p.waitForTimeout(600);
const docText2 = await p.locator('.dz-docprev .doc-preview').textContent();
ok('doc-follows-person', docText2 !== docText && !docText2.includes('{{'), `changed ${docText2 !== docText}`);
const fpAfter = await footprint();
ok('doc-preview-side-effect-free', fpAfter === fpBefore, `${fpBefore} → ${fpAfter}`);
/* خدمة بلا مستند: لا مفتاح */
await p.goto(file + '#/admin/designer/svc/PR-07'); await p.waitForTimeout(1000);
ok('doc-no-switch-without-document', (await count('.dz-prev-mode')) === 0 && (await count('.dz-phone')) === 1, 'PR-07 بلا مخرج مستند');

/* ═══ 7) «أنا»: سطر إدارة واحد؛ وحجم النص ═══ */
await p.goto(file + '#/me'); await p.waitForTimeout(900);
ok('me-one-admin-row', (await count('a.lrow[href="#/admin"]')) === 1 && (await count('a.lrow[href="#/admin/policy"], a.lrow[href="#/admin/designer"], a.lrow[href="#/admin/tenants"]')) === 0);
await p.locator('a.lrow[href="#/admin"]').click(); await p.waitForTimeout(700);
ok('me-admin-row-opens-center', (await hash()) === '#/admin' && (await count('.adm-grid')) === 1);
await p.goto(file + '#/me/settings'); await p.waitForTimeout(900);
const textSeg = p.locator('.set-row .segmented').filter({ hasText: 'كبير' }).first();
ok('text-size-control', (await textSeg.count()) === 1 && (await textSeg.locator('button').count()) === 3);
const base = await p.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
await textSeg.locator('button').nth(2).click(); await p.waitForTimeout(500);
const xl = await p.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
ok('text-size-xl-applies', (await p.evaluate(() => document.documentElement.getAttribute('data-text'))) === 'xl' && xl > base * 1.1, `${base}px → ${xl}px`);
await p.goto(file + '#/admin'); await p.waitForTimeout(900);
ok('text-size-xl-admin-no-overflow', (await overflow()) === 0);
await p.goto(file + '#/me/settings'); await p.waitForTimeout(700);
await p.locator('.set-row .segmented').filter({ hasText: 'كبير' }).first().locator('button').nth(0).click(); await p.waitForTimeout(400);
ok('text-size-back-normal', (await p.evaluate(() => document.documentElement.getAttribute('data-text'))) === null);

/* ═══ 8) غير المشرف لا يرى الإدارة ═══ */
await become('P-AHMED', '#/home');
ok('employee-no-admin-sidebar', (await count('.side-item[href="#/admin"]')) === 0);
await p.goto(file + '#/me'); await p.waitForTimeout(700);
ok('employee-no-admin-row', (await count('a.lrow[href="#/admin"]')) === 0);

/* ═══ 9) الإنجليزية والهاتف ═══ */
await become('admin', '#/admin'); await setLang('en');
ok('en-center', (await count('.adm-nav .adm-chip')) === 10 && (await p.locator('.adm-nav .adm-chip.on').textContent()).includes('Administration') && (await overflow()) === 0);
ok('en-tiles', (await count('.adm-tiles .adm-tile')) === 4 && (await p.locator('.adm-tiles .adm-tile').first().textContent()).match(/[A-Za-z]/) !== null);
await p.screenshot({ path: `${OUT}/v18-6-center-en.png`, fullPage: true });
await p.goto(file + '#/admin/designer/svc/DC-01'); await p.waitForTimeout(1000); await clickTab(/^Outputs/);
const enDoc = await p.locator('.dz-docprev .doc-preview').textContent().catch(() => '');
ok('en-doc-preview', enDoc.includes('Ahmed') && !enDoc.includes('{{'), `${enDoc.slice(0, 60)}`);
await setLang('ar');
await become('admin', '#/admin', { width: 390, height: 844 });
ok('phone-center', (await count('.adm-grid')) === 1 && (await overflow()) === 0 && (await count('.adm-tiles .adm-tile')) === 4);
const navScroll = await p.evaluate(() => { const n = document.querySelector('.adm-nav'); return n ? { sw: n.scrollWidth, cw: n.clientWidth, ov: getComputedStyle(n).overflowX } : null; });
ok('phone-nav-rail', !!navScroll && navScroll.ov === 'auto' && navScroll.sw > navScroll.cw, JSON.stringify(navScroll));
const cols = await p.evaluate(() => getComputedStyle(document.querySelector('.adm-grid')).gridTemplateColumns.split(' ').length);
ok('phone-single-column', cols === 1, `${cols} columns`);
await p.screenshot({ path: `${OUT}/v18-7-center-phone.png`, fullPage: true });
await p.goto(file + '#/admin/designer/svc/DC-01'); await p.waitForTimeout(1000);
await clickTab(/^المخرجات/);
ok('phone-doc-sheet-button', (await count('.dz-doc-preview')) >= 1, 'على الهاتف زر المعاينة في بطاقة المخرج');
await p.locator('.dz-doc-preview').first().click(); await p.waitForTimeout(800);
ok('phone-doc-sheet', (await count('.sheet .dz-docsheet .doc-preview')) === 1 && (await overflow()) === 0);
await p.screenshot({ path: `${OUT}/v18-8-doc-sheet-phone.png` });
await p.keyboard.press('Escape'); await p.waitForTimeout(300);
await p.goto(file + '#/admin/designer'); await p.waitForTimeout(900);
ok('phone-catalog-folded', (await count('.dz-domhead.folded')) === (await count('.dz-domhead')) && (await count('.dz-domhead')) > 0, 'على الهاتف المجالات مطوية بعددها');
await p.locator('.dz-domhead').first().click(); await p.waitForTimeout(500);
ok('phone-catalog-tap-opens', (await count('.dz-row')) > 0 && (await overflow()) === 0, `${await count('.dz-row')} rows`);
await clickTab(/^القوالب/); await p.locator('.dz-tpl-preview').first().click(); await p.waitForTimeout(800);
ok('phone-tpl-sheet', (await count('.sheet .dz-tplprev')) === 1 && (await overflow()) === 0);
await p.screenshot({ path: `${OUT}/v18-9-tpl-sheet-phone.png` });
await p.keyboard.press('Escape');

ok('console-clean', errors.length === 0, errors.slice(0, 3).join(' | '));
const pass = rows.filter((r) => r.pass).length; const fail = rows.length - pass;
console.log(`\nTOTAL ${rows.length} · PASS ${pass} · FAIL ${fail}`);
fs.writeFileSync(`${OUT}/admin.json`, JSON.stringify({ rows, errors }, null, 2));
await b.close();
process.exit(fail ? 1 : 0);
