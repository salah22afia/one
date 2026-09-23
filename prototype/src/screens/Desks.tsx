import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '../app/store';
import { I } from '../ui/icons';
import { Avatar, Empty, Field, Group, LargeTitle, Notice, Pill, Segmented, Sheet, StatusPill, TopBar, useLang, useMedia, useNow, usePerson, useToast } from '../ui/components';
import { motion, AnimatePresence, Stagger, Item, Ticker, SPRING } from '../ui/motion';
import { tasksFor, personById, stepWho, requestTitle, type TaskView } from '../domain/engine';
import { needContent, categoryOf, storeOf, desksFor, needsInPurchase, storeNeeds, stockOf, needSummary, receiptProgress, PURCHASE_ROLES, STORE_ROLES } from '../domain/need';
import { liveNeed, toISO } from '../domain/policy';
import { NeedCard, NeedStages, NeedRefs, NeedTaskPanel, NeedPurchaseSummary, NEED_PANEL_ROLES } from '../ui/NeedBits';
import { relTime, fmtDate, fill } from '../app/i18n';
import type { Request } from '../domain/types';

/* ——— v0.9 مكاتب الاحتياج: صفّ المكتب كله لا مهامه وحدها — ما ينتظره، وما في الطريق، وما يحتاج قراراً خارج الخطوات (الموعد المتوقع، طلبات الإلغاء) ——— */

/** صف احتياج في المكتب: الفئة والبنود والطالب، والخطوة الحالية ومن عندها، ومراجعه */
function NeedRow({ r, selected, onOpen }: { r: Request; selected?: boolean; onOpen: () => void }) {
  const { state } = useStore(); const { lang, t, tx } = useLang(); const now = useNow();
  const n = r.need!; const content = needContent(state); const cat = categoryOf(content, n.categoryId); const Ic = cat ? (I[cat.icon as keyof typeof I] || I.box) : I.box;
  const cur = r.steps.find((s) => s.status === 'current' || s.status === 'returned'); const sum = needSummary(state, r, lang); const requester = personById(state, r.requesterId);
  const p = n.procurement; const ref = p?.poNo ? `${t.need.card.po} ${p.poNo}` : p?.prNo ? `${t.need.card.pr} ${p.prNo}` : p?.reservation ? `${t.need.card.fundsReservation} ${p.reservation.no}` : p?.methodName ? tx(p.methodName) : null;
  return (
    <motion.button type="button" className={`desk-row ${selected ? 'selected' : ''}`} onClick={onOpen} whileTap={{ scale: 0.99 }} transition={SPRING.snappy}>
      <span className={`qicon ${cat?.tone || 'g-sage'}`}><Ic /></span>
      <span className="dr-main"><b>{sum.lines}</b><span className="cell-sub">{requester ? (lang === 'ar' ? requester.name : requester.nameEn) : ''} · <span className="mono">{r.id}</span>{cur && r.status === 'in_review' ? ` · ${tx(cur.title)} · ${stepWho(state, r, cur, lang)} · ${relTime(cur.startedAt || cur.at || r.createdAt, lang, now)}` : ` · ${relTime(r.updatedAt, lang, now)}`}</span></span>
      <span className="dr-trail">{n.cancel && !n.cancel.decidedAt ? <Pill tone="warn" icon="clock">{t.need.cancel.pending}</Pill> : n.urgent ? <Pill tone="danger" icon="alert">{t.need.urgent}</Pill> : r.status !== 'in_review' ? <StatusPill r={r} /> : ref ? <Pill tone="tint"><span className="mono">{ref}</span></Pill> : null}{p?.expectedAt && r.status === 'in_review' ? <span className="cell-sub num">{t.need.card.expected}: {p.expectedAt}</span> : null}</span>
    </motion.button>
  );
}

