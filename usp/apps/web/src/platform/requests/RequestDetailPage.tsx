/* The request page (prototype screens/Requests.tsx RequestPage, C-UX-85): a status card first (status, stage n of m,
   who has it since when, expected), then the documents, what was submitted, the events and the full route, and the
   requester's actions (resubmit a returned request, withdraw one nobody has decided on yet). */
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, isStale, withdrawRequest, type DocumentView, type RequestDetail } from '@usp/api-client';
import { useI18n } from '@usp/i18n';
import {
  AnimatePresence, Avatar, BottomSheet, Empty, Group, I, Nb, PageChrome, Pill, Ring, SPRING, Seal, motion, shortName, useIntroSkip, useIsland, useNow, useUI,
} from '@usp/ui-web';
import { useSession } from '../../app/session';
import { DocumentViewer } from '../documents/DocumentViewer';
import { RouteRail, Stepper, progressOf, useExpected, useStepWho } from './parts';
import { useRequest } from './queries';

const HERO_TONE: Record<string, string> = { returned: 'warn', rejected: 'muted', withdrawn: 'muted', completed: 'done', in_review: 'live' };
const RING_COLOR: Record<string, string> = { warn: 'var(--gold)', muted: 'var(--fg-4)', done: 'var(--green)', live: 'var(--green)' };

export default function RequestDetailPage() {
  const { id = '' } = useParams();
  const { t } = useI18n();
  const q = useRequest(id);
  if (q.isPending) return null;
  if (q.isError) {
    const gone = q.error instanceof ApiError && (q.error.status === 404 || q.error.status === 403);
    return (
      <PageChrome title={t('requests.title')} back="/requests">
        <div className="lb-empty"><Empty icon="doc" title={gone ? t('requests.notFound') : t('documents.unavailable')} sub={gone ? t('requests.notFoundSub') : undefined} /></div>
      </PageChrome>
    );
  }
  return <RequestView d={q.data} />;
}

