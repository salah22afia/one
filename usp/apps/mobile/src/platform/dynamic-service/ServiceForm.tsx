/* A configured service's request form on the phone (prototype screens/NewRequest.tsx): step 1 the fields, step 2 the
   review with what happens next, then sent. Completes a returned request too ("Complete and resubmit"), pre-filled,
   with the reason it was returned. The server validates again. */
import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { ApiError, type RequestDetail } from '@usp/api-client';
import { blocks, isVisible, validate, type Check, type FieldDef, type FormData, type ServiceDefinition } from '@usp/forms-core';
import { DynamicForm, type FormParts } from '@usp/forms-native';
import { useI18n } from '@usp/i18n';
import { Field, Group, Input, Notice, SummaryRow } from '../../shared/kit';
import { I } from '../../shared/icons';
import { type, useTheme } from '../../shared/theme';
import { Button, Pill, Screen, T } from '../../shared/ui';

function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const th = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }}
      style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 12, backgroundColor: selected ? th.tint : th.bgInset }}>
      <T weight="bold" size={type.sub} color={selected ? th.tintFg : th.fg}>{label}</T>
    </Pressable>
  );
}
const parts: FormParts = { Group, Field, Input, Choice };

export function ServiceForm({ def, mode = 'new', initial = {}, returnedNote, onSubmit, onSent }: {
  def: ServiceDefinition; mode?: 'new' | 'resubmit'; initial?: FormData; returnedNote?: string | null;
  onSubmit: (data: FormData) => Promise<RequestDetail>; onSent?: (d: RequestDetail) => void;
}) {
  const th = useTheme(); const { t, text } = useI18n();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [data, setData] = useState<FormData>(initial);
  const [checks, setChecks] = useState<Check[]>([]);
  const [sending, setSending] = useState(false); const [created, setCreated] = useState(''); const [failure, setFailure] = useState('');
  const title = text(def.name);
  const errors = checks.filter((c) => c.level === 'block');
  const fieldOf = (key?: string) => def.fields.find((f) => f.key === key);
  const shown = def.form.pages.flatMap((p) => p.fields).map((k) => fieldOf(k)).filter((f): f is FieldDef => !!f && isVisible(f, data));
  const next = () => { const c = validate(def, data); setChecks(c); if (!blocks(c)) setStep(2); };
  const send = async () => {
    setSending(true); setFailure('');
    try {
      const d = await onSubmit(data);
      if (onSent) onSent(d); else { setCreated(d.request.id); setStep(3); }
    } catch (e) {
      if (e instanceof ApiError && e.checks.length) { setChecks(e.checks); setStep(1); }
      else setFailure(e instanceof ApiError && e.title ? text(e.title) : t('form.failed'));
    } finally { setSending(false); }
  };
  const display = (f: FieldDef, v: unknown): ReactNode => {
    if (v === undefined || v === null || v === '') return null;
    if (f.type === 'boolean') return v === true ? t('form.yes') : t('form.no');
    if (f.type === 'attachment') return <Pill icon="clip">{String(v)}</Pill>;
    const o = f.options?.find((x) => x.value === String(v));
    return o ? text(o.label) : String(v);
  };
  const reviewed = shown.map((f) => ({ f, v: display(f, data[f.key]) })).filter((x) => x.v !== null);
  return (
    <Screen title={mode === 'resubmit' ? t('requests.resubmitTitle') : title} sub={mode === 'resubmit' ? title : undefined} back>
      {step < 3 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <T weight="bold" size={type.foot} color={th.fg3}>{t('form.step', { n: step, m: 2 })}</T>
          <View style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: th.bgInset2, overflow: 'hidden' }}><View style={{ width: `${step === 1 ? 33 : 66}%`, height: 5, backgroundColor: th.tint }} /></View>
          <T weight="bold" size={type.foot} color={th.fg3}>{step === 1 ? t('form.details') : t('form.review')}</T>
        </View>
      ) : null}
      {step === 1 ? (
        <>
          {returnedNote ? <Notice tone="warn" icon="ret">{returnedNote}</Notice> : null}
          {errors.length ? (
            <View style={{ backgroundColor: th.dangerSoft, borderRadius: 14, padding: 12, gap: 4 }}>
              <T weight="heavy" color={th.danger}>{t('form.fixErrors')}</T>
              {errors.map((c) => <T key={c.key} size={type.sub}>{fieldOf(c.field) ? `${text(fieldOf(c.field)!.label)}: ` : ''}{text(c.text)}</T>)}
            </View>
          ) : null}
          <DynamicForm def={def} value={data} onChange={(v) => { setData(v); if (checks.length) setChecks(validate(def, v).filter((c) => errors.some((e) => e.key === c.key))); }} checks={checks} parts={parts} />
          <Button title={t('form.next')} onPress={next} />
        </>
      ) : step === 2 ? (
        <>
          <Group>{reviewed.map(({ f, v }, i) => <SummaryRow key={f.key} k={text(f.label)} v={v} last={i === reviewed.length - 1} />)}</Group>
          <Button kind="plain" title={t('form.edit')} onPress={() => setStep(1)} />
          {def.next ? <><T weight="heavy" size={type.foot} color={th.fg3}>{t('form.whatNext')}</T><Notice tone="tint" icon="clock">{text(def.next)}</Notice></> : null}
          {failure ? <Notice tone="danger" icon="alert">{failure}</Notice> : null}
          <Button icon="send" title={t('form.submit')} disabled={sending} onPress={() => void send()} />
        </>
      ) : (
        <View style={{ alignItems: 'center', gap: 10, paddingTop: 30 }}>
          <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: th.tint, alignItems: 'center', justifyContent: 'center' }}><I.check size={48} color={th.tintFg} strokeWidth={2.6} /></View>
          <T weight="heavy" size={type.title1}>{t('form.sent')}</T>
          <T size={type.sub} color={th.fg2}>{t('form.sentSub')}</T>
          <T weight="bold" color={th.fg3}>{created}</T>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <Button kind="secondary" title={t('tabs.home')} onPress={() => router.replace('/')} />
            <Button title={t('form.viewRequest')} onPress={() => router.replace(`/request/${created}`)} />
          </View>
        </View>
      )}
    </Screen>
  );
}
