/* Tasks (prototype screens/Inbox.tsx, C-UX-83): everything waiting for the person in one place — approvals and
   fulfilment as rows with an action (swipe to approve or return, tap for the decision sheet), and under them what is
   theirs to finish (returned requests); on a desktop the list and the decision sit side by side. */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { getDoneTasks, getTasks, type TaskItem } from '@usp/api-client';
import { useI18n } from '@usp/i18n';
import {
  AnimatePresence, Avatar, BottomSheet, Empty, I, PageChrome, Pill, SPRING, Segmented, SwipeRow, motion, shortName, useIntroSkip, useNow, useUI,
} from '@usp/ui-web';
import { useMyRequests } from '../requests/queries';
import { TaskDetail, useDecide } from './TaskDetail';

const DAY = 24 * 3600000;

function TaskRow({ tk, selected, onOpen, swipe }: { tk: TaskItem; selected?: boolean; onOpen: () => void; swipe: boolean }) {
  const { t, text, lang, ago, duration } = useI18n(); const now = useNow();
  const quick = useDecide(tk, undefined, () => {});
  const name = text(tk.requester.name);
  const title = `${text(tk.serviceName)} · ${shortName(name)}`;
  const left = tk.dueAt ? Date.parse(tk.dueAt) - now : Infinity;
  const pill = tk.overdue && tk.dueAt ? <Pill tone="danger">{t('inbox.overdueBy', { t: duration(now - Date.parse(tk.dueAt)) })}</Pill>
    : left < 90 * DAY ? <Pill tone={left < DAY ? 'warn' : 'tint'} icon="clock">{t('inbox.dueIn', { t: duration(left) })}</Pill> : null;
  const inner = (
    <button type="button" className={`lrow ${selected ? 'on' : ''} ${tk.overdue ? 'late' : ''}`} onClick={onOpen}>
      <Avatar name={name} />
      <span className="lrow-txt"><b>{title}</b><span className="lrow-line"><span>{text(tk.stepTitle)}{tk.shared ? ` · ${t('inbox.quorumAny')}` : ''} · {ago(tk.startedAt, now)}</span>{pill}</span></span>
      <span className="lrow-trail"><I.chev className="dirchev" /></span>
    </button>
  );
  if (!swipe) return inner;
  // A fulfilment needs its reference, so its quick action opens the sheet; approvals and receipts decide in place.
  const quickApprove = () => {
    if (tk.mode === 'fulfil') { onOpen(); return; }
    quick.mutate({ action: tk.mode === 'receipt' ? 'receive' : 'approve' });
  };
  const quickLabel = tk.mode === 'receipt' ? t('status.done') : tk.mode === 'fulfil' ? t('inbox.fulfil') : t('inbox.approve');
  const actions = [
    { label: quickLabel, icon: 'check' as const, tone: 'ok', onClick: quickApprove },
    ...(tk.decisions.includes('return') ? [{ label: t('inbox.return'), icon: 'ret' as const, tone: 'warn', onClick: onOpen }] : []),
  ];
  return <SwipeRow rtl={lang === 'ar'} onOpen={onOpen} ariaLabel={title} actions={actions} disabled={quick.isPending}>{inner}</SwipeRow>;
}

