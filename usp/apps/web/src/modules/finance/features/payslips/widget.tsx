import { useI18n } from '@usp/i18n';
import { MeTile } from '@usp/ui-web';
import { monthOf, usePayslips } from './queries';

/** "My pay" on Me: the latest payslip's month; hidden until there is one. */
export function PayslipsWidget({ delay }: { delay: number }) {
  const { t, date } = useI18n(); const last = usePayslips().data?.[0];
  if (!last) return null;
  return <MeTile to="/me/pay" icon="wallet" title={t('me.pay')} sub={`${t('me.lastPayslip')} · ${date(monthOf(last.period), { month: 'long', year: 'numeric' })}`} delay={delay} />;
}
