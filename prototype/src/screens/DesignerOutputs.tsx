/* v0.16 محرر المخرجات والإشعارات (خريطة الحالات §4 و§5): مستند بقالب دمج ونوعه وموقّعه وصلاحيته ومتى يصدر، وسجل مخصص بأعمدته وانتهائه وتجديده،
   وكتابة عبر عقد بربط مدخلاته، وخدمة تالية، وحدث تقويم؛ والإشعارات المهيّأة والتذكيرات. الإلغاء بتاريخ (P-12). */
import React, { useRef, useState } from 'react';
import { useStore } from '../app/store';
import { I } from '../ui/icons';
import { Group, Notice, Pill, Sheet, useLang, usePerson } from '../ui/components';
import { Stagger, Item } from '../ui/motion';
import { toISO, PROFILE_KEYS, type ConfiguredService, type ServiceOutput, type OutputKind, type DocKind, type NotifyRule, type Reminder, type MapSource } from '../domain/policy';
import { allFields, mergeTokens, liveServices, PROFILE_TITLE, previewDocument } from '../domain/designer';
import { ConfiguredDocument } from '../ui/Documents';
import type { Person } from '../domain/types';
import { CONTRACTS, contractReady, SYSTEM_TITLE } from '../domain/contracts';
import { PosPicker, EndDate } from './NeedPolicyCenter';
import { useUI } from '../app/ui';
import { t2, uid, Bi } from './DesignerBits';

const OUT_ICON: Record<OutputKind, keyof typeof I> = { document: 'seal', register: 'book', contract: 'plug', followUp: 'send', calendar: 'calendar' };

function TemplateEditor({ svc, out, onChange, editable }: { svc: ConfiguredService; out: ServiceOutput; onChange: (o: ServiceOutput) => void; editable: boolean }) {
  const { tx } = useLang(); const { L } = useUI(); const x = L.dz.v16.out;
  const tpl = out.template || { docKind: 'letter' as DocKind, paragraphs: [] }; const T = (patch: Partial<typeof tpl>) => onChange({ ...out, template: { ...tpl, ...patch } });
  const refs = useRef<Record<string, HTMLTextAreaElement | null>>({}); const [focus, setFocus] = useState<{ i: number; l: 'ar' | 'en' } | null>(null);
  const insert = (token: string) => { if (!focus) return; const el = refs.current[`${focus.i}-${focus.l}`]; const p = tpl.paragraphs[focus.i]; if (!p) return; const pos = el ? el.selectionStart : p[focus.l].length; const txt = p[focus.l].slice(0, pos) + token + p[focus.l].slice(pos); T({ paragraphs: tpl.paragraphs.map((q, k) => (k === focus.i ? { ...q, [focus.l]: txt } : q)) }); };
  return (
    <div className="dz-template">
      <p className="cell-sub">{x.templateHint}</p>
      {tpl.paragraphs.map((p, i) => (
        <div key={i} className="dz-para">
          <div className="dz-para-head"><b className="num">{x.paragraph} {i + 1}</b>{editable ? <button type="button" className="icon-btn" aria-label={L.dz.form.remove} onClick={() => T({ paragraphs: tpl.paragraphs.filter((_, k) => k !== i) })}><I.x /></button> : null}</div>
          <textarea id={`dz-para-${i}-ar`} ref={(el) => { refs.current[`${i}-ar`] = el; }} rows={2} value={p.ar} disabled={!editable} onFocus={() => setFocus({ i, l: 'ar' })} onChange={(e) => T({ paragraphs: tpl.paragraphs.map((q, k) => (k === i ? { ...q, ar: e.target.value } : q)) })} />
          <textarea ref={(el) => { refs.current[`${i}-en`] = el; }} dir="ltr" rows={2} value={p.en} disabled={!editable} onFocus={() => setFocus({ i, l: 'en' })} onChange={(e) => T({ paragraphs: tpl.paragraphs.map((q, k) => (k === i ? { ...q, en: e.target.value } : q)) })} />
        </div>
      ))}
      {editable ? <button type="button" className="btn quiet sm dz-add-para" onClick={() => T({ paragraphs: [...tpl.paragraphs, t2('', '')] })}><I.plus />{x.addParagraph}</button> : null}
      <div className="section-label"><span>{x.tokens}</span></div>
      <div className="chips dz-tokens">{mergeTokens(svc).map((tk) => <button key={tk.token} type="button" className="pill" disabled={!editable} onClick={() => insert(tk.token)} title={tk.token}><I.plus />{tx(tk.label)}</button>)}</div>
    </div>
  );
}

