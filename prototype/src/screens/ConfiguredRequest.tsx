/* v0.15 مصمّم الخدمات (CAP-02): نموذج الخدمة المهيّأة كما يراه الموظف — يُولَّد من أقسام الخدمة وحقولها في الإصدار الساري، بالشاشة نفسها والانتقالات نفسها
   والمعاينة قبل الإرسال و«من سيعتمد ولماذا» (المبدأ 6: الموظف لا يعرف أيّ الخدمات مهيّأة). الشاشة نفسها هي المعاينة الحية في المصمّم (C-UX-81)، فلا صورة تخالف الأصل.
   v0.16 (خريطة الحالات §1 و§2): الأهلية والنافذة والحصة بأسبابها، و«قبل أن تبدأ»، والنموذج على صفحات، واللوحة الموسّعة (وقت، نعم/لا، مقياس، جدول، ملف الموظف، محسوب، توقيع)،
   والقيم الافتراضية، وللقراءة بشرط، والإقرار النهائي، والتجديد من السجل، والعودة بعد الإعادة على الحقول المطلوب تصحيحها. */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../app/store';
import { nav } from '../app/router';
import { I } from '../ui/icons';
import { Field, Group, LargeTitle, Notice, Pill, TopBar, Segmented, useLang, usePerson, useToast, Empty } from '../ui/components';
import { motion, AnimatePresence, Stagger, Item, CheckMark, SPRING } from '../ui/motion';
import { RoutePreview } from '../ui/LeaveBits';
import { configuredById, eligibilityOf, beneficiariesFor, visibleSections, validateService, fieldOptions, orgOptions, stepsFor, displayValue, designerVersion, withDefaults, effectiveValues, readOnlyNow, parseRows, profileValue, requestFields, type FormValues, type FormValue, type TableRow } from '../domain/designer';
import { holderOf, positionById } from '../domain/engine';
import { toISO, liveNeed, type ConfiguredService, type FormField } from '../domain/policy';
import { useUI } from '../app/ui';
import { fill, fmtDate } from '../app/i18n';
import type { Person, T2 } from '../domain/types';

