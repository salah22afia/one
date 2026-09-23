import { Text, View } from 'react-native';
import { Link, type Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ApiError, getProfile } from '@usp/api-client';
import { useI18n } from '@usp/i18n';
import { modules } from '../../registry';
import { useAuth, useMeName } from '../auth/auth';
import { Button, Card, Screen, colors } from '../../shared/ui';

/** "Me": the employee's data read live from SAP (never stored), the screens modules contribute, and sign-out. */
export default function MeScreen() {
  const { t, text } = useI18n();
  const { signOut } = useAuth(); const me = useMeName();
  const q = useQuery({ queryKey: ['profile'], queryFn: getProfile, staleTime: 0, gcTime: 0 });
  const screens = modules.flatMap((m) => m.screens).filter((s) => !s.serviceId);
  const row = (label: string, value: string) => (
    <View key={label}><Text style={{ color: colors.mute, fontSize: 12 }}>{label}</Text><Text style={{ fontWeight: '700' }}>{value || '—'}</Text></View>
  );
  return (
    <Screen title={t('tabs.me')} root person={me}>
      <Card>
        {q.isError ? <Text style={{ color: colors.danger }}>{text((q.error as ApiError).title ?? { ar: 'تعذّر قراءة البيانات', en: 'Could not load your data' })}</Text> : null}
        {q.data ? [
          row(t('common.employeeNo'), q.data.employeeNo),
          row(t('common.arabicName'), q.data.name.ar ?? ''),
          row(t('common.englishName'), q.data.name.en ?? ''),
          row(t('common.dateOfBirth'), q.data.dateOfBirth ?? ''),
        ] : null}
        <Text style={{ color: colors.mute, fontSize: 12 }}>{t('common.liveFromSap')}</Text>
      </Card>
      {screens.map((s) => <Link key={s.href} href={s.href as Href}>{text(s.name)}</Link>)}
      <Button kind="danger" title={t('common.signOut')} onPress={() => { void signOut(); }} />
    </Screen>
  );
}
