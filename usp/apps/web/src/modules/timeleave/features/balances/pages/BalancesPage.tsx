/* My balances (prototype screens/Me.tsx Balances): a ring per quota — what is left of the entitlement. The latest
   leaves under it arrive with the leave history (Slice 3). */
import { ApiError, type LeaveBalance } from '@usp/api-client';
import { useI18n } from '@usp/i18n';
import { Empty, PageChrome, Ring, Ticker } from '@usp/ui-web';
import { useBalances } from '../queries';

const COLOR: Record<LeaveBalance['kind'], string | undefined> = { annual: undefined, sick: 'var(--gold)', emergency: 'var(--info)', other: undefined };

export default function BalancesPage() {
  const { t, text } = useI18n(); const q = useBalances(); const list = q.data ?? [];
  return (
    <PageChrome title={t('me.balances')} back="/me">
      {q.isError ? <div className="lb-empty"><Empty icon="leave" title={q.error instanceof ApiError && q.error.title ? text(q.error.title) : t('me.unavailable')} /></div>
        : !q.data ? null
        : list.length ? (
          <div className="tiles rings lb-rings">
            {list.map((b, i) => {
              const whole = Number.isInteger(b.remaining); const delay = 0.2 + i * 0.1;
              return (
                <div key={b.type || i} className="tile ringtile">
                  <Ring value={b.remaining} max={b.entitlement ?? b.remaining} size={84} stroke={9} color={COLOR[b.kind]} delay={delay}><b className="num"><Ticker value={b.remaining} decimals={whole ? 0 : 1} delay={delay} /></b></Ring>
                  <span>{text(b.name)}{b.kind === 'annual' && b.entitlement !== null ? <small className="num"> / {b.entitlement}</small> : null}</span>
                </div>
              );
            })}
          </div>
        ) : <div className="lb-empty"><Empty icon="leave" title={t('me.noBalances')} /></div>}
    </PageChrome>
  );
}
