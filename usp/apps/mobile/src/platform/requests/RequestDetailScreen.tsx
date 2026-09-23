import { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, decide, getRequest, type DecisionAction, type StepDetail } from '@usp/api-client';
import { useI18n } from '@usp/i18n';
import { Button, Card, Pill, colors } from '../../shared/ui';

/** Request detail on mobile: data, route with who is on each step, decision for the current assignee, issued documents. */
export default function RequestDetailScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const { text } = useI18n();
  const q = useQuery({ queryKey: ['request', id], queryFn: () => getRequest(id) });
  if (q.isPending) return null;
  if (q.isError) return <Text style={{ padding: 16, color: colors.danger }}>{text((q.error as ApiError).title ?? { ar: 'تعذّر فتح الطلب', en: 'Could not open the request' })}</Text>;
  const { request: r, fields, steps, documents } = q.data;
  const mine = steps.find((s) => s.mine);
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 22, fontWeight: '800' }}>{text(r.serviceName)}</Text><Pill status={r.status} />
      </View>
      <Text style={{ color: colors.mute }}>{r.id} · {text(r.requester.name)}</Text>
      {mine ? <Decision step={mine} requestId={r.id} /> : null}
      <Card>{fields.map((f) => <View key={f.key}><Text style={{ color: colors.mute, fontSize: 12 }}>{text(f.label)}</Text><Text style={{ fontWeight: '700' }}>{text(f.display)}</Text></View>)}</Card>
      {documents.map((d) => (
        <Card key={d.id}>
          <Text style={{ fontWeight: '700' }}>{text(d.title)}</Text>
          <Text>{d.number}</Text>
          <Text style={{ color: colors.mute }}>{text({ ar: 'رمز التحقق', en: 'Verification code' })}: {d.verifyCode}</Text>
        </Card>
      ))}
      <Card>
        {steps.map((s) => (
          <View key={s.id} style={{ borderStartWidth: 3, borderColor: s.status === 'done' ? colors.ok : s.status === 'current' ? colors.tint : colors.hair, paddingStart: 10, gap: 2 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}><Text style={{ fontWeight: '700', flex: 1 }}>{text(s.title)}</Text><Pill status={s.status} /></View>
            {s.actor ? <Text>{text(s.actor.name)}</Text> : s.assignees.length ? <Text>{s.assignees.map((a) => text(a.name)).join('، ')}</Text> : null}
            {s.ref ? <Text style={{ color: colors.mute }}>{s.ref}</Text> : null}
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

function Decision({ step, requestId }: { step: StepDetail; requestId: string }) {
  const { text } = useI18n();
  const qc = useQueryClient();
  const [note, setNote] = useState('');
  const [ref, setRef] = useState('');
  const m = useMutation({
    mutationFn: (a: DecisionAction) => decide(step.id, a, note || undefined, ref || undefined),
    onSuccess: (d) => { qc.setQueryData(['request', requestId], d); qc.invalidateQueries({ queryKey: ['tasks'] }); },
  });
  const err = m.error instanceof ApiError ? m.error : null;
  const input = { borderWidth: 1, borderColor: colors.hair, borderRadius: 10, padding: 10 } as const;
  return (
    <Card>
      <Text style={{ fontWeight: '800', color: colors.tint }}>{text({ ar: 'بانتظار قرارك', en: 'Awaiting your decision' })}: {text(step.title)}</Text>
      {step.mode === 'fulfil' ? <TextInput style={input} placeholder={text({ ar: 'مرجع التنفيذ', en: 'Reference' })} value={ref} onChangeText={setRef} /> : null}
      <TextInput style={input} multiline placeholder={text({ ar: 'ملاحظة (إلزامية عند الرفض)', en: 'Note (required to reject)' })} value={note} onChangeText={setNote} />
      {err ? <Text style={{ color: colors.danger }}>{text(err.checks[0]?.text ?? err.title ?? { ar: 'تعذّر', en: 'Failed' })}</Text> : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {step.mode === 'approve' ? <Button title={text({ ar: 'اعتماد', en: 'Approve' })} disabled={m.isPending} onPress={() => m.mutate('approve')} /> : null}
        {step.mode === 'fulfil' ? <Button title={text({ ar: 'تم التنفيذ', en: 'Done' })} disabled={m.isPending} onPress={() => m.mutate('done')} /> : null}
        {step.mode === 'receipt' ? <Button title={text({ ar: 'استلمت', en: 'Received' })} disabled={m.isPending} onPress={() => m.mutate('receive')} /> : null}
        {step.mode !== 'receipt' ? <Button kind="danger" title={text({ ar: 'رفض', en: 'Reject' })} disabled={m.isPending} onPress={() => m.mutate('reject')} /> : null}
      </View>
    </Card>
  );
}
