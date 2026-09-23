import React, { useState } from 'react';
import { I } from '../ui/icons';
import { Avatar, Cell, Group, LargeTitle, Notice, Pill, Seal, SectionLabel, Segmented, Sheet, TopBar, useLang, usePerson, useToast } from '../ui/components';
import { motion, Ring, Ticker, CheckMark, Press, SPRING } from '../ui/motion';

const TOKENS = ['--bg', '--bg-elev', '--bg-inset', '--fg', '--fg-2', '--fg-3', '--green', '--green-2', '--green-deep', '--tint-soft', '--gold', '--gold-2', '--ok', '--warn', '--danger', '--info'];

export function Design() {
  const { lang, t } = useLang(); const me = usePerson(); const toast = useToast();
  const [seg, setSeg] = useState('a'); const [sheet, setSheet] = useState(false); const [replay, setReplay] = useState(0);
  const ar = lang === 'ar';
  const P = (a: string, e: string) => (ar ? a : e);
  const cs = getComputedStyle(document.documentElement);
  return (
    <div className="page view">
      <TopBar title={t.nav.design} back="#/me" />
      <LargeTitle title={t.nav.design} sub={P('لغة البوابة كما هي مطبقة في هذه الصفحة نفسها', 'The portal language, as applied on this very page')} />

      <SectionLabel>{P('الأسس', 'Foundations')}</SectionLabel>
      <Group>
        <Cell icon="sparkle" title={P('أسطح محايدة، ولون تمييز واحد', 'Neutral surfaces, one tint')} sub={P('الأخضر المؤسسي للأزرار والعناصر الفعالة فقط؛ لا خلفيات خضراء ولا تدرجات.', 'Institutional green for buttons and active elements only; no green backgrounds, no gradients.')} chevron={false} />
        <Cell icon="seal" tone="gold" title={P('الذهبي للسلطة فقط', 'Gold for authority only')} sub={P('يظهر في الأختام والمستندات الصادرة وأرقام القرارات، ولا يُكتب عليه نص أبيض أبداً.', 'Appears on seals, issued documents and decision numbers, and never carries white text.')} chevron={false} />
        <Cell icon="globe" tone="plain" title={P('العربية أولاً، والإنجليزية كاملة', 'Arabic first, English complete')} sub={P('اتجاه أصيل من اليمين إلى اليسار؛ الإنجليزية بخط النظام؛ الأرقام لاتينية معزولة الاتجاه.', 'Native RTL; English in the system font; Latin numerals, direction-isolated.')} chevron={false} />
        <Cell icon="clock" tone="plain" title={P('حركة فيزيائية تشرح ما حدث', 'Physical motion that explains what happened')} sub={P('نوابض لا منحنيات زمنية؛ كل شيء يتحرك من مكانه إلى مكانه؛ استجابة عند الضغط؛ ولكل شاشة لحظة واحدة تُكافئ الإنجاز. تُطفأ كلها مع تفضيل تقليل الحركة.', 'Springs, not timing curves; everything moves from where it is to where it goes; feedback on press; one rewarding moment per screen. All of it switches off under reduced motion.')} chevron={false} />
      </Group>

      <SectionLabel>{P('المواد الثلاث (v0.3)', 'The three materials (v0.3)')}</SectionLabel>
      <Group>
        <Cell icon="doc" tone="plain" title={P('الورق', 'Paper')} sub={P('أسطح كريمية مطفأة تحمل المحتوى: المجموعات والبطاقات والنماذج. زوايا متصلة (squircle) حيث يدعمها المتصفح.', 'Matte cream surfaces that carry content: groups, cards and forms. Continuous (squircle) corners where the browser supports them.')} chevron={false} />
        <Cell icon="grid" tone="plain" title={P('الزجاج', 'Glass')} sub={P('أشرطة ولوحات شبه شفافة مضاءة الحافة يمرّ المحتوى تحتها: الشريط السفلي، ورأس الصفحة عند التمرير، ولوحة الأوامر، والجزيرة.', 'Edge-lit translucent bars and panels that content flows beneath: the tab bar, the scrolled header, the command palette and the island.')} chevron={false} />
        <Cell icon="seal" tone="gold" title={P('الضوء الذهبي', 'Gold light')} sub={P('لا يظهر إلا في لحظات القيمة: المعيّن في الرأس، والختم، ورقم المستند، والحلقة الذهبية للرصيد.', 'Appears only at moments of value: the hero gems, the seal, the document number, the gold balance ring.')} chevron={false} />
      </Group>

      <SectionLabel>{P('مفردات الحركة', 'Motion vocabulary')}</SectionLabel>
      <Group>
        <div className="kbd-row" style={{ alignItems: 'center', gap: 18 }} key={replay}>
          <Ring value={21.5} max={30} size={70} stroke={8}><b className="num"><Ticker value={21.5} decimals={1} /></b></Ring>
          <Ring value={3} max={5} size={70} stroke={8} color="var(--gold)"><b className="num"><Ticker value={3} /></b></Ring>
          <CheckMark size={64} />
          <b className="num" style={{ fontSize: '2rem', color: 'var(--tint)' }}><Ticker value={1250} /></b>
          <button type="button" className="btn quiet" onClick={() => setReplay((r) => r + 1)}><I.reset />{P('أعد التشغيل', 'Replay')}</button>
        </div>
        <div className="kbd-row">
          <Press className="btn primary" onClick={() => toast({ title: P('اعتماد', 'Approved'), sub: P('طلب إجازة · REQ-2026-0388', 'Leave request · REQ-2026-0388'), icon: 'check', tone: 'ok' })}>{P('الجزيرة: اعتماد', 'Island: approved')}</Press>
          <Press className="btn secondary" onClick={() => toast({ title: P('إعادة للاستكمال', 'Returned'), sub: P('أرفق المستند الداعم', 'Attach the supporting document'), icon: 'ret', tone: 'warn' })}>{P('الجزيرة: إعادة', 'Island: returned')}</Press>
          <Press className="btn soft" onClick={() => toast({ title: P('صدر مستندك', 'Your document is issued'), sub: P('خطاب تعريف · 687 / 2026', 'Letter · 687 / 2026'), icon: 'seal', tone: 'gold' })}>{P('الجزيرة: مستند', 'Island: document')}</Press>
        </div>
        <div className="summary-row"><span className="k">{P('النوابض', 'Springs')}</span><span className="v" style={{ fontWeight: 400, color: 'var(--fg-2)', fontSize: 'var(--t-sub)' }}>{P('ناعم 260/28 للدخول والألواح، حاد 520/38 للضغط والمؤشرات المنزلقة، مرِن 430/21 للحظات (الجزيرة، الختم، الشارة).', 'Soft 260/28 for entrances and sheets, snappy 520/38 for presses and sliding indicators, bouncy 430/21 for moments (island, seal, badge).')}</span></div>
        <div className="summary-row"><span className="k">{P('الشاشات', 'Screens')}</span><span className="v" style={{ fontWeight: 400, color: 'var(--fg-2)', fontSize: 'var(--t-sub)' }}>{P('الأعمق تدخل من جهة النهاية وتخرج المغادِرة إلى الخلف قليلاً؛ الرجوع يعكسها؛ تبديل اللسان تلاشٍ قصير.', 'Deeper screens enter from the end side while the leaving one recedes; back reverses it; tab switches cross-fade briefly.')}</span></div>
        <div className="summary-row"><span className="k">{P('القوائم', 'Lists')}</span><span className="v" style={{ fontWeight: 400, color: 'var(--fg-2)', fontSize: 'var(--t-sub)' }}>{P('تدخل متتابعة بفاصل 45 مللي ثانية؛ الصف المُنجَز يغادر منزلقاً وينكمش فيلتئم ما بعده.', 'Enter in sequence 45 ms apart; a completed row slides out and collapses so the rest close the gap.')}</span></div>
      </Group>

      <SectionLabel>{P('الألوان', 'Colour')}</SectionLabel>
      <div className="swatches">{TOKENS.map((k) => <div key={k} className="swatch" style={{ background: `var(${k})`, color: k === '--bg' || k === '--bg-elev' || k === '--bg-inset' || k === '--gold-2' || k.endsWith('-soft') ? 'var(--fg)' : k.startsWith('--fg') ? 'var(--bg)' : '#fff' }}><b>{k.replace('--', '')}</b><span>{cs.getPropertyValue(k).trim()}</span></div>)}</div>

      <SectionLabel>{P('الطباعة: Cairo للعربية، خط النظام للإنجليزية', 'Type: Cairo for Arabic, system font for English')}</SectionLabel>
      <Group>
        {[['large', P('عنوان كبير', 'Large title'), 'var(--t-large)', 700], ['title1', P('عنوان أول', 'Title 1'), 'var(--t-title1)', 700], ['title2', P('عنوان ثانٍ', 'Title 2'), 'var(--t-title2)', 700], ['headline', P('عنوان فرعي', 'Headline'), 'var(--t-headline)', 600], ['body', P('نص أساسي', 'Body'), 'var(--t-body)', 400], ['callout', P('نص تعليقي', 'Callout'), 'var(--t-callout)', 400], ['sub', P('نص ثانوي', 'Subheadline'), 'var(--t-sub)', 400], ['foot', P('حاشية', 'Footnote'), 'var(--t-foot)', 400], ['cap', P('تسمية', 'Caption'), 'var(--t-cap)', 600]].map(([k, label, size, w]) => (
          <div key={k as string} className="specimen"><span style={{ fontSize: size as string, fontWeight: w as number, lineHeight: 1.3 }}>{label}</span><small>{k as string} · {w as number}</small></div>
        ))}
      </Group>
      <div className="group-foot">{P('لا تباعد أحرف على العربية أبداً (يكسر اتصال الحروف). الارتفاع السطري 1.65 للنص العربي و1.5 للإنجليزي. الأرقام جدولية في الأعمدة.', 'Never letter-space Arabic (it breaks the joins). Line height 1.65 for Arabic body, 1.5 for English. Tabular numerals in columns.')}</div>

      <SectionLabel>{P('المكونات', 'Components')}</SectionLabel>
      <Group>
        <div className="kbd-row"><button type="button" className="btn primary" onClick={() => toast(P('ضُغط', 'Pressed'))}>{P('أساسي', 'Primary')}</button><button type="button" className="btn secondary">{P('ثانوي', 'Secondary')}</button><button type="button" className="btn soft">{P('ناعم', 'Soft')}</button><button type="button" className="btn danger">{P('خطر', 'Danger')}</button><button type="button" className="btn quiet">{P('هادئ', 'Quiet')}</button></div>
        <div className="kbd-row"><Pill tone="tint">{t.status.in_review}</Pill><Pill tone="warn" icon="ret">{t.status.returned}</Pill><Pill tone="ok" icon="check">{t.status.approved}</Pill><Pill tone="danger" icon="x">{t.status.rejected}</Pill><Pill tone="done" icon="check">{t.status.completed}</Pill><Pill tone="gold" icon="seal">{t.requests.issued}</Pill><Pill>{t.status.pending}</Pill></div>
        <div style={{ padding: '6px 14px 12px' }}><Segmented value={seg} onChange={setSeg} options={[{ v: 'a', label: P('الأول', 'First') }, { v: 'b', label: P('الثاني', 'Second'), n: 3 }, { v: 'c', label: P('الثالث', 'Third') }]} /></div>
        <Cell lead={<Avatar p={me} />} title={P('خلية بصورة رمزية', 'Cell with avatar')} sub={P('عنوان ثانوي في سطر واحد', 'A one-line subtitle')} pill={<Pill tone="tint">{P('حالة', 'State')}</Pill>} onClick={() => setSheet(true)} />
        <Cell icon="doc" tone="plain" title={P('خلية بأيقونة وقيمة', 'Cell with icon and value')} value={<span className="num">1,250</span>} chevron={false} />
        <div style={{ padding: '10px 14px' }}><Notice tone="tint" icon="clock">{P('إشعار سياقي داخل الصفحة، لا نافذة منبثقة.', 'An in-page contextual notice, not a popup.')}</Notice></div>
        <div style={{ padding: '4px 14px 14px' }}><Seal title={P('قرار إجازة', 'Leave decision')} number="312 / 2026" onOpen={() => setSheet(true)} /></div>
      </Group>

      <SectionLabel>{P('مفردات الحالة', 'Status vocabulary')}</SectionLabel>
      <Group>
        {([['in_review', P('الطلب يسير في مساره ولم يُقرَّر بعد.', 'The request is moving and not decided yet.')], ['returned', P('أُعيد إلى الطالب لاستكمال نقص محدد، ويعود إلى المكتب نفسه.', 'Sent back to the requester for a specific gap; returns to the same desk.')], ['approved', P('اعتُمدت خطوة، وينتظر الخطوة التالية.', 'A step was approved; awaiting the next.')], ['completed', P('انتهى وحُدِّث النظام المرجعي وصدر المخرج.', 'Finished; the system of record is updated and the output issued.')], ['rejected', P('رُفض بسبب مكتوب، ويمكن تقديم طلب جديد.', 'Rejected with a written reason; a new request can be made.')]] as const).map(([k, d]) => (
          <div key={k} className="summary-row"><span className="k"><Pill tone={k === 'in_review' ? 'tint' : k === 'returned' ? 'warn' : k === 'approved' ? 'ok' : k === 'completed' ? 'done' : 'danger'}>{t.status[k]}</Pill></span><span className="v" style={{ fontWeight: 400, color: 'var(--fg-2)', fontSize: 'var(--t-sub)' }}>{d}</span></div>
        ))}
      </Group>

      <SectionLabel>{P('لحظات التنبيه', 'Notification moments')}</SectionLabel>
      <Group>
        {[['استلمنا طلبك', 'Request received', 'status'], ['مهمة تنتظرك', 'A task is waiting for you', 'task'], ['أُعيد إليك', 'Returned to you', 'status'], ['تقدّم طلبك', 'Your request moved forward', 'status'], ['صدر مستندك', 'Your document is issued', 'document'], ['مستند يوشك أن ينتهي', 'A document is about to expire', 'expiry'], ['تذكير قبل المهلة', 'Reminder before the deadline', 'reminder']].map(([a, e, k]) => (
          <Cell key={a} icon={k === 'task' ? 'inbox' : k === 'document' ? 'seal' : k === 'expiry' ? 'alert' : k === 'reminder' ? 'clock' : 'doc'} tone={k === 'document' ? 'gold' : k === 'expiry' ? 'warn' : k === 'task' ? '' : 'plain'} title={P(a, e)} sub={P('عنوان قصير يبدأ بالفعل، ونص يحمل الرقم والخطوة، ورابط يفتح الطلب نفسه.', 'A short verb-first title, a body carrying the number and the step, a link that opens the request itself.')} chevron={false} />
        ))}
      </Group>

      <SectionLabel>{P('العربية والاتجاه', 'Arabic and direction')}</SectionLabel>
      <Group>
        <div className="summary-row"><span className="k">{P('الأرقام', 'Numerals')}</span><span className="v">{P('لاتينية دائماً، معزولة الاتجاه: ', 'Always Latin, direction-isolated: ')}<span className="mono">REQ-2026-0412</span> · <span className="num">16/09/2026</span></span></div>
        <div className="summary-row"><span className="k">{P('الأسهم', 'Chevrons')}</span><span className="v">{P('«إلى الأمام» يشير إلى جهة القراءة ويتعاكس مع اللغة؛ الساعة والبحث والمرفق لا تتعاكس.', '"Forward" points along the reading direction and mirrors with the language; clock, search and clip do not mirror.')}</span></div>
        <div className="summary-row"><span className="k">{P('الحروف', 'Letters')}</span><span className="v">{P('الخط الأحادي للمعرفات فقط، لا للكلمات العربية.', 'The monospace face is for identifiers only, never for Arabic words.')}</span></div>
        <div className="summary-row"><span className="k">{P('الهدف', 'Target')}</span><span className="v">{P('كل هدف لمس 44 نقطة على الأقل؛ التركيز مرئي؛ التباين وفق WCAG 2.1 AA في الوضعين.', 'Every touch target at least 44pt; visible focus; WCAG 2.1 AA contrast in both themes.')}</span></div>
      </Group>

      <Sheet open={sheet} onClose={() => setSheet(false)} title={P('لوح سفلي', 'Bottom sheet')}>
        <p className="cell-sub">{P('يصعد من الأسفل بمنحنى iOS، ويُغلق بالسحب لأسفل أو باللمس خارجه أو بمفتاح Escape. على الشاشات الواسعة يصبح نافذة في المنتصف.', 'Rises from the bottom with the iOS curve; closes by dragging down, tapping outside, or Escape. On wide screens it becomes a centred dialog.')}</p>
        <div style={{ height: 14 }} /><button type="button" className="btn primary block" onClick={() => setSheet(false)}><I.check />{t.common.ok}</button>
      </Sheet>
    </div>
  );
}
