import { useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, submitRequest } from '@usp/api-client';
import type { ServiceDefinition } from '@usp/forms-core';
import { useI18n } from '@usp/i18n';
import { Empty, PageChrome } from '@usp/ui-web';
import { ServiceRequestForm } from './ServiceRequestForm';

/** Runs any configured service from its definition (no service-specific code). The server re-validates on submit. */
export default function DynamicServicePage() {
  const { serviceId = '' } = useParams();
  const { t } = useI18n(); const qc = useQueryClient();
  const q = useQuery({ queryKey: ['service', serviceId], queryFn: () => apiGet<ServiceDefinition>(`/services/${encodeURIComponent(serviceId)}/definition`) });
  if (q.isPending) return null;
  if (q.isError) return <PageChrome title={t('tabs.services')} back="/services"><div className="lb-empty"><Empty icon="grid" title={t('form.unavailable')} /></div></PageChrome>;
  return (
    <ServiceRequestForm def={q.data} backTo="/services"
      onSubmit={async (data) => { const d = await submitRequest(serviceId, data, 'web'); void qc.invalidateQueries({ queryKey: ['requests'] }); return d; }} />
  );
}
