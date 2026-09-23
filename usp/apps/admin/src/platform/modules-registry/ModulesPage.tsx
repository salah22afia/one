import { useQuery } from '@tanstack/react-query';
import { getModules } from '@usp/api-client';
import { useI18n } from '@usp/i18n';

/** Module & feature registry (MOD-01, MOD-02). Toggles and ordering come next. */
export default function ModulesPage() {
  const { text } = useI18n();
  const q = useQuery({ queryKey: ['modules'], queryFn: getModules });
  return (
    <section>
      <h1>{text({ ar: 'الوحدات والميزات', en: 'Modules & features' })}</h1>
      {q.isError ? <p className="muted">API unavailable: start the backend (pnpm dev:backend).</p> : null}
      <div className="cards">
        {q.data?.map((m) => (
          <div key={m.key} className="card">
            <b>{text(m.name)} <span className="muted mono">{m.key} · {m.catalogCode}</span></b>
            <ul>{m.features.map((f) => <li key={f.key}>{text(f.name)} <span className="muted mono">{f.kind.toLowerCase()} · {f.implementation.toLowerCase()}</span></li>)}</ul>
          </div>
        ))}
      </div>
    </section>
  );
}
