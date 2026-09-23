/* v0.16 محرر المسار (خريطة الحالات §3 و§3-ب): أنواع الخطوات كلها، والمعتمد بكل قواعده (ومنها من حقل، ومالك الخدمة، وشريحة القيمة)، والنصاب بالأغلبية،
   وشرط الخطوة والاعتماد الآلي، والمجموعة المتوازية، والانتظار، وخطوة النظام بعقد وربط مدخلاته، ونموذج الخطوة (خيارات القرار والحقول والتعديل وقائمة التحقق والإخفاء والتعليمات والأسباب والقرارات المسموحة). */
import React, { useState } from 'react';
import { useStore } from '../app/store';
import { I } from '../ui/icons';
import { Group, Notice, Pill, Sheet, useLang } from '../ui/components';
import { Stagger, Item } from '../ui/motion';
import { liveNeed, toISO, AGENT_KIND_TITLE, LEVEL_HEAD, LEVEL_TITLE, PROFILE_KEYS, type ConfiguredService, type RouteStep, type AgentKind, type AgentRule, type StepModeRule, type StepForm, type StepOutcome, type FormField, type FieldKind, type MapSource } from '../domain/policy';
import { allFields, PROFILE_TITLE } from '../domain/designer';
import { CONTRACTS, contractReady, ENV_TITLE, SYSTEM_TITLE } from '../domain/contracts';
import { currentEnv } from '../domain/contracts';
import { ORG_LEVELS, type OrgLevel } from '../domain/types';
import { PosPicker } from './NeedPolicyCenter';
import { useUI } from '../app/ui';
import { t2, clone, uid, Bi, Sw, CondEditor, newField } from './DesignerBits';
import { FieldSheet, PaletteSheet, FieldRow } from './DesignerForm';

const AGENT_KINDS: AgentKind[] = ['lineManager', 'orgHead', 'chain', 'positions', 'pool', 'field', 'owner', 'band'];
const STEP_FIELD_KINDS: FieldKind[] = ['text', 'textarea', 'number', 'money', 'date', 'time', 'choice', 'multichoice', 'yesno', 'scale', 'person', 'attachment', 'checkbox', 'guidance'];
const esc = { remindAtPct: 80, after: 'notifyManager' as const };

