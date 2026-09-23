/* Complete and resubmit a returned request (prototype #/resubmit/<id>): the service's form, pre-filled with what was
   submitted, the reason it was returned on top; it goes back to the same desk. */
import { useNavigate, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, resubmitRequest } from '@usp/api-client';
import type { FormData, ServiceDefinition } from '@usp/forms-core';
import { useI18n } from '@usp/i18n';
import { Empty, PageChrome, useIsland } from '@usp/ui-web';
import { ServiceRequestForm } from '../dynamic-service/ServiceRequestForm';
import { useRequest } from './queries';

export default function ResubmitPage() {
  const { id = '' } = useParams();
  const { t } = useI18n(); const navigate = useNavigate(); const qc = useQueryClient(); const island = useIsland();
  const r = useRequest(id);
  const serviceId = r.data?.request.serviceId;
  const def = useQuery({ queryKey: ['service', serviceId], queryFn: () => apiGet<ServiceDefinition>(`/services/${encodeURIComponent(serviceId!)}/definition`), enabled: !!serviceId });
  if (r.isPending || (serviceId && def.isPending)) return null;
  if (r.isError || def.isError || !def.data || !r.data.canResubmit) {
    return <PageChrome title={t('requests.resubmitTitle')} back={`/requests/${id}`}><div className="lb-empty"><Empty icon="doc" title={t('requests.notFound')} sub={t('requests.notFoundSub')} /></div></PageChrome>;
  }
  const d = r.data;
  const initial: FormData = Object.fromEntries(d.fields.map((f) => [f.key, f.value]));
  const note = d.steps.find((s) => s.status === 'returned')?.note ?? null;
  return (
    <ServiceRequestForm def={def.data} mode="resubmit" initial={initial} returnedNote={note} backTo={`/requests/${id}`}
      onSubmit={(data) => resubmitRequest(id, data, d.request.version)}
      onSent={(next) => {
        qc.setQueryData(['request', id], next);
        void qc.invalidateQueries({ queryKey: ['requests'] });
        island(t('form.sent'));
        navigate(`/requests/${id}`, { replace: true });
      }} />
  );
}
