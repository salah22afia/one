/* «مهامي» في المختبر: كل ما ينتظر الشخص في مكان واحد — الاعتمادات والتنفيذ صفوفاً بفعل (سحب للاعتماد أو الإعادة، ونقر للقرار في لوح)،
   وتحته «يخصّك» (المعاد إليه، والتعاميم التي تنتظر اطلاعه، والمستندات التي تنتهي)؛ على الحاسوب قائمة وتفاصيل جنباً إلى جنب (C-UX-83). */
import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../app/store';
import { useLang, usePerson, Avatar, Pill, Segmented, Empty, useNow, useToast, Field, Group, Notice, Rail, fv } from '../ui/components';
import { SwipeRow, SPRING, Stagger } from '../ui/motion';
import { I } from '../ui/icons';
import { tasksFor, doneTasksFor, policyTasksFor, requestTitle, personById, assigneesFor, approvalLocked, type TaskView } from '../domain/engine';
import { livePosts } from '../domain/comms';
import { NEED_PANEL_ROLES, NEED_SUMMARY_ROLES, NeedCard, NeedTaskPanel, NeedPurchaseSummary, needTaskHint } from '../ui/NeedBits';
import { LeaveCard, leaveTypeOf } from '../ui/LeaveBits';
import { relTime, durText, fill, changesText } from '../app/i18n';
import type { Post, Person } from '../domain/types';
import { useFocus } from './Focus';
import { ReaderSheet } from './News';
import { useUI, BottomSheet, shortName, useIntroSkip } from '../app/ui';
import { PageChrome } from '../ui/Page';
import { ConfiguredTaskPanel } from './ConfiguredTask';

function TaskRow({ tk, selected, onOpen, onQuick, onReturn, swipe }: { tk: TaskView; selected?: boolean; onOpen: () => void; onQuick: () => void; onReturn?: () => void; swipe: boolean }) {
  const { state } = useStore(); const { lang, t, tx } = useLang(); const now = useNow(); const { L } = useUI();
  /* v0.15: الخدمة السرية بإخفاء الهوية — الطالب بلا اسم في خطوات الاعتماد، ويعرفه من ينفّذ */
  const anon = !!tk.request.configured?.hideRequester && tk.step.mode !== 'fulfil';
  const p = anon ? undefined : personById(state, tk.request.requesterId);
  const title = `${tx(requestTitle(tk.request))} · ${anon ? L.dz.rq.anonymous : shortName(p, lang)}`;
  const lk = tk.step.desk !== 'requester' && tk.step.mode !== 'fulfil' ? approvalLocked(state, tk.request) : null;
  const left = tk.dueAt - now;
  const pill = lk ? <Pill tone="danger" icon="lock">{t.policy.close.lockedPill}</Pill> : tk.overdue ? <Pill tone="danger">{fill(L.pages.overdueBy, { t: durText(now - tk.dueAt, lang) })}</Pill> : left < 90 * 24 * 3600000 ? <Pill tone={left < 24 * 3600000 ? 'warn' : 'tint'} icon="clock">{fill(L.pages.dueIn, { t: durText(left, lang) })}</Pill> : null;
  const inner = (
    <button type="button" className={`lrow ${selected ? 'on' : ''} ${tk.overdue ? 'late' : ''}`} onClick={onOpen}>
      <Avatar p={p} />
      <span className="lrow-txt"><b>{title}</b><span className="lrow-line"><span>{tx(tk.step.title)}{(tk.step.assigneeIds || []).length > 1 ? ` · ${tk.step.quorum === 'all' ? t.inbox.quorumAll : t.inbox.quorumAny}` : ''} · {relTime(tk.step.startedAt || tk.request.createdAt, lang, now)}</span>{pill}</span></span>
      <span className="lrow-trail"><I.chev className="dirchev" /></span>
    </button>
  );
  if (!swipe) return inner;
  const quickLabel = tk.request.need && tk.step.role && NEED_PANEL_ROLES.includes(tk.step.role) ? t.common.open : tk.step.desk === 'requester' ? t.status.done : tk.step.mode === 'fulfil' ? t.inbox.fulfil : t.inbox.approve;
  const actions = [{ label: quickLabel, icon: 'check' as const, tone: 'ok', onClick: onQuick }, ...(onReturn ? [{ label: t.inbox.ret, icon: 'ret' as const, tone: 'warn', onClick: onReturn }] : [])];
  return <SwipeRow rtl={lang === 'ar'} onOpen={onOpen} ariaLabel={title} actions={actions}>{inner}</SwipeRow>;
}

