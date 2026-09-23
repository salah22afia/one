/* My pay (prototype screens/Me.tsx Pay): the latest payslips; one opens as a sheet with gross, deductions and net. */
import { useState } from 'react';
import { ApiError, type Payslip } from '@usp/api-client';
import { useI18n } from '@usp/i18n';
import { BottomSheet, Cell, Empty, Group, PageChrome } from '@usp/ui-web';
import { monthOf, usePayslips } from '../queries';

export default function PayslipsPage() {
  const { t, text, date, number } = useI18n(); const q = usePayslips(); const [slip, setSlip] = useState<Payslip | null>(null);
  const month = (p: Payslip) => date(monthOf(p.period), { month: 'long', year: 'numeric' });
  const money = (n: number | null, digits = 2) => (n === null ? '—' : number(n, { minimumFractionDigits: digits, maximumFractionDigits: digits }));
  return (
    <PageChrome title={t('me.pay')} back="/me">
      {q.isError ? <div className="lb-empty"><Empty icon="wallet" title={q.error instanceof ApiError && q.error.title ? text(q.error.title) : t('me.unavailable')} /></div>
        : !q.data ? null
        : q.data.length ? <Group>{q.data.map((p) => <Cell key={p.id} icon="wallet" tone="plain" title={month(p)} sub={`${t('me.net')} ${money(p.net)}`} value={<span className="num">{money(p.net, 0)}</span>} onClick={() => setSlip(p)} />)}</Group>
        : <div className="lb-empty"><Empty icon="wallet" title={t('me.noPay')} /></div>}
      <BottomSheet open={!!slip} onClose={() => setSlip(null)} title={slip ? `${t('me.payslip')} · ${month(slip)}` : ''}>
        {slip && (
          <Group>
            <div className="summary-row"><span className="k">{t('me.gross')}</span><span className="v num">{money(slip.gross)}</span></div>
            <div className="summary-row"><span className="k">{t('me.deductions')}</span><span className="v num">{money(slip.deductions)}</span></div>
            <div className="summary-row"><span className="k"><b>{t('me.net')}</b></span><span className="v num"><b>{money(slip.net)}{slip.currency ? ` ${slip.currency}` : ''}</b></span></div>
            <div className="summary-row"><span className="k">{t('me.payDate')}</span><span className="v">{slip.payDate ? date(slip.payDate) : '—'}</span></div>
          </Group>
        )}
      </BottomSheet>
    </PageChrome>
  );
}
