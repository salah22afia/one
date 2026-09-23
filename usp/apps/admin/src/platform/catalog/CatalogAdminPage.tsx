/* The service catalogue for platform administrators (CAT-01), built from the prototype's admin parts: the designer's
   catalogue tab (search, filter, folded domains, rows with pills), the policy centres' cards and change log, and the
   edit sheets. Operational configuration: a change takes effect at once and is logged; nothing is ever deleted. */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAdminCatalog } from '@usp/api-client';
import { useI18n } from '@usp/i18n';
import { AnimatePresence, Empty, PageChrome, SPRING, Segmented, motion } from '@usp/ui-web';
import { DockTab } from './DockTab';
import { DomainsTab } from './DomainsTab';
import { LogTab } from './LogTab';
import { QUERY } from './parts';
import { ServicesTab } from './ServicesTab';

type Tab = 'catalogue' | 'domains' | 'dock' | 'log';

export default function CatalogAdminPage() {
  const { t } = useI18n(); const [tab, setTab] = useState<Tab>('catalogue');
  const q = useQuery({ queryKey: QUERY, queryFn: getAdminCatalog });
  const c = q.data;
  return (
    <PageChrome title={t('catalogAdmin.title')} sub={t('catalogAdmin.sub')} className="policy">
      {q.isError ? <div className="lb-empty"><Empty icon="grid" title={t('common.loadFailed')} /></div> : null}
      {c ? (
        <>
          <Segmented id="catadm" value={tab} onChange={setTab} options={[
            { v: 'catalogue', label: t('catalogAdmin.tab.catalogue'), n: c.services.length },
            { v: 'domains', label: t('catalogAdmin.tab.domains'), n: c.domains.length },
            { v: 'dock', label: t('catalogAdmin.tab.dock'), n: c.dock.items.length },
            { v: 'log', label: t('catalogAdmin.tab.log') },
          ]} />
          <div style={{ height: 12 }} />
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6, transition: { duration: 0.1 } }} transition={SPRING.soft}>
              {tab === 'catalogue' ? <ServicesTab catalog={c} /> : tab === 'domains' ? <DomainsTab catalog={c} /> : tab === 'dock' ? <DockTab catalog={c} /> : <LogTab catalog={c} />}
            </motion.div>
          </AnimatePresence>
        </>
      ) : null}
    </PageChrome>
  );
}