function RequestView({ d }: { d: RequestDetail }) {
  const { t, text, date, ago } = useI18n(); const now = useNow(); const { desk } = useUI(); const reduce = useIntroSkip(); const session = useSession();
  const navigate = useNavigate(); const who = useStepWho(); const expected = useExpected();
  const [doc, setDoc] = useState<DocumentView | null>(null); const [allEvents, setAllEvents] = useState(false); const [route, setRoute] = useState(false);
  const r = d.request; const status = r.status;
  const { steps, cur, idx, doneN } = progressOf(d.steps, status);
  const mine = session?.personId === r.requester.id;
  const heroTone = HERO_TONE[status] ?? 'live';
  const holderPerson = cur?.status === 'current' && cur.assignees.length === 1 ? cur.assignees[0] : undefined;
  const holder = cur?.status === 'current' ? (holderPerson ? shortName(text(holderPerson.name)) : who(cur)) : '';
  const exp = cur?.status === 'current' ? expected(cur.dueAt, now) : '';
  const returnedNote = d.steps.find((s) => s.status === 'returned')?.note;
  const events = d.audit.slice().reverse(); const shownEvents = allEvents ? events : events.slice(0, 2);
  const valued = d.fields.filter((f) => f.value !== undefined && f.value !== null && f.value !== '');
  const docsText = d.documents.length === 1 ? t('requests.docOne') : t('requests.docN', { n: d.documents.length });
  return (
    <PageChrome title={text(r.serviceName)} sub={`${t('requests.number')} ${r.id}`} back="/requests">
      <motion.section className={`rqh ${heroTone}`} initial={reduce ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={SPRING.soft} aria-label={t(`requests.hero.${status}`)}>
        <div className="rqh-top">
          <span className="rqh-ring">
            <Ring value={status === 'completed' ? steps.length : doneN} max={Math.max(1, steps.length)} size={58} stroke={6} color={RING_COLOR[heroTone]} track="var(--bg-inset-2)">
              <b className="num">{status === 'completed' ? <I.check /> : `${doneN}/${steps.length}`}</b>
            </Ring>
          </span>
          <span className="rqh-txt">
            <b>{t(`requests.hero.${status}`)}</b>
            <span>{status === 'in_review' && cur ? <>{t('requests.stageOf', { n: idx + 1, m: steps.length })} · {text(cur.title)}</>
              : status === 'returned' ? (returnedNote || t('status.returned'))
              : status === 'completed' ? `${date(r.updatedAt, { day: 'numeric', month: 'long' })}${d.documents.length ? ` · ${docsText}` : ''}`
              : date(r.updatedAt, { day: 'numeric', month: 'long' })}</span>
            {status === 'in_review' && holder ? (
              <span className="rqh-who">
                <Avatar name={holderPerson ? text(holderPerson.name) : undefined} size="sm" />
                <span>{t('requests.atWho', { who: holder })} · {ago(cur?.startedAt ?? r.createdAt, now)}{exp ? <> · <em className={exp === t('requests.late') ? 'late' : ''}>{exp}</em></> : null}</span>
              </span>
            ) : null}
          </span>
        </div>
        <Stepper steps={d.steps} status={status} />
        {d.canResubmit ? <motion.button type="button" className="btn primary block lg rqh-cta" whileTap={{ scale: 0.97 }} onClick={() => navigate(`/requests/${r.id}/resubmit`)}><I.ret />{t('requests.resubmit')}</motion.button> : null}
      </motion.section>

      <div className={desk ? 'rq-cols' : ''}>
        <div>
          {d.documents.length > 0 && (
            <section className="lb-sec-list">
              <div className="lb-head"><h2>{t('requests.documents')}</h2></div>
              {d.documents.map((x, i) => <Seal key={x.id} title={text(x.title)} number={x.number} onOpen={() => setDoc(x)} delay={0.15 + i * 0.1} />)}
            </section>
          )}
          <section className="lb-sec-list">
            <div className="lb-head"><h2>{t('requests.submitted')}</h2>{!mine ? <span className="lb-muted">{t('requests.requester')}: {text(r.requester.name)}</span> : null}</div>
            {valued.length > 0 ? (
              <Group>
                {valued.map((f) => (
                  <div key={f.key} className="summary-row">
                    <span className="k">{text(f.label)}</span>
                    <span className="v">{f.type === 'attachment' ? <Pill icon="clip">{text(f.display)}</Pill> : text(f.display)}</span>
                  </div>
                ))}
              </Group>
            ) : null}
          </section>
        </div>
        <div>
          <section className="lb-sec-list">
            <div className="lb-head"><h2>{t('requests.events')}</h2><span className="lb-count num">{events.length}</span></div>
            <div className="ev-list">
              {shownEvents.map((a, i) => (
                <div key={i} className="ev">
                  {a.actor ? <Avatar name={text(a.actor.name)} /> : <span className="cell-lead plain"><I.gear /></span>}
                  <span className="ev-txt"><b><Nb s={text(a.what)} /></b><span>{a.actor ? text(a.actor.name) : t('requests.system')} · {date(a.at, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></span>
                </div>
              ))}
            </div>
            {events.length > 2 ? <button type="button" className="lb-link" onClick={() => setAllEvents((v) => !v)}>{allEvents ? t('requests.showLess') : t('requests.showAll', { n: events.length })}</button> : null}
            <button type="button" className="lb-link" onClick={() => setRoute((v) => !v)}>{t('requests.route')}<I.chevDown className={`lb-chev ${route ? 'up' : ''}`} /></button>
            <AnimatePresence initial={false}>
              {route ? (
                <motion.div key="route" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }} style={{ overflow: 'hidden' }}>
                  <Group><div style={{ padding: '10px 14px 12px' }}><RouteRail steps={d.steps} now={now} /></div></Group>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </section>
          <section className="lb-sec-list rq-actions"><RequestActions d={d} /></section>
        </div>
      </div>

      <BottomSheet open={!!doc} onClose={() => setDoc(null)} title={doc ? text(doc.title) : ''} tall className="reader">
        <div className="lb-doc">{doc ? <DocumentViewer id={doc.id} name={doc.number} /> : null}</div>
      </BottomSheet>
    </PageChrome>
  );
}

/** What the requester can do on the request now: withdraw it while nobody else has decided (the service's rule). */
function RequestActions({ d }: { d: RequestDetail }) {
  const { t, text } = useI18n(); const island = useIsland(); const qc = useQueryClient();
  const r = d.request;
  const withdraw = useMutation({
    mutationFn: () => withdrawRequest(r.id, r.version),
    onSuccess: (next) => {
      qc.setQueryData(['request', r.id], next);
      void qc.invalidateQueries({ queryKey: ['requests'] });
      island({ title: t('requests.withdrawn'), sub: `${text(r.serviceName)} · ${r.id}`, icon: 'x', tone: 'warn' });
    },
    onError: (e) => {
      if (isStale(e)) { island({ title: t('requests.stale'), icon: 'reset', tone: 'info' }); void qc.invalidateQueries({ queryKey: ['request', r.id] }); }
    },
  });
  if (!d.canWithdraw) return null;
  return (
    <div style={{ marginTop: 16 }}>
      <motion.button type="button" className="btn secondary block" disabled={withdraw.isPending} whileTap={{ scale: 0.97 }} onClick={() => withdraw.mutate()}><I.x />{t('requests.withdraw')}</motion.button>
    </div>
  );
}
