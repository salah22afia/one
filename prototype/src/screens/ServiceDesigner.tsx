/* v0.15 صفحة تصميم الخدمة (CAP-02 §6) → v0.16 بخريطة الحالات الكاملة (§3-ب): الأساسيات (من يطلب ومتى، والمالك، والصفحات، والإقرار) ← النموذج (اللوحة الموسّعة والشرط المركّب)
   ← المسار (أنواع الخطوات كلها ونماذجها) ← المخرجات (مستند بقالب، وسجل، وعقد، وخدمة تالية، وتقويم) ← الإشعارات ← فحص السلامة ← المحاكاة ← الإحصاءات —
   وبجانبها المعاينة الحية: شاشة الموظف نفسها لا صورة عنها (C-UX-96)، بعين أي موظف. التعديل في المسودة وحدها، والحفظ بسبب، والإلغاء بتاريخ لا الحذف (P-12). */
import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '../app/store';
import { nav } from '../app/router';
import { I } from '../ui/icons';
import { Group, LargeTitle, Notice, Pill, Segmented, TopBar, useLang, usePerson, useToast, Empty } from '../ui/components';
import { motion, AnimatePresence, Stagger, Item, SPRING } from '../ui/motion';
import { RoutePreview } from '../ui/LeaveBits';
import { statusOf, activeVersion, toISO, type PolicyContent, type ConfiguredService } from '../domain/policy';
import { serviceProblems, allFields, simulate, sampleValues, serviceStats, exportService, previewDocument, type FormValues } from '../domain/designer';
import { DocumentPreview } from './DesignerOutputs';
import { canDesign } from '../domain/tenants';
import type { Person } from '../domain/types';
import { DOMAINS } from '../data/catalog';
import { PosPicker, EndDate } from './NeedPolicyCenter';
import { ConfiguredRequest } from './ConfiguredRequest';
import { useUI } from '../app/ui';
import { fill } from '../app/i18n';
import { ICONS, TONES, clone, Bi, Sw } from './DesignerBits';
import { FormEditor } from './DesignerForm';
import { RouteEditor } from './DesignerRoute';
import { OutputsEditor, NotifyEditor } from './DesignerOutputs';

type Sec = 'basics' | 'form' | 'route' | 'output' | 'notify' | 'safety' | 'simulate' | 'stats' | 'preview';

