/* My data on the phone (prototype screens/Me.tsx MyData): contact and bank details (masked by the server) that open the
   services to change them, then what the system of record says. */
import { View } from 'react-native';
import { router, type Href } from 'expo-router';
import { ApiError } from '@usp/api-client';
import { useI18n } from '@usp/i18n';
import { Cell, Group } from '../../../../shared/kit';
import { type, useTheme } from '../../../../shared/theme';
import { Button, Empty, Screen, T } from '../../../../shared/ui';
import { useProfile } from './queries';

export default function ProfileScreen() {
  const { t, text } = useI18n(); const th = useTheme(); const q = useProfile(); const p = q.data;
  const join = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(' · ') || '—';
  const open = (href: string) => () => router.push(href as Href);
  return (
    <Screen title={t('me.data')} sub={t('me.dataSub')} back onRefresh={() => void q.refetch()} refreshing={q.isRefetching}
      end={<Button kind="soft" small icon="pen" title={t('me.update')} onPress={open('/service/MD-01')} />}>
      {q.isError ? <Empty icon="person" title={q.error instanceof ApiError && q.error.title ? text(q.error.title) : t('me.unavailable')} /> : null}
      {p ? (
        <>
          <Group>
            <Cell first icon="person" title={t('me.mobile')} value={p.mobile ?? '—'} onPress={open('/service/MD-01')} />
            <Cell icon="letter" title={t('me.email')} value={p.email ?? '—'} onPress={open('/service/MD-01')} />
            <Cell icon="wallet" title={t('me.bank')} value={p.bank?.iban ?? '—'} onPress={open('/service/MD-02')} />
          </Group>
          <View style={{ paddingTop: 8 }}><T weight="heavy" size={type.headline} color={th.fg}>{t('me.fromSap')}</T></View>
          <Group>
            <Cell first icon="team" title={t('me.manager')} sub={p.manager ? join(text(p.manager.name), text(p.manager.title)) : '—'} />
            <Cell icon="grid" title={t('me.position')} sub={join(text(p.title), p.positionId, text(p.unit))} />
            <Cell icon="idcard" title={t('me.group')} sub={join(text(p.group), text(p.subgroup), text(p.location))} />
            <Cell icon="idcard" title={t('me.employeeNo')} value={t('me.cardNo', { n: p.employeeNo })} />
          </Group>
        </>
      ) : null}
    </Screen>
  );
}
