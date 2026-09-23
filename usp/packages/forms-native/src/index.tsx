import { Pressable, Switch, Text, TextInput, View } from 'react-native';
import { isRequired, isVisible, type Check, type FieldDef, type FormData, type ServiceDefinition } from '@usp/forms-core';
import { useI18n } from '@usp/i18n';

/** Native renderer of a configured service's form: same definition and rules as the web renderer. */
export function DynamicForm({ def, value, onChange, checks = [] }: { def: ServiceDefinition; value: FormData; onChange: (v: FormData) => void; checks?: Check[] }) {
  const { text } = useI18n();
  const byKey = new Map(def.fields.map((f) => [f.key, f]));
  const set = (k: string, v: unknown) => onChange({ ...value, [k]: v });
  return (
    <View style={{ gap: 16 }}>
      {def.form.pages.map((p, i) => (
        <View key={i} style={{ gap: 12 }}>
          <Text style={{ fontWeight: '700', fontSize: 17 }}>{text(p.title)}</Text>
          {p.fields.map((k) => byKey.get(k)).filter((f): f is FieldDef => !!f && isVisible(f, value)).map((f) => (
            <View key={f.key} style={{ gap: 4 }}>
              <Text>{text(f.label)}{isRequired(f, value) ? ' *' : ''}</Text>
              <Input f={f} v={value[f.key]} set={(v) => set(f.key, v)} />
              {checks.filter((c) => c.field === f.key).map((c) => <Text key={c.key} style={{ color: c.level === 'block' ? '#b3352c' : '#9a6a12' }}>{text(c.text)}</Text>)}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function Input({ f, v, set }: { f: FieldDef; v: unknown; set: (v: unknown) => void }) {
  const { text } = useI18n();
  const s = v === undefined || v === null ? '' : String(v);
  if (f.type === 'select') return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {f.options?.map((o) => (
        <Pressable key={o.value} onPress={() => set(o.value)} style={{ padding: 8, borderRadius: 8, borderWidth: 1, borderColor: s === o.value ? '#0b4a2f' : '#d8d1bd' }}>
          <Text>{text(o.label)}</Text>
        </Pressable>
      ))}
    </View>
  );
  if (f.type === 'boolean') return <Switch value={v === true} onValueChange={set} accessibilityLabel={text(f.label)} />;
  const numeric = f.type === 'number' || f.type === 'money';
  return (
    <TextInput value={s} multiline={f.type === 'textarea'} keyboardType={numeric ? 'numeric' : 'default'} accessibilityLabel={text(f.label)}
      onChangeText={(x) => set(numeric ? (x === '' ? undefined : Number(x)) : x)}
      style={{ borderWidth: 1, borderColor: '#d8d1bd', borderRadius: 10, padding: 10 }} />
  );
}
