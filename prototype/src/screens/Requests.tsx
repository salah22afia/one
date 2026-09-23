/* «طلباتي» وصفحة الطلب في المختبر: الصف يقول أين الطلب وماذا بعد (نقاط التقدّم، ومَن عنده، والمتوقع)، والمعاد إليه في الأعلى بفعله؛
   وصفحة الطلب تبدأ ببطاقة حالة (الحالة، والمرحلة ن من م، ومَن عنده منذ متى، والمتوقع) ثم ما قدّمه ومستنداته وسجل مطويّ (C-UX-84، C-UX-85). */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../app/store';
import { nav } from '../app/router';
import { I, type IconName } from '../ui/icons';
import { useLang, usePerson, Avatar, Pill, Segmented, Empty, Group, Seal, Notice, useNow, useToast, Rail, Field, Sheet, fv } from '../ui/components';
import { SPRING, Ring, Item } from '../ui/motion';
import { requestTitle, personById, stepWho, slaOf, approvalLocked, cancelEvaluation, namesFor } from '../domain/engine';
import { toISO, agentTitle, onCancelOf } from '../domain/policy';
import { canWithdrawNeed, canCancelNeed } from '../domain/need';
import { LeaveDecision, HandoverNote, ReceiptDocument, ConfiguredDocument } from '../ui/Documents';
import { serviceOfRequest, allFields as dzFields, tableRows, myRegisterEntries, configuredById } from '../domain/designer';
import { usePrint, PrintButton } from '../ui/Print';
import emblem from '../assets/emblem.png';
import { LeaveCard, leaveTypeOf, RoutePreview, Checks, useGroupNames } from '../ui/LeaveBits';
import { NeedCard, NeedStages, NeedRefs, NeedPurchaseSummary, NeedFile } from '../ui/NeedBits';
import { relTime, durText, fmtDate, fill } from '../app/i18n';
import type { Request, Doc, Step } from '../domain/types';
import { useUI, BottomSheet, shortName, useIntroSkip, Nb } from '../app/ui';
import { PageChrome } from '../ui/Page';

const SERVICE_ICON: Record<string, IconName> = { 'TM-01': 'leave', 'AS-01': 'box', 'DC-01': 'letter', 'FN-01': 'plane', 'MD-01': 'idcard', 'MD-02': 'wallet', 'MD-05': 'passport' };
const icon = (r: Request): IconName => SERVICE_ICON[r.serviceId] || 'doc';

/** خطوات الطلب الظاهرة (بلا المتخطّاة) وموضعه فيها */
function progressOf(r: Request) {
  const steps = r.steps.filter((s) => s.status !== 'skipped');
  const doneN = steps.filter((s) => s.status === 'done').length;
  const cur = r.steps.find((s) => s.status === 'current' || s.status === 'returned');
  const idx = cur ? steps.indexOf(cur) : r.status === 'completed' ? steps.length : doneN;
  return { steps, doneN, cur, idx };
}
/** المتوقع: مهلة الخطوة الحالية من بدايتها */
function expectedOf(r: Request, cur: Step | undefined, now: number, lang: 'ar' | 'en', L: { late: string; expected: string }) {
  if (!cur || cur.status !== 'current') return '';
  const sla = slaOf(cur); if (!sla) return '';
  const due = (cur.startedAt || r.createdAt) + sla * 3600000;
  return due < now ? L.late : fill(L.expected, { t: durText(due - now, lang) });
}

/** اسم من عنده الطلب: الاسم المختصر إن كان شخصاً واحداً، وإلا وصف الخطوة */
function holderName(state: ReturnType<typeof useStore>['state'], r: Request, cur: Step, lang: 'ar' | 'en') {
  const ids = cur.assigneeIds || []; if (ids.length === 1) { const p = personById(state, ids[0]); if (p) return shortName(p, lang); }
  return stepWho(state, r, cur, lang);
}
export function ProgressDots({ r, size = 'sm' }: { r: Request; size?: 'sm' | 'lg' }) {
  const { steps, idx } = progressOf(r);
  return <span className={`pd ${size}`} aria-hidden="true">{steps.map((s, i) => <i key={s.key} className={s.status === 'done' ? 'on' : s.status === 'returned' ? 'ret' : i === idx && r.status !== 'completed' ? 'cur' : ''} />)}</span>;
}