/** تفاصيل احتياج في المكتب: البطاقة والمراحل والمراجع، ولوحة الخطوة إن كانت لي، وقرارات المكتب خارج الخطوات */
function NeedDeskDetail({ r, desk, onDone }: { r: Request; desk: 'procurement' | 'store'; onDone: () => void }) {
  const { state, dispatch } = useStore(); const { lang, t, tx } = useLang(); const me = usePerson(); const now = useNow(); const toast = useToast();
  const task: TaskView | undefined = tasksFor(state, me, now).find((x) => x.request.id === r.id);
  const panel = task && task.step.role && NEED_PANEL_ROLES.includes(task.step.role);
  const p = r.need!.procurement; const cancel = r.need!.cancel;
  const [exp, setExp] = useState(p?.expectedAt || ''); const [why, setWhy] = useState(''); const [expErr, setExpErr] = useState('');
  const [cnote, setCnote] = useState(''); const [cErr, setCErr] = useState('');
  const [closeWhy, setCloseWhy] = useState('');
  useEffect(() => { setExp(p?.expectedAt || ''); setWhy(''); setExpErr(''); setCnote(''); setCErr(''); setCloseWhy(''); }, [r.id, p?.expectedAt]);
  /* v0.12 (D-027): إقفال المتبقي من مكتب المشتريات بعد أمر الشراء حين بقي ما لم يُستلم (لا أثناء توقيع محضر) */
  const prog = receiptProgress(r.need!); const cur = r.steps.find((x) => x.status === 'current');
  const canClose = desk === 'procurement' && r.status === 'in_review' && !!p?.poNo && prog.open && cur?.role !== 'receiptSign' && !p?.deliveryCompleted;
  const closeIt = () => { if (!closeWhy.trim()) return; dispatch({ type: 'needCloseRemainder', requestId: r.id, actorId: me.id, why: closeWhy.trim() }); toast({ title: t.need.task.closeDone, sub: r.id, icon: 'x', tone: 'warn' }); onDone(); };
  const saveExpected = () => { if (!exp || !why.trim()) { setExpErr(t.need.task.required); return; } dispatch({ type: 'needExpected', requestId: r.id, actorId: me.id, expectedAt: exp, why: why.trim() }); toast({ title: t.need.desk.expectedUpdate, sub: `${r.id} · ${exp}`, icon: 'calendar', tone: 'info' }); setWhy(''); };
  const decideCancel = (accepted: boolean) => { if (!cnote.trim()) { setCErr(t.need.task.required); return; } dispatch({ type: 'needCancelDecide', requestId: r.id, actorId: me.id, accepted, note: cnote.trim() }); toast({ title: accepted ? t.need.desk.accept : t.need.desk.decline, sub: r.id, icon: accepted ? 'x' : 'check', tone: accepted ? 'warn' : 'ok' }); onDone(); };
  const requester = personById(state, r.requesterId);
  return (
    <Stagger delay={0.02} step={0.04}>
      <p className="cell-sub" style={{ marginTop: -6, marginBottom: 10 }}>{requester ? (lang === 'ar' ? requester.name : requester.nameEn) : ''} · <span className="mono">{r.id}</span> · {relTime(r.createdAt, lang, now)} · <a href={`#/requests/${r.id}`} style={{ color: 'var(--tint)', fontWeight: 700 }}>{t.need.desk.open}</a></p>
      <NeedCard r={r} />
      {desk === 'procurement' && p?.preparedAt ? <Group><NeedPurchaseSummary r={r} /></Group> : null}
      {cancel && !cancel.decidedAt && desk === 'procurement' ? (
        <Group>
          <div className="np-head"><b>{t.need.desk.cancelReq}</b><span className="cell-sub">{fmtDate(cancel.requestedAt, lang, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {cancel.reason}</span></div>
          <div style={{ padding: '0 14px 10px' }}><Notice tone="warn" icon="alert">{p?.poNo ? (lang === 'ar' ? `أمر الشراء ${p.poNo} صدر؛ القبول يعني إلغاءه عند المورد.` : `Purchase order ${p.poNo} was issued; accepting means cancelling it with the supplier.`) : (lang === 'ar' ? 'لم يصدر أمر شراء بعد؛ القبول يوقف طلب الشراء.' : 'No purchase order yet; accepting stops the requisition.')}</Notice></div>
          <Field id="dk-cnote" label={t.need.desk.note} error={cErr || undefined}><textarea id="dk-cnote" rows={2} value={cnote} onChange={(e) => { setCnote(e.target.value); setCErr(''); }} /></Field>
          <div className="btn-row" style={{ padding: '4px 14px 14px' }}><motion.button type="button" className="btn danger" onClick={() => decideCancel(true)} whileTap={{ scale: 0.97 }}><I.x />{t.need.desk.accept}</motion.button><motion.button type="button" className="btn secondary" onClick={() => decideCancel(false)} whileTap={{ scale: 0.97 }}><I.check />{t.need.desk.decline}</motion.button></div>
        </Group>
      ) : null}
      {panel && task ? <><div style={{ height: 10 }} /><NeedTaskPanel task={task} onDone={onDone} /></> : task ? <><div style={{ height: 10 }} /><Notice tone="tint" icon="inbox">{lang === 'ar' ? 'هذه الخطوة اعتماد عادي — تقررها من «مهامي».' : 'This step is a regular approval — decide it from Tasks.'}</Notice></> : null}
      {desk === 'procurement' && p?.poNo && r.status === 'in_review' && !r.steps.some((s) => s.status === 'done' && s.role === 'receipt') ? (
        <><div style={{ height: 10 }} /><Group>
          <div className="np-head"><b>{t.need.desk.expectedUpdate}</b><span className="cell-sub">{t.need.card.expected}: <span className="num">{p.expectedAt || '—'}</span>{(p.expectedLog || []).length > 1 ? ` · ${(p.expectedLog || []).length - 1} ${lang === 'ar' ? 'تغيير' : 'changes'}` : ''}</span></div>
          <div className="np-two"><Field id="dk-exp" label={t.need.desk.newDate}><input id="dk-exp" type="date" dir="ltr" className="num" value={exp} onChange={(e) => { setExp(e.target.value); setExpErr(''); }} /></Field><Field id="dk-why" label={t.need.desk.whyChange} error={expErr || undefined}><input id="dk-why" value={why} onChange={(e) => { setWhy(e.target.value); setExpErr(''); }} /></Field></div>
          <div style={{ padding: '4px 14px 14px' }}><motion.button type="button" className="btn soft block" disabled={!exp || exp === p.expectedAt || !why.trim()} onClick={saveExpected} whileTap={{ scale: 0.97 }}><I.calendar />{t.need.desk.save}</motion.button></div>
        </Group></>
      ) : null}
      {canClose ? (
        <><div style={{ height: 10 }} /><Group>
          <div className="np-head"><b>{t.need.task.closeTitle}</b><span className="cell-sub">{fill(t.need.task.recProgress, { a: prog.received, b: prog.total })}</span></div>
          <div style={{ padding: '0 14px 6px' }}><Notice tone="warn" icon="alert">{t.need.task.closeHint}</Notice></div>
          <Field id="dk-closewhy" label={t.need.task.closeWhy}><input id="dk-closewhy" value={closeWhy} onChange={(e) => setCloseWhy(e.target.value)} /></Field>
          <div style={{ padding: '4px 14px 14px' }}><motion.button type="button" className="btn danger block" id="dk-closebtn" disabled={!closeWhy.trim()} onClick={closeIt} whileTap={{ scale: 0.97 }}><I.x />{t.need.task.closeBtn}</motion.button></div>
        </Group></>
      ) : null}
      <div style={{ height: 10 }} />
      <Group><div style={{ padding: '10px 14px 12px' }}><NeedStages r={r} /></div></Group>
      {(p?.preparedAt || r.need!.handover?.number) ? <><div style={{ height: 10 }} /><NeedRefs r={r} /></> : null}
      {r.status !== 'in_review' ? <><div style={{ height: 10 }} /><Notice icon="info">{t.status[r.status]} · {tx(requestTitle(r))}</Notice></> : null}
    </Stagger>
  );
}

function DeskShell({ title, sub, tiles, seg, list, selected, desk, onClose }: { title: string; sub: string; tiles: React.ReactNode; seg: React.ReactNode; list: React.ReactNode; selected?: Request; desk: 'procurement' | 'store'; onClose: () => void }) {
  const wide = useMedia('(min-width: 1024px)'); const { state } = useStore(); const { tx } = useLang();
  const [last, setLast] = useState<Request | undefined>(undefined); useEffect(() => { if (selected) setLast(selected); }, [selected]);
  const shown = selected || last; const requester = shown ? personById(state, shown.requesterId) : undefined;
  return (
    <div className="page view">
      <TopBar title={title} back="#/home" />
      <LargeTitle title={title} sub={sub} />
      {tiles}
      {wide ? (
        <div className="split">
          <div>{seg}<div style={{ height: 12 }} />{list}</div>
          <div className="split-detail">
            <AnimatePresence mode="wait" initial={false}>
              {selected ? (
                <motion.div key={selected.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8, transition: { duration: 0.12 } }} transition={SPRING.soft}>
                  <div className="sheet-head" style={{ touchAction: 'auto' }}><Avatar p={requester} /><h2>{tx(requestTitle(selected))}</h2></div>
                  <NeedDeskDetail r={selected} desk={desk} onDone={onClose} />
                </motion.div>
              ) : <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><Empty icon="box" title={title} sub={sub} /></motion.div>}
            </AnimatePresence>
          </div>
        </div>
      ) : (
        <>
          {seg}<div style={{ height: 12 }} />{list}
          <Sheet open={!!selected} onClose={onClose} title={shown ? tx(requestTitle(shown)) : ''} lead={<Avatar p={requester} />}>{shown && <NeedDeskDetail r={shown} desk={desk} onDone={onClose} />}</Sheet>
        </>
      )}
    </div>
  );
}

/* ——— مكتب المشتريات ——— */
export function ProcurementDesk() {
  const { state } = useStore(); const { t } = useLang(); const me = usePerson(); const now = useNow(); const wide = useMedia('(min-width: 1024px)');
  const [tab, setTab] = useState<'waiting' | 'inFlight' | 'cancel' | 'all'>('waiting'); const [openId, setOpenId] = useState<string | null>(null);
  const mine = tasksFor(state, me, now).filter((x) => x.request.need && x.step.role && PURCHASE_ROLES.includes(x.step.role)).map((x) => x.request);
  const inFlight = needsInPurchase(state); const cancels = state.requests.filter((r) => r.need?.cancel && !r.need.cancel.decidedAt);
  const all = state.requests.filter((r) => r.need && r.steps.some((s) => s.role === 'procurement' && (s.status === 'done' || s.status === 'current'))).sort((a, b) => b.updatedAt - a.updatedAt);
  const lists = { waiting: Array.from(new Set([...cancels, ...mine])), inFlight, cancel: cancels, all };
  const list = lists[tab]; const selected = list.find((r) => r.id === openId) || (wide ? list[0] : undefined);
  const tiles = (
    <Stagger className="desk-tiles" delay={0.1}>
      <Item><div className="tile soft"><b className="num"><Ticker value={lists.waiting.length} delay={0.2} /></b><span>{t.need.desk.waiting}</span></div></Item>
      <Item><div className="tile"><b className="num"><Ticker value={inFlight.length} delay={0.3} /></b><span>{t.need.desk.inFlight}</span></div></Item>
      <Item><div className={`tile ${cancels.length ? 'bad' : ''}`}><b className="num"><Ticker value={cancels.length} delay={0.4} /></b><span>{t.need.desk.cancelReq}</span></div></Item>
    </Stagger>
  );
  const seg = <Segmented id="pdesk" value={tab} onChange={(v) => { setTab(v); setOpenId(null); }} options={[{ v: 'waiting', label: t.need.desk.waiting, n: lists.waiting.length }, { v: 'inFlight', label: t.need.desk.inFlight, n: inFlight.length }, { v: 'all', label: t.need.desk.all, n: all.length }]} />;
  const rows = list.length === 0 ? <Group><Empty icon="wallet" title={t.need.desk.none} /></Group> : <Stagger><Group>{list.map((r) => <Item key={r.id}><NeedRow r={r} selected={wide && selected?.id === r.id} onOpen={() => setOpenId(r.id)} /></Item>)}</Group></Stagger>;
  return <DeskShell title={t.need.desk.proc} sub={t.need.desk.procSub} tiles={tiles} seg={seg} list={rows} selected={selected} desk="procurement" onClose={() => setOpenId(null)} />;
}

/* ——— مكتب المستودع (أو مسؤول الاستلام والتسليم في مكتب خارجي) ——— */
export function StoreDesk() {
  const { state } = useStore(); const { lang, t, tx } = useLang(); const me = usePerson(); const now = useNow(); const wide = useMedia('(min-width: 1024px)');
  const [tab, setTab] = useState<'waiting' | 'all' | 'stock'>('waiting'); const [openId, setOpenId] = useState<string | null>(null);
  const desks = desksFor(state, me); const content = needContent(state); const today = toISO(now);
  const mine = tasksFor(state, me, now).filter((x) => x.request.need && x.step.role && STORE_ROLES.includes(x.step.role)).map((x) => x.request);
  const all = storeNeeds(state, desks.storeIds, desks.siteIds);
  const stores = liveNeed(content.stores, today).filter((s) => desks.storeIds.includes(s.id));
  const stock = useMemo(() => state.erp.items.filter((it) => stores.some((s) => categoryOf(content, it.categoryHint)?.storeId === s.id)).map((it) => { const cat = categoryOf(content, it.categoryHint); const st = cat?.storeId ? storeOf(content, cat.storeId) : undefined; return { it, cat, st, qty: stockOf(state, it.id, cat?.storeId) }; }), [state, content, stores]);
  const reserved = all.reduce((n, r) => n + r.need!.lines.filter((l) => l.status === 'reserved' || l.status === 'received').length, 0);
  const lists = { waiting: mine, all, stock: [] as Request[] };
  const list = lists[tab === 'stock' ? 'all' : tab]; const selected = tab === 'stock' ? undefined : list.find((r) => r.id === openId) || (wide ? list[0] : undefined);
  const tiles = (
    <Stagger className="desk-tiles" delay={0.1}>
      <Item><div className="tile soft"><b className="num"><Ticker value={mine.length} delay={0.2} /></b><span>{t.need.desk.waiting}</span></div></Item>
      <Item><div className="tile"><b className="num"><Ticker value={reserved} delay={0.3} /></b><span>{t.need.task.ready}</span></div></Item>
      <Item><div className="tile"><b className="num"><Ticker value={stock.length} delay={0.4} /></b><span>{t.need.desk.stockTitle}</span></div></Item>
    </Stagger>
  );
  const seg = <Segmented id="sdesk" value={tab} onChange={(v) => { setTab(v); setOpenId(null); }} options={[{ v: 'waiting', label: t.need.desk.waiting, n: mine.length }, { v: 'all', label: t.need.desk.all, n: all.length }, { v: 'stock', label: t.need.desk.stockTitle, n: stock.length }]} />;
  const rows = tab === 'stock' ? (
    <Stagger><Group foot={lang === 'ar' ? 'المتاح كما في النظام المرجعي بعد خصم الحجوزات؛ الصرف الفعلي يقيّده سند التسليم والاستلام.' : 'Available as in the system of record net of reservations; the actual issue is posted by the handover note.'}>
      {stock.length === 0 ? <Empty icon="box" title={t.need.desk.none} /> : stock.map(({ it, cat, st, qty }) => { const Ic = I[it.icon as keyof typeof I] || I.box; return (
        <Item key={it.id}><div className="cell stock-row"><span className={`qicon ${cat?.tone || 'g-sage'}`} style={{ width: 40, height: 40, borderRadius: 13 }}><Ic /></span><span className="cell-main"><span className="cell-title">{tx(it.name)}{it.custody ? <Pill tone="gold" icon="seal">{t.need.custodyFlag}</Pill> : null}</span><span className="cell-sub"><span className="mono">{it.id}</span>{st ? ` · ${tx(st.name)}` : ''}{it.specs ? ` · ${tx(it.specs)}` : ''}</span></span><span className="cell-trail"><span className={`stock-n num ${qty === 0 ? 'zero' : qty <= 2 ? 'low' : ''}`}>{qty}</span><span className="cell-sub">{tx(it.unit)}</span></span></div></Item>
      ); })}
    </Group></Stagger>
  ) : list.length === 0 ? <Group><Empty icon="box" title={t.need.desk.none} /></Group> : <Stagger><Group>{list.map((r) => <Item key={r.id}><NeedRow r={r} selected={wide && selected?.id === r.id} onOpen={() => setOpenId(r.id)} /></Item>)}</Group></Stagger>;
  const sub = `${t.need.desk.storeSub}${stores.length ? ` · ${stores.map((s) => tx(s.name)).join(lang === 'ar' ? '، ' : ', ')}` : desks.siteIds.length ? ` · ${desks.siteIds.map((id) => tx(content.sites.find((s) => s.id === id)?.name || { ar: id, en: id })).join('، ')}` : ''}`;
  return <DeskShell title={t.need.desk.store} sub={sub} tiles={tiles} seg={seg} list={rows} selected={selected} desk="store" onClose={() => setOpenId(null)} />;
}
