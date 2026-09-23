import { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, apiGet, submitRequest } from '@usp/api-client';
import { blocks, validate, type Check, type FormData, type ServiceDefinition } from '@usp/forms-core';
import { DynamicForm } from '@usp/forms-native';
import { useI18n } from '@usp/i18n';
import { Button, colors } from '../../shared/ui';

/** Runs any configured service from its definition: new services need no app release (MB-05). */
export default function DynamicServiceScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const { text } = useI18n();
  const qc = useQueryClient();
  const [data, setData] = useState<FormData>({});
  const [tried, setTried] = useState(false);
  const [serverChecks, setServerChecks] = useState<Check[]>([]);
  const q = useQuery({ queryKey: ['service', id], queryFn: () => apiGet<ServiceDefinition>(`/services/${id}/definition`) });
  const submit = useMutation({
    mutationFn: () => submitRequest(id, data, 'app'),
    onSuccess: (d) => { qc.invalidateQueries({ queryKey: ['requests'] }); router.replace(`/request/${d.request.id}`); },
    onError: (e) => setServerChecks(e instanceof ApiError ? e.checks : []),
  });
  if (q.isPending) return null;
  if (q.isError) return <Text style={{ padding: 16 }}>{id}: {text({ ar: 'الخدمة غير متاحة', en: 'service not available' })}</Text>;
  const checks = tried ? [...validate(q.data, data), ...serverChecks] : [];
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: '800' }}>{text(q.data.name)}</Text>
      <DynamicForm def={q.data} value={data} onChange={(v) => { setData(v); setServerChecks([]); }} checks={checks} />
      {q.data.next ? <Text style={{ color: colors.mute }}>{text(q.data.next)}</Text> : null}
      <Button title={text({ ar: 'إرسال الطلب', en: 'Submit request' })} disabled={submit.isPending}
        onPress={() => { setTried(true); if (!blocks(validate(q.data, data))) submit.mutate(); }} />
    </ScrollView>
  );
}
