import { PageChrome } from '@usp/ui-web';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { getTasks } from '@usp/api-client';
import { useI18n } from '@usp/i18n';
import { fmtDate } from '../../shared/format';

/** My tasks: every open step where I am a current holder of its positions (re-resolved live). */
export default function InboxPage() {
  const { t, text, lang } = useI18n();
  const q = useQuery({ queryKey: ['tasks'], queryFn: getTasks });
  return (
    <PageChrome title={t('tabs.inbox')} root>
      <div className="stack">
      {q.data && !q.data.length ? <p className="muted">{text({ ar: 'لا شيء ينتظر إجراءك الآن.', en: 'Nothing is waiting for you.' })}</p> : null}
      <ul className="list">
        {q.data?.map((task) => (
          <li key={task.stepId}>
            <Link to={`/requests/${task.requestId}`} className="hrow">
              <span>
                <b>{text(task.serviceName)} — {text(task.stepTitle)}</b>
                <small className="muted">{text(task.requester.name)} · <span className="mono">{task.requestId}</span> · {fmtDate(task.startedAt, lang, true)}</small>
              </span>
              {task.overdue ? <span className="pill" data-status="rejected">{text({ ar: 'متأخرة', en: 'Overdue' })}</span> : <span className="pill" data-status="current">{text({ ar: 'جديدة', en: 'Open' })}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </div></PageChrome>
  );
}