export default function InboxPage() {
  const { t, text, lang, ago } = useI18n(); const now = useNow(); const reduce = useIntroSkip(); const { desk } = useUI(); const navigate = useNavigate();
  const [tab, setTab] = useState<'pending' | 'done'>('pending'); const [openId, setOpenId] = useState<number | null>(null);
  const tasks = useQuery({ queryKey: ['tasks'], queryFn: getTasks, refetchInterval: 60_000 });
  const done = useInfiniteQuery({
    queryKey: ['tasks-done'], queryFn: ({ pageParam }) => getDoneTasks(pageParam), initialPageParam: null as string | null, getNextPageParam: (last) => last.next,
  });
  // "Yours": requests returned to the person, to finish (circulars and expiring documents join with their slices).
  const mine = useMyRequests('ongoing');
  const yours = (mine.data?.pages.flatMap((p) => p.items) ?? []).filter((r) => r.status === 'returned');
  const pending = tasks.data ?? [];
  const doneItems = done.data?.pages.flatMap((p) => p.items) ?? [];
  const selected = pending.find((x) => x.stepId === openId) ?? (desk ? pending[0] : undefined);
  const [lastSel, setLastSel] = useState<TaskItem | undefined>(undefined);
  useEffect(() => { if (selected) setLastSel(selected); }, [selected]);
  const shown = selected ?? lastSel;
  const seg = <Segmented id="lb-inbox" value={tab} onChange={setTab} options={[{ v: 'pending', label: t('inbox.pending'), n: pending.length }, { v: 'done', label: t('inbox.done'), n: done.data?.pages[0]?.total }]} />;
  const list = tab === 'pending' ? (
    <>
      {tasks.isPending ? null : pending.length === 0 ? (
        <motion.div className="fc calm lb-calm" initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={SPRING.soft}>
          <div className="fc-calm"><span className="fc-ok"><I.check /></span><span><b>{t('inbox.noTasks')}</b><span>{t('inbox.noTasksSub')}</span></span></div>
        </motion.div>
      ) : (
        <section className="lb-sec-list">
          <div className="lb-head"><h2>{t('inbox.approvals')}</h2><span className="lb-count num">{pending.length}</span></div>
          {!desk ? <p className="lb-hint">{t('inbox.swipeHint')}</p> : null}
          <div className="lrow-list" role="list">
            <AnimatePresence initial={false}>
              {pending.map((tk) => (
                <motion.div key={tk.stepId} layout initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0, x: lang === 'ar' ? -40 : 40, transition: { duration: 0.24 } }} transition={SPRING.soft} role="listitem">
                  <TaskRow tk={tk} swipe={!desk} selected={desk && selected?.stepId === tk.stepId} onOpen={() => setOpenId(tk.stepId)} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </section>
      )}
      {yours.length > 0 && (
        <section className="lb-sec-list">
          <div className="lb-head"><h2>{t('inbox.yours')}</h2><span className="lb-count num">{yours.length}</span></div>
          <div className="lrow-list" role="list">
            {yours.map((r) => (
              <button key={r.id} type="button" className="lrow" onClick={() => navigate(`/requests/${r.id}`)} role="listitem">
                <span className="fc-ic warn"><I.ret /></span>
                <span className="lrow-txt"><b>{text(r.serviceName)}</b><span>{r.waiting?.note ? `${t('requests.returnedTo')} · ${r.waiting.note}` : t('requests.returnedTo')}</span></span>
                <span className="lrow-trail"><span className="fc-act">{t('requests.finish')}<I.chev className="dirchev" /></span></span>
              </button>
            ))}
          </div>
        </section>
      )}
    </>
  ) : (
    done.isPending ? null : doneItems.length === 0 ? <div className="lb-empty"><Empty icon="check" title={t('inbox.emptyDone')} /></div> : (
      <section className="lb-sec-list">
        <div className="lrow-list" role="list">
          {doneItems.map((x) => {
            const tone = x.action === 'return' ? 'warn' : x.action === 'reject' ? 'danger' : 'ok';
            const label = x.action === 'return' ? t('status.returned') : x.action === 'reject' ? t('status.rejected') : t('status.done');
            const name = text(x.requester.name);
            return (
              <Link key={`${x.stepId}-${x.at}`} className="lrow" to={`/requests/${x.requestId}`} role="listitem">
                <Avatar name={name} />
                <span className="lrow-txt"><b>{text(x.serviceName)} · {shortName(name)}</b><span>{text(x.stepTitle)} · {ago(x.at, now)}</span></span>
                <span className="lrow-trail"><Pill tone={tone}>{label}</Pill><I.chev className="dirchev" /></span>
              </Link>
            );
          })}
        </div>
        {done.hasNextPage ? <button type="button" className="lb-link" disabled={done.isFetchingNextPage} onClick={() => void done.fetchNextPage()}>{t('requests.more')}</button> : null}
      </section>
    )
  );
  return (
    <PageChrome title={t('inbox.title')} root end={desk ? seg : undefined}>
      {!desk ? <div className="lp-seg">{seg}</div> : null}
      {desk ? (
        <div className="lb-split">
          <div className="lb-split-list">{list}</div>
          <div className="lb-split-detail">
            <AnimatePresence mode="wait" initial={false}>
              {selected && tab === 'pending' ? (
                <motion.div key={selected.stepId} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8, transition: { duration: 0.12 } }} transition={SPRING.soft}>
                  <div className="sheet-head" style={{ touchAction: 'auto' }}><Avatar name={text(selected.requester.name)} /><h2>{text(selected.serviceName)}</h2></div>
                  <TaskDetail task={selected} onDone={() => setOpenId(null)} />
                </motion.div>
              ) : (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <Empty icon={tab === 'done' ? 'check' : 'inbox'} title={tab === 'done' ? t('inbox.done') : t('inbox.noTasks')} sub={tab === 'done' ? '' : t('inbox.tapToDecide')} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      ) : (
        <>
          {list}
          <BottomSheet open={openId !== null && !!selected} onClose={() => setOpenId(null)} tall title={shown ? text(shown.serviceName) : ''} lead={<Avatar name={shown ? text(shown.requester.name) : undefined} />}>
            {shown ? <TaskDetail task={shown} onDone={() => setOpenId(null)} /> : null}
          </BottomSheet>
        </>
      )}
    </PageChrome>
  );
}
