import { Pressable, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { getModules } from '@usp/api-client';
import { useI18n } from '@usp/i18n';
import { modules } from '../../registry';
import { Card, Screen, T } from '../../shared/ui';
import { I } from '../../shared/icons';
import { useTheme } from '../../shared/theme';
import { useMeName } from '../auth/auth';

/** Catalogue grouped by module: coded services open their feature screen, configured ones the dynamic renderer. */
export default function CatalogScreen() {
  const { t, text } = useI18n(); const th = useTheme(); const me = useMeName();
  const q = useQuery({ queryKey: ['modules'], queryFn: getModules });
  const coded = (serviceId: string) => modules.flatMap((m) => m.screens).find((s) => s.serviceId === serviceId)?.href;
  return (
    <Screen title={t('tabs.services')} root person={me} onRefresh={q.refetch} refreshing={q.isFetching}>
      {q.data?.map((m) => (
        <View key={m.key} style={{ gap: 6 }}>
          <T weight="heavy" size={17}>{text(m.name)}</T>
          <Card>
            {m.features.filter((f) => f.kind === 'SERVICE' && f.serviceId).map((f) => (
              <Pressable key={f.key} onPress={() => router.push((coded(f.serviceId!) ?? `/service/${f.serviceId}`) as Href)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
                <I.grid size={20} color={th.tint} />
                <T style={{ flex: 1 }}>{text(f.name)}</T>
              </Pressable>
            ))}
          </Card>
        </View>
      ))}
    </Screen>
  );
}
