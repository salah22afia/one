/* The web renderer of configured services: the prototype's request form (screens/ConfiguredRequest.tsx FieldInput) —
   sections, then each field in the kit's Field (label, input, hint or error). The app passes the kit's Group and Field
   (with their motion); the plain markup below is the same structure without it. */
import type React from 'react';
import { isRequired, isVisible, type Check, type FieldDef, type FormData, type ServiceDefinition } from '@usp/forms-core';
import { useI18n } from '@usp/i18n';

export interface FormParts {
  Group: (p: { children: React.ReactNode }) => React.ReactNode;
  Field: (p: { id: string; label: string; hint?: string; error?: string; children: React.ReactNode }) => React.ReactNode;
}

const plain: FormParts = {
  Group: ({ children }) => <div className="group">{children}</div>,
  Field: ({ id, label, hint, error, children }) => (
    <div className={`field ${error ? 'invalid' : ''}`}>
      <label htmlFor={id}>{label}</label>{children}
      {error ? <span className="err" id={`${id}-err`}>{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  ),
};

/** Element id of a field (error summaries link to it). */
export const fieldId = (key: string) => `cf-${key}`;

export function DynamicForm({ def, value, onChange, checks = [], parts = plain, disabled }: {
  def: ServiceDefinition; value: FormData; onChange: (v: FormData) => void; checks?: Check[]; parts?: FormParts; disabled?: boolean;
}) {
  const { text } = useI18n();
  const byKey = new Map(def.fields.map((f) => [f.key, f]));
  const set = (k: string, v: unknown) => onChange({ ...value, [k]: v });
  const { Group } = parts;
  const pages = def.form.pages.map((p) => ({ title: p.title, fields: p.fields.map((k) => byKey.get(k)).filter((f): f is FieldDef => !!f && isVisible(f, value)) }))
    .filter((p) => p.fields.length > 0);
  return (
    <>
      {pages.map((p, i) => (
        <div key={i}>
          {pages.length > 1 ? <div className="section-label cf-sec"><span>{text(p.title)}</span></div> : null}
          <Group>
            {p.fields.map((f) => (
              <FieldInput key={f.key} f={f} value={value[f.key]} onChange={(v) => set(f.key, v)} required={isRequired(f, value)} parts={parts} disabled={disabled}
                error={checks.find((c) => c.field === f.key && c.level === 'block')?.text} />
            ))}
          </Group>
        </div>
      ))}
    </>
  );
}

function FieldInput({ f, value, onChange, required, error, parts, disabled }: {
  f: FieldDef; value: unknown; onChange: (v: unknown) => void; required: boolean; error?: Check['text']; parts: FormParts; disabled?: boolean;
}) {
  const { t, text } = useI18n();
  const id = fieldId(f.key);
  const s = value === undefined || value === null ? '' : String(value);
  const label = text(f.label) + (required || f.type === 'boolean' ? '' : ` (${t('form.optional')})`);
  const err = error ? text(error) : undefined;
  if (f.type === 'boolean') return (
    <div className={`cf-check ${err ? 'bad' : ''}`}>
      <label className="sw"><span>{text(f.label)}{f.help ? <span className="cell-sub">{text(f.help)}</span> : null}</span>
        <input id={id} className="switch" type="checkbox" checked={value === true} disabled={disabled} onChange={(e) => onChange(e.target.checked)} /></label>
      {err ? <span className="field-err">{err}</span> : null}
    </div>
  );
  if (f.type === 'info') return <div className="notice"><span>{text(f.label)}{f.help ? <> — {text(f.help)}</> : null}</span></div>;
  const input = (() => {
    switch (f.type) {
      case 'textarea': return <textarea id={id} rows={3} value={s} disabled={disabled} onChange={(e) => onChange(e.target.value)} />;
      case 'number': case 'money': return (
        <span className="cf-money">
          <input id={id} type="number" inputMode="decimal" dir="ltr" className="num" value={s} min={f.min} max={f.max} step={f.type === 'money' ? 0.01 : 1} disabled={disabled}
            onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))} />
          {f.type === 'money' ? <span className="cf-cur">SAR</span> : null}
        </span>
      );
      case 'date': return <input id={id} type="date" dir="ltr" className="num" value={s} disabled={disabled} onChange={(e) => onChange(e.target.value)} />;
      case 'select': {
        const opts = f.options ?? [];
        if (opts.length <= 3) return (
          <div className="segmented cf-seg" role="group" id={id}>
            {opts.map((o) => <button key={o.value} type="button" aria-pressed={s === o.value} disabled={disabled} onClick={() => onChange(o.value)}><span className="seg-txt">{text(o.label)}</span></button>)}
          </div>
        );
        return (
          <select id={id} value={s} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
            <option value="">{t('form.chooseOne')}</option>
            {opts.map((o) => <option key={o.value} value={o.value}>{text(o.label)}</option>)}
          </select>
        );
      }
      case 'attachment': return (
        // Only the file name is kept until the file store (Slice 0.9) takes the file itself.
        <div className="cf-files">
          {s ? <span className="pill tint">{s}{!disabled ? <button type="button" className="chip-x" aria-label={t('form.removeFile')} onClick={() => onChange(undefined)}>×</button> : null}</span> : null}
          {!s && !disabled ? (
            <label className="btn secondary sm" style={{ cursor: 'pointer' }}>{t('form.chooseFile')}
              <input id={id} type="file" style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }} onChange={(e) => { const n = e.target.files?.[0]?.name; if (n) onChange(n); e.target.value = ''; }} />
            </label>
          ) : null}
        </div>
      );
      default: {
        const ltr = f.type === 'email' || f.type === 'phone' || f.type === 'iban';
        return <input id={id} type={f.type === 'email' ? 'email' : f.type === 'phone' ? 'tel' : 'text'} dir={ltr ? 'ltr' : undefined} value={s} disabled={disabled} onChange={(e) => onChange(e.target.value)} />;
      }
    }
  })();
  const { Field } = parts;
  return <Field id={id} label={label} hint={f.help ? text(f.help) : undefined} error={err}>{input}</Field>;
}