export function OutputsEditor({ svc, setSvc, editable, inBase, person }: { svc: ConfiguredService; setSvc: (f: (s: ConfiguredService) => ConfiguredService) => void; editable: boolean; inBase: (oid: string) => boolean; person?: Person }) {
  const { state } = useStore(); const { lang, t, tx } = useLang(); const { L } = useUI(); const dz = L.dz; const x = dz.v16.out; const today = toISO(Date.now());
  const outputs = svc.outputs || []; const upd = (id: string, patch: Partial<ServiceOutput>) => setSvc((s) => ({ ...s, outputs: (s.outputs || []).map((o) => (o.id === id ? { ...o, ...patch } : o)) }));
  const add = (kind: OutputKind) => { const id = uid('out'); const base: ServiceOutput = { id, kind, title: kind === 'contract' || kind === 'followUp' ? undefined : { ...svc.name } }; const o: ServiceOutput = kind === 'document' ? { ...base, prefix: svc.domain, issueAt: 'end', template: { docKind: 'letter', paragraphs: [t2('', '')], signatory: { kind: 'lastApprover' } } } : kind === 'register' ? { ...base, registerId: svc.id, columns: [], remindDays: 30 } : kind === 'contract' ? { ...base, contractId: CONTRACTS[0].id, mapping: {} } : kind === 'followUp' ? { ...base, mode: 'suggest' } : { ...base, dateField: allFields(svc).find((f) => f.kind === 'date' || f.kind === 'daterange')?.id }; setSvc((s) => ({ ...s, outputs: [...(s.outputs || []), o] })); };
  const remove = (id: string) => setSvc((s) => ({ ...s, outputs: (s.outputs || []).filter((o) => o.id !== id) }));
  const fields = allFields(svc); const dateFields = fields.filter((f) => f.kind === 'date' || f.kind === 'daterange'); const others = liveServices(state).filter((s) => s.id !== svc.id);
  const mapSources = (): { key: string; label: string; src: MapSource }[] => { const out: { key: string; label: string; src: MapSource }[] = []; for (const f of fields) if (f.kind !== 'guidance') out.push({ key: `field:${f.id}`, label: `${dz.v16.step.mapFrom.field}: ${tx(f.label) || f.id}`, src: { from: 'field', key: f.id } }); out.push({ key: 'profile:personId', label: `${dz.v16.step.mapFrom.profile}: ${lang === 'ar' ? 'معرّف الموظف' : 'employee id'}`, src: { from: 'profile', key: 'personId' } }); for (const k of PROFILE_KEYS) out.push({ key: `profile:${k}`, label: `${dz.v16.step.mapFrom.profile}: ${tx(PROFILE_TITLE[k])}`, src: { from: 'profile', key: k } }); for (const s of svc.route) for (const f of s.form?.fields || []) out.push({ key: `step:${s.id}.${f.id}`, label: `${dz.v16.step.mapFrom.step}: ${s.title ? tx(s.title) : s.id} · ${tx(f.label) || f.id}`, src: { from: 'step', key: `${s.id}.${f.id}` } }); out.push({ key: 'request:number', label: `${dz.v16.step.mapFrom.request}: ${lang === 'ar' ? 'رقم الطلب' : 'request number'}`, src: { from: 'request', key: 'number' } }); return out; };
  return (
    <Stagger>
      <Item><Notice icon="seal">{x.hint}</Notice></Item>
      {outputs.map((o) => { const Ic = I[OUT_ICON[o.kind]]; const gone = o.endedAt && o.endedAt <= today; const c = o.kind === 'contract' ? CONTRACTS.find((z) => z.id === o.contractId) : undefined; const ready = o.kind === 'contract' && o.contractId ? contractReady(state, o.contractId, svc.tenant) : undefined; return (
        <Item key={o.id}><Group className={`dz-output ${gone ? 'off' : ''}`}>
          <div className="dz-sec-head"><span className="cell-lead"><Ic /></span><div className="cell-main"><span className="cell-title">{x.kinds[o.kind]}{o.title ? ` · ${tx(o.title)}` : ''}</span><span className="cell-sub">{x.kindHint[o.kind]}</span></div>{editable ? (inBase(o.id) ? <EndDate endedAt={o.endedAt} editable={editable} today={today} onChange={(endedAt) => upd(o.id, { endedAt })} t={t} lang={lang} /> : <button type="button" className="icon-btn" aria-label={dz.form.remove} onClick={() => remove(o.id)}><I.x /></button>) : null}</div>
          <div className="ed-row dz-ed" style={{ padding: '4px 14px 12px' }}>
            {o.kind !== 'contract' ? <Bi label={x.outputTitle} labelEn={x.outputTitleEn} value={o.title} onChange={(v) => upd(o.id, { title: v })} editable={editable} id={`dz-out-${o.id}`} /> : null}
            {o.kind === 'document' ? (<>
              <label><span>{dz.output.prefix}</span><input dir="ltr" className="mono" maxLength={6} value={o.prefix || ''} disabled={!editable} onChange={(e) => upd(o.id, { prefix: e.target.value.toUpperCase() })} /><span className="cell-sub">{dz.output.prefixHint}</span></label>
              <label><span>{x.docKind}</span><select className="select-in" value={o.template?.docKind || 'letter'} disabled={!editable} onChange={(e) => upd(o.id, { template: { ...(o.template || { paragraphs: [] }), docKind: e.target.value as DocKind } })}>{(['letter', 'decision', 'certificate', 'permit'] as const).map((k) => <option key={k} value={k}>{x.docKinds[k]}</option>)}</select></label>
              <label><span>{x.issueAt}</span><select className="select-in" value={o.issueAt || 'end'} disabled={!editable} onChange={(e) => upd(o.id, { issueAt: e.target.value })}><option value="end">{x.issueEnd}</option>{svc.route.filter((s) => s.id).map((s, i) => <option key={s.id} value={s.id}>{s.title ? tx(s.title) : `${dz.route.step} ${i + 1}`}</option>)}</select></label>
              <label><span>{x.signatory}</span><select className="select-in" value={o.template?.signatory?.kind || 'lastApprover'} disabled={!editable} onChange={(e) => upd(o.id, { template: { ...(o.template || { docKind: 'letter', paragraphs: [] }), signatory: { kind: e.target.value as 'lastApprover' | 'position' | 'none', positionId: o.template?.signatory?.positionId } } })}>{(['lastApprover', 'position', 'none'] as const).map((k) => <option key={k} value={k}>{x.signatories[k]}</option>)}</select></label>
              {o.template?.signatory?.kind === 'position' ? <div style={{ flexBasis: '100%' }}><PosPicker label={x.signatory} ids={o.template.signatory.positionId ? [o.template.signatory.positionId] : []} editable={editable} onChange={(ids) => upd(o.id, { template: { ...o.template!, signatory: { kind: 'position', positionId: ids[ids.length - 1] } } })} /></div> : null}
              <label><span>{x.validityField}</span><select className="select-in" value={o.template?.validity?.field || ''} disabled={!editable} onChange={(e) => upd(o.id, { template: { ...(o.template || { docKind: 'letter', paragraphs: [] }), validity: e.target.value ? { field: e.target.value } : undefined } })}><option value="">—</option>{dateFields.map((f) => <option key={f.id} value={f.id}>{tx(f.label) || f.id}</option>)}</select></label>
              <label><span>{x.validityDays}</span><input className="num-in num" type="number" min={1} value={o.template?.validity?.days ?? ''} disabled={!editable || !!o.template?.validity?.field} onChange={(e) => upd(o.id, { template: { ...(o.template || { docKind: 'letter', paragraphs: [] }), validity: e.target.value ? { days: Number(e.target.value) } : undefined } })} /></label>
              <label style={{ flexBasis: '100%' }}><span>{x.copyTo}</span><input value={(o.template?.copyTo || []).map((c) => c.ar).join('، ')} disabled={!editable} onChange={(e) => upd(o.id, { template: { ...(o.template || { docKind: 'letter', paragraphs: [] }), copyTo: e.target.value.split(/[،,]/).map((s) => s.trim()).filter(Boolean).map((s) => t2(s, s)) } })} /></label>
              <div style={{ flexBasis: '100%' }}><div className="section-label" style={{ padding: '4px 0 6px' }}><span>{x.template}</span><DocPreviewButton svc={svc} out={o} person={person} /></div><TemplateEditor svc={svc} out={o} onChange={(no) => upd(o.id, no)} editable={editable} /></div>
            </>) : null}
            {o.kind === 'register' ? (<>
              <label><span>{x.registerId}</span><input className="mono" dir="ltr" value={o.registerId || ''} disabled={!editable} onChange={(e) => upd(o.id, { registerId: e.target.value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20) })} /><span className="cell-sub">{x.registerIdHint}</span></label>
              <label><span>{x.expiryField}</span><select className="select-in" value={o.expiryField || ''} disabled={!editable} onChange={(e) => upd(o.id, { expiryField: e.target.value || undefined })}><option value="">—</option>{dateFields.map((f) => <option key={f.id} value={f.id}>{tx(f.label) || f.id}</option>)}</select></label>
              <label><span>{x.remindDays}</span><input className="num-in num" type="number" min={1} max={365} value={o.remindDays ?? 30} disabled={!editable} onChange={(e) => upd(o.id, { remindDays: Number(e.target.value) })} /></label>
              <label><span>{x.renewService}</span><select className="select-in" value={o.renewService || ''} disabled={!editable} onChange={(e) => upd(o.id, { renewService: e.target.value || undefined })}><option value="">—</option><option value={svc.id}>{x.renewSelf}</option>{others.map((s) => <option key={s.id} value={s.id}>{tx(s.name)} · {s.id}</option>)}</select></label>
              <label style={{ flexBasis: '100%' }}><span>{x.columns}</span><span className="chips">{fields.filter((f) => f.kind !== 'guidance' && f.kind !== 'attachment' && f.kind !== 'signature').map((f) => { const on = (o.columns || []).includes(f.id); return <button key={f.id} type="button" className={`pill ${on ? 'tint' : ''}`} aria-pressed={on} disabled={!editable} onClick={() => upd(o.id, { columns: on ? (o.columns || []).filter((z) => z !== f.id) : [...(o.columns || []), f.id] })}>{on ? <I.check /> : <I.plus />}{tx(f.label) || f.id}</button>; })}</span></label>
            </>) : null}
            {o.kind === 'contract' ? (<>
              <label style={{ flexBasis: '100%' }}><span>{dz.v16.step.contract}</span><select className="select-in" value={o.contractId || ''} disabled={!editable} onChange={(e) => upd(o.id, { contractId: e.target.value, mapping: {} })}>{CONTRACTS.filter((z) => z.direction === 'write').map((z) => <option key={z.id} value={z.id}>{tx(z.name)} · {tx(SYSTEM_TITLE[z.system])}</option>)}</select>{ready ? <span className={`cell-sub ${ready.ok ? '' : 'danger-txt'}`}>{tx(ready.why)}</span> : null}</label>
              {c ? <div style={{ flexBasis: '100%' }} className="dz-mapping"><span className="section-label" style={{ padding: '0 0 6px' }}><span>{dz.v16.step.mapping}</span></span>{c.inputs.map((inp) => { const cur = o.mapping?.[inp.key]; const curKey = cur ? `${cur.from}:${cur.key}` : ''; return <label key={inp.key}><span>{tx(inp.label)} <em className="cell-sub">({inp.required ? dz.v16.contracts.required : dz.v16.contracts.optional})</em></span><select className="select-in" value={curKey} disabled={!editable} onChange={(e) => { const src = mapSources().find((z) => z.key === e.target.value)?.src; const m = { ...(o.mapping || {}) }; if (src) m[inp.key] = src; else delete m[inp.key]; upd(o.id, { mapping: m }); }}><option value="">—</option>{mapSources().map((z) => <option key={z.key} value={z.key}>{z.label}</option>)}</select></label>; })}</div> : null}
            </>) : null}
            {o.kind === 'followUp' ? (<>
              <label><span>{x.followService}</span><select className="select-in" value={o.serviceId || ''} disabled={!editable} onChange={(e) => upd(o.id, { serviceId: e.target.value || undefined, map: {} })}><option value="">—</option>{others.map((s) => <option key={s.id} value={s.id}>{tx(s.name)} · {s.id}</option>)}</select></label>
              <label><span>{x.followMode}</span><div className="segmented sm">{(['suggest', 'auto'] as const).map((m) => <button key={m} type="button" aria-pressed={(o.mode || 'suggest') === m} disabled={!editable} onClick={() => upd(o.id, { mode: m })}><span className="seg-txt">{x.followModes[m]}</span></button>)}</div></label>
              {o.mode === 'auto' && o.serviceId ? <div style={{ flexBasis: '100%' }} className="dz-mapping"><span className="section-label" style={{ padding: '0 0 6px' }}><span>{x.map}</span></span>{allFields(others.find((s) => s.id === o.serviceId)!).filter((f) => f.kind !== 'guidance' && f.kind !== 'profile' && f.kind !== 'computed').map((tf) => <label key={tf.id}><span>{tx(tf.label) || tf.id}</span><select className="select-in" value={o.map?.[tf.id] || ''} disabled={!editable} onChange={(e) => { const m = { ...(o.map || {}) }; if (e.target.value) m[tf.id] = e.target.value; else delete m[tf.id]; upd(o.id, { map: m }); }}><option value="">—</option>{fields.filter((f) => f.kind === tf.kind).map((f) => <option key={f.id} value={f.id}>{tx(f.label) || f.id}</option>)}</select></label>)}</div> : null}
            </>) : null}
            {o.kind === 'calendar' ? <label><span>{x.dateField}</span><select className="select-in" value={o.dateField || ''} disabled={!editable} onChange={(e) => upd(o.id, { dateField: e.target.value || undefined })}><option value="">—</option>{dateFields.map((f) => <option key={f.id} value={f.id}>{tx(f.label) || f.id}</option>)}</select></label> : null}
          </div>
        </Group></Item>
      ); })}
      {!outputs.length ? <Item><Notice tone="tint" icon="info">{x.none}</Notice></Item> : null}
      {editable ? <Item><div className="dz-add-out"><span className="cell-sub">{x.add}</span><span className="chips">{(['document', 'register', 'contract', 'followUp', 'calendar'] as OutputKind[]).map((k) => { const Ic = I[OUT_ICON[k]]; return <button key={k} type="button" className={`pill dz-add-out-${k}`} onClick={() => add(k)}><Ic />{x.kinds[k]}</button>; })}</span></div></Item> : null}
    </Stagger>
  );
}

