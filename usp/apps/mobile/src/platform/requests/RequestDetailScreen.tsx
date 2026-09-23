/* The request page on the phone (prototype RequestPage, C-UX-85): the status card first (status, stage n of m, who has
   it since when, expected, the stepper), then documents, what was submitted, the events and the full route, and the
   requester's actions (complete and resubmit, withdraw). */
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, isStale, requestProgress, withdrawRequest, type RequestDetail } from '@usp/api-client';
import { useI18n } from '@usp/i18n';
import { Group, Head, Ring, SummaryRow, useIsland, useNow } from '../../shared/kit';
import { I } from '../../shared/icons';
import { radius, type, useTheme } from '../../shared/theme';
import { Avatar, Button, Empty, Pill, Screen, T } from '../../shared/ui';
import { useAuth } from '../auth/auth';
import { RouteRail, Stepper, useExpected, useStepWho } from './parts';
import { useRequest } from './queries';

export default function RequestDetailScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const { t } = useI18n();
  const q = useRequest(id);
  if (q.isPending) return null;
  if (q.isError) {
    const gone = q.error instanceof ApiError && (q.error.status === 404 || q.error.status === 403);
    return <Screen title={t('requests.title')} back><Empty icon="doc" title={gone ? t('requests.notFound') : t('documents.unavailable')} sub={gone ? t('requests.notFoundSub') : undefined} /></Screen>;
  }
  return <RequestView d={q.data} onRefresh={() => void q.refetch()} refreshing={q.isRefetching} />;
}

