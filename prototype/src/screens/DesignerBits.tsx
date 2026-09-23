/* v0.16 أدوات مشتركة لصفحة تصميم الخدمة: الحقول بلغتين، ومحرر الشرط المركّب بلا سكربت (حقل / صفة الطالب / نتيجة خطوة)، وأيقونات الأنواع، والحقل الجديد من اللوحة */
import React from 'react';
import { useStore } from '../app/store';
import { I } from '../ui/icons';
import { useLang } from '../ui/components';
import { liveNeed, toISO, condLeaves, type ConfiguredService, type FormField, type FieldKind, type Cond, type CondLeaf, type RouteStep } from '../domain/policy';
import { ATTR_KEYS, ATTR_TITLE, erpListOptions, allFields, type AttrKey } from '../domain/designer';
import { useUI } from '../app/ui';
import type { T2 } from '../domain/types';

export const t2 = (ar: string, en: string): T2 => ({ ar, en });
export const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
export const uid = (p: string) => `${p}-${Date.now().toString(36).slice(-4)}${Math.floor(Math.random() * 36).toString(36)}`;
export const KIND_ICON: Record<FieldKind, keyof typeof I> = { text: 'pen', textarea: 'doc', number: 'hash', money: 'wallet', date: 'calendar', time: 'clock', daterange: 'calendar', choice: 'list', multichoice: 'grid', yesno: 'toggle', scale: 'star', person: 'person', position: 'team', unit: 'globe', attachment: 'clip', table: 'table', profile: 'idcard', computed: 'calc', checkbox: 'check', signature: 'sig', guidance: 'info' };
export const ICONS = ['letter', 'doc', 'idcard', 'card', 'passport', 'shield', 'box', 'gear', 'wallet', 'plane', 'calendar', 'team', 'person', 'home', 'globe', 'ribbon', 'sparkle', 'bell', 'grid', 'seal', 'book', 'building', 'star', 'hand', 'school'] as const;
export const TONES = ['g-green', 'g-gold', 'g-teal', 'g-sage', 'g-bronze'];

/** حقل جديد من اللوحة بقيمه الافتراضية المعقولة */
export function newField(kind: FieldKind, n: number): FormField {
  const base: FormField = { id: `f-${kind}-${n}`, kind, label: { ar: '', en: '' }, rules: {} };
  if (kind === 'choice' || kind === 'multichoice') return { ...base, source: 'manual', options: [{ id: 'o1', name: t2('', '') }, { id: 'o2', name: t2('', '') }] };
  if (kind === 'person' || kind === 'position' || kind === 'unit') return { ...base, orgFilter: 'all' };
  if (kind === 'money') return { ...base, currency: 'SAR', decimals: 2 };
  if (kind === 'attachment') return { ...base, rules: { maxFiles: 1, fileKinds: ['pdf', 'image'], maxMB: 8 } };
  if (kind === 'date') return { ...base, rules: { dateRel: 'any' } };
  if (kind === 'daterange') return { ...base, rules: { dateRel: 'any' }, workingDays: false };
  if (kind === 'scale') return { ...base, scaleMax: 5, scaleLabels: { low: t2('ضعيف', 'Poor'), high: t2('ممتاز', 'Excellent') } };
  if (kind === 'table') return { ...base, maxRows: 10, columns: [{ id: 'c1', kind: 'text', label: t2('', ''), required: true }, { id: 'c2', kind: 'number', label: t2('', '') }] };
  if (kind === 'profile') return { ...base, profileKey: 'name' };
  if (kind === 'computed') return { ...base, formula: { op: 'sum', fields: [] } };
  if (kind === 'yesno') return { ...base, rules: { required: true } };
  return base;
}

/** زوج إدخال بلغتين */
export function Bi({ label, labelEn, value, onChange, editable, id, rows, full }: { label: string; labelEn: string; value: T2 | undefined; onChange: (v: T2) => void; editable: boolean; id?: string; rows?: number; full?: boolean }) {
  const v = value || t2('', '');
  const inp = (l: 'ar' | 'en') => (rows ? <textarea id={id ? `${id}-${l}` : undefined} dir={l === 'en' ? 'ltr' : undefined} rows={rows} value={v[l]} disabled={!editable} onChange={(e) => onChange({ ...v, [l]: e.target.value })} /> : <input id={id ? `${id}-${l}` : undefined} dir={l === 'en' ? 'ltr' : undefined} value={v[l]} disabled={!editable} onChange={(e) => onChange({ ...v, [l]: e.target.value })} />);
  return <><label style={full ? { flexBasis: '100%' } : undefined}><span>{label}</span>{inp('ar')}</label><label style={full ? { flexBasis: '100%' } : undefined}><span>{labelEn}</span>{inp('en')}</label></>;
}
export function Sw({ on, set, label, hint, id, editable }: { on: boolean; set: (v: boolean) => void; label: string; hint?: string; id?: string; editable: boolean }) {
  return <label className="sw"><span>{label}{hint ? <span className="cell-sub">{hint}</span> : null}</span><input id={id} className="switch" type="checkbox" checked={on} disabled={!editable} onChange={(e) => set(e.target.checked)} /></label>;
}