export function ServiceDesigner({ id }: { id: string }) {
  const { state, dispatch } = useStore(); const { lang, t, tx } = useLang(); const me = usePerson(); const toast = useToast(); const { L, desk } = useUI(); const dz = L.dz; const x = dz.v16;
  const today = toISO(Date.now()); const policy = state.designer; const versions = policy.versions; const active = activeVersion(policy, today);
  const draft = versions.find((v) => statusOf(v, versions, today) === 'draft'); const sel = draft || active;
  const base = versions.find((v) => v.id === sel.baseId)?.content || sel.content;
  const stored = sel.content.designer?.services.find((s) => s.id === id);
  const isNew = !base.designer?.services.some((s) => s.id === id);
  const isAdmin = me.persona === 'admin' || (stored ? canDesign(state, me, stored.domain) : false); const editable = !!draft && isAdmin;
  const [svc, setSvc] = useState<ConfiguredService | undefined>(() => (stored ? clone(stored) : undefined));
  const [why, setWhy] = useState('');
  useEffect(() => { setSvc(stored ? clone(stored) : undefined); setWhy(''); }, [stored, sel.id]);
  const [sec, setSec] = useState<Sec>('basics');
  const [personaId, setPersonaId] = useState('P-AHMED');
  const [previewMode, setPreviewMode] = useState<'auto' | 'screen' | 'doc'>('auto'); const [previewOutId, setPreviewOutId] = useState('');
  const persona = state.people.find((p) => p.id === personaId) || state.people[0];
  const pending = !!svc && !!stored && JSON.stringify(svc) !== JSON.stringify(stored);
  const problems = useMemo(() => (svc ? serviceProblems(state, svc, today) : []), [state, svc, today]);
  const save = () => {
    if (!draft || !svc) return;
    const content: PolicyContent = { ...draft.content, designer: { services: (draft.content.designer?.services || []).map((s) => (s.id === svc.id ? svc : s)) } };
    dispatch({ type: 'designerUpdate', id: draft.id, content, by: me.id, why: why.trim() }); toast({ title: dz.saved, sub: tx(svc.name), icon: 'check', tone: 'ok' }); setWhy('');
  };
  const set = (f: (s: ConfiguredService) => ConfiguredService) => setSvc((s) => (s ? f(s) : s));
  const upd = (patch: Partial<ConfiguredService>) => set((s) => ({ ...s, ...patch }));
  const baseSvc = base.designer?.services.find((s) => s.id === id);
  const inBase = (sid: string, fid?: string) => { const bsec = baseSvc?.sections.find((z) => z.id === sid); return fid ? !!bsec?.fields.some((f) => f.id === fid) : !!bsec; };
  const inBaseOut = (oid: string) => !!baseSvc?.outputs?.some((o) => o.id === oid);
  /* المحاكاة */
  const [simValues, setSimValues] = useState<FormValues | null>(null);
  const sim = useMemo(() => (svc && simValues ? simulate(state, svc, persona as Person, simValues) : null), [state, svc, persona, simValues]);
  const stats = useMemo(() => serviceStats(state, id), [state, id]);

  if (!svc) return <div className="page view policy npc"><TopBar title={dz.title} back="#/admin/designer" /><div className="lb-empty"><Empty icon="grid" title={dz.rq.notFound} sub={dz.version.noDraftSvc} /></div></div>;
  const status = svc.endedAt && svc.endedAt <= today ? dz.status.ended : isNew && draft ? dz.status.draftNew : dz.status.live;
  const secOptions: { v: Sec; label: string; n?: number }[] = [{ v: 'basics', label: dz.sec.basics }, { v: 'form', label: dz.sec.form, n: allFields(svc).filter((f) => f.kind !== 'guidance').length }, { v: 'route', label: dz.sec.route, n: svc.route.length }, { v: 'output', label: dz.sec.output, n: (svc.outputs || []).filter((o) => !o.endedAt).length }, { v: 'notify', label: dz.sec.notify, n: (svc.notifications || []).length + (svc.reminders || []).length }, { v: 'safety', label: dz.sec.safety, n: problems.length }, { v: 'simulate', label: dz.sec.simulate }, { v: 'stats', label: dz.sec.stats, n: stats.total }, ...(desk ? [] : [{ v: 'preview' as Sec, label: dz.sec.preview }])];
  /* v0.18 (سؤال عمر: «هل أستطيع معاينة القالب قبل أن أحفظه؟»): المعاينة تتبع اللسان — في «المخرجات» تعرض المستند كما سيصدر بقيم تجريبية، وفي غيره شاشة الموظف؛ ومفتاح يبدّل بينهما في أي وقت */
  const docOutputs = (svc.outputs || []).filter((o) => o.kind === 'document' && (!o.endedAt || o.endedAt > today));
  const showDoc = docOutputs.length > 0 && (previewMode === 'doc' || (previewMode === 'auto' && sec === 'output'));
  const docOut = docOutputs.find((o) => o.id === previewOutId) || docOutputs[0];
  const previewPane = (
    <div className="dz-preview">
      <div className="dz-preview-head"><b>{dz.preview.title}</b><label className="dz-as"><span>{dz.preview.as}</span><select className="select-in sm" value={personaId} onChange={(e) => setPersonaId(e.target.value)}>{state.people.filter((p) => p.positionId).map((p) => <option key={p.id} value={p.id}>{lang === 'ar' ? p.name : p.nameEn} · {lang === 'ar' ? p.title : p.titleEn}</option>)}</select></label></div>
      {docOutputs.length ? <div className="segmented sm dz-prev-mode"><button type="button" aria-pressed={!showDoc} onClick={() => setPreviewMode('screen')}><span className="seg-txt">{dz.preview.screen}</span></button><button type="button" aria-pressed={showDoc} onClick={() => setPreviewMode('doc')}><span className="seg-txt">{dz.preview.document}</span></button></div> : null}
      <p className="cell-sub" style={{ margin: '0 0 8px' }}>{showDoc ? dz.preview.docHint : dz.preview.hint}</p>
      {showDoc && docOut ? (<>
        {docOutputs.length > 1 ? <select className="select-in sm" value={docOut.id} onChange={(e) => setPreviewOutId(e.target.value)} style={{ marginBottom: 8 }}>{docOutputs.map((o) => <option key={o.id} value={o.id}>{tx(o.title) || o.id}</option>)}</select> : null}
        <div className="dz-docprev"><DocumentPreview svc={svc} out={docOut} person={persona as Person} /></div>
      </>) : (
        <div className="dz-phone"><div className="dz-phone-in lb-official"><ConfiguredRequest key={svc.id} service={svc} preview previewPerson={persona as Person} embedded /></div></div>
      )}
    </div>
  );
  return (
    <div className={`page view policy npc dzs ${desk ? 'split' : ''}`}>
      <div className="dzs-main">
        <TopBar title={tx(svc.name)} back="#/admin/designer" end={<button type="button" className="icon-btn" aria-label={x.center.exportSvc} title={x.center.exportSvc} onClick={() => { const json = exportService(svc); navigator.clipboard?.writeText(json).then(() => toast({ title: x.center.exported, icon: 'copy', tone: 'ok' })).catch(() => { const w = window.open('', '_blank'); if (w) { w.document.write(`<pre>${json.replace(/</g, '&lt;')}</pre>`); } }); }}><I.download /></button>} />
        <LargeTitle title={tx(svc.name)} sub={`${svc.id} · ${tx(DOMAINS.find((d) => d.id === svc.domain)?.name ? { ar: DOMAINS.find((d) => d.id === svc.domain)!.name, en: DOMAINS.find((d) => d.id === svc.domain)!.nameEn } : { ar: svc.domain, en: svc.domain })} · ${status}`} />
        {!editable ? <><Notice tone="tint" icon="info">{isAdmin ? dz.version.noDraftSvc : t.policy.onlyAdmin} · {fill(dz.version.readOnly, { v: sel.number })}</Notice><div style={{ height: 10 }} /></> : <><p className="hint-line" style={{ padding: '0 0 8px' }}>{fill(dz.version.inDraft, { v: sel.number })} · {dz.version.hint}</p></>}
        <Segmented id="dzs" value={sec} onChange={setSec} options={secOptions} />
        <div style={{ height: 12 }} />
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={sec} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6, transition: { duration: 0.1 } }} transition={SPRING.soft}>

            {sec === 'basics' && (
              <Stagger>
                <Item><Group><div className="ed-row dz-ed">
                  <label><span>{dz.basics.name}</span><input id="dz-name-ar" value={svc.name.ar} disabled={!editable} onChange={(e) => upd({ name: { ...svc.name, ar: e.target.value } })} /></label>
                  <label><span>{dz.basics.nameEn}</span><input id="dz-name-en" dir="ltr" value={svc.name.en} disabled={!editable} onChange={(e) => upd({ name: { ...svc.name, en: e.target.value } })} /></label>
                  <label style={{ flexBasis: '100%' }}><span>{dz.basics.description}</span><textarea id="dz-desc-ar" rows={2} value={svc.description.ar} disabled={!editable} onChange={(e) => upd({ description: { ...svc.description, ar: e.target.value } })} /></label>
                  <label style={{ flexBasis: '100%' }}><span>{dz.basics.descriptionEn}</span><textarea dir="ltr" rows={2} value={svc.description.en} disabled={!editable} onChange={(e) => upd({ description: { ...svc.description, en: e.target.value } })} /></label>
                  <label><span>{dz.domain}</span><select className="select-in" value={svc.domain} disabled={!editable} onChange={(e) => upd({ domain: e.target.value })}>{DOMAINS.map((d) => <option key={d.id} value={d.id}>{lang === 'ar' ? d.name : d.nameEn} · {d.id}</option>)}</select></label>
                  <label><span>{dz.basics.icon}</span><span className="chips">{ICONS.map((ic) => { const Ic = I[ic]; return <button key={ic} type="button" className={`dz-ic ${svc.icon === ic ? 'on' : ''}`} aria-pressed={svc.icon === ic} disabled={!editable} onClick={() => upd({ icon: ic })}><Ic /></button>; })}</span></label>
                  <label><span>{dz.basics.tone}</span><span className="chips">{TONES.map((tn) => <button key={tn} type="button" className={`qicon ${tn} dz-tone ${svc.tone === tn ? 'on' : ''}`} aria-pressed={svc.tone === tn} disabled={!editable} onClick={() => upd({ tone: tn })} aria-label={tn} />)}</span></label>
                  <div style={{ flexBasis: '100%' }}><PosPicker label={x.who.owner} ids={svc.owner?.positionId ? [svc.owner.positionId] : []} editable={editable} onChange={(ids) => upd({ owner: { positionId: ids[ids.length - 1] } })} /><span className="cell-sub">{x.who.ownerHint}</span></div>
                </div></Group></Item>
                <div className="section-label"><span>{dz.basics.who}</span></div>
                <Item><Group><div className="ed-row dz-ed">
                  <p className="cell-sub" style={{ flexBasis: '100%', margin: 0 }}>{dz.basics.whoHint}</p>
                  <label><span>{dz.basics.groups}</span><span className="chips">{state.groups.map((g) => { const on = (svc.scope?.groups || []).includes(g.id); return <button key={g.id} type="button" className={`pill ${on ? 'tint' : ''}`} aria-pressed={on} disabled={!editable} onClick={() => upd({ scope: { ...(svc.scope || {}), groups: on ? (svc.scope?.groups || []).filter((z) => z !== g.id) : [...(svc.scope?.groups || []), g.id] } })}>{on ? <I.check /> : <I.plus />}{tx(g.name)}</button>; })}</span></label>
                  <label><span>{dz.basics.locations}</span><span className="chips">{(['riyadh', 'abudhabi'] as const).map((l) => { const on = (svc.scope?.locations || []).includes(l); return <button key={l} type="button" className={`pill ${on ? 'tint' : ''}`} aria-pressed={on} disabled={!editable} onClick={() => upd({ scope: { ...(svc.scope || {}), locations: on ? (svc.scope?.locations || []).filter((z) => z !== l) : [...(svc.scope?.locations || []), l] } })}>{on ? <I.check /> : <I.plus />}{t.leave.location[l]}</button>; })}</span></label>
                  <label style={{ flexBasis: '100%' }}><span>{x.who.eligibility}</span><span className="chips">{(['female', 'male', 'parent', 'outsideHome'] as const).map((e) => { const on = (svc.eligibility || []).includes(e); return <button key={e} type="button" className={`pill ${on ? 'tint' : ''}`} aria-pressed={on} disabled={!editable} onClick={() => upd({ eligibility: on ? (svc.eligibility || []).filter((z) => z !== e) : [...(svc.eligibility || []), e] })}>{on ? <I.check /> : <I.plus />}{x.who.elig[e]}</button>; })}</span></label>
                  <label style={{ flexBasis: '100%' }}><span>{dz.basics.onBehalf}</span><select id="dz-onbehalf" className="select-in" value={svc.onBehalf || 'none'} disabled={!editable} onChange={(e) => upd({ onBehalf: e.target.value as ConfiguredService['onBehalf'] })}>{(['none', 'team', 'former', 'hrAny', 'unit'] as const).map((o) => <option key={o} value={o}>{dz.basics.onBehalfOpt[o]}</option>)}</select></label>
                  <Sw on={!!svc.confidential} set={(v) => upd({ confidential: v, hideRequester: v ? svc.hideRequester : false })} label={dz.basics.confidential} hint={dz.basics.confidentialHint} id="dz-conf" editable={editable} />
                  {svc.confidential ? <Sw on={!!svc.hideRequester} set={(v) => upd({ hideRequester: v })} label={dz.basics.hideRequester} hint={dz.basics.hideRequesterHint} id="dz-anon" editable={editable} /> : null}
                </div></Group></Item>
                <div className="section-label"><span>{x.who.window} · {x.who.limit} · {x.who.prereq}</span></div>
                <Item><Group><div className="ed-row dz-ed">
                  <label><span>{x.who.window}: {x.who.windowFrom}</span><input type="date" dir="ltr" className="num" value={svc.window?.from || ''} disabled={!editable} onChange={(e) => upd({ window: { ...(svc.window || {}), from: e.target.value || undefined } })} /></label>
                  <label><span>{x.who.windowTo}</span><input type="date" dir="ltr" className="num" value={svc.window?.to || ''} disabled={!editable} onChange={(e) => upd({ window: { ...(svc.window || {}), to: e.target.value || undefined } })} /><span className="cell-sub">{x.who.windowHint}</span></label>
                  <label><span>{x.who.limit}: {x.who.limitCount}</span><input id="dz-limit-count" className="num-in num" type="number" min={0} value={svc.limit?.count ?? ''} placeholder={x.who.noLimit} disabled={!editable} onChange={(e) => upd({ limit: e.target.value === '' || Number(e.target.value) === 0 ? undefined : { count: Number(e.target.value), per: svc.limit?.per || 'year' } })} /></label>
                  <label><span>{x.who.limitPer}</span><select className="select-in" value={svc.limit?.per || 'year'} disabled={!editable || !svc.limit} onChange={(e) => upd({ limit: { count: svc.limit?.count || 1, per: e.target.value as NonNullable<ConfiguredService['limit']>['per'] } })}>{(['year', 'month', 'ever', 'open'] as const).map((p) => <option key={p} value={p}>{x.who.limitPers[p]}</option>)}</select></label>
                  <label><span>{x.who.minService}</span><input className="num-in num" type="number" min={0} value={svc.prereq?.minServiceMonths ?? ''} disabled={!editable} onChange={(e) => upd({ prereq: { ...(svc.prereq || {}), minServiceMonths: e.target.value === '' ? undefined : Number(e.target.value) } })} /></label>
                  <label><span>{x.who.requiresService}</span><select className="select-in" value={svc.prereq?.requiresService || ''} disabled={!editable} onChange={(e) => upd({ prereq: { ...(svc.prereq || {}), requiresService: e.target.value || undefined } })}><option value="">—</option>{(sel.content.designer?.services || []).filter((s) => s.id !== svc.id).map((s) => <option key={s.id} value={s.id}>{tx(s.name)} · {s.id}</option>)}</select></label>
                  <Sw on={!!svc.prereq?.requiresRecord} set={(v) => upd({ prereq: { ...(svc.prereq || {}), requiresRecord: v || undefined } })} label={x.who.requiresRecord} editable={editable} />
                </div></Group></Item>
                <div className="section-label"><span>{x.who.visibility}</span></div>
                <Item><Group><div className="ed-row dz-ed">
                  <label style={{ flexBasis: '100%' }}><span>{x.who.visibility}</span><div className="segmented sm"><button type="button" aria-pressed={(svc.visibility || 'all') === 'all'} disabled={!editable} onClick={() => upd({ visibility: 'all' })}><span className="seg-txt">{x.who.visAll}</span></button><button type="button" id="dz-vis-pilot" aria-pressed={svc.visibility === 'pilot'} disabled={!editable} onClick={() => upd({ visibility: 'pilot', pilot: svc.pilot || {} })}><span className="seg-txt">{x.who.visPilot}</span></button></div></label>
                  {svc.visibility === 'pilot' ? (<>
                    <label style={{ flexBasis: '100%' }}><span>{x.who.pilotUnits}</span><span className="chips">{state.org.units.map((u) => { const on = (svc.pilot?.unitIds || []).includes(u.id); return <button key={u.id} type="button" className={`pill ${on ? 'tint' : ''}`} aria-pressed={on} disabled={!editable} onClick={() => upd({ pilot: { ...(svc.pilot || {}), unitIds: on ? (svc.pilot?.unitIds || []).filter((z) => z !== u.id) : [...(svc.pilot?.unitIds || []), u.id] } })}>{on ? <I.check /> : <I.plus />}{tx(u.name)}</button>; })}</span></label>
                    <label style={{ flexBasis: '100%' }}><span>{x.who.pilotPeople}</span><span className="chips">{state.people.filter((p) => p.positionId).map((p) => { const on = (svc.pilot?.personIds || []).includes(p.id); return <button key={p.id} type="button" className={`pill ${on ? 'tint' : ''}`} aria-pressed={on} disabled={!editable} onClick={() => upd({ pilot: { ...(svc.pilot || {}), personIds: on ? (svc.pilot?.personIds || []).filter((z) => z !== p.id) : [...(svc.pilot?.personIds || []), p.id] } })}>{on ? <I.check /> : <I.plus />}{lang === 'ar' ? p.name : p.nameEn}</button>; })}</span></label>
                  </>) : null}
                </div></Group></Item>
                <div className="section-label"><span>{x.who.before} · {x.who.declaration}</span></div>
                <Item><Group><div className="ed-row dz-ed">
                  <Sw on={!!svc.paged} set={(v) => upd({ paged: v })} label={x.who.paged} id="dz-paged" editable={editable} />
                  <label style={{ flexBasis: '100%' }}><span>{x.who.before}</span><textarea id="dz-before" rows={3} value={(svc.beforeYouStart || []).map((b) => b.ar).join('\n')} disabled={!editable} onChange={(e) => upd({ beforeYouStart: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean).map((s, i) => ({ ar: s, en: svc.beforeYouStart?.[i]?.en || s })) })} /><span className="cell-sub">{x.who.beforeHint}</span></label>
                  <label style={{ flexBasis: '100%' }}><span>{x.who.before} (EN)</span><textarea dir="ltr" rows={3} value={(svc.beforeYouStart || []).map((b) => b.en).join('\n')} disabled={!editable} onChange={(e) => { const ens = e.target.value.split('\n'); upd({ beforeYouStart: (svc.beforeYouStart || []).map((b, i) => ({ ...b, en: (ens[i] || '').trim() || b.ar })) }); }} /></label>
                  <Bi label={x.who.declaration} labelEn={x.who.declarationEn} value={svc.declaration} onChange={(v) => upd({ declaration: v.ar || v.en ? v : undefined })} editable={editable} rows={2} full id="dz-decl" />
                  <label><span>{dz.basics.tenant}</span><input value={`${tx(state.tenant.name)} · ${svc.tenant}`} disabled /><span className="cell-sub">{dz.basics.tenantHint}</span></label>
                  {!isNew ? <EndDate endedAt={svc.endedAt} editable={editable} today={today} onChange={(endedAt) => upd({ endedAt })} t={t} lang={lang} /> : null}
                </div></Group></Item>
              </Stagger>
            )}

            {sec === 'form' && <FormEditor svc={svc} setSvc={set} editable={editable} inBase={inBase} baseSvc={baseSvc} />}
            {sec === 'route' && <RouteEditor svc={svc} setSvc={set} editable={editable} />}
            {sec === 'output' && <OutputsEditor svc={svc} setSvc={set} editable={editable} inBase={inBaseOut} person={persona as Person} />}
            {sec === 'notify' && <NotifyEditor svc={svc} setSvc={set} editable={editable} />}

            {sec === 'safety' && (
              <Stagger>
                {problems.length === 0 ? <Item><Group><div className="empty"><span className="ic"><I.check /></span><b>{dz.safety.ok}</b></div></Group></Item> : (<>
                  <Item><Notice tone="danger" icon="alert">{problems.length === 1 ? dz.safety.problem1 : fill(dz.safety.problemsN, { n: problems.length })}</Notice></Item>
                  <Item><Group>{problems.map((p, i) => <div key={i} className="cell"><span className="cell-lead danger"><I.alert /></span><span className="cell-main"><span className="cell-title">{tx(p.text)}</span><span className="cell-sub">{p.kind}</span></span></div>)}</Group></Item>
                </>)}
              </Stagger>
            )}

            {sec === 'simulate' && (
              <Stagger>
                <Item><Notice icon="target">{x.sim.hint}</Notice></Item>
                <Item><Group><div className="ed-row dz-ed">
                  <label><span>{dz.preview.as}</span><select className="select-in" value={personaId} onChange={(e) => { setPersonaId(e.target.value); setSimValues(null); }}>{state.people.filter((p) => p.positionId).map((p) => <option key={p.id} value={p.id}>{lang === 'ar' ? p.name : p.nameEn} · {lang === 'ar' ? p.title : p.titleEn}</option>)}</select></label>
                  <label><span>&nbsp;</span><button type="button" id="dz-sim-run" className="btn primary" onClick={() => setSimValues(sampleValues(state, svc, persona as Person))}><I.sparkle />{x.sim.run}</button></label>
                </div></Group></Item>
                {sim ? (<>
                  <Item><Group>
                    <div className="cell"><span className={`cell-lead ${sim.eligibility.ok ? 'ok' : 'danger'}`}>{sim.eligibility.ok ? <I.check /> : <I.lock />}</span><span className="cell-main"><span className="cell-title">{sim.eligibility.ok ? x.sim.eligible : x.sim.notEligible}</span>{sim.eligibility.reasons.length ? <span className="cell-sub">{sim.eligibility.reasons.map((r) => tx(r)).join(' · ')}</span> : null}</span></div>
                    {sim.errors.length ? <div className="cell"><span className="cell-lead warn"><I.alert /></span><span className="cell-main"><span className="cell-title">{x.sim.errors}</span><span className="cell-sub">{sim.errors.map((e) => `${tx(allFields(svc).find((f) => f.id === e.field)?.label)}: ${tx(e.text)}`).join(' · ')}</span></span></div> : null}
                  </Group></Item>
                  <div className="section-label"><span>{x.sim.route}</span></div>
                  <Item><Group><div style={{ padding: '10px 14px 12px' }}><RoutePreview steps={sim.steps.steps} requester={persona as Person} notApplied={sim.steps.notApplied} /></div></Group></Item>
                  <div className="section-label"><span>{x.sim.documents} · {x.sim.registers} · {x.sim.contracts}</span></div>
                  <Item><Group>
                    {sim.documents.map((d, i) => <div key={`d${i}`} className="cell"><span className="cell-lead gold"><I.seal /></span><span className="cell-main"><span className="cell-title">{tx(d)}</span><span className="cell-sub">{x.sim.documents}</span></span></div>)}
                    {sim.registers.map((d, i) => <div key={`r${i}`} className="cell"><span className="cell-lead"><I.book /></span><span className="cell-main"><span className="cell-title">{tx(d)}</span><span className="cell-sub">{x.sim.registers}</span></span></div>)}
                    {sim.contracts.map((c, i) => <div key={`c${i}`} className="cell"><span className={`cell-lead ${c.ready ? 'ok' : 'danger'}`}><I.plug /></span><span className="cell-main"><span className="cell-title">{tx(c.name)} <Pill tone={c.ready ? 'ok' : 'danger'}>{c.ready ? x.sim.ready : x.sim.notReady}</Pill></span><span className="cell-sub">{tx(c.why)}</span></span></div>)}
                    {sim.followUps.map((d, i) => <div key={`f${i}`} className="cell"><span className="cell-lead"><I.send /></span><span className="cell-main"><span className="cell-title">{tx(d)}</span><span className="cell-sub">{x.sim.followUps}</span></span></div>)}
                    {!sim.documents.length && !sim.registers.length && !sim.contracts.length && !sim.followUps.length ? <div className="empty"><span className="ic"><I.info /></span><b>{x.sim.nothing}</b></div> : null}
                  </Group></Item>
                  <div className="section-label"><span>{x.sim.notifications}</span></div>
                  <Item><Group>{sim.notifications.length ? sim.notifications.map((n, i) => <div key={i} className="cell"><span className="cell-lead"><I.bell /></span><span className="cell-main"><span className="cell-title">{tx(n)}</span></span></div>) : <div className="empty"><span className="ic"><I.bell /></span><b>{x.sim.nothing}</b></div>}</Group></Item>
                </>) : null}
              </Stagger>
            )}

            {sec === 'stats' && (
              <Stagger>
                {stats.total === 0 ? <Item><Group><div className="empty"><span className="ic"><I.balance /></span><b>{x.stats.none}</b></div></Group></Item> : (<>
                  <Item><div className="dz-stats">
                    <div className="dz-stat"><b className="num">{stats.total}</b><span>{x.stats.total}</span></div>
                    <div className="dz-stat"><b className="num">{stats.by.in_review || 0}</b><span>{x.stats.inReview}</span></div>
                    <div className="dz-stat"><b className="num">{stats.by.completed || 0}</b><span>{x.stats.completed}</span></div>
                    <div className="dz-stat"><b className="num">{(stats.by.rejected || 0) + (stats.by.returned || 0)}</b><span>{x.stats.rejected} / {x.stats.returned}</span></div>
                    <div className="dz-stat"><b className="num">{fill(x.stats.hours, { n: stats.medianHours })}</b><span>{x.stats.median}</span></div>
                    <div className="dz-stat"><b className="num">{stats.overdue}</b><span>{x.stats.overdue}</span></div>
                  </div></Item>
                  {stats.slowestStep ? <Item><Notice tone="warn" icon="clock">{x.stats.slowest}: {stats.slowestStep.title} ({stats.slowestStep.n})</Notice></Item> : null}
                  <Item><Group>{state.requests.filter((r) => r.serviceId === id).slice(0, 12).map((r) => <button key={r.id} type="button" className="cell" onClick={() => nav(`#/requests/${r.id}`)}><span className="cell-main"><span className="cell-title"><span className="mono">{r.id}</span> · {lang === 'ar' ? state.people.find((p) => p.id === r.requesterId)?.name : state.people.find((p) => p.id === r.requesterId)?.nameEn}</span><span className="cell-sub">{t.status[r.status]} · {toISO(r.createdAt)}</span></span><I.chev className="chev dirchev" /></button>)}</Group></Item>
                </>)}
              </Stagger>
            )}

            {sec === 'preview' && !desk ? previewPane : null}
          </motion.div>
        </AnimatePresence>
        <div style={{ height: 90 }} />
      </div>
      {desk ? <div className="dzs-side">{previewPane}</div> : null}

      <AnimatePresence>
        {editable && pending && (
          <motion.div className="savebar" initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} transition={SPRING.soft}>
            <span className="sb-n">{tx(svc.name) || svc.id}</span>
            <input className="sb-why" value={why} onChange={(e) => setWhy(e.target.value)} placeholder={t.need.policy.why} />
            <motion.button type="button" className="btn primary" onClick={save} whileTap={{ scale: 0.97 }}><I.check />{t.need.policy.save}</motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
