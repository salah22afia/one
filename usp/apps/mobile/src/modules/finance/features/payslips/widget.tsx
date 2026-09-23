import { router, type Href } from 'expo-router';
import { useI18n } from '@usp/i18n';
import { MeTile } from '../../../../shared/kit';
import { usePayslips } from './queries';

/** "My pay" on Me: the latest payslip's month; hidden until there is one. */
export function PayslipsWidget() {
  const { t, date } = useI18n(); const last = usePayslips().data?.[0];
  if (!last) return null;
  return <MeTile icon="wallet" title={t('me.pay')} sub={`${t('me.lastPayslip')} · ${date(`${last.period}-01`, { month: 'long', year: 'numeric' })}`} onPress={() => router.push('/finance/payslips' as Href)} />;
}
