/* My pay on the phone (prototype screens/Me.tsx Pay): the latest payslips; one opens with gross, deductions and net. */
import { useState } from 'react';
import { ApiError, type Payslip } from '@usp/api-client';
import { useI18n } from '@usp/i18n';
import { Cell, Group, Sheet, SummaryRow } from '../../../../shared/kit';
import { Empty, Screen } from '../../../../shared/ui';
import { usePayslips } from './queries';

export default function PayslipsScreen() {
  const { t, text, date, number } = useI18n(); const q = usePayslips(); const [slip, setSlip] = useState<Payslip | null>(null);
  const month = (p: Payslip) => date(`${p.period}-01`, { month: 'long', year: 'numeric' });
  const money = (n: number | null, digits = 2) => (n === null ? '—' : number(n, { minimumFractionDigits: digits, maximumFractionDigits: digits }));
  return (
    <Screen title={t('me.pay')} back onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      {q.isError ? <Empty icon="wallet" title={q.error instanceof ApiError && q.error.title ? text(q.error.title) : t('me.unavailable')} />
        : !q.data ? null
        : q.data.length ? <Group>{q.data.map((p, i) => <Cell key={p.id} first={i === 0} icon="wallet" title={month(p)} sub={`${t('me.net')} ${money(p.net)}`} value={money(p.net, 0)} onPress={() => setSlip(p)} />)}</Group>
        : <Empty icon="wallet" title={t('me.noPay')} />}
      <Sheet open={!!slip} onClose={() => setSlip(null)} title={slip ? `${t('me.payslip')} · ${month(slip)}` : ''}>
        {slip ? (
          <Group>
            <SummaryRow k={t('me.gross')} v={money(slip.gross)} />
            <SummaryRow k={t('me.deductions')} v={money(slip.deductions)} />
            <SummaryRow k={t('me.net')} v={`${money(slip.net)}${slip.currency ? ` ${slip.currency}` : ''}`} />
            <SummaryRow k={t('me.payDate')} v={slip.payDate ? date(slip.payDate) : '—'} last />
          </Group>
        ) : null}
      </Sheet>
    </Screen>
  );
}
