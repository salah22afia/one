/* My balances on the phone (prototype screens/Me.tsx Balances): a ring per quota — what is left of the entitlement. */
import { View } from 'react-native';
import { ApiError, type LeaveBalance } from '@usp/api-client';
import { useI18n } from '@usp/i18n';
import { Ring } from '../../../../shared/kit';
import { type, useTheme, type Theme } from '../../../../shared/theme';
import { Empty, Screen, T } from '../../../../shared/ui';
import { useBalances } from './queries';

const color = (th: Theme, kind: LeaveBalance['kind']) => (kind === 'sick' ? th.gold : kind === 'emergency' ? th.info : th.tint);

export default function BalancesScreen() {
  const { t, text, number } = useI18n(); const th = useTheme(); const q = useBalances(); const list = q.data ?? [];
  return (
    <Screen title={t('me.balances')} back onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      {q.isError ? <Empty icon="leave" title={q.error instanceof ApiError && q.error.title ? text(q.error.title) : t('me.unavailable')} />
        : !q.data ? null
        : list.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 }}>
            {list.map((b, i) => (
              <View key={b.type || i} style={{ flexBasis: '30%', flexGrow: 1, alignItems: 'center', gap: 6, paddingTop: 12, paddingBottom: 10, paddingHorizontal: 6, backgroundColor: th.bgElev, borderRadius: 18 }}>
                <Ring value={b.remaining} max={b.entitlement ?? b.remaining} size={84} stroke={9} color={color(th, b.kind)} track={th.bgInset2}>
                  <T weight="heavy" size={type.headline}>{number(b.remaining, { maximumFractionDigits: Number.isInteger(b.remaining) ? 0 : 1 })}</T>
                </Ring>
                <T weight="bold" size={type.cap} color={th.fg2} style={{ textAlign: 'center' }}>{text(b.name)}{b.kind === 'annual' && b.entitlement !== null ? <T size={11} color={th.fg2}> / {b.entitlement}</T> : null}</T>
              </View>
            ))}
          </View>
        ) : <Empty icon="leave" title={t('me.noBalances')} />}
    </Screen>
  );
}
