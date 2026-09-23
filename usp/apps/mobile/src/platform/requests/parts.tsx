/* The request building blocks on mobile, as on the web (screens/Requests.tsx, ui/components.tsx Rail): service icon,
   "expected in", who is at a step, the stepper and the route rail. */
import { View } from 'react-native';
import { requestProgress, type RequestStatus, type StepDetail } from '@usp/api-client';
import { useI18n } from '@usp/i18n';
import { I, type IconName } from '../../shared/icons';
import { type, useTheme } from '../../shared/theme';
import { T } from '../../shared/ui';

export function serviceIcon(name: string | null | undefined): IconName {
  return name && name in I ? (name as IconName) : 'doc';
}

export function useExpected() {
  const { t, duration } = useI18n();
  return (dueAt: string | null | undefined, now: number) => {
    if (!dueAt) return '';
    const due = Date.parse(dueAt);
    return due < now ? t('requests.late') : t('requests.expected', { t: duration(due - now) });
  };
}

export function useStepWho() {
  const { t, text, lang } = useI18n();
  return (s: StepDetail) => {
    if (s.mode === 'system') return t('requests.system');
    if ((s.status === 'done' || s.status === 'returned' || s.status === 'rejected') && s.actor) return text(s.actor.name);
    return s.assignees.map((p) => text(p.name)).join(lang === 'ar' ? '، ' : ', ');
  };
}

/** Dots on a line, then "Then: …" (the prototype's stepper on a phone: no titles under the dots). */
export function Stepper({ steps: all, status }: { steps: StepDetail[]; status: RequestStatus }) {
  const th = useTheme(); const { t, text } = useI18n();
  const { steps, idx } = requestProgress(all, status);
  const next = status === 'in_review' ? steps[idx + 1] : undefined;
  const caption = status === 'in_review' ? (next ? `${t('requests.after')}: ${text(next.title)}` : t('requests.lastStage')) : status === 'completed' ? t('requests.allDone') : '';
  return (
    <View style={{ gap: 10, marginTop: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {steps.map((s, i) => {
          const bg = s.status === 'done' ? th.ok : s.status === 'returned' ? th.warn : s.status === 'rejected' ? th.danger : i === idx && status !== 'completed' ? th.gold : th.bgInset2;
          const Ic = s.status === 'done' ? I.check : s.status === 'returned' ? I.ret : s.status === 'rejected' ? I.x : null;
          return (
            <View key={s.key} style={{ flex: 1, alignItems: 'center' }}>
              {i > 0 ? <View style={{ position: 'absolute', top: 10, height: 2, left: 0, right: '50%', backgroundColor: i <= idx ? th.ok : th.bgInset2 }} /> : null}
              {i < steps.length - 1 ? <View style={{ position: 'absolute', top: 10, height: 2, left: '50%', right: 0, backgroundColor: i < idx ? th.ok : th.bgInset2 }} /> : null}
              <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>{Ic ? <Ic size={13} color="#fff" strokeWidth={2.6} /> : null}</View>
            </View>
          );
        })}
      </View>
      {caption ? <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>{status === 'in_review' && next ? <I.chev size={14} color={th.fg3} /> : <I.check size={14} color={th.ok} />}<T size={type.foot} color={th.fg2}>{caption}</T></View> : null}
    </View>
  );
}

/** The full route: each step, who is or was there, since when, why, and the decider's note. */
export function RouteRail({ steps, now }: { steps: StepDetail[]; now: number }) {
  const th = useTheme(); const { t, text, ago, duration } = useI18n(); const who = useStepWho();
  return (
    <View style={{ gap: 0 }}>
      {steps.map((s, i) => {
        const w = who(s);
        let sub = '';
        if (s.status === 'done') sub = [w, s.completedAt ? ago(s.completedAt, now) : '', s.ref ?? ''].filter(Boolean).join(' · ');
        else if (s.status === 'current') sub = `${[w, s.shared ? t('inbox.quorumAny') : ''].filter(Boolean).join(' · ')}${s.startedAt ? ` · ${t('requests.elapsed')} ${duration(now - Date.parse(s.startedAt))}` : ''}`;
        else if (s.status === 'returned' || s.status === 'rejected') sub = [w, s.completedAt ? ago(s.completedAt, now) : ''].filter(Boolean).join(' · ');
        else if (s.status === 'skipped') sub = t('status.skipped');
        else sub = w;
        const [bg, fg] = s.status === 'done' ? [th.okSoft, th.ok] : s.status === 'current' ? [th.tint, th.tintFg] : s.status === 'returned' ? [th.warnSoft, th.warn] : s.status === 'rejected' ? [th.dangerSoft, th.danger] : [th.bgInset, th.fg3];
        const Ic = s.status === 'done' ? I.check : s.status === 'returned' ? I.ret : s.status === 'rejected' ? I.x : s.status === 'current' ? I.clock : I.dot;
        return (
          <View key={s.key} style={{ flexDirection: 'row', gap: 12, paddingBottom: i < steps.length - 1 ? 16 : 0 }}>
            {i < steps.length - 1 ? <View style={{ position: 'absolute', top: 30, bottom: -2, start: 13.5, width: 3, borderRadius: 2, backgroundColor: th.rail }} /> : null}
            <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}><Ic size={15} color={fg} strokeWidth={2.2} /></View>
            <View style={{ flex: 1, gap: 2 }}>
              <T weight="bold" size={type.callout}>{text(s.title)}</T>
              {sub ? <T size={type.foot} color={th.fg2}>{sub}</T> : null}
              {s.why && s.status !== 'done' && s.status !== 'skipped' ? <T size={type.cap} color={th.fg3}>{text(s.why)}</T> : null}
              {s.note ? <View style={{ marginTop: 6, backgroundColor: th.warnSoft, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12 }}><T size={type.foot}>{s.note}</T></View> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
