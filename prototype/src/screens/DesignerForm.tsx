/* v0.16 محرر النموذج: الأقسام والحقول من اللوحة الموسّعة، وورقة الحقل بخصائص كل نوع وتحققات المعجم والشرط المركّب والقيمة الافتراضية —
   تُستعمل للنموذج ولحقول نماذج الخطوات (§3-ب) على السواء. الإلغاء بتاريخ لا الحذف لما كان في الأساس (P-12). */
import React, { useState } from 'react';
import { useStore } from '../app/store';
import { I } from '../ui/icons';
import { Group, Notice, Pill, Sheet, useLang } from '../ui/components';
import { Stagger, Item, Press } from '../ui/motion';
import { liveNeed, toISO, FIELD_KINDS, ERP_LIST_KEYS, PROFILE_KEYS, type ConfiguredService, type FormField, type FormSection, type FieldKind, type FieldRule, type ChoiceOption, type ErpListKey, type NamedPattern, type TableColumn, type FieldDefault, type ProfileKey, type Formula, type RouteStep } from '../domain/policy';
import { ERP_LIST_TITLE, PROFILE_TITLE, allFields, erpListOptions } from '../domain/designer';
import { EndDate } from './NeedPolicyCenter';
import { useUI } from '../app/ui';
import { KIND_ICON, newField, uid, t2, Bi, Sw, CondEditor } from './DesignerBits';