/** محرر قاعدة المعتمد (يُستعمل للخطوة ولكل شريحة قيمة) */
function AgentEditor({ svc, a, onChange, editable, allowBand = true }: { svc: ConfiguredService; a: AgentRule; onChange: (a: AgentRule) => void; editable: boolean; allowBand?: boolean }) {
  const { state } = useStore(); const { tx } = useLang(); const { L } = useUI(); const dz = L.dz; const x = dz.v16.step;
  const units = state.org.units; const refFields = allFields(svc).filter((f) => f.kind === 'person' || f.kind === 'position' || f.kind === 'unit'); const amountFields = allFields(svc).filter((f) => f.kind === 'money' || f.kind === 'number' || f.kind === 'computed');
  const kinds = allowBand ? AGENT_KINDS : AGENT_KINDS.filter((k) => k !== 'band');
  return (
    <>
      <label><span>{dz.route.agent}</span><select className="select-in dz-agent" value={a.kind} disabled={!editable} onChange={(e) => { const k = e.target.value as AgentKind; const agent: AgentRule = k === 'orgHead' ? { kind: k, level: 'department' } : k === 'chain' ? { kind: k, upTo: 'ga' } : k === 'positions' ? { kind: k, positionIds: [], quorum: 'any' } : k === 'pool' ? { kind: k, unitId: 'O-211' } : k === 'field' ? { kind: k, fieldId: refFields[0]?.id } : k === 'band' ? { kind: k, amountField: amountFields[0]?.id, bands: [{ upTo: 5000, agent: { kind: 'lineManager' } }, { upTo: null, agent: { kind: 'orgHead', level: 'department' } }] } : { kind: k }; onChange(agent); }}>{kinds.map((k) => <option key={k} value={k}>{tx(AGENT_KIND_TITLE[k])}</option>)}</select></label>
      {a.kind === 'orgHead' ? <label><span>{dz.route.level}</span><select className="select-in" value={a.level || 'department'} disabled={!editable} onChange={(e) => onChange({ ...a, level: e.target.value as OrgLevel })}>{ORG_LEVELS.map((l) => <option key={l} value={l}>{tx(LEVEL_HEAD[l])} ({tx(LEVEL_TITLE[l])})</option>)}</select></label> : null}
      {a.kind === 'chain' ? <label><span>{dz.route.upTo}</span><select className="select-in" value={a.upTo || 'ga'} disabled={!editable} onChange={(e) => onChange({ ...a, upTo: e.target.value as OrgLevel })}>{ORG_LEVELS.map((l) => <option key={l} value={l}>{tx(LEVEL_HEAD[l])}</option>)}</select></label> : null}
      {a.kind === 'pool' ? <label><span>{dz.route.pool}</span><select className="select-in" value={a.unitId || ''} disabled={!editable} onChange={(e) => onChange({ ...a, unitId: e.target.value })}>{units.map((u) => <option key={u.id} value={u.id}>{tx(u.name)} · {u.id}</option>)}</select></label> : null}
      {a.kind === 'field' ? <label><span>{x.fromField}</span><select className="select-in" value={a.fieldId || ''} disabled={!editable} onChange={(e) => onChange({ ...a, fieldId: e.target.value })}><option value="">—</option>{refFields.map((f) => <option key={f.id} value={f.id}>{tx(f.label) || f.id} · {dz.form.kinds[f.kind]}</option>)}</select></label> : null}
      {a.kind === 'positions' ? <div style={{ flexBasis: '100%' }}><PosPicker label={dz.route.positions} ids={a.positionIds || []} editable={editable} onChange={(positionIds) => onChange({ ...a, positionIds })} /></div> : null}
      {a.kind === 'positions' && (a.positionIds || []).length > 1 ? <label><span>{dz.route.quorum}</span><div className="segmented sm">{(['any', 'all', 'majority'] as const).map((q) => <button key={q} type="button" aria-pressed={(a.quorum || 'any') === q} disabled={!editable} onClick={() => onChange({ ...a, quorum: q })}><span className="seg-txt">{q === 'any' ? dz.route.quorumAny : q === 'all' ? dz.route.quorumAll : x.quorumMajority}</span></button>)}</div></label> : null}
      {a.kind === 'band' ? (<div className="dz-bands" style={{ flexBasis: '100%' }}>
        <label><span>{x.amountField}</span><select className="select-in" value={a.amountField || ''} disabled={!editable} onChange={(e) => onChange({ ...a, amountField: e.target.value })}><option value="">—</option>{amountFields.map((f) => <option key={f.id} value={f.id}>{tx(f.label) || f.id}</option>)}</select></label>
        <div className="section-label"><span>{x.bands}</span></div>
        {(a.bands || []).map((b, i) => (
          <div key={i} className="dz-band">
            <div className="ed-row"><label><span>{x.upTo}</span><span className="dz-band-upto"><input className="num-in num" type="number" min={0} value={b.upTo ?? ''} placeholder={x.noLimit} disabled={!editable || b.upTo === null} onChange={(e) => onChange({ ...a, bands: (a.bands || []).map((z, k) => (k === i ? { ...z, upTo: e.target.value === '' ? null : Number(e.target.value) } : z)) })} /><label className="dz-col-req"><input type="checkbox" checked={b.upTo === null} disabled={!editable} onChange={(e) => onChange({ ...a, bands: (a.bands || []).map((z, k) => (k === i ? { ...z, upTo: e.target.checked ? null : 5000 } : z)) })} /><span>{x.noLimit}</span></label></span></label>
              <AgentEditor svc={svc} a={b.agent} onChange={(ag) => onChange({ ...a, bands: (a.bands || []).map((z, k) => (k === i ? { ...z, agent: ag } : z)) })} editable={editable} allowBand={false} />
              {editable ? <button type="button" className="icon-btn" aria-label={dz.form.remove} onClick={() => onChange({ ...a, bands: (a.bands || []).filter((_, k) => k !== i) })}><I.x /></button> : null}
            </div>
          </div>
        ))}
        {editable ? <button type="button" className="btn quiet sm" onClick={() => onChange({ ...a, bands: [...(a.bands || []), { upTo: null, agent: { kind: 'orgHead', level: 'ga' } }] })}><I.plus />{x.addBand}</button> : null}
      </div>) : null}
    </>
  );
}

