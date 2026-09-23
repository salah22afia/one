/* The decision sheet (prototype screens/Inbox.tsx TaskDetail): what the holder decides on a request — opened from the
   row on a phone, beside the list on a desktop. The server checks every decision again (holder, allowed decisions,
   note on return/reject, reference on fulfilment, the request version the sheet showed). */
import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, decide, isStale, type DecisionAction, type RequestDetail, type TaskItem } from '@usp/api-client';
import { useI18n } from '@usp/i18n';
import { Field, Group, I, Pill, Stagger, motion, useIsland, useNow } from '@usp/ui-web';
import { useSession } from '../../app/session';
import { RouteRail } from '../requests/parts';
import { useRequest } from '../requests/queries';
import { useDecisionDone } from './useDecisionDone';

export function TaskDetail({ task, onDone }: { task: TaskItem; onDone: () => void }) {
  const { t, text, lang, ago } = useI18n(); const now = useNow();
  const q = useRequest(task.requestId);
  const [note, setNote] = useState(''); const [ref, setRef] = useState(''); const [err, setErr] = useState(''); const [refErr, setRefErr] = useState('');
  useEffect(() => { setNote(''); setRef(''); setErr(''); setRefErr(''); }, [task.stepId]);
  const act = useDecide(task, q.data, onDone, (field, message) => (field === 'ref' ? setRefErr(message) : setErr(message)));
  const session = useSession();
  const d = q.data;
  const step = d?.steps.find((s) => s.id === task.stepId);
  const isReceipt = task.mode === 'receipt'; const isFulfil = task.mode === 'fulfil';
  const can = (a: DecisionAction) => task.decisions.includes(a);
  const shared = step ? step.assignees.filter((p) => p.id !== session?.personId) : [];
  const valued = d ? d.fields.filter((f) => f.value !== undefined && f.value !== null && f.value !== '') : [];
  const go = (action: DecisionAction) => {
    if ((action === 'return' || action === 'reject') && !note.trim()) { setErr(t('inbox.noteRequired')); return; }
    if (action === 'done' && !ref.trim()) { setRefErr(t('inbox.ref')); return; }
    act.mutate({ action, note: note.trim() || undefined, ref: action === 'done' ? ref.trim() : undefined });
  };
  return (
    <Stagger delay={0.02} step={0.04}>
      <p className="cell-sub" style={{ marginTop: -6, marginBottom: 10 }}>{text(task.requester.name)} · <span className="mono">{task.requestId}</span> · {ago(d?.request.createdAt ?? task.startedAt, now)}</p>
      {task.why || shared.length ? (
        <div className="task-why">
          {task.why ? <span><I.info /><span><b>{t('inbox.whyMe')}</b> {text(task.why)}</span></span> : null}
          {shared.length ? <span><I.team /><span><b>{t('inbox.quorumAny')}</b> · {t('inbox.sharedWith')} {shared.map((p) => text(p.name)).join(lang === 'ar' ? '، ' : ', ')}</span></span> : null}
        </div>
      ) : null}
      {valued.length ? (
        <Group>
          {valued.map((f) => <div key={f.key} className="summary-row"><span className="k">{text(f.label)}</span><span className="v">{f.type === 'attachment' ? <Pill icon="clip">{text(f.display)}</Pill> : text(f.display)}</span></div>)}
        </Group>
      ) : null}
      <div style={{ height: 10 }} />
      {d ? <Group><div style={{ padding: '10px 14px' }}><RouteRail steps={d.steps} now={now} /></div></Group> : null}
      <div style={{ height: 10 }} />
      {isFulfil ? (
        <Group>
          <Field id="fulfil-ref" label={t('inbox.ref')} error={refErr || undefined} hint={t('inbox.refHint')}>
            <input id="fulfil-ref" className="mono" dir="ltr" value={ref} maxLength={100} onChange={(e) => { setRef(e.target.value); setRefErr(''); }} />
          </Field>
          <Field id="decision-note" label={`${t('inbox.note')} (${t('inbox.optional')})`} error={err || undefined}>
            <textarea id="decision-note" rows={2} value={note} maxLength={1000} onChange={(e) => { setNote(e.target.value); setErr(''); }} />
          </Field>
        </Group>
      ) : !isReceipt ? (
        <Group>
          <Field id="decision-note" label={t('inbox.note')} error={err || undefined}>
            <textarea id="decision-note" rows={2} value={note} maxLength={1000} onChange={(e) => { setNote(e.target.value); setErr(''); }} />
          </Field>
        </Group>
      ) : null}
      <div style={{ height: 12 }} />
      {isReceipt ? (
        <motion.button type="button" className="btn primary block lg" disabled={act.isPending} onClick={() => go('receive')} whileTap={{ scale: 0.97 }}><I.check />{text(task.stepTitle)}</motion.button>
      ) : isFulfil ? (
        <>
          <motion.button type="button" className="btn primary block lg" disabled={act.isPending} onClick={() => go('done')} whileTap={{ scale: 0.97 }}><I.check />{t('inbox.fulfil')}</motion.button>
          {can('return') || can('reject') ? <DecisionRow can={can} go={go} pending={act.isPending} /> : null}
        </>
      ) : (
        <>
          {can('approve') ? <motion.button type="button" className="btn primary block lg" disabled={act.isPending} onClick={() => go('approve')} whileTap={{ scale: 0.97 }}><I.check />{t('inbox.approve')}</motion.button> : null}
          <DecisionRow can={can} go={go} pending={act.isPending} />
        </>
      )}
    </Stagger>
  );
}