function ReqRow({ r, delay = 0 }: { r: Request; delay?: number }) {
  const { state } = useStore(); const { lang, t, tx } = useLang(); const now = useNow(); const { L } = useUI(); const reduce = useIntroSkip();
  const { cur, doneN, steps } = progressOf(r); const svcIcon = r.configured ? (serviceOfRequest(state, r)?.icon as IconName | undefined) : undefined; const Ic = I[svcIcon && I[svcIcon] ? svcIcon : icon(r)];
  const who = cur ? holderName(state, r, cur, lang) : '';
  const note = r.steps.find((s) => s.status === 'returned')?.note;
  let sub: React.ReactNode; let pill: React.ReactNode = null;
  if (r.status === 'returned') { sub = <>{t.status.returned}{note ? ` · ${note}` : ''}</>; pill = <span className="fc-act">{L.act.attach}<I.chev className="dirchev" /></span>; }
  else if (r.status === 'in_review') { const exp = expectedOf(r, cur, now, lang, L.pages); sub = <>{fill(L.pages.atWho, { who })} · {cur ? tx(cur.title) : ''} · {relTime(cur?.startedAt || cur?.at || r.createdAt, lang, now)}{exp ? <> · <em className={exp === L.pages.late ? 'late' : ''}>{exp}</em></> : null}</>; }
  else { sub = <>{t.status[r.status]} · {fmtDate(r.updatedAt, lang, { day: 'numeric', month: 'long' })}{r.docs.some((d) => d.kind === 'issued') ? ` · ${t.requests.documents}` : ''}</>; pill = r.status === 'completed' ? <Pill tone="done" icon="check">{t.status.completed}</Pill> : r.status === 'rejected' ? <Pill tone="danger" icon="x">{t.status.rejected}</Pill> : <Pill>{t.status[r.status]}</Pill>; }
  return (
    <motion.a className={`rq ${r.status}`} href={`#/requests/${r.id}`} initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING.soft, delay }} whileTap={{ scale: 0.985 }} role="listitem">
      <span className={`qicon ${r.status === 'returned' ? 'g-gold' : r.status === 'completed' ? 'g-sage' : 'g-green'} rq-ic`}><Ic /></span>
      <span className="rq-txt"><b>{tx(requestTitle(r))}</b><span className="rq-sub">{sub}</span>{r.status === 'in_review' || r.status === 'returned' ? <span className="rq-prog"><ProgressDots r={r} /><small className="num">{doneN}/{steps.length}</small></span> : null}</span>
      <span className="rq-trail">{pill}{!pill ? <I.chev className="dirchev" /> : null}</span>
    </motion.a>
  );
}

export function Requests() {
  const { state } = useStore(); const { t } = useLang(); const me = usePerson(); const { L, desk } = useUI();
  const [tab, setTab] = useState<'ongoing' | 'finished'>('ongoing');
  const mine = useMemo(() => state.requests.filter((r) => r.requesterId === me.id).sort((a, b) => b.updatedAt - a.updatedAt), [state.requests, me.id]);
  const returned = mine.filter((r) => r.status === 'returned'); const ongoing = mine.filter((r) => r.status === 'in_review'); const finished = mine.filter((r) => r.status === 'completed' || r.status === 'rejected' || r.status === 'withdrawn');
  const seg = <Segmented id="lb-req" value={tab} onChange={setTab} options={[{ v: 'ongoing', label: L.pages.ongoing, n: returned.length + ongoing.length }, { v: 'finished', label: L.pages.finished, n: finished.length }]} />;
  const end = <a className="btn soft sm" href="#/services"><I.plus />{L.pages.newRequest}</a>;
  return (
    <PageChrome title={t.requests.title} root end={desk ? <>{seg}{end}</> : end}>
      {!desk ? <div className="lp-seg">{seg}<a className="lb-link chip" href="#/me/leaves"><I.calendar />{t.leaveHist.title}</a></div> : <div className="lp-links"><a className="lb-link chip" href="#/me/leaves"><I.calendar />{t.leaveHist.title}</a></div>}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6, transition: { duration: 0.1 } }} transition={SPRING.soft}>
          {tab === 'ongoing' ? (
            returned.length + ongoing.length === 0 ? <div className="lb-empty"><Empty icon="doc" title={L.pages.noRequests} sub={L.pages.noRequestsSub} /></div> : (
              <>
                {returned.length > 0 && <section className="lb-sec-list"><div className="lb-head"><h2>{L.pages.needsYou}</h2></div><div className="rq-list" role="list">{returned.map((r, i) => <ReqRow key={r.id} r={r} delay={i * 0.04} />)}</div></section>}
                {ongoing.length > 0 && <section className="lb-sec-list"><div className="lb-head"><h2>{L.pages.ongoing}</h2></div><div className="rq-list" role="list">{ongoing.map((r, i) => <ReqRow key={r.id} r={r} delay={0.06 + i * 0.04} />)}</div></section>}
              </>
            )
          ) : (
            finished.length === 0 ? <div className="lb-empty"><Empty icon="check" title={L.pages.noRequests} /></div> : <section className="lb-sec-list"><div className="rq-list" role="list">{finished.map((r, i) => <ReqRow key={r.id} r={r} delay={i * 0.04} />)}</div></section>
          )}
        </motion.div>
      </AnimatePresence>
    </PageChrome>
  );
}

