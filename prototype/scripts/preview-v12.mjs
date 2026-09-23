// معاينات v0.12 بدقة مضاعفة للتسليم: المستندات على هوية مجموعة النماذج المطبوعة، ومحضر الاستلام (اللوحة والمعاينة والورقة)، والدفعات في الطلب، والفحص بلجنة، وأمر الشراء من النظام المرجعي، وسياسة الاحتياج
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import path from 'node:path';
import fs from 'node:fs';
const file = 'file://' + path.resolve('dist/index.html');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
const ph = { width: 400, height: 860 }; const lap = { width: 1440, height: 900 };
fs.mkdirSync('shots/v12-preview', { recursive: true });
const ctx = await b.newContext({ viewport: lap, deviceScaleFactor: 2, colorScheme: 'light' }); const p = await ctx.newPage();
await p.goto(file + '#/home', { waitUntil: 'load' }); await p.waitForTimeout(800);
const mutate = (fn) => p.evaluate((src) => { const s = JSON.parse(localStorage.getItem('usp-portal-v1')); (new Function('s', src))(s); localStorage.setItem('usp-portal-v1', JSON.stringify(s)); }, fn);
const as = async (id, hash, vp = lap, dark = false) => { await mutate(id === 'admin' ? `s.settings.persona = 'admin'; s.settings.actAs = undefined; s.settings.theme = '${dark ? 'dark' : 'light'}';` : `const w = s.people.find((x) => x.id === '${id}'); s.settings.persona = w.persona; s.settings.actAs = '${id}'; s.settings.theme = '${dark ? 'dark' : 'light'}';`); await p.setViewportSize(vp); await p.goto(file + hash); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1500); };
const shot = (n, full = true) => p.screenshot({ path: `shots/v12-preview/${n}.png`, fullPage: full });
const sheetShot = async (n) => { await p.addStyleTag({ content: '.sheet{position:static!important;max-height:none!important;transform:none!important;box-shadow:none!important;background:#fff!important}.sheet-backdrop,.backdrop,.topbar,.tabbar,.home-bar,.deskbar{display:none!important}' }); const el = p.locator('.sheet .doc-preview').first(); await el.scrollIntoViewIfNeeded(); await p.waitForTimeout(600); await el.screenshot({ path: `shots/v12-preview/${n}.png` }); };
const openTask = async (who, id) => { await as(who, '#/inbox'); const rows = p.locator('.split .row'); const n = await rows.count(); for (let i = 0; i < n; i++) { await rows.nth(i).locator('.cell').click(); await p.waitForTimeout(450); const t = await p.locator('.split-detail .mono').first().textContent().catch(() => ''); if (t.trim() === id) return; } throw new Error('task ' + id + ' not found for ' + who); };
const state = () => p.evaluate(() => JSON.parse(localStorage.getItem('usp-portal-v1')));
const openDoc = async (n = 0) => { await p.locator('button, a', { hasText: 'افتح المستند' }).nth(n).click(); await p.waitForTimeout(1300); };