/** ورقة نموذج الخطوة (§3-ب) */
function StepFormSheet({ svc, step, open, onClose, onChange, editable, steps }: { svc: ConfiguredService; step: RouteStep | undefined; open: boolean; onClose: () => void; onChange: (f: StepForm) => void; editable: boolean; steps: RouteStep[] }) {
  const { tx } = useLang(); const { L } = useUI(); const dz = L.dz; const x = dz.v16.step; const today = toISO(Date.now());
  const [palette, setPalette] = useState(false); const [editField, setEditField] = useState<string | null>(null);
  const form: StepForm = step?.form || {}; const F = (patch: Partial<StepForm>) => onChange({ ...form, ...patch });
  const fields = allFields(svc).filter((f) => f.kind !== 'guidance');
  const editing = (form.fields || []).find((f) => f.id === editField);
  const addField = (kind: FieldKind) => { const f = newField(kind, (form.fields || []).length + 1); f.id = `s-${kind}-${(form.fields || []).length + 1}`; F({ fields: [...(form.fields || []), f] }); setPalette(false); setEditField(f.id); };
  if (!step) return null;
  const isDecision = step.mode === 'approve' || step.mode === 'review';
  return (
    <Sheet open={open} onClose={onClose} title={x.form} lead={<span className="qicon g-gold" style={{ width: 40, height: 40, borderRadius: 13 }}><I.hand /></span>}>
      <Notice icon="info">{x.formHint}</Notice>
      <div style={{ height: 10 }} />
      <Group><div className="ed-row" style={{ padding: '12px 16px 8px' }}>
        <Bi label={x.guidance} labelEn={`${x.guidance} (EN)`} value={form.guidance} onChange={(v) => F({ guidance: v.ar || v.en ? v : undefined })} editable={editable} rows={2} full />
        <Sw on={!!form.noteRequired} set={(v) => F({ noteRequired: v })} label={x.noteRequired} editable={editable} />
        {step.mode !== 'input' && step.mode !== 'review' ? <label style={{ flexBasis: '100%' }}><span>{x.allowed}</span><span className="chips">{(['approve', 'return', 'reject'] as const).map((d) => { const cur: ('approve' | 'return' | 'reject')[] = form.allowed?.length ? form.allowed : step.mode === 'fulfil' ? ['approve'] : ['approve', 'return', 'reject']; const on = cur.includes(d); return <button key={d} type="button" className={`pill ${on ? 'tint' : ''}`} aria-pressed={on} disabled={!editable || d === 'approve'} onClick={() => F({ allowed: on ? cur.filter((z) => z !== d) : [...cur, d] })}>{on ? <I.check /> : <I.plus />}{x.allowedOpts[d]}</button>; })}</span></label> : null}
      </div></Group>
      {isDecision ? (<>
        <div className="section-label"><span>{x.outcomes}</span><span className="cell-sub">{x.outcomesHint}</span></div>
        <Group><div className="ed-row" style={{ padding: '12px 16px 8px' }}>
          {(form.outcomes || []).map((o, oi) => { const gone = o.endedAt && o.endedAt <= today; const setO = (patch: Partial<StepOutcome>) => F({ outcomes: (form.outcomes || []).map((z) => (z.id === o.id ? { ...z, ...patch } : z)) }); return (
            <div key={o.id} className={`dz-outcome ${gone ? 'off' : ''}`}>
              <input id={`dz-oc-${oi}-ar`} placeholder={dz.basics.name} value={o.name.ar} disabled={!editable} onChange={(e) => setO({ name: { ...o.name, ar: e.target.value } })} />
              <input dir="ltr" placeholder={dz.basics.nameEn} value={o.name.en} disabled={!editable} onChange={(e) => setO({ name: { ...o.name, en: e.target.value } })} />
              <select className="select-in" value={o.effect} disabled={!editable} onChange={(e) => setO({ effect: e.target.value as StepOutcome['effect'] })}>{(['approve', 'return', 'reject'] as const).map((k) => <option key={k} value={k}>{x.effects[k]}</option>)}</select>
              <select className="select-in" value={o.tone || 'ok'} disabled={!editable} onChange={(e) => setO({ tone: e.target.value as StepOutcome['tone'] })}>{(['ok', 'warn', 'danger', 'gold'] as const).map((k) => <option key={k} value={k}>{x.tones[k]}</option>)}</select>
              {editable ? <button type="button" className="icon-btn" aria-label={dz.form.remove} onClick={() => F({ outcomes: (form.outcomes || []).filter((z) => z.id !== o.id) })}><I.x /></button> : null}
            </div>
          ); })}
          {editable ? <button type="button" className="btn quiet" id="dz-add-outcome" onClick={() => F({ outcomes: [...(form.outcomes || []), { id: uid('oc'), name: t2('', ''), effect: 'approve', tone: 'ok' }] })}><I.plus />{x.addOutcome}</button> : null}
        </div></Group>
      </>) : null}
      <div className="section-label"><span>{x.fields}</span><span className="cell-sub">{x.fieldsHint}</span></div>
      <Group><div className="dz-fields">
        {(form.fields || []).map((f) => <FieldRow key={f.id} f={f} svc={svc} gone={!!f.endedAt && f.endedAt <= today} onOpen={() => setEditField(f.id)} />)}
        {editable ? <button type="button" className="npc-add dz-add-step-field" onClick={() => setPalette(true)}><span className="cell-lead"><I.plus /></span>{dz.form.addField}</button> : null}
      </div></Group>
      {isDecision || step.mode === 'fulfil' ? (<>
        <div className="section-label"><span>{x.checks}</span><span className="cell-sub">{x.checksHint}</span></div>
        <Group><div className="ed-row" style={{ padding: '12px 16px 8px' }}>
          {(form.checks || []).map((c, ci) => <div key={c.id} className="dz-opt"><input id={`dz-chk-${ci}-ar`} value={c.text.ar} disabled={!editable} onChange={(e) => F({ checks: (form.checks || []).map((z) => (z.id === c.id ? { ...z, text: { ...z.text, ar: e.target.value } } : z)) })} /><input dir="ltr" value={c.text.en} disabled={!editable} onChange={(e) => F({ checks: (form.checks || []).map((z) => (z.id === c.id ? { ...z, text: { ...z.text, en: e.target.value } } : z)) })} />{editable ? <button type="button" className="icon-btn" aria-label={dz.form.remove} onClick={() => F({ checks: (form.checks || []).filter((z) => z.id !== c.id) })}><I.x /></button> : null}</div>)}
          {editable ? <button type="button" className="btn quiet" onClick={() => F({ checks: [...(form.checks || []), { id: uid('ck'), text: t2('', '') }] })}><I.plus />{x.addCheck}</button> : null}
        </div></Group>
      </>) : null}
      <div className="section-label"><span>{x.editable}</span><span className="cell-sub">{x.editableHint}</span></div>
      <Group><div style={{ padding: '10px 16px 12px' }}><span className="chips">{fields.filter((f) => f.kind !== 'profile' && f.kind !== 'computed' && f.kind !== 'signature').map((f) => { const on = (form.editable || []).includes(f.id); return <button key={f.id} type="button" className={`pill ${on ? 'tint' : ''}`} aria-pressed={on} disabled={!editable} onClick={() => F({ editable: on ? (form.editable || []).filter((z) => z !== f.id) : [...(form.editable || []), f.id] })}>{on ? <I.check /> : <I.plus />}{tx(f.label) || f.id}</button>; })}</span></div></Group>
      <div className="section-label"><span>{x.hidden}</span></div>
      <Group><div style={{ padding: '10px 16px 12px' }}><span className="chips">{fields.map((f) => { const on = (form.hidden || []).includes(f.id); return <button key={f.id} type="button" className={`pill ${on ? 'tint' : ''}`} aria-pressed={on} disabled={!editable} onClick={() => F({ hidden: on ? (form.hidden || []).filter((z) => z !== f.id) : [...(form.hidden || []), f.id] })}>{on ? <I.lock /> : <I.plus />}{tx(f.label) || f.id}</button>; })}</span></div></Group>
      {isDecision ? (<>
        <div className="section-label"><span>{x.reasons}</span></div>
        <Group><div className="ed-row" style={{ padding: '12px 16px 8px' }}>
          {(form.reasons || []).map((c) => <div key={c.id} className="dz-opt"><input value={c.name.ar} disabled={!editable} onChange={(e) => F({ reasons: (form.reasons || []).map((z) => (z.id === c.id ? { ...z, name: { ...z.name, ar: e.target.value } } : z)) })} /><input dir="ltr" value={c.name.en} disabled={!editable} onChange={(e) => F({ reasons: (form.reasons || []).map((z) => (z.id === c.id ? { ...z, name: { ...z.name, en: e.target.value } } : z)) })} />{editable ? <button type="button" className="icon-btn" aria-label={dz.form.remove} onClick={() => F({ reasons: (form.reasons || []).filter((z) => z.id !== c.id) })}><I.x /></button> : null}</div>)}
          {editable ? <button type="button" className="btn quiet" onClick={() => F({ reasons: [...(form.reasons || []), { id: uid('rs'), name: t2('', '') }] })}><I.plus />{x.addReason}</button> : null}
        </div></Group>
      </>) : null}
      <PaletteSheet open={palette} onClose={() => setPalette(false)} onPick={addField} kinds={STEP_FIELD_KINDS} />
      <FieldSheet svc={svc} field={editing} editable={editable} inBase={false} onChange={(f) => F({ fields: (form.fields || []).map((z) => (z.id === f.id ? f : z)) })} onRemove={() => F({ fields: (form.fields || []).filter((z) => z.id !== editField) })} onClose={() => setEditField(null)} forStep steps={[step, ...steps]} />
    </Sheet>
  );
}