function RequestView({ d, onRefresh, refreshing }: { d: RequestDetail; onRefresh: () => void; refreshing: boolean }) {
  const th = useTheme(); const { t, text, date, ago } = useI18n(); const now = useNow(); const who = useStepWho(); const expected = useExpected();
  const { state } = useAuth();
  const [allEvents, setAllEvents] = useState(false); const [route, setRoute] = useState(false);
  const r = d.request; const status = r.status;
  const { steps, cur, idx, doneN } = requestProgress(d.steps, status);
  const mine = state.status === 'signedIn' && state.session.personId === r.requester.id;
  const tone = status === 'returned' ? 'warn' : status === 'rejected' || status === 'withdrawn' ? 'muted' : status === 'completed' ? 'done' : 'live';
  const ring = tone === 'warn' ? th.gold : tone === 'muted' ? th.fg4 : th.ok;
  const wash = tone === 'warn' ? th.goldSoft : tone === 'done' ? th.okSoft : tone === 'muted' ? 'transparent' : th.tintSoft;
  const holderPerson = cur?.status === 'current' && cur.assignees.length === 1 ? cur.assignees[0] : undefined;
  const holder = cur?.status === 'current' ? (holderPerson ? text(holderPerson.name) : who(cur)) : '';
  const exp = cur?.status === 'current' ? expected(cur.dueAt, now) : '';
  const returnedNote = d.steps.find((s) => s.status === 'returned')?.note;
  const events = d.audit.slice().reverse(); const shownEvents = allEvents ? events : events.slice(0, 2);
  const valued = d.fields.filter((f) => f.value !== undefined && f.value !== null && f.value !== '');
  const docsText = d.documents.length === 1 ? t('requests.docOne') : t('requests.docN', { n: d.documents.length });
  return (
    <Screen title={text(r.serviceName)} sub={`${t('requests.number')} ${r.id}`} back onRefresh={onRefresh} refreshing={refreshing}>
      <View style={{ backgroundColor: th.bgElev, borderRadius: radius.card, padding: 16, overflow: 'hidden', shadowColor: '#16201b', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 2 }}>
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: wash, opacity: 0.6 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Ring value={status === 'completed' ? steps.length : doneN} max={Math.max(1, steps.length)} color={ring} track={th.bgInset2}>
            {status === 'completed' ? <I.check size={20} color={th.ok} strokeWidth={2.4} /> : <T weight="heavy" size={type.foot}>{`${doneN}/${steps.length}`}</T>}
          </Ring>
          <View style={{ flex: 1, gap: 2 }}>
            <T weight="heavy" size={type.title2}>{t(`requests.hero.${status}`)}</T>
            <T size={type.foot} color={th.fg2}>{status === 'in_review' && cur ? `${t('requests.stageOf', { n: idx + 1, m: steps.length })} · ${text(cur.title)}`
              : status === 'returned' ? (returnedNote || t('status.returned'))
              : status === 'completed' ? `${date(r.updatedAt, { day: 'numeric', month: 'long' })}${d.documents.length ? ` · ${docsText}` : ''}`
              : date(r.updatedAt, { day: 'numeric', month: 'long' })}</T>
            {status === 'in_review' && holder ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <Avatar name={holderPerson ? text(holderPerson.name) : undefined} size={24} />
                <T size={type.foot} color={th.fg2} style={{ flex: 1 }}>{t('requests.atWho', { who: holder })} · {ago(cur?.startedAt ?? r.createdAt, now)}{exp ? <T size={type.foot} weight="bold" color={exp === t('requests.late') ? th.danger : th.tint}> · {exp}</T> : null}</T>
              </View>
            ) : null}
          </View>
        </View>
        <Stepper steps={d.steps} status={status} />
        {d.canResubmit ? <View style={{ marginTop: 14 }}><Button icon="ret" title={t('requests.resubmit')} onPress={() => router.push(`/resubmit/${r.id}`)} /></View> : null}
      </View>

      {d.documents.length ? (
        <>
          <Head title={t('requests.documents')} />
          {d.documents.map((x) => (
            <Group key={x.id} pad>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: th.goldSoft, alignItems: 'center', justifyContent: 'center' }}><I.seal size={22} color={th.gold} /></View>
                <View style={{ flex: 1 }}><T weight="heavy">{text(x.title)}</T><T size={type.foot} color={th.fg2}>{x.number} · {x.verifyCode}</T></View>
              </View>
            </Group>
          ))}
        </>
      ) : null}

      <Head title={t('requests.submitted')} action={!mine ? <T size={type.foot} color={th.fg3}>{t('requests.requester')}: {text(r.requester.name)}</T> : undefined} />
      {valued.length ? (
        <Group>
          {valued.map((f, i) => <SummaryRow key={f.key} k={text(f.label)} v={f.type === 'attachment' ? <Pill icon="clip">{text(f.display)}</Pill> : text(f.display)} last={i === valued.length - 1} />)}
        </Group>
      ) : null}

      <Head title={t('requests.events')} count={events.length} />
      <View style={{ gap: 10 }}>
        {shownEvents.map((a, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            {a.actor ? <Avatar name={text(a.actor.name)} size={36} /> : <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: th.bgInset, alignItems: 'center', justifyContent: 'center' }}><I.gear size={18} color={th.fg2} /></View>}
            <View style={{ flex: 1 }}>
              <T weight="bold" size={type.sub}>{text(a.what)}</T>
              <T size={type.cap} color={th.fg3}>{a.actor ? text(a.actor.name) : t('requests.system')} · {date(a.at, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</T>
            </View>
          </View>
        ))}
      </View>
      {events.length > 2 ? <Button kind="plain" title={allEvents ? t('requests.showLess') : t('requests.showAll', { n: events.length })} onPress={() => setAllEvents((v) => !v)} /> : null}
      <Pressable onPress={() => setRoute((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 }} accessibilityRole="button">
        <T weight="heavy" color={th.tint}>{t('requests.route')}</T>
        <View style={{ transform: [{ rotate: route ? '180deg' : '0deg' }] }}><I.chevDown size={16} color={th.tint} /></View>
      </Pressable>
      {route ? <Group pad><RouteRail steps={d.steps} now={now} /></Group> : null}
      <Withdraw d={d} />
    </Screen>
  );
}

function Withdraw({ d }: { d: RequestDetail }) {
  const { t, text } = useI18n(); const island = useIsland(); const qc = useQueryClient();
  const r = d.request;
  const m = useMutation({
    mutationFn: () => withdrawRequest(r.id, r.version),
    onSuccess: (next) => {
      qc.setQueryData(['request', r.id], next);
      void qc.invalidateQueries({ queryKey: ['requests'] });
      island({ title: t('requests.withdrawn'), sub: `${text(r.serviceName)} · ${r.id}`, icon: 'x', tone: 'warn' });
    },
    onError: (e) => { if (isStale(e)) { island({ title: t('requests.stale'), icon: 'reset', tone: 'info' }); void qc.invalidateQueries({ queryKey: ['request', r.id] }); } },
  });
  if (!d.canWithdraw) return null;
  return <View style={{ marginTop: 16 }}><Button kind="secondary" icon="x" title={t('requests.withdraw')} disabled={m.isPending} onPress={() => m.mutate()} /></View>;
}