export function Inbox() {
  const { state, dispatch } = useStore(); const { lang, t, tx } = useLang(); const me = usePerson(); const now = useNow(); const toast = useToast(); const reduce = useIntroSkip();
  const { L, desk } = useUI();
  const [tab, setTab] = useState<'pending' | 'done'>('pending'); const [openId, setOpenId] = useState<string | null>(null); const [reader, setReader] = useState<Post | null>(null);
  const pending = tasksFor(state, me, now); const done = doneTasksFor(state, me); const policyTasks = policyTasksFor(state, me, now);
  const postsList = useMemo(() => livePosts(state).sort((a, b) => b.at - a.at), [state.posts]); // eslint-disable-line react-hooks/exhaustive-deps
  const { items } = useFocus(now, postsList, (p) => setReader(p));
  const yours = items.filter((it) => it.id !== 'approvals' && !it.id.startsWith('pol-'));
  const selected = pending.find((x) => x.request.id === openId) || (desk ? pending[0] : undefined);
  const [lastSel, setLastSel] = useState<TaskView | undefined>(undefined);
  useEffect(() => { if (selected) setLastSel(selected); }, [selected]);
  const shown = selected || lastSel; const requester = shown ? personById(state, shown.request.requesterId) : undefined;
  const quickApprove = (tk: TaskView) => {
    if (tk.step.mode === 'fulfil' || (tk.request.need && tk.step.role && NEED_PANEL_ROLES.includes(tk.step.role)) || (tk.step.desk !== 'requester' && approvalLocked(state, tk.request))) { setOpenId(tk.request.id); return; }
    dispatch({ type: 'decide', requestId: tk.request.id, action: tk.step.desk === 'requester' ? 'receive' : 'approve', actorId: me.id });
    try { navigator.vibrate?.(12); } catch { /* لا اهتزاز */ }
    toast({ title: tk.step.desk === 'requester' ? tx(tk.step.title) : t.inbox.approve, sub: `${tx(requestTitle(tk.request))} · ${tk.request.id}`, icon: 'check', tone: 'ok' });
  };
  const total = pending.length + policyTasks.length;
  const seg = <Segmented id="lb-inbox" value={tab} onChange={setTab} options={[{ v: 'pending', label: t.inbox.pending, n: total }, { v: 'done', label: t.inbox.done, n: done.length }]} />;
  const list = tab === 'pending' ? (
    <>
      {total === 0 ? (
        <motion.div className="fc calm lb-calm" initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={SPRING.soft}><div className="fc-calm"><span className="fc-ok"><I.check /></span><span><b>{L.pages.noTasks}</b><span>{L.pages.noTasksSub}</span></span></div></motion.div>
      ) : (
        <section className="lb-sec-list">
          <div className="lb-head"><h2>{L.pages.approvals}</h2><span className="lb-count num">{total}</span></div>
          {!desk ? <p className="lb-hint">{L.pages.swipeHint}</p> : null}
          <div className="lrow-list" role="list">
            {policyTasks.map((pt) => { const by = personById(state, pt.version.createdBy); return (
              <a key={pt.version.id} className="lrow" href="#/admin/policy" role="listitem"><span className="cell-lead gold"><I.shield /></span><span className="lrow-txt"><b>{t.inbox.policyTask} {pt.version.number}</b><span>{t.inbox.policyTaskSub} {shortName(by, lang)} · {t.policy.from} {pt.version.from} · {changesText(pt.version.changes.length, lang)}</span></span><span className="lrow-trail">{pt.overdue ? <Pill tone="danger">{t.inbox.overdue}</Pill> : <Pill tone="gold" icon="clock">{fill(L.pages.dueIn, { t: durText(pt.dueAt - now, lang) })}</Pill>}<I.chev className="dirchev" /></span></a>
            ); })}
            <AnimatePresence initial={false}>
              {pending.map((tk) => (
                <motion.div key={tk.request.id} layout initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0, x: lang === 'ar' ? -40 : 40, transition: { duration: 0.24 } }} transition={SPRING.soft} role="listitem">
                  <TaskRow tk={tk} swipe={!desk} selected={desk && selected?.request.id === tk.request.id} onOpen={() => setOpenId(tk.request.id)} onQuick={() => quickApprove(tk)} onReturn={tk.step.desk === 'requester' || tk.step.mode === 'fulfil' ? undefined : () => setOpenId(tk.request.id)} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </section>
      )}
      {yours.length > 0 && (
        <section className="lb-sec-list">
          <div className="lb-head"><h2>{L.pages.yours}</h2><span className="lb-count num">{yours.length}</span></div>
          <div className="lrow-list" role="list">
            {yours.map((it) => { const Ic = I[it.icon]; return (
              <button key={it.id} type="button" className={`lrow ${it.danger ? 'late' : ''}`} onClick={it.go} role="listitem"><span className={`fc-ic ${it.tone}`}><Ic /></span><span className="lrow-txt"><b>{it.title}</b>{it.sub ? <span>{it.sub}</span> : null}</span><span className="lrow-trail"><span className="fc-act">{it.action}<I.chev className="dirchev" /></span></span></button>
            ); })}
          </div>
        </section>
      )}
    </>
  ) : (
    done.length === 0 ? <div className="lb-empty"><Empty icon="check" title={t.inbox.emptyDone} /></div> : (
      <section className="lb-sec-list"><div className="lrow-list" role="list">
        {done.map(({ request, step }) => { const p = personById(state, request.requesterId); const tone = step.status === 'done' ? 'ok' : step.status === 'returned' ? 'warn' : 'danger'; return (
          <a key={request.id + step.key} className="lrow" href={`#/requests/${request.id}`} role="listitem"><Avatar p={p} /><span className="lrow-txt"><b>{tx(requestTitle(request))} · {shortName(p, lang)}</b><span>{tx(step.title)} · {step.at ? relTime(step.at, lang, now) : ''}</span></span><span className="lrow-trail"><Pill tone={tone}>{step.status === 'done' ? t.status.done : step.status === 'returned' ? t.status.returned : t.status.rejected}</Pill><I.chev className="dirchev" /></span></a>
        ); })}
      </div></section>
    )
  );
  return (
    <PageChrome title={t.inbox.title} root end={desk ? seg : undefined}>
      {!desk ? <div className="lp-seg">{seg}</div> : null}
      {desk ? (
        <div className="lb-split">
          <div className="lb-split-list">{list}</div>
          <div className="lb-split-detail">
            <AnimatePresence mode="wait" initial={false}>
              {selected && tab === 'pending' ? (
                <motion.div key={selected.request.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8, transition: { duration: 0.12 } }} transition={SPRING.soft}>
                  <div className="sheet-head" style={{ touchAction: 'auto' }}><Avatar p={requester} /><h2>{tx(requestTitle(selected.request))}</h2></div>
                  <TaskDetail task={selected} onDone={() => setOpenId(null)} />
                </motion.div>
              ) : <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><Empty icon={tab === 'done' ? 'check' : 'inbox'} title={tab === 'done' ? t.inbox.done : L.pages.noTasks} sub={tab === 'done' ? '' : L.pages.tapToDecide} /></motion.div>}
            </AnimatePresence>
          </div>
        </div>
      ) : (
        <>
          {list}
          <BottomSheet open={!!openId && !!selected} onClose={() => setOpenId(null)} tall title={shown ? tx(requestTitle(shown.request)) : ''} lead={<Avatar p={requester} />}>
            {shown && <TaskDetail task={shown} onDone={() => setOpenId(null)} />}
          </BottomSheet>
        </>
      )}
      <ReaderSheet post={reader} onClose={() => setReader(null)} now={now} />
    </PageChrome>
  );
}

