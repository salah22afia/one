import { useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, submitRequest } from '@usp/api-client';
import type { ServiceDefinition } from '@usp/forms-core';
import { useI18n } from '@usp/i18n';
import { Empty, Screen } from '../../shared/ui';
import { ServiceForm } from './ServiceForm';

/** Runs any configured service from its definition: new services need no app release (MB-05). */
export default function DynamicServiceScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const { t } = useI18n(); const qc = useQueryClient();
  const q = useQuery({ queryKey: ['service', id], queryFn: () => apiGet<ServiceDefinition>(`/services/${encodeURIComponent(id)}/definition`) });
  if (q.isPending) return null;
  if (q.isError) return <Screen title={t('tabs.services')} back><Empty icon="grid" title={t('form.unavailable')} /></Screen>;
  return <ServiceForm def={q.data} onSubmit={async (data) => { const d = await submitRequest(id, data, 'app'); void qc.invalidateQueries({ queryKey: ['requests'] }); return d; }} />;
}
