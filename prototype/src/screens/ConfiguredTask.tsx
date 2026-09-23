/* v0.16 لوح قرار الخطوة للخدمة المهيّأة (CAP-02 خريطة الحالات §3-ب): ما يراه صاحب الخطوة في مهمته — التعليمات، وحقول الطلب (بلا المخفية، وما يجوز تعديله يُعدَّل هنا بسجل)،
   وقائمة التحقق، وحقول الخطوة من اللوحة نفسها، وخيارات القرار بأثرها، والملاحظة أو السبب من قائمة، والحقول المطلوب تصحيحها عند الإعادة؛ ثم القرار بالمحرك نفسه. */
import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '../app/store';
import { I } from '../ui/icons';
import { Field, Group, Notice, Pill, useLang, usePerson, useToast, fv } from '../ui/components';
import { motion, Stagger, Item } from '../ui/motion';
import { requestTitle, type TaskView } from '../domain/engine';
import { serviceOfRequest, allFields, stepFormFields, stepOutcomes, allowedDecisions, validateStep, displayValue, hiddenFor, tableRows, isEmptyValue, type FormValues, type FormValue } from '../domain/designer';
import { FieldInput } from './ConfiguredRequest';
import { useUI } from '../app/ui';
import { fill } from '../app/i18n';
import type { T2 } from '../domain/types';