export function FieldSheet({ svc, field, editable, inBase, onChange, onRemove, onClose, forStep, steps, palette }: { svc: ConfiguredService; field: FormField | undefined; editable: boolean; inBase: boolean; onChange: (f: FormField) => void; onRemove: () => void; onClose: () => void; forStep?: boolean; steps?: RouteStep[]; palette?: FieldKind[] }) {
  const { state } = useStore(); const { lang, t, tx } = useLang(); const { L } = useUI(); const dz = L.dz; const x = dz.v16.field; const today = toISO(Date.now());
  const f = field; const open = !!f;
  const U = (patch: Partial<FormField>) => { if (f) onChange({ ...f, ...patch }); };
  const R = (patch: Partial<FieldRule>) => { if (f) onChange({ ...f, rules: { ...(f.rules || {}), ...patch } }); };
  const others = f ? allFields(svc).filter((z) => z.id !== f.id) : [];
  const numFields = others.filter((z) => z.kind === 'number' || z.kind === 'money' || z.kind === 'computed' || z.kind === 'scale' || z.kind === 'table' || z.kind === 'profile');
  const dateFields = others.filter((z) => z.kind === 'date' || z.kind === 'daterange');
  const stepFieldOutcome: FormField[] = forStep ? [{ id: '__outcome', kind: 'choice', label: t2('خيار القرار', 'Decision option'), source: 'manual', options: (steps || []).flatMap((s) => liveNeed(s.form?.outcomes || [], today)).map((o) => ({ id: o.id, name: o.name })) }] : [];
  void palette;
  return (
    <Sheet open={open} onClose={onClose} title={f ? (tx(f.label) || dz.form.field) : ''} lead={f ? <span className="qicon g-green" style={{ width: 40, height: 40, borderRadius: 13 }}>{React.createElement(I[KIND_ICON[f.kind]] || I.doc)}</span> : null}>
      {f ? (() => { const r = f.rules || {}; return (
        <div className="type-editor">
          <div className="section-label" style={{ paddingTop: 0 }}><span>{dz.form.kinds[f.kind]}</span><Pill tone="tint"><span className="mono">{f.id}</span></Pill></div>
          <Group><div className="ed-row" style={{ padding: '12px 16px 8px' }}>
            {f.kind === 'guidance' ? (<>
              <label style={{ flexBasis: '100%' }}><span>{dz.form.guidanceText}</span><textarea id="dz-f-label-ar" rows={2} value={f.label.ar} disabled={!editable} onChange={(e) => U({ label: { ...f.label, ar: e.target.value } })} /></label>
              <label style={{ flexBasis: '100%' }}><span>{dz.form.guidanceTextEn}</span><textarea dir="ltr" rows={2} value={f.label.en} disabled={!editable} onChange={(e) => U({ label: { ...f.label, en: e.target.value } })} /></label>
            </>) : (<>
              <label><span>{dz.form.label}</span><input id="dz-f-label-ar" value={f.label.ar} disabled={!editable} onChange={(e) => U({ label: { ...f.label, ar: e.target.value } })} /></label>
              <label><span>{dz.form.labelEn}</span><input id="dz-f-label-en" dir="ltr" value={f.label.en} disabled={!editable} onChange={(e) => U({ label: { ...f.label, en: e.target.value } })} /></label>
              <Bi label={dz.form.hint} labelEn={dz.form.hintEn} value={f.hint} onChange={(v) => U({ hint: v.ar || v.en ? v : undefined })} editable={editable} />
              {f.kind === 'text' || f.kind === 'textarea' || f.kind === 'number' || f.kind === 'money' ? <Bi label={dz.form.placeholder} labelEn={dz.form.placeholderEn} value={f.placeholder} onChange={(v) => U({ placeholder: v.ar || v.en ? v : undefined })} editable={editable} /> : null}
            </>)}
            {f.kind === 'profile' ? <label style={{ flexBasis: '100%' }}><span>{x.profileKey}</span><select id="dz-f-profile" className="select-in" value={f.profileKey || 'name'} disabled={!editable} onChange={(e) => U({ profileKey: e.target.value as ProfileKey })}>{PROFILE_KEYS.map((k) => <option key={k} value={k}>{tx(PROFILE_TITLE[k])}</option>)}</select></label> : null}
            {f.kind === 'computed' ? (<>
              <label><span>{x.formula}</span><select id="dz-f-formula" className="select-in" value={f.formula?.op || 'sum'} disabled={!editable} onChange={(e) => U({ formula: { ...(f.formula || { fields: [] }), op: e.target.value as Formula['op'] } })}>{(['sum', 'diff', 'product', 'divide', 'daysBetween', 'workingDaysBetween', 'percent', 'count'] as const).map((o) => <option key={o} value={o}>{x.formulaOps[o]}</option>)}</select></label>
              {f.formula?.op === 'percent' ? <label><span>{x.percent}</span><input className="num-in num" type="number" min={0} max={100} value={f.formula?.percent ?? ''} disabled={!editable} onChange={(e) => U({ formula: { ...(f.formula || { op: 'percent', fields: [] }), percent: Number(e.target.value) } })} /></label> : null}
              <label style={{ flexBasis: '100%' }}><span>{x.formulaFields}</span><span className="chips">{(f.formula?.op === 'daysBetween' || f.formula?.op === 'workingDaysBetween' ? dateFields : f.formula?.op === 'count' ? others.filter((z) => z.kind === 'table') : numFields).map((z) => { const on = (f.formula?.fields || []).includes(z.id); return <button key={z.id} type="button" className={`pill ${on ? 'tint' : ''}`} aria-pressed={on} disabled={!editable} onClick={() => U({ formula: { ...(f.formula || { op: 'sum' }), fields: on ? (f.formula?.fields || []).filter((q) => q !== z.id) : [...(f.formula?.fields || []), z.id] } })}>{on ? <I.check /> : <I.plus />}{tx(z.label) || z.id}</button>; })}</span></label>
            </>) : null}
            {f.kind === 'scale' ? (<>
              <label><span>{x.scaleMax}</span><select className="select-in" value={String(f.scaleMax || 5)} disabled={!editable} onChange={(e) => U({ scaleMax: Number(e.target.value) })}>{[3, 4, 5, 7, 10].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
              <Bi label={x.scaleLow} labelEn={`${x.scaleLow} (EN)`} value={f.scaleLabels?.low} onChange={(v) => U({ scaleLabels: { low: v, high: f.scaleLabels?.high || t2('', '') } })} editable={editable} />
              <Bi label={x.scaleHigh} labelEn={`${x.scaleHigh} (EN)`} value={f.scaleLabels?.high} onChange={(v) => U({ scaleLabels: { low: f.scaleLabels?.low || t2('', ''), high: v } })} editable={editable} />
            </>) : null}
          </div></Group>
          {f.kind === 'table' ? (<>
            <div className="section-label"><span>{x.columns}</span></div>
            <Group><div className="ed-row" style={{ padding: '12px 16px 8px' }}>
              {(f.columns || []).map((c, ci) => { const gone = c.endedAt && c.endedAt <= today; const setC = (patch: Partial<TableColumn>) => U({ columns: (f.columns || []).map((z) => (z.id === c.id ? { ...z, ...patch } : z)) }); return (
                <div key={c.id} className={`dz-col ${gone ? 'off' : ''}`}>
                  <select className="select-in" value={c.kind} disabled={!editable} onChange={(e) => setC({ kind: e.target.value as TableColumn['kind'] })}>{(['text', 'number', 'money', 'date', 'choice'] as const).map((k) => <option key={k} value={k}>{x.colKinds[k]}</option>)}</select>
                  <input id={`dz-col-${ci}-ar`} placeholder={dz.form.label} value={c.label.ar} disabled={!editable} onChange={(e) => setC({ label: { ...c.label, ar: e.target.value } })} />
                  <input dir="ltr" placeholder={dz.form.labelEn} value={c.label.en} disabled={!editable} onChange={(e) => setC({ label: { ...c.label, en: e.target.value } })} />
                  <label className="dz-col-req"><input type="checkbox" checked={!!c.required} disabled={!editable} onChange={(e) => setC({ required: e.target.checked })} /><span>{x.colRequired}</span></label>
                  {c.kind === 'choice' ? <input dir="auto" placeholder={lang === 'ar' ? 'الخيارات مفصولة بفاصلة (عربي=إنجليزي)' : 'Options comma-separated (ar=en)'} value={(c.options || []).map((o) => `${o.name.ar}=${o.name.en}`).join(', ')} disabled={!editable} onChange={(e) => setC({ options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean).map((s, k) => { const [ar, en] = s.split('='); return { id: `o${k + 1}`, name: t2(ar.trim(), (en || ar).trim()) }; }) })} /> : null}
                  {editable ? <button type="button" className="icon-btn" aria-label={dz.form.remove} onClick={() => U({ columns: (f.columns || []).filter((z) => z.id !== c.id) })}><I.x /></button> : null}
                </div>
              ); })}
              {editable ? <button type="button" className="btn quiet" onClick={() => U({ columns: [...(f.columns || []), { id: uid('c'), kind: 'text', label: t2('', '') }] })}><I.plus />{x.addColumn}</button> : null}
              <label><span>{x.minRows}</span><input className="num-in num" type="number" min={0} value={f.minRows ?? ''} disabled={!editable} onChange={(e) => U({ minRows: e.target.value === '' ? undefined : Number(e.target.value) })} /></label>
              <label><span>{x.maxRows}</span><input className="num-in num" type="number" min={1} value={f.maxRows ?? ''} disabled={!editable} onChange={(e) => U({ maxRows: e.target.value === '' ? undefined : Number(e.target.value) })} /></label>
            </div></Group>
          </>) : null}
          {f.kind !== 'guidance' && f.kind !== 'profile' && f.kind !== 'computed' ? (<>
            <div className="section-label"><span>{dz.form.rules}</span></div>
            <Group><div className="ed-row" style={{ padding: '12px 16px 8px' }}>
              <Sw on={!!r.required} set={(v) => R({ required: v })} label={dz.form.required} id="dz-f-required" editable={editable} />
              {f.kind === 'text' || f.kind === 'textarea' ? (<>
                <label><span>{dz.form.minLen}</span><input className="num-in num" type="number" min={0} value={r.minLen ?? ''} disabled={!editable} onChange={(e) => R({ minLen: e.target.value === '' ? undefined : Number(e.target.value) })} /></label>
                <label><span>{dz.form.maxLen}</span><input className="num-in num" type="number" min={1} value={r.maxLen ?? ''} disabled={!editable} onChange={(e) => R({ maxLen: e.target.value === '' ? undefined : Number(e.target.value) })} /></label>
                {f.kind === 'text' ? <label><span>{dz.form.pattern}</span><select className="select-in" value={r.pattern || 'none'} disabled={!editable} onChange={(e) => R({ pattern: e.target.value as NamedPattern })}>{(['none', 'email', 'phone', 'nationalId', 'iban', 'plate', 'url'] as const).map((p) => <option key={p} value={p}>{dz.form.patterns[p]}</option>)}</select></label> : null}
                {f.kind === 'textarea' ? <Sw on={!!f.bilingual} set={(v) => U({ bilingual: v })} label={dz.form.bilingual} editable={editable} /> : null}
                {f.kind === 'text' ? <Sw on={!!r.unique} set={(v) => R({ unique: v })} label={x.unique} editable={editable} /> : null}
              </>) : null}
              {f.kind === 'number' || f.kind === 'money' ? (<>
                <label><span>{dz.form.min}</span><input className="num-in num" type="number" value={r.min ?? ''} disabled={!editable} onChange={(e) => R({ min: e.target.value === '' ? undefined : Number(e.target.value) })} /></label>
                <label><span>{dz.form.max}</span><input className="num-in num" type="number" value={r.max ?? ''} disabled={!editable} onChange={(e) => R({ max: e.target.value === '' ? undefined : Number(e.target.value) })} /></label>
                {f.kind === 'money' ? (<><label><span>{dz.form.currency}</span><select className="select-in" value={f.currency || 'SAR'} disabled={!editable} onChange={(e) => U({ currency: e.target.value })}>{erpListOptions(state, 'currencies').map((c) => <option key={c.id} value={c.id}>{tx(c.name)} · {c.id}</option>)}</select></label><label><span>{dz.form.decimals}</span><select className="select-in" value={String(f.decimals ?? 2)} disabled={!editable} onChange={(e) => U({ decimals: Number(e.target.value) })}><option value="0">0</option><option value="2">2</option></select></label></>) : null}
                <label><span>{x.lteField}</span><select className="select-in" value={r.lteField || ''} disabled={!editable} onChange={(e) => R({ lteField: e.target.value || undefined })}><option value="">—</option>{numFields.filter((z) => z.kind !== 'table' && z.kind !== 'profile').map((z) => <option key={z.id} value={z.id}>{tx(z.label) || z.id}</option>)}</select></label>
                {f.kind === 'number' ? <Sw on={!!r.unique} set={(v) => R({ unique: v })} label={x.unique} editable={editable} /> : null}
              </>) : null}
              {f.kind === 'date' || f.kind === 'daterange' ? (<>
                <label><span>{dz.form.dateRel}</span><select className="select-in" value={r.dateRel || 'any'} disabled={!editable} onChange={(e) => R({ dateRel: e.target.value as FieldRule['dateRel'] })}>{(['any', 'todayOrFuture', 'future', 'past'] as const).map((d) => <option key={d} value={d}>{dz.form.dateRels[d]}</option>)}</select></label>
                {f.kind === 'date' ? <label><span>{x.afterField}</span><select className="select-in" value={r.afterField || ''} disabled={!editable} onChange={(e) => R({ afterField: e.target.value || undefined })}><option value="">—</option>{dateFields.map((z) => <option key={z.id} value={z.id}>{tx(z.label) || z.id}</option>)}</select></label> : null}
                {f.kind === 'daterange' ? (<><label><span>{dz.form.maxDays}</span><input className="num-in num" type="number" min={1} value={r.maxDays ?? ''} disabled={!editable} onChange={(e) => R({ maxDays: e.target.value === '' ? undefined : Number(e.target.value) })} /></label><Sw on={!!f.workingDays} set={(v) => U({ workingDays: v })} label={dz.form.workingDays} editable={editable} /></>) : null}
              </>) : null}
              {f.kind === 'attachment' ? (<>
                <label><span>{dz.form.maxFiles}</span><input className="num-in num" type="number" min={1} max={10} value={r.maxFiles ?? 1} disabled={!editable} onChange={(e) => R({ maxFiles: Number(e.target.value) })} /></label>
                <label><span>{dz.form.maxMB}</span><input className="num-in num" type="number" min={1} max={100} value={r.maxMB ?? 8} disabled={!editable} onChange={(e) => R({ maxMB: Number(e.target.value) })} /></label>
                <label style={{ flexBasis: '100%' }}><span>{dz.form.fileKinds}</span><span className="chips">{(['pdf', 'image', 'doc'] as const).map((k) => { const on = (r.fileKinds || []).includes(k); return <button key={k} type="button" className={`pill ${on ? 'tint' : ''}`} aria-pressed={on} disabled={!editable} onClick={() => R({ fileKinds: on ? (r.fileKinds || []).filter((z) => z !== k) : [...(r.fileKinds || []), k] })}>{on ? <I.check /> : <I.plus />}{dz.form.fileKind[k]}</button>; })}</span></label>
              </>) : null}
              {f.kind === 'person' || f.kind === 'position' || f.kind === 'unit' ? <label><span>{dz.form.orgFilter}</span><div className="segmented sm">{(['unit', 'sector', 'all'] as const).map((o) => <button key={o} type="button" aria-pressed={(f.orgFilter || 'all') === o} disabled={!editable} onClick={() => U({ orgFilter: o })}><span className="seg-txt">{dz.form.orgFilters[o]}</span></button>)}</div></label> : null}
              {f.kind !== 'checkbox' && f.kind !== 'attachment' && f.kind !== 'signature' && !forStep ? <Sw on={!!f.inDoc} set={(v) => U({ inDoc: v })} label={dz.form.inDoc} editable={editable} /> : null}
            </div></Group>
            {f.kind === 'choice' || f.kind === 'multichoice' ? (<>
              <div className="section-label"><span>{dz.form.options}</span></div>
              <Group><div className="ed-row" style={{ padding: '12px 16px 8px' }}>
                <label style={{ flexBasis: '100%' }}><span>{dz.form.source}</span><div className="segmented sm"><button type="button" aria-pressed={f.source !== 'erp'} disabled={!editable} onClick={() => U({ source: 'manual' })}><span className="seg-txt">{dz.form.sourceManual}</span></button><button type="button" aria-pressed={f.source === 'erp'} disabled={!editable} onClick={() => U({ source: 'erp', erpList: f.erpList || 'countries' })}><span className="seg-txt">{dz.form.sourceErp}</span></button></div></label>
                {f.source === 'erp' ? (<><label style={{ flexBasis: '100%' }}><span>{dz.form.erpList}</span><select className="select-in" value={f.erpList || ''} disabled={!editable} onChange={(e) => U({ erpList: e.target.value as ErpListKey })}>{ERP_LIST_KEYS.map((k) => <option key={k} value={k}>{tx(ERP_LIST_TITLE[k])} · {erpListOptions(state, k).length}</option>)}</select><span className="cell-sub">{dz.form.erpHint}</span></label>
                  <span className="chips" style={{ flexBasis: '100%' }}>{(f.erpList ? erpListOptions(state, f.erpList) : []).slice(0, 8).map((o) => <span key={o.id} className="pill">{tx(o.name)}</span>)}{f.erpList && erpListOptions(state, f.erpList).length > 8 ? <span className="cell-sub">+{erpListOptions(state, f.erpList).length - 8}</span> : null}</span></>) : (<>
                  {(f.options || []).map((o, oi) => { const gone = o.endedAt && o.endedAt <= today; return (
                    <div key={o.id} className={`dz-opt ${gone ? 'off' : ''}`}>
                      <input id={`dz-opt-${oi}-ar`} placeholder={dz.form.option} value={o.name.ar} disabled={!editable} onChange={(e) => U({ options: (f.options || []).map((z) => (z.id === o.id ? { ...z, name: { ...z.name, ar: e.target.value } } : z)) })} />
                      <input dir="ltr" placeholder={dz.form.optionEn} value={o.name.en} disabled={!editable} onChange={(e) => U({ options: (f.options || []).map((z) => (z.id === o.id ? { ...z, name: { ...z.name, en: e.target.value } } : z)) })} />
                      {editable ? (inBase ? <input type="date" dir="ltr" className="num" title={t.need.policy.end} value={o.endedAt || ''} min={today} onChange={(e) => U({ options: (f.options || []).map((z) => (z.id === o.id ? { ...z, endedAt: e.target.value || undefined } : z)) })} /> : <button type="button" className="icon-btn" aria-label={dz.form.remove} onClick={() => U({ options: (f.options || []).filter((z) => z.id !== o.id) })}><I.x /></button>) : null}
                    </div>
                  ); })}
                  {editable ? <button type="button" className="btn quiet" onClick={() => U({ options: [...(f.options || []), { id: uid('o'), name: t2('', '') } as ChoiceOption] })}><I.plus />{dz.form.addOption}</button> : null}
                </>)}
              </div></Group>
            </>) : null}
            <div className="section-label"><span>{x.default}</span></div>
            <Group><div className="ed-row" style={{ padding: '12px 16px 8px' }}>
              <label><span>{x.default}</span><select className="select-in" value={f.default?.kind || 'none'} disabled={!editable} onChange={(e) => { const k = e.target.value as FieldDefault['kind'] | 'none'; U({ default: k === 'none' ? undefined : { kind: k, value: '', profileKey: 'name' } }); }}><option value="none">{x.defaults.none}</option><option value="static">{x.defaults.static}</option>{f.kind === 'date' || f.kind === 'daterange' ? <option value="today">{x.defaults.today}</option> : null}{f.kind === 'text' || f.kind === 'textarea' || f.kind === 'number' || f.kind === 'money' ? <option value="profile">{x.defaults.profile}</option> : null}<option value="field">{x.defaults.field}</option>{f.kind === 'person' || f.kind === 'position' || f.kind === 'unit' ? <option value="me">{x.defaults.me}</option> : null}</select></label>
              {f.default?.kind === 'static' ? <label><span>{dz.form.condValue}</span><input value={f.default.value || ''} disabled={!editable} onChange={(e) => U({ default: { kind: 'static', value: e.target.value } })} /></label> : null}
              {f.default?.kind === 'profile' ? <label><span>{x.profileKey}</span><select className="select-in" value={f.default.profileKey || 'name'} disabled={!editable} onChange={(e) => U({ default: { kind: 'profile', profileKey: e.target.value as ProfileKey } })}>{PROFILE_KEYS.map((k) => <option key={k} value={k}>{tx(PROFILE_TITLE[k])}</option>)}</select></label> : null}
              {f.default?.kind === 'field' ? <label><span>{dz.form.condField}</span><select className="select-in" value={f.default.field || ''} disabled={!editable} onChange={(e) => U({ default: { kind: 'field', field: e.target.value } })}><option value="">—</option>{others.filter((z) => z.kind === f.kind).map((z) => <option key={z.id} value={z.id}>{tx(z.label) || z.id}</option>)}</select></label> : null}
            </div></Group>
          </>) : null}
          {/* الشروط لكل الأنواع: «يظهر إذا» حتى لحقول الملف والمحسوب والإرشاد (خريطة الحالات 1.7)؛ «مطلوب إذا» و«للقراءة إذا» لحقول الإدخال فقط */}
          <Group><div style={{ padding: '10px 16px 12px' }}>
            <CondEditor svc={svc} cond={r.showIf} onChange={(c) => R({ showIf: c })} editable={editable} label={dz.form.showIf} selfId={f.id} steps={steps} extraFields={stepFieldOutcome} />
            {f.kind !== 'guidance' && f.kind !== 'profile' && f.kind !== 'computed' ? <CondEditor svc={svc} cond={r.requiredIf} onChange={(c) => R({ requiredIf: c })} editable={editable} label={dz.form.requiredIf} selfId={f.id} steps={steps} extraFields={stepFieldOutcome} /> : null}
            {f.kind !== 'guidance' && f.kind !== 'profile' && f.kind !== 'computed' && !forStep ? <CondEditor svc={svc} cond={r.readOnlyIf} onChange={(c) => R({ readOnlyIf: c })} editable={editable} label={x.readOnlyIf} selfId={f.id} steps={steps} /> : null}
          </div></Group>
          {editable ? <div className="kbd-row" style={{ paddingTop: 10 }}>{inBase ? <EndDate endedAt={f.endedAt} editable={editable} today={today} onChange={(endedAt) => U({ endedAt })} t={t} lang={lang} /> : <button type="button" className="btn quiet" onClick={() => { onRemove(); onClose(); }}><I.trash />{dz.form.remove}</button>}</div> : null}
          {inBase ? <p className="cell-sub" style={{ margin: '6px 0 0' }}>{dz.form.endedHint}</p> : null}
        </div>
      ); })() : null}
    </Sheet>
  );
}