/** قيمة حقل واحد: عنصر الإدخال المناسب لنوعه من اللوحة */
export function FieldInput({ f, value, onChange, requester, error, disabled, allValues, svc }: { f: FormField; value: FormValue | undefined; onChange: (v: FormValue) => void; requester: Person; error?: string; disabled?: boolean; allValues?: FormValues; svc?: ConfiguredService }) {
  const { state } = useStore(); const { lang, tx } = useLang(); const { L } = useUI(); const dz = L.dz; const x = dz.v16;
  const id = `cf-${f.id}`; const ph = f.placeholder ? tx(f.placeholder) : undefined;
  const optional = !f.rules?.required && !f.rules?.requiredIf && !['guidance', 'checkbox', 'signature', 'profile', 'computed'].includes(f.kind);
  const label = tx(f.label) + (optional ? ` (${dz.rq.optional})` : '');
  if (f.kind === 'guidance') return <Notice icon="info">{tx(f.label)}{f.hint ? <> — {tx(f.hint)}</> : null}</Notice>;
  if (f.kind === 'checkbox') return (
    <div className={`cf-check ${error ? 'bad' : ''}`}>
      <label className="sw"><span>{tx(f.label)}{f.hint ? <span className="cell-sub">{tx(f.hint)}</span> : null}</span><input id={id} className="switch" type="checkbox" checked={value === true} disabled={disabled} onChange={(e) => onChange(e.target.checked)} /></label>
      {error ? <span className="field-err">{error}</span> : null}
    </div>
  );
  if (f.kind === 'signature') return (
    <div className={`cf-sign ${error ? 'bad' : ''} ${value === true ? 'on' : ''}`}>
      <span className="cf-sign-txt"><b>{tx(f.label)}</b>{f.hint ? <span className="cell-sub">{tx(f.hint)}</span> : null}{value === true ? <span className="cf-signed"><I.sig />{fill(x.field.signedBy, { name: lang === 'ar' ? requester.name : requester.nameEn, at: fmtDate(Date.now(), lang, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) })}</span> : <span className="cell-sub">{x.rqx.signHint}</span>}</span>
      <motion.button id={id} type="button" className={`btn ${value === true ? 'soft' : 'primary'} sm`} disabled={disabled} whileTap={{ scale: 0.96 }} onClick={() => onChange(value !== true)}>{value === true ? <><I.check />{x.field.signed}</> : <><I.sig />{x.field.signHere}</>}</motion.button>
      {error ? <span className="field-err">{error}</span> : null}
    </div>
  );
  if (f.kind === 'profile') { const v = f.profileKey ? profileValue(state, requester, f.profileKey, lang) : ''; return <div className="cf-profile"><span className="k">{tx(f.label)}</span><span className="v">{v || '—'}</span><span className="cell-sub">{x.rqx.profileNote}</span></div>; }
  if (f.kind === 'computed') { const v = typeof value === 'string' ? value : ''; const n = Number(v); return <div className="cf-profile calc"><span className="k"><I.calc />{tx(f.label)}</span><span className="v num">{v === '' ? '—' : Number.isNaN(n) ? v : n.toLocaleString('en')}</span>{f.hint ? <span className="cell-sub">{tx(f.hint)}</span> : null}</div>; }
  const inner = (() => {
    if (f.kind === 'textarea') return <textarea id={id} rows={3} value={typeof value === 'string' ? value : ''} placeholder={ph} maxLength={f.rules?.maxLen} disabled={disabled} onChange={(e) => onChange(e.target.value)} />;
    if (f.kind === 'number' || f.kind === 'money') return (
      <span className="cf-money"><input id={id} type="number" inputMode="decimal" dir="ltr" className="num" value={typeof value === 'string' ? value : ''} placeholder={ph} min={f.rules?.min} max={f.rules?.max} step={f.kind === 'money' ? (f.decimals === 0 ? 1 : 0.01) : 1} disabled={disabled} onChange={(e) => onChange(e.target.value)} />{f.kind === 'money' ? <span className="cf-cur">{f.currency || 'SAR'}</span> : null}</span>
    );
    if (f.kind === 'date') return <input id={id} type="date" dir="ltr" className="num" value={typeof value === 'string' ? value : ''} min={f.rules?.dateRel === 'future' ? toISO(Date.now() + 86400000) : f.rules?.dateRel === 'todayOrFuture' ? toISO(Date.now()) : undefined} max={f.rules?.dateRel === 'past' ? toISO(Date.now() - 86400000) : undefined} disabled={disabled} onChange={(e) => onChange(e.target.value)} />;
    if (f.kind === 'time') return <input id={id} type="time" dir="ltr" className="num" value={typeof value === 'string' ? value : ''} disabled={disabled} onChange={(e) => onChange(e.target.value)} />;
    if (f.kind === 'daterange') { const [a, b] = (typeof value === 'string' ? value : '|').split('|'); return (
      <span className="cf-range"><label><span>{dz.rq.from}</span><input id={id} type="date" dir="ltr" className="num" value={a || ''} disabled={disabled} onChange={(e) => onChange(`${e.target.value}|${b || ''}`)} /></label><label><span>{dz.rq.to}</span><input id={`${id}-to`} type="date" dir="ltr" className="num" value={b || ''} min={a || undefined} disabled={disabled} onChange={(e) => onChange(`${a || ''}|${e.target.value}`)} /></label></span>
    ); }
    if (f.kind === 'yesno') return (
      <div className="segmented cf-seg" role="group" id={id}><button type="button" aria-pressed={value === 'yes'} disabled={disabled} onClick={() => onChange('yes')}><span className="seg-txt">{dz.rq.yes}</span></button><button type="button" aria-pressed={value === 'no'} disabled={disabled} onClick={() => onChange('no')}><span className="seg-txt">{dz.rq.no}</span></button></div>
    );
    if (f.kind === 'scale') { const max = f.scaleMax || 5; return (
      <div className="cf-scale" id={id}><div className="cf-scale-btns">{Array.from({ length: max }, (_, i) => i + 1).map((n) => <button key={n} type="button" className={`cf-scale-b ${Number(value) === n ? 'on' : ''} ${Number(value) >= n ? 'lit' : ''}`} aria-pressed={Number(value) === n} disabled={disabled} onClick={() => onChange(String(n))}><I.star /><span className="num">{n}</span></button>)}</div>{f.scaleLabels ? <div className="cf-scale-lbl"><span>{tx(f.scaleLabels.low)}</span><span>{tx(f.scaleLabels.high)}</span></div> : null}</div>
    ); }
    if (f.kind === 'choice') { const opts = fieldOptions(state, f); if (opts.length <= 3 && f.source !== 'erp') return (
      <div className="segmented cf-seg" role="group" id={id}>{opts.map((o) => <button key={o.id} type="button" aria-pressed={value === o.id} disabled={disabled} onClick={() => onChange(o.id)}><span className="seg-txt">{tx(o.name)}</span></button>)}</div>
    ); return <select id={id} value={typeof value === 'string' ? value : ''} disabled={disabled} onChange={(e) => onChange(e.target.value)}><option value="">{dz.rq.chooseOne}</option>{opts.map((o) => <option key={o.id} value={o.id}>{tx(o.name)}</option>)}</select>; }
    if (f.kind === 'multichoice') { const opts = fieldOptions(state, f); const vs = Array.isArray(value) ? value : []; return (
      <span className="chips cf-chips">{opts.map((o) => { const on = vs.includes(o.id); return <button key={o.id} type="button" className={`pill ${on ? 'tint' : ''}`} aria-pressed={on} disabled={disabled} onClick={() => onChange(on ? vs.filter((x) => x !== o.id) : [...vs, o.id])}>{on ? <I.check /> : <I.plus />}{tx(o.name)}</button>; })}</span>
    ); }
    if (f.kind === 'person' || f.kind === 'position' || f.kind === 'unit') { const opts = orgOptions(state, f, requester); return <select id={id} value={typeof value === 'string' ? value : ''} disabled={disabled} onChange={(e) => onChange(e.target.value)}><option value="">{dz.rq.chooseOne}</option>{opts.map((o) => <option key={o.id} value={o.id}>{tx(o.name)}</option>)}</select>; }
    if (f.kind === 'attachment') { const files = Array.isArray(value) ? value : []; const max = f.rules?.maxFiles || 5; const accept = (f.rules?.fileKinds || []).map((k) => (k === 'pdf' ? '.pdf' : k === 'image' ? 'image/*' : '.doc,.docx')).join(',') || undefined; return (
      <div className="cf-files">
        {files.map((name, i) => <span key={i} className="pill tint"><I.clip />{name}{!disabled ? <button type="button" className="chip-x" aria-label={dz.rq.removeFile} onClick={() => onChange(files.filter((_, k) => k !== i))}>×</button> : null}</span>)}
        {files.length < max && !disabled ? <label className="btn secondary sm" style={{ cursor: 'pointer' }}><I.clip />{files.length ? dz.rq.addFile : dz.rq.chooseFile}<input id={id} type="file" accept={accept} multiple={max > 1} style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }} onChange={(e) => { const names = Array.from(e.target.files || []).map((x) => x.name); if (names.length) onChange([...files, ...names].slice(0, max)); e.target.value = ''; }} /></label> : null}
        {f.rules?.maxMB || f.rules?.fileKinds?.length ? <span className="cell-sub">{[f.rules?.fileKinds?.map((k) => dz.form.fileKind[k]).join(lang === 'ar' ? '، ' : ', '), f.rules?.maxMB ? `${f.rules.maxMB} ${lang === 'ar' ? 'م.ب' : 'MB'}` : '', max > 1 ? fill(dz.rq.filesN, { n: max }) : dz.rq.file1].filter(Boolean).join(' · ')}</span> : null}
      </div>
    ); }
    if (f.kind === 'table') { const rows = parseRows(value); const cols = liveNeed(f.columns || [], toISO(Date.now())); const max = f.maxRows || 20; const money = cols.find((c) => c.kind === 'money' || c.kind === 'number'); const total = money ? rows.reduce((n, r) => n + (Number(r[money.id]) || 0), 0) : 0;
      const setRows = (rs: TableRow[]) => onChange(JSON.stringify(rs)); return (
      <div className="cf-table" id={id}>
        {rows.map((row, ri) => (
          <div key={ri} className="cf-row">
            <div className="cf-row-head"><b className="num">{fill(x.field.rowN, { n: ri + 1 })}</b>{!disabled ? <button type="button" className="icon-btn" aria-label={x.field.removeRow} onClick={() => setRows(rows.filter((_, k) => k !== ri))}><I.x /></button> : null}</div>
            <div className="cf-row-cols">{cols.map((c) => <label key={c.id} className="cf-col"><span>{tx(c.label)}{c.required ? '' : ` (${dz.rq.optional})`}</span>{c.kind === 'choice' ? <select value={row[c.id] || ''} disabled={disabled} onChange={(e) => setRows(rows.map((r, k) => (k === ri ? { ...r, [c.id]: e.target.value } : r)))}><option value="">{dz.rq.chooseOne}</option>{(c.options || []).map((o) => <option key={o.id} value={o.id}>{tx(o.name)}</option>)}</select> : <input type={c.kind === 'number' || c.kind === 'money' ? 'number' : c.kind === 'date' ? 'date' : 'text'} dir={c.kind === 'text' ? undefined : 'ltr'} className={c.kind === 'text' ? '' : 'num'} inputMode={c.kind === 'number' || c.kind === 'money' ? 'decimal' : undefined} value={row[c.id] || ''} disabled={disabled} onChange={(e) => setRows(rows.map((r, k) => (k === ri ? { ...r, [c.id]: e.target.value } : r)))} />}</label>)}</div>
          </div>
        ))}
        <div className="cf-table-foot">{rows.length < max && !disabled ? <button type="button" className="btn quiet sm" onClick={() => setRows([...rows, {}])}><I.plus />{x.field.addRow}</button> : <span />}{money ? <span className="cf-total"><span>{x.field.total}</span><b className="num">{total.toLocaleString('en')}{money.kind === 'money' ? ' SAR' : ''}</b></span> : null}</div>
      </div>
    ); }
    return <input id={id} type={f.rules?.pattern === 'email' ? 'email' : f.rules?.pattern === 'phone' ? 'tel' : f.rules?.pattern === 'url' ? 'url' : 'text'} dir={f.rules?.pattern && f.rules.pattern !== 'none' ? 'ltr' : undefined} value={typeof value === 'string' ? value : ''} placeholder={ph} maxLength={f.rules?.maxLen} disabled={disabled} onChange={(e) => onChange(e.target.value)} />;
  })();
  void allValues; void svc;
  return <Field id={id} label={label} hint={f.hint ? tx(f.hint) : undefined} error={error}>{inner}</Field>;
}

