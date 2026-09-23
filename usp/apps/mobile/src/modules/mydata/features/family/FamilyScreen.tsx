/* My family on the phone (prototype screens/Me.tsx Family): each member, their relation and their document's time left. */
import { router, type Href } from 'expo-router';
import { ApiError, daysUntil } from '@usp/api-client';
import { useI18n } from '@usp/i18n';
import { Cell, Group, useNow } from '../../../../shared/kit';
import { Button, Empty, Pill, Screen } from '../../../../shared/ui';
import { useMyFamily } from './queries';

export default function FamilyScreen() {
  const { t, text, plural } = useI18n(); const now = useNow(); const q = useMyFamily(); const members = q.data ?? [];
  const docPill = (iso: string) => {
    const n = daysUntil(iso, now);
    return n < 0 ? <Pill tone="danger">{t('me.expired')}</Pill> : n <= 30 ? <Pill tone={n <= 15 ? 'danger' : 'warn'} icon="alert">{plural('me.daysLeft', n)}</Pill> : <Pill tone="done">{t('me.valid')}</Pill>;
  };
  return (
    <Screen title={t('me.family')} back onRefresh={() => void q.refetch()} refreshing={q.isRefetching}
      end={<Button kind="soft" small icon="plus" title={t('me.addDependant')} onPress={() => router.push('/domain/MD' as Href)} />}>
      {q.isError ? <Empty icon="family" title={q.error instanceof ApiError && q.error.title ? text(q.error.title) : t('me.unavailable')} />
        : !q.data ? null
        : members.length ? <Group>{members.map((m, i) => <Cell key={m.id} first={i === 0} icon="family" title={text(m.name)} sub={text(m.relation)} pill={m.documentExpiresOn ? docPill(m.documentExpiresOn) : undefined} />)}</Group>
        : <Empty icon="family" title={t('me.noFamily')} />}
    </Screen>
  );
}