/** لوحة الحقول: ثابتة (المبدأ 1) — كل نوع بشرح سطر */
export function PaletteSheet({ open, onClose, onPick, kinds = FIELD_KINDS }: { open: boolean; onClose: () => void; onPick: (k: FieldKind) => void; kinds?: FieldKind[] }) {
  const { L } = useUI(); const dz = L.dz;
  return (
    <Sheet open={open} onClose={onClose} title={dz.form.palette}>
      <p className="cell-sub" style={{ margin: '0 0 10px' }}>{dz.form.paletteHint}</p>
      <div className="dz-palette">{kinds.map((k) => { const Ic = I[KIND_ICON[k]] || I.doc; return <Press key={k} className="dz-pal" onClick={() => onPick(k)} lift><span className="cell-lead"><Ic /></span><b>{dz.form.kinds[k]}</b><span>{dz.form.kindHint[k]}</span></Press>; })}</div>
    </Sheet>
  );
}

/** صف حقل في القائمة */
export function FieldRow({ f, svc, onOpen, tools, gone }: { f: FormField; svc: ConfiguredService; onOpen: () => void; tools?: React.ReactNode; gone?: boolean }) {
  const { tx, t } = useLang(); const { L } = useUI(); const dz = L.dz; const Ic = I[KIND_ICON[f.kind]] || I.doc;
  const showIf = f.rules?.showIf; const leaf = showIf ? ('field' in showIf ? showIf : (showIf.all || showIf.any || [])[0]) : undefined; const other = leaf ? allFields(svc).find((z) => z.id === leaf.field) : undefined;
  return (
    <div className={`dz-field ${gone ? 'off' : ''}`}>
      <button type="button" className="dz-field-main" onClick={onOpen}>
        <span className={`cell-lead ${f.kind === 'guidance' ? 'plain' : ''}`}><Ic /></span>
        <span className="cell-main"><span className="cell-title">{tx(f.label) || <em className="dz-unnamed">{dz.form.label}…</em>}</span><span className="cell-sub">{dz.form.kinds[f.kind]}{f.rules?.required ? ` · ${dz.form.required}` : ''}{showIf ? ` · ${dz.form.showIf} ${other ? tx(other.label) : leaf?.field.startsWith('@') ? dz.v16.field.condSources.attr : '…'}` : ''}{f.source === 'erp' && f.erpList ? ` · ${tx(ERP_LIST_TITLE[f.erpList])}` : ''}{f.kind === 'profile' && f.profileKey ? ` · ${tx(PROFILE_TITLE[f.profileKey])}` : ''}{f.kind === 'computed' && f.formula ? ` · ${dz.v16.field.formulaOps[f.formula.op]}` : ''}{f.endedAt ? ` · ${t.need.policy.ended} ${f.endedAt}` : ''}</span></span>
        <I.chev className="chev dirchev" />
      </button>
      {tools}
    </div>
  );
}

