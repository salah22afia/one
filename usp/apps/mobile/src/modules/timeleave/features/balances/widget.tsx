import { router, type Href } from 'expo-router';
import { useI18n } from '@usp/i18n';
import { MeTile } from '../../../../shared/kit';
import { T } from '../../../../shared/ui';
import { useTheme } from '../../../../shared/theme';
import { useBalances } from './queries';

/** "My balances" on Me: what is left of the annual quota; hidden when SAP has none for the employee. */
export function BalancesWidget() {
  const { t, text, number } = useI18n(); const th = useTheme(); const annual = useBalances().data?.find((b) => b.kind === 'annual');
  if (!annual) return null;
  const whole = Number.isInteger(annual.remaining);
  return (
    <MeTile icon="leave" tone="sage" title={t('me.balances')} onPress={() => router.push('/timeleave/balances' as Href)}
      value={<T weight="heavy" size={22.4}>{number(annual.remaining, { maximumFractionDigits: whole ? 0 : 1 })} <T weight="bold" size={12} color={th.fg3}>{t('me.days')}</T></T>}
      sub={`${text(annual.name)}${annual.entitlement !== null ? ` · ${number(annual.entitlement)}` : ''}`} />
  );
}
