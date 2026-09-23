/* A domain's page (prototype screens/Services.tsx with a domain): its services in the administrator's order. */
import { useParams } from 'react-router';
import { useI18n } from '@usp/i18n';
import { Empty, PageChrome } from '@usp/ui-web';
import { ServiceRow, useComing, useOpenService } from './parts';
import { useCatalog } from './queries';

export default function DomainPage() {
  const { code = '' } = useParams(); const { t, text } = useI18n();
  const catalog = useCatalog(); const { setComing, sheet } = useComing(catalog.data); const open = useOpenService(setComing);
  const d = catalog.data?.domains.find((x) => x.code === code);
  const list = catalog.data?.services.filter((s) => s.domain === code) ?? [];
  return (
    <PageChrome title={d ? text(d.name) : t('tabs.services')} sub={d ? text(d.description) || undefined : undefined} back="/services">
      {catalog.isError ? <div className="lb-empty"><Empty icon="grid" title={t('common.loadFailed')} /></div>
        : !catalog.data ? null
        : d ? <section className="lb-sec-list"><div className="lrow-list" role="list">{list.map((s) => <ServiceRow key={s.id} s={s} domain={d} onOpen={() => open(s)} />)}</div></section>
        : <div className="lb-empty"><Empty icon="grid" title={t('services.notFoundDomain')} sub={t('services.notFoundDomainSub')} /></div>}
      {sheet}
    </PageChrome>
  );
}
