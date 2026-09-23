import { isRequired, isVisible, type Check, type FieldDef, type FormData, type ServiceDefinition } from '@usp/forms-core';
import { useI18n } from '@usp/i18n';

/** Renders a configured service's form (all pages stacked for now; wizard paging comes with the renderer work, AB-20). */
export function DynamicForm({ def, value, onChange, checks = [] }: { def: ServiceDefinition; value: FormData; onChange: (v: FormData) => void; checks?: Check[] }) {
  const { text } = useI18n();
  const byKey = new Map(def.fields.map((f) => [f.key, f]));
  const set = (k: string, v: unknown) => onChange({ ...value, [k]: v });
  return (
    <div className="dyn-form">
      {def.form.pages.map((p, i) => (
        <fieldset key={i}>
          <legend>{text(p.title)}</legend>
          {p.fields.map((k) => byKey.get(k)).filter((f): f is FieldDef => !!f && isVisible(f, value)).map((f) => (
            <label key={f.key} className="dyn-field">
              <span>{text(f.label)}{isRequired(f, value) ? ' *' : ''}</span>
              <Input f={f} v={value[f.key]} set={(v) => set(f.key, v)} />
              {f.help ? <small>{text(f.help)}</small> : null}
              {checks.filter((c) => c.field === f.key).map((c) => <small key={c.key} data-level={c.level}>{text(c.text)}</small>)}
            </label>
          ))}
        </fieldset>
      ))}
    </div>
  );
}

function Input({ f, v, set }: { f: FieldDef; v: unknown; set: (v: unknown) => void }) {
  const { text } = useI18n();
  const s = v === undefined || v === null ? '' : String(v);
  switch (f.type) {
    case 'textarea': return <textarea value={s} onChange={(e) => set(e.target.value)} />;
    case 'select': return (
      <select value={s} onChange={(e) => set(e.target.value)}>
        <option value="" />
        {f.options?.map((o) => <option key={o.value} value={o.value}>{text(o.label)}</option>)}
      </select>
    );
    case 'boolean': return <input type="checkbox" checked={v === true} onChange={(e) => set(e.target.checked)} />;
    case 'number': case 'money': return <input type="number" value={s} onChange={(e) => set(e.target.value === '' ? undefined : Number(e.target.value))} />;
    case 'date': return <input type="date" value={s} onChange={(e) => set(e.target.value)} />;
    case 'attachment': return <input type="file" onChange={(e) => set(e.target.files?.[0]?.name)} />;
    default: return <input type={f.type === 'email' ? 'email' : 'text'} value={s} onChange={(e) => set(e.target.value)} />;
  }
}
