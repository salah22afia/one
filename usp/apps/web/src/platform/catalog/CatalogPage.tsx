/* "Services" (prototype screens/Services.tsx): search first, then "Start now" — a rail of cards on a phone, a grid on a
   desk — then the domains as compact two-column rows (C-UX-86). The catalogue comes from the server, as the
   administrator configured it; coming services open a sheet that says when they arrive. */
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { searchCatalog } from '@usp/api-client';
import { useI18n } from '@usp/i18n';
import { Empty, I, PageChrome, Rail, SPRING, SearchField, motion, useIntroSkip, useReducedMotion, useUI } from '@usp/ui-web';
import { iconOf, ServiceCard, ServiceRow, useComing, useOpenService } from './parts';
import { useCatalog } from './queries';

const MotionLink = motion.create(Link);

export default function CatalogPage() {
  const { t, text, plural } = useI18n(); const { desk } = useUI(); const reduce = !!useReducedMotion(); const skip = useIntroSkip();
  const catalog = useCatalog(); const [q, setQ] = useState('');
  const { setComing, sheet } = useComing(catalog.data); const open = useOpenService(setComing);
  const all = useMemo(() => catalog.data?.services ?? [], [catalog.data]);
  const domains = useMemo(() => new Map((catalog.data?.domains ?? []).map((d) => [d.code, d])), [catalog.data]);
  const results = useMemo(() => (q.trim() ? searchCatalog(all, q, 12) : []), [q, all]);
  const available = useMemo(() => all.filter((s) => s.startable), [all]);
  const row = (s: (typeof all)[number]) => <ServiceRow key={s.id} s={s} domain={domains.get(s.domain)} onOpen={() => open(s)} />;
  const card = (s: (typeof all)[number], i: number) => <ServiceCard key={s.id} s={s} i={i} domain={domains.get(s.domain)} onOpen={() => open(s)} reduce={reduce} skip={skip} />;
  return (
    <PageChrome title={t('tabs.services')} root>
      <div className="sv-search"><SearchField id="lbsvq" value={q} onChange={setQ} placeholder={plural('services.searchIn', all.length)} /></div>
      {catalog.isError ? <div className="lb-empty"><Empty icon="grid" title={t('common.loadFailed')} /></div> : !catalog.data ? null : q.trim() ? (
        results.length === 0 ? <div className="lb-empty"><Empty icon="search" title={t('services.noResults')} sub={t('services.noResultsSub')} /></div> : (
          <section className="lb-sec-list"><div className="lb-head"><h2>{plural('services.n', results.length)}</h2></div>
            <div className="lrow-list" role="list">{results.map(row)}</div>
          </section>
        )
      ) : (
        <>
          {available.length ? (
            <section className="lb-sec-list">
              <div className="lb-head"><h2>{t('services.startNow')}</h2><span className="lb-muted">{plural('services.n', available.length)}</span></div>
              {desk ? <div className="sv-grid">{available.map(card)}</div> : <Rail className="sv-rail" ariaLabel={t('services.startNow')}>{available.map(card)}</Rail>}
            </section>
          ) : null}
          <section className="lb-sec-list">
            <div className="lb-head"><h2>{t('services.domains')}</h2><span className="lb-muted">{plural('services.n', all.length)}</span></div>
            <div className="dm-grid" role="list">
              {[...domains.values()].map((d, i) => {
                const n = all.filter((s) => s.domain === d.code).length; if (!n) return null; const Ic = I[iconOf(d.icon)];
                return (
                  <MotionLink key={d.code} className="dm" to={`/services/${d.code}`} role="listitem" initial={skip ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING.soft, delay: 0.1 + i * 0.025 }} whileTap={{ scale: 0.97 }}>
                    <span className={`qicon ${d.tone || 'g-sage'} dm-ic`}><Ic /></span><span className="dm-txt"><b>{text(d.name)}</b><span>{plural('services.n', n)}</span></span><I.chev className="dirchev dm-chev" />
                  </MotionLink>
                );
              })}
            </div>
          </section>
        </>
      )}
      {sheet}
    </PageChrome>
  );
}