export function ConfiguredRequest({ serviceId, service, preview, previewPerson, resubmitId, embedded, renewOf }: { serviceId?: string; service?: ConfiguredService; preview?: boolean; previewPerson?: Person; resubmitId?: string; embedded?: boolean; renewOf?: string }) {
  const { state, dispatch } = useStore(); const { lang, t, tx } = useLang(); const meReal = usePerson(); const toast = useToast(); const { L } = useUI(); const dz = L.dz; const x = dz.v16;
  const me = previewPerson || meReal;
  const original = resubmitId ? state.requests.find((r) => r.id === resubmitId) : undefined;
  const renewEntry = renewOf ? (state.registers || []).find((e) => e.id === renewOf) : undefined; const renewReq = renewEntry ? state.requests.find((r) => r.id === renewEntry.requestId) : undefined;
  const svc = service || configuredById(state, serviceId || original?.configured?.serviceId);
  const version = designerVersion(state);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [values, setValues] = useState<FormValues>(() => (svc ? withDefaults(state, svc, me, original?.configured?.values ? { ...original.configured.values } : renewReq?.configured?.values ? { ...renewReq.configured.values } : {}) : {}));
  const [forWhom, setForWhom] = useState<'me' | 'other'>(original?.configured?.onBehalfOf ? 'other' : 'me'); const [benef, setBenef] = useState(original?.configured?.onBehalfOf || '');
  const [errors, setErrors] = useState<Record<string, T2>>({}); const [createdId, setCreatedId] = useState(''); const [declared, setDeclared] = useState(false); const [page, setPage] = useState(0);
  const summaryRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (Object.keys(errors).length && !preview) summaryRef.current?.focus(); }, [errors, preview]);
  useEffect(() => { setStep(1); setErrors({}); setPage(0); if (svc && !original && !renewReq) setValues((v) => withDefaults(state, svc, me, v)); }, [svc?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const title = svc ? tx(svc.name) : '';
  const eff = useMemo(() => (svc ? effectiveValues(state, svc, me, values) : {}), [state, svc, me, values]);
  const ctx = useMemo(() => ({ state, person: me, svc }), [state, me, svc]);
  const sections = useMemo(() => (svc ? visibleSections(svc, eff, toISO(Date.now()), ctx) : []), [svc, eff, ctx]);
  const set = (k: string, v: FormValue) => { setValues((x) => ({ ...x, [k]: v })); if (errors[k]) setErrors((e) => { const c = { ...e }; delete c[k]; return c; }); };
  if (!svc) return <div className="page narrow view"><TopBar title={t.newReq.title} back={() => history.back()} /><div className="lb-empty"><Empty icon="grid" title={dz.rq.notFound} sub={L.notFoundDomainSub} /></div></div>;
  const elig = eligibilityOf(state, me, svc); const eligible = elig.ok || !!original; const benefs = svc.onBehalf && svc.onBehalf !== 'none' ? beneficiariesFor(state, me, svc) : [];
  const owner = svc.owner?.positionId ? holderOf(state, svc.owner.positionId) : undefined; const ownerPos = svc.owner?.positionId ? positionById(state, svc.owner.positionId) : undefined;
  const paged = !!svc.paged && sections.length > 1; const pages = paged ? sections : [];
  const pageFieldIds = (i: number) => new Set(pages[i]?.fields.map((f) => f.id) || []);
  const validate = (onlyPage?: number) => { let errs = validateService(state, svc, values, toISO(Date.now()), me, original?.id); if (onlyPage !== undefined) { const ids = pageFieldIds(onlyPage); errs = errs.filter((e) => ids.has(e.field)); } const map: Record<string, T2> = {}; for (const e of errs) map[e.field] = e.text; if (onlyPage === undefined && forWhom === 'other' && !benef) map['__for'] = { ar: 'اختر لمن هذا الطلب', en: 'Choose who this request is for' }; setErrors(map); return !Object.keys(map).length; };
  const built = useMemo(() => stepsFor(state, me, svc, values), [state, me, svc, values]);
  const fieldsShown = sections.flatMap((s) => s.fields).filter((f) => f.kind !== 'guidance' && f.kind !== 'attachment');
  const returnFields = original ? original.steps.find((s) => s.status === 'returned')?.returnFields || [] : [];
  const submit = () => {
    if (preview) { toast({ title: dz.rq.sample, icon: 'sparkle', tone: 'info' }); return; }
    if (svc.declaration && !declared) { setErrors({ __decl: { ar: 'يلزم تأكيد الإقرار', en: 'The declaration must be confirmed' } }); return; }
    if (original) { dispatch({ type: 'resubmit', requestId: original.id, fields: requestFields(state, svc, values, me), values: effectiveValues(state, svc, me, values) }); toast(t.newReq.successTitle); nav(`#/requests/${original.id}`); return; }
    const id = 'REQ-2026-' + String(state.seq + 1).padStart(4, '0'); setCreatedId(id);
    dispatch({ type: 'configuredCreate', input: { serviceId: svc.id, requesterId: me.id, values, onBehalfOf: forWhom === 'other' ? benef : undefined, renewOf: renewEntry?.id } });
    setStep(3); window.scrollTo({ top: 0 });
  };
  const totalPages = paged ? pages.length + 1 : 2; const curPage = step === 1 ? (paged ? page + 1 : 1) : step === 2 ? totalPages : totalPages; const pct = step === 3 ? 100 : Math.round((curPage / totalPages) * 100);
  const errList = Object.entries(errors);
  const renderSection = ({ section, fields }: { section: (typeof sections)[number]['section']; fields: FormField[] }) => (
    <Item key={section.id}>
      {sections.length > 1 || section.title.ar ? <div className="section-label cf-sec"><span>{tx(section.title)}</span>{section.hint ? <span className="cell-sub">{tx(section.hint)}</span> : null}</div> : null}
      <Group>{fields.map((f) => <FieldInput key={f.id} f={f} value={f.kind === 'computed' || f.kind === 'profile' ? eff[f.id] : values[f.id]} onChange={(v) => set(f.id, v)} requester={me} error={errors[f.id] ? tx(errors[f.id]) : undefined} disabled={!eligible || readOnlyNow(f, eff, ctx)} allValues={eff} svc={svc} />)}</Group>
    </Item>
  );
  return (
    <div className={`page narrow view cfr ${embedded ? 'embedded' : ''}`}>
      <TopBar title={title} back={preview && step !== 2 && !(paged && page > 0) ? undefined : () => (step === 2 ? setStep(1) : paged && page > 0 ? setPage(page - 1) : history.back())} />
      <LargeTitle title={original ? t.requests.resubmit : title} sub={original ? title : tx(svc.description)} />
      {svc.confidential ? <div style={{ marginBottom: 10 }}><Notice tone="gold" icon="lock">{dz.rq.confidential}{svc.hideRequester ? ` · ${dz.rq.anonymous}` : ''}</Notice></div> : null}
      {renewEntry ? <div style={{ marginBottom: 10 }}><Notice tone="tint" icon="reset">{fill(x.rqx.renewing, { id: renewEntry.id })} · {tx(renewEntry.title)}{renewEntry.expiresAt ? ` · ${x.registers.expires} ${renewEntry.expiresAt}` : ''}</Notice></div> : null}
      {original && returnFields.length ? <div style={{ marginBottom: 10 }}><Notice tone="warn" icon="ret">{fill(x.rqx.fixFirst, { fields: returnFields.map((k) => tx(original.fields.find((f) => f.key === k)?.label) || k).join(lang === 'ar' ? '، ' : ', ') })}</Notice></div> : null}
      {!eligible ? <div style={{ marginBottom: 10 }}><Notice tone="danger" icon="lock"><b>{x.rqx.cannot}</b><ul className="cf-reasons">{elig.reasons.map((r, i) => <li key={i}>{tx(r)}</li>)}</ul></Notice></div> : elig.notes.length && step === 1 ? <div style={{ marginBottom: 10 }}><Notice tone="tint" icon="info">{elig.notes.map((n) => tx(n)).join(' · ')}</Notice></div> : null}
      {step < 3 && (
        <div className="steps"><span className="num">{paged ? fill(x.rqx.page, { n: curPage, m: totalPages }) : `${t.newReq.step} ${step} ${t.newReq.of} 2`}</span><div className="bar"><motion.i initial={false} animate={{ width: `${pct}%` }} transition={SPRING.soft} /></div><span>{step === 1 ? (paged ? tx(pages[page]?.section.title) || t.newReq.details : t.newReq.details) : t.newReq.review}</span></div>
      )}
      <AnimatePresence mode="wait" initial={false}>
      {step === 1 && (
        <motion.div key={`s1-${page}`} initial={{ opacity: 0, x: lang === 'ar' ? -28 : 28 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: lang === 'ar' ? 28 : -28, transition: { duration: 0.16 } }} transition={SPRING.soft}>
          {errList.length > 0 && (
            <div className="error-summary" ref={summaryRef} tabIndex={-1}><b>{t.newReq.fixErrors}</b><ul>{errList.map(([k, v]) => { const f = sections.flatMap((s) => s.fields).find((x) => x.id === k); return <li key={k}><a href={`#cf-${k}`} onClick={(e) => { e.preventDefault(); document.getElementById(`cf-${k}`)?.focus(); }}>{f ? tx(f.label) : dz.rq.forWhom}: {tx(v)}</a></li>; })}</ul></div>
          )}
          <Stagger delay={0.05} step={0.05}>
          {(!paged || page === 0) && svc.beforeYouStart?.length ? <Item><div className="cf-before"><span className="cell-lead plain"><I.list /></span><div><b>{x.rqx.before}</b><ul>{svc.beforeYouStart.map((b, i) => <li key={i}>{tx(b)}</li>)}</ul></div></div></Item> : null}
          {(!paged || page === 0) && benefs.length ? (
            <Item><Group>
              <div className="cf-for"><span className="section-label" style={{ padding: '0 0 6px' }}><span>{dz.rq.forWhom}</span></span>
                <Segmented id="cf-for" value={forWhom} onChange={(v) => { setForWhom(v); if (v === 'me') setBenef(''); }} options={[{ v: 'me', label: dz.rq.forMe }, { v: 'other', label: dz.rq.forOther }]} />
                {forWhom === 'other' ? <Field id="cf-__for" label={dz.rq.forOther} error={errors['__for'] ? tx(errors['__for']) : undefined}><select id="cf-__for" value={benef} onChange={(e) => { setBenef(e.target.value); setErrors((x) => { const c = { ...x }; delete c['__for']; return c; }); }}><option value="">{dz.rq.chooseOne}</option>{benefs.map((b) => <option key={b.id} value={b.id}>{tx(b.name)}{b.sub ? ` · ${tx(b.sub)}` : ''}</option>)}</select></Field> : null}
              </div>
            </Group></Item>
          ) : null}
          {sections.length === 0 ? <Item><Notice icon="info">{dz.form.empty}</Notice></Item> : paged ? (pages[page] ? renderSection(pages[page]) : null) : sections.map(renderSection)}
          <div style={{ height: 16 }} />
          {paged ? (
            <Item><div className="btn-row cf-pager">{page > 0 ? <motion.button type="button" className="btn secondary" whileTap={{ scale: 0.97 }} onClick={() => { setPage(page - 1); if (!embedded) window.scrollTo({ top: 0 }); }}><I.chev className="dirchev back" />{x.rqx.back}</motion.button> : <span />}<motion.button type="button" className="btn primary" disabled={!eligible} whileTap={{ scale: 0.97 }} onClick={() => { if (validate(page)) { if (page < pages.length - 1) { setPage(page + 1); } else if (validate()) setStep(2); if (!embedded) window.scrollTo({ top: 0 }); } }}>{page < pages.length - 1 ? x.rqx.next : t.newReq.next}<I.chev className="dirchev" /></motion.button></div></Item>
          ) : (
            <Item><motion.button type="button" className="btn primary block lg" disabled={!eligible} whileTap={{ scale: 0.97 }} onClick={() => { if (validate()) { setStep(2); if (!embedded) window.scrollTo({ top: 0 }); } }}>{t.newReq.next}<I.chev className="dirchev" /></motion.button></Item>
          )}
          {owner ? <Item><p className="cf-ask cell-sub"><I.person />{x.rqx.ask} <b>{lang === 'ar' ? owner.name : owner.nameEn}</b>{ownerPos ? ` · ${tx(ownerPos.title)}` : ''}</p></Item> : null}
          </Stagger>
        </motion.div>
      )}
      {step === 2 && (
        <motion.div key="s2" initial={{ opacity: 0, x: lang === 'ar' ? -28 : 28 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: lang === 'ar' ? 28 : -28, transition: { duration: 0.16 } }} transition={SPRING.soft}>
          <Stagger delay={0.05} step={0.05}>
          <Group>
            {forWhom === 'other' && benef ? <Item><div className="summary-row"><span className="k">{dz.rq.forOther}</span><span className="v">{tx(benefs.find((b) => b.id === benef)?.name)}</span></div></Item> : null}
            {fieldsShown.map((f) => { const v = displayValue(state, f, eff[f.id], lang, me); return v ? <Item key={f.id}><div className="summary-row"><span className="k">{tx(f.label)}</span><span className="v">{v}</span></div></Item> : null; })}
            {sections.flatMap((s) => s.fields).filter((f) => f.kind === 'attachment' && Array.isArray(values[f.id]) && (values[f.id] as string[]).length).map((f) => <Item key={f.id}><div className="summary-row"><span className="k">{tx(f.label)}</span><span className="v">{(values[f.id] as string[]).map((n) => <Pill key={n} icon="clip">{n}</Pill>)}</span></div></Item>)}
          </Group>
          <div style={{ height: 8 }} /><Item><button type="button" className="btn quiet" onClick={() => { setStep(1); setPage(0); }}>{t.newReq.edit}</button></Item>
          <div className="section-label"><span>{dz.rq.whoApproves}</span></div>
          <Item><Group><div style={{ padding: '10px 14px 12px' }}><RoutePreview steps={built.steps} requester={me} notApplied={built.notApplied} /></div></Group></Item>
          {svc.declaration ? <><div style={{ height: 8 }} /><Item><div className={`cf-check ${errors.__decl ? 'bad' : ''}`}><label className="sw"><span><b>{x.rqx.declaration}</b><span className="cell-sub">{tx(svc.declaration)}</span></span><input id="cf-__decl" className="switch" type="checkbox" checked={declared} onChange={(e) => { setDeclared(e.target.checked); setErrors({}); }} /></label>{errors.__decl ? <span className="field-err">{tx(errors.__decl)}</span> : null}</div></Item></> : null}
          <div style={{ height: 8 }} />
          <Item><Notice tone="tint" icon="info">{fill(dz.rq.versionNote, { v: version.number })}</Notice></Item>
          <div style={{ height: 16 }} />
          <Item><motion.button type="button" className="btn primary block lg" onClick={submit} whileTap={{ scale: 0.97 }}><I.send />{t.newReq.submit}</motion.button></Item>
          </Stagger>
        </motion.div>
      )}
      {step === 3 && (
        <motion.div key="s3" className="success" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={SPRING.soft}>
          <CheckMark size={112} />
          <motion.b initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING.soft, delay: 0.85 }}>{t.newReq.successTitle}</motion.b>
          <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING.soft, delay: 0.95 }}>{t.newReq.successSub}</motion.p>
          <motion.p className="mono success-id" initial={{ opacity: 0, filter: 'blur(6px)' }} animate={{ opacity: 1, filter: 'blur(0px)' }} transition={{ duration: 0.5, delay: 1.05 }}>{createdId}</motion.p>
          <motion.div className="btn-row" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING.soft, delay: 1.15 }}><motion.a className="btn secondary" href="#/home" whileTap={{ scale: 0.97 }}>{t.tabs.home}</motion.a><motion.a className="btn primary" href={`#/requests/${createdId}`} whileTap={{ scale: 0.97 }}>{t.newReq.viewRequest}</motion.a></motion.div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}
