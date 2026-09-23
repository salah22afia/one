import { useI18n } from '@usp/i18n';
import { MeTile } from '@usp/ui-web';
import { useBalances } from './queries';

/** "My balances" on Me: what is left of the annual quota; hidden when SAP has none for the employee. */
export function BalancesWidget({ delay }: { delay: number }) {
  const { t, text, number } = useI18n(); const annual = useBalances().data?.find((b) => b.kind === 'annual');
  if (!annual) return null;
  const whole = Number.isInteger(annual.remaining);
  return (
    <MeTile to="/me/balances" icon="leave" tone="sage" title={t('me.balances')} delay={delay}
      value={<>{number(annual.remaining, { maximumFractionDigits: whole ? 0 : 1 })} <small>{t('me.days')}</small></>}
      sub={`${text(annual.name)}${annual.entitlement !== null ? ` · ${number(annual.entitlement)}` : ''}`} />
  );
}
