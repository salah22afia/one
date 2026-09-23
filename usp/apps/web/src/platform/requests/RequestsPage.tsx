import { PageChrome } from '@usp/ui-web';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { getMyRequests } from '@usp/api-client';
import { useI18n } from '@usp/i18n';
import { StatusPill } from '../../shared/StatusPill';
import { fmtDate } from '../../shared/format';

export default function RequestsPage() {
  const { t, text, lang } = useI18n();
  const q = useQuery({ queryKey: ['requests'], queryFn: getMyRequests });
  return (
    <PageChrome title={t('tabs.requests')} root>
      <div className="stack">
      {q.data && !q.data.length ? <p className="muted">{text({ ar: 'لا طلبات بعد. ابدأ من «الخدمات».', en: 'No requests yet. Start from Services.' })}</p> : null}
      <ul className="list">
        {q.data?.map((r) => (
          <li key={r.id}>
            <Link to={`/requests/${r.id}`} className="hrow">
              <span><b>{text(r.serviceName)}</b><small className="mono muted">{r.id} · {fmtDate(r.createdAt, lang)}</small></span>
              <StatusPill status={r.status} />
            </Link>
          </li>
        ))}
      </ul>
    </div></PageChrome>
  );
}
