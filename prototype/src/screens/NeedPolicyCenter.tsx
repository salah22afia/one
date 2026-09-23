import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '../app/store';
import { I } from '../ui/icons';
import { Cell, Field, Group, LargeTitle, Notice, Pill, Segmented, Sheet, TopBar, useLang, usePerson, useToast } from '../ui/components';
import { motion, AnimatePresence, Stagger, Item, Press, SPRING } from '../ui/motion';
import { statusOf, endOf, activeVersion, diffContent, labelFor, toISO, scheduleProblem, inForce, liveNeed, type PolicyContent, type NeedContent, type NeedEntity, type NeedStore, type NeedCategory, type NeedSite, type NeedCatalogEntry, type AuthorityBand, type PurchaseMethod, type NeedPool, type NeedList, type VersionStatus, type AgentRule } from '../domain/policy';
import { positionById, unitById, holderOf } from '../domain/engine';
import { needProblems, NEED_ROLE_TITLE, buildNeedCtx, needSteps, canOpenNeed, poolStock } from '../domain/need';
import { NeedRoutePreview } from '../ui/NeedBits';
import { ORG_LEVELS, type NeedRole, type NeedBranch, type T2 } from '../domain/types';
import { fmtDate, changesText, fill } from '../app/i18n';
import { AdminNav } from './AdminCenter';

type Tab = 'categories' | 'entities' | 'stores' | 'sites' | 'catalog' | 'authority' | 'methods' | 'pools' | 'suppliers' | 'rules' | 'routes' | 'coord' | 'sim' | 'diff' | 'log';
const AVAIL = ['store', 'entity', 'contract', 'none'] as const;
const TONES = ['g-green', 'g-gold', 'g-teal', 'g-sage', 'g-bronze'];
const ICONS = ['box', 'gear', 'doc', 'ribbon', 'globe', 'card', 'shield', 'sparkle', 'letter', 'plane'];
const statusToneOf = (s: VersionStatus) => (s === 'active' ? 'ok' : s === 'scheduled' ? 'tint' : s === 'awaiting' ? 'gold' : s === 'draft' ? 'warn' : s === 'cancelled' || s === 'reverted' ? 'danger' : s === 'corrected' ? 'warn' : 'done');
const fmtVal = (v: string, lang: 'ar' | 'en') => (v === 'true' ? (lang === 'ar' ? 'نعم' : 'yes') : v === 'false' ? (lang === 'ar' ? 'لا' : 'no') : v === '' ? '—' : v.length > 60 ? `${v.slice(0, 60)}…` : v);

/* ——— v0.9 «سياسة الاحتياج» (AS-01، P-11، P-12): سياسة ثانية على محرك الإصدارات نفسه — الجهات الفنية والفئات والمستودعات والمقرات والقواعد تُضاف وتُلغى بتاريخ؛ المنسّقون تشغيلٌ يسري فوراً؛ والمسارات بالأدوار تُقرأ هنا ——— */

/** منتقي مناصب: رقاقات المختار مع حذف، وقائمة لإضافة منصب (بالوحدة) */
export function PosPicker({ ids, editable, onChange, label }: { ids: string[]; editable: boolean; onChange: (ids: string[]) => void; label: string }) {
  const { state } = useStore(); const { lang, tx } = useLang();
  const options = state.org.positions.filter((p) => !ids.includes(p.id)).map((p) => ({ p, u: unitById(state, p.unitId), h: holderOf(state, p.id) }));
  return (
    <label><span>{label}</span>
      <span className="chips">
        {ids.map((id) => { const p = positionById(state, id); const h = holderOf(state, id); return <span key={id} className="pill tint">{p ? tx(p.title) : id}{h ? ` — ${lang === 'ar' ? h.name.split(' ')[0] : h.nameEn.split(' ')[0]}` : ` — ${lang === 'ar' ? 'شاغر' : 'vacant'}`}{editable ? <button type="button" className="chip-x" aria-label="remove" onClick={() => onChange(ids.filter((x) => x !== id))}>×</button> : null}</span>; })}
        {!ids.length && !editable ? <span className="cell-sub">—</span> : null}
        {editable ? <select className="select-in" value="" onChange={(e) => { if (e.target.value) onChange([...ids, e.target.value]); }}><option value="">{lang === 'ar' ? '+ منصب' : '+ position'}</option>{options.map(({ p, u, h }) => <option key={p.id} value={p.id}>{tx(p.title)} · {u ? tx(u.name) : ''}{h ? ` · ${lang === 'ar' ? h.name : h.nameEn}` : ''}</option>)}</select> : null}
      </span>
    </label>
  );
}
/** حقل الاسم بلغتين */
export function NameFields({ name, editable, onChange, t }: { name: T2; editable: boolean; onChange: (n: T2) => void; t: ReturnType<typeof useLang>['t'] }) {
  return (<><label><span>{t.need.policy.name}</span><input value={name.ar} disabled={!editable} onChange={(e) => onChange({ ...name, ar: e.target.value })} /></label><label><span>{t.need.policy.nameEn}</span><input dir="ltr" value={name.en} disabled={!editable} onChange={(e) => onChange({ ...name, en: e.target.value })} /></label></>);
}
/** الإلغاء بتاريخ (P-12): لا حذف — تاريخ انتهاء، ويُستعاد بمسحه */
export function EndDate({ endedAt, editable, today, onChange, t, lang }: { endedAt?: string; editable: boolean; today: string; onChange: (d?: string) => void; t: ReturnType<typeof useLang>['t']; lang: 'ar' | 'en' }) {
  if (!editable) return endedAt ? <Pill tone="danger" icon="x">{t.need.policy.ended} <span className="num">{endedAt}</span></Pill> : null;
  return (<label><span>{t.need.policy.end}</span><span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="date" dir="ltr" className="num" value={endedAt || ''} min={today} onChange={(e) => onChange(e.target.value || undefined)} />{endedAt ? <button type="button" className="btn quiet" onClick={() => onChange(undefined)}>{t.need.policy.restore}</button> : null}</span>{endedAt ? <span className="cell-sub" style={{ color: 'var(--danger)' }}>{lang === 'ar' ? `يختفي من الشاشات اعتباراً من ${endedAt}؛ الطلبات الجارية تكمل.` : `Hidden from screens as of ${endedAt}; in-flight requests continue.`}</span> : null}</label>);
}