export function RouteEditor({ svc, setSvc, editable }: { svc: ConfiguredService; setSvc: (f: (s: ConfiguredService) => ConfiguredService) => void; editable: boolean }) {
  const { state } = useStore(); const { lang, t, tx } = useLang(); const { L } = useUI(); const dz = L.dz; const x = dz.v16.step;
  const [formStep, setFormStep] = useState<number | null>(null);
  const setRoute = (steps: RouteStep[]) => setSvc((s) => ({ ...s, route: steps }));
  const upd = (i: number, patch: Partial<RouteStep>) => setRoute(svc.route.map((z, k) => (k === i ? { ...z, ...patch } : z)));
  const presets: Record<string, RouteStep[]> = {
    lineManager: [{ id: 'mgr', agent: { kind: 'lineManager' }, mode: 'approve', slaHours: 48, escalation: esc }],
    managerThenHr: [{ id: 'mgr', agent: { kind: 'lineManager' }, mode: 'approve', slaHours: 48, escalation: esc }, { id: 'hr', agent: { kind: 'pool', unitId: 'O-211' }, mode: 'fulfil', slaHours: 72, escalation: esc }],
    hrDirect: [{ id: 'mgr', agent: { kind: 'lineManager' }, mode: 'notify', slaHours: 0 }, { id: 'hr', agent: { kind: 'pool', unitId: 'O-211' }, mode: 'fulfil', slaHours: 72, escalation: esc }],
    managerThenFulfil: [{ id: 'mgr', agent: { kind: 'lineManager' }, mode: 'approve', slaHours: 48, escalation: esc }, { id: 'gs', agent: { kind: 'pool', unitId: 'O-150' }, mode: 'fulfil', slaHours: 72, escalation: esc }],
    committee: [{ id: 'cmt', agent: { kind: 'positions', positionIds: ['S-110', 'S-140', 'S-150'], quorum: 'majority' }, mode: 'approve', slaHours: 96, escalation: esc, title: t2('لجنة', 'Committee') }],
    parallel: [{ id: 'mgr', agent: { kind: 'lineManager' }, mode: 'approve', slaHours: 48, escalation: esc }, { id: 'p1', group: 'g1', agent: { kind: 'pool', unitId: 'O-150' }, mode: 'fulfil', slaHours: 48, escalation: esc }, { id: 'p2', group: 'g1', agent: { kind: 'pool', unitId: 'O-140' }, mode: 'fulfil', slaHours: 48, escalation: esc }],
    reviewThenApprove: [{ id: 'rev', agent: { kind: 'lineManager' }, mode: 'review', slaHours: 48, escalation: esc }, { id: 'dir', agent: { kind: 'orgHead', level: 'department' }, mode: 'approve', slaHours: 48, escalation: esc }],
  };
  const presetLabel = (k: string) => (dz.route.preset as Record<string, string>)[k] || (x.presetsMore as Record<string, string>)[k] || k;
  const contracts = CONTRACTS; const env = currentEnv(state);
  const mapSources = (): { key: string; label: string; src: MapSource }[] => {
    const out: { key: string; label: string; src: MapSource }[] = [];
    for (const f of allFields(svc)) if (f.kind !== 'guidance') out.push({ key: `field:${f.id}`, label: `${dz.v16.step.mapFrom.field}: ${tx(f.label) || f.id}`, src: { from: 'field', key: f.id } });
    out.push({ key: 'profile:personId', label: `${dz.v16.step.mapFrom.profile}: ${lang === 'ar' ? 'معرّف الموظف' : 'employee id'}`, src: { from: 'profile', key: 'personId' } });
    for (const k of PROFILE_KEYS) out.push({ key: `profile:${k}`, label: `${dz.v16.step.mapFrom.profile}: ${tx(PROFILE_TITLE[k])}`, src: { from: 'profile', key: k } });
    for (const s of svc.route) for (const f of s.form?.fields || []) out.push({ key: `step:${s.id}.${f.id}`, label: `${dz.v16.step.mapFrom.step}: ${s.title ? tx(s.title) : s.id} · ${tx(f.label) || f.id}`, src: { from: 'step', key: `${s.id}.${f.id}` } });
    out.push({ key: 'request:number', label: `${dz.v16.step.mapFrom.request}: ${lang === 'ar' ? 'رقم الطلب' : 'request number'}`, src: { from: 'request', key: 'number' } }, { key: 'request:date', label: `${dz.v16.step.mapFrom.request}: ${lang === 'ar' ? 'تاريخ التقديم' : 'submission date'}`, src: { from: 'request', key: 'date' } });
    return out;
  };
  return (
    <Stagger>
      <Item><Notice icon="team">{dz.route.hint}</Notice></Item>
      {editable ? <Item><div className="dz-presets"><span className="cell-sub">{dz.route.presets}</span><span className="chips">{Object.keys(presets).map((k) => <button key={k} type="button" className="pill" onClick={() => setRoute(clone(presets[k]))}><I.sparkle />{presetLabel(k)}</button>)}</span></div></Item> : null}
      <Item><Group className="route-ed dz-route">
        <ol className="rt-steps v6">
          {svc.route.map((s, i) => { const a = s.agent; const isNotify = s.mode === 'notify'; const isSys = s.mode === 'system'; const isWait = s.mode === 'wait'; const isInput = s.mode === 'input'; const c = isSys ? contracts.find((z) => z.id === s.contractId) : undefined; const ready = isSys && s.contractId ? contractReady(state, s.contractId, svc.tenant) : undefined; const formN = (s.form?.outcomes?.length || 0) + (s.form?.fields?.length || 0) + (s.form?.checks?.length || 0) + (s.form?.editable?.length || 0); return (
            <li key={s.id || i} className={`rt-step ${s.mode} ${s.group ? 'grouped' : ''}`}>
              <div className="rt-head"><span className="rp-n num">{i + 1}</span><b className="rt-title">{s.title ? tx(s.title) : `${dz.route.modes[s.mode]}${!isSys && !isWait && !isInput ? ` · ${tx(AGENT_KIND_TITLE[a.kind])}` : ''}`}</b>
                {s.group ? <Pill tone="tint" icon="branch">{x.group}: {s.group}</Pill> : null}{s.cond ? <Pill tone="gold">{x.cond}</Pill> : null}{s.auto ? <Pill tone="ok">{x.auto}</Pill> : null}
                {editable ? <span className="rt-tools"><button type="button" className="icon-btn" aria-label={dz.form.up} disabled={i === 0} onClick={() => { const arr = svc.route.slice(); [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; setRoute(arr); }}><I.chev className="rot-up" /></button><button type="button" className="icon-btn" aria-label={dz.form.down} disabled={i === svc.route.length - 1} onClick={() => { const arr = svc.route.slice(); [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; setRoute(arr); }}><I.chev className="rot-down" /></button><button type="button" className="icon-btn" aria-label={dz.route.remove} onClick={() => setRoute(svc.route.filter((_, k) => k !== i))}><I.x /></button></span> : null}
              </div>
              <div className="ed-row">
                <label style={{ flexBasis: '100%' }}><span>{dz.route.mode}</span><div className="segmented sm dz-modes">{(['approve', 'review', 'fulfil', 'input', 'notify', 'wait', 'system'] as StepModeRule[]).map((m) => <button key={m} type="button" aria-pressed={s.mode === m} disabled={!editable} onClick={() => upd(i, { mode: m, slaHours: m === 'notify' || m === 'wait' || m === 'system' ? 0 : s.slaHours || 48, agent: m === 'input' ? { kind: 'requester' as const } : s.agent.kind === 'requester' ? { kind: 'lineManager' as const } : s.agent, contractId: m === 'system' ? s.contractId || contracts[0].id : undefined, wait: m === 'wait' ? s.wait || { days: 1 } : undefined })}><span className="seg-txt">{dz.route.modes[m]}</span></button>)}</div></label>
                <label><span>{x.id}</span><input className="mono" dir="ltr" value={s.id || ''} disabled={!editable} onChange={(e) => upd(i, { id: e.target.value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 16) })} /><span className="cell-sub">{x.idHint}</span></label>
                {!isSys && !isWait && !isInput ? <AgentEditor svc={svc} a={a} onChange={(agent) => upd(i, { agent })} editable={editable} /> : null}
                {!isNotify && !isWait && !isSys ? <label><span>{dz.route.sla}</span><input className="num-in num" type="number" min={1} value={s.slaHours} disabled={!editable} onChange={(e) => upd(i, { slaHours: Number(e.target.value) })} /></label> : null}
                {isWait ? (<><label><span>{x.waitField}</span><select className="select-in" value={s.wait?.field || ''} disabled={!editable} onChange={(e) => upd(i, { wait: { ...(s.wait || {}), field: e.target.value || undefined } })}><option value="">—</option>{allFields(svc).filter((f) => f.kind === 'date' || f.kind === 'daterange').map((f) => <option key={f.id} value={f.id}>{tx(f.label) || f.id}</option>)}</select></label><label><span>{x.waitDays}</span><input className="num-in num" type="number" min={1} value={s.wait?.days ?? ''} disabled={!editable} onChange={(e) => upd(i, { wait: { ...(s.wait || {}), days: e.target.value === '' ? undefined : Number(e.target.value) } })} /></label></>) : null}
                {isSys ? (<>
                  <label style={{ flexBasis: '100%' }}><span>{x.contract}</span><select className="select-in dz-contract" value={s.contractId || ''} disabled={!editable} onChange={(e) => upd(i, { contractId: e.target.value, mapping: {} })}>{contracts.map((z) => <option key={z.id} value={z.id}>{tx(z.name)} · {tx(SYSTEM_TITLE[z.system])} · {z.direction === 'read' ? dz.v16.contracts.read : dz.v16.contracts.write}</option>)}</select>{ready ? <span className={`cell-sub ${ready.ok ? '' : 'danger-txt'}`}>{tx(ready.why)} · {tx(ENV_TITLE[env])}</span> : null}</label>
                  {c ? <div style={{ flexBasis: '100%' }} className="dz-mapping"><span className="section-label" style={{ padding: '0 0 6px' }}><span>{x.mapping}</span></span>{c.inputs.map((inp) => { const cur = s.mapping?.[inp.key]; const curKey = cur ? `${cur.from}:${cur.key}` : ''; return <label key={inp.key}><span>{tx(inp.label)} <em className="cell-sub">({inp.required ? dz.v16.contracts.required : dz.v16.contracts.optional})</em></span><select className="select-in" value={curKey} disabled={!editable} onChange={(e) => { const src = mapSources().find((z) => z.key === e.target.value)?.src; const m = { ...(s.mapping || {}) }; if (src) m[inp.key] = src; else delete m[inp.key]; upd(i, { mapping: m }); }}><option value="">—</option>{mapSources().map((z) => <option key={z.key} value={z.key}>{z.label}</option>)}</select></label>; })}</div> : null}
                </>) : null}
              </div>
              <div className="ed-row">
                <Bi label={dz.route.stepTitle} labelEn={dz.route.stepTitleEn} value={s.title} onChange={(v) => upd(i, { title: v.ar || v.en ? v : undefined })} editable={editable} />
                {!isSys && !isWait ? <label><span>{x.group}</span><input className="mono" dir="ltr" value={s.group || ''} placeholder="g1" disabled={!editable} onChange={(e) => upd(i, { group: e.target.value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 8) || undefined })} /><span className="cell-sub">{x.groupHint}</span></label> : null}
              </div>
              <div className="dz-step-conds">
                <CondEditor svc={svc} cond={s.cond} onChange={(c) => upd(i, { cond: c })} editable={editable} label={x.cond} hint={x.condHint} steps={svc.route.slice(0, i)} allowSteps />
                {s.mode === 'approve' || s.mode === 'review' ? <CondEditor svc={svc} cond={s.auto} onChange={(c) => upd(i, { auto: c })} editable={editable} label={x.auto} hint={x.autoHint} steps={svc.route.slice(0, i)} allowSteps /> : null}
              </div>
              {!isNotify && !isWait && !isSys ? <div className="kbd-row" style={{ paddingTop: 4 }}><button type="button" className="btn soft sm dz-step-form" onClick={() => setFormStep(i)}><I.hand />{x.form}{formN ? <Pill tone="tint">{formN}</Pill> : null}</button></div> : null}
            </li>
          ); })}
          <li className="rt-step sys"><span className="rp-n num">{svc.route.length + 1}</span><span className="rt-desk">{t.desks.system}</span><span className="cell-sub">{svc.outputs.filter((o) => !o.endedAt).length ? svc.outputs.filter((o) => !o.endedAt).map((o) => dz.v16.out.kinds[o.kind]).join(' · ') : dz.v16.out.none}</span></li>
        </ol>
        {editable ? <div className="kbd-row"><button type="button" className="btn quiet dz-add-step" onClick={() => setRoute([...svc.route, { id: `s${svc.route.length + 1}`, agent: { kind: 'lineManager' }, mode: 'approve', slaHours: 48, escalation: esc }])}><I.plus />{dz.route.addStep}</button></div> : null}
        {!svc.route.length ? <p className="cell-sub" style={{ padding: '0 14px 12px', color: 'var(--danger)' }}>{dz.route.noSteps}</p> : null}
      </Group></Item>
      <StepFormSheet svc={svc} step={formStep !== null ? svc.route[formStep] : undefined} open={formStep !== null} onClose={() => setFormStep(null)} onChange={(f) => formStep !== null && upd(formStep, { form: f })} editable={editable} steps={formStep !== null ? svc.route.slice(0, formStep) : []} />
    </Stagger>
  );
}
