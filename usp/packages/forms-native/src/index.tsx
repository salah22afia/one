/* The native renderer of configured services: the same definition and rules as the web renderer, laid out as the
   prototype's form (sections, a Group of Fields). The app passes its kit's Group, Field and Input; the plain parts below
   keep the package usable on its own. */
import type { ReactNode } from 'react';
import { Pressable, Switch, Text, TextInput, View, type TextInputProps } from 'react-native';
import { isRequired, isVisible, type Check, type FieldDef, type FormData, type ServiceDefinition } from '@usp/forms-core';
import { useI18n } from '@usp/i18n';

export interface FormParts {
  Group: (p: { children: ReactNode }) => ReactNode;
  Field: (p: { label: string; hint?: string; error?: string; children: ReactNode }) => ReactNode;
  Input: (p: TextInputProps & { invalid?: boolean }) => ReactNode;
  /** Choice buttons (select fields). */
  Choice: (p: { label: string; selected: boolean; onPress: () => void }) => ReactNode;
}

const plain: FormParts = {
  Group: ({ children }) => <View style={{ gap: 4 }}>{children}</View>,
  Field: ({ label, hint, error, children }) => (
    <View style={{ gap: 4, paddingVertical: 6 }}>
      <Text>{label}</Text>{children}
      {error ? <Text style={{ color: '#b3352c' }}>{error}</Text> : hint ? <Text style={{ color: '#8a948e' }}>{hint}</Text> : null}
    </View>
  ),
  Input: ({ invalid, style, ...p }) => <TextInput {...p} style={[{ borderWidth: 1, borderColor: invalid ? '#b3352c' : '#d8d1bd', borderRadius: 10, padding: 10 }, style]} />,
  Choice: ({ label, selected, onPress }) => (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }} style={{ padding: 8, borderRadius: 8, borderWidth: 1, borderColor: selected ? '#0b4a2f' : '#d8d1bd' }}><Text>{label}</Text></Pressable>
  ),
};

export function DynamicForm({ def, value, onChange, checks = [], parts = plain }: {
  def: ServiceDefinition; value: FormData; onChange: (v: FormData) => void; checks?: Check[]; parts?: FormParts;
}) {
  const { t, text } = useI18n();
  const byKey = new Map(def.fields.map((f) => [f.key, f]));
  const set = (k: string, v: unknown) => onChange({ ...value, [k]: v });
  const pages = def.form.pages.map((p) => ({ title: p.title, fields: p.fields.map((k) => byKey.get(k)).filter((f): f is FieldDef => !!f && isVisible(f, value)) }))
    .filter((p) => p.fields.length > 0);
  const { Group, Field } = parts;
  return (
    <View style={{ gap: 14 }}>
      {pages.map((p, i) => (
        <View key={i} style={{ gap: 8 }}>
          {pages.length > 1 ? <Text style={{ fontWeight: '700', fontSize: 15 }}>{text(p.title)}</Text> : null}
          <Group>
            {p.fields.map((f) => {
              const required = isRequired(f, value);
              const error = checks.find((c) => c.field === f.key && c.level === 'block');
              const label = text(f.label) + (required || f.type === 'boolean' ? '' : ` (${t('form.optional')})`);
              return (
                <Field key={f.key} label={label} hint={f.help ? text(f.help) : undefined} error={error ? text(error.text) : undefined}>
                  <Input f={f} v={value[f.key]} set={(v) => set(f.key, v)} parts={parts} invalid={!!error} />
                </Field>
              );
            })}
          </Group>
        </View>
      ))}
    </View>
  );
}

function Input({ f, v, set, parts, invalid }: { f: FieldDef; v: unknown; set: (v: unknown) => void; parts: FormParts; invalid: boolean }) {
  const { t, text } = useI18n();
  const s = v === undefined || v === null ? '' : String(v);
  const { Input: Box, Choice } = parts;
  if (f.type === 'select') return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {f.options?.map((o) => <Choice key={o.value} label={text(o.label)} selected={s === o.value} onPress={() => set(o.value)} />)}
    </View>
  );
  if (f.type === 'boolean') return <Switch value={v === true} onValueChange={set} accessibilityLabel={text(f.label)} />;
  // Only the file name is kept until the file store (Slice 0.9) takes the file itself.
  if (f.type === 'attachment') return <Box value={s} invalid={invalid} placeholder={t('form.chooseFile')} accessibilityLabel={text(f.label)} onChangeText={(x) => set(x === '' ? undefined : x)} />;
  const numeric = f.type === 'number' || f.type === 'money';
  return (
    <Box value={s} multiline={f.type === 'textarea'} invalid={invalid} accessibilityLabel={text(f.label)}
      keyboardType={numeric ? 'decimal-pad' : f.type === 'email' ? 'email-address' : f.type === 'phone' ? 'phone-pad' : 'default'}
      placeholder={f.type === 'date' ? 'YYYY-MM-DD' : undefined}
      onChangeText={(x) => set(numeric ? (x === '' ? undefined : Number(x)) : x)} />
  );
}
