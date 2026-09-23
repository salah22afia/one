import { Pressable } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { getTasks } from '@usp/api-client';
import { useI18n } from '@usp/i18n';
import { Card, Empty, Screen, T } from '../../shared/ui';
import { useTheme } from '../../shared/theme';
import { useMeName } from '../auth/auth';

export default function InboxScreen() {
  const { t, text } = useI18n(); const th = useTheme(); const me = useMeName();
  const q = useQuery({ queryKey: ['tasks'], queryFn: getTasks });
  return (
    <Screen title={t('tabs.inbox')} root person={me} onRefresh={q.refetch} refreshing={q.isFetching}>
      {q.isSuccess && !q.data.length ? <Empty icon="inbox" title={text({ ar: 'لا شيء ينتظر إجراءك الآن.', en: 'Nothing is waiting for you.' })} /> : null}
      {q.data?.map((item) => (
        <Pressable key={item.stepId} onPress={() => router.push(`/request/${item.requestId}`)}>
          <Card>
            <T weight="heavy">{text(item.serviceName)} — {text(item.stepTitle)}</T>
            <T size={13} color={item.overdue ? th.danger : th.fg2}>{text(item.requester.name)} · {item.requestId}</T>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}