/* ——— صفحة الطلب ——— */
function Stepper({ r }: { r: Request }) {
  const { tx } = useLang(); const { L } = useUI(); const { steps, idx } = progressOf(r); const ref = useRef<HTMLOListElement>(null);
  /* v0.17 (النظرة العميقة): نقاط على خط لا عناوين مقصوصة — العناوين تظهر على الحاسوب حين تكون الخطوات خمساً أو أقل، وعلى الهاتف تكفي جملة «بعدها: …» تحت الشريط؛ المسارات الطويلة بنقاط أصغر تتسع كلها */
  const many = steps.length > 8; const labels = steps.length <= 5;
  const next = r.status === 'in_review' ? steps[idx + 1] : undefined;
  const caption = r.status === 'in_review' ? (next ? <><I.chev className="dirchev" /><span>{L.pages.after}: <b>{tx(next.title)}</b></span></> : <><I.check /><span>{L.pages.lastStage}</span></>) : r.status === 'completed' ? <><I.check /><span>{L.pages.allDone}</span></> : null;
  return (
    <>
      <ol className={`stp ${many ? 'many' : ''} ${labels ? 'labels' : ''}`} aria-label="progress" ref={ref}>
        {steps.map((s, i) => { const cls = s.status === 'done' ? 'done' : s.status === 'returned' ? 'ret' : s.status === 'rejected' ? 'rej' : i === idx && r.status !== 'completed' ? 'cur' : ''; return (
          <li key={s.key} className={cls} title={tx(s.title)}><span className="stp-dot">{s.status === 'done' ? <I.check /> : s.status === 'returned' ? <I.ret /> : s.status === 'rejected' ? <I.x /> : null}</span><span className="stp-t">{tx(s.title)}</span></li>
        ); })}
      </ol>
      {caption ? <div className="stp-next">{caption}</div> : null}
    </>
  );
}

