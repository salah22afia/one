/* v0.15 «مصمّم الخدمات» (بطاقة القدرة CAP-02، D-032…D-034): دليل الخدمات كله بنوع كل خدمة (منتَج / مهيّأة / خارج القاعدة من الجرد ق.ص-01) وحالتها،
   والخدمات المهيّأة كائناتُ إصدار على آلة الإصدارات نفسها (مسودة ← فحص سلامة ← جدولة بتاريخ وسبب ومرجع ← سريان)، وفتح كلٍّ منها في صفحة التصميم بمعاينتها الحية. */
import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '../app/store';
import { nav } from '../app/router';
import { I } from '../ui/icons';
import { Field, Group, LargeTitle, Notice, Pill, Segmented, Sheet, TopBar, SearchField, useLang, usePerson, useToast, Empty } from '../ui/components';
import { motion, AnimatePresence, Stagger, Item, Press, SPRING } from '../ui/motion';
import { statusOf, endOf, activeVersion, diffContent, labelFor, toISO, scheduleProblem, inForce, liveNeed, TENANT_DEFAULT, primaryOutput, stepTitle, agentTitle, type PolicyContent, type ConfiguredService, type VersionStatus } from '../domain/policy';
import { designerProblems, cloneService, importService, exportService, allFields } from '../domain/designer';
import { ConfiguredRequest } from './ConfiguredRequest';
import { DZ_TEMPLATES } from '../data/dzTemplates';
import { liveTenants } from '../domain/tenants';
import { DOMAINS, SERVICES, type Service } from '../data/catalog';
import { INVENTORY } from '../data/inventory';
import { DOMAIN_ICON, DOMAIN_TONE } from './Services';
import { norm } from '../app/search';
import { useUI } from '../app/ui';
import { fmtDate, changesText, fill } from '../app/i18n';
import { AdminNav } from './AdminCenter';

type Tab = 'catalog' | 'services' | 'templates' | 'diff' | 'log';
const statusToneOf = (s: VersionStatus) => (s === 'active' ? 'ok' : s === 'scheduled' ? 'tint' : s === 'awaiting' ? 'gold' : s === 'draft' ? 'warn' : s === 'cancelled' || s === 'reverted' ? 'danger' : s === 'corrected' ? 'warn' : 'done');
const fmtVal = (v: string, lang: 'ar' | 'en') => (v === 'true' ? (lang === 'ar' ? 'نعم' : 'yes') : v === 'false' ? (lang === 'ar' ? 'لا' : 'no') : v === '' ? '—' : v.length > 60 ? `${v.slice(0, 60)}…` : v);
const BUILT = new Set(['TM-01', 'AS-01', 'MD-01', 'MD-02', 'MD-05', 'FN-01']);

/** خدمة مهيّأة جديدة من بند في الدليل أو برمز جديد: هيكل فارغ يُملأ في صفحة التصميم */
export function blankService(id: string, domain: string, name: { ar: string; en: string }, description: { ar: string; en: string }, source: 'catalog' | 'new', at = Date.now(), tenant = TENANT_DEFAULT): ConfiguredService {
  return { id, tenant, kind: 'configured', source, domain, icon: DOMAIN_ICON[domain] || 'grid', tone: DOMAIN_TONE[domain] || 'g-sage', name, description, onBehalf: 'none', sections: [{ id: 'sec-1', title: { ar: 'بيانات الطلب', en: 'Request details' }, fields: [] }], route: [{ id: 'mgr', agent: { kind: 'lineManager' }, mode: 'approve', slaHours: 48, escalation: { remindAtPct: 80, after: 'notifyManager' } }], outputs: [], createdAt: at };
}
/** رمز جديد في المجال: أول رقم غير مستعمل في الدليل ولا في المصمّم */
export function nextCode(domain: string, taken: string[]): string { let n = 1; const used = new Set([...SERVICES.filter((s) => s.domain === domain).map((s) => s.id), ...taken]); while (used.has(`${domain}-${String(n).padStart(2, '0')}`)) n++; return `${domain}-${String(n).padStart(2, '0')}`; }