export function ConfiguredTaskPanel({ task, onDone, rail }: { task: TaskView; onDone: () => void; rail?: React.ReactNode }) {
  const { state, dispatch } = useStore(); const { lang, t, tx } = useLang(); const me = usePerson(); const toast = useToast(); const { L } = useUI(); const dz = L.dz; const x = dz.v16.task;
  const r = task.request; const st = task.step; const svc = serviceOfRequest(state, r); const form = st.form;
  const [note, setNote] = useState(''); const [ref, setRef] = useState(''); const [reason, setReason] = useState(''); const [outcome, setOutcome] = useState(''); const [values, setValues] = useState<FormValues>({}); const [checks, setChecks] = useState<string[]>([]); const [edits, setEdits] = useState<FormValues>({}); const [retFields, setRetFields] = useState<string[]>([]); const [mode, setMode] = useState<'decide' | 'return'>('decide');
  const [errors, setErrors] = useState<Record<string, T2>>({}); const [err, setErr] = useState('');
  useEffect(() => { setNote(''); setRef(''); setReason(''); setOutcome(''); setValues({}); setChecks([]); setEdits({}); setRetFields([]); setMode('decide'); setErrors({}); setErr(''); }, [r.id, st.key]);
  const requester = state.people.find((p) => p.id === r.requesterId) || me;
  const hidden = hiddenFor(st); const fields = svc ? allFields(svc) : [];
  const stepFields = stepFormFields(st); const outcomes = stepOutcomes(st); const allowed = allowedDecisions(st);
  const editable = (form?.editable || []).map((id) => fields.find((f) => f.id === id)).filter((f): f is NonNullable<typeof f> => !!f && f.kind !== 'guidance' && f.kind !== 'profile' && f.kind !== 'computed' && !hidden.has(f.id));
  const shownFields = r.fields.filter((f) => f.value && !hidden.has(f.key) && f.key !== '__for' && !editable.some((e) => e.id === f.key));
  const tables = fields.filter((f) => f.kind === 'table' && !hidden.has(f.id) && r.configured?.values[f.id]);
  const isFulfil = st.mode === 'fulfil'; const isReview = st.mode === 'review'; const isInput = st.mode === 'input';
  const effVals = useMemo(() => ({ ...values, __outcome: outcome }), [values, outcome]);
  const visibleStepFields = stepFields.filter((f) => !f.rules?.showIf || (() => { const c = f.rules.showIf; const leaf = 'field' in c ? c : (c.all || c.any || [])[0]; if (!leaf) return true; if (leaf.field === '__outcome') return leaf.op === 'eq' ? outcome === (leaf.value || '') : leaf.op === 'ne' ? outcome !== (leaf.value || '') : leaf.op === 'set' ? !!outcome : true; return true; })());
  const setV = (k: string, v: FormValue) => { setValues((o) => ({ ...o, [k]: v })); if (errors[k]) setErrors((e) => { const c = { ...e }; delete c[k]; return c; }); };
  const act = (action: 'approve' | 'return' | 'reject' | 'done') => {
    const o = outcomes.find((z) => z.id === outcome);
    const effect = o ? (o.effect === 'reject' ? 'reject' : o.effect === 'return' ? 'return' : action) : action;
    if (outcomes.length && !o && action !== 'return') { setErr(x.outcomeMissing); return; }
    if ((form?.checks || []).some((c) => !c.endedAt && !checks.includes(c.id))) { setErr(x.checksMissing); return; }
    const needNote = effect === 'return' || effect === 'reject' || !!form?.noteRequired;
    const noteTxt = [reason ? tx(form?.reasons?.find((z) => z.id === reason)?.name) : '', note.trim()].filter(Boolean).join(' — ');
    if (needNote && !noteTxt) { setErr(t.inbox.noteRequired); return; }
    if (isFulfil && !stepFields.length && !ref.trim() && effect !== 'return') { setErr(t.inbox.ref); return; }
    if (effect !== 'return' && effect !== 'reject') { const errs = validateStep(state, { ...st, form: { ...form, fields: visibleStepFields } }, effVals, me); if (errs.length) { const m: Record<string, T2> = {}; for (const e of errs) m[e.field] = e.text; setErrors(m); setErr(t.newReq.fixErrors); return; } }
    const editList = editable.filter((f) => edits[f.id] !== undefined && !isEmptyValue(f, edits[f.id])).map((f) => ({ field: f.id, label: f.label, before: displayValue(state, f, r.configured?.values[f.id], 'ar', requester), after: displayValue(state, f, edits[f.id], 'ar', requester), value: edits[f.id] }));
    const stepVals: FormValues = {}; for (const f of visibleStepFields) if (values[f.id] !== undefined) stepVals[f.id] = values[f.id];
    dispatch({ type: 'decide', requestId: r.id, action: effect === 'return' ? 'return' : effect === 'reject' ? 'reject' : action, actorId: me.id, note: noteTxt || undefined, ref: ref.trim() || undefined, extra: { outcome: o?.id, values: stepVals, checks, edits: editList, returnFields: effect === 'return' ? retFields : undefined } });
    try { navigator.vibrate?.(12); } catch { /* لا اهتزاز */ }
    toast({ title: o ? tx(o.name) : effect === 'approve' ? (isReview ? x.recommend : t.inbox.approve) : effect === 'return' ? t.inbox.ret : effect === 'reject' ? t.inbox.reject : isInput ? x.complete : t.inbox.fulfil, sub: `${tx(requestTitle(r))} · ${r.id}`, icon: effect === 'reject' ? 'x' : effect === 'return' ? 'ret' : 'check', tone: effect === 'reject' ? 'danger' : effect === 'return' ? 'warn' : 'ok' });
    onDone();
  };
  const primaryLabel = isInput ? x.complete : isReview ? x.recommend : isFulfil ? t.inbox.fulfil : t.inbox.approve;
  const chosen = outcomes.find((z) => z.id === outcome);
  return (
    <Stagger delay={0.02} step={0.04}>
      {st.group ? <Item><Notice tone="tint" icon="branch">{x.parallel}</Notice><div style={{ height: 8 }} /></Item> : null}
      {form?.guidance ? <Item><Notice icon="info"><b>{x.guidance}:</b> {tx(form.guidance)}</Notice><div style={{ height: 8 }} /></Item> : null}
      {shownFields.length ? <Item><Group>{shownFields.map((f) => <div key={f.key} className="summary-row"><span className="k">{tx(f.label)}</span><span className="v">{fv(f, lang)}</span></div>)}{hidden.size ? <p className="cell-sub" style={{ padding: '6px 14px 10px' }}><I.lock /> {x.hiddenNote}</p> : null}</Group></Item> : null}
      {tables.map((f) => { const { cols, rows } = tableRows(state, f, r.configured?.values[f.id], lang); return <Item key={f.id}><div className="section-label"><span>{tx(f.label)}</span></div><Group><div className="cf-tbl-view"><table className="dt small"><thead><tr>{cols.map((c) => <th key={c.id}>{tx(c.label)}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i}>{row.map((v, k) => <td key={k}>{v}</td>)}</tr>)}</tbody></table></div></Group></Item>; })}
      {r.docs.filter((d) => d.kind === 'attachment').length > 0 && <Item><div className="kbd-row">{r.docs.filter((d) => d.kind === 'attachment').map((d) => <Pill key={d.id} icon="clip">{tx(d.title)}</Pill>)}</div></Item>}
      {editable.length ? <Item><div className="section-label"><span>{x.editable}</span></div><Group>{editable.map((f) => <FieldInput key={f.id} f={f} value={edits[f.id] !== undefined ? edits[f.id] : r.configured?.values[f.id]} onChange={(v) => setEdits((o) => ({ ...o, [f.id]: v }))} requester={requester} />)}</Group></Item> : null}
      {rail ? <Item>{rail}</Item> : null}
      {form?.checks?.filter((c) => !c.endedAt).length ? <Item><div className="section-label"><span>{x.checks}</span><span className="cell-sub">{x.checksHint}</span></div><Group>{form.checks.filter((c) => !c.endedAt).map((c) => <label key={c.id} className="cf-checkrow"><input id={`chk-${c.id}`} type="checkbox" checked={checks.includes(c.id)} onChange={(e) => { setChecks((o) => (e.target.checked ? [...o, c.id] : o.filter((z) => z !== c.id))); setErr(''); }} /><span>{tx(c.text)}</span></label>)}</Group></Item> : null}
      {outcomes.length ? <Item><div className="section-label"><span>{x.outcome}</span><span className="cell-sub">{x.outcomeHint}</span></div><div className="cf-outcomes">{outcomes.map((o) => <motion.button key={o.id} type="button" id={`oc-${o.id}`} className={`cf-outcome t-${o.tone || (o.effect === 'reject' ? 'danger' : o.effect === 'return' ? 'warn' : 'ok')} ${outcome === o.id ? 'on' : ''}`} aria-pressed={outcome === o.id} whileTap={{ scale: 0.97 }} onClick={() => { setOutcome(o.id); setErr(''); }}><b>{tx(o.name)}</b><span>{dz.v16.step.effects[o.effect]}</span></motion.button>)}</div></Item> : null}
      {visibleStepFields.length ? <Item><div className="section-label"><span>{x.stepFields}</span></div><Group>{visibleStepFields.map((f) => <FieldInput key={f.id} f={f} value={values[f.id]} onChange={(v) => setV(f.id, v)} requester={me} error={errors[f.id] ? tx(errors[f.id]) : undefined} />)}</Group></Item> : null}
      {isFulfil && !stepFields.length ? <Item><Group><Field id="fulfil-ref" label={t.inbox.ref} hint={t.inbox.refHint}><input id="fulfil-ref" className="mono" dir="ltr" value={ref} onChange={(e) => { setRef(e.target.value); setErr(''); }} placeholder="PY-2026-0000" /></Field></Group></Item> : null}
      {mode === 'return' ? <Item><div className="section-label"><span>{x.returnFields}</span><span className="cell-sub">{x.returnFieldsHint}</span></div><div className="chips" style={{ padding: '0 2px 8px' }}>{r.fields.filter((f) => f.key !== '__for').map((f) => { const on = retFields.includes(f.key); return <button key={f.key} type="button" className={`pill ${on ? 'tint' : ''}`} aria-pressed={on} onClick={() => setRetFields((o) => (on ? o.filter((z) => z !== f.key) : [...o, f.key]))}>{on ? <I.check /> : <I.plus />}{tx(f.label)}</button>; })}</div></Item> : null}
      <Item><Group>
        {form?.reasons?.length && (mode === 'return' || chosen?.effect === 'reject' || chosen?.effect === 'return') ? <Field id="decision-reason" label={x.reason}><select id="decision-reason" value={reason} onChange={(e) => { setReason(e.target.value); setErr(''); }}><option value="">{x.reasonPick}</option>{form.reasons.map((z) => <option key={z.id} value={z.id}>{tx(z.name)}</option>)}</select></Field> : null}
        <Field id="decision-note" label={`${t.inbox.note}${form?.noteRequired || mode === 'return' || chosen?.effect === 'reject' ? '' : ` (${t.newReq.optional})`}`} error={err && (err === t.inbox.noteRequired) ? err : undefined}><textarea id="decision-note" rows={2} value={note} onChange={(e) => { setNote(e.target.value); setErr(''); }} /></Field>
      </Group></Item>
      {err && err !== t.inbox.noteRequired ? <Item><Notice tone="danger" icon="alert">{err}</Notice></Item> : null}
      <div style={{ height: 12 }} />
      <Item>
        {mode === 'return' ? (
          <><motion.button type="button" className="btn primary block lg" onClick={() => act('return')} whileTap={{ scale: 0.97 }}><I.ret />{t.inbox.ret}</motion.button><div style={{ height: 10 }} /><button type="button" className="btn quiet block" onClick={() => setMode('decide')}>{t.newReq.edit}</button></>
        ) : outcomes.length ? (
          <><motion.button type="button" id="cf-decide" className={`btn block lg ${chosen?.effect === 'reject' ? 'danger' : 'primary'}`} disabled={!chosen} onClick={() => act(isFulfil || isReview || isInput ? 'done' : 'approve')} whileTap={{ scale: 0.97 }}>{chosen?.effect === 'reject' ? <I.x /> : chosen?.effect === 'return' ? <I.ret /> : <I.check />}{chosen ? fill(x.decidedWith, { o: tx(chosen.name) }) : x.outcomeMissing}</motion.button>
            {allowed.includes('return') && !outcomes.some((o) => o.effect === 'return') ? <><div style={{ height: 10 }} /><button type="button" className="btn secondary block" onClick={() => setMode('return')}><I.ret />{t.inbox.ret}</button></> : null}</>
        ) : (
          <><motion.button type="button" id="cf-decide" className="btn primary block lg" onClick={() => act(isFulfil || isReview || isInput ? 'done' : 'approve')} whileTap={{ scale: 0.97 }}><I.check />{primaryLabel}</motion.button>
            {allowed.includes('return') || allowed.includes('reject') ? <><div style={{ height: 10 }} /><div className="btn-row">{allowed.includes('return') ? <button type="button" className="btn secondary" onClick={() => setMode('return')}><I.ret />{t.inbox.ret}</button> : null}{allowed.includes('reject') ? <motion.button type="button" className="btn danger" onClick={() => act('reject')} whileTap={{ scale: 0.97 }}><I.x />{t.inbox.reject}</motion.button> : null}</div></> : null}</>
        )}
      </Item>
    </Stagger>
  );
}
