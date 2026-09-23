/* "My requests" (prototype screens/Requests.tsx, C-UX-84): each row says where the request is and what happens next
   (progress dots, who has it, since when, expected); returned requests come first with their action. Paged by the
   server; "Show more" continues the list. */
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import type { RequestRow } from '@usp/api-client';
import { useI18n } from '@usp/i18n';
import { AnimatePresence, Empty, I, PageChrome, Pill, SPRING, Segmented, motion, shortName, useIntroSkip, useNow, useUI } from '@usp/ui-web';
import { featurePath } from '../../app/links';
import { ProgressDots, progressOf, serviceIcon, useExpected } from './parts';
import { useMyRequests } from './queries';

const MotionLink = motion.create(Link);

type View = 'ongoing' | 'finished';

function ReqRow({ r, delay = 0 }: { r: RequestRow; delay?: number }) {
  const { t, text, date, ago } = useI18n(); const now = useNow(); const reduce = useIntroSkip(); const expected = useExpected();
  const { doneN, steps } = progressOf(r.steps, r.status);
  const Ic = serviceIcon(r.icon);
  const w = r.waiting;
  const who = w?.holder ? shortName(text(w.holder.name)) : w?.who ? text(w.who) : '';
  let sub: ReactNode; let pill: ReactNode = null;
  if (r.status === 'returned') {
    sub = <>{t('status.returned')}{w?.note ? ` · ${w.note}` : ''}</>;
    pill = <span className="fc-act">{t('requests.finish')}<I.chev className="dirchev" /></span>;
  } else if (r.status === 'in_review') {
    const exp = expected(w?.dueAt, now);
    sub = <>{t('requests.atWho', { who })} · {w ? text(w.title) : ''} · {ago(w?.since ?? r.createdAt, now)}{exp ? <> · <em className={exp === t('requests.late') ? 'late' : ''}>{exp}</em></> : null}</>;
  } else {
    sub = <>{t(`status.${r.status}`)} · {date(r.updatedAt, { day: 'numeric', month: 'long' })}{r.documents ? ` · ${t('requests.documents')}` : ''}</>;
    pill = r.status === 'completed' ? <Pill tone="done" icon="check">{t('status.completed')}</Pill>
      : r.status === 'rejected' ? <Pill tone="danger" icon="x">{t('status.rejected')}</Pill> : <Pill>{t(`status.${r.status}`)}</Pill>;
  }
  return (
    <MotionLink className={`rq ${r.status}`} to={`/requests/${r.id}`} initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING.soft, delay }} whileTap={{ scale: 0.985 }} role="listitem">
      <span className={`qicon ${r.status === 'returned' ? 'g-gold' : r.status === 'completed' ? 'g-sage' : 'g-green'} rq-ic`}><Ic /></span>
      <span className="rq-txt">
        <b>{text(r.serviceName)}</b>
        <span className="rq-sub">{sub}</span>
        {r.status === 'in_review' || r.status === 'returned' ? <span className="rq-prog"><ProgressDots steps={r.steps} status={r.status} /><small className="num">{doneN}/{steps.length}</small></span> : null}
      </span>
      <span className="rq-trail">{pill}{!pill ? <I.chev className="dirchev" /> : null}</span>
    </MotionLink>
  );
}

export default function RequestsPage() {
  const { t } = useI18n(); const { desk } = useUI();
  const [tab, setTab] = useState<View>('ongoing');
  const q = useMyRequests(tab);
  const counts = q.data?.pages[0]?.counts;
  const rows = q.data?.pages.flatMap((p) => p.items) ?? [];
  const returned = rows.filter((r) => r.status === 'returned'); const ongoing = rows.filter((r) => r.status === 'in_review');
  const leaveHistory = featurePath('timeleave', 'leave-history');
  const seg = <Segmented id="lb-req" value={tab} onChange={setTab} options={[{ v: 'ongoing', label: t('requests.ongoing'), n: counts?.ongoing }, { v: 'finished', label: t('requests.finished'), n: counts?.finished }]} />;
  const end = <Link className="btn soft sm" to="/services"><I.plus />{t('requests.new')}</Link>;
  const chip = leaveHistory ? <Link className="lb-link chip" to={leaveHistory}><I.calendar />{t('requests.leaveHistory')}</Link> : null;
  const more = q.hasNextPage ? <button type="button" className="lb-link" disabled={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>{t('requests.more')}</button> : null;
  return (
    <PageChrome title={t('requests.title')} root end={desk ? <>{seg}{end}</> : end}>
      {!desk ? <div className="lp-seg">{seg}{chip}</div> : <div className="lp-links">{chip}</div>}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6, transition: { duration: 0.1 } }} transition={SPRING.soft}>
          {q.isPending ? null : tab === 'ongoing' ? (
            returned.length + ongoing.length === 0 ? <div className="lb-empty"><Empty icon="doc" title={t('requests.none')} sub={t('requests.noneSub')} /></div> : (
              <>
                {returned.length > 0 && <section className="lb-sec-list"><div className="lb-head"><h2>{t('requests.needsYou')}</h2></div><div className="rq-list" role="list">{returned.map((r, i) => <ReqRow key={r.id} r={r} delay={i * 0.04} />)}</div></section>}
                {ongoing.length > 0 && <section className="lb-sec-list"><div className="lb-head"><h2>{t('requests.ongoing')}</h2></div><div className="rq-list" role="list">{ongoing.map((r, i) => <ReqRow key={r.id} r={r} delay={0.06 + i * 0.04} />)}</div></section>}
                {more}
              </>
            )
          ) : (
            rows.length === 0 ? <div className="lb-empty"><Empty icon="check" title={t('requests.none')} /></div>
              : <section className="lb-sec-list"><div className="rq-list" role="list">{rows.map((r, i) => <ReqRow key={r.id} r={r} delay={i * 0.04} />)}</div>{more}</section>
          )}
        </motion.div>
      </AnimatePresence>
    </PageChrome>
  );
}