export function DesignerCenter() {
  const { state, dispatch } = useStore(); const { lang, t, tx } = useLang(); const me = usePerson(); const toast = useToast(); const { L, desk } = useUI(); const dz = L.dz;
  const today = toISO(Date.now()); const policy = state.designer; const versions = policy.versions; const active = activeVersion(policy, today);
  const anyDraft = versions.find((v) => statusOf(v, versions, today) === 'draft');
  const [selId, setSelId] = useState<string>(anyDraft ? anyDraft.id : active.id);
  const sel = versions.find((v) => v.id === selId) || active; const selStatus = statusOf(sel, versions, today);
  const isAdmin = me.persona === 'admin'; const editable = selStatus === 'draft' && isAdmin; const draft = selStatus === 'draft' ? sel : undefined;
  const [tab, setTab] = useState<Tab>('catalog');
  const content = sel.content; const services = (content.designer?.services || []).filter((s) => s.tenant === state.tenant.id); const x = dz.v16;
  const base = versions.find((v) => v.id === sel.baseId)?.content || sel.content;
  const diffs = useMemo(() => diffContent(base, content), [base, content]);
  const [schedOpen, setSchedOpen] = useState(false); const [sched, setSched] = useState({ from: sel.from, reason: sel.reason, reference: sel.reference });
  useEffect(() => { setSched({ from: sel.from, reason: sel.reason, reference: sel.reference }); }, [sel.id, sel.from, sel.reason, sel.reference]);
  const schedProblem = draft ? scheduleProblem(policy, draft.id, sched.from, today, content) : null;
  const problems = useMemo(() => (content.designer ? designerProblems(state, content.designer, sched.from || today) : []), [state, content.designer, sched.from, today]);
  const newDraft = () => { dispatch({ type: 'designerDraft', by: me.id }); toast({ title: t.policy.created, sub: dz.title, icon: 'sparkle', tone: 'info' }); setTimeout(() => setSelId(`V-${versions.length + 1}`), 0); };
  const cancel = () => { if (!draft) return; dispatch({ type: 'designerCancel', id: draft.id }); setSelId(active.id); toast({ title: t.policy.cancelled, icon: 'x', tone: 'warn' }); };
  const schedule = () => { if (!draft || !sched.from || !sched.reason.trim() || !sched.reference.trim() || schedProblem || problems.length) return; dispatch({ type: 'designerSchedule', id: draft.id, from: sched.from, reason: sched.reason, reference: sched.reference }); setSchedOpen(false); toast({ title: t.policy.scheduled, sub: `${draft.number} · ${t.policy.from} ${sched.from}`, icon: 'calendar', tone: 'gold' }); };
  /* إضافة خدمة إلى المسودة (من الدليل أو برمز جديد) ثم فتحها في صفحة التصميم */
  const addService = (svc: ConfiguredService) => { if (!draft) return; const c: PolicyContent = { ...content, designer: { services: [...(content.designer?.services || []), svc] } }; dispatch({ type: 'designerUpdate', id: draft.id, content: c, by: me.id, why: lang === 'ar' ? `إضافة الخدمة ${svc.id}` : `Added service ${svc.id}` }); toast({ title: dz.created, sub: tx(svc.name), icon: 'sparkle', tone: 'ok' }); setTimeout(() => nav(`#/admin/designer/svc/${svc.id}`), 60); };
  const [q, setQ] = useState(''); const [filter, setFilter] = useState<'all' | 'configured' | 'product'>('all'); const [openDomains, setOpenDomains] = useState<string[]>([]); const [tplPreview, setTplPreview] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false); const [nw, setNw] = useState({ domain: 'WP', ar: '', en: '' });
  /* v0.16: النسخ والاستيراد والقوالب ونسخ إلى مستأجر */
  const [cloneOf, setCloneOf] = useState<ConfiguredService | null>(null); const [cloneName, setCloneName] = useState({ ar: '', en: '', tenant: state.tenant.id }); const [importOpen, setImportOpen] = useState(false); const [importText, setImportText] = useState(''); const [importErr, setImportErr] = useState('');
  const tenants = liveTenants(state); const allServices = content.designer?.services || [];
  const addAny = (svc: ConfiguredService) => { if (!draft) return; const c: PolicyContent = { ...content, designer: { services: [...allServices, svc] } }; dispatch({ type: 'designerUpdate', id: draft.id, content: c, by: me.id, why: lang === 'ar' ? `إضافة الخدمة ${svc.id}` : `Added service ${svc.id}` }); };
  const doClone = () => { if (!cloneOf || !draft) return; const id = nextCode(cloneOf.domain, allServices.map((s) => s.id)); const c = cloneService(cloneOf, id, { ar: cloneName.ar.trim() || `${cloneOf.name.ar} (نسخة)`, en: cloneName.en.trim() || `${cloneOf.name.en} (copy)` }); c.tenant = cloneName.tenant; addAny(c); setCloneOf(null); toast({ title: x.center.cloned, sub: `${c.id} · ${cloneName.tenant}`, icon: 'copy', tone: 'ok' }); if (c.tenant === state.tenant.id) setTimeout(() => nav(`#/admin/designer/svc/${c.id}`), 60); };
  const doImport = () => { const r = importService(importText, state.tenant.id, allServices.map((s) => s.id)); if (!r.ok) { setImportErr(tx(r.why)); return; } addAny(r.service); setImportOpen(false); setImportText(''); toast({ title: x.center.imported, sub: r.service.id, icon: 'upload', tone: 'ok' }); setTimeout(() => nav(`#/admin/designer/svc/${r.service.id}`), 60); };
  const doExport = (svc: ConfiguredService) => { const json = exportService(svc); navigator.clipboard?.writeText(json).then(() => toast({ title: x.center.exported, sub: svc.id, icon: 'copy', tone: 'ok' })).catch(() => toast({ title: x.center.exported, sub: svc.id, icon: 'copy', tone: 'ok' })); };
  const liveIn = (s: ConfiguredService) => !s.endedAt || s.endedAt > today;
  const activeServices = active.content.designer?.services || [];
  const baseSvc = (id: string) => base.designer?.services.find((s) => s.id === id);
  const svcStatus = (s: ConfiguredService): { label: string; tone: string } => {
    if (s.endedAt && s.endedAt <= today) return { label: dz.status.ended, tone: 'danger' };
    if (draft && sel.id === draft.id && !baseSvc(s.id)) return { label: dz.status.draftNew, tone: 'gold' };
    if (draft && sel.id === draft.id && JSON.stringify(baseSvc(s.id)) !== JSON.stringify(s)) return { label: dz.status.changed, tone: 'warn' };
    if (s.endedAt) return { label: `${dz.status.endsOn} ${s.endedAt}`, tone: 'warn' };
    return { label: dz.status.live, tone: 'ok' };
  };
  const reqCount = (id: string) => state.requests.filter((r) => r.serviceId === id).length;
  const metaFields = (s: ConfiguredService) => { const n = liveNeed(s.sections, today).flatMap((x) => liveNeed(x.fields, today)).filter((f) => f.kind !== 'guidance').length; return n === 0 ? dz.meta.noFields : n === 1 ? dz.meta.field1 : n <= 10 ? fill(dz.meta.fieldsFew, { n }) : fill(dz.meta.fields, { n }); };
  const metaSteps = (s: ConfiguredService) => (s.route.length === 1 ? dz.meta.step1 : s.route.length <= 10 ? fill(dz.meta.steps, { n: s.route.length }) : fill(dz.meta.stepsMany, { n: s.route.length }));
  const metaReq = (id: string) => { const n = reqCount(id); return n === 0 ? dz.meta.noRequests : n === 1 ? dz.meta.request1 : n <= 10 ? fill(dz.meta.requestsFew, { n }) : fill(dz.meta.requests, { n }); };

  /* الدليل: الخدمات الـ78 بنوعها من الجرد + ما أُضيف برمز جديد في المصمّم */
  const rows = useMemo(() => {
    const extra = services.filter((s) => !SERVICES.some((c) => c.id === s.id)).map((s): Service => ({ id: s.id, domain: s.domain, name: s.name.ar, nameEn: s.name.en, scope: s.description.ar, requester: [], target: '', freq: '', rec: 'w2' }));
    const all = [...SERVICES.filter((s) => s.rec !== 'merge' && s.rec !== 'out'), ...extra];
    const n = norm(q.trim());
    return all.filter((s) => { const inv = INVENTORY[s.id]; const kind = inv ? inv.kind : 'C'; const isCfg = services.some((c) => c.id === s.id); if (filter === 'configured' && !(kind === 'C' || isCfg)) return false; if (filter === 'product' && kind !== 'P') return false; return !n || norm(`${s.name} ${s.nameEn || ''} ${s.id}`).includes(n); });
  }, [services, q, filter]);

  const timeline = (
    <div className="ptl">
      {versions.filter((v) => !v.cancelled || v.revoked).map((v) => { const st = statusOf(v, versions, today); const end = endOf(v, versions); const on = v.id === sel.id; return (
        <Press key={v.id} className={`ptl-card ${st} ${on ? 'on' : ''}`} onClick={() => setSelId(v.id)} lift>
          {on ? <motion.span className="ptl-on" layoutId="dptl-on" transition={SPRING.snappy} /> : null}
          <span className="ptl-body"><span className="ptl-top"><b className="num">{v.number}</b><Pill tone={statusToneOf(st)}>{t.policy.status[st]}</Pill></span>
          <span className="ptl-dates num">{st === 'draft' ? (lang === 'ar' ? 'لم يُجدوَل' : 'not scheduled') : `${v.from} → ${end || t.policy.open}`}</span>
          <span className="ptl-sub">{v.changes.length ? changesText(v.changes.length, lang) : v.reason ? v.reason.slice(0, 40) : ''}</span></span>
        </Press>
      ); })}
      {isAdmin && !anyDraft ? <Press className="ptl-card new" onClick={newDraft} lift><span className="ptl-body"><span className="cell-lead"><I.plus /></span><b>{t.need.policy.newDraft}</b></span></Press> : null}
    </div>
  );
  const kindPill = (id: string) => { const inv = INVENTORY[id]; const cfg = services.find((s) => s.id === id); if (cfg) return <Pill tone="tint" icon="sparkle">{cfg.kind === 'hybrid' ? dz.kind.hybrid : dz.kind.configured}</Pill>; if (!inv) return <Pill tone="tint">{dz.kind.configured}</Pill>; return inv.kind === 'P' ? <Pill tone="gold">{dz.kind.product}{inv.hybrid ? ` · ${dz.kind.hybrid}` : ''}</Pill> : inv.kind === 'C' ? <Pill tone="tint">{dz.kind.configured}</Pill> : <Pill>{dz.kind.outside}</Pill>; };
  const statePill = (id: string) => { const cfg = services.find((s) => s.id === id); if (cfg) { const st = svcStatus(cfg); return <Pill tone={st.tone}>{st.label}</Pill>; } if (BUILT.has(id)) return <Pill tone="ok" icon="check">{dz.kind.built}</Pill>; return <Pill>{dz.kind.notBuilt}</Pill>; };

  return (
    <div className="page view policy npc dzc">
      <TopBar title={dz.title} back="#/admin" />
      <LargeTitle title={dz.title} sub={dz.sub} />
      <AdminNav />
      {!isAdmin ? <><Notice tone="warn" icon="info">{t.policy.onlyAdmin}</Notice><div style={{ height: 12 }} /></> : null}
      <div className="dz-ctx"><Pill tone="tint" icon="building">{x.center.tenantCtx}: {tx(state.tenant.name)} · <span className="mono">{state.tenant.id}</span></Pill></div>
      <div className="section-head" style={{ paddingTop: 6 }}><h2>{t.need.policy.versions}</h2>{draft && isAdmin ? <span className="kbd-row" style={{ padding: 0 }}><button type="button" className="btn quiet" onClick={cancel}>{t.need.policy.cancelDraft}</button><button type="button" className="btn soft" onClick={() => setSchedOpen(true)}><I.calendar />{t.need.policy.schedule}</button></span> : null}</div>
      {timeline}
      <div className="pv-head">
        <div className="pv-line"><span><b className="num">{sel.number}</b> <Pill tone={statusToneOf(selStatus)}>{t.policy.status[selStatus]}</Pill>{selStatus !== 'draft' ? <span className="cell-sub"> {t.policy.from} <span className="num">{sel.from}</span>{endOf(sel, versions) ? <> {t.policy.to} <span className="num">{endOf(sel, versions)}</span></> : null}</span> : null}</span></div>
        {sel.reason ? <p className="cell-sub">{sel.reason}{sel.reference ? ` · ${sel.reference}` : ''}</p> : null}
        <p className="hint-line" style={{ padding: '6px 0 0' }}>{editable ? dz.version.hint : isAdmin && !anyDraft ? t.need.policy.noDraft : dz.version.hint}</p>
      </div>
      <Segmented id="dzc" value={tab} onChange={setTab} options={[{ v: 'catalog', label: dz.tabs.catalog, n: rows.length }, { v: 'services', label: dz.tabs.services, n: services.filter(liveIn).length }, { v: 'templates', label: dz.tabs.templates, n: DZ_TEMPLATES.length }, { v: 'diff', label: t.policy.diff, n: diffs.length }, { v: 'log', label: t.policy.changes }]} />
      <div style={{ height: 12 }} />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={tab + sel.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6, transition: { duration: 0.1 } }} transition={SPRING.soft}>

          {tab === 'catalog' && (
            <Stagger>
              <Item><Notice icon="info">{dz.kindHint.product} · {dz.kindHint.configured}</Notice></Item>
              <Item><div className="dz-tools"><SearchField id="dzq" value={q} onChange={setQ} placeholder={dz.filter.search} /><Segmented id="dzf" value={filter} onChange={setFilter} options={[{ v: 'all', label: dz.filter.all }, { v: 'configured', label: dz.filter.configured }, { v: 'product', label: dz.filter.product }]} /></div></Item>
              {DOMAINS.map((d) => { const list = rows.filter((s) => s.domain === d.id); if (!list.length) return null; const Ic = I[DOMAIN_ICON[d.id] || 'grid'];
                /* v0.17/v0.18: المجالات مطوية بعددها (78 خدمة كانت 13 ألف بكسل من التمرير) وتُفتح بلمسة؛ البحث أو المرشّح يفتحها كلها */
                const folded = !q.trim() && filter === 'all' && !openDomains.includes(d.id);
                return (
                <Item key={d.id}>
                  <button type="button" className={`lb-head sm dz-domhead ${folded ? 'folded' : ''}`} aria-expanded={!folded} onClick={() => setOpenDomains((o) => (o.includes(d.id) ? o.filter((z) => z !== d.id) : [...o, d.id]))}><h2>{lang === 'ar' ? d.name : d.nameEn}</h2><span className="lb-muted">{d.id} · {list.length}</span><I.chevDown className={`lb-chev ${folded ? '' : 'up'}`} /></button>
                  {folded ? null : <Group>
                    {list.map((s) => { const inv = INVENTORY[s.id]; const cfg = services.find((x) => x.id === s.id); const canBuild = editable && !cfg && (!inv || inv.kind === 'C'); return (
                      <div key={s.id} className={`cell stacked dz-row ${cfg ? 'cfg' : ''}`}>
                        <span className="dz-row-main"><span className={`cell-lead ${cfg ? DOMAIN_TONE[s.domain] || '' : 'plain'}`}><Ic /></span><span className="cell-main"><span className="cell-title">{lang === 'ar' ? s.name : s.nameEn || s.name}<span className="mono cell-code">{s.id}</span></span><span className="cell-sub">{inv ? inv.why : lang === 'ar' ? 'خدمة أُضيفت من المصمّم برمز جديد' : 'A service added from the designer with a new code'}</span></span></span>
                        <span className="dz-row-meta">{kindPill(s.id)}{statePill(s.id)}{s.rec !== 'w2' || SERVICES.some((c) => c.id === s.id) ? <Pill>{dz.inWave} {dz.wave[s.rec]}</Pill> : null}
                          {cfg ? <button type="button" className="btn soft sm" onClick={() => nav(`#/admin/designer/svc/${s.id}`)}><I.gear />{dz.edit}</button> : canBuild ? <button type="button" className="btn primary sm" onClick={() => addService(blankService(s.id, s.domain, { ar: s.name, en: s.nameEn || s.name }, { ar: s.scope, en: s.nameEn ? s.scope : s.scope }, 'catalog', Date.now(), state.tenant.id))}><I.plus />{dz.build}</button> : null}
                        </span>
                      </div>
                    ); })}
                  </Group>}
                </Item>
              ); })}
            </Stagger>
          )}

          {tab === 'services' && (
            <Stagger>
              <Item><Notice icon="sparkle">{dz.kindHint.configured}</Notice></Item>
              {editable ? <Item><button type="button" className="npc-add" onClick={() => { setNw({ domain: 'WP', ar: '', en: '' }); setNewOpen(true); }}><span className="cell-lead"><I.plus /></span>{dz.newService}<span className="cell-sub">{dz.newServiceSub}</span></button></Item> : null}
              {editable ? <Item><button type="button" className="npc-add dz-import" onClick={() => { setImportText(''); setImportErr(''); setImportOpen(true); }}><span className="cell-lead"><I.upload /></span>{x.center.importSvc}<span className="cell-sub">{x.center.importHint}</span></button></Item> : null}
              {services.length === 0 ? <Item><Group><div className="empty"><span className="ic"><I.sparkle /></span><b>{lang === 'ar' ? 'لا خدمات مهيّأة في هذا الإصدار' : 'No configured services in this version'}</b></div></Group></Item> : (
                <Stagger className="pt-grid" step={0.035}>{services.map((s) => { const Ic = I[(s.icon as keyof typeof I) || 'grid'] || I.grid; const st = svcStatus(s); return (
                  <Item key={s.id}><div className="dz-card-wrap"><Press className={`pt-card ${s.endedAt && s.endedAt <= today ? 'off' : ''}`} onClick={() => nav(`#/admin/designer/svc/${s.id}`)} lift>
                    <span className={`qicon ${s.tone || 'g-sage'}`}><Ic /></span>
                    <span className="pt-body"><b>{tx(s.name)} <span className="mono cell-code">{s.id}</span></b><span className="pt-meta"><Pill tone={st.tone}>{st.label}</Pill><Pill>{metaFields(s)}</Pill><Pill>{metaSteps(s)}</Pill><Pill tone={primaryOutput(s) === 'none' ? '' : 'gold'}>{primaryOutput(s) === 'document' ? dz.output.kinds.document : primaryOutput(s) === 'register' ? dz.v16.out.kinds.register : dz.output.kinds.none}</Pill>{s.confidential ? <Pill tone="gold" icon="lock">{dz.basics.confidential}</Pill> : null}<Pill tone="tint">{metaReq(s.id)}</Pill></span></span>
                    <I.chev className="chev dirchev" />
                  </Press><span className="dz-card-tools">{editable ? <button type="button" className="icon-btn" title={x.center.clone} aria-label={x.center.clone} onClick={() => { setCloneOf(s); setCloneName({ ar: '', en: '', tenant: state.tenant.id }); }}><I.copy /></button> : null}<button type="button" className="icon-btn" title={x.center.exportSvc} aria-label={x.center.exportSvc} onClick={() => doExport(s)}><I.download /></button></span></div></Item>
                ); })}</Stagger>
              )}
              {!editable && !activeServices.length ? null : null}
            </Stagger>
          )}

          {tab === 'templates' && (
            <Stagger>
              <Item><Notice icon="sparkle">{x.center.templatesHint}</Notice></Item>
              <Stagger className="pt-grid" step={0.035}>{DZ_TEMPLATES.map((tp) => { const Ic = I[(tp.icon as keyof typeof I) || 'grid'] || I.grid; return (
                <Item key={tp.id}><div className={`pt-card dz-tpl`}>
                  <span className={`qicon ${tp.tone}`}><Ic /></span>
                  <span className="pt-body"><b>{tx(tp.name)} <span className="mono cell-code">{tp.domain}</span></b><span className="cell-sub">{tx(tp.description)}</span><span className="pt-meta">{editable ? <button type="button" className="btn primary sm dz-use-tpl" onClick={() => { const id = nextCode(tp.domain, allServices.map((s) => s.id)); const svc = tp.build(id, state.tenant.id, Date.now()); addService(svc); }}><I.plus />{x.center.useTemplate}</button> : null}<button type="button" className="btn soft sm dz-tpl-preview" onClick={() => setTplPreview(tp.id)}><I.open />{dz.preview.tplPreview}</button></span></span>
                </div></Item>
              ); })}</Stagger>
              {/* v0.18: معاينة القالب قبل إنشاء شيء — شاشة الموظف نفسها لخدمة القالب وملخص حقولها ومسارها ومخرجاتها */}
              <TemplatePreviewSheet id={tplPreview} onClose={() => setTplPreview(null)} />
            </Stagger>
          )}

          {tab === 'diff' && (diffs.length === 0 ? <Group><div className="empty"><span className="ic"><I.check /></span><b>{t.policy.noChanges}</b></div></Group> : <Stagger><Group>{diffs.map((d) => { const lb = labelFor(d.path, content); return <Item key={d.path}><div className="diff-row"><b>{tx(lb)}</b><span className="diff-vals"><span className="before">{fmtVal(d.before, lang)}</span><I.chev className="dirchev" /><span className="after">{fmtVal(d.after, lang)}</span></span></div></Item>; })}</Group></Stagger>)}

          {tab === 'log' && (() => { const all = versions.flatMap((v) => v.changes.map((c) => ({ ...c, v: v.number }))).sort((a, b) => b.at - a.at); return all.length === 0 ? <Group><div className="empty"><span className="ic"><I.doc /></span><b>{t.policy.noChanges}</b></div></Group> : <Stagger><Group>{all.slice(0, 120).map((c, i) => { const who = state.people.find((p) => p.id === c.by); return <Item key={i}><div className="diff-row"><b>{tx(c.label)} <Pill tone="tint">{c.v}</Pill></b><span className="diff-vals"><span className="before">{fmtVal(c.before, lang)}</span><I.chev className="dirchev" /><span className="after">{fmtVal(c.after, lang)}</span></span><span className="cell-sub">{who ? (lang === 'ar' ? who.name : who.nameEn) : c.by} · {fmtDate(c.at, lang, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}{c.why ? ` · ${c.why}` : ''}</span></div></Item>; })}</Group></Stagger>; })()}
        </motion.div>
      </AnimatePresence>

      <Sheet open={newOpen} onClose={() => setNewOpen(false)} title={dz.newService} lead={<span className="qicon g-green" style={{ width: 40, height: 40, borderRadius: 13 }}><I.sparkle /></span>}>
        <Notice icon="info">{dz.newServiceSub}</Notice>
        <div style={{ height: 10 }} />
        <Group>
          <Field id="nw-domain" label={dz.domain}><select id="nw-domain" value={nw.domain} onChange={(e) => setNw((x) => ({ ...x, domain: e.target.value }))}>{DOMAINS.map((d) => <option key={d.id} value={d.id}>{lang === 'ar' ? d.name : d.nameEn} · {d.id}</option>)}</select></Field>
          <Field id="nw-ar" label={dz.basics.name}><input id="nw-ar" value={nw.ar} onChange={(e) => setNw((x) => ({ ...x, ar: e.target.value }))} /></Field>
          <Field id="nw-en" label={dz.basics.nameEn}><input id="nw-en" dir="ltr" value={nw.en} onChange={(e) => setNw((x) => ({ ...x, en: e.target.value }))} /></Field>
          <div className="summary-row"><span className="k">{dz.code}</span><span className="v mono">{nextCode(nw.domain, services.map((s) => s.id))}</span></div>
        </Group>
        <p className="cell-sub" style={{ margin: '6px 4px 0' }}>{dz.codeHint}</p>
        <div style={{ height: 12 }} />
        <motion.button type="button" className="btn primary block lg" disabled={!nw.ar.trim() || !nw.en.trim()} whileTap={{ scale: 0.97 }} onClick={() => { const id = nextCode(nw.domain, services.map((s) => s.id)); setNewOpen(false); addService(blankService(id, nw.domain, { ar: nw.ar.trim(), en: nw.en.trim() }, { ar: '', en: '' }, 'new', Date.now(), state.tenant.id)); }}><I.plus />{dz.newService}</motion.button>
      </Sheet>

      <Sheet open={!!cloneOf} onClose={() => setCloneOf(null)} title={x.center.clone} lead={<span className="qicon g-teal" style={{ width: 40, height: 40, borderRadius: 13 }}><I.copy /></span>}>
        <Group>
          <Field id="cl-ar" label={dz.basics.name}><input id="cl-ar" value={cloneName.ar} placeholder={cloneOf ? `${cloneOf.name.ar} (نسخة)` : ''} onChange={(e) => setCloneName((c) => ({ ...c, ar: e.target.value }))} /></Field>
          <Field id="cl-en" label={dz.basics.nameEn}><input id="cl-en" dir="ltr" value={cloneName.en} placeholder={cloneOf ? `${cloneOf.name.en} (copy)` : ''} onChange={(e) => setCloneName((c) => ({ ...c, en: e.target.value }))} /></Field>
          {tenants.length > 1 ? <Field id="cl-tenant" label={x.center.copyTo}><select id="cl-tenant" value={cloneName.tenant} onChange={(e) => setCloneName((c) => ({ ...c, tenant: e.target.value }))}>{tenants.map((tn) => <option key={tn.id} value={tn.id}>{tx(tn.name)} · {tn.id}</option>)}</select></Field> : null}
          <div className="summary-row"><span className="k">{x.center.codeFor}</span><span className="v mono">{cloneOf ? nextCode(cloneOf.domain, allServices.map((s) => s.id)) : ''}</span></div>
        </Group>
        <div style={{ height: 12 }} />
        <motion.button type="button" className="btn primary block lg" whileTap={{ scale: 0.97 }} onClick={doClone}><I.copy />{x.center.clone}</motion.button>
      </Sheet>
      <Sheet open={importOpen} onClose={() => setImportOpen(false)} title={x.center.importSvc} lead={<span className="qicon g-sage" style={{ width: 40, height: 40, borderRadius: 13 }}><I.upload /></span>}>
        <Notice icon="info">{x.center.importHint}</Notice>
        <div style={{ height: 10 }} />
        <Group><Field id="imp-json" label={x.center.pasteHere} error={importErr || undefined}><textarea id="imp-json" dir="ltr" rows={8} className="mono" value={importText} onChange={(e) => { setImportText(e.target.value); setImportErr(''); }} /></Field></Group>
        <div style={{ height: 12 }} />
        <motion.button type="button" className="btn primary block lg" disabled={!importText.trim()} whileTap={{ scale: 0.97 }} onClick={doImport}><I.upload />{x.center.importSvc}</motion.button>
      </Sheet>

      <Sheet open={schedOpen} onClose={() => setSchedOpen(false)} title={t.need.policy.schedule}>
        <Group>
          <Field id="dsc-from" label={t.policy.effective} error={schedProblem === 'past' ? t.policy.schedErrPast : schedProblem === 'taken' ? t.policy.schedErrTaken : schedProblem === 'beforeTip' ? (() => { const b = versions.filter((v) => v.id !== draft?.id && inForce(v) && v.from > sched.from).sort((a, c) => (a.from < c.from ? -1 : 1))[0]; return fill(t.policy.schedErrBeforeTip, { from: b?.from || '', number: b?.number || '' }); })() : undefined} hint={sched.from === today ? t.policy.schedToday : undefined}><input id="dsc-from" type="date" className="num" dir="ltr" value={sched.from} min={today} onChange={(e) => setSched((x) => ({ ...x, from: e.target.value }))} /></Field>
          <Field id="dsc-reason" label={t.need.policy.reason}><textarea id="dsc-reason" rows={2} value={sched.reason} onChange={(e) => setSched((x) => ({ ...x, reason: e.target.value }))} /></Field>
          <Field id="dsc-ref" label={t.need.policy.reference}><input id="dsc-ref" value={sched.reference} onChange={(e) => setSched((x) => ({ ...x, reference: e.target.value }))} /></Field>
        </Group>
        <div style={{ height: 10 }} />
        <Notice tone={schedProblem === 'empty' ? 'warn' : 'tint'} icon="target">{diffs.length ? changesText(diffs.length, lang) : t.policy.vscope.nothingYet}{schedProblem === 'empty' ? <> — {t.policy.schedErrEmpty}</> : null}</Notice>
        {problems.length ? <><div style={{ height: 10 }} /><Notice tone="danger" icon="alert">{problems.length === 1 ? dz.safety.problem1 : fill(dz.safety.problemsN, { n: problems.length })}<ul className="sched-list">{problems.map((p, i) => <li key={i}><b>{tx(p.service.name)}</b>: {tx(p.text)}</li>)}</ul></Notice></> : null}
        <div style={{ height: 10 }} />
        <Notice tone="tint" icon="clock">{lang === 'ar' ? `يسري هذا الإصدار آلياً في ${sched.from || '…'} وينتهي الساري في اليوم الذي قبله؛ الطلبات المقدَّمة قبله تكمل بإصدارها (D-009).` : `This version takes effect automatically on ${sched.from || '…'}; the current one ends the day before. Requests submitted earlier complete under their own version (D-009).`}</Notice>
        <div style={{ height: 12 }} />
        <motion.button type="button" className="btn primary block lg" disabled={!sched.from || !sched.reason.trim() || !sched.reference.trim() || !!schedProblem || problems.length > 0} onClick={schedule} whileTap={{ scale: 0.97 }}><I.calendar />{t.need.policy.schedule}</motion.button>
      </Sheet>
      {desk ? null : <div style={{ height: 24 }} />}
    </div>
  );
}