/* ——— محرر الشرط المركّب: ورقة واحدة أو «كل الشروط» / «أيّ شرط»؛ مصدر الورقة حقل أو صفة الطالب أو نتيجة خطوة (بلا سكربت) ——— */
export function CondEditor({ svc, cond, onChange, editable, label, hint, selfId, steps, allowSteps = false, extraFields }: { svc: ConfiguredService; cond: Cond | undefined; onChange: (c: Cond | undefined) => void; editable: boolean; label: string; hint?: string; selfId?: string; steps?: RouteStep[]; allowSteps?: boolean; extraFields?: FormField[] }) {
  const { state } = useStore(); const { lang, tx } = useLang(); const { L } = useUI(); const dz = L.dz; const x = dz.v16.field; const today = toISO(Date.now());
  const fields = [...allFields(svc), ...(extraFields || [])].filter((f) => f.id !== selfId && f.kind !== 'guidance' && f.kind !== 'attachment' && f.kind !== 'signature');
  const leaves = condLeaves(cond); const mode: 'all' | 'any' = cond && !('field' in cond) && cond.any?.length && !cond.all?.length ? 'any' : 'all';
  const emit = (ls: CondLeaf[], m: 'all' | 'any') => { if (!ls.length) return onChange(undefined); if (ls.length === 1) return onChange(ls[0]); onChange(m === 'any' ? { any: ls } : { all: ls }); };
  const srcOf = (f: string): 'field' | 'attr' | 'step' => (f.startsWith('@') ? 'attr' : f.startsWith('#') ? 'step' : 'field');
  const kindOf = (f: string): FormField['kind'] | 'attr' | 'outcome' | undefined => { if (f.startsWith('@')) return 'attr'; if (f.startsWith('#')) return f.includes('.') && !f.endsWith('.outcome') ? 'text' : 'outcome'; return fields.find((z) => z.id === f)?.kind; };
  const valueInput = (leaf: CondLeaf, set: (v: string) => void) => {
    const f = leaf.field; const k = kindOf(f);
    if (leaf.op === 'set' || leaf.op === 'unset') return null;
    if (f === '@group') return <select className="select-in" value={leaf.value || ''} disabled={!editable} onChange={(e) => set(e.target.value)}><option value="">—</option>{state.groups.map((g) => <option key={g.id} value={g.id}>{tx(g.name)}</option>)}</select>;
    if (f === '@subgroup') return <select className="select-in" value={leaf.value || ''} disabled={!editable} onChange={(e) => set(e.target.value)}><option value="">—</option>{state.groups.flatMap((g) => g.subgroups).map((g) => <option key={g.id} value={g.id}>{tx(g.name)}</option>)}</select>;
    if (f === '@location') return <select className="select-in" value={leaf.value || ''} disabled={!editable} onChange={(e) => set(e.target.value)}><option value="">—</option><option value="riyadh">{lang === 'ar' ? 'الرياض' : 'Riyadh'}</option><option value="abudhabi">{lang === 'ar' ? 'أبوظبي' : 'Abu Dhabi'}</option></select>;
    if (f === '@gender') return <select className="select-in" value={leaf.value || ''} disabled={!editable} onChange={(e) => set(e.target.value)}><option value="">—</option><option value="m">{lang === 'ar' ? 'ذكر' : 'Male'}</option><option value="f">{lang === 'ar' ? 'أنثى' : 'Female'}</option></select>;
    if (f === '@parent' || f === '@outsideHome') return <select className="select-in" value={leaf.value || 'true'} disabled={!editable} onChange={(e) => set(e.target.value)}><option value="true">{dz.rq.yes}</option><option value="">{dz.rq.no}</option></select>;
    if (f === '@level') return <select className="select-in" value={leaf.value || ''} disabled={!editable} onChange={(e) => set(e.target.value)}><option value="">—</option>{(['section', 'department', 'ga', 'sector', 'sg'] as const).map((l) => <option key={l} value={l}>{l}</option>)}</select>;
    if (k === 'outcome') { const sid = f.slice(1).split('.')[0]; const st = (steps || []).find((z) => z.id === sid); const outs = liveNeed(st?.form?.outcomes || [], today); return <select className="select-in" value={leaf.value || ''} disabled={!editable} onChange={(e) => set(e.target.value)}><option value="">—</option><option value="__approved">{dz.v16.step.approved}</option>{outs.map((o) => <option key={o.id} value={o.id}>{tx(o.name)}</option>)}</select>; }
    const ff = fields.find((z) => z.id === f);
    if (ff && (ff.kind === 'choice' || ff.kind === 'multichoice') && leaf.op !== 'in') { const opts = ff.source === 'erp' && ff.erpList ? erpListOptions(state, ff.erpList) : liveNeed(ff.options || [], today); return <select className="select-in" value={leaf.value || ''} disabled={!editable} onChange={(e) => set(e.target.value)}><option value="">—</option>{opts.map((o) => <option key={o.id} value={o.id}>{tx(o.name) || o.id}</option>)}</select>; }
    if (ff && ff.kind === 'yesno') return <select className="select-in" value={leaf.value || 'yes'} disabled={!editable} onChange={(e) => set(e.target.value)}><option value="yes">{dz.rq.yes}</option><option value="no">{dz.rq.no}</option></select>;
    if (ff && ff.kind === 'checkbox') return <select className="select-in" value={leaf.value || 'true'} disabled={!editable} onChange={(e) => set(e.target.value)}><option value="true">{dz.rq.yes}</option><option value="">{dz.rq.no}</option></select>;
    return <input value={leaf.value || ''} disabled={!editable} onChange={(e) => set(e.target.value)} />;
  };
  const opsFor = (f: string): CondLeaf['op'][] => { const k = kindOf(f); if (k === 'number' || k === 'money' || k === 'computed' || k === 'scale' || f === '@serviceMonths') return ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'set', 'unset']; if (k === 'multichoice') return ['eq', 'ne', 'in', 'set', 'unset']; if (k === 'outcome') return ['eq', 'ne']; return ['eq', 'ne', 'in', 'set', 'unset']; };
  const stepOpts = (steps || []).map((s, i) => ({ id: s.id, title: s.title ? tx(s.title) : `${lang === 'ar' ? 'الخطوة' : 'Step'} ${i + 1}`, fields: liveNeed(s.form?.fields || [], today) })).filter((s) => !!s.id);
  return (
    <div className="dz-cond">
      <div className="dz-cond-head"><span>{label}</span>{hint ? <span className="cell-sub">{hint}</span> : null}
        {leaves.length > 1 ? <div className="segmented sm"><button type="button" aria-pressed={mode === 'all'} disabled={!editable} onClick={() => emit(leaves, 'all')}><span className="seg-txt">{x.condAll}</span></button><button type="button" aria-pressed={mode === 'any'} disabled={!editable} onClick={() => emit(leaves, 'any')}><span className="seg-txt">{x.condAny}</span></button></div> : null}
      </div>
      {leaves.map((leaf, i) => { const src = srcOf(leaf.field); const setLeaf = (nl: CondLeaf) => emit(leaves.map((z, k) => (k === i ? nl : z)), mode); return (
        <div key={i} className="ed-row dz-cond-row">
          <label><span>{x.condOf}</span><select className="select-in" value={src} disabled={!editable} onChange={(e) => { const v = e.target.value as 'field' | 'attr' | 'step'; setLeaf({ field: v === 'attr' ? '@group' : v === 'step' ? `#${stepOpts[0]?.id || ''}` : fields[0]?.id || '', op: 'eq', value: '' }); }}><option value="field">{x.condSources.field}</option><option value="attr">{x.condSources.attr}</option>{allowSteps && stepOpts.length ? <option value="step">{x.condSources.step}</option> : null}</select></label>
          <label><span>{dz.form.condField}</span>
            {src === 'attr' ? <select className="select-in" value={leaf.field} disabled={!editable} onChange={(e) => setLeaf({ ...leaf, field: e.target.value, value: '' })}>{ATTR_KEYS.map((k: AttrKey) => <option key={k} value={`@${k}`}>{tx(ATTR_TITLE[k])}</option>)}</select>
              : src === 'step' ? <select className="select-in" value={leaf.field} disabled={!editable} onChange={(e) => setLeaf({ ...leaf, field: e.target.value, value: '' })}>{stepOpts.map((s) => <React.Fragment key={s.id}><option value={`#${s.id}`}>{s.title}: {lang === 'ar' ? 'النتيجة' : 'outcome'}</option>{s.fields.map((f) => <option key={f.id} value={`#${s.id}.${f.id}`}>{s.title}: {tx(f.label) || f.id}</option>)}</React.Fragment>)}</select>
              : <select className="select-in" value={leaf.field} disabled={!editable} onChange={(e) => setLeaf({ ...leaf, field: e.target.value, value: '' })}>{fields.map((f) => <option key={f.id} value={f.id}>{tx(f.label) || f.id}</option>)}</select>}
          </label>
          <label><span>{dz.form.condOp}</span><select className="select-in" value={leaf.op} disabled={!editable} onChange={(e) => setLeaf({ ...leaf, op: e.target.value as CondLeaf['op'] })}>{opsFor(leaf.field).map((o) => <option key={o} value={o}>{dz.form.ops[o]}</option>)}</select></label>
          {leaf.op !== 'set' && leaf.op !== 'unset' ? <label><span>{dz.form.condValue}</span>{valueInput(leaf, (v) => setLeaf({ ...leaf, value: v }))}</label> : null}
          {editable ? <button type="button" className="icon-btn" aria-label={dz.form.remove} onClick={() => emit(leaves.filter((_, k) => k !== i), mode)}><I.x /></button> : null}
        </div>
      ); })}
      {editable ? <button type="button" className="btn quiet sm" onClick={() => emit([...leaves, { field: fields[0]?.id || '@group', op: leaves.length ? 'eq' : 'eq', value: '' }], mode)}><I.plus />{leaves.length ? x.addCond : dz.form.condField}</button> : !leaves.length ? <span className="cell-sub">{dz.form.always}</span> : null}
    </div>
  );
}