/* لوح القرار: ما يقرره صاحب المهمة على الطلب — يُفتح من الصف على الهاتف، وبجانب القائمة على الحاسوب */
export function TaskDetail({ task, onDone }: { task: TaskView; onDone: () => void }) {
  const { state, dispatch } = useStore(); const { lang, t, tx } = useLang(); const me = usePerson(); const now = useNow(); const toast = useToast(); const { L } = useUI();
  const [note, setNote] = useState(''); const [ref, setRef] = useState(''); const [err, setErr] = useState(''); const [refErr, setRefErr] = useState('');
  useEffect(() => { setNote(''); setRef(''); setErr(''); setRefErr(''); }, [task.request.id]);
  const anon = !!task.request.configured?.hideRequester && task.step.mode !== 'fulfil';
  const requester = anon ? undefined : personById(state, task.request.requesterId); const isReceipt = task.step.mode === 'receipt' || task.step.desk === 'requester'; const isFulfil = task.step.mode === 'fulfil';
  /* v0.9 الاحتياج: أدوار لها لوحة قرار خاصة (المستودع، المشتريات، المقيّم، الموازنة، المناقصات، أمر الشراء، الاستلام، التسليم والتوقيع)؛ والمنسّق والسلسلة والجهة الفنية على الاعتماد العادي */
  const needPanel = !!task.request.need && !!task.step.role && NEED_PANEL_ROLES.includes(task.step.role); const needHint = task.request.need ? needTaskHint(task.step.role, t) : null; /* ملخص الشراء يظهر لمعتمدي الشراء والترسية ولكل من يمسك خطوة بعد التجهيز (الموازنة، العروض، التقييم، المناقصات، أمر الشراء) */
  const needSummary = !!task.request.need && !!task.step.role && (NEED_SUMMARY_ROLES.includes(task.step.role) || !!task.request.need.procurement?.preparedAt);
  /* v0.8 (D-015): مقفل يعني مقفل — طلب بتاريخ داخل فترة مقفلة لا يُعتمد حتى تُفتح؛ الإعادة والرفض متاحان */
  const locked = !isFulfil && !isReceipt ? approvalLocked(state, task.request) : null;
  /* من يشاركني هذه المهمة (نصاب «أي واحد» أو «الكل») ومن قرر حتى الآن */
  const shared = assigneesFor(state, task.request, task.step).filter((p) => p.id !== me.id); const decided = (task.step.decisions || []).map((d) => personById(state, d.actorId)).filter((p): p is Person => !!p);
  const act = (action: 'approve' | 'return' | 'reject' | 'receive' | 'done') => {
    if ((action === 'return' || action === 'reject') && !note.trim()) { setErr(t.inbox.noteRequired); return; }
    if (action === 'done' && !ref.trim()) { setRefErr(t.inbox.ref); return; }
    dispatch({ type: 'decide', requestId: task.request.id, action, actorId: me.id, note: note.trim() || undefined, ref: action === 'done' ? ref.trim() : undefined });
    try { navigator.vibrate?.(12); } catch { /* لا اهتزاز */ }
    toast({ title: action === 'approve' ? t.inbox.approve : action === 'return' ? t.inbox.ret : action === 'reject' ? t.inbox.reject : action === 'done' ? t.inbox.fulfil : tx(task.step.title), sub: `${tx(requestTitle(task.request))} · ${task.request.id}${action === 'done' ? ` · ${ref.trim()}` : ''}`, icon: action === 'approve' || action === 'receive' || action === 'done' ? 'check' : action === 'return' ? 'ret' : 'x', tone: action === 'reject' ? 'danger' : action === 'return' ? 'warn' : 'ok' });
    onDone();
  };
  return (
    <Stagger delay={0.02} step={0.04}>
      <p className="cell-sub" style={{ marginTop: -6, marginBottom: 10 }}>{requester ? (lang === 'ar' ? requester.name : requester.nameEn) : anon ? L.dz.rq.anonymous : ''} · <span className="mono">{task.request.id}</span> · {relTime(task.request.createdAt, lang, now)}</p>
      {task.request.configured?.confidential ? <><Notice tone="gold" icon="lock">{L.dz.rq.confidential}</Notice><div style={{ height: 8 }} /></> : null}
      {task.step.why || shared.length ? (
        <div className="task-why">
          {task.step.why ? <span><I.info /><span><b>{t.inbox.whyMe}</b> {tx(task.step.why)}</span></span> : null}
          {shared.length ? <span><I.team /><span><b>{task.step.quorum === 'all' ? t.inbox.quorumAll : t.inbox.quorumAny}</b> · {t.inbox.sharedWith} {shared.map((p) => (lang === 'ar' ? p.name : p.nameEn)).join('، ')}{decided.length ? ` · ${t.inbox.approvedSoFar}: ${decided.map((p) => (lang === 'ar' ? p.name : p.nameEn)).join('، ')}` : ''}</span></span> : null}
        </div>
      ) : null}
      {/* v0.16: الخدمة المهيّأة — لوح الخطوة بنموذجها (خيارات القرار والحقول وقائمة التحقق والتعديل والإعادة على حقول) */}
      {task.request.configured ? <ConfiguredTaskPanel task={task} onDone={onDone} rail={<Group><div style={{ padding: '10px 14px' }}><Rail r={task.request} now={now} /></div></Group>} /> : (<>
      {task.request.leave ? <><LeaveCard r={task.request} type={leaveTypeOf(state, task.request)} />{locked ? <><div style={{ height: 8 }} /><Notice tone="danger" icon="lock">{fill(t.policy.close.lockedTask, { until: locked.until })}</Notice></> : null}<div style={{ height: 10 }} /></> : null}
      {task.request.need ? <><NeedCard r={task.request} />{needSummary ? <><Group><NeedPurchaseSummary r={task.request} /></Group><div style={{ height: 10 }} /></> : null}{needHint ? <><Notice tone="tint" icon="info">{needHint}</Notice><div style={{ height: 10 }} /></> : null}</> : null}
      {!task.request.need && task.request.fields.some((f) => f.value && !(task.request.leave && ['type', 'from', 'to', 'days'].includes(f.key))) ? <Group>{task.request.fields.filter((f) => f.value && !(task.request.leave && ['type', 'from', 'to', 'days'].includes(f.key))).map((f) => <div key={f.key} className="summary-row"><span className="k">{tx(f.label)}</span><span className="v">{fv(f, lang)}</span></div>)}</Group> : null}
      {task.request.docs.filter((d) => d.kind === 'attachment').length > 0 && <div className="kbd-row">{task.request.docs.filter((d) => d.kind === 'attachment').map((d) => <Pill key={d.id} icon="clip">{tx(d.title)}</Pill>)}</div>}
      <div style={{ height: 10 }} />
      {/* v0.9: لوحة قرار المكتب قبل المسار (المسار طويل في الاحتياج) */}
      {needPanel ? <><NeedTaskPanel task={task} onDone={onDone} /><div style={{ height: 10 }} /></> : null}
      <Group><div style={{ padding: '10px 14px' }}><Rail r={task.request} now={now} /></div></Group>
      <div style={{ height: 10 }} />
      {needPanel ? null : isFulfil ? (
        <Group><Field id="fulfil-ref" label={t.inbox.ref} error={refErr} hint={t.inbox.refHint}><input id="fulfil-ref" className="mono" dir="ltr" value={ref} onChange={(e) => { setRef(e.target.value); setRefErr(''); }} placeholder="PY-2026-0000" /></Field><Field id="decision-note" label={`${t.inbox.note} (${t.newReq.optional})`}><textarea id="decision-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field></Group>
      ) : !isReceipt ? (<Group><Field id="decision-note" label={t.inbox.note} error={err}><textarea id="decision-note" rows={2} value={note} onChange={(e) => { setNote(e.target.value); setErr(''); }} /></Field></Group>) : null}
      <div style={{ height: 12 }} />
      {needPanel ? null : isReceipt ? (
        <motion.button type="button" className="btn primary block lg" onClick={() => act('receive')} whileTap={{ scale: 0.97 }}><I.check />{tx(task.step.title)}</motion.button>
      ) : isFulfil ? (
        <motion.button type="button" className="btn primary block lg" onClick={() => act('done')} whileTap={{ scale: 0.97 }}><I.check />{t.inbox.fulfil}</motion.button>
      ) : (
        <>
          <motion.button type="button" className="btn primary block lg" disabled={!!locked} onClick={() => act('approve')} whileTap={{ scale: 0.97 }}>{locked ? <I.lock /> : <I.check />}{t.inbox.approve}</motion.button>
          <div style={{ height: 10 }} />
          <div className="btn-row">
            <motion.button type="button" className="btn secondary" onClick={() => act('return')} whileTap={{ scale: 0.97 }}><I.ret />{t.inbox.ret}</motion.button>
            <motion.button type="button" className="btn danger" onClick={() => act('reject')} whileTap={{ scale: 0.97 }}><I.x />{t.inbox.reject}</motion.button>
          </div>
        </>
      )}
      </>)}
    </Stagger>
  );
}
