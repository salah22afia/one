/* Building blocks of "My requests", the request page and Tasks, ported from the prototype (screens/Requests.tsx,
   ui/components.tsx Rail): progress dots, the stepper, the route rail and the "who has it" texts. */
import type React from 'react';
import { requestProgress, type RequestStatus, type StepDetail, type StepStatus } from '@usp/api-client';
import { useI18n } from '@usp/i18n';
import { I, SPRING, motion, useReducedMotion, type IconName } from '@usp/ui-web';

/** The service's icon (configured per service), else the generic document. */
export function serviceIcon(name: string | null | undefined) {
  return name && name in I ? I[name as IconName] : I.doc;
}

type Stepish = { status: StepStatus };

/** Steps that apply (not skipped) and where the request stands among them (shared with mobile). */
export const progressOf = requestProgress;

export function ProgressDots({ steps: all, status, size = 'sm' }: { steps: Stepish[]; status: RequestStatus; size?: 'sm' | 'lg' }) {
  const { steps, idx } = progressOf(all, status);
  return (
    <span className={`pd ${size}`} aria-hidden="true">
      {steps.map((s, i) => <i key={i} className={s.status === 'done' ? 'on' : s.status === 'returned' ? 'ret' : i === idx && status !== 'completed' ? 'cur' : ''} />)}
    </span>
  );
}

/** "expected in 5 h" / "past the deadline" for the step the request waits on (empty without a deadline). */
export function useExpected() {
  const { t, duration } = useI18n();
  return (dueAt: string | null | undefined, now: number) => {
    if (!dueAt) return '';
    const due = Date.parse(dueAt);
    return due < now ? t('requests.late') : t('requests.expected', { t: duration(due - now) });
  };
}

/** Dots on a line (the prototype's stepper): titles on wide screens for up to five steps; "Then: …" under it. */
export function Stepper({ steps: all, status }: { steps: StepDetail[]; status: RequestStatus }) {
  const { t, text } = useI18n();
  const { steps, idx } = progressOf(all, status);
  const many = steps.length > 8; const labels = steps.length <= 5;
  const next = status === 'in_review' ? steps[idx + 1] : undefined;
  const caption = status === 'in_review'
    ? (next ? <><I.chev className="dirchev" /><span>{t('requests.after')}: <b>{text(next.title)}</b></span></> : <><I.check /><span>{t('requests.lastStage')}</span></>)
    : status === 'completed' ? <><I.check /><span>{t('requests.allDone')}</span></> : null;
  return (
    <>
      <ol className={`stp ${many ? 'many' : ''} ${labels ? 'labels' : ''}`} aria-label="progress">
        {steps.map((s, i) => {
          const cls = s.status === 'done' ? 'done' : s.status === 'returned' ? 'ret' : s.status === 'rejected' ? 'rej' : i === idx && status !== 'completed' ? 'cur' : '';
          return (
            <li key={s.key} className={cls} title={text(s.title)}>
              <span className="stp-dot">{s.status === 'done' ? <I.check /> : s.status === 'returned' ? <I.ret /> : s.status === 'rejected' ? <I.x /> : null}</span>
              <span className="stp-t">{text(s.title)}</span>
            </li>
          );
        })}
      </ol>
      {caption ? <div className="stp-next">{caption}</div> : null}
    </>
  );
}

/** Who stands at a step: the system, the one who decided it, or whoever holds it now. */
export function useStepWho() {
  const { t, text, lang } = useI18n();
  return (s: StepDetail) => {
    if (s.mode === 'system') return t('requests.system');
    if ((s.status === 'done' || s.status === 'returned' || s.status === 'rejected') && s.actor) return text(s.actor.name);
    return s.assignees.map((p) => text(p.name)).join(lang === 'ar' ? '، ' : ', ');
  };
}

/** The full route (the prototype's Rail): each step, who is or was there, since when, why, and the decider's note. */
export function RouteRail({ steps, now, animated = true }: { steps: StepDetail[]; now: number; animated?: boolean }) {
  const { t, text, lang, ago, duration } = useI18n(); const reduce = useReducedMotion(); const who = useStepWho();
  const anim = animated && !reduce;
  return (
    <ol className="rail">
      {steps.map((s, i) => {
        const cls = s.status === 'done' ? 'done' : s.status === 'current' ? 'current' : s.status === 'returned' ? 'returned' : s.status === 'rejected' ? 'rejected' : '';
        const w = who(s);
        let sub = '';
        if (s.status === 'done') sub = [w, s.completedAt ? ago(s.completedAt, now) : '', s.ref ?? ''].filter(Boolean).join(' · ');
        else if (s.status === 'current') sub = `${[w, s.shared ? t('inbox.quorumAny') : ''].filter(Boolean).join(' · ')} · ${t('requests.elapsed')} ${duration(now - Date.parse(s.startedAt ?? new Date(now).toISOString()))}`;
        else if (s.status === 'returned' || s.status === 'rejected') sub = [w, s.completedAt ? ago(s.completedAt, now) : ''].filter(Boolean).join(' · ');
        else if (s.status === 'skipped') sub = t('status.skipped');
        else sub = w;
        const Ic: React.ComponentType = s.status === 'done' ? I.check : s.status === 'returned' ? I.ret : s.status === 'rejected' ? I.x : s.status === 'current' ? I.clock : I.dot;
        const d = i * 0.07;
        return (
          <motion.li key={s.key} className={cls} initial={anim ? { opacity: 0, x: lang === 'ar' ? 10 : -10 } : false} animate={{ opacity: 1, x: 0 }} transition={{ ...SPRING.soft, delay: d }}>
            {i < steps.length - 1 ? <motion.span className="rail-line" initial={anim ? { scaleY: 0 } : false} animate={{ scaleY: 1 }} transition={{ duration: 0.32, delay: d + 0.12, ease: [0.4, 0, 0.2, 1] }} /> : null}
            <motion.span className="node" initial={anim ? { scale: 0.4 } : false} animate={{ scale: 1 }} transition={{ ...SPRING.bouncy, delay: d + 0.05 }}><Ic /></motion.span>
            <div>
              <div className="t">{text(s.title)}</div>
              <div className="s">{sub}</div>
              {s.why && s.status !== 'done' && s.status !== 'skipped' ? <div className="why">{text(s.why)}</div> : null}
              {s.note ? <div className="note">{s.note}</div> : null}
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}

/** Icons of a decision (toasts, done list). */
export const DECISION_ICON: Record<string, IconName> = { approve: 'check', done: 'check', receive: 'check', return: 'ret', reject: 'x' };