export function RequestPage({ id }: { id: string }) {
  const { state } = useStore(); const { lang, t, tx } = useLang(); const now = useNow(); const me = usePerson(); const { L, desk } = useUI(); const reduce = useIntroSkip();
  const r = state.requests.find((x) => x.id === id);
  const [doc, setDoc] = useState<Doc | null>(null); const [allEvents, setAllEvents] = useState(false); const [route, setRoute] = useState(false); const [stages, setStages] = useState(false);
  if (!r) return <PageChrome title={t.requests.title} back="#/requests"><div className="lb-empty"><Empty icon="doc" title={L.notFoundReq} sub={L.notFoundReqSub} /></div></PageChrome>;
  const { steps, cur, idx, doneN } = progressOf(r); const mine = r.requesterId === me.id;
  /* v0.15: الطلب السري بإخفاء الهوية لا يُظهر طالبه لغير صاحبه ومدير النظام */
  const requester = r.configured?.hideRequester && !mine && me.persona !== 'admin' ? undefined : personById(state, r.requesterId);
  const holder = cur && cur.status === 'current' ? holderName(state, r, cur, lang) : ''; const exp = expectedOf(r, cur, now, lang, L.pages);
  const issued = r.docs.filter((d) => d.kind === 'issued'); const attachments = r.docs.filter((d) => d.kind === 'attachment');
  const title = tx(requestTitle(r)); const lk = approvalLocked(state, r);
  const events = r.audit.slice().reverse(); const shownEvents = allEvents ? events : events.slice(0, 2);
  const status = r.status; const heroTone = status === 'returned' ? 'warn' : status === 'rejected' || status === 'withdrawn' ? 'muted' : status === 'completed' ? 'done' : 'live';
  const returnedNote = r.steps.find((s) => s.status === 'returned')?.note;
  return (
    <PageChrome title={title} sub={`${t.requests.number} ${r.id}`} back="#/requests">
      <motion.section className={`rqh ${heroTone}`} initial={reduce ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={SPRING.soft} aria-label={L.pages.statusHero[status]}>
        <div className="rqh-top">
          <span className="rqh-ring"><Ring value={status === 'completed' ? steps.length : doneN} max={Math.max(1, steps.length)} size={58} stroke={6} color={heroTone === 'warn' ? 'var(--gold)' : heroTone === 'muted' ? 'var(--fg-4)' : 'var(--green)'} track="var(--bg-inset-2)"><b className="num">{status === 'completed' ? <I.check /> : `${doneN}/${steps.length}`}</b></Ring></span>
          <span className="rqh-txt">
            <b>{L.pages.statusHero[status]}</b>
            <span>{status === 'in_review' && cur ? <>{fill(L.pages.stageOf, { n: idx + 1, m: steps.length })} · {tx(cur.title)}</> : status === 'returned' ? (returnedNote || t.status.returned) : status === 'completed' ? `${fmtDate(r.updatedAt, lang, { day: 'numeric', month: 'long' })}${issued.length ? ` · ${issued.length === 1 ? (lang === 'ar' ? 'مستند واحد' : 'one document') : `${issued.length} ${lang === 'ar' ? 'مستندات' : 'documents'}`}` : ''}` : fmtDate(r.updatedAt, lang, { day: 'numeric', month: 'long' })}</span>
            {status === 'in_review' && holder ? <span className="rqh-who"><Avatar p={cur?.assigneeIds?.length === 1 ? personById(state, cur.assigneeIds[0]) : undefined} size="sm" /><span>{fill(L.pages.atWho, { who: holder })} · {relTime(cur?.startedAt || r.createdAt, lang, now)}{exp ? <> · <em className={exp === L.pages.late ? 'late' : ''}>{exp}</em></> : null}</span></span> : null}
          </span>
        </div>
        <Stepper r={r} />
        {status === 'returned' && mine ? <motion.button type="button" className="btn primary block lg rqh-cta" whileTap={{ scale: 0.97 }} onClick={() => nav(`#/resubmit/${r.id}`)}><I.ret />{L.pages.resubmit}</motion.button> : null}
        {/* v0.16 (3.3): خطوة استكمال من الطالب — تُنجز من صندوق المهام */}
        {status === 'in_review' && mine && cur?.status === 'current' && cur.mode === 'input' ? <motion.button type="button" className="btn primary block lg rqh-cta" whileTap={{ scale: 0.97 }} onClick={() => nav('#/inbox')}><I.pen />{L.dz.v16.task.complete}</motion.button> : null}
        {status === 'in_review' && cur?.status === 'current' && cur.mode === 'wait' && cur.waitUntil ? <Notice tone="tint" icon="wait">{fill(L.dz.v16.task.waitingUntil, { d: cur.waitUntil })}</Notice> : null}
        {lk ? <Notice tone="warn" icon="lock">{fill(t.policy.close.lockedReq, { until: lk.until, reason: lk.reason })}</Notice> : null}
      </motion.section>

      <div className={desk ? 'rq-cols' : ''}>
        <div>
          {issued.length > 0 && (<section className="lb-sec-list"><div className="lb-head"><h2>{t.requests.documents}</h2></div>{issued.map((d, i) => <Seal key={d.id} title={tx(d.title)} number={d.number} onOpen={() => setDoc(d)} delay={0.15 + i * 0.1} />)}</section>)}
          {/* v0.16 (4.8، 4.10): قيد السجل الصادر عن هذا الطلب، والخدمة التالية المقترحة */}
          {r.configured && status === 'completed' ? (() => { const entries = myRegisterEntries(state, r.configured!.onBehalfOf || r.requesterId).filter((e) => e.requestId === r.id); const next = r.configured!.followUp ? configuredById(state, r.configured!.followUp.serviceId) : undefined; if (!entries.length && !next) return null; return (
            <section className="lb-sec-list"><div className="lrow-list">
              {entries.map((e) => <div key={e.id} className="lrow"><span className="qicon g-sage sv-ic"><I.book /></span><span className="lrow-txt"><b>{L.dz.v16.rqx.myRecord}: {tx(e.title)}</b><span><span className="mono">{e.id}</span> · {L.dz.v16.registers.status[e.status]}{e.expiresAt ? ` · ${L.dz.v16.registers.expires} ${e.expiresAt}` : ''}</span></span></div>)}
              {next && mine ? <a className="lrow" href={r.configured!.followUp!.requestId ? `#/requests/${r.configured!.followUp!.requestId}` : `#/new/${next.id}`}><span className={`qicon ${next.tone || 'g-sage'} sv-ic`}>{React.createElement(I[(next.icon as IconName) || 'grid'] || I.grid)}</span><span className="lrow-txt"><b>{L.dz.v16.rqx.suggestNext}</b><span>{r.configured!.followUp!.requestId ? `${tx(next.name)} · ${r.configured!.followUp!.requestId}` : fill(L.dz.v16.rqx.suggestSub, { s: tx(next.name) })}</span></span><span className="lrow-trail"><I.chev className="dirchev" /></span></a> : null}
            </div></section>
          ); })() : null}
          <section className="lb-sec-list">
            <div className="lb-head"><h2>{t.requests.submitted}</h2>{!mine && requester ? <span className="lb-muted">{t.common.requester}: {lang === 'ar' ? requester.name : requester.nameEn}</span> : null}</div>
            {r.leave ? <LeaveCard r={r} type={leaveTypeOf(state, r)} /> : null}
            {r.need ? <NeedCard r={r} compact /> : null}
            {r.need ? (<>
              {attachments.length && !r.need.procurement?.preparedAt ? <Group><div style={{ padding: '10px 14px 12px' }}><NeedFile r={r} /></div></Group> : null}
              <button type="button" className="lb-link" onClick={() => setStages((v) => !v)}>{t.need.card.stages}<I.chevDown className={`lb-chev ${stages ? 'up' : ''}`} /></button>
              <AnimatePresence initial={false}>{stages ? <motion.div key="stages" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }} style={{ overflow: 'hidden' }}><Group><div style={{ padding: '10px 14px 12px' }}><NeedStages r={r} /></div></Group>{r.need.procurement?.preparedAt ? <Group><NeedPurchaseSummary r={r} /></Group> : null}</motion.div> : null}</AnimatePresence>
              {(r.need.procurement?.preparedAt || r.need.handover?.number || r.need.provision) ? <><div className="lb-head sm"><h2>{t.need.card.refs}</h2></div><NeedRefs r={r} /></> : null}
            </>) : (
              (r.fields.some((f) => f.value && !(r.leave && ['type', 'from', 'to', 'days'].includes(f.key))) || attachments.length > 0) ? <><Group>{r.fields.filter((f) => f.value && !(r.leave && ['type', 'from', 'to', 'days'].includes(f.key))).map((f) => <div key={f.key} className="summary-row"><span className="k">{tx(f.label)}</span><span className="v">{fv(f, lang)}</span></div>)}{attachments.map((d) => <div key={d.id} className="summary-row"><span className="k">{t.requests.attachment}</span><span className="v"><Pill icon="clip">{tx(d.title)}</Pill></span></div>)}</Group>
              {r.configured ? (() => { const svc = serviceOfRequest(state, r); const tables = svc ? dzFields(svc).filter((f) => f.kind === 'table' && r.configured!.values[f.id]) : []; return tables.map((f) => { const { cols, rows } = tableRows(state, f, r.configured!.values[f.id], lang); return <Group key={f.id}><div className="cf-tbl-view"><b className="cell-sub" style={{ padding: '8px 14px 0', display: 'block' }}>{tx(f.label)}</b><table className="dt small"><thead><tr>{cols.map((c) => <th key={c.id}>{tx(c.label)}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i}>{row.map((v, k) => <td key={k}>{v}</td>)}</tr>)}</tbody></table></div></Group>; }); })() : null}</> : null
            )}
          </section>
        </div>
        <div>
          <section className="lb-sec-list">
            <div className="lb-head"><h2>{L.pages.events}</h2><span className="lb-count num">{events.length}</span></div>
            <div className="ev-list">
              {shownEvents.map((a, i) => { const who = a.who === 'system' ? t.desks.system : (personById(state, a.who) ? (lang === 'ar' ? personById(state, a.who)!.name : personById(state, a.who)!.nameEn) : a.who); return (
                <div key={i} className="ev">{a.who === 'system' ? <span className="cell-lead plain"><I.gear /></span> : <Avatar p={personById(state, a.who)} />}<span className="ev-txt"><b><Nb s={tx(a.what)} /></b><span>{who} · {fmtDate(a.at, lang, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></span></div>
              ); })}
            </div>
            {events.length > 2 ? <button type="button" className="lb-link" onClick={() => setAllEvents((v) => !v)}>{allEvents ? L.pages.showLess : fill(L.pages.showAll, { n: events.length })}</button> : null}
            <button type="button" className="lb-link" onClick={() => setRoute((v) => !v)}>{L.pages.route}<I.chevDown className={`lb-chev ${route ? 'up' : ''}`} /></button>
            <AnimatePresence initial={false}>{route ? <motion.div key="route" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }} style={{ overflow: 'hidden' }}><Group><div style={{ padding: '10px 14px 12px' }}><Rail r={r} now={now} /></div></Group></motion.div> : null}</AnimatePresence>
          </section>
          <section className="lb-sec-list rq-actions"><RequestActions r={r} /></section>
        </div>
      </div>

      <BottomSheet open={!!doc} onClose={() => setDoc(null)} title={doc ? tx(doc.title) : ''} tall className="reader">
        <div className="lb-doc">{doc && <DocPreview r={r} doc={doc} />}</div>
      </BottomSheet>
    </PageChrome>
  );
}