function DecisionRow({ can, go, pending }: { can: (a: DecisionAction) => boolean; go: (a: DecisionAction) => void; pending: boolean }) {
  const { t } = useI18n();
  if (!can('return') && !can('reject')) return null;
  return (
    <>
      <div style={{ height: 10 }} />
      <div className="btn-row">
        {can('return') ? <motion.button type="button" className="btn secondary" disabled={pending} onClick={() => go('return')} whileTap={{ scale: 0.97 }}><I.ret />{t('inbox.return')}</motion.button> : null}
        {can('reject') ? <motion.button type="button" className="btn danger" disabled={pending} onClick={() => go('reject')} whileTap={{ scale: 0.97 }}><I.x />{t('inbox.reject')}</motion.button> : null}
      </div>
    </>
  );
}

/**
 * Sends a decision with the version of the request the holder saw; on success the island says what happened and the
 * lists refresh; a request that changed meanwhile (409) is reloaded; the server's field messages go to their field.
 */
export function useDecide(task: TaskItem, detail: RequestDetail | undefined, onDone: () => void, onFieldError?: (field: string, message: string) => void) {
  const { t, text } = useI18n(); const island = useIsland(); const qc = useQueryClient(); const done = useDecisionDone();
  return useMutation({
    mutationFn: ({ action, note, ref }: { action: DecisionAction; note?: string; ref?: string }) => decide(task.stepId, action, note, ref, detail?.request.version),
    onSuccess: (next, { action, ref }) => {
      qc.setQueryData(['request', task.requestId], next);
      done();
      try { navigator.vibrate?.(12); } catch { /* no vibration */ }
      const title = action === 'approve' ? t('inbox.approve') : action === 'return' ? t('inbox.return') : action === 'reject' ? t('inbox.reject') : action === 'done' ? t('inbox.fulfil') : text(task.stepTitle);
      island({ title, sub: `${text(task.serviceName)} · ${task.requestId}${action === 'done' && ref ? ` · ${ref}` : ''}`, icon: action === 'return' ? 'ret' : action === 'reject' ? 'x' : 'check', tone: action === 'reject' ? 'danger' : action === 'return' ? 'warn' : 'ok' });
      onDone();
    },
    onError: (e) => {
      if (isStale(e)) { island({ title: t('requests.stale'), icon: 'reset', tone: 'info' }); done(); return; }
      if (e instanceof ApiError && e.checks.length && onFieldError) { const c = e.checks[0]!; onFieldError(c.field ?? 'note', text(c.text)); return; }
      island({ title: e instanceof ApiError && e.title ? text(e.title) : t('form.failed'), icon: 'alert', tone: 'danger' });
    },
  });
}
