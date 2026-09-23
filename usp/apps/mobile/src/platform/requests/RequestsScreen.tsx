/* "My requests" on the phone (prototype screens/Requests.tsx): returned requests first with their action, then those
   in review — each row says where it is, who has it since when and what is expected; finished ones on the other tab. */
import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { requestProgress, type RequestRow } from '@usp/api-client';
import { useI18n } from '@usp/i18n';
import { Head, ProgressDots, Segmented, Tile, useNow } from '../../shared/kit';
import { I } from '../../shared/icons';
import { type, useTheme } from '../../shared/theme';
import { Button, Empty, Pill, Screen, T } from '../../shared/ui';
import { useMeName } from '../auth/auth';
import { serviceIcon, useExpected } from './parts';
import { useMyRequests } from './queries';

function short(name: string) {
  const w = name.split(/\s+/).filter((x) => x && !['بن', 'بنت', 'bin', 'bint'].includes(x.toLowerCase()));
  return w.length > 2 ? `${w[0]} ${w[w.length - 1]}` : w.join(' ');
}

export function ReqRow({ r }: { r: RequestRow }) {
  const th = useTheme(); const { t, text, date, ago } = useI18n(); const now = useNow(); const expected = useExpected();
  const { doneN, steps } = requestProgress(r.steps, r.status);
  const w = r.waiting;
  const who = w?.holder ? short(text(w.holder.name)) : w?.who ? text(w.who) : '';
  let sub: ReactNode; let trail: ReactNode = <I.chev size={16} color={th.fg4} />;
  if (r.status === 'returned') {
    sub = `${t('status.returned')}${w?.note ? ` · ${w.note}` : ''}`;
    trail = <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}><T weight="heavy" size={type.foot} color={th.tint}>{t('requests.finish')}</T><I.chev size={14} color={th.tint} /></View>;
  } else if (r.status === 'in_review') {
    const exp = expected(w?.dueAt, now);
    sub = <>{t('requests.atWho', { who })} · {w ? text(w.title) : ''} · {ago(w?.since ?? r.createdAt, now)}{exp ? <T size={type.foot} weight="bold" color={exp === t('requests.late') ? th.danger : th.tint}> · {exp}</T> : null}</>;
  } else {
    sub = `${t(`status.${r.status}`)} · ${date(r.updatedAt, { day: 'numeric', month: 'long' })}${r.documents ? ` · ${t('requests.documents')}` : ''}`;
    trail = <Pill status={r.status} />;
  }
  return (
    <Pressable onPress={() => router.push(`/request/${r.id}`)} accessibilityRole="button"
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: th.bgElev, borderRadius: 20, borderWidth: r.status === 'returned' ? 1.5 : 0, borderColor: th.gold, transform: [{ scale: pressed ? 0.985 : 1 }], shadowColor: '#16201b', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1 })}>
      <Tile icon={serviceIcon(r.icon)} tone={r.status === 'returned' ? 'gold' : r.status === 'completed' ? 'sage' : 'green'} />
      <View style={{ flex: 1, gap: 3 }}>
        <T weight="heavy" size={type.callout}>{text(r.serviceName)}</T>
        <T size={type.foot} color={th.fg2} style={{ lineHeight: 19 }}>{sub}</T>
        {r.status === 'in_review' || r.status === 'returned' ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 }}><ProgressDots steps={r.steps} status={r.status} /><T weight="bold" size={11} color={th.fg3}>{doneN}/{steps.length}</T></View> : null}
      </View>
      {trail}
    </Pressable>
  );
}

export default function RequestsScreen() {
  const { t } = useI18n(); const me = useMeName();
  const [tab, setTab] = useState<'ongoing' | 'finished'>('ongoing');
  const q = useMyRequests(tab);
  const counts = q.data?.pages[0]?.counts;
  const rows = q.data?.pages.flatMap((p) => p.items) ?? [];
  const returned = rows.filter((r) => r.status === 'returned'); const ongoing = rows.filter((r) => r.status === 'in_review');
  const more = q.hasNextPage ? <Button kind="plain" title={t('requests.more')} disabled={q.isFetchingNextPage} onPress={() => void q.fetchNextPage()} /> : null;
  return (
    <Screen title={t('requests.title')} root person={me} onRefresh={() => void q.refetch()} refreshing={q.isRefetching}
      end={<Button kind="soft" small icon="plus" title={t('requests.new')} onPress={() => router.push('/services')} />}>
      <Segmented value={tab} onChange={setTab} options={[{ v: 'ongoing', label: t('requests.ongoing'), n: counts?.ongoing }, { v: 'finished', label: t('requests.finished'), n: counts?.finished }]} />
      {q.isPending ? null : tab === 'ongoing' ? (
        returned.length + ongoing.length === 0 ? <Empty icon="doc" title={t('requests.none')} sub={t('requests.noneSub')} /> : (
          <>
            {returned.length ? <><Head title={t('requests.needsYou')} />{returned.map((r) => <ReqRow key={r.id} r={r} />)}</> : null}
            {ongoing.length ? <><Head title={t('requests.ongoing')} />{ongoing.map((r) => <ReqRow key={r.id} r={r} />)}</> : null}
            {more}
          </>
        )
      ) : rows.length === 0 ? <Empty icon="check" title={t('requests.none')} /> : <>{rows.map((r) => <ReqRow key={r.id} r={r} />)}{more}</>}
    </Screen>
  );
}
