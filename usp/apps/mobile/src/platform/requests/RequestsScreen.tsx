import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { getMyRequests } from '@usp/api-client';
import { useI18n } from '@usp/i18n';
import { Card, Empty, Pill, Screen, T } from '../../shared/ui';
import { useTheme } from '../../shared/theme';
import { useMeName } from '../auth/auth';

export default function RequestsScreen() {
  const { t, text } = useI18n(); const th = useTheme(); const me = useMeName();
  const q = useQuery({ queryKey: ['requests'], queryFn: getMyRequests });
  return (
    <Screen title={t('tabs.requests')} root person={me} onRefresh={q.refetch} refreshing={q.isFetching}>
      {q.isSuccess && !q.data.length ? <Empty icon="doc" title={text({ ar: 'لا طلبات بعد.', en: 'No requests yet.' })} /> : null}
      {q.data?.map((item) => (
        <Pressable key={item.id} onPress={() => router.push(`/request/${item.id}`)}>
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}><T weight="heavy" style={{ flexShrink: 1 }}>{text(item.serviceName)}</T><Pill status={item.status} /></View>
            <T size={13} color={th.fg2}>{item.id}</T>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}