const st = await state(); const seeded = st.requests.find((r) => r.need && (r.need.procurement?.receipts || []).length);
/* 1 الطلب المزروع: الاستلام من المورد 6 / 10 والدفعة 2 (هاتف) */
await as('P-DEPT', `#/requests/${seeded.id}`, ph); await shot('معاينة v0.12 — الطلب: استُلم 6 من 10، محضر الاستلام والسند، والدفعة 2 (هاتف)');
/* 2 محضر الفحص والاستلام ورقةً (حاسوب) */
await as('P-DEPT', `#/requests/${seeded.id}`); await openDoc(0); await sheetShot('معاينة v0.12 — محضر فحص واستلام على هوية مجموعة النماذج المطبوعة (حاسوب)');
/* 3 سند التسليم والاستلام لدفعة (حاسوب) */
await as('P-DEPT', `#/requests/${seeded.id}`); await openDoc(1); await sheetShot('معاينة v0.12 — سند تسليم واستلام بكمية الدفعة (حاسوب)');
/* 4 لوحة الاستلام عند المستودع: الدفعة 2 (حاسوب) */
await openTask('P-STORE2', seeded.id); await shot('معاينة v0.12 — لوحة الاستلام: المحضر مملوء من ملف الشراء، الوارد والمقبول والنتيجة لكل بند (حاسوب)');
await p.fill('#rec-del-L1', '4'); await p.fill('#rec-acc-L1', '3'); await p.locator('.split-detail select.np-rec-result').selectOption('short'); await p.waitForTimeout(200); await p.fill('#rec-note-L1', 'واحدة تالفة الغلاف تُستبدل'); await p.fill('#rec-supno', 'DN-77901');
await p.locator('#np-rec-preview').click(); await p.waitForTimeout(1200);
await p.evaluate(() => document.querySelector('.np-doc')?.scrollIntoView({ block: 'start' })); await p.waitForTimeout(300);
await shot('معاينة v0.12 — معاينة المحضر قبل التوقيع: مسودة بالمطلوب والمستلَم سابقاً والوارد والمقبول (حاسوب)');
/* 5 قرار الإجازة قراراً إدارياً (حاسوب) */
const lv = st.requests.find((r) => r.leave && r.status === 'completed' && r.docs.some((d) => d.kind === 'issued'));
await as(lv.requesterId, `#/requests/${lv.id}`); await openDoc(0); await sheetShot('معاينة v0.12 — قرار الإجازة بصيغة القرار الإداري على هوية المجموعة (حاسوب)');
/* 6 قرار الإجازة على الهاتف داكن: الورقة تبقى ورقة */
await as(lv.requesterId, `#/requests/${lv.id}`, ph, true); await openDoc(0); await sheetShot('معاينة v0.12 — الورقة تبقى بيضاء في الوضع الداكن، وترويستها في صفّين على الهاتف (هاتف داكن)');
/* 7 أمر الشراء من النظام المرجعي: لوحة ماجد لكرسي فهد؟ — الاحتياج المزروع عند الاستلام؛ نصنع واحداً سريعاً بالطفرة: نعيد خطوة po على طلب مكتمل؟ لا — نستخدم طلب فهد الجاري إن كان عند الاستلام؛ لذا نأخذ لقطة من سياسة الاحتياج بدلاً */
await as('admin', '#/admin/need'); await p.locator('.ptl-card').first().click().catch(() => {}); await p.waitForTimeout(500); await p.locator('.segmented button', { hasText: 'القواعد' }).click(); await p.waitForTimeout(500);
await p.evaluate(() => document.querySelector('#np-inspection')?.scrollIntoView({ block: 'center' })); await p.waitForTimeout(300);
await shot('معاينة v0.12 — القواعد: حد الفحص بلجنة، والتسليم عند كل استلام، ومهلة المعالجة، ومهلة التوريد، وأرقام النظام المرجعي (حاسوب)');
/* 8 محضر بلجنة من لقطة السيناريو ق.ح-27 إن وُجد */
const c27 = (await state()).requests.find((r) => r.need && (r.need.procurement?.receipts || []).some((x) => x.committee && x.status === 'issued'));
if (c27) { await as(c27.requesterId, `#/requests/${c27.id}`); const idx = c27.docs.filter((d) => d.kind === 'issued').findIndex((d) => d.type === 'inspection'); await openDoc(Math.max(0, idx)); await sheetShot('معاينة v0.12 — محضر فحص واستلام بلجنة: ختم أمين المستودع وتوقيعان موثّقان (حاسوب)'); }
/* 9 لوحة أمر الشراء من النظام المرجعي: نعدّ احتياجاً سريعاً بالطفرة إلى خطوة أمر الشراء */
await mutate(`const r = s.requests.find((x) => x.need && x.steps.some((y) => y.role === 'po' && y.status === 'done')); if (r) { const i = r.steps.findIndex((y) => y.role === 'po'); r.steps = r.steps.map((y, k) => (k === i ? { ...y, status: 'current', startedAt: Date.now(), at: undefined, actorId: undefined } : k > i && y.status !== 'skipped' ? { ...y, status: 'pending', at: undefined, actorId: undefined } : y)); r.status = 'in_review'; r.need.procurement.poNo = undefined; r.need.procurement.receipts = []; r.need.handovers = []; r.need.handover = undefined; r.need.lines = r.need.lines.map((l) => ({ ...l, status: 'purchasing', received: undefined, handed: undefined, closed: undefined })); r.docs = r.docs.filter((d) => d.kind === 'attachment'); globalThis.__po = r.id; s.__po = r.id; }`);
const poId = (await state()).__po;
if (poId) { await openTask('P-MAJED', poId); await shot('معاينة v0.12 — أمر الشراء من النظام المرجعي: ما يُنشأ في SAP وزر «أُنشئ في النظام المرجعي» بلا حقل رقم (حاسوب)'); }
await b.close(); console.log('previews ok');