/* معاينة المستند: المخرج المعتمد للخدمة بالهوية الرسمية (قرار الإجازة، وسند التسليم، ومحضر الاستلام)، وما عداه معاينة مبدئية */
export function DocPreview({ r, doc }: { r: Request; doc: Doc }) {
  const { state } = useStore(); const { lang, t, tx } = useLang();
  const requester = personById(state, r.requesterId);
  const signer = r.steps.filter((s) => s.status === 'done' && s.actorId && s.actorId !== 'system').map((s) => personById(state, s.actorId!)).filter(Boolean).pop();
  const [printing, print, portal] = usePrint();
  /* v0.12 (D-026): محضر الاستلام — من ملف الشراء بتوقيع من وقّع فعلاً */
  if (r.need && doc.kind === 'issued' && (doc.type === 'inspection' || doc.type === 'serviceReceipt')) {
    const rc = (r.need.procurement?.receipts || []).find((x) => x.id === doc.refId || x.docId === doc.id); if (!rc) return null;
    return (
      <>
        <ReceiptDocument r={r} receipt={rc} />
        <div className="kbd-row" style={{ padding: '12px 0 0', justifyContent: 'flex-end' }}><PrintButton onClick={print} /></div>
        {portal(<ReceiptDocument r={r} receipt={rc} still />)}
        {printing ? null : <p className="cell-sub" style={{ marginTop: 6 }}>{lang === 'ar' ? 'مخرج AS-01: يولّده النظام من ملف الشراء ويكمله مسؤول الاستلام ويوقّعه، ويُرحَّل الاستلام إلى النظام المرجعي برقمه؛ يُطبع أو يُحفظ PDF من الزر أعلاه.' : 'AS-01 output: generated by the system from the purchase file, completed and signed by the receipt officer, and posted to the system of record under its number; print or save as PDF from the button above.'}</p>}
      </>
    );
  }
  /* v0.9 سند التسليم والاستلام: مخرج AS-01 بالهوية الرسمية بتوقيعي الطرفين (سند لكل دفعة في v0.12) */
  if (r.need && doc.kind === 'issued') {
    return (
      <>
        <HandoverNote r={r} doc={doc} />
        <div className="kbd-row" style={{ padding: '12px 0 0', justifyContent: 'flex-end' }}><PrintButton onClick={print} /></div>
        {portal(<HandoverNote r={r} doc={doc} still />)}
        {printing ? null : <p className="cell-sub" style={{ marginTop: 6 }}>{lang === 'ar' ? 'مخرج AS-01 المعتمد: يُبنى من الطلب وتوقيعي المسلِّم والمستلم ومستندات الصرف في النظام المرجعي؛ يُطبع أو يُحفظ PDF من الزر أعلاه.' : 'The approved AS-01 output: built from the request, both signatures and the issue documents in the system of record; print or save as PDF from the button above.'}</p>}
      </>
    );
  }
  /* v0.15 (CAP-02): مستند الخدمة المهيّأة على ورقة الهوية من مخرجها الذي هيّأه المدير */
  if (r.configured && doc.kind === 'issued') {
    return (
      <>
        <ConfiguredDocument r={r} doc={doc} />
        <div className="kbd-row" style={{ padding: '12px 0 0', justifyContent: 'flex-end' }}><PrintButton onClick={print} /></div>
        {portal(<ConfiguredDocument r={r} doc={doc} still />)}
        {printing ? null : <p className="cell-sub" style={{ marginTop: 6 }}>{lang === 'ar' ? `مخرج خدمة مهيّأة من مصمّم الخدمات (الإصدار ${r.configured.version}): يُبنى من حقول الطلب التي عُلِّمت «تظهر في المستند» وممن اعتمد فعلاً؛ يُطبع أو يُحفظ PDF من الزر أعلاه.` : `Output of a configured service from the service designer (version ${r.configured.version}): built from the request fields marked “shown in the document” and from whoever actually approved; print or save as PDF from the button above.`}</p>}
      </>
    );
  }
  /* قرار الإجازة: المخرج المعتمد لبطاقة TM-01 بالهوية الرسمية؛ بقية الخدمات تبقى على المعاينة المبدئية حتى بطاقاتها */
  if (r.leave && doc.kind === 'issued') {
    const type = leaveTypeOf(state, r);
    return (
      <>
        <LeaveDecision r={r} doc={doc} type={type} />
        <div className="kbd-row" style={{ padding: '12px 0 0', justifyContent: 'flex-end' }}><PrintButton onClick={print} /></div>
        {portal(<LeaveDecision r={r} doc={doc} type={type} still />)}
        {printing ? null : <p className="cell-sub" style={{ marginTop: 6 }}>{lang === 'ar' ? 'مخرج TM-01 المعتمد: يُبنى من بيانات الطلب وإصدار السياسة الذي قُيّم به، ويُطبع أو يُحفظ PDF من الزر أعلاه.' : 'The approved TM-01 output: built from the request and the policy version it was evaluated under; print or save as PDF from the button above.'}</p>}
      </>
    );
  }
  return (
    <>
      <motion.div className="doc-preview" dir={lang === 'ar' ? 'rtl' : 'ltr'} initial={{ opacity: 0, y: 16, rotateX: 6 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ ...SPRING.soft, delay: 0.08 }} style={{ transformPerspective: 900 }}>
        <div className="dp-head"><img className="dp-emblem" src={emblem} alt="" /><b style={{ flex: 1 }}>{t.org}<br /><span style={{ fontWeight: 500, fontSize: 11 }}>{lang === 'ar' ? 'الإدارة العامة للشؤون المالية والإدارية' : 'General Administration for Financial & Administrative Affairs'}</span></b><span className="dp-num">{doc.number}<br />{fmtDate(doc.at, 'en', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span></div>
        <div className="dp-title">{tx(doc.title)}</div>
        <p>{lang === 'ar' ? `يُصدر هذا المستند بناءً على الطلب رقم ${r.id} المقدم من ${requester?.name || ''}، ${requester?.title || ''}، ${requester?.unit || ''}، بعد اكتمال مساره واعتماده.` : `This document is issued on request ${r.id} submitted by ${requester?.nameEn || ''}, ${requester?.titleEn || ''}, ${requester?.unitEn || ''}, after its route was completed and approved.`}</p>
        <table style={{ width: '100%', borderCollapse: 'collapse', margin: '10px 0', fontSize: 12 }}><tbody>{r.fields.filter((f) => f.value).map((f) => <tr key={f.key}><td style={{ padding: '4px 6px', color: '#5f6864', borderBottom: '1px solid #eee', width: '35%' }}>{tx(f.label)}</td><td style={{ padding: '4px 6px', borderBottom: '1px solid #eee' }}>{fv(f, lang)}</td></tr>)}</tbody></table>
        <p style={{ marginTop: 10 }}>{lang === 'ar' ? 'المعتمد: ' : 'Approved by: '}<b>{signer ? (lang === 'ar' ? signer.name : signer.nameEn) : t.desks.system}</b>{signer ? ` · ${lang === 'ar' ? signer.title : signer.titleEn}` : ''}</p>
        <div className="dp-foot"><span>{r.id}</span><span>{lang === 'ar' ? 'رمز التحقق' : 'Verification'}: <span className="mono">VER-{(r.id.slice(-4) + '7A')}</span></span></div>
        <motion.span className="dp-stamp" initial={{ scale: 2.2, opacity: 0, rotate: -20 }} animate={{ scale: 1, opacity: 1, rotate: -8 }} transition={{ type: 'spring', stiffness: 360, damping: 16, delay: 0.55 }}>{lang === 'ar' ? 'معتمد' : 'APPROVED'}</motion.span>
      </motion.div>
      <p className="cell-sub" style={{ marginTop: 10 }}>{lang === 'ar' ? 'معاينة مبدئية. المستند النهائي يُبنى من قالب المخرج المعتمد للخدمة عند بطاقة الإجراء.' : 'Provisional preview. The final document is built from the approved output template at the process card.'}</p>
    </>
  );
}

/** أفعال صاحب الطلب: السحب، وطلب إلغاء الاحتياج، وإلغاء الإجازة المعتمدة — بأوراقها */
export function RequestActions({ r }: { r: Request }) {
  const { state, dispatch } = useStore(); const { lang, t, tx } = useLang(); const now = useNow(); const toast = useToast(); const me = usePerson();
  const requester = personById(state, r.requesterId); const mine = r.requesterId === me.id; const title = tx(requestTitle(r));
  /* v0.9 الاحتياج: السحب قبل المشتريات ما لم يُحجز بند؛ وبعد المشتريات طلبُ إلغاء يقرره مكتب المشتريات */
  const canWithdraw = mine && r.status === 'in_review' && (r.need ? canWithdrawNeed(r) : !r.steps.some((s) => s.status === 'done' && s.desk !== 'requester'));
  const needCancelable = mine && !!r.need && canCancelNeed(r);
  const [ncOpen, setNcOpen] = useState(false); const [ncReason, setNcReason] = useState(''); const [ncErr, setNcErr] = useState('');
  const sendNeedCancel = () => { if (!ncReason.trim()) { setNcErr(t.requests.cancel.reasonRequired); return; } dispatch({ type: 'needCancelRequest', requestId: r.id, reason: ncReason.trim() }); setNcOpen(false); toast({ title: t.need.cancel.pending, sub: r.id, icon: 'clock', tone: 'warn' }); };
  /* v0.7 إلغاء إجازة معتمدة: يظهر لصاحب الإجازة المكتملة، بقاعدة نوعها ومسار إلغائه واسترداد ما نُفِّذ معها */
  const gnames = useGroupNames(); const pnames = namesFor(state); const today = toISO(now);
  const cancelable = mine && r.serviceId === 'TM-01' && r.status === 'completed' && !!r.leave;
  const cev = cancelable ? cancelEvaluation(state, r, today, gnames) : null;
  const [cancelOpen, setCancelOpen] = useState(false); const [cancelReason, setCancelReason] = useState(''); const [cancelErr, setCancelErr] = useState('');
  const sendCancel = () => { if (!cancelReason.trim()) { setCancelErr(t.requests.cancel.reasonRequired); return; } const id = `REQ-2026-${String(state.seq + 1).padStart(4, '0')}`; dispatch({ type: 'cancelLeave', requestId: r.id, reason: cancelReason.trim() }); setCancelOpen(false); toast({ title: t.requests.cancel.sent, sub: id, icon: 'check', tone: 'ok' }); setTimeout(() => nav(`#/requests/${id}`), 350); };
  if (!canWithdraw && !needCancelable && !cev) return null;
  return (
    <>
          {canWithdraw && (<div style={{ marginTop: 16 }}><motion.button type="button" className="btn secondary block" whileTap={{ scale: 0.97 }} onClick={() => { dispatch({ type: 'withdraw', requestId: r.id }); toast({ title: t.requests.withdrawn, sub: `${title} · ${r.id}`, icon: 'x', tone: 'warn' }); }}><I.x />{t.requests.withdraw}</motion.button></div>)}
          {needCancelable && (<div style={{ marginTop: 16 }} className="cancel-block"><p className="cell-sub" style={{ padding: '0 4px 8px' }}>{t.need.cancel.hint}</p><motion.button type="button" className="btn secondary block" whileTap={{ scale: 0.97 }} onClick={() => setNcOpen(true)}><I.x />{t.need.cancel.btn}</motion.button></div>)}
          {cev && !r.leave?.cancelled && r.cancellation?.status !== 'pending' && (
            <div style={{ marginTop: 16 }} className="cancel-block">
              {!cev.ok ? <Checks checks={cev.checks} /> : <p className="cell-sub" style={{ padding: '0 4px 8px' }}>{cev.rule.allowed === 'beforeStart' ? t.requests.cancel.untilStart : t.requests.cancel.untilEnd}{cev.fulfilled.length ? ` · ${t.requests.cancel.fulfilled}: ${cev.fulfilled.map((x) => tx(x.e.name)).join('، ')}` : ''}</p>}
              <motion.button type="button" className="btn secondary block" disabled={!cev.ok} whileTap={{ scale: 0.97 }} onClick={() => setCancelOpen(true)}><I.x />{t.requests.cancel.btn}</motion.button>
            </div>
          )}
      {needCancelable ? (
        <Sheet open={ncOpen} onClose={() => setNcOpen(false)} title={t.need.cancel.title} lead={<span className="qicon g-bronze"><I.x /></span>}>
          <Notice icon="info">{t.need.cancel.hint}</Notice>
          <div style={{ height: 10 }} />
          <Group>
            <Item><NeedCard r={r} compact /></Item>
            <Field id="nc-reason" label={t.need.cancel.reason} error={ncErr || undefined}><textarea id="nc-reason" rows={2} value={ncReason} onChange={(e) => { setNcReason(e.target.value); setNcErr(''); }} /></Field>
          </Group>
          <div style={{ height: 12 }} />
          <motion.button type="button" className="btn primary block lg" onClick={sendNeedCancel} whileTap={{ scale: 0.97 }}><I.send />{t.need.cancel.send}</motion.button>
        </Sheet>
      ) : null}
      {cev ? (
        <Sheet open={cancelOpen} onClose={() => setCancelOpen(false)} title={t.requests.cancel.title} lead={<span className="qicon g-bronze"><I.x /></span>}>
          <Notice icon="info">{t.requests.cancel.hint}</Notice>
          <div style={{ height: 10 }} />
          <Group>
            <Item><LeaveCard r={r} type={leaveTypeOf(state, r)} /></Item>
            {cev.fulfilled.length > 0 ? cev.fulfilled.map(({ e, ref }) => { const oc = onCancelOf(e); const agent = tx(agentTitle(e.fulfil.agent, pnames)); return <div key={e.id} className="cell"><span className="cell-lead gold"><I.seal /></span><span className="cell-main"><span className="cell-title">{tx(e.name)}{ref ? <> · <span className="mono">{ref}</span></> : null}</span><span className="cell-sub">{oc.reversal === 'task' ? `${t.requests.cancel.willRecover} ${agent}` : oc.reversal === 'notify' ? `${lang === 'ar' ? 'تُبلَّغ' : 'Notified'}: ${agent}` : '—'}{oc.approval ? ` ${t.requests.cancel.willApprove}` : ''}</span></span></div>; }) : null}
            <div className="cell stacked"><span className="cell-title">{t.requests.cancel.route}</span>{cev.rule.route === 'none' && !cev.fulfilled.some((x) => onCancelOf(x.e).approval) ? <span className="cell-sub">{t.requests.cancel.immediate}</span> : null}<div style={{ paddingTop: 6 }}><RoutePreview steps={cev.steps} requester={requester!} notApplied={cev.notApplied} /></div></div>
            <Field id="cancel-reason" label={t.requests.cancel.reason} error={cancelErr || undefined}><textarea id="cancel-reason" rows={2} value={cancelReason} onChange={(e) => { setCancelReason(e.target.value); setCancelErr(''); }} /></Field>
          </Group>
          <div style={{ height: 12 }} />
          <motion.button type="button" className="btn primary block lg" onClick={sendCancel} whileTap={{ scale: 0.97 }}><I.send />{t.requests.cancel.submit}</motion.button>
        </Sheet>
      ) : null}
    </>
  );
}