/** تبويب النموذج: الأقسام وحقولها */
export function FormEditor({ svc, setSvc, editable, inBase, baseSvc }: { svc: ConfiguredService; setSvc: (f: (s: ConfiguredService) => ConfiguredService) => void; editable: boolean; inBase: (sid: string, fid?: string) => boolean; baseSvc?: ConfiguredService }) {
  const { lang, t, tx } = useLang(); const { L } = useUI(); const dz = L.dz; const today = toISO(Date.now());
  const [palette, setPalette] = useState<string | null>(null); const [edit, setEdit] = useState<{ sid: string; fid: string } | null>(null);
  const editing = edit ? svc.sections.find((z) => z.id === edit.sid)?.fields.find((f) => f.id === edit.fid) : undefined;
  const updSection = (sid: string, patch: Partial<FormSection>) => setSvc((s) => ({ ...s, sections: s.sections.map((z) => (z.id === sid ? { ...z, ...patch } : z)) }));
  const setField = (sid: string, f: FormField) => setSvc((s) => ({ ...s, sections: s.sections.map((z) => (z.id === sid ? { ...z, fields: z.fields.map((q) => (q.id === f.id ? f : q)) } : z)) }));
  const moveField = (sid: string, i: number, d: -1 | 1) => setSvc((s) => { const secx = s.sections.find((z) => z.id === sid); if (!secx) return s; const j = i + d; if (j < 0 || j >= secx.fields.length) return s; const arr = secx.fields.slice(); [arr[i], arr[j]] = [arr[j], arr[i]]; return { ...s, sections: s.sections.map((z) => (z.id === sid ? { ...z, fields: arr } : z)) }; });
  const removeField = (sid: string, fid: string) => setSvc((s) => ({ ...s, sections: s.sections.map((z) => (z.id === sid ? { ...z, fields: z.fields.filter((f) => f.id !== fid) } : z)) }));
  const removeSection = (sid: string) => setSvc((s) => ({ ...s, sections: s.sections.filter((z) => z.id !== sid) }));
  const addField = (sid: string, kind: FieldKind) => { const n = allFields(svc).length + 1; const f = newField(kind, n); setSvc((s) => ({ ...s, sections: s.sections.map((z) => (z.id === sid ? { ...z, fields: [...z.fields, f] } : z)) })); setPalette(null); setEdit({ sid, fid: f.id }); };
  const addSection = () => { const sid = uid('sec'); setSvc((s) => ({ ...s, sections: [...s.sections, { id: sid, title: t2('', ''), fields: [] }] })); };
  void baseSvc;
  return (
    <Stagger>
      <Item><Notice icon="info">{dz.form.paletteHint}</Notice></Item>
      {svc.sections.map((s, si) => { const off = s.endedAt && s.endedAt <= today; return (
        <Item key={s.id}>
          <Group className={`dz-section ${off ? 'off' : ''}`}>
            <div className="dz-sec-head">
              <span className="cell-lead"><I.list /></span>
              <div className="ed-row dz-sec-titles">
                <label><span>{dz.form.sectionTitle}</span><input id={`dz-sec-${si}-ar`} value={s.title.ar} disabled={!editable} onChange={(e) => updSection(s.id, { title: { ...s.title, ar: e.target.value } })} /></label>
                <label><span>{dz.form.sectionTitleEn}</span><input dir="ltr" value={s.title.en} disabled={!editable} onChange={(e) => updSection(s.id, { title: { ...s.title, en: e.target.value } })} /></label>
                <label style={{ flexBasis: '100%' }}><span>{dz.form.sectionHint}</span><input value={s.hint?.ar || ''} disabled={!editable} onChange={(e) => updSection(s.id, { hint: { ar: e.target.value, en: s.hint?.en || e.target.value } })} /></label>
              </div>
              {editable ? (inBase(s.id) ? <EndDate endedAt={s.endedAt} editable={editable} today={today} onChange={(endedAt) => updSection(s.id, { endedAt })} t={t} lang={lang} /> : <button type="button" className="icon-btn" aria-label={dz.form.remove} onClick={() => removeSection(s.id)}><I.x /></button>) : null}
            </div>
            <div className="dz-fields">
              {s.fields.map((f, i) => <FieldRow key={f.id} f={f} svc={svc} gone={!!f.endedAt && f.endedAt <= today} onOpen={() => setEdit({ sid: s.id, fid: f.id })} tools={editable ? <span className="dz-field-tools"><button type="button" className="icon-btn" aria-label={dz.form.up} disabled={i === 0} onClick={() => moveField(s.id, i, -1)}><I.chev className="rot-up" /></button><button type="button" className="icon-btn" aria-label={dz.form.down} disabled={i === s.fields.length - 1} onClick={() => moveField(s.id, i, 1)}><I.chev className="rot-down" /></button></span> : null} />)}
              {editable ? <button type="button" className="npc-add dz-add" onClick={() => setPalette(s.id)}><span className="cell-lead"><I.plus /></span>{dz.form.addField}</button> : null}
              {!s.fields.length && !editable ? <p className="cell-sub" style={{ padding: '8px 14px' }}>{dz.meta.noFields}</p> : null}
            </div>
          </Group>
        </Item>
      ); })}
      {editable ? <Item><button type="button" className="npc-add" onClick={addSection}><span className="cell-lead"><I.plus /></span>{dz.form.addSection}</button></Item> : null}
      {!svc.sections.length ? <Item><Notice tone="warn" icon="alert">{dz.form.empty}</Notice></Item> : null}
      <PaletteSheet open={!!palette} onClose={() => setPalette(null)} onPick={(k) => palette && addField(palette, k)} />
      <FieldSheet svc={svc} field={editing} editable={editable} inBase={!!edit && inBase(edit.sid, edit.fid)} onChange={(f) => edit && setField(edit.sid, f)} onRemove={() => edit && removeField(edit.sid, edit.fid)} onClose={() => setEdit(null)} steps={svc.route} />
    </Stagger>
  );
}
