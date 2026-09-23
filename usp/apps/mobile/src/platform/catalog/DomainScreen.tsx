/* A domain's screen on the phone (prototype screens/Services.tsx with a domain): its services in the administrator's order. */
import { useLocalSearchParams } from 'expo-router';
import type { CatalogService } from '@usp/api-client';
import { useI18n } from '@usp/i18n';
import { Group } from '../../shared/kit';
import { Empty, Screen } from '../../shared/ui';
import { openService, ServiceRow, useComing } from './parts';
import { useCatalog } from './queries';

export default function DomainScreen() {
  const { code = '' } = useLocalSearchParams<{ code: string }>(); const { t, text } = useI18n();
  const catalog = useCatalog(); const { setComing, sheet } = useComing(catalog.data); const open = (s: CatalogService) => openService(s, setComing);
  const d = catalog.data?.domains.find((x) => x.code === code);
  const list = catalog.data?.services.filter((s) => s.domain === code) ?? [];
  return (
    <Screen title={d ? text(d.name) : t('tabs.services')} sub={d ? text(d.description) || undefined : undefined} back onRefresh={() => void catalog.refetch()} refreshing={catalog.isRefetching}>
      {catalog.isError ? <Empty icon="grid" title={t('common.loadFailed')} />
        : !catalog.data ? null
        : d ? <Group>{list.map((s, i) => <ServiceRow key={s.id} s={s} first={i === 0} domain={d} onOpen={() => open(s)} />)}</Group>
        : <Empty icon="grid" title={t('services.notFoundDomain')} sub={t('services.notFoundDomainSub')} />}
      {sheet}
    </Screen>
  );
}