export function NotifyEditor({ svc, setSvc, editable }: { svc: ConfiguredService; setSvc: (f: (s: ConfiguredService) => ConfiguredService) => void; editable: boolean }) {
  const { tx } = useLang(); const { L } = useUI(); const dz = L.dz; const x = dz.v16.notif; const today = toISO(Date.now());
  const rules = svc.notifications || []; const rems = svc.reminders || [];
  const updR = (id: string, patch: Partial<NotifyRule>) => setSvc((s) => ({ ...s, notifications: (s.notifications || []).map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
  const updM = (id: string, patch: Partial<Reminder>) => setSvc((s) => ({ ...s, reminders: (s.reminders || []).map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
  const fields = allFields(svc); const refFields = fields.filter((f) => f.kind === 'person' || f.kind === 'position' || f.kind === 'unit'); const dateFields = fields.filter((f) => f.kind === 'date' || f.kind === 'daterange');
  const tokens = mergeTokens(svc);
  return (
    <Stagger>
      <Item><Notice icon="bell">{x.hint}</Notice></Item>
      {rules.map((r) => { const gone = r.endedAt && r.endedAt <= today; return (
        <Item key={r.id}><Group className={`dz-output ${gone ? 'off' : ''}`}><div className="ed-row dz-ed" style={{ padding: '12px 14px' }}>
          <label><span>{x.when}</span><select className="select-in" value={r.when} disabled={!editable} onChange={(e) => updR(r.id, { when: e.target.value as NotifyRule['when'] })}>{(['submitted', 'completed', 'rejected', 'returned', 'step'] as const).map((w) => <option key={w} value={w}>{x.whens[w]}</option>)}</select></label>
          {r.when === 'step' ? <label><span>{dz.route.step}</span><select className="select-in" value={r.stepId || ''} disabled={!editable} onChange={(e) => updR(r.id, { stepId: e.target.value })}><option value="">—</option>{svc.route.filter((s) => s.id).map((s, i) => <option key={s.id} value={s.id}>{s.title ? tx(s.title) : `${dz.route.step} ${i + 1}`}</option>)}</select></label> : null}
          <label><span>{x.to}</span><select className="select-in" value={r.to} disabled={!editable} onChange={(e) => updR(r.id, { to: e.target.value as NotifyRule['to'] })}>{(['requester', 'lineManager', 'unitHead', 'owner', 'positions', 'field'] as const).map((w) => <option key={w} value={w}>{x.tos[w]}</option>)}</select></label>
          {r.to === 'positions' ? <div style={{ flexBasis: '100%' }}><PosPicker label={dz.route.positions} ids={r.positionIds || []} editable={editable} onChange={(positionIds) => updR(r.id, { positionIds })} /></div> : null}
          {r.to === 'field' ? <label><span>{dz.form.condField}</span><select className="select-in" value={r.fieldId || ''} disabled={!editable} onChange={(e) => updR(r.id, { fieldId: e.target.value })}><option value="">—</option>{refFields.map((f) => <option key={f.id} value={f.id}>{tx(f.label) || f.id}</option>)}</select></label> : null}
          <Bi label={x.titleAr} labelEn={x.titleEn} value={r.title} onChange={(v) => updR(r.id, { title: v })} editable={editable} />
          <Bi label={x.bodyAr} labelEn={x.bodyEn} value={r.body} onChange={(v) => updR(r.id, { body: v })} editable={editable} rows={2} />
          {editable ? <div className="kbd-row" style={{ flexBasis: '100%', padding: 0 }}><button type="button" className="btn quiet sm" onClick={() => setSvc((s) => ({ ...s, notifications: (s.notifications || []).filter((z) => z.id !== r.id) }))}><I.trash />{dz.form.remove}</button></div> : null}
        </div></Group></Item>
      ); })}
      {editable ? <Item><button type="button" className="npc-add dz-add-notif" onClick={() => setSvc((s) => ({ ...s, notifications: [...(s.notifications || []), { id: uid('nt'), when: 'completed', to: 'requester', title: t2('', ''), body: t2('', '') }] }))}><span className="cell-lead"><I.plus /></span>{x.add}</button></Item> : null}
      <Item><div className="section-label"><span>{x.reminders}</span><span className="cell-sub">{x.remindersHint}</span></div></Item>
      {rems.map((m) => (
        <Item key={m.id}><Group><div className="ed-row dz-ed" style={{ padding: '12px 14px' }}>
          <label><span>{dz.form.condField}</span><select className="select-in" value={m.field} disabled={!editable} onChange={(e) => updM(m.id, { field: e.target.value })}><option value="">—</option>{dateFields.map((f) => <option key={f.id} value={f.id}>{tx(f.label) || f.id}</option>)}</select></label>
          <label><span>{x.daysBefore}</span><input className="num-in num" type="number" min={1} value={m.daysBefore} disabled={!editable} onChange={(e) => updM(m.id, { daysBefore: Number(e.target.value) })} /></label>
          <label><span>{x.to}</span><select className="select-in" value={m.to} disabled={!editable} onChange={(e) => updM(m.id, { to: e.target.value as Reminder['to'] })}><option value="requester">{x.tos.requester}</option><option value="lineManager">{x.tos.lineManager}</option></select></label>
          <Bi label={x.text} labelEn={`${x.text} (EN)`} value={m.text} onChange={(v) => updM(m.id, { text: v })} editable={editable} />
          {editable ? <div className="kbd-row" style={{ flexBasis: '100%', padding: 0 }}><button type="button" className="btn quiet sm" onClick={() => setSvc((s) => ({ ...s, reminders: (s.reminders || []).filter((z) => z.id !== m.id) }))}><I.trash />{dz.form.remove}</button></div> : null}
        </div></Group></Item>
      ))}
      {editable ? <Item><button type="button" className="npc-add dz-add-rem" onClick={() => setSvc((s) => ({ ...s, reminders: [...(s.reminders || []), { id: uid('rm'), field: dateFields[0]?.id || '', daysBefore: 3, to: 'requester', text: t2('', '') }] }))}><span className="cell-lead"><I.plus /></span>{x.addReminder}</button></Item> : null}
      <Item><div className="chips dz-tokens" style={{ padding: '6px 2px' }}><span className="cell-sub" style={{ flexBasis: '100%' }}>{dz.v16.out.tokens}</span>{tokens.map((tk) => <Pill key={tk.token}><span className="mono" dir="ltr">{tk.token}</span> {tx(tk.label)}</Pill>)}</div></Item>
    </Stagger>
  );
}

/* v0.18: معاينة المستند قبل الحفظ — طلب تجريبي لا يُحفظ يمرّ بالدمج نفسه الذي يجري عند الإصدار، فيظهر على ورقة الهوية كما سيراه الموظف (C-UX-81) */
export function DocumentPreview({ svc, out, person }: { svc: ConfiguredService; out: ServiceOutput; person: Person }) {
  const { state } = useStore(); const { L } = useUI();
  const pv = React.useMemo(() => previewDocument(state, svc, out, person), [state, svc, out, person]);
  if (!pv) return <Notice tone="warn" icon="alert">{L.dz.preview.docNone}</Notice>;
  return <div className="dz-docsheet"><ConfiguredDocument r={pv.req} doc={pv.doc} svc={svc} still /></div>;
}
/** زر «معاينة المستند» في بطاقة المخرج (على الهاتف حيث لا عمود معاينة) يفتح الورقة في لوح */
export function DocPreviewButton({ svc, out, person }: { svc: ConfiguredService; out: ServiceOutput; person?: Person }) {
  const { L } = useUI(); const me = usePerson(); const { tx } = useLang(); const [open, setOpen] = useState(false); const who = person || me;
  return (
    <>
      <button type="button" className="btn soft sm dz-doc-preview" onClick={() => setOpen(true)}><I.seal />{L.dz.preview.docPreview}</button>
      <Sheet open={open} onClose={() => setOpen(false)} title={`${L.dz.preview.docPreview} · ${tx(out.title) || svc.name.ar}`}>
        <p className="cell-sub" style={{ margin: '0 0 10px' }}>{L.dz.preview.docHint}</p>
        {open ? <DocumentPreview svc={svc} out={out} person={who} /> : null}
      </Sheet>
    </>
  );
}