export function NeedPolicyCenter() {
  const { state, dispatch } = useStore(); const { lang, t, tx } = useLang(); const me = usePerson(); const toast = useToast();
  const today = toISO(Date.now()); const policy = state.needPolicy; const versions = policy.versions; const active = activeVersion(policy, today);
  const anyDraft = versions.find((v) => statusOf(v, versions, today) === 'draft');
  const [selId, setSelId] = useState<string>(anyDraft ? anyDraft.id : active.id);
  const sel = versions.find((v) => v.id === selId) || active; const selStatus = statusOf(sel, versions, today);
  const isAdmin = me.persona === 'admin'; const editable = selStatus === 'draft' && isAdmin; const draft = selStatus === 'draft' ? sel : undefined;
  const [tab, setTab] = useState<Tab>('categories');
  const [content, setContent] = useState<PolicyContent>(sel.content); const [why, setWhy] = useState('');
  useEffect(() => { setContent(sel.content); setWhy(''); }, [sel.id, sel.content]);
  const need = content.need!; const setNeed = (f: (n: NeedContent) => NeedContent) => setContent((c) => ({ ...c, need: f(c.need!) }));
  const base = versions.find((v) => v.id === sel.baseId)?.content || sel.content;
  const pending = useMemo(() => diffContent(sel.content, content), [sel.content, content]);
  const diffs = useMemo(() => diffContent(base, content), [base, content]);
  const [schedOpen, setSchedOpen] = useState(false); const [sched, setSched] = useState({ from: sel.from, reason: sel.reason, reference: sel.reference });
  useEffect(() => { setSched({ from: sel.from, reason: sel.reason, reference: sel.reference }); }, [sel.id, sel.from, sel.reason, sel.reference]);
  const problems = useMemo(() => needProblems(need, sched.from || today), [need, sched.from, today]);
  const schedProblem = draft ? scheduleProblem(policy, draft.id, sched.from, today, content) : null;
  const save = () => { if (!draft) return; dispatch({ type: 'needPolicyUpdate', id: draft.id, content, by: me.id, why: why.trim() }); toast({ title: t.policy.saved, sub: changesText(pending.length, lang), icon: 'check', tone: 'ok' }); setWhy(''); };
  const newDraft = () => { dispatch({ type: 'needPolicyDraft', by: me.id }); toast({ title: t.policy.created, sub: t.need.policy.title, icon: 'sparkle', tone: 'info' }); setTimeout(() => setSelId(`V-${versions.length + 1}`), 0); };
  const cancel = () => { if (!draft) return; dispatch({ type: 'needPolicyCancel', id: draft.id }); setSelId(active.id); toast({ title: t.policy.cancelled, icon: 'x', tone: 'warn' }); };
  const schedule = () => { if (!draft || !sched.from || !sched.reason.trim() || !sched.reference.trim() || schedProblem || problems.length) return; if (pending.length) dispatch({ type: 'needPolicyUpdate', id: draft.id, content, by: me.id, why: why.trim() || sched.reason }); dispatch({ type: 'needPolicySchedule', id: draft.id, from: sched.from, reason: sched.reason, reference: sched.reference }); setSchedOpen(false); toast({ title: t.policy.scheduled, sub: `${draft.number} · ${t.policy.from} ${sched.from}`, icon: 'calendar', tone: 'gold' }); };
  const nextId = (prefix: string, list: { id: string }[]) => { let n = list.length + 1; while (list.some((x) => x.id === `${prefix}${n}`)) n += 1; return `${prefix}${n}`; };
  const upd = <K extends NeedList>(list: K, id: string, patch: Partial<NonNullable<NeedContent[K]>[number]>) => setNeed((n) => ({ ...n, [list]: ((n[list] || []) as { id: string }[]).map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  /* v0.10: كتالوج الاحتياجات، وجدول الصلاحيات، وطرق الشراء */
  const addCatalog = () => { const id = nextId('K-', need.catalog || []); const cat0 = liveNeed(need.categories, today)[0]; setNeed((n) => ({ ...n, catalog: [...(n.catalog || []), { id, name: { ar: 'بند جديد في الكتالوج', en: 'New catalogue entry' }, categoryId: cat0?.id || '', itemIds: [], icon: cat0?.icon || 'box' }] })); setEdit({ list: 'catalog', id }); };
  const addBand = () => { const id = nextId('B', need.authority || []); setNeed((n) => ({ ...n, authority: [...(n.authority || []), { id, name: { ar: 'شريحة جديدة', en: 'New band' }, upTo: 100000, agent: { kind: 'positions', positionIds: [], quorum: 'any' } }] })); setEdit({ list: 'authority', id }); };
  const addMethod = () => { const id = nextId('M-', need.methods || []); setNeed((n) => ({ ...n, methods: [...(n.methods || []), { id, name: { ar: 'طريقة شراء جديدة', en: 'New purchase method' }, offers: true, minOffers: n.rules.minOffers, higherBand: false, tender: false, contract: false }] })); setEdit({ list: 'methods', id }); };
  const addEntity = () => { const id = nextId('E-', need.entities); setNeed((n) => ({ ...n, entities: [...n.entities, { id, name: { ar: 'جهة فنية جديدة', en: 'New technical entity' }, agent: { kind: 'positions', positionIds: [], quorum: 'any' } }] })); setEdit({ list: 'entities', id }); };
  const addCategory = () => { const id = nextId('C-', need.categories); setNeed((n) => ({ ...n, categories: [...n.categories, { id, name: { ar: 'فئة جديدة', en: 'New category' }, kind: 'material', custody: false, icon: 'box', tone: 'g-sage', guidance: { ar: '', en: '' }, storeId: liveNeed(n.stores, today)[0]?.id }] })); setEdit({ list: 'categories', id }); };
  const addSite = () => { const id = nextId('SITE-', need.sites); setNeed((n) => ({ ...n, sites: [...n.sites, { id, name: { ar: 'مقر جديد', en: 'New site' }, storeIds: [] }] })); setEdit({ list: 'sites', id }); };
  const addStore = (locId: string) => { const loc = state.erp.storageLocations.find((x) => x.id === locId); if (!loc) return; setNeed((n) => ({ ...n, stores: [...n.stores, { id: loc.id, name: loc.name, agent: { kind: 'positions', positionIds: [], quorum: 'any' } }] })); setEdit({ list: 'stores', id: loc.id }); };
  const erpFree = state.erp.storageLocations.filter((l) => !need.stores.some((s) => s.id === l.id));
  /* v0.11 (D-023): رصيد الجهات — تعريف بإصدار، ورصيد جارٍ تشغيلي */
  const addPool = () => { const id = nextId('POOL-', need.pools || []); const ent = liveNeed(need.entities, today)[0]; setNeed((n) => ({ ...n, pools: [...(n.pools || []), { id, name: { ar: 'رصيد جديد', en: 'New pool' }, entityId: ent?.id || '', unit: { ar: 'وحدة', en: 'unit' }, erpKind: 'portal', custody: false }] })); setEdit({ list: 'pools', id }); };
  const [balance, setBalance] = useState<{ qty: string; why: string }>({ qty: '', why: '' });
  const saveBalance = (pool: NeedPool) => { if (!balance.why.trim() || balance.qty === '') return; dispatch({ type: 'needPoolStock', poolId: pool.id, poolName: pool.name, qty: Number(balance.qty), by: me.id, why: balance.why.trim() }); setBalance({ qty: '', why: '' }); toast({ title: t.need.policy.balanceSaved, sub: `${tx(pool.name)} · ${balance.qty}`, icon: 'check', tone: 'ok' }); };
  const sectors = state.org.units.filter((u) => u.level === 'sector');
  const subtree = (rootId: string) => { const ids = new Set<string>(); const walk = (id: string) => { ids.add(id); state.org.units.filter((u) => u.parentId === id).forEach((u) => walk(u.id)); }; walk(rootId); return ids; };
  const levelName = (l: string) => t.need.levelName[l as keyof typeof t.need.levelName];
  const branchCls = (b?: NeedBranch) => (b ? `branch-${b}` : '');
  const roleShort = (r: NeedRole) => t.need.policy.roles[r as keyof typeof t.need.policy.roles] || tx(NEED_ROLE_TITLE[r]);
  const agentIds = (a?: AgentRule) => a?.positionIds || [];

  const timeline = (
    <div className="ptl">
      {versions.filter((v) => !v.cancelled || v.revoked).map((v) => { const st = statusOf(v, versions, today); const end = endOf(v, versions); const on = v.id === sel.id; return (
        <Press key={v.id} className={`ptl-card ${st} ${on ? 'on' : ''}`} onClick={() => setSelId(v.id)} lift>
          {on ? <motion.span className="ptl-on" layoutId="nptl-on" transition={SPRING.snappy} /> : null}
          <span className="ptl-body"><span className="ptl-top"><b className="num">{v.number}</b><Pill tone={statusToneOf(st)}>{t.policy.status[st]}</Pill></span>
          <span className="ptl-dates num">{st === 'draft' ? (lang === 'ar' ? 'لم يُجدوَل' : 'not scheduled') : `${v.from} → ${end || t.policy.open}`}</span>
          <span className="ptl-sub">{v.changes.length ? changesText(v.changes.length, lang) : v.reason ? v.reason.slice(0, 40) : ''}</span></span>
        </Press>
      ); })}
      {isAdmin && !anyDraft ? <Press className="ptl-card new" onClick={newDraft} lift><span className="ptl-body"><span className="cell-lead"><I.plus /></span><b>{t.need.policy.newDraft}</b></span></Press> : null}
    </div>
  );
  /* بطاقات مضغوطة في القوائم، والمحرر في ورقة (كما في مركز سياسة الإجازات) */
  const [edit, setEdit] = useState<{ list: NeedList; id: string } | null>(null);
  const card = (list: NeedList, x: { id: string; name: T2; endedAt?: string }, icon: React.ReactNode, tone: string, pills: React.ReactNode) => (
    <Item key={x.id}><Press className={`pt-card ${x.endedAt && x.endedAt <= today ? 'off' : ''}`} onClick={() => setEdit({ list, id: x.id })} lift>
      <span className={`qicon ${tone}`}>{icon}</span>
      <span className="pt-body"><b>{tx(x.name)}</b><span className="pt-meta">{x.endedAt ? <Pill tone="danger" icon="x">{t.need.policy.ended} <span className="num">{x.endedAt}</span></Pill> : null}{pills}</span></span>
      <I.chev className="chev dirchev" />
    </Press></Item>
  );
  const editing = edit ? ((need[edit.list] || []) as unknown as { id: string; name: T2 }[]).find((x) => x.id === edit.id) : undefined;

  return (
    <div className="page view policy npc">
      <TopBar title={t.need.policy.title} back="#/admin" />
      <LargeTitle title={t.need.policy.title} sub={t.need.policy.sub} />
      <AdminNav />
      {!isAdmin ? <><Notice tone="warn" icon="info">{t.policy.onlyAdmin}</Notice><div style={{ height: 12 }} /></> : null}
      <div className="section-head" style={{ paddingTop: 6 }}><h2>{t.need.policy.versions}</h2>{draft && isAdmin ? <span className="kbd-row" style={{ padding: 0 }}><button type="button" className="btn quiet" onClick={cancel}>{t.need.policy.cancelDraft}</button><button type="button" className="btn soft" onClick={() => setSchedOpen(true)}><I.calendar />{t.need.policy.schedule}</button></span> : null}</div>
      {timeline}
      <div className="pv-head">
        <div className="pv-line"><span><b className="num">{sel.number}</b> <Pill tone={statusToneOf(selStatus)}>{t.policy.status[selStatus]}</Pill>{selStatus !== 'draft' ? <span className="cell-sub"> {t.policy.from} <span className="num">{sel.from}</span>{endOf(sel, versions) ? <> {t.policy.to} <span className="num">{endOf(sel, versions)}</span></> : null}</span> : null}</span></div>
        {sel.reason ? <p className="cell-sub">{sel.reason}{sel.reference ? ` · ${sel.reference}` : ''}</p> : null}
        {editable ? <p className="hint-line" style={{ padding: '6px 0 0' }}>{t.policy.hint}</p> : isAdmin && !anyDraft ? <p className="hint-line" style={{ padding: '6px 0 0' }}>{t.need.policy.noDraft}</p> : null}
      </div>
      <Segmented id="npolicy" value={tab} onChange={setTab} options={[{ v: 'categories', label: t.need.policy.categories, n: liveNeed(need.categories, today).length }, { v: 'entities', label: t.need.policy.entities, n: liveNeed(need.entities, today).length }, { v: 'stores', label: t.need.policy.stores, n: liveNeed(need.stores, today).length }, { v: 'sites', label: t.need.policy.sites, n: liveNeed(need.sites, today).length }, { v: 'catalog', label: t.need.policy.catalog, n: liveNeed(need.catalog || [], today).length }, { v: 'authority', label: t.need.policy.authority, n: liveNeed(need.authority || [], today).length }, { v: 'methods', label: t.need.policy.methods, n: liveNeed(need.methods || [], today).length }, { v: 'pools', label: t.need.policy.pools, n: liveNeed(need.pools || [], today).length }, { v: 'suppliers', label: t.need.policy.suppliers }, { v: 'rules', label: t.need.policy.rules }, { v: 'routes', label: t.need.policy.routes }, { v: 'coord', label: t.need.policy.coordinators }, { v: 'sim', label: t.policy.simulate }, { v: 'diff', label: t.policy.diff, n: diffs.length }, { v: 'log', label: t.policy.changes }]} />
      <div style={{ height: 12 }} />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={tab + sel.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6, transition: { duration: 0.1 } }} transition={SPRING.soft}>

          {tab === 'categories' && (
            <Stagger>
              <Item><Notice icon="info">{t.need.policy.catHint}</Notice></Item>
              {editable ? <Item><button type="button" className="npc-add" onClick={addCategory}><span className="cell-lead"><I.plus /></span>{t.need.policy.add} · {t.need.policy.categories}</button></Item> : null}
              <Stagger className="pt-grid" step={0.035}>{need.categories.map((c) => { const Ic = I[c.icon as keyof typeof I] || I.box; const ent = need.entities.find((e) => e.id === c.entityId); const st = need.stores.find((x) => x.id === c.storeId); return card('categories', c, <Ic />, c.tone, <><Pill tone={c.kind === 'material' ? 'tint' : 'gold'}>{c.kind === 'material' ? t.need.kindMaterial : t.need.kindService}</Pill>{ent ? <Pill icon="shield">{tx(ent.name)}</Pill> : <Pill>{t.need.noEntity}</Pill>}{c.kind === 'material' ? (st ? <Pill icon="box">{tx(st.name)}</Pill> : <Pill tone="danger" icon="alert">{t.need.policy.noStoreYet}</Pill>) : null}{c.custody ? <Pill tone="gold" icon="seal">{t.need.custodyFlag}</Pill> : null}{c.availability && c.availability !== (c.kind === 'material' ? 'store' : 'none') ? <Pill tone="tint" icon="sparkle">{t.need.policy.availabilityOf[c.availability]}</Pill> : null}</>); })}</Stagger>
            </Stagger>
          )}

          {tab === 'entities' && (
            <Stagger>
              <Item><Notice icon="info">{t.need.policy.entHint}</Notice></Item>
              {editable ? <Item><button type="button" className="npc-add" onClick={addEntity}><span className="cell-lead"><I.plus /></span>{t.need.policy.add} · {t.need.policy.entities}</button></Item> : null}
              <Stagger className="pt-grid" step={0.035}>{need.entities.map((e) => card('entities', e, <I.shield />, 'g-green', <>{agentIds(e.agent).map((id) => { const p = positionById(state, id); const h = holderOf(state, id); return <Pill key={id} icon="person">{p ? tx(p.title) : id}{h ? ` — ${lang === 'ar' ? h.name.split(' ')[0] : h.nameEn.split(' ')[0]}` : ''}</Pill>; })}{need.categories.filter((c) => c.entityId === e.id && !c.endedAt).map((c) => <Pill key={c.id} tone="tint">{tx(c.name)}</Pill>)}{!agentIds(e.agent).length ? <Pill tone="danger" icon="alert">{t.need.policy.noAgent}</Pill> : null}</>))}</Stagger>
            </Stagger>
          )}

          {tab === 'stores' && (
            <Stagger>
              <Item><Notice icon="info">{t.need.policy.storeHint}</Notice></Item>
              {editable ? <Item><div className="npc-add" style={{ gap: 10 }}><span className="cell-lead"><I.plus /></span><span style={{ flex: 1 }}>{t.need.policy.add} · {t.need.policy.erpList}</span>{erpFree.length ? <select className="select-in" value="" onChange={(e) => addStore(e.target.value)}><option value="">{t.need.policy.add}</option>{erpFree.map((l) => <option key={l.id} value={l.id}>{l.id} · {tx(l.name)}</option>)}</select> : <span className="cell-sub">{t.need.policy.allAdded}</span>}</div></Item> : null}
              <Stagger className="pt-grid" step={0.035}>{need.stores.map((st) => { const inErp = state.erp.storageLocations.some((l) => l.id === st.id); return card('stores', st, <I.box />, 'g-bronze', <><Pill><span className="mono">{st.id}</span></Pill>{inErp ? <Pill tone="ok" icon="check">{t.need.policy.erpList}</Pill> : <Pill tone="warn" icon="alert">{t.need.policy.noErp}</Pill>}{agentIds(st.agent).map((id) => { const p = positionById(state, id); const h = holderOf(state, id); return <Pill key={id} icon="person">{p ? tx(p.title) : id}{h ? ` — ${lang === 'ar' ? h.name.split(' ')[0] : h.nameEn.split(' ')[0]}` : ''}</Pill>; })}{need.sites.filter((x) => x.storeIds.includes(st.id)).map((x) => <Pill key={x.id} icon="globe">{tx(x.name)}</Pill>)}{!agentIds(st.agent).length ? <Pill tone="danger" icon="alert">{t.need.policy.noAgent}</Pill> : null}</>); })}</Stagger>
              <div className="section-label" style={{ paddingTop: 18 }}><span>{t.need.policy.erpLocations} · {t.policy.readOnly}</span><span className="num">{state.erp.storageLocations.length}</span></div>
              <Group className="erp-list" foot={t.need.policy.erpLocHint}>{state.erp.storageLocations.map((l) => { const used = need.stores.find((x) => x.id === l.id); return <div key={l.id} className={`cell erp-row ${used ? 'linked' : ''}`}><span className="cell-lead plain"><I.box /></span><span className="cell-main"><span className="cell-title"><span className="mono">{l.id}</span> · {tx(l.name)}</span><span className="cell-sub">{lang === 'ar' ? 'المصنع' : 'Plant'} <span className="mono">{l.plant}</span></span></span><span className="cell-trail">{used ? <Pill tone="ok" icon="check">{t.policy.erpLinked} {tx(used.name)}</Pill> : <Pill>{t.policy.erpUnused}</Pill>}</span></div>; })}</Group>
            </Stagger>
          )}

          {tab === 'sites' && (
            <Stagger>
              <Item><Notice icon="info">{t.need.policy.siteHint}</Notice></Item>
              {editable ? <Item><button type="button" className="npc-add" onClick={addSite}><span className="cell-lead"><I.plus /></span>{t.need.policy.add} · {t.need.policy.sites}</button></Item> : null}
              <Stagger className="pt-grid" step={0.035}>{need.sites.map((st) => card('sites', st, <I.globe />, 'g-teal', <>{st.storeIds.length ? st.storeIds.map((id) => <Pill key={id} icon="box">{tx(need.stores.find((x) => x.id === id)?.name || { ar: id, en: id })}</Pill>) : <Pill icon="plane">{t.need.noStore}</Pill>}{!st.storeIds.length ? agentIds(st.receiverAgent).map((id) => { const p = positionById(state, id); const h = holderOf(state, id); return <Pill key={id} icon="person">{p ? tx(p.title) : id}{h ? ` — ${lang === 'ar' ? h.name.split(' ')[0] : h.nameEn.split(' ')[0]}` : ''}</Pill>; }) : null}{!st.storeIds.length && !agentIds(st.receiverAgent).length ? <Pill tone="danger" icon="alert">{t.need.policy.noAgent}</Pill> : null}</>))}</Stagger>
            </Stagger>
          )}

          {tab === 'catalog' && (
            <Stagger>
              <Item><Notice icon="info">{t.need.policy.catalogHint}</Notice></Item>
              {editable ? <Item><button type="button" className="npc-add" onClick={addCatalog}><span className="cell-lead"><I.plus /></span>{t.need.policy.add} · {t.need.policy.catalog}</button></Item> : null}
              <Stagger className="pt-grid" step={0.035}>{(need.catalog || []).map((k) => { const c = need.categories.find((x) => x.id === k.categoryId); const Ic = I[(k.icon || c?.icon || 'box') as keyof typeof I] || I.box; return card('catalog', k, <Ic />, c?.tone || 'g-sage', <>{c ? <Pill tone="tint">{tx(c.name)}</Pill> : <Pill tone="danger" icon="alert">{t.need.noEntity}</Pill>}{k.itemIds.length ? k.itemIds.map((id) => <Pill key={id}><span className="mono">{id}</span></Pill>) : <Pill icon="doc">{t.need.freeText}</Pill>}{k.price ? <Pill tone="gold" icon="wallet"><span className="num">{k.price.toLocaleString('en')}</span></Pill> : null}{k.poolId ? <Pill tone="tint" icon="sparkle">{tx(need.pools?.find((x) => x.id === k.poolId)?.name || { ar: k.poolId, en: k.poolId })}</Pill> : null}</>); })}</Stagger>
            </Stagger>
          )}

          {tab === 'authority' && (
            <Stagger>
              <Item><Notice icon="info">{t.need.policy.authHint}</Notice></Item>
              {editable ? <Item><button type="button" className="npc-add" onClick={addBand}><span className="cell-lead"><I.plus /></span>{t.need.policy.add} · {t.need.policy.authority}</button></Item> : null}
              <Stagger className="pt-grid" step={0.035}>{(need.authority || []).slice().sort((a, b) => (a.upTo === null ? 1 : b.upTo === null ? -1 : a.upTo - b.upTo)).map((b) => card('authority', b, <I.shield />, 'g-gold', <><Pill tone="tint">{b.upTo === null ? t.need.policy.noLimit : <>{t.need.policy.upTo.split(' (')[0]} <span className="num">{b.upTo.toLocaleString('en')}</span></>}</Pill>{agentIds(b.agent).map((id) => { const p = positionById(state, id); const h = holderOf(state, id); return <Pill key={id} icon="person">{p ? tx(p.title) : id}{h ? ` — ${lang === 'ar' ? h.name.split(' ')[0] : h.nameEn.split(' ')[0]}` : ''}</Pill>; })}{agentIds(b.agent).length > 1 ? <Pill>{b.agent.quorum === 'all' ? t.need.policy.quorumAll : t.need.policy.quorumAny}</Pill> : null}{!agentIds(b.agent).length ? <Pill tone="danger" icon="alert">{t.need.policy.noAgent}</Pill> : null}</>))}</Stagger>
            </Stagger>
          )}

          {tab === 'methods' && (
            <Stagger>
              <Item><Notice icon="info">{t.need.policy.methodHint}</Notice></Item>
              {editable ? <Item><button type="button" className="npc-add" onClick={addMethod}><span className="cell-lead"><I.plus /></span>{t.need.policy.add} · {t.need.policy.methods}</button></Item> : null}
              <Stagger className="pt-grid" step={0.035}>{(need.methods || []).map((m) => card('methods', m, <I.wallet />, m.tender ? 'g-bronze' : m.contract ? 'g-teal' : 'g-green', <>{m.offers ? <Pill tone="tint">{t.need.policy.needsOffers} · <span className="num">{m.minOffers}</span></Pill> : null}{m.higherBand ? <Pill tone="gold">{t.need.policy.higherBand}</Pill> : null}{m.tender ? <Pill tone="warn">{t.need.policy.isTender}</Pill> : null}{m.contract ? <Pill tone="ok">{t.need.policy.isContract}</Pill> : null}</>))}</Stagger>
            </Stagger>
          )}

          {tab === 'pools' && (
            <Stagger>
              <Item><Notice icon="info">{t.need.policy.poolsHint}</Notice></Item>
              {editable ? <Item><button type="button" className="npc-add" onClick={addPool}><span className="cell-lead"><I.plus /></span>{t.need.policy.add} · {t.need.policy.pools}</button></Item> : null}
              <Stagger className="pt-grid" step={0.035}>{(need.pools || []).map((pl) => { const ent = need.entities.find((e) => e.id === pl.entityId); const bal = poolStock(state, pl); return card('pools', pl, <I.sparkle />, 'g-teal', <>{ent ? <Pill icon="shield">{tx(ent.name)}</Pill> : <Pill tone="danger" icon="alert">{t.need.noEntity}</Pill>}<Pill tone={bal > 0 ? 'ok' : 'warn'}>{t.need.policy.poolBalance}: <span className="num">{bal}</span> {tx(pl.unit)}</Pill><Pill>{t.need.policy.erpKindOf[pl.erpKind]}</Pill>{pl.custody ? <Pill tone="gold" icon="seal">{t.need.policy.poolCustody}</Pill> : null}</>); })}</Stagger>
            </Stagger>
          )}

          {tab === 'suppliers' && (
            <Stagger>
              <Item><Notice icon="info">{t.need.policy.suppliersHint}</Notice></Item>
              <div className="section-label"><span>{t.need.policy.erpSuppliers} · {t.policy.readOnly}</span><span className="num">{(state.erp.suppliers || []).length}</span></div>
              <Group className="erp-list">{(state.erp.suppliers || []).map((x) => <div key={x.id} className="cell erp-row"><span className="cell-lead plain"><I.person /></span><span className="cell-main"><span className="cell-title">{tx(x.name)}</span><span className="cell-sub"><span className="mono">{x.id}</span>{x.city ? ` · ${tx(x.city)}` : ''}</span></span></div>)}</Group>
              <div className="section-label" style={{ paddingTop: 18 }}><span>{t.need.policy.erpContracts} · {t.policy.readOnly}</span><span className="num">{(state.erp.contracts || []).length}</span></div>
              <Group className="erp-list">{(state.erp.contracts || []).map((c) => { const sup = (state.erp.suppliers || []).find((x) => x.id === c.supplierId); const left = Math.max(0, c.target - c.consumed); const expired = c.validTo < today; return <div key={c.id} className={`cell erp-row ${expired ? 'off' : 'linked'}`}><span className="cell-lead plain"><I.doc /></span><span className="cell-main"><span className="cell-title"><span className="mono">{c.id}</span> · {tx(c.name)}</span><span className="cell-sub">{sup ? tx(sup.name) : c.supplierId} · {c.validTo}</span></span><span className="cell-trail">{expired ? <Pill tone="danger" icon="x">{t.need.policy.expired}</Pill> : <Pill tone={left > 0 ? 'ok' : 'warn'}>{t.need.policy.contractLeft} <span className="num">{left.toLocaleString('en')}</span> / <span className="num">{c.target.toLocaleString('en')}</span></Pill>}</span></div>; })}</Group>
            </Stagger>
          )}

          {tab === 'rules' && (
            <Stagger>
              <Item><Notice icon="info">{t.need.policy.rulesHint}</Notice></Item>
              <Item><Group><div className="npc-rules">
                <label><span>{t.need.policy.openerMin}</span><select className="select-in" value={need.rules.openerMinLevel} disabled={!editable} onChange={(e) => setNeed((n) => ({ ...n, rules: { ...n.rules, openerMinLevel: e.target.value as typeof n.rules.openerMinLevel } }))}>{ORG_LEVELS.filter((l) => l !== 'sg').map((l) => <option key={l} value={l}>{levelName(l)} {lang === 'ar' ? 'فأعلى' : 'and above'}</option>)}</select></label>
                <label><span>{t.need.policy.chainUpTo}</span><select className="select-in" value={need.rules.chainUpTo} disabled={!editable} onChange={(e) => setNeed((n) => ({ ...n, rules: { ...n.rules, chainUpTo: e.target.value as typeof n.rules.chainUpTo } }))}>{ORG_LEVELS.filter((l) => l !== 'section' && l !== 'sg').map((l) => <option key={l} value={l}>{levelName(l)}</option>)}</select></label>
                <label className="sw"><span>{t.need.policy.coordinatorStep}</span><input className="switch" type="checkbox" checked={need.rules.coordinatorStep} disabled={!editable} onChange={(e) => setNeed((n) => ({ ...n, rules: { ...n.rules, coordinatorStep: e.target.checked } }))} /></label>
                <label className="sw"><span>{t.need.policy.urgent}</span><input className="switch" type="checkbox" checked={need.rules.urgentEnabled} disabled={!editable} onChange={(e) => setNeed((n) => ({ ...n, rules: { ...n.rules, urgentEnabled: e.target.checked } }))} /></label>
                <label><span>{t.need.policy.tender}</span><input className="num" type="number" dir="ltr" min={0} step={1000} value={need.rules.tenderThreshold} disabled={!editable} onChange={(e) => setNeed((n) => ({ ...n, rules: { ...n.rules, tenderThreshold: Number(e.target.value) } }))} /></label>
                <label><span>{t.need.policy.splitAlert}</span><input className="num" type="number" dir="ltr" min={0} value={need.rules.splitAlertDays} disabled={!editable} onChange={(e) => setNeed((n) => ({ ...n, rules: { ...n.rules, splitAlertDays: Number(e.target.value) } }))} /></label>
                <label><span>{t.need.policy.minOffersRule}</span><input id="np-minoffers" className="num" type="number" dir="ltr" min={1} value={need.rules.minOffers ?? 3} disabled={!editable} onChange={(e) => setNeed((n) => ({ ...n, rules: { ...n.rules, minOffers: Number(e.target.value) } }))} /></label>
                <label><span>{t.need.policy.tolerance}</span><input id="np-tolerance" className="num" type="number" dir="ltr" min={0} max={100} value={need.rules.tolerancePct ?? 10} disabled={!editable} onChange={(e) => setNeed((n) => ({ ...n, rules: { ...n.rules, tolerancePct: Number(e.target.value) } }))} /></label>
                <label><span>{t.need.policy.awardRule}</span><div className="segmented sm" id="np-awardrule">{(['exception', 'always'] as const).map((k) => <button key={k} type="button" aria-pressed={(need.rules.awardApproval || 'always') === k} disabled={!editable} onClick={() => setNeed((n) => ({ ...n, rules: { ...n.rules, awardApproval: k } }))}><span className="seg-txt">{k === 'always' ? t.need.policy.awardAlways : t.need.policy.awardException}</span></button>)}</div><span className="cell-sub">{t.need.policy.awardRuleHint}</span></label>
                <label className="sw"><span>{t.need.policy.offerAttachment}</span><input id="np-offeratt" className="switch" type="checkbox" checked={need.rules.offerAttachmentRequired !== false} disabled={!editable} onChange={(e) => setNeed((n) => ({ ...n, rules: { ...n.rules, offerAttachmentRequired: e.target.checked } }))} /></label>
                {/* v0.12 (D-026…D-028): الفحص بلجنة، والتسليم عند كل استلام، ومهلة المعالجة، ومهلة التوريد، وأرقام النظام المرجعي */}
                <label><span>{t.need.policy.inspectionThreshold}</span><input id="np-inspection" className="num" type="number" dir="ltr" min={0} step={1000} value={need.rules.inspectionThreshold ?? 50000} disabled={!editable} onChange={(e) => setNeed((n) => ({ ...n, rules: { ...n.rules, inspectionThreshold: Number(e.target.value) } }))} /><span className="cell-sub">{t.need.policy.inspectionHint}</span></label>
                <label><span>{t.need.policy.handoverMode}</span><div className="segmented sm" id="np-handovermode">{(['each', 'complete'] as const).map((k) => <button key={k} type="button" aria-pressed={(need.rules.handoverMode || 'each') === k} disabled={!editable} onClick={() => setNeed((n) => ({ ...n, rules: { ...n.rules, handoverMode: k } }))}><span className="seg-txt">{k === 'each' ? t.need.policy.handoverEach : t.need.policy.handoverComplete}</span></button>)}</div></label>
                <label><span>{t.need.policy.remedyDays}</span><input id="np-remedy" className="num" type="number" dir="ltr" min={1} value={need.rules.remedyDays ?? 5} disabled={!editable} onChange={(e) => setNeed((n) => ({ ...n, rules: { ...n.rules, remedyDays: Number(e.target.value) } }))} /></label>
                <label><span>{t.need.policy.leadDays}</span><input id="np-lead" className="num" type="number" dir="ltr" min={1} value={need.rules.leadDays ?? 14} disabled={!editable} onChange={(e) => setNeed((n) => ({ ...n, rules: { ...n.rules, leadDays: Number(e.target.value) } }))} /></label>
                <label><span>{t.need.policy.erpNumbers}</span><div className="segmented sm" id="np-erpnumbers">{(['integration', 'manual'] as const).map((k) => <button key={k} type="button" aria-pressed={(need.rules.erpNumbers || 'integration') === k} disabled={!editable} onClick={() => setNeed((n) => ({ ...n, rules: { ...n.rules, erpNumbers: k } }))}><span className="seg-txt">{k === 'integration' ? t.need.policy.erpIntegration : t.need.policy.erpManual}</span></button>)}</div><span className="cell-sub">{t.need.policy.erpNumbersHint}</span></label>
                <div className="npc-sla"><b style={{ gridColumn: '1 / -1', fontSize: 'var(--t-sub)', color: 'var(--fg-2)' }}>{t.need.policy.sla}</b>
                  {(Object.keys(need.rules.sla) as (keyof typeof need.rules.sla)[]).map((k) => <label key={k}><span>{t.need.policy.slaOf[k]}</span><input className="num" type="number" dir="ltr" min={0} value={need.rules.sla[k]} disabled={!editable} onChange={(e) => setNeed((n) => ({ ...n, rules: { ...n.rules, sla: { ...n.rules.sla, [k]: Number(e.target.value) } } }))} /></label>)}
                </div>
              </div></Group></Item>
              <Item><div style={{ height: 10 }} /><Notice tone="tint" icon="clock">{t.need.policy.slaZero}</Notice></Item>
            </Stagger>
          )}

          {tab === 'routes' && (
            <Stagger>
              <Item><Notice tone="tint" icon="target">{t.need.policy.routeReadonly}</Notice></Item>
              <Group>
                {content.routes.map((r) => (
                  <Item key={r.id}><div className="npc-route"><b>{tx(r.name).split(' · ')[0]} · <span className="mono">{r.id}</span></b><span className="cell-sub">{tx(r.name).split(' · ').slice(1).join(' · ')}</span>
                    <div className="npc-steps">{r.steps.map((s, i) => <React.Fragment key={i}>{i > 0 ? <span className="arrow">←</span> : null}<span className={`pill ${branchCls(s.branch)}`}>{s.role ? roleShort(s.role) : tx(s.title || { ar: '', en: '' })}{s.mode === 'approve' ? '' : s.mode === 'fulfil' ? ` · ${lang === 'ar' ? 'تنفيذ' : 'fulfil'}` : ''}</span></React.Fragment>)}</div>
                  </div></Item>
                ))}
              </Group>
              <Item><div className="kbd-row" style={{ padding: '10px 4px 0' }}><Pill tone="tint">{t.need.policy.branches.provided}</Pill><Pill tone="ok">{t.need.policy.branches.stock}</Pill><Pill tone="gold">{t.need.policy.branches.purchase}</Pill><Pill tone="warn">{t.need.policy.branches.tender}</Pill><Pill>{t.need.policy.branches.award}</Pill></div></Item>
            </Stagger>
          )}

          {tab === 'coord' && (
            <Stagger>
              <Item><Notice icon="info">{t.need.policy.coordHint}</Notice></Item>
              <Group>
                {sectors.map((sec) => { const ids = policy.groups[`coord:${sec.id}`] || []; const tree = subtree(sec.id); const cands = state.org.positions.filter((p) => tree.has(p.unitId) && p.holderId && !state.org.units.some((u) => u.chiefPositionId === p.id && u.level !== 'section')); return (
                  <Item key={sec.id}><div className="npc-coord"><b>{tx(sec.name)}</b><span className="cell-sub">{ids.length ? ids.map((id) => { const p = positionById(state, id); const h = holderOf(state, id); return `${p ? tx(p.title) : id}${h ? ` — ${lang === 'ar' ? h.name : h.nameEn}` : ''}`; }).join(lang === 'ar' ? '، ' : ', ') : (lang === 'ar' ? 'لا منسّقين — تُتخطى خطوة المنسّق في طلبات هذا القطاع' : 'No coordinators — the coordinator step is skipped for this sector')}</span>
                    <span className="chips">{cands.map((p) => { const on = ids.includes(p.id); const h = holderOf(state, p.id); return <button key={p.id} type="button" className={`pill ${on ? 'tint' : ''}`} aria-pressed={on} disabled={!isAdmin} onClick={() => dispatch({ type: 'needCoordinators', sectorId: sec.id, sectorName: sec.name, positionIds: on ? ids.filter((x) => x !== p.id) : [...ids, p.id], by: me.id })}>{on ? <I.check /> : null}{tx(p.title)}{h ? ` — ${lang === 'ar' ? h.name.split(' ')[0] : h.nameEn.split(' ')[0]}` : ''}</button>; })}</span>
                  </div></Item>
                ); })}
              </Group>
              <div className="section-label" style={{ paddingTop: 18 }}><span>{t.policy.opsLog}</span><span className="num">{policy.opsLog.length}</span></div>
              <Group>{policy.opsLog.length === 0 ? <div className="cell"><span className="cell-sub">—</span></div> : policy.opsLog.map((o, i) => { const who = state.people.find((p) => p.id === o.by); return <Cell key={i} icon="gear" tone="plain" title={tx(o.what)} sub={`${who ? (lang === 'ar' ? who.name : who.nameEn) : o.by} · ${fmtDate(o.at, lang, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}${o.detail ? ` · ${o.detail}` : ''}`} />; })}</Group>
            </Stagger>
          )}

          {tab === 'sim' && <NeedSimulator content={need} />}

          {tab === 'diff' && (diffs.length === 0 ? <Group><div className="empty"><span className="ic"><I.check /></span><b>{t.policy.noChanges}</b></div></Group> : <Stagger><Group>{diffs.map((d) => { const lb = labelFor(d.path, content); return <Item key={d.path}><div className="diff-row"><b>{tx(lb)}</b><span className="diff-vals"><span className="before">{fmtVal(d.before, lang)}</span><I.chev className="dirchev" /><span className="after">{fmtVal(d.after, lang)}</span></span></div></Item>; })}</Group></Stagger>)}

          {tab === 'log' && (() => { const all = versions.flatMap((v) => v.changes.map((c) => ({ ...c, v: v.number }))).sort((a, b) => b.at - a.at); return all.length === 0 ? <Group><div className="empty"><span className="ic"><I.doc /></span><b>{t.policy.noChanges}</b></div></Group> : <Stagger><Group>{all.map((c, i) => { const who = state.people.find((p) => p.id === c.by); return <Item key={i}><div className="diff-row"><b>{tx(c.label)} <Pill tone="tint">{c.v}</Pill></b><span className="diff-vals"><span className="before">{fmtVal(c.before, lang)}</span><I.chev className="dirchev" /><span className="after">{fmtVal(c.after, lang)}</span></span><span className="cell-sub">{who ? (lang === 'ar' ? who.name : who.nameEn) : c.by} · {fmtDate(c.at, lang, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}{c.why ? ` · ${c.why}` : ''}</span></div></Item>; })}</Group></Stagger>; })()}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {editable && pending.length > 0 && (
          <motion.div className="savebar" initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} transition={SPRING.soft}>
            <span className="sb-n">{changesText(pending.length, lang)}</span>
            <input className="sb-why" value={why} onChange={(e) => setWhy(e.target.value)} placeholder={t.need.policy.why} />
            <motion.button type="button" className="btn primary" onClick={save} whileTap={{ scale: 0.97 }}><I.check />{t.need.policy.save}</motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      <Sheet open={!!edit && !!editing} onClose={() => setEdit(null)} title={editing ? tx(editing.name) : ''} lead={edit ? <span className={`qicon ${edit.list === 'categories' ? (editing as unknown as NeedCategory).tone : edit.list === 'entities' ? 'g-green' : edit.list === 'stores' ? 'g-bronze' : edit.list === 'authority' ? 'g-gold' : edit.list === 'methods' ? 'g-green' : 'g-teal'}`}>{edit.list === 'categories' ? React.createElement(I[(editing as unknown as NeedCategory).icon as keyof typeof I] || I.box) : edit.list === 'entities' || edit.list === 'authority' ? <I.shield /> : edit.list === 'stores' || edit.list === 'catalog' ? <I.box /> : edit.list === 'methods' ? <I.wallet /> : edit.list === 'pools' ? <I.sparkle /> : <I.globe />}</span> : null}>
        {edit && editing ? (
          <div className="type-editor">
            {editable && !((base.need![edit.list] || []) as { id: string }[]).some((x) => x.id === edit.id) ? <div className="section-label" style={{ paddingTop: 0 }}><span>{t.policy.basics}</span><Pill tone="gold" icon="sparkle">{lang === 'ar' ? 'جديد في هذه المسودة' : 'New in this draft'}</Pill></div> : null}
            <Group>
              <div className="ed-row" style={{ padding: '12px 16px 8px' }}>
                {edit.list === 'categories' ? (() => { const c = editing as NeedCategory; return (<>
                  <NameFields name={c.name} editable={editable} onChange={(name) => upd('categories', c.id, { name })} t={t} />
                  <label><span>{t.need.policy.kind}</span><div className="segmented sm">{(['material', 'service'] as const).map((k) => <button key={k} type="button" aria-pressed={c.kind === k} disabled={!editable} onClick={() => upd('categories', c.id, { kind: k, storeId: k === 'service' ? undefined : c.storeId || liveNeed(need.stores, today)[0]?.id })}><span className="seg-txt">{t.need.policy.chips[k]}</span></button>)}</div></label>
                  <label><span>{t.need.policy.entity}</span><select className="select-in" value={c.entityId || ''} disabled={!editable} onChange={(e) => upd('categories', c.id, { entityId: e.target.value || undefined })}><option value="">{t.need.noEntity}</option>{liveNeed(need.entities, today).map((e) => <option key={e.id} value={e.id}>{tx(e.name)}</option>)}</select></label>
                  {c.kind === 'material' ? <label><span>{t.need.policy.store}</span><select className="select-in" value={c.storeId || ''} disabled={!editable} onChange={(e) => upd('categories', c.id, { storeId: e.target.value || undefined })}><option value="">—</option>{liveNeed(need.stores, today).map((st) => <option key={st.id} value={st.id}>{tx(st.name)} · {st.id}</option>)}</select></label> : null}
                  {c.kind === 'material' ? <label className="sw" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><span>{t.need.policy.custody}</span><input className="switch" type="checkbox" checked={c.custody} disabled={!editable} onChange={(e) => upd('categories', c.id, { custody: e.target.checked })} /></label> : null}
                  {c.kind === 'material' ? <label className="sw"><span>{t.need.policy.inspection}</span><input id="npc-inspection" className="switch" type="checkbox" checked={!!c.inspection} disabled={!editable} onChange={(e) => upd('categories', c.id, { inspection: e.target.checked })} /></label> : null}
                  <label><span>{t.need.policy.availability}</span><select className="select-in" id="npc-avail" value={c.availability || (c.kind === 'material' ? 'store' : 'none')} disabled={!editable} onChange={(e) => upd('categories', c.id, { availability: e.target.value as NeedCategory['availability'] })}>{AVAIL.filter((a) => a !== 'store' || c.kind === 'material').map((a) => <option key={a} value={a}>{t.need.policy.availabilityOf[a]}</option>)}</select></label>
                  <label><span>{t.need.policy.icon}</span><span className="chips">{ICONS.map((ic) => { const Ic2 = I[ic as keyof typeof I]; return <button key={ic} type="button" className={`pill ${c.icon === ic ? 'tint' : ''}`} disabled={!editable} onClick={() => upd('categories', c.id, { icon: ic })}><Ic2 /></button>; })}</span></label>
                  <label><span>{t.need.policy.tone}</span><span className="chips">{TONES.map((tn) => <button key={tn} type="button" className={`qicon ${tn}`} style={{ width: 28, height: 28, borderRadius: 9, outline: c.tone === tn ? '2px solid var(--tint)' : 'none', outlineOffset: 2 }} aria-label={tn} disabled={!editable} onClick={() => upd('categories', c.id, { tone: tn })} />)}</span></label>
                  <label style={{ flexBasis: '100%' }}><span>{t.need.policy.guidance}</span><textarea rows={2} value={c.guidance.ar} disabled={!editable} onChange={(e) => upd('categories', c.id, { guidance: { ...c.guidance, ar: e.target.value } })} /></label>
                  <label style={{ flexBasis: '100%' }}><span>{t.need.policy.guidanceEn}</span><textarea rows={2} dir="ltr" value={c.guidance.en} disabled={!editable} onChange={(e) => upd('categories', c.id, { guidance: { ...c.guidance, en: e.target.value } })} /></label>
                  <EndDate endedAt={c.endedAt} editable={editable} today={today} onChange={(endedAt) => upd('categories', c.id, { endedAt })} t={t} lang={lang} />
                </>); })() : edit.list === 'entities' ? (() => { const e = editing as NeedEntity; return (<>
                  <NameFields name={e.name} editable={editable} onChange={(name) => upd('entities', e.id, { name })} t={t} />
                  <PosPicker label={t.need.policy.agent} ids={agentIds(e.agent)} editable={editable} onChange={(positionIds) => upd('entities', e.id, { agent: { ...e.agent, kind: 'positions', positionIds, quorum: 'any' } })} />
                  <EndDate endedAt={e.endedAt} editable={editable} today={today} onChange={(endedAt) => upd('entities', e.id, { endedAt })} t={t} lang={lang} />
                </>); })() : edit.list === 'stores' ? (() => { const st = editing as NeedStore; return (<>
                  <label><span>{lang === 'ar' ? 'الرمز في النظام المرجعي' : 'Code in the system of record'}</span><span className="cell-sub mono">{st.id}</span></label>
                  <NameFields name={st.name} editable={editable} onChange={(name) => upd('stores', st.id, { name })} t={t} />
                  <PosPicker label={t.need.policy.agent} ids={agentIds(st.agent)} editable={editable} onChange={(positionIds) => upd('stores', st.id, { agent: { ...st.agent, kind: 'positions', positionIds, quorum: 'any' } })} />
                  <EndDate endedAt={st.endedAt} editable={editable} today={today} onChange={(endedAt) => upd('stores', st.id, { endedAt })} t={t} lang={lang} />
                </>); })() : edit.list === 'catalog' ? (() => { const k = editing as NeedCatalogEntry; const c = need.categories.find((x) => x.id === k.categoryId); const items = state.erp.items.filter((it) => !c || it.categoryHint === c.id); return (<>
                  <NameFields name={k.name} editable={editable} onChange={(name) => upd('catalog', k.id, { name })} t={t} />
                  <label><span>{t.need.policy.category}</span><select className="select-in" value={k.categoryId} disabled={!editable} onChange={(e) => upd('catalog', k.id, { categoryId: e.target.value, itemIds: [] })}>{liveNeed(need.categories, today).map((x) => <option key={x.id} value={x.id}>{tx(x.name)}</option>)}</select></label>
                  <label><span>{t.need.policy.items}</span><span className="chips">{k.itemIds.map((id) => { const it = state.erp.items.find((x) => x.id === id); return <span key={id} className="pill tint"><span className="mono">{id}</span>{it ? ` · ${tx(it.name)}` : ''}{editable ? <button type="button" className="chip-x" aria-label="remove" onClick={() => upd('catalog', k.id, { itemIds: k.itemIds.filter((x) => x !== id) })}>×</button> : null}</span>; })}{!k.itemIds.length && !editable ? <span className="cell-sub">{t.need.freeText}</span> : null}{editable ? <select className="select-in" value="" onChange={(e) => { if (e.target.value) upd('catalog', k.id, { itemIds: [...k.itemIds, e.target.value], price: k.price ?? state.erp.items.find((x) => x.id === e.target.value)?.price }); }}><option value="">{lang === 'ar' ? '+ رقم صنف' : '+ item'}</option>{items.filter((it) => !k.itemIds.includes(it.id)).map((it) => <option key={it.id} value={it.id}>{it.id} · {tx(it.name)}{it.price ? ` · ${it.price.toLocaleString('en')}` : ''}</option>)}</select> : null}</span></label>
                  <label><span>{t.need.policy.price}</span><input className="num" type="number" dir="ltr" min={0} value={k.price ?? ''} disabled={!editable} onChange={(e) => upd('catalog', k.id, { price: e.target.value ? Number(e.target.value) : undefined })} /></label>
                  <label><span>{t.need.policy.availability}</span><select className="select-in" value={k.availability || ''} disabled={!editable} onChange={(e) => upd('catalog', k.id, { availability: (e.target.value || undefined) as NeedCatalogEntry['availability'] })}><option value="">{t.need.policy.availabilityOf.inherit}</option>{AVAIL.filter((a) => a !== 'store' || c?.kind === 'material').map((a) => <option key={a} value={a}>{t.need.policy.availabilityOf[a]}</option>)}</select></label>
                  <label><span>{t.need.file.pool}</span><select className="select-in" value={k.poolId || ''} disabled={!editable} onChange={(e) => upd('catalog', k.id, { poolId: e.target.value || undefined })}><option value="">—</option>{liveNeed(need.pools || [], today).filter((pl) => pl.entityId === c?.entityId).map((pl) => <option key={pl.id} value={pl.id}>{tx(pl.name)} · {poolStock(state, pl)} {tx(pl.unit)}</option>)}</select></label>
                  <label><span>{t.need.policy.unitLabel}</span><input value={k.unit?.ar || ''} disabled={!editable} onChange={(e) => upd('catalog', k.id, { unit: { ar: e.target.value, en: k.unit?.en || e.target.value } })} /></label>
                  <label><span>{t.need.policy.unitEn}</span><input dir="ltr" value={k.unit?.en || ''} disabled={!editable} onChange={(e) => upd('catalog', k.id, { unit: { ar: k.unit?.ar || e.target.value, en: e.target.value } })} /></label>
                  <label style={{ flexBasis: '100%' }}><span>{t.need.policy.guidance}</span><textarea rows={2} value={k.guidance?.ar || ''} disabled={!editable} onChange={(e) => upd('catalog', k.id, { guidance: { ar: e.target.value, en: k.guidance?.en || '' } })} /></label>
                  <EndDate endedAt={k.endedAt} editable={editable} today={today} onChange={(endedAt) => upd('catalog', k.id, { endedAt })} t={t} lang={lang} />
                </>); })() : edit.list === 'authority' ? (() => { const b = editing as AuthorityBand; return (<>
                  <NameFields name={b.name} editable={editable} onChange={(name) => upd('authority', b.id, { name })} t={t} />
                  <label><span>{t.need.policy.upTo}</span><span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input className="num" type="number" dir="ltr" min={0} step={1000} value={b.upTo ?? ''} placeholder={t.need.policy.noLimit} disabled={!editable || b.upTo === null} onChange={(e) => upd('authority', b.id, { upTo: Number(e.target.value) })} /><label className="sw" style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}><input className="switch" type="checkbox" checked={b.upTo === null} disabled={!editable} onChange={(e) => upd('authority', b.id, { upTo: e.target.checked ? null : 100000 })} /><span>{t.need.policy.noLimit}</span></label></span></label>
                  <PosPicker label={t.need.policy.agent} ids={agentIds(b.agent)} editable={editable} onChange={(positionIds) => upd('authority', b.id, { agent: { ...b.agent, kind: 'positions', positionIds } })} />
                  {agentIds(b.agent).length > 1 ? <label><span>{t.need.policy.quorum}</span><div className="segmented sm">{(['any', 'all'] as const).map((q) => <button key={q} type="button" aria-pressed={(b.agent.quorum || 'any') === q} disabled={!editable} onClick={() => upd('authority', b.id, { agent: { ...b.agent, quorum: q } })}><span className="seg-txt">{q === 'any' ? t.need.policy.quorumAny : t.need.policy.quorumAll}</span></button>)}</div></label> : null}
                  <EndDate endedAt={b.endedAt} editable={editable} today={today} onChange={(endedAt) => upd('authority', b.id, { endedAt })} t={t} lang={lang} />
                </>); })() : edit.list === 'methods' ? (() => { const m = editing as PurchaseMethod; const sw = (k: 'offers' | 'higherBand' | 'tender' | 'contract', label: string) => <label className="sw" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><span>{label}</span><input className="switch" type="checkbox" checked={m[k]} disabled={!editable} onChange={(e) => upd('methods', m.id, { [k]: e.target.checked } as Partial<PurchaseMethod>)} /></label>; return (<>
                  <NameFields name={m.name} editable={editable} onChange={(name) => upd('methods', m.id, { name })} t={t} />
                  {sw('offers', t.need.policy.needsOffers)}
                  {m.offers ? <label><span>{t.need.policy.minOffers}</span><input className="num" type="number" dir="ltr" min={1} value={m.minOffers} disabled={!editable} onChange={(e) => upd('methods', m.id, { minOffers: Number(e.target.value) })} /></label> : null}
                  {sw('higherBand', t.need.policy.higherBand)}
                  {sw('tender', t.need.policy.isTender)}
                  {sw('contract', t.need.policy.isContract)}
                  <label style={{ flexBasis: '100%' }}><span>{t.need.policy.guidance}</span><textarea rows={2} value={m.guidance?.ar || ''} disabled={!editable} onChange={(e) => upd('methods', m.id, { guidance: { ar: e.target.value, en: m.guidance?.en || '' } })} /></label>
                  <EndDate endedAt={m.endedAt} editable={editable} today={today} onChange={(endedAt) => upd('methods', m.id, { endedAt })} t={t} lang={lang} />
                </>); })() : edit.list === 'pools' ? (() => { const pl = editing as NeedPool; const bal = poolStock(state, pl); const contracts = state.erp.contracts || []; return (<>
                  <NameFields name={pl.name} editable={editable} onChange={(name) => upd('pools', pl.id, { name })} t={t} />
                  <label><span>{t.need.policy.poolEntity}</span><select className="select-in" value={pl.entityId} disabled={!editable} onChange={(e) => upd('pools', pl.id, { entityId: e.target.value })}>{liveNeed(need.entities, today).map((e) => <option key={e.id} value={e.id}>{tx(e.name)}</option>)}</select></label>
                  <label><span>{t.need.policy.erpKind}</span><select className="select-in" value={pl.erpKind} disabled={!editable} onChange={(e) => upd('pools', pl.id, { erpKind: e.target.value as NeedPool['erpKind'] })}>{(['portal', 'material', 'contract'] as const).map((k) => <option key={k} value={k}>{t.need.policy.erpKindOf[k]}</option>)}</select></label>
                  {pl.erpKind === 'material' ? <><label><span>{t.need.policy.poolItem}</span><select className="select-in" value={pl.itemId || ''} disabled={!editable} onChange={(e) => upd('pools', pl.id, { itemId: e.target.value || undefined })}><option value="">—</option>{state.erp.items.map((it) => <option key={it.id} value={it.id}>{it.id} · {tx(it.name)}</option>)}</select></label><label><span>{t.need.policy.poolStore}</span><select className="select-in" value={pl.storeId || ''} disabled={!editable} onChange={(e) => upd('pools', pl.id, { storeId: e.target.value || undefined })}><option value="">—</option>{state.erp.storageLocations.map((l) => <option key={l.id} value={l.id}>{l.id} · {tx(l.name)}</option>)}</select></label></> : null}
                  {pl.erpKind === 'contract' ? <label><span>{t.need.policy.poolContract}</span><select className="select-in" value={pl.contractId || ''} disabled={!editable} onChange={(e) => upd('pools', pl.id, { contractId: e.target.value || undefined })}><option value="">—</option>{contracts.map((c) => <option key={c.id} value={c.id}>{c.id} · {tx(c.name)} · {t.need.policy.contractLeft} {Math.max(0, c.target - c.consumed).toLocaleString('en')}</option>)}</select></label> : null}
                  <label><span>{t.need.policy.unitLabel}</span><input value={pl.unit.ar} disabled={!editable} onChange={(e) => upd('pools', pl.id, { unit: { ...pl.unit, ar: e.target.value } })} /></label>
                  <label><span>{t.need.policy.unitEn}</span><input dir="ltr" value={pl.unit.en} disabled={!editable} onChange={(e) => upd('pools', pl.id, { unit: { ...pl.unit, en: e.target.value } })} /></label>
                  <label><span>{t.need.policy.poolPrice}</span><input className="num" type="number" dir="ltr" min={0} value={pl.unitPrice ?? ''} disabled={!editable} onChange={(e) => upd('pools', pl.id, { unitPrice: e.target.value ? Number(e.target.value) : undefined })} /></label>
                  <label className="sw" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><span>{t.need.policy.poolCustody}</span><input className="switch" type="checkbox" checked={pl.custody} disabled={!editable} onChange={(e) => upd('pools', pl.id, { custody: e.target.checked })} /></label>
                  <label style={{ flexBasis: '100%' }}><span>{t.need.policy.guidance}</span><textarea rows={2} value={pl.guidance?.ar || ''} disabled={!editable} onChange={(e) => upd('pools', pl.id, { guidance: { ar: e.target.value, en: pl.guidance?.en || '' } })} /></label>
                  <EndDate endedAt={pl.endedAt} editable={editable} today={today} onChange={(endedAt) => upd('pools', pl.id, { endedAt })} t={t} lang={lang} />
                  {/* الرصيد الجاري تشغيل لا إصدار: يُعدَّل فوراً بسبب وسجل */}
                  <div className="npc-balance" style={{ flexBasis: '100%' }}><b>{t.need.policy.poolBalance}: <span className="num">{bal}</span> {tx(pl.unit)}</b>{pl.erpKind === 'portal' && isAdmin ? <span className="np-two"><label><span>{t.need.policy.adjustBalance}</span><input id="npc-bal" className="num" type="number" dir="ltr" min={0} value={balance.qty} onChange={(e) => setBalance((b) => ({ ...b, qty: e.target.value }))} /></label><label><span>{t.need.policy.balanceWhy}</span><input id="npc-balwhy" value={balance.why} onChange={(e) => setBalance((b) => ({ ...b, why: e.target.value }))} /></label><button type="button" className="btn soft" disabled={!balance.why.trim() || balance.qty === ''} onClick={() => saveBalance(pl)}><I.check />{t.need.policy.adjustBalance}</button></span> : null}</div>
                </>); })() : (() => { const st = editing as NeedSite; return (<>
                  <NameFields name={st.name} editable={editable} onChange={(name) => upd('sites', st.id, { name })} t={t} />
                  <label><span>{t.need.policy.siteStores}</span><span className="chips">{liveNeed(need.stores, today).map((x) => { const on = st.storeIds.includes(x.id); return <button key={x.id} type="button" className={`pill ${on ? 'tint' : ''}`} aria-pressed={on} disabled={!editable} onClick={() => upd('sites', st.id, { storeIds: on ? st.storeIds.filter((k) => k !== x.id) : [...st.storeIds, x.id] })}>{on ? <I.check /> : null}{tx(x.name)}</button>; })}</span></label>
                  {!st.storeIds.length ? <PosPicker label={t.need.policy.receiver} ids={agentIds(st.receiverAgent)} editable={editable} onChange={(positionIds) => upd('sites', st.id, { receiverAgent: { kind: 'positions', positionIds, quorum: 'any' } })} /> : null}
                  <EndDate endedAt={st.endedAt} editable={editable} today={today} onChange={(endedAt) => upd('sites', st.id, { endedAt })} t={t} lang={lang} />
                </>); })()}
              </div>
            </Group>
            {!editable ? <><div style={{ height: 10 }} /><Notice tone="tint" icon="info">{isAdmin ? t.need.policy.noDraft : t.policy.onlyAdmin}</Notice></> : null}
          </div>
        ) : null}
      </Sheet>

      <Sheet open={schedOpen} onClose={() => setSchedOpen(false)} title={t.need.policy.schedule}>
        <Group>
          <Field id="nsc-from" label={t.policy.effective} error={schedProblem === 'past' ? t.policy.schedErrPast : schedProblem === 'taken' ? t.policy.schedErrTaken : schedProblem === 'beforeTip' ? (() => { const b = versions.filter((v) => v.id !== draft?.id && inForce(v) && v.from > sched.from).sort((a, c) => (a.from < c.from ? -1 : 1))[0]; return fill(t.policy.schedErrBeforeTip, { from: b?.from || '', number: b?.number || '' }); })() : undefined} hint={sched.from === today ? t.policy.schedToday : undefined}><input id="nsc-from" type="date" className="num" dir="ltr" value={sched.from} min={today} onChange={(e) => setSched((x) => ({ ...x, from: e.target.value }))} /></Field>
          <Field id="nsc-reason" label={t.need.policy.reason}><textarea id="nsc-reason" rows={2} value={sched.reason} onChange={(e) => setSched((x) => ({ ...x, reason: e.target.value }))} /></Field>
          <Field id="nsc-ref" label={t.need.policy.reference}><input id="nsc-ref" value={sched.reference} onChange={(e) => setSched((x) => ({ ...x, reference: e.target.value }))} /></Field>
        </Group>
        <div style={{ height: 10 }} />
        <Notice tone={schedProblem === 'empty' ? 'warn' : 'tint'} icon="target">{diffs.length ? changesText(diffs.length, lang) : t.policy.vscope.nothingYet}{schedProblem === 'empty' ? <> — {t.policy.schedErrEmpty}</> : null}</Notice>
        {problems.length ? <><div style={{ height: 10 }} /><Notice tone="danger" icon="alert">{t.need.policy.problemsTitle}<ul className="sched-list">{problems.map((p, i) => <li key={i}>{fill(t.need.policy.problems[p.kind], { name: tx(p.name) })}</li>)}</ul></Notice></> : null}
        <div style={{ height: 10 }} />
        <Notice tone="tint" icon="clock">{lang === 'ar' ? `يسري هذا الإصدار آلياً في ${sched.from || '…'} وينتهي الإصدار الساري في اليوم الذي قبله؛ الاحتياجات الجارية تكمل بإصدارها.` : `This version takes effect automatically on ${sched.from || '…'}; the current version ends the day before. In-flight needs keep their version.`}</Notice>
        <div style={{ height: 12 }} />
        <motion.button type="button" className="btn primary block lg" disabled={!sched.from || !sched.reason.trim() || !sched.reference.trim() || !!schedProblem || problems.length > 0} onClick={schedule} whileTap={{ scale: 0.97 }}><I.calendar />{t.need.policy.schedule}</motion.button>
      </Sheet>
    </div>
  );
}

/* ——— المحاكاة: من يطلب وماذا ولمن → المسار بأسمائه وأسبابه على السياسة السارية (ق.ح-07) ——— */
function NeedSimulator({ content }: { content: NeedContent }) {
  const { state } = useStore(); const { lang, t, tx } = useLang();
  const today = toISO(Date.now());
  const managers = state.people.filter((p) => canOpenNeed(state, p, content).ok);
  const [reqId, setReqId] = useState(managers[0]?.id || state.people[0].id); const [benId, setBenId] = useState(''); const [catId, setCatId] = useState(liveNeed(content.categories, today)[0]?.id || '');
  const requester = state.people.find((p) => p.id === reqId) || state.people[0]; const gate = canOpenNeed(state, requester, content);
  const ctx = catId ? buildNeedCtx(state, { requesterId: requester.id, beneficiaryId: benId || requester.id, categoryId: catId }, today) : null;
  const built = ctx ? needSteps(state, ctx, Date.now()) : null;
  return (
    <Stagger>
      <Item><Notice icon="info">{lang === 'ar' ? 'المحاكاة تبني المسار كما سيُبنى عند التقديم: السلسلة الإدارية فوق الطالب بأسمائها حتى رأس القطاع، والجهة الفنية والمستودع من الفئة والمقر، ومنسّقو القطاع، وما لا ينطبق ولماذا.' : 'The simulator builds the route as it would be built at submission: the management chain above the requester by name up to the sector head, the technical entity and store from the category and site, the sector coordinators, and what does not apply and why.'}</Notice></Item>
      <Item><Group><div className="ed-row" style={{ padding: '12px 16px' }}>
        <label><span>{t.common.requester}</span><select className="select-in" value={reqId} onChange={(e) => { setReqId(e.target.value); setBenId(''); }}>{state.people.map((p) => <option key={p.id} value={p.id}>{lang === 'ar' ? p.name : p.nameEn} · {lang === 'ar' ? p.title : p.titleEn}</option>)}</select></label>
        <label><span>{t.need.beneficiary}</span><select className="select-in" value={benId} onChange={(e) => setBenId(e.target.value)}><option value="">{t.need.forMe}</option>{state.people.filter((p) => p.id !== reqId).map((p) => <option key={p.id} value={p.id}>{lang === 'ar' ? p.name : p.nameEn} · {t.leave.location[p.location || 'riyadh']}</option>)}</select></label>
        <label><span>{t.need.category}</span><select className="select-in" value={catId} onChange={(e) => setCatId(e.target.value)}>{liveNeed(content.categories, today).map((c) => <option key={c.id} value={c.id}>{tx(c.name)}</option>)}</select></label>
      </div></Group></Item>
      <div style={{ height: 10 }} />
      {!gate.ok ? <Item><Notice tone="warn" icon="person">{fill(t.need.cannotOpenSub, { level: t.need.levelName[gate.min] })}</Notice></Item> : null}
      {built ? <Item><Group><div style={{ padding: '12px 14px' }}><NeedRoutePreview steps={built.steps} requester={requester} notApplied={built.notApplied} threshold={content.rules.tenderThreshold} tolerance={content.rules.tolerancePct} /></div></Group></Item> : null}
    </Stagger>
  );
}
