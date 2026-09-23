import { PageChrome } from '@usp/ui-web';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { getModules } from '@usp/api-client';
import { useI18n } from '@usp/i18n';
import { modules } from '../../app/registry';

/** Catalogue grouped by module (CAT-01): coded services open their module page, configured ones the dynamic renderer. */
export default function CatalogPage() {
  const { t, text } = useI18n();
  const q = useQuery({ queryKey: ['modules'], queryFn: getModules });
  const codedPage = (serviceId: string) => modules.flatMap((m) => m.routes).find((r) => r.serviceId === serviceId)?.path;
  return (
    <PageChrome title={t('tabs.services')} root>
      <div className="stack">
      {q.isError ? <p className="muted">API unavailable: start the backend (pnpm dev:backend).</p> : null}
      <div className="cards">
        {q.data?.map((m) => (
          <div key={m.key} className="card">
            <b>{text(m.name)} <span className="muted mono">{m.catalogCode}</span></b>
            <ul>
              {m.features.filter((f) => f.kind === 'SERVICE').map((f) => (
                <li key={f.key}>
                  <Link to={codedPage(f.serviceId!) ?? `/services/${f.serviceId}`}>{text(f.name)}</Link>{' '}
                  <span className="muted mono">{f.serviceId}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div></PageChrome>
  );
}
