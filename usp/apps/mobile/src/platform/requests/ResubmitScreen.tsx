/* Complete and resubmit a returned request (prototype #/resubmit/<id>): the service's form pre-filled, the reason on top. */
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, resubmitRequest } from '@usp/api-client';
import type { FormData, ServiceDefinition } from '@usp/forms-core';
import { useI18n } from '@usp/i18n';
import { useIsland } from '../../shared/kit';
import { Empty, Screen } from '../../shared/ui';
import { ServiceForm } from '../dynamic-service/ServiceForm';
import { useRequest } from './queries';

export default function ResubmitScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const { t } = useI18n(); const qc = useQueryClient(); const island = useIsland();
  const r = useRequest(id);
  const serviceId = r.data?.request.serviceId;
  const def = useQuery({ queryKey: ['service', serviceId], queryFn: () => apiGet<ServiceDefinition>(`/services/${encodeURIComponent(serviceId!)}/definition`), enabled: !!serviceId });
  if (r.isPending || (serviceId && def.isPending)) return null;
  if (r.isError || def.isError || !def.data || !r.data.canResubmit) return <Screen title={t('requests.resubmitTitle')} back><Empty icon="doc" title={t('requests.notFound')} sub={t('requests.notFoundSub')} /></Screen>;
  const d = r.data;
  const initial: FormData = Object.fromEntries(d.fields.map((f) => [f.key, f.value]));
  return (
    <ServiceForm def={def.data} mode="resubmit" initial={initial} returnedNote={d.steps.find((s) => s.status === 'returned')?.note ?? null}
      onSubmit={(data) => resubmitRequest(id, data, d.request.version)}
      onSent={(next) => { qc.setQueryData(['request', id], next); void qc.invalidateQueries({ queryKey: ['requests'] }); island(t('form.sent')); router.back(); }} />
  );
}