/* v0.18: لوح معاينة القالب — الخدمة تُبنى في الذاكرة برمز مؤقت ولا تُضاف إلى المسودة؛ الهاتف يعرض نموذج الموظف نفسه (C-UX-81)، وبجانبه ما فيه القالب */
function TemplatePreviewSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { state } = useStore(); const { tx } = useLang(); const me = usePerson(); const { L } = useUI(); const dz = L.dz;
  const tp = DZ_TEMPLATES.find((t) => t.id === id);
  const svc = React.useMemo(() => (tp ? tp.build(`${tp.domain}-XX`, state.tenant.id, Date.now()) : null), [tp, state.tenant.id]);
  const fields = svc ? allFields(svc).filter((f) => f.kind !== 'guidance') : [];
  return (
    <Sheet open={!!tp && !!svc} onClose={onClose} title={tp ? `${dz.preview.tplPreview} · ${tx(tp.name)}` : ''} lead={tp ? <span className={`qicon ${tp.tone}`} style={{ width: 40, height: 40, borderRadius: 13 }}>{React.createElement(I[(tp.icon as keyof typeof I) || 'grid'] || I.grid)}</span> : null}>
      {svc && tp ? (
        <div className="dz-tplprev">
          <p className="cell-sub" style={{ margin: '0 0 10px' }}>{dz.preview.tplHint}</p>
          <div className="dz-tplprev-grid">
            <div className="dz-phone dz-phone-sm"><div className="dz-phone-in lb-official"><ConfiguredRequest key={svc.id} service={svc} preview previewPerson={me} embedded /></div></div>
            <div className="dz-tplprev-sum">
              <div className="section-label"><span>{dz.preview.tplFields} · {fields.length}</span></div>
              <Group>{svc.sections.map((sec) => <div key={sec.id} className="cell stacked"><span className="cell-title">{tx(sec.title)}</span><span className="chips" style={{ paddingTop: 6 }}>{sec.fields.filter((f) => f.kind !== 'guidance').map((f) => <Pill key={f.id}>{tx(f.label) || f.id}{f.rules?.required ? ' *' : ''}</Pill>)}</span></div>)}</Group>
              <div className="section-label"><span>{dz.preview.tplRoute} · {svc.route.length}</span></div>
              <Group>{svc.route.map((st, i) => <div key={st.id || i} className="cell"><span className="cell-lead plain num">{i + 1}</span><span className="cell-main"><span className="cell-title">{tx(st.title || stepTitle(st))}</span><span className="cell-sub">{tx(agentTitle(st.agent))}{st.form?.outcomes?.length ? ` · ${st.form.outcomes.map((o) => tx(o.name)).join(' / ')}` : ''}</span></span></div>)}</Group>
              <div className="section-label"><span>{dz.preview.tplOutputs} · {(svc.outputs || []).length}</span></div>
              <Group>{(svc.outputs || []).length ? (svc.outputs || []).map((o) => <div key={o.id} className="cell"><span className="cell-lead plain"><I.seal /></span><span className="cell-main"><span className="cell-title">{dz.v16.out.kinds[o.kind]}{o.title ? ` · ${tx(o.title)}` : ''}</span></span></div>) : <div className="cell"><span className="cell-sub">{dz.v16.out.none}</span></div>}</Group>
            </div>
          </div>
        </div>
      ) : null}
    </Sheet>
  );
}
