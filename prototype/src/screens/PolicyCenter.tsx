import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '../app/store';
import { I } from '../ui/icons';
import { Avatar, Cell, Field, Group, LargeTitle, Notice, Pill, Segmented, Sheet, TopBar, useLang, usePerson, useToast } from '../ui/components';
import { motion, AnimatePresence, Stagger, Item, Press, SPRING } from '../ui/motion';
import { RoutePreview, Checks, TierBar, EvalBadge, useGroupNames } from '../ui/LeaveBits';
import { PolicyDocument } from '../ui/Documents';
import { usePrint, PrintButton } from '../ui/Print';
import { statusOf, endOf, correctedBy, activeVersion, inForce, diffContent, labelFor, evaluateLeave, toISO, scheduleProblem, unlinkedTypes, erpTypeOf, cancelRuleOf, onCancelOf, SECTIONS, worksOutsideHome, windowOpen, stepTitle, agentTitle, conditionText, LEVEL_TITLE, LEVEL_HEAD, AGENT_KIND_TITLE, touchedIn, changesOf, versionsTouching, lastChangeOf, inVersionScope, availabilityOf, availabilityPatch, HIJRI_MONTHS, safeCloseDate, afterEndTypes, rebasePlan, awaitingVersion, incompleteWindows, fixedWindowState, baseContentOf, type PolicyContent, type PolicyVersion, type LeaveType, type Route, type RouteId, type Cat, type VersionStatus, type Section, type RouteStep, type AgentKind, type StepCondition, type Escalation, type Scope, type Fulfil, type Entitlement, type VersionScope, type ScopeKind, type Head, type Touched, type Availability } from '../domain/policy';
import { policyApprovers, leaveSteps, namesFor, positionById, unitById, holderOf, resolveHolder, requestsUnderVersion, canRevertVersion, revertBlocker, inflightInPeriod, requestsOfType, requestTitle, personById } from '../domain/engine';
import { ORG_LEVELS, type OrgLevel, type OrgUnit, type Position, type ErpLink, type ErpAbsenceType } from '../domain/types';
import { fmtDate, relTime, changesText, fill } from '../app/i18n';
import { useUI } from '../app/ui';
import { AdminNav } from './AdminCenter';

type Tab = 'types' | 'routes' | 'org' | 'ents' | 'ops' | 'calendar' | 'diff' | 'sim' | 'log';

export function PolicyCenter({ initialTab }: { initialTab?: string } = {}) {
  const { state, dispatch } = useStore(); const { lang, t, tx } = useLang(); const me = usePerson(); const toast = useToast(); const { L } = useUI();
  const today = toISO(Date.now()); const versions = state.policy.versions; const active = activeVersion(state.policy, today);
  /* v0.8.1: قد توجد مسودتان (إن أُعيد إصدار منتظر إلى المسودة ومعه مسودة أخرى)؛ الحفظ والجدولة على المسودة المختارة وحدها، وبطاقة «إصدار جديد» تختفي ما دامت مسودة مفتوحة */
  const anyDraft = versions.find((v) => statusOf(v, versions, today) === 'draft');
  const [selId, setSelId] = useState<string>(anyDraft ? anyDraft.id : active.id);
  const sel = versions.find((v) => v.id === selId) || active; const selStatus = statusOf(sel, versions, today);
  const editable = selStatus === 'draft' && me.persona === 'admin';
  const draft = selStatus === 'draft' ? sel : undefined;
  const TABS: Tab[] = ['types', 'routes', 'org', 'ents', 'ops', 'calendar', 'diff', 'sim', 'log'];
  const [fixOpen, setFixOpen] = useState(false);
  const [tab, setTab] = useState<Tab>(initialTab && (TABS as string[]).includes(initialTab) ? (initialTab as Tab) : 'types');
  /* v0.18: الرابط #/admin/policy/<tab> من مركز الإدارة يفتح لسانه (الهيكل والمناصب، والتشغيل) */
  useEffect(() => { if (initialTab && (TABS as string[]).includes(initialTab)) setTab(initialTab as Tab); }, [initialTab]); // eslint-disable-line react-hooks/exhaustive-deps
  const [content, setContent] = useState<PolicyContent>(sel.content); const [why, setWhy] = useState('');
  useEffect(() => { setContent(sel.content); setWhy(''); }, [sel.id, sel.content]);
  const base = versions.find((v) => v.id === sel.baseId)?.content || sel.content;
  const pending = useMemo(() => diffContent(sel.content, content), [sel.content, content]);
  const diffs = useMemo(() => diffContent(base, content), [base, content]);
  const [editType, setEditType] = useState<LeaveType | null>(null); const [schedOpen, setSchedOpen] = useState(false); const [newTypeOpen, setNewTypeOpen] = useState(false); const [newVerOpen, setNewVerOpen] = useState(false);
  /* v0.8 (D-016): نطاق المسودة يحدّد ما يُفتح عليه المحرر؛ الإصدارات النافذة يُستنتج نطاقها من سجل تغييراتها */
  const scope: VersionScope = sel.scope || { kind: 'all' }; const scoped = editable && scope.kind !== 'all';
  const scopedTab: Tab = scope.kind === 'route' ? 'routes' : scope.kind === 'entitlement' ? 'ents' : scope.kind === 'calendar' ? 'calendar' : 'types';
  useEffect(() => { if (editable && scope.kind !== 'all') setTab(scopedTab); }, [sel.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const widen = () => { if (!draft) return; dispatch({ type: 'policyScope', id: draft.id, scope: { kind: 'all' } }); toast({ title: t.policy.vscope.expanded, icon: 'sparkle', tone: 'info' }); };
  const touchedLabel = (x: Touched, c: PolicyContent): string => x.head === 'types' ? tx(c.types.find((k) => k.id === x.id)?.name || { ar: x.id || '', en: x.id || '' }) : x.head === 'routes' ? tx(c.routes.find((k) => k.id === x.id)?.name || { ar: x.id || '', en: x.id || '' }) : x.head === 'entitlements' ? tx(c.entitlements.find((k) => k.id === x.id)?.name || { ar: x.id || '', en: x.id || '' }) : x.head === 'calendar' ? t.policy.vscope.calendarObj : t.policy.vscope.warningsObj;
  const scopeChips = (v: PolicyVersion, max = 3) => { const list = touchedIn(v); if (!list.length) return null; return <span className="ptl-scope">{list.slice(0, max).map((x, i) => <Pill key={i} tone="tint">{touchedLabel(x, v.content)}</Pill>)}{list.length > max ? <Pill>+{list.length - max} {t.policy.vscope.more}</Pill> : null}</span>; };
  const scopeText = (sc: VersionScope, c: PolicyContent) => sc.kind === 'all' ? t.policy.vscope.all : `${t.policy.vscope[sc.kind]}${sc.id ? `: ${touchedLabel({ head: sc.kind === 'type' ? 'types' : sc.kind === 'route' ? 'routes' : sc.kind === 'entitlement' ? 'entitlements' : 'calendar', id: sc.id }, c)}` : ''}`;
  const [sched, setSched] = useState({ from: sel.from, reason: sel.reason, reference: sel.reference });
  useEffect(() => { setSched({ from: sel.from, reason: sel.reason, reference: sel.reference }); }, [sel.id, sel.from, sel.reason, sel.reference]);
  const isAdmin = me.persona === 'admin';
  const gov = state.policy.governance; const approvers = policyApprovers(state, gov.approverPositionId); const gnames = useGroupNames(); const pnames = namesFor(state);
  const posTitle = (id: string) => tx(positionById(state, id)?.title || { ar: id, en: id });
  /* المناصب التي يجوز أن تعتمد الإصدارات: رؤساء الوحدات من مستوى الإدارة فأعلى */
  const approverPositions = state.org.units.filter((u) => u.level !== 'section' && u.chiefPositionId).map((u) => u.chiefPositionId!);
  /* الموافقة الثانية (D-010): شاغل المنصب المعتمد (أو نائبه أو رئيسه إن شغر) يرى شريط الاعتماد على الإصدار المنتظر */
  const canApprove = selStatus === 'awaiting' && !!sel.approval && policyApprovers(state, sel.approval.positionId).some((p) => p.id === me.id);
  const [apNote, setApNote] = useState(''); const [apErr, setApErr] = useState('');
  const [exportOpen, setExportOpen] = useState(false); const [printing, print, portal] = usePrint();
  const statusTone = statusToneOf;
  /* v0.7 تصحيح إصدار سارٍ: تراجُع (إن لم يُقيَّم به طلب) أو إصدار تصحيحي يحل محله من تاريخه نفسه */
  const [revertOpen, setRevertOpen] = useState(false); const [revertReason, setRevertReason] = useState(''); const [revertErr, setRevertErr] = useState('');
  const evaluated = requestsUnderVersion(state, sel); const canRevert = canRevertVersion(state, sel, today);
  const corrector = correctedBy(sel, versions); const corrects = sel.correctsId ? versions.find((v) => v.id === sel.correctsId) : undefined;
  const correctiveDraft = () => { if (anyDraft) return; dispatch({ type: 'policyDraft', by: me.id, correctsId: sel.id }); toast({ title: t.policy.fix.correctedToast, sub: `${t.policy.fix.corrects} ${sel.number}`, icon: 'sparkle', tone: 'info' }); setTimeout(() => { const d = state.policy.versions.length; setSelId(`V-${d + 1}`); }, 0); };
  const revert = () => { if (!revertReason.trim()) { setRevertErr(t.policy.fix.reason); return; } dispatch({ type: 'policyRevert', id: sel.id, by: me.id, reason: revertReason.trim() }); setRevertOpen(false); toast({ title: t.policy.fix.reverted, sub: sel.number, icon: 'ret', tone: 'warn' }); setRevertReason(''); setSelId(active.id === sel.id ? versions[0].id : active.id); };
  const save = () => { if (!draft) return; dispatch({ type: 'policyUpdate', id: draft.id, content, by: me.id, why: why.trim() }); toast({ title: t.policy.saved, sub: changesText(pending.length, lang), icon: 'check', tone: 'ok' }); setWhy(''); };
  const newDraft = (sc: VersionScope) => { dispatch({ type: 'policyDraft', by: me.id, scope: sc }); setNewVerOpen(false); toast({ title: t.policy.created, sub: scopeText(sc, active.content), icon: 'sparkle', tone: 'info' }); setTimeout(() => { const d = state.policy.versions.length; setSelId(`V-${d + 1}`); }, 0); };
  /* v0.6.4: الجدولة تتحقق من التاريخ ومن أن كل نوع مفعّل مرتبط بنوع غياب في النظام المرجعي (بالرمز لا بالاسم) */
  const schedProblem = draft ? scheduleProblem(state.policy, draft.id, sched.from, today, content) : null; const unlinked = draft ? unlinkedTypes(content) : [];
  /* v0.8.1 سلامة السلسلة: إصدار ينتظر الموافقة الثانية يوقف الجدولة؛ ومسودة قديمة الأساس تُطبَّق فوق الطرف (أو تُرفض عند التعارض)؛ ونوافذ الإتاحة تُكمَل قبل الجدولة */
  const plan = draft ? rebasePlan(state.policy, draft, content) : null; const awaiting = draft ? awaitingVersion(state.policy, draft.id) : undefined; const incomplete = draft ? incompleteWindows(content) : [];
  const laterAfterCorrected = draft?.correctsId ? (() => { const c = versions.find((v) => v.id === draft.correctsId); return c ? versions.filter((v) => v.id !== draft.id && v.scheduled && !v.cancelled && v.from > c.from).sort((a, b) => (a.from < b.from ? -1 : 1))[0] : undefined; })() : undefined;
  const schedule = () => { if (!draft || !sched.reason.trim() || !sched.reference.trim() || !sched.from || schedProblem) return; if (pending.length) dispatch({ type: 'policyUpdate', id: draft.id, content, by: me.id, why: why.trim() || sched.reason }); dispatch({ type: 'policySchedule', id: draft.id, from: sched.from, reason: sched.reason, reference: sched.reference }); setSchedOpen(false); toast(gov.secondApprover ? { title: t.policy.status.awaiting, sub: `${draft.number} · ${posTitle(gov.approverPositionId)}`, icon: 'shield', tone: 'gold' } : { title: t.policy.scheduled, sub: `${draft.number} · ${t.policy.from} ${sched.from}`, icon: 'calendar', tone: 'gold' }); };
  const cancel = () => { if (!draft) return; dispatch({ type: 'policyCancel', id: draft.id }); setSelId(active.id); toast({ title: t.policy.cancelled, icon: 'x', tone: 'warn' }); };
  const approve = () => { dispatch({ type: 'policyApprove', id: sel.id, by: me.id, note: apNote.trim() || undefined }); toast({ title: t.policy.versionApproved, sub: `${sel.number} · ${t.policy.from} ${sel.from}`, icon: 'check', tone: 'ok' }); setApNote(''); };
  const returnIt = () => { if (!apNote.trim()) { setApErr(t.inbox.noteRequired); return; } dispatch({ type: 'policyReturn', id: sel.id, by: me.id, note: apNote.trim() }); toast({ title: t.policy.versionReturned, sub: sel.number, icon: 'ret', tone: 'warn' }); setApNote(''); };
  const setGov = (patch: Partial<typeof gov>) => dispatch({ type: 'policyGovernance', governance: { ...gov, ...patch }, by: me.id });
  const updType = (id: string, patch: Partial<LeaveType>) => setContent((c) => ({ ...c, types: c.types.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  const updRoute = (id: RouteId, steps: Route['steps']) => setContent((c) => ({ ...c, routes: c.routes.map((r) => (r.id === id ? { ...r, steps } : r)) }));
  const payLabel = (p: LeaveType['pay']) => (p === 'paid' ? t.leave.paid : p === 'partial' ? t.leave.partial : t.leave.unpaid);
  const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v));

  const timeline = (
    <div className="ptl">
      {versions.filter((v) => !v.cancelled || v.revoked).map((v) => { const st = statusOf(v, versions, today); const end = endOf(v, versions); const on = v.id === sel.id; const cb = st === 'corrected' ? correctedBy(v, versions) : undefined; return (
        <Press key={v.id} className={`ptl-card ${st} ${on ? 'on' : ''}`} onClick={() => setSelId(v.id)} lift>
          {on ? <motion.span className="ptl-on" layoutId="ptl-on" transition={SPRING.snappy} /> : null}
          <span className="ptl-body"><span className="ptl-top"><b className="num">{v.number}</b><Pill tone={statusTone(st)}>{t.policy.status[st]}</Pill></span>
          <span className="ptl-dates num">{st === 'draft' ? (lang === 'ar' ? 'لم يُجدوَل' : 'not scheduled') : st === 'corrected' ? `${v.from} · ${t.policy.fix.correctedBy} ${cb?.number || ''}` : st === 'reverted' ? `${v.from} · ${t.policy.fix.revertedAt}` : `${v.from} → ${end || t.policy.open}`}</span>
          <span className="ptl-sub">{v.changes.length ? changesText(v.changes.length, lang) : v.reason ? v.reason.slice(0, 40) : ''}</span>{scopeChips(v)}</span>
        </Press>
      ); })}
      {isAdmin && !anyDraft ? <Press className="ptl-card new" onClick={() => setNewVerOpen(true)} lift><span className="ptl-body"><span className="cell-lead"><I.plus /></span><b>{t.policy.newVersion}</b></span></Press> : null}
    </div>
  );

  const typeCard = (tp: LeaveType) => { const Ic = I[tp.icon as keyof typeof I] || I.leave; const route = content.routes.find((r) => r.id === tp.route); return (
    <Item key={tp.id}><Press className={`pt-card ${tp.enabled ? '' : 'off'}`} onClick={() => setEditType(tp)} lift>
      <span className={`qicon ${tp.tone}`}><Ic /></span>
      <span className="pt-body"><b>{tx(tp.name)}</b><LastChange head="types" id={tp.id} newInDraft={editable && !base.types.some((x) => x.id === tp.id)} /><span className="pt-meta"><Pill tone="tint">{route ? tx(route.name) : tp.route}</Pill><Pill>{payLabel(tp.pay)}</Pill>{tp.attachment?.required ? <Pill icon="clip">{lang === 'ar' ? 'مرفق' : 'attachment'}</Pill> : null}{tp.windowAfterEnd ? <Pill icon="clock">{tp.windowAfterEnd}{lang === 'ar' ? ' أيام عمل' : ' wd'}</Pill> : null}{tp.fixedDays ? <Pill icon="calendar">{tp.fixedDays}{lang === 'ar' ? ' يوماً' : ' d'}</Pill> : null}{tp.cycle ? <Pill tone="gold">{lang === 'ar' ? 'أجر متدرج' : 'tiered'}</Pill> : null}{tp.erp?.subtype ? <Pill icon="gear"><span className="mono">{tp.erp.subtype}</span></Pill> : <Pill tone="warn" icon="alert">{t.policy.erpMissing}</Pill>}{!tp.enabled ? <Pill tone="danger">{lang === 'ar' ? 'غير مفعّل' : 'off'}</Pill> : null}</span></span>
      <I.chev className="chev dirchev" />
    </Press></Item>
  ); };

  return (
    <div className="page view policy">
      <TopBar title={L.admin.nav.leave} back="#/admin" />
      <LargeTitle title={L.admin.nav.leave} sub={`${t.policy.leavePolicy} · ${t.policy.applyOn}`} />
      <AdminNav />
      {!isAdmin ? <><Notice tone={canApprove ? 'tint' : 'warn'} icon={canApprove ? 'shield' : 'info'}>{canApprove ? t.policy.approvalHint : t.policy.onlyAdmin}</Notice><div style={{ height: 12 }} /></> : null}
      <div className="section-head" style={{ paddingTop: 6 }}><h2>{t.policy.versions}</h2>{draft && isAdmin ? <span className="kbd-row" style={{ padding: 0 }}><button type="button" className="btn quiet" onClick={cancel}>{t.policy.cancel}</button><button type="button" className="btn soft" onClick={() => { setSelId(draft.id); setSchedOpen(true); }}><I.calendar />{t.policy.schedule}</button></span> : null}</div>
      {timeline}
      {/* حوكمة التغيير (D-010): مفتاح الموافقة الثانية والمكتب المعتمد — يسري فوراً ويُسجَّل في سجل التشغيل */}
      <div className="section-label"><span>{t.policy.governance}</span></div>
      <Group foot={gov.secondApprover ? t.policy.secondApproverOn : t.policy.secondApproverOff}>
        <div className="cell gov-cell"><span className="cell-lead gold"><I.shield /></span><span className="cell-main"><span className="cell-title">{t.policy.secondApprover}</span><span className="cell-sub">{t.policy.approverPosition}: {posTitle(gov.approverPositionId)}{approvers.length ? ` — ${approvers.map((p) => (lang === 'ar' ? p.name : p.nameEn)).join('، ')}` : ''}</span></span>
          <span className="cell-trail gov-ctl">{gov.secondApprover && isAdmin ? <select className="select-in" value={gov.approverPositionId} onChange={(e) => setGov({ approverPositionId: e.target.value })}>{approverPositions.map((id) => <option key={id} value={id}>{posTitle(id)}</option>)}</select> : null}<input className="switch" type="checkbox" checked={gov.secondApprover} disabled={!isAdmin} onChange={(e) => setGov({ secondApprover: e.target.checked })} /></span></div>
      </Group>
      <div className="pv-head">
        <div className="pv-line"><span><b className="num">{sel.number}</b> <Pill tone={statusTone(selStatus)}>{t.policy.status[selStatus]}</Pill>{selStatus !== 'draft' ? <span className="cell-sub"> {t.policy.from} <span className="num">{sel.from}</span>{endOf(sel, versions) ? <> {t.policy.to} <span className="num">{endOf(sel, versions)}</span></> : null}</span> : null}</span><button type="button" className="btn quiet" onClick={() => setExportOpen(true)}><I.doc />{t.policy.exportDoc}</button></div>
        {sel.reason ? <p className="cell-sub">{sel.reason}{sel.reference ? ` · ${sel.reference}` : ''}</p> : null}
        {sel.approval ? <p className="cell-sub pv-approval">{sel.approval.status === 'pending' ? <><I.shield /> {t.policy.awaitingSince} {posTitle(sel.approval.positionId)}{policyApprovers(state, sel.approval.positionId).length ? ` (${policyApprovers(state, sel.approval.positionId).map((p) => (lang === 'ar' ? p.name : p.nameEn)).join('، ')})` : ''} · {relTime(sel.approval.requestedAt, lang)}</> : sel.approval.status === 'approved' ? <><I.check /> {t.policy.approvedBy} {(() => { const p = state.people.find((x) => x.id === sel.approval!.by); return p ? (lang === 'ar' ? p.name : p.nameEn) : posTitle(sel.approval!.positionId); })()} · {sel.approval.at ? fmtDate(sel.approval.at, lang, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}{sel.approval.note ? ` · ${sel.approval.note}` : ''}</> : <><I.ret /> {t.policy.returnedBy} · {(() => { const p = state.people.find((x) => x.id === sel.approval!.by); return p ? (lang === 'ar' ? p.name : p.nameEn) : ''; })()}: {sel.approval.note}</>}</p> : null}
        {corrects ? <p className="cell-sub"><I.ret /> {t.policy.fix.corrects} <b className="num">{corrects.number}</b>{selStatus === 'draft' ? ` — ${t.policy.fix.correctHint}` : ''}</p> : null}
        {corrector ? <p className="cell-sub"><I.ret /> {t.policy.fix.correctedBy} <b className="num">{corrector.number}</b> · {t.policy.fix.evaluated}: <b className="num">{evaluated.length || t.policy.fix.none}</b></p> : null}
        {sel.revoked ? <p className="cell-sub"><I.x /> {t.policy.fix.revertedAt} {fmtDate(sel.revoked.at, lang, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {(() => { const p = state.people.find((x) => x.id === sel.revoked!.by); return p ? (lang === 'ar' ? p.name : p.nameEn) : ''; })()}: {sel.revoked.reason}</p> : null}
        {selStatus === 'draft' ? <p className="cell-sub pv-scope"><I.target /> {t.policy.vscope.line}: <b>{scopeText(scope, content)}</b>{scoped && isAdmin ? <button type="button" className="link-btn" onClick={widen}>{t.policy.vscope.expand}</button> : null}</p> : touchedIn(sel).length ? <p className="cell-sub pv-scope"><I.target /> {t.policy.vscope.changes}: {scopeChips(sel, 6)}</p> : null}
        {sel.rebasedFrom ? <p className="cell-sub pv-rebased"><I.history /> {fill(t.policy.rebasedLine, { base: sel.rebasedFrom.number, tip: versions.find((v) => v.id === sel.baseId)?.number || '' })}</p> : null}
        {editable ? <p className="hint-line" style={{ padding: '6px 0 0' }}>{t.policy.hint}</p> : null}
        {selStatus === 'active' && isAdmin ? (
          <div className={`fix-box ${fixOpen ? '' : 'folded'}`}>
            {/* v0.18: الصندوق مطويّ إلى سطر واحد حتى لا يأخذ الشاشة في كل زيارة؛ يُفتح عند الحاجة */}
            <button type="button" className="fix-toggle" aria-expanded={fixOpen} onClick={() => setFixOpen((o) => !o)}><b>{t.policy.fix.title}</b><span className="cell-sub">{t.policy.fix.hint}</span><I.chevDown className={`lb-chev ${fixOpen ? 'up' : ''}`} /></button>
            {fixOpen ? <div className="fix-opts">
              <div className="fix-opt"><button type="button" className="btn secondary" disabled={!canRevert} onClick={() => setRevertOpen(true)}><I.ret />{t.policy.fix.revert}</button><span className="cell-sub">{canRevert ? t.policy.fix.revertHint : (() => { const b = revertBlocker(state, sel); return b?.kind === 'later' ? fill(t.policy.fix.revertBlockedLater, { number: b.version.number, from: b.version.from }) : b?.kind === 'only' ? t.policy.fix.revertBlockedOnly : `${t.policy.fix.revertBlocked} ${evaluated.length} ${lang === 'ar' ? 'طلبات' : 'requests'}.`; })()}</span></div>
              <div className="fix-opt"><button type="button" className="btn soft" disabled={!!anyDraft} onClick={correctiveDraft}><I.sparkle />{t.policy.fix.correct}</button><span className="cell-sub">{anyDraft ? t.policy.fix.correctBlocked : t.policy.fix.correctHint}</span></div>
            </div> : null}
          </div>
        ) : null}
      </div>
      <Segmented id="policy" value={tab} onChange={setTab} options={([{ v: 'types', label: t.policy.types, n: scoped ? undefined : content.types.length }, { v: 'routes', label: t.policy.routes, n: scoped ? undefined : content.routes.length }, { v: 'org', label: t.policy.org }, { v: 'ents', label: t.policy.entitlements }, { v: 'ops', label: t.policy.ops }, { v: 'calendar', label: t.policy.calendar }, { v: 'diff', label: t.policy.diff, n: diffs.length }, { v: 'sim', label: t.policy.simulate }, { v: 'log', label: t.policy.changes }] as { v: Tab; label: string; n?: number }[]).filter((o) => !scoped || !['types', 'routes', 'ents', 'calendar'].includes(o.v) || o.v === scopedTab)} />
      <div style={{ height: 12 }} />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={tab + sel.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6, transition: { duration: 0.1 } }} transition={SPRING.soft}>
          {tab === 'types' && (<>
            {scoped && scope.kind === 'type' ? <><Notice tone="tint" icon="target">{t.policy.vscope.typeOnly}</Notice><div style={{ height: 10 }} /><Stagger className="pt-grid" step={0.035}>{content.types.filter((x) => x.id === scope.id).map(typeCard)}</Stagger></> : <>
            {editable ? <Press className="pt-card new" onClick={() => setNewTypeOpen(true)} lift><span className="qicon g-gold"><I.plus /></span><span className="pt-body"><b>{t.policy.newType}</b><span className="cell-sub">{t.policy.newTypeHint}</span></span><I.chev className="chev dirchev" /></Press> : null}
            {SECTIONS.map((sec) => { const items = content.types.filter((x) => (x.section || 'other') === sec); return items.length ? <React.Fragment key={sec}><div className="section-label"><span>{t.leave.sections[sec]}</span><span className="num">{items.length}</span></div><Stagger className="pt-grid" step={0.035}>{items.map(typeCard)}</Stagger></React.Fragment> : null; })}
            {/* v0.6.4: أنواع الغياب والحضور كما هي في النظام المرجعي — للقراءة؛ كل نوع في البوابة يُربط بواحد منها بالرمز */}
            <div className="section-label" style={{ paddingTop: 18 }}><span>{t.policy.erpTypes} · {t.policy.readOnly}</span><span className="num">{state.erp.absenceTypes.length}</span></div>
            <Group className="erp-list" foot={t.policy.erpTypesHint}>
              {state.erp.absenceTypes.map((et) => { const used = content.types.find((x) => x.erp?.grouping === et.grouping && x.erp?.subtype === et.subtype); return (
                <div key={`${et.grouping}-${et.subtype}`} className={`cell erp-row ${used ? 'linked' : ''}`}><span className={`cell-lead ${et.kind === 'absence' ? 'plain' : 'gold'}`}>{et.kind === 'absence' ? <I.leave /> : <I.clock />}</span><span className="cell-main"><span className="cell-title"><span className="mono">{et.subtype}</span> · {tx(et.name)}</span><span className="cell-sub"><Pill tone={et.kind === 'absence' ? 'tint' : 'gold'}>{et.kind === 'absence' ? t.policy.erpAbsence : t.policy.erpAttendance}</Pill> {t.policy.erpGrouping} <span className="mono">{et.grouping}</span> · {et.quotaType ? `${t.policy.erpQuota} ${tx(et.quotaName || { ar: et.quotaType, en: et.quotaType })} (${et.quotaType})` : t.policy.erpNoQuota}</span></span><span className="cell-trail">{used ? <Pill tone="ok" icon="check">{t.policy.erpLinked} {tx(used.name)}</Pill> : <Pill>{t.policy.erpUnused}</Pill>}</span></div>
              ); })}
            </Group></>}
          </>)}

          {tab === 'routes' && (
            <Stagger>
              <Item><Notice icon="info">{lang === 'ar' ? 'المسار خطوات، وكل خطوة قاعدة استخراج من الهيكل التنظيمي (منصب لا شخص) ونوع قرار ومهلة وشرط تطبيق وتصعيد؛ الطلب يلتقط خطواته عند تقديمه ويكملها ولو تغيّر المسار.' : 'A route is a list of steps; each step is a resolution rule from the org structure (a position, not a person), a decision type, an SLA, a condition and an escalation. A request captures its steps at submission and keeps them even if the route changes.'}</Notice></Item>
              {scoped && scope.kind === 'route' ? <Item><Notice tone="tint" icon="target">{t.policy.vscope.routeOnly}</Notice></Item> : <Item><Notice tone="tint" icon="leave">{t.policy.assignHint}</Notice></Item>}
              {content.routes.filter((r) => !scoped || scope.kind !== 'route' || r.id === scope.id).map((r) => <Item key={r.id}><RouteEditor route={r} content={content} editable={editable} isNew={editable && !base.routes.some((x) => x.id === r.id)} onChange={(steps) => updRoute(r.id, steps)} onRename={(name) => setContent((c) => ({ ...c, routes: c.routes.map((x) => (x.id === r.id ? { ...x, name } : x)) }))} onAssign={scoped ? undefined : (typeId) => updType(typeId, { route: r.id })} /></Item>)}
              {editable && !scoped ? <Item><button type="button" className="btn soft" onClick={() => setContent((c) => { const n = c.routes.length + 1; return { ...c, routes: [...c.routes, { id: `R${n}`, name: { ar: `مسار ${n}`, en: `Route ${n}` }, steps: [{ agent: { kind: 'lineManager' }, mode: 'approve', slaHours: 48, escalation: { remindAtPct: 80, after: 'notifyManager' } }] }] }; })}><I.plus />{lang === 'ar' ? 'مسار جديد' : 'New route'}</button></Item> : null}
            </Stagger>
          )}

          {tab === 'org' && <OrgTab isAdmin={isAdmin} />}

          {tab === 'ents' && (
            <Stagger>
              <Item><Notice icon="info">{lang === 'ar' ? 'الاستحقاق: من يستحقه (أهلية «خارج الموطن» من الجنسية وبند العقد، أو فئات من النظام المرجعي مع استثناءات التشغيل)، ومع أي إجازة وبأي حد أدنى، ومن ينفّذه وكيف ومتى؛ يظهر للموظف خانةً في طلبه ويصل إلى الجهة مهمةً تُغلق بمرجع.' : 'An entitlement: who is eligible (“outside home” from nationality and the contract element, or groups from the system of record plus operational exceptions), with which leave and minimum days, and who executes it, how and when; it appears to the employee as a checkbox and reaches the office as a task closed with a reference.'}</Notice></Item>
              {scoped && scope.kind === 'entitlement' ? <Item><Notice tone="tint" icon="target">{t.policy.vscope.entOnly}</Notice></Item> : null}
              {content.entitlements.filter((e) => !scoped || scope.kind !== 'entitlement' || e.id === scope.id).map((e) => { const upd = (patch: Partial<Entitlement>) => setContent((c) => ({ ...c, entitlements: c.entitlements.map((x) => (x.id === e.id ? { ...x, ...patch } : x)) })); return (
                <Item key={e.id}><Group className="ent-ed"><div className="cell stacked">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><span className="cell-lead gold"><I.seal /></span><span className="cell-main"><span className="cell-title">{tx(e.name)}</span><span className="cell-sub">{tx(e.action)}</span><LastChange head="entitlements" id={e.id} history={t.policy.hist.ent} newInDraft={editable && !base.entitlements.some((x) => x.id === e.id)} /></span><input className="switch" type="checkbox" checked={e.enabled} disabled={!editable} onChange={(ev) => upd({ enabled: ev.target.checked })} /></div>
                  <div className="ed-row">
                    <label><span>{t.policy.ent.eligibility}</span><div className="segmented sm">{(['outsideHome', 'scope'] as const).map((k) => <button key={k} type="button" aria-pressed={e.eligibility === k} disabled={!editable} onClick={() => upd({ eligibility: k })}><span className="seg-txt">{k === 'outsideHome' ? (lang === 'ar' ? 'خارج الموطن' : 'Outside home') : t.policy.ent.scope}</span></button>)}</div></label>
                    <label><span>{t.policy.field.minDays}</span><input className="num-in num" type="number" min={1} value={e.minDays} disabled={!editable} onChange={(ev) => upd({ minDays: Number(ev.target.value) })} /></label>
                    <label><span>{t.policy.field.perYear}</span><input className="num-in num" type="number" min={1} value={e.perYear} disabled={!editable} onChange={(ev) => upd({ perYear: Number(ev.target.value) })} /></label>
                    <label><span>{t.policy.ent.types}</span><span className="chips">{content.types.filter((x) => x.enabled).map((x) => { const on = e.leaveTypes.includes(x.id); return <button key={x.id} type="button" className={`pill ${on ? 'tint' : ''}`} aria-pressed={on} disabled={!editable} onClick={() => upd({ leaveTypes: on ? e.leaveTypes.filter((k) => k !== x.id) : [...e.leaveTypes, x.id] })}>{on ? <I.check /> : null}{tx(x.name)}</button>; })}</span></label>
                  </div>
                  {e.eligibility === 'outsideHome' ? <span className="cell-sub">{t.policy.ent.outsideHome}</span> : <ScopePicker scope={e.scope} editable={editable} onChange={(scope) => upd({ scope })} />}
                  <div className="section-label" style={{ padding: '8px 0 2px' }}><span>{t.policy.ent.fulfil}</span></div>
                  <FulfilEditor f={e.fulfil} editable={editable} onChange={(fulfil) => upd({ fulfil })} />
                  {/* v0.7: ما يحدث عند إلغاء إجازة نُفِّذ معها هذا الاستحقاق */}
                  <div className="section-label" style={{ padding: '8px 0 2px' }}><span>{t.policy.cancelRule.onCancel}</span></div>
                  {(() => { const oc = onCancelOf(e); return (
                    <div className="ed-row oncancel-ed">
                      <label><span>{t.policy.cancelRule.approval}</span><input className="switch" type="checkbox" checked={oc.approval} disabled={!editable} onChange={(ev) => upd({ onCancel: { ...oc, approval: ev.target.checked } })} /></label>
                      <label><span>{t.policy.cancelRule.reversal}</span><div className="segmented sm">{(['task', 'notify', 'none'] as const).map((k) => <button key={k} type="button" aria-pressed={oc.reversal === k} disabled={!editable} onClick={() => upd({ onCancel: { ...oc, reversal: k } })}><span className="seg-txt">{k === 'task' ? t.policy.cancelRule.task : k === 'notify' ? t.policy.cancelRule.notify : t.policy.cancelRule.noReversal}</span></button>)}</div></label>
                      {oc.reversal === 'task' ? <label><span>{t.policy.cancelRule.sla}</span><input className="num-in num" type="number" min={1} value={oc.slaHours} disabled={!editable} onChange={(ev) => upd({ onCancel: { ...oc, slaHours: Number(ev.target.value) } })} /></label> : null}
                    </div>
                  ); })()}
                </div></Group></Item>
              ); })}
            </Stagger>
          )}

          {tab === 'ops' && <Ops content={active.content} isAdmin={isAdmin} />}

          {tab === 'calendar' && (
            <Stagger>
              {scoped && scope.kind === 'calendar' ? <Item><Notice tone="tint" icon="target">{t.policy.vscope.calOnly}</Notice></Item> : null}
              <div className="section-label"><span>{t.policy.field.weekend} · {t.policy.readOnly}</span></div>
              <Group>
                <Item><div className="cell"><span className="cell-lead plain"><I.globe /></span><span className="cell-main"><span className="cell-title">{t.leave.location.riyadh}</span><span className="cell-sub">{lang === 'ar' ? 'الجمعة والسبت' : 'Friday and Saturday'}</span></span></div></Item>
                <Item><div className="cell"><span className="cell-lead plain"><I.globe /></span><span className="cell-main"><span className="cell-title">{t.leave.location.abudhabi}</span><span className="cell-sub">{lang === 'ar' ? 'السبت والأحد' : 'Saturday and Sunday'}</span></span></div></Item>
              </Group>
              <div className="section-label"><span>{t.policy.field.holidays}</span></div>
              <Group>
                {content.calendar.holidays.map((h, i) => <Item key={h.date + i}><div className="cell"><span className="cell-lead gold"><I.calendar /></span><span className="cell-main"><span className="cell-title">{tx(h.name)}</span><span className="cell-sub num">{h.date} · {h.locations.map((l) => t.leave.location[l]).join('، ')}</span></span>{editable ? <button type="button" className="icon-btn" aria-label="remove" onClick={() => setContent((c) => ({ ...c, calendar: { ...c.calendar, holidays: c.calendar.holidays.filter((_, k) => k !== i) } }))}><I.x /></button> : null}</div></Item>)}
                {editable ? <HolidayAdder onAdd={(h) => setContent((c) => ({ ...c, calendar: { ...c.calendar, holidays: [...c.calendar.holidays, h].sort((a, b) => (a.date < b.date ? -1 : 1)) } }))} /> : null}
              </Group>
              <div className="section-label"><span>{t.policy.warnings}</span></div>
              <Group><div className="ed-row" style={{ padding: '12px 16px' }}>
                <label><span>{t.policy.field.tierPct}</span><input className="num-in num" type="number" min={1} max={100} value={content.warnings.tierPct} disabled={!editable} onChange={(e) => setContent((c) => ({ ...c, warnings: { ...c.warnings, tierPct: Number(e.target.value) } }))} /></label>
                <label><span>{t.policy.field.tierDays}</span><input className="num-in num" type="number" min={0} value={content.warnings.tierDays} disabled={!editable} onChange={(e) => setContent((c) => ({ ...c, warnings: { ...c.warnings, tierDays: Number(e.target.value) } }))} /></label>
              </div></Group>
            </Stagger>
          )}

          {tab === 'diff' && (
            diffs.length === 0 ? <Group><div className="empty"><span className="ic"><I.check /></span><b>{t.policy.noChanges}</b></div></Group> : (
              <Stagger><Group>
                {diffs.map((d) => { const lb = labelFor(d.path, content); return <Item key={d.path}><div className="diff-row"><b>{tx(lb)}</b><span className="diff-vals"><span className="before">{fmtVal(d.before, lang)}</span><I.chev className="dirchev" /><span className="after">{fmtVal(d.after, lang)}</span></span></div></Item>; })}
              </Group></Stagger>
            )
          )}

          {tab === 'sim' && <Simulator content={content} versionNumber={sel.number} />}

          {tab === 'log' && (
            (() => { const all = versions.flatMap((v) => v.changes.map((c) => ({ ...c, v: v.number }))).sort((a, b) => b.at - a.at); return all.length === 0 ? <Group><div className="empty"><span className="ic"><I.doc /></span><b>{t.policy.noChanges}</b></div></Group> : (
              <Stagger><Group>{all.map((c, i) => { const who = state.people.find((p) => p.id === c.by); return <Item key={i}><div className="diff-row"><b>{tx(c.label)} <Pill tone="tint">{c.v}</Pill></b><span className="diff-vals"><span className="before">{fmtVal(c.before, lang)}</span><I.chev className="dirchev" /><span className="after">{fmtVal(c.after, lang)}</span></span><span className="cell-sub">{who ? (lang === 'ar' ? who.name : who.nameEn) : c.by} · {fmtDate(c.at, lang, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}{c.why ? ` · ${c.why}` : ''}</span></div></Item>; })}</Group></Stagger>
            ); })()
          )}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {editable && pending.length > 0 && (
          <motion.div className="savebar" initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} transition={SPRING.soft}>
            <span className="sb-n">{changesText(pending.length, lang)}</span>
            <input className="sb-why" value={why} onChange={(e) => setWhy(e.target.value)} placeholder={t.policy.why} />
            <motion.button type="button" className="btn primary" onClick={save} whileTap={{ scale: 0.97 }}><I.check />{t.policy.save}</motion.button>
          </motion.div>
        )}
        {canApprove && (
          <motion.div key="approve" className="savebar approvebar" initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} transition={SPRING.soft}>
            <span className="sb-n"><I.shield />{sel.number} · {changesText(sel.changes.length, lang)}</span>
            <input className={`sb-why ${apErr ? 'invalid' : ''}`} value={apNote} onChange={(e) => { setApNote(e.target.value); setApErr(''); }} placeholder={apErr || t.policy.approvalNote} />
            <motion.button type="button" className="btn secondary" onClick={returnIt} whileTap={{ scale: 0.97 }}><I.ret />{t.policy.returnVersion}</motion.button>
            <motion.button type="button" className="btn primary" onClick={approve} whileTap={{ scale: 0.97 }}><I.check />{t.policy.approveVersion}</motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      <Sheet open={exportOpen} onClose={() => setExportOpen(false)} title={`${t.policy.doc.title} · ${sel.number}`} lead={<span className="cell-lead gold"><I.doc /></span>}>
        <PolicyDocument version={sel} />
        <div className="kbd-row" style={{ padding: '12px 0 0', justifyContent: 'flex-end' }}><PrintButton onClick={print} /></div>
        {printing ? null : <p className="cell-sub" style={{ marginTop: 6 }}>{lang === 'ar' ? 'المستند يُبنى من محتوى الإصدار كما هو ومن سجل تغييراته؛ يُطبع أو يُحفظ PDF من الزر أعلاه.' : 'Built from the version’s content as is and its change log; print or save as PDF from the button above.'}</p>}
      </Sheet>
      {portal(<PolicyDocument version={sel} still />)}

      <Sheet open={!!editType} onClose={() => setEditType(null)} title={editType ? tx(editType.name) : ''} lead={editType ? <span className={`qicon ${editType.tone}`}>{React.createElement(I[editType.icon as keyof typeof I] || I.leave)}</span> : null}>
        {editType && <TypeEditor tp={content.types.find((x) => x.id === editType.id) || editType} routes={content.routes} types={content.types} editable={editable} isNew={!base.types.some((x) => x.id === editType.id)} onChange={(patch) => updType(editType.id, patch)} onDelete={() => { setContent((c) => ({ ...c, types: c.types.filter((x) => x.id !== editType.id) })); setEditType(null); toast({ title: t.policy.typeDeleted, icon: 'x', tone: 'warn' }); }} />}
      </Sheet>

      <Sheet open={newTypeOpen} onClose={() => setNewTypeOpen(false)} title={t.policy.newType} lead={<span className="qicon g-gold"><I.plus /></span>}>
        {newTypeOpen && <NewTypeSheet routes={content.routes} types={content.types} onCreate={(tp) => { setContent((c) => ({ ...c, types: [...c.types, tp] })); setNewTypeOpen(false); setEditType(tp); toast({ title: t.policy.typeCreated, sub: tx(tp.name), icon: 'sparkle', tone: 'ok' }); }} />}
      </Sheet>

      <Sheet open={newVerOpen} onClose={() => setNewVerOpen(false)} title={t.policy.newVersion} lead={<span className="qicon g-gold"><I.plus /></span>}>
        {newVerOpen && <NewVersionSheet content={active.content} onCreate={newDraft} />}
      </Sheet>

      <Sheet open={schedOpen} onClose={() => setSchedOpen(false)} title={t.policy.schedule}>
        <Group>
          <Field id="sc-from" label={t.policy.effective} error={schedProblem === 'past' ? t.policy.schedErrPast : schedProblem === 'taken' ? t.policy.schedErrTaken : schedProblem === 'beforeTip' ? (() => { const b = versions.filter((v) => v.id !== draft?.id && inForce(v) && v.from > sched.from).sort((a, c) => (a.from < c.from ? -1 : 1))[0]; return fill(t.policy.schedErrBeforeTip, { from: b?.from || '', number: b?.number || '' }); })() : undefined} hint={sched.from === today ? t.policy.schedToday : undefined}><input id="sc-from" type="date" className="num" dir="ltr" value={sched.from} min={today} onChange={(e) => setSched((x) => ({ ...x, from: e.target.value }))} /></Field>
          <Field id="sc-reason" label={t.policy.reason}><textarea id="sc-reason" rows={2} value={sched.reason} onChange={(e) => setSched((x) => ({ ...x, reason: e.target.value }))} /></Field>
          <Field id="sc-ref" label={t.policy.reference}><input id="sc-ref" value={sched.reference} onChange={(e) => setSched((x) => ({ ...x, reference: e.target.value }))} /></Field>
        </Group>
        {draft ? <><div style={{ height: 10 }} /><Notice tone={schedProblem === 'empty' ? 'warn' : 'tint'} icon="target">{t.policy.vscope.line}: <b>{scopeText(scope, content)}</b> · {diffs.length ? changesText(diffs.length, lang) : t.policy.vscope.nothingYet}{schedProblem === 'empty' ? <> — {t.policy.schedErrEmpty}</> : null}</Notice></> : null}
        {awaiting ? <><div style={{ height: 10 }} /><Notice tone="danger" icon="shield">{fill(t.policy.schedErrAwaiting, { number: awaiting.number, position: posTitle(awaiting.approval?.positionId || '') })}</Notice></> : null}
        {plan && plan.conflicts.length ? <><div style={{ height: 10 }} /><Notice tone="danger" icon="alert">{fill(t.policy.schedErrConflict, { base: plan.base?.number || '' })}<ul className="sched-list">{plan.conflicts.map((c, i) => <li key={i}>{fill(t.policy.schedErrConflictRow, { obj: touchedLabel(c.obj, content), number: c.version.number, from: c.version.from })}</li>)}</ul>{fill(t.policy.schedErrConflictHint, { tip: plan.tip.number })}</Notice></> : plan && plan.stale && plan.mine.length ? <><div style={{ height: 10 }} /><Notice tone="tint" icon="history">{fill(t.policy.schedRebase, { base: plan.base?.number || '', tip: plan.tip.number, objs: plan.mine.map((m) => touchedLabel(m, content)).join(lang === 'ar' ? '، ' : ', ') })}</Notice></> : null}
        {unlinked.length ? <><div style={{ height: 10 }} /><Notice tone="danger" icon="alert">{t.policy.schedErrUnlinked} <b>{unlinked.map((x) => tx(x.name)).join(lang === 'ar' ? '، ' : ', ')}</b></Notice></> : null}
        {incomplete.length ? <><div style={{ height: 10 }} /><Notice tone="danger" icon="alert">{t.policy.schedErrIncomplete}<ul className="sched-list">{incomplete.map((x, i) => <li key={i}><b>{tx(x.tp.name)}</b>: {x.why === 'dates' ? t.policy.avail.needDates : x.why === 'reversed' ? t.policy.avail.reversed : t.policy.avail.hijriBad}</li>)}</ul></Notice></> : null}
        {draft?.correctsId ? (() => { const c = versions.find((v) => v.id === draft.correctsId); const n = c ? requestsUnderVersion(state, c).length : 0; return c ? <><div style={{ height: 10 }} /><Notice tone="warn" icon="ret">{lang === 'ar' ? `إصدار تصحيحي: يحل محل الإصدار ${c.number} من تاريخه نفسه (${c.from}) إن جُدوِل به، ويُعلَّم الإصدار ${c.number} «مُصحَّح». الطلبات التي قُيِّمت به (${n}) تبقى بإصدارها.` : `Corrective version: replaces version ${c.number} from its own date (${c.from}) if scheduled on it, and ${c.number} is marked “corrected”. Requests already evaluated by it (${n}) keep their version.`}</Notice></> : null; })() : null}
        {laterAfterCorrected ? <><div style={{ height: 10 }} /><Notice tone="warn" icon="alert">{fill(t.policy.schedLaterAfterCorrect, { number: laterAfterCorrected.number, from: laterAfterCorrected.from })}</Notice></> : null}
        <div style={{ height: 10 }} />
        <Notice tone="tint" icon="clock">{lang === 'ar' ? `يسري هذا الإصدار آلياً في ${sched.from || '…'} وينتهي الإصدار الساري في اليوم الذي قبله؛ الطلبات الجارية تكمل بإصدارها.` : `This version takes effect automatically on ${sched.from || '…'}; the current version ends the day before. In-flight requests keep their version.`}</Notice>
        {gov.secondApprover ? <><div style={{ height: 8 }} /><Notice tone="warn" icon="shield">{lang === 'ar' ? `الموافقة الثانية مفعّلة: بعد الجدولة ينتظر الإصدار اعتماد ${posTitle(gov.approverPositionId)} قبل أن يسري، ويصله ذلك مهمةً في مهامي وتنبيهاً.` : `Second approval is on: after scheduling, the version waits for ${posTitle(gov.approverPositionId)} to approve it before it takes effect; that arrives as a task and a notification.`}</Notice></> : null}
        <div style={{ height: 12 }} />
        <motion.button type="button" className="btn primary block lg" disabled={!sched.from || !sched.reason.trim() || !sched.reference.trim() || !!schedProblem} onClick={schedule} whileTap={{ scale: 0.97 }}><I.calendar />{t.policy.schedule}</motion.button>
      </Sheet>

      <Sheet open={revertOpen} onClose={() => setRevertOpen(false)} title={`${t.policy.fix.revert} · ${sel.number}`} lead={<span className="qicon g-bronze"><I.ret /></span>}>
        <Notice tone="warn" icon="alert">{t.policy.fix.revertHint} {lang === 'ar' ? `يعود الإصدار ${versions.filter((v) => v.id !== sel.id && v.scheduled && !v.cancelled && v.from <= today).sort((a, b) => (a.from < b.from ? 1 : -1))[0]?.number || ''} سارياً، ويُبلَّغ شؤون الموظفين، ويُسجَّل في سجل التشغيل.` : `Version ${versions.filter((v) => v.id !== sel.id && v.scheduled && !v.cancelled && v.from <= today).sort((a, b) => (a.from < b.from ? 1 : -1))[0]?.number || ''} becomes active again, personnel affairs are notified, and it is logged.`}</Notice>
        <div style={{ height: 10 }} />
        <Group><Field id="rv-reason" label={t.policy.fix.reason} error={revertErr || undefined}><textarea id="rv-reason" rows={2} value={revertReason} onChange={(e) => { setRevertReason(e.target.value); setRevertErr(''); }} /></Field></Group>
        <div style={{ height: 12 }} />
        <motion.button type="button" className="btn primary block lg" onClick={revert} whileTap={{ scale: 0.97 }}><I.ret />{t.policy.fix.revert}</motion.button>
      </Sheet>
    </div>
  );
}

const statusToneOf = (s: VersionStatus) => (s === 'active' ? 'ok' : s === 'scheduled' ? 'tint' : s === 'awaiting' ? 'gold' : s === 'draft' ? 'warn' : s === 'cancelled' || s === 'reverted' ? 'danger' : s === 'corrected' ? 'warn' : 'done');

/* ——— v0.8 (D-016) إصدار جديد بنطاق معلَن: نوع واحد، أو مسار، أو استحقاق، أو التقويم، أو السياسة كلها ——— */
function NewVersionSheet({ content, onCreate }: { content: PolicyContent; onCreate: (scope: VersionScope) => void }) {
  const { t, tx } = useLang();
  const [kind, setKind] = useState<ScopeKind>('type'); const [id, setId] = useState('');
  const needsId = kind === 'type' || kind === 'route' || kind === 'entitlement';
  const options: { id: string; label: string; icon?: string; tone?: string }[] = kind === 'type' ? content.types.map((x) => ({ id: x.id, label: tx(x.name), icon: x.icon, tone: x.tone })) : kind === 'route' ? content.routes.map((r) => ({ id: r.id, label: tx(r.name) })) : kind === 'entitlement' ? content.entitlements.map((e) => ({ id: e.id, label: tx(e.name) })) : [];
  const KINDS: ScopeKind[] = ['type', 'route', 'entitlement', 'calendar', 'all'];
  return (
    <div className="type-editor new-version">
      <Notice icon="info">{t.policy.vscope.hint}</Notice>
      <div style={{ height: 10 }} />
      <Group>
        <div className="cell stacked"><span className="cell-title">{t.policy.vscope.q}</span><div className="segmented wrap">{KINDS.map((k) => <button key={k} type="button" aria-pressed={kind === k} onClick={() => { setKind(k); setId(''); }}>{kind === k ? <motion.span className="seg-thumb" layoutId="nv-kind" transition={SPRING.snappy} /> : null}<span className="seg-txt">{t.policy.vscope[k]}</span></button>)}</div></div>
        {needsId ? <div className="cell stacked"><span className="cell-title">{t.policy.vscope.pick}</span><span className="chips scope-pick">{options.map((o) => { const on = id === o.id; const Ic = o.icon ? I[o.icon as keyof typeof I] : undefined; return <button key={o.id} type="button" className={`pill ${on ? 'tint' : ''}`} aria-pressed={on} onClick={() => setId(o.id)}>{on ? <I.check /> : Ic ? <Ic /> : null}{o.label}</button>; })}</span></div> : null}
      </Group>
      <div style={{ height: 12 }} />
      <motion.button type="button" className="btn primary block lg" disabled={needsId && !id} onClick={() => onCreate(needsId ? { kind, id } : { kind })} whileTap={{ scale: 0.97 }}><I.plus />{t.policy.vscope.create}</motion.button>
    </div>
  );
}

/** «آخر تعديل» على بطاقة كائن: رقم الإصدار وتاريخه، وزر يفتح سجل الكائن (الإصدارات التي مسّته وما غيّرت فيه) */
function LastChange({ head, id, history, newInDraft }: { head: Head; id?: string; history?: string; newInDraft?: boolean }) {
  const { state } = useStore(); const { t } = useLang(); const today = toISO(Date.now()); const versions = state.policy.versions;
  const last = lastChangeOf(versions, head, id); const [open, setOpen] = useState(false);
  return (
    <>
      <span className={`pt-last num ${newInDraft ? 'new' : ''}`} onClick={(e) => { if (history) { e.stopPropagation(); setOpen(true); } }}>{newInDraft ? <I.sparkle /> : <I.history />}{newInDraft ? t.policy.hist.newInDraft : last ? `${t.policy.hist.last} ${last.number} · ${last.from > today ? t.policy.hist.effectiveFrom : t.policy.hist.asOf} ${last.from}` : `${t.policy.hist.since} ${versions[0]?.number || ''}`}{history && !newInDraft ? <span className="pt-last-open">{t.policy.hist.open}</span> : null}</span>
      {history ? <Sheet open={open} onClose={() => setOpen(false)} title={history} lead={<span className="qicon g-teal"><I.history /></span>}><ObjectHistory head={head} id={id} /></Sheet> : null}
    </>
  );
}

/** سجل الكائن: كل إصدار مسّه (رقمه وحالته وتاريخه وسببه) وما غيّره فيه تحديداً؛ للنوع يُذكر عدد الطلبات المقدَّمة به */
function ObjectHistory({ head, id }: { head: Head; id?: string }) {
  const { state } = useStore(); const { lang, t, tx } = useLang(); const today = toISO(Date.now()); const versions = state.policy.versions;
  const list = versionsTouching(versions, head, id); const reqs = head === 'types' && id ? requestsOfType(state, id).length : null;
  return (
    <div className="obj-hist">
      {reqs !== null ? <p className="cell-sub" style={{ margin: '-4px 0 10px' }}><I.doc /> <b className="num">{reqs}</b> {t.policy.hist.requests}</p> : null}
      <Group>
        {list.length === 0 ? <div className="empty"><span className="ic"><I.history /></span><b>{t.policy.hist.none}</b></div> : list.map((v) => { const st = statusOf(v, versions, today); const ch = changesOf(v, head, id); return (
          <div key={v.id} className="cell stacked hist-row">
            <div className="hist-head"><b className="num">{v.number}</b><Pill tone={statusToneOf(st)}>{t.policy.status[st]}</Pill><span className="cell-sub num">{v.from}</span>{v.reason ? <span className="cell-sub hist-reason">{v.reason}</span> : null}</div>
            {ch.map((c, i) => <span key={i} className="hist-ch"><b>{tx(c.label)}</b><span className="diff-vals"><span className="before">{fmtVal(c.before, lang)}</span><I.chev className="dirchev" /><span className="after">{fmtVal(c.after, lang)}</span></span></span>)}
            {!ch.length ? <span className="cell-sub">{t.policy.vscope.nothingYet}</span> : null}
          </div>
        ); })}
      </Group>
    </div>
  );
}

function fmtVal(v: string, lang: 'ar' | 'en'): string {
  if (v === '') return lang === 'ar' ? '—' : '—'; if (v === 'true') return lang === 'ar' ? 'نعم' : 'yes'; if (v === 'false') return lang === 'ar' ? 'لا' : 'no';
  if (v.length > 60) return v.slice(0, 60) + '…'; return v;
}

function HolidayAdder({ onAdd }: { onAdd: (h: { date: string; name: { ar: string; en: string }; locations: ('riyadh' | 'abudhabi')[] }) => void }) {
  const { lang, t } = useLang(); const [d, setD] = useState(''); const [n, setN] = useState(''); const [loc, setLoc] = useState<('riyadh' | 'abudhabi')[]>(['riyadh']);
  return (
    <div className="ed-row" style={{ padding: '12px 16px', alignItems: 'end' }}>
      <label><span>{lang === 'ar' ? 'التاريخ' : 'Date'}</span><input type="date" className="num" dir="ltr" value={d} onChange={(e) => setD(e.target.value)} /></label>
      <label><span>{lang === 'ar' ? 'الاسم' : 'Name'}</span><input value={n} onChange={(e) => setN(e.target.value)} /></label>
      <label><span>{lang === 'ar' ? 'المقر' : 'Location'}</span><span className="kbd-row" style={{ padding: 0 }}>{(['riyadh', 'abudhabi'] as const).map((l) => <button key={l} type="button" className={`pill ${loc.includes(l) ? 'tint' : ''}`} onClick={() => setLoc((x) => (x.includes(l) ? x.filter((k) => k !== l) : [...x, l]))}>{t.leave.location[l]}</button>)}</span></label>
      <button type="button" className="btn soft" disabled={!d || !n.trim() || !loc.length} onClick={() => { onAdd({ date: d, name: { ar: n, en: n }, locations: loc }); setD(''); setN(''); }}><I.plus />{lang === 'ar' ? 'أضف' : 'Add'}</button>
    </div>
  );
}

const TYPE_ICONS: (keyof typeof I)[] = ['leave', 'alert', 'medkit', 'bed', 'plane', 'pen', 'school', 'kaaba', 'heart', 'leaf', 'hourglass', 'ribbon', 'hand', 'family', 'globe', 'calendar', 'clock', 'doc', 'seal', 'sun', 'balance', 'passport'];
const TYPE_TONES = ['g-green', 'g-gold', 'g-teal', 'g-sage', 'g-bronze'];
/** أيقونة النوع ولونه: شبكة اختيار بصرية */
function IconTonePicker({ icon, tone, editable, onChange }: { icon: string; tone: string; editable: boolean; onChange: (p: { icon?: string; tone?: string }) => void }) {
  const { t } = useLang();
  return (
    <div className="ed-row" style={{ padding: '4px 0 0' }}>
      <label style={{ flexBasis: '100%' }}><span>{t.policy.icon}</span><span className="icon-grid">{TYPE_ICONS.map((k) => { const Ic = I[k]; const on = icon === k; return <button key={k} type="button" className={`icon-pick ${on ? `on ${tone}` : ''}`} aria-pressed={on} disabled={!editable} onClick={() => onChange({ icon: k })}><Ic /></button>; })}</span></label>
      <label style={{ flexBasis: '100%' }}><span>{t.policy.tone}</span><span className="icon-grid">{TYPE_TONES.map((k) => <button key={k} type="button" className={`tone-pick ${k} ${tone === k ? 'on' : ''}`} aria-pressed={tone === k} aria-label={k} disabled={!editable} onClick={() => onChange({ tone: k })}>{tone === k ? <I.check /> : null}</button>)}</span></label>
    </div>
  );
}
/** اختيار نوع الغياب/الحضور في النظام المرجعي: قائمة تُقرأ من H4S4 ولا تُكتب باليد؛ الرمز المستخدم في نوع آخر بالمسودة لا يُختار مرتين */
function ErpTypeSelect({ id, value, types, selfId, editable, onChange }: { id: string; value?: ErpLink; types: LeaveType[]; selfId?: string; editable: boolean; onChange: (link: ErpLink | undefined, et?: ErpAbsenceType) => void }) {
  const { state } = useStore(); const { t, tx } = useLang(); const list = state.erp.absenceTypes;
  const key = (l?: { grouping: string; subtype: string }) => (l ? `${l.grouping}|${l.subtype}` : '');
  const usedBy = (et: ErpAbsenceType) => types.find((x) => x.id !== selfId && x.erp?.grouping === et.grouping && x.erp?.subtype === et.subtype);
  const opt = (et: ErpAbsenceType) => { const u = usedBy(et); return <option key={key(et)} value={key(et)} disabled={!!u}>{et.subtype} · {tx(et.name)}{et.quotaType ? ` · ${t.policy.erpQuota} ${tx(et.quotaName || { ar: et.quotaType, en: et.quotaType })}` : ''}{u ? ` (${t.policy.erpLinked} ${tx(u.name)})` : ''}</option>; };
  return (
    <select id={id} className="select-in erp-sel" value={key(value)} disabled={!editable} onChange={(e) => { const et = list.find((x) => key(x) === e.target.value); onChange(et ? { grouping: et.grouping, subtype: et.subtype } : undefined, et); }}>
      <option value="">{t.policy.erpNotYet}</option>
      <optgroup label={t.policy.erpAbsence}>{list.filter((x) => x.kind === 'absence').map(opt)}</optgroup>
      <optgroup label={t.policy.erpAttendance}>{list.filter((x) => x.kind === 'attendance').map(opt)}</optgroup>
    </select>
  );
}
function TypeEditor({ tp, routes, types, editable, isNew, onChange, onDelete }: { tp: LeaveType; routes: Route[]; types: LeaveType[]; editable: boolean; isNew?: boolean; onChange: (p: Partial<LeaveType>) => void; onDelete?: () => void }) {
  const { lang, t, tx } = useLang(); const gnames = useGroupNames(); const { state } = useStore(); const erpType = erpTypeOf(state.erp.absenceTypes, tp.erp); const pnames = namesFor(state);
  const num = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v));
  const setNum = (k: keyof LeaveType) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ [k]: e.target.value.trim() === '' ? null : Number(e.target.value) } as Partial<LeaveType>);
  return (
    <div className="type-editor">
      <div className="section-label" style={{ paddingTop: 0 }}><span>{t.policy.basics}</span>{isNew ? <Pill tone="gold" icon="sparkle">{lang === 'ar' ? 'جديد في هذه المسودة' : 'New in this draft'}</Pill> : null}</div>
      <Group>
        <div className="ed-row" style={{ padding: '12px 16px 4px' }}>
          <label><span>{t.policy.typeName}</span><input dir="rtl" value={tp.name.ar} disabled={!editable} onChange={(e) => onChange({ name: { ...tp.name, ar: e.target.value } })} /></label>
          <label><span>{t.policy.typeNameEn}</span><input dir="ltr" value={tp.name.en} disabled={!editable} onChange={(e) => onChange({ name: { ...tp.name, en: e.target.value } })} /></label>
          <label><span>{t.policy.erpPick}</span><ErpTypeSelect id={`te-erp-${tp.id}`} value={tp.erp} types={types} selfId={tp.id} editable={editable} onChange={(erp) => onChange({ erp })} /></label>
        </div>
        <div style={{ padding: '0 16px 10px' }}><IconTonePicker icon={tp.icon} tone={tp.tone} editable={editable} onChange={(p) => onChange(p)} />
          {erpType ? <span className="cell-sub erp-info"><I.gear /> <span className="mono">{erpType.subtype}</span> · {tx(erpType.name)} · {erpType.kind === 'absence' ? t.policy.erpAbsence : t.policy.erpAttendance} · {t.policy.erpGrouping} <span className="mono">{erpType.grouping}</span> · {erpType.quotaType ? `${t.policy.erpQuota} ${tx(erpType.quotaName || { ar: erpType.quotaType, en: erpType.quotaType })}` : t.policy.erpNoQuota} — {t.policy.erpHint}</span> : tp.enabled ? <div style={{ paddingTop: 8 }}><Notice tone="warn" icon="alert">{t.policy.erpWarnType}</Notice></div> : <span className="cell-sub">{t.policy.erpHint}</span>}
        </div>
      </Group>
      <div style={{ height: 10 }} />
      <Group>
        <div className="cell"><span className="cell-main"><span className="cell-title">{t.policy.field.enabled}</span></span><input className="switch" type="checkbox" checked={tp.enabled} disabled={!editable} onChange={(e) => onChange({ enabled: e.target.checked })} /></div>
        <div className="cell stacked"><span className="cell-title">{t.policy.field.route}</span><div className="segmented wrap">{routes.map((r) => <button key={r.id} type="button" aria-pressed={tp.route === r.id} disabled={!editable} onClick={() => onChange({ route: r.id })}>{tp.route === r.id ? <motion.span className="seg-thumb" layoutId="te-route" transition={SPRING.snappy} /> : null}<span className="seg-txt">{tx(r.name)}</span></button>)}</div>{(() => { const r = routes.find((x) => x.id === tp.route); return r ? <span className="cell-sub route-reads"><I.chev className="dirchev" /> {t.policy.routeSteps}: {[...r.steps.map((rs) => tx(rs.title || stepTitle(rs, pnames))), t.desks.system].join(lang === 'ar' ? ' ← ' : ' → ')}</span> : null; })()}</div>
        <div className="cell stacked"><span className="cell-title">{t.policy.field.section}</span><div className="segmented wrap">{SECTIONS.map((sec) => <button key={sec} type="button" aria-pressed={(tp.section || 'other') === sec} disabled={!editable} onClick={() => onChange({ section: sec as Section })}>{(tp.section || 'other') === sec ? <motion.span className="seg-thumb" layoutId="te-section" transition={SPRING.snappy} /> : null}<span className="seg-txt">{t.leave.sections[sec]}</span></button>)}</div></div>
        <div className="cell stacked"><span className="cell-title">{t.policy.field.pay}</span><div className="segmented">{(['paid', 'partial', 'unpaid'] as const).map((p) => <button key={p} type="button" aria-pressed={tp.pay === p} disabled={!editable} onClick={() => onChange({ pay: p })}>{tp.pay === p ? <motion.span className="seg-thumb" layoutId="te-pay" transition={SPRING.snappy} /> : null}<span className="seg-txt">{p === 'paid' ? t.leave.paid : p === 'partial' ? t.leave.partial : t.leave.unpaid}</span></button>)}</div></div>
        <div className="cell stacked"><span className="cell-title">{t.policy.field.unit}</span><div className="segmented" style={{ maxWidth: 260 }}>{(['day', 'halfday'] as const).map((u) => <button key={u} type="button" aria-pressed={tp.unit === u} disabled={!editable} onClick={() => onChange({ unit: u })}>{tp.unit === u ? <motion.span className="seg-thumb" layoutId="te-unit" transition={SPRING.snappy} /> : null}<span className="seg-txt">{u === 'day' ? t.policy.field.unitDay : t.policy.field.unitHalf}</span></button>)}</div></div>
      </Group>
      <div style={{ height: 10 }} />
      <Group>
        <div className="cell stacked">
          <span className="cell-title">{t.policy.field.attachment}</span>
          <div className="ed-row"><label style={{ flex: 2 }}><span>{lang === 'ar' ? 'اسم المرفق بالعربية' : 'Attachment name (Arabic)'}</span><input dir="rtl" value={tp.attachment?.label.ar || ''} disabled={!editable} onChange={(e) => onChange({ attachment: { label: { ar: e.target.value, en: tp.attachment?.label.en || '' }, required: tp.attachment?.required ?? true } })} /></label><label style={{ flex: 2 }}><span>{lang === 'ar' ? 'بالإنجليزية' : 'Attachment name (English)'}</span><input dir="ltr" value={tp.attachment?.label.en || ''} disabled={!editable} onChange={(e) => onChange({ attachment: { label: { ar: tp.attachment?.label.ar || '', en: e.target.value }, required: tp.attachment?.required ?? true } })} /></label><label><span>{t.policy.field.required}</span><input className="switch" type="checkbox" checked={!!tp.attachment?.required} disabled={!editable || !tp.attachment} onChange={(e) => onChange({ attachment: { label: tp.attachment?.label || { ar: '', en: '' }, required: e.target.checked } })} /></label></div>
        </div>
        <div className="ed-row" style={{ padding: '12px 16px' }}>
          <label><span>{t.policy.field.windowAfterEnd}</span><input className="num-in num" type="number" min={0} placeholder={t.policy.field.noLimit} value={num(tp.windowAfterEnd)} disabled={!editable} onChange={setNum('windowAfterEnd')} /></label>
          <label><span>{t.policy.field.advanceMin}</span><input className="num-in num" type="number" min={0} placeholder={t.policy.field.noLimit} value={num(tp.advanceMin)} disabled={!editable} onChange={setNum('advanceMin')} /></label>
          <label><span>{t.policy.field.maxPerRequest}</span><input className="num-in num" type="number" min={0} placeholder={t.policy.field.noLimit} value={num(tp.maxPerRequest)} disabled={!editable} onChange={setNum('maxPerRequest')} /></label>
        </div>
        <div className="ed-row" style={{ padding: '0 16px 12px' }}>
          <label><span>{t.policy.field.fixedDays}</span><input className="num-in num" type="number" min={0} placeholder="—" value={num(tp.fixedDays)} disabled={!editable} onChange={(e) => onChange({ fixedDays: e.target.value.trim() === '' ? undefined : Number(e.target.value) })} /></label>
          <label><span>{t.policy.field.minServiceYears}</span><input className="num-in num" type="number" min={0} placeholder="—" value={num(tp.minServiceYears)} disabled={!editable} onChange={(e) => onChange({ minServiceYears: e.target.value.trim() === '' ? undefined : Number(e.target.value) })} /></label>
          <label><span>{t.policy.field.onceInCareer}</span><input className="switch" type="checkbox" checked={!!tp.onceInCareer} disabled={!editable} onChange={(e) => onChange({ onceInCareer: e.target.checked })} /></label>
        </div>
      </Group>
      {/* v0.8: متى يتاح النوع — دائماً، أو موسم يشغّله مدير النظام (كونوا معهم)، أو بين تاريخين ثابتين، أو نافذة هجرية (الحج) */}
      <div className="section-label"><span>{t.policy.avail.title}</span></div>
      <AvailabilityEditor tp={tp} editable={editable} onChange={onChange} />
      {tp.cycle && (
        <>
          <div className="section-label"><span>{t.policy.field.tiers}</span></div>
          <Group>
            {(Object.keys(tp.cycle) as Cat[]).map((cat) => { const rule = tp.cycle![cat]!; return (
              <div key={cat} className="cell stacked">
                <div className="ed-row"><b>{gnames.group(cat)}</b><label><span>{t.policy.field.years}</span><input className="num-in num" type="number" min={1} value={rule.years} disabled={!editable} onChange={(e) => onChange({ cycle: { ...tp.cycle, [cat]: { ...rule, years: Number(e.target.value) } } })} /></label></div>
                {rule.tiers.map((tier, i) => (
                  <div key={i} className="ed-row tier-row">
                    <span className="rp-n num">{i + 1}</span>
                    <label><span>{t.policy.field.months}</span><input className="num-in num" type="number" min={0} placeholder={t.policy.field.rest} value={tier.months === null ? '' : tier.months} disabled={!editable} onChange={(e) => onChange({ cycle: { ...tp.cycle, [cat]: { ...rule, tiers: rule.tiers.map((x, k) => (k === i ? { ...x, months: e.target.value.trim() === '' ? null : Number(e.target.value) } : x)) } } })} /></label>
                    <label><span>{lang === 'ar' ? 'الأجر %' : 'Pay %'}</span><input className="num-in num" type="number" min={0} max={100} value={tier.pay} disabled={!editable} onChange={(e) => onChange({ cycle: { ...tp.cycle, [cat]: { ...rule, tiers: rule.tiers.map((x, k) => (k === i ? { ...x, pay: Number(e.target.value) } : x)) } } })} /></label>
                    {editable ? <button type="button" className="icon-btn" aria-label="remove" onClick={() => onChange({ cycle: { ...tp.cycle, [cat]: { ...rule, tiers: rule.tiers.filter((_, k) => k !== i) } } })}><I.x /></button> : null}
                  </div>
                ))}
                {editable ? <button type="button" className="btn quiet" onClick={() => onChange({ cycle: { ...tp.cycle, [cat]: { ...rule, tiers: [...rule.tiers, { months: 1, pay: 50 }] } } })}><I.plus />{lang === 'ar' ? 'أضف شريحة' : 'Add tier'}</button> : null}
                {rule.condition ? <span className="cell-sub">{tx(rule.condition)}</span> : null}
              </div>
            ); })}
          </Group>
        </>
      )}
      <div className="section-label"><span>{t.policy.scope}</span></div>
      <Group><div style={{ padding: '10px 14px' }}><ScopePicker scope={tp.scope} editable={editable} onChange={(scope) => onChange({ scope })} /></div></Group>
      {/* v0.7: إلغاء الإجازة المعتمدة — حتى متى ومن يعتمد؛ الاسترداد يُضبط في الاستحقاق نفسه */}
      <div className="section-label"><span>{t.policy.cancelRule.title}</span></div>
      <Group foot={t.policy.cancelRule.hint}>{(() => { const cr = cancelRuleOf(tp); return (
        <div className="ed-row cancel-ed" style={{ padding: '12px 16px' }}>
          <label><span>{t.policy.cancelRule.allowed}</span><div className="segmented sm">{(['beforeStart', 'untilEnd', 'never'] as const).map((k) => <button key={k} type="button" aria-pressed={cr.allowed === k} disabled={!editable} onClick={() => onChange({ cancel: { ...cr, allowed: k } })}><span className="seg-txt">{t.policy.cancelRule[k]}</span></button>)}</div></label>
          {cr.allowed !== 'never' ? <label><span>{t.policy.cancelRule.route}</span><select className="select-in" value={cr.route} disabled={!editable} onChange={(e) => onChange({ cancel: { ...cr, route: e.target.value } })}><option value="none">{t.policy.cancelRule.none}</option>{routes.map((r) => <option key={r.id} value={r.id}>{tx(r.name)}</option>)}</select></label> : null}
        </div>
      ); })()}</Group>
      <div className="section-label"><span>{t.policy.field.guidance}</span></div>
      <Group><div className="ed-row" style={{ padding: '10px 14px' }}><label style={{ flexBasis: '100%' }}><span>{lang === 'ar' ? 'بالعربية' : 'Arabic'}</span><textarea dir="rtl" rows={2} value={tp.guidance.ar} disabled={!editable} onChange={(e) => onChange({ guidance: { ar: e.target.value, en: tp.guidance.en } })} /></label><label style={{ flexBasis: '100%' }}><span>{lang === 'ar' ? 'بالإنجليزية' : 'English'}</span><textarea dir="ltr" rows={2} value={tp.guidance.en} disabled={!editable} onChange={(e) => onChange({ guidance: { ar: tp.guidance.ar, en: e.target.value } })} /></label></div></Group>
      {tp.external ? <><div style={{ height: 10 }} /><Notice icon="info">{tx(tp.external)}</Notice></> : null}
      {/* v0.8: سجل هذا النوع — الإصدارات التي مسّته وما غيّرت فيه، وعدد الطلبات المقدَّمة به */}
      {!isNew ? <><div className="section-label"><span>{t.policy.hist.type}</span></div><ObjectHistory head="types" id={tp.id} /></> : null}
      {editable && isNew && onDelete ? <><div style={{ height: 12 }} /><button type="button" className="btn secondary block" onClick={onDelete}><I.x />{t.policy.deleteType}</button></> : null}
      <div style={{ height: 8 }} />
    </div>
  );
}

/** متى يتاح النوع: أربع حالات تغطي كل ما في السياسة اليوم (دائماً، موسم التشغيل، تاريخان ثابتان، نافذة هجرية) — تُقرأ كجملة وتُضبط بحقولها */
function AvailabilityEditor({ tp, editable, onChange, compact }: { tp: LeaveType; editable: boolean; onChange: (p: Partial<LeaveType>) => void; compact?: boolean }) {
  const { state } = useStore(); const { lang, t, tx } = useLang(); const today = toISO(Date.now());
  const av = availabilityOf(tp); const MODES: Availability[] = ['always', 'season', 'fixed', 'hijri'];
  const live = state.policy.windows[tp.id]; const inActive = activeVersion(state.policy, today).content.types.some((x) => x.id === tp.id && x.seasonal);
  const setLabel = (k: 'ar' | 'en', v: string) => onChange({ dateWindow: { label: { ...(tp.dateWindow?.label || { ar: '', en: '' }), [k]: v }, from: tp.dateWindow?.from || '', to: tp.dateWindow?.to || '' } });
  const hint = av === 'season' ? t.policy.avail.seasonHint : av === 'fixed' ? t.policy.avail.fixedHint : av === 'hijri' ? t.policy.avail.hijriHint : '';
  return (
    <Group foot={hint || undefined} className="avail-ed">
      <div className="cell stacked"><div className="segmented wrap">{MODES.map((a) => <button key={a} type="button" aria-pressed={av === a} disabled={!editable} onClick={() => onChange(availabilityPatch(tp, a))}>{av === a ? <motion.span className="seg-thumb" layoutId={`av-${compact ? 'nt' : tp.id}`} transition={SPRING.snappy} /> : null}<span className="seg-txt">{t.policy.avail[a]}</span></button>)}</div></div>
      {av === 'season' ? <div className="ed-row" style={{ padding: '0 16px 12px' }}>
        <label style={{ flex: 2 }}><span>{t.policy.avail.seasonName}</span><input dir="rtl" value={tp.dateWindow?.label.ar || ''} disabled={!editable} onChange={(e) => setLabel('ar', e.target.value)} placeholder={lang === 'ar' ? 'مثال: الأسبوع الأول من الدراسة' : 'e.g. الأسبوع الأول من الدراسة'} /></label>
        <label style={{ flex: 2 }}><span>{t.policy.typeNameEn}</span><input dir="ltr" value={tp.dateWindow?.label.en || ''} disabled={!editable} onChange={(e) => setLabel('en', e.target.value)} placeholder="e.g. First week of school" /></label>
        <span className="cell-sub avail-live">{inActive ? (windowOpen(live, today) ? <Pill tone="ok" icon="check">{t.policy.avail.opsNow}</Pill> : <Pill tone="warn" icon="clock">{t.policy.avail.opsClosed}</Pill>) : <Pill icon="clock">{t.policy.avail.notLive}</Pill>}{live?.from ? <> · {t.policy.lastWindow}: <span className="num">{live.from}</span> → <span className="num">{live.to || '…'}</span></> : null}</span>
      </div> : null}
      {av === 'fixed' ? <div className="ed-row" style={{ padding: '0 16px 12px' }}>
        <label style={{ flex: 2 }}><span>{t.policy.avail.windowName}</span><input dir="rtl" value={tp.dateWindow?.label.ar || ''} disabled={!editable} onChange={(e) => setLabel('ar', e.target.value)} /></label>
        <label style={{ flex: 2 }}><span>{t.policy.typeNameEn}</span><input dir="ltr" value={tp.dateWindow?.label.en || ''} disabled={!editable} onChange={(e) => setLabel('en', e.target.value)} /></label>
        <label><span>{t.leave.from}</span><input type="date" className="num" dir="ltr" value={tp.dateWindow?.from || ''} disabled={!editable} onChange={(e) => onChange({ dateWindow: { label: tp.dateWindow?.label || { ...tp.name }, from: e.target.value, to: tp.dateWindow?.to || '' } })} /></label>
        <label><span>{t.leave.to}</span><input type="date" className="num" dir="ltr" value={tp.dateWindow?.to || ''} disabled={!editable} onChange={(e) => onChange({ dateWindow: { label: tp.dateWindow?.label || { ...tp.name }, from: tp.dateWindow?.from || '', to: e.target.value } })} /></label>
        <span className="cell-sub avail-live">{(() => { const w = tp.dateWindow; const st = w ? fixedWindowState(w, today) : null; return st === 'open' ? <Pill tone="ok" icon="check">{fill(t.policy.avail.fixedNow, { to: w!.to })}</Pill> : st === 'upcoming' ? <Pill tone="tint" icon="calendar">{fill(t.policy.avail.fixedOpens, { from: w!.from })}</Pill> : st === 'ended' ? <Pill tone="warn" icon="clock">{fill(t.policy.avail.fixedEnded, { to: w!.to })}</Pill> : <Pill tone="warn" icon="alert">{!w?.from || !w?.to ? t.policy.avail.needDates : t.policy.avail.reversed}</Pill>; })()}</span>
      </div> : null}
      {av === 'hijri' && tp.hijriWindow ? <div className="ed-row" style={{ padding: '0 16px 12px' }}>
        <label><span>{t.policy.avail.month}</span><select className="select-in" value={tp.hijriWindow.month} disabled={!editable} onChange={(e) => onChange({ hijriWindow: { ...tp.hijriWindow!, month: Number(e.target.value) } })}>{HIJRI_MONTHS.map((m, i) => <option key={i} value={i + 1}>{i + 1} · {tx(m)}</option>)}</select></label>
        <label><span>{t.policy.avail.fromDay}</span><input className="num-in num" type="number" min={1} max={30} value={tp.hijriWindow.fromDay} disabled={!editable} onChange={(e) => onChange({ hijriWindow: { ...tp.hijriWindow!, fromDay: Number(e.target.value) } })} /></label>
        <label><span>{t.policy.avail.toDay}</span><input className="num-in num" type="number" min={1} max={30} value={tp.hijriWindow.toDay} disabled={!editable} onChange={(e) => onChange({ hijriWindow: { ...tp.hijriWindow!, toDay: Number(e.target.value) } })} /></label>
        {!(tp.hijriWindow.fromDay >= 1 && tp.hijriWindow.toDay <= 30 && tp.hijriWindow.fromDay <= tp.hijriWindow.toDay) ? <span className="cell-sub avail-live"><Pill tone="warn" icon="alert">{t.policy.avail.hijriBad}</Pill></span> : null}
      </div> : null}
    </Group>
  );
}

/* ——— نوع إجازة جديد: الأساسيات فقط، ثم يفتح محرر النوع لبقية القواعد ——— */
function NewTypeSheet({ routes, types, onCreate }: { routes: Route[]; types: LeaveType[]; onCreate: (tp: LeaveType) => void }) {
  const { lang, t, tx } = useLang(); const existing = types.map((x) => x.id);
  /* v0.6.4: النوع يُختار أولاً من قائمة النظام المرجعي (رمز لا اسم)، فيُملأ الاسم منه ويبقى قابلاً للتعديل */
  const [erp, setErp] = useState<ErpLink | undefined>(undefined); const [auto, setAuto] = useState(true);
  const [ar, setAr] = useState(''); const [en, setEn] = useState(''); const [section, setSection] = useState<Section>('other'); const [route, setRoute] = useState<RouteId>(routes[0]?.id || 'R1');
  const [pay, setPay] = useState<LeaveType['pay']>('paid'); const [unit, setUnit] = useState<LeaveType['unit']>('day'); const [balance, setBalance] = useState<NonNullable<LeaveType['balance']>>('none'); const [icon, setIcon] = useState<string>('leave'); const [tone, setTone] = useState('g-teal'); const [err, setErr] = useState('');
  /* v0.8: متى يتاح النوع يُضبط هنا من البداية (مثل «كونوا معهم») ويُستكمل في المحرر */
  const [availP, setAvailP] = useState<Partial<LeaveType>>({});
  const previewType: LeaveType = { id: 'new', section, name: { ar: ar.trim() || (lang === 'ar' ? 'النوع الجديد' : 'New type'), en: en.trim() || 'New type' }, icon, tone, route, pay, unit, balance, enabled: true, guidance: { ar: '', en: '' }, ...availP };
  const create = () => {
    if (!ar.trim() || !en.trim()) { setErr(t.policy.nameRequired); return; }
    let n = existing.length + 1; let id = `t${n}`; while (existing.includes(id)) { n += 1; id = `t${n}`; }
    const label = availP.dateWindow?.label && (availP.dateWindow.label.ar || availP.dateWindow.label.en) ? availP.dateWindow.label : { ar: ar.trim(), en: en.trim() };
    const avail: Partial<LeaveType> = { ...availP, ...(availP.dateWindow ? { dateWindow: { ...availP.dateWindow, label } } : {}) };
    onCreate({ id, section, name: { ar: ar.trim(), en: en.trim() }, icon, tone, route, pay, unit, balance, windowAfterEnd: null, advanceMin: null, maxPerRequest: null, enabled: true, guidance: { ar: '', en: '' }, erp, ...avail });
  };
  const seg = <T extends string>(val: T, opts: { v: T; label: string }[], set: (v: T) => void, id: string) => <div className="segmented wrap">{opts.map((o) => <button key={o.v} type="button" aria-pressed={val === o.v} onClick={() => set(o.v)}>{val === o.v ? <motion.span className="seg-thumb" layoutId={`nt-${id}`} transition={SPRING.snappy} /> : null}<span className="seg-txt">{o.label}</span></button>)}</div>;
  return (
    <div className="type-editor">
      <Group>
        <Field id="nt-erp" label={t.policy.erpPick} hint={t.policy.erpPickHint}><ErpTypeSelect id="nt-erp" value={erp} types={types} editable onChange={(link, et) => { setErp(link); if (et && (auto || (!ar.trim() && !en.trim()))) { setAr(et.name.ar); setEn(et.name.en); setAuto(true); } }} /></Field>
        {!erp ? <Notice tone="warn" icon="alert">{t.policy.erpWarnType}</Notice> : null}
        <Field id="nt-ar" label={t.policy.typeName} error={err && !ar.trim() ? err : undefined}><input id="nt-ar" dir="rtl" value={ar} onChange={(e) => { setAr(e.target.value); setAuto(false); setErr(''); }} placeholder={lang === 'ar' ? 'مثال: إجازة دراسية' : 'e.g. إجازة دراسية'} /></Field>
        <Field id="nt-en" label={t.policy.typeNameEn} error={err && !en.trim() ? err : undefined}><input id="nt-en" dir="ltr" value={en} onChange={(e) => { setEn(e.target.value); setAuto(false); setErr(''); }} placeholder="e.g. Study leave" /></Field>
        <div className="cell stacked"><span className="cell-title">{t.policy.field.section}</span>{seg(section, SECTIONS.map((sec) => ({ v: sec, label: t.leave.sections[sec] })), setSection, 'sec')}</div>
        <div className="cell stacked"><span className="cell-title">{t.policy.field.route}</span>{seg(route, routes.map((r) => ({ v: r.id, label: tx(r.name) })), setRoute, 'route')}</div>
        <div className="cell stacked"><span className="cell-title">{t.policy.field.pay}</span>{seg(pay, [{ v: 'paid' as const, label: t.leave.paid }, { v: 'partial' as const, label: t.leave.partial }, { v: 'unpaid' as const, label: t.leave.unpaid }], setPay, 'pay')}</div>
        <div className="cell stacked"><span className="cell-title">{t.policy.field.unit} · {t.policy.field.balance}</span><div className="ed-row" style={{ padding: 0 }}><label><span>{t.policy.field.unit}</span>{seg(unit, [{ v: 'day' as const, label: t.policy.field.unitDay }, { v: 'halfday' as const, label: t.policy.field.unitHalf }], setUnit, 'unit')}</label><label><span>{t.policy.field.balance}</span>{seg(balance, [{ v: 'none' as const, label: lang === 'ar' ? 'بلا رصيد' : 'No balance' }, { v: 'annual' as const, label: t.me.annual }, { v: 'emergency' as const, label: t.me.emergency }], setBalance, 'bal')}</label></div></div>
        <div style={{ padding: '6px 16px 12px' }}><IconTonePicker icon={icon} tone={tone} editable onChange={(p) => { if (p.icon) setIcon(p.icon); if (p.tone) setTone(p.tone); }} /></div>
      </Group>
      <div className="section-label"><span>{t.policy.avail.title}</span></div>
      <AvailabilityEditor tp={previewType} editable compact onChange={(patch) => setAvailP((a) => ({ ...a, ...patch }))} />
      <div style={{ height: 12 }} />
      <motion.button type="button" className="btn primary block lg" onClick={create} whileTap={{ scale: 0.97 }}><I.plus />{t.policy.createType}</motion.button>
      <p className="hint-line" style={{ paddingTop: 10 }}>{t.policy.newTypeHint}</p>
    </div>
  );
}

/** التشغيل: النوافذ الموسمية ومجموعات الاستحقاق — تسري فوراً بلا إصدار جديد وتُسجَّل */
function Ops({ content, isAdmin }: { content: PolicyContent; isAdmin: boolean }) {
  const { state, dispatch } = useStore(); const { lang, t, tx } = useLang(); const me = usePerson(); const toast = useToast();
  const today = toISO(Date.now());
  const seasonal = content.types.filter((x) => x.seasonal);
  const groupEnts = content.entitlements.filter((e) => e.eligibility === 'scope'); const gnames = useGroupNames();
  const employees = state.people.filter((p) => p.positionId && p.persona !== 'admin');
  const [draft, setDraft] = useState<Record<string, { open: boolean; from: string; to: string }>>({});
  const winOf = (id: string) => draft[id] || { open: !!state.policy.windows[id]?.open, from: state.policy.windows[id]?.from || '', to: state.policy.windows[id]?.to || '' };
  const applyWin = (id: string, name: string) => { const w = winOf(id); dispatch({ type: 'policyWindow', typeId: id, window: { open: w.open, from: w.from || undefined, to: w.to || undefined }, by: me.id }); setDraft((d) => { const n = { ...d }; delete n[id]; return n; }); toast({ title: w.open ? (lang === 'ar' ? `فُتحت نافذة ${name}` : `${name} window opened`) : (lang === 'ar' ? `أُقفلت نافذة ${name}` : `${name} window closed`), icon: w.open ? 'calendar' : 'x', tone: w.open ? 'ok' : 'warn' }); };
  const toggleMember = (gid: string, pid: string) => { const cur = state.policy.groups[gid] || []; const next = cur.includes(pid) ? cur.filter((x) => x !== pid) : [...cur, pid]; dispatch({ type: 'policyGroup', groupId: gid, members: next, by: me.id }); };
  /* v0.7 إقفال الفترة: تاريخ وسبب ومرجع؛ يسري فوراً ويمنع الطلبات والإلغاءات بتواريخ في الفترة */
  const pc = state.policy.periodClose; const [pcForm, setPcForm] = useState({ until: pc?.until || '', reason: pc?.reason || '', reference: pc?.reference || '' });
  const inflight = inflightInPeriod(state, pcForm.until);
  /* v0.8 (D-015): أقرب إقفال آمن — بعد انقضاء أطول نافذة تقديم بعد الوقوع في الأنواع المفعّلة */
  const safe = pcForm.until ? safeCloseDate(content, pcForm.until) : ''; const aet = afterEndTypes(content); const maxWin = Math.max(0, ...aet.map((x) => x.windowAfterEnd || 0));
  const closePeriod = () => { if (!pcForm.until || !pcForm.reason.trim()) return; dispatch({ type: 'policyPeriodClose', close: { until: pcForm.until, reason: pcForm.reason.trim(), reference: pcForm.reference.trim() }, by: me.id }); toast({ title: t.policy.close.closedToast, sub: `${t.policy.close.until} ${pcForm.until}`, icon: 'lock', tone: 'warn' }); };
  const openPeriod = () => { dispatch({ type: 'policyPeriodClose', close: null, by: me.id }); setPcForm({ until: '', reason: '', reference: '' }); toast({ title: t.policy.close.openedToast, icon: 'check', tone: 'ok' }); };
  const closer = pc ? state.people.find((p) => p.id === pc.by) : undefined;
  return (
    <Stagger>
      <Item><Notice icon="info">{t.policy.opsHint}</Notice></Item>
      <div className="section-label"><span>{t.policy.close.title}</span></div>
      <Group foot={t.policy.close.hint} className="period-close">
        <div className="cell"><span className={`cell-lead ${pc ? 'warn' : 'ok'}`}>{pc ? <I.lock /> : <I.check />}</span><span className="cell-main"><span className="cell-title">{pc ? `${t.policy.close.closedUntil} ${pc.until}` : t.policy.close.open}</span>{pc ? <span className="cell-sub">{pc.reason}{pc.reference ? ` · ${pc.reference}` : ''} · {t.policy.close.by} {closer ? (lang === 'ar' ? closer.name : closer.nameEn) : pc.by} · {fmtDate(pc.at, lang, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span> : null}</span>{pc ? <Pill tone="warn" icon="lock">{t.policy.close.closedUntil} <span className="num">{pc.until}</span></Pill> : <Pill tone="ok" icon="check">{t.policy.close.open}</Pill>}</div>
        {isAdmin ? (
          <div className="ed-row" style={{ padding: '12px 16px', alignItems: 'end' }}>
            <label><span>{t.policy.close.until}</span><input id="pc-until" type="date" className="num" dir="ltr" value={pcForm.until} onChange={(e) => setPcForm((f) => ({ ...f, until: e.target.value }))} /></label>
            <label style={{ flex: 2 }}><span>{t.policy.close.reason}</span><input id="pc-reason" value={pcForm.reason} onChange={(e) => setPcForm((f) => ({ ...f, reason: e.target.value }))} placeholder={lang === 'ar' ? 'مثال: صُدِّر تقرير حضور شهر مايو' : 'e.g. May attendance report exported'} /></label>
            <label><span>{t.policy.close.reference}</span><input id="pc-ref" value={pcForm.reference} onChange={(e) => setPcForm((f) => ({ ...f, reference: e.target.value }))} /></label>
            <span className="kbd-row" style={{ padding: 0 }}><motion.button type="button" className="btn primary" disabled={!pcForm.until || !pcForm.reason.trim() || (pc?.until === pcForm.until && pc?.reason === pcForm.reason && pc?.reference === pcForm.reference)} onClick={closePeriod} whileTap={{ scale: 0.97 }}><I.lock />{t.policy.close.apply}</motion.button>{pc ? <motion.button type="button" className="btn secondary" onClick={openPeriod} whileTap={{ scale: 0.97 }}><I.x />{t.policy.close.reopen}</motion.button> : null}</span>
          </div>
        ) : null}
        {pcForm.until && safe ? <div className="cell"><span className={`cell-lead ${today < safe ? 'warn' : 'ok'}`}>{today < safe ? <I.alert /> : <I.check />}</span><span className="cell-main"><span className="cell-title">{t.policy.close.safeTitle}: <span className="num">{safe}</span></span><span className="cell-sub">{today < safe ? fill(t.policy.close.safeHint, { n: maxWin, types: aet.map((x) => tx(x.name)).join(lang === 'ar' ? '، ' : ', '), until: pcForm.until, date: safe }) : t.policy.close.safeOk}</span></span></div> : null}
        {pcForm.until ? <div className="cell stacked inflight"><span className="cell-title"><I.clock /> {t.policy.close.inflightList} <span className="num">{inflight.length}</span></span>{inflight.length ? <><span className="cell-sub">{t.policy.close.inflightHint}</span>{inflight.map((r) => { const p = personById(state, r.requesterId); const cur = r.steps.find((x) => x.status === 'current'); return <div key={r.id} className="inflight-row"><Avatar p={p} size="sm" /><span className="cell-main"><span className="cell-title">{p ? (lang === 'ar' ? p.name : p.nameEn) : r.requesterId} · {tx(requestTitle(r))}</span><span className="cell-sub"><span className="mono">{r.id}</span> · <bdi dir="ltr" className="num">{r.leave?.from} → {r.leave?.to}</bdi>{cur ? ` · ${t.policy.close.waitingAt} ${tx(cur.title)}` : ''}</span></span></div>; })}</> : <span className="cell-sub">{t.policy.close.inflightNone}</span>}</div> : null}
      </Group>
      <div style={{ height: 8 }} /><Notice tone="tint" icon="lock">{t.policy.close.lockRule}</Notice>
      <div className="section-label"><span>{t.policy.windows}</span></div>
      <Group>
        {seasonal.map((tp) => { const w = winOf(tp.id); const live = state.policy.windows[tp.id]; const isOpen = windowOpen(live, today); const dirty = !!draft[tp.id]; return (
          <Item key={tp.id}><div className="cell stacked">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><span className={`qicon ${tp.tone}`}>{React.createElement(I[tp.icon as keyof typeof I] || I.leave)}</span><span className="cell-main"><span className="cell-title">{tx(tp.name)} · {tx(tp.dateWindow?.label || tp.name)}</span><span className="cell-sub">{isOpen ? <Pill tone="ok" icon="check">{t.policy.windowOpen}</Pill> : <Pill tone="warn" icon="clock">{t.policy.windowClosed}</Pill>}{live?.from ? <> · {t.policy.lastWindow}: <span className="num">{live.from}</span> → <span className="num">{live.to || '…'}</span></> : null}</span></span><input className="switch" type="checkbox" checked={w.open} disabled={!isAdmin} onChange={(e) => setDraft((d) => ({ ...d, [tp.id]: { ...w, open: e.target.checked } }))} /></div>
            <div className="ed-row">
              <label><span>{t.leave.from}</span><input type="date" className="num" dir="ltr" value={w.from} disabled={!isAdmin} onChange={(e) => setDraft((d) => ({ ...d, [tp.id]: { ...w, from: e.target.value } }))} /></label>
              <label><span>{t.leave.to}</span><input type="date" className="num" dir="ltr" value={w.to} disabled={!isAdmin} onChange={(e) => setDraft((d) => ({ ...d, [tp.id]: { ...w, to: e.target.value } }))} /></label>
              {isAdmin ? <motion.button type="button" className="btn soft" disabled={!dirty} onClick={() => applyWin(tp.id, tx(tp.name))} whileTap={{ scale: 0.97 }}><I.check />{t.policy.apply}</motion.button> : null}
            </div>
          </div></Item>
        ); })}
      </Group>
      <div className="section-label"><span>{t.policy.groups}</span></div>
      {groupEnts.map((e) => { const members = state.policy.groups[e.id] || []; return (
        <Item key={e.id}><Group foot={lang === 'ar' ? `${members.length} ${t.policy.members} · ${tx(e.name)}: ${e.minDays} ${lang === 'ar' ? 'يوماً فأكثر من الإجازة السنوية' : ''}` : `${members.length} members · ${tx(e.name)}: ${e.minDays}+ days of annual leave`}>
          <div className="cell"><span className="cell-lead gold"><I.seal /></span><span className="cell-main"><span className="cell-title">{tx(e.name)}</span><span className="cell-sub">{lang === 'ar' ? `النطاق من الإصدار: ${[...(e.scope?.groups || []).map(gnames.group), ...(e.scope?.subgroups || []).map(gnames.subgroup)].join('، ') || 'الجميع'}؛ وهنا استثناءات فوق النطاق تسري فوراً` : `Scope from the version: ${[...(e.scope?.groups || []).map(gnames.group), ...(e.scope?.subgroups || []).map(gnames.subgroup)].join(', ') || 'everyone'}; exceptions added here apply immediately`}</span></span></div>
          {employees.map((p) => { const on = members.includes(p.id); return (
            <div key={p.id} className="cell"><Avatar p={p} tone={on ? '' : 'gold'} /><span className="cell-main"><span className="cell-title">{lang === 'ar' ? p.name : p.nameEn}</span><span className="cell-sub">{lang === 'ar' ? p.title : p.titleEn} · {gnames.group(p.group || '')}{e.scope?.groups?.includes(p.group || '') ? ` · ${lang === 'ar' ? 'مستحق بالنطاق' : 'entitled by scope'}` : ''}</span></span><input className="switch" type="checkbox" checked={on || !!e.scope?.groups?.includes(p.group || '')} disabled={!isAdmin || !!e.scope?.groups?.includes(p.group || '')} onChange={() => toggleMember(e.id, p.id)} /></div>
          ); })}
        </Group></Item>
      ); })}
      <div className="section-label"><span>{t.policy.opsLog}</span></div>
      <Group>
        {state.policy.opsLog.length === 0 ? <div className="empty"><span className="ic"><I.doc /></span><b>{t.policy.noChanges}</b></div> : state.policy.opsLog.slice(0, 12).map((c, i) => { const who = state.people.find((p) => p.id === c.by); return <Item key={i}><Cell lead={<Avatar p={who} size="sm" />} title={tx(c.what)} sub={`${who ? (lang === 'ar' ? who.name : who.nameEn) : c.by} · ${fmtDate(c.at, lang, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}${c.detail ? ` · ${c.detail}` : ''}`} chevron={false} /></Item>; })}
      </Group>
    </Stagger>
  );
}

function Simulator({ content, versionNumber }: { content: PolicyContent; versionNumber: string }) {
  const { state } = useStore(); const { lang, t, tx } = useLang(); const gnames = useGroupNames();
  const people = state.people.filter((p) => p.positionId);
  const [pid, setPid] = useState(people[0]?.id || ''); const [tid, setTid] = useState(content.types[0]?.id || ''); const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [ran, setRan] = useState(false);
  const person = state.people.find((p) => p.id === pid) || people[0]; const type = content.types.find((x) => x.id === tid) || content.types[0];
  const ev = ran && person && type ? evaluateLeave({ content, person, type, from, to, today: toISO(Date.now()), absences: state.absences, balances: state.balances[person.id], ops: state.policy }) : null;
  /* المسار المستخرج من الهيكل لهذا الموظف: الأشخاص وسبب كل واحد وما تُخطي ولماذا (ق.م-11)، مع تنفيذ الاستحقاقات التي يستحقها */
  const built = ev && person && type ? leaveSteps(state, person, content, type.route, { typeId: type.id, from, to, days: ev.days, workingDays: ev.workingDays, entitlements: ev.entitlements.map((x) => x.e.id) }, Date.now(), gnames) : null;
  return (
    <div>
      <Group>
        <div className="ed-row" style={{ padding: '12px 16px' }}>
          <label><span>{t.policy.simFor}</span><select className="select-in" value={pid} onChange={(e) => { setPid(e.target.value); setRan(false); }}>{people.map((p) => <option key={p.id} value={p.id}>{lang === 'ar' ? p.name : p.nameEn} · {gnames.group(p.group || '')}</option>)}</select></label>
          <label><span>{t.policy.simType}</span><select className="select-in" value={tid} onChange={(e) => { setTid(e.target.value); setRan(false); }}>{content.types.map((x) => <option key={x.id} value={x.id}>{tx(x.name)}</option>)}</select></label>
        </div>
        <div className="ed-row" style={{ padding: '0 16px 12px' }}>
          <label><span>{t.leave.from}</span><input type="date" className="num" dir="ltr" value={from} onChange={(e) => { setFrom(e.target.value); setRan(false); }} /></label>
          <label><span>{t.leave.to}</span><input type="date" className="num" dir="ltr" value={to} onChange={(e) => { setTo(e.target.value); setRan(false); }} /></label>
          <motion.button type="button" className="btn primary" disabled={!from || !to} onClick={() => setRan(true)} whileTap={{ scale: 0.97 }}><I.sparkle />{t.policy.simRun}</motion.button>
        </div>
      </Group>
      <AnimatePresence>
        {ev && person && built && (
          <motion.div key={`${pid}-${tid}-${from}-${to}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={SPRING.soft}>
            <div className="section-head"><h2>{t.policy.simResult}</h2><span className="kbd-row" style={{ padding: 0 }}><Pill tone="tint">{versionNumber}</Pill><EvalBadge ev={ev} /></span></div>
            <div className="tiles"><div className="tile"><b className="num">{ev.days}</b><span>{t.leave.calendarDays}</span></div><div className="tile"><b className="num">{ev.workingDays}</b><span>{t.leave.workingDays}</span></div>{ev.balanceAfter !== undefined ? <div className={`tile ${ev.balanceAfter < 0 ? 'bad' : 'soft'}`}><b className="num"><bdi dir="ltr">{ev.balanceAfter}</bdi></b><span>{t.leave.balance} {t.leave.after}</span></div> : <div className="tile soft"><b className="num">{built.steps.length}</b><span>{lang === 'ar' ? 'خطوات' : 'steps'}</span></div>}</div>
            <div style={{ height: 12 }} />
            <Checks checks={ev.checks} />
            {ev.sick ? <><div style={{ height: 12 }} /><Group><div style={{ padding: '12px 14px' }}><div className="section-label" style={{ padding: '0 0 8px' }}><span>{t.leave.cycle} · {gnames.group(person.group || '')}{person.subgroup ? ` · ${gnames.subgroup(person.subgroup)}` : ''}</span></div><TierBar sick={ev.sick} days={ev.days} /></div></Group></> : null}
            <div className="section-label"><span>{t.policy.simRoute}</span></div>
            <Group><div style={{ padding: '12px 14px' }} className="sim-route"><RoutePreview steps={built.steps} requester={person} notApplied={built.notApplied} /></div></Group>
            <div style={{ height: 8 }} />
            <div className="kbd-row" style={{ padding: 0 }}><Avatar p={person} size="sm" /><span className="cell-sub">{lang === 'ar' ? person.name : person.nameEn} · {tx(positionById(state, person.positionId)?.title)} · {gnames.group(person.group || '')}{person.subgroup ? ` · ${gnames.subgroup(person.subgroup)}` : ''} · {t.leave.location[person.location || 'riyadh']}{worksOutsideHome(person) ? (lang === 'ar' ? ' · يعمل خارج موطنه' : ' · works outside home country') : ''}</span></div>
          </motion.div>
        )}
      </AnimatePresence>
      {!ran ? <p className="hint-line" style={{ paddingTop: 10 }}>{t.policy.simHint}</p> : null}
      <p className="demo-band">{lang === 'ar' ? 'محاكاة على بيانات تجريبية؛ لا تُنشئ طلباً.' : 'Simulation on demo data; creates no request.'}</p>
    </div>
  );
}

/* ——— محرر المسار: خطوات بقواعد الاستخراج الخمس والنصاب والشروط والمهل والتصعيد (CAP-01 §2) ——— */
const AGENT_KINDS: AgentKind[] = ['lineManager', 'orgHead', 'chain', 'positions', 'pool'];
const COND_FIELDS: StepCondition['field'][] = ['days', 'workingDays', 'group', 'subgroup', 'location'];
function RouteEditor({ route, content, editable, isNew, onChange, onRename, onAssign }: { route: Route; content: PolicyContent; editable: boolean; isNew?: boolean; onChange: (steps: RouteStep[]) => void; onRename: (name: { ar: string; en: string }) => void; onAssign?: (typeId: string) => void }) {
  const { state } = useStore(); const { lang, t, tx } = useLang(); const pnames = namesFor(state); const gnames = useGroupNames();
  const types = content.types.filter((x) => x.route === route.id);
  const upd = (i: number, patch: Partial<RouteStep>) => onChange(route.steps.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const move = (i: number, d: -1 | 1) => { const j = i + d; if (j < 0 || j >= route.steps.length) return; const arr = route.steps.slice(); [arr[i], arr[j]] = [arr[j], arr[i]]; onChange(arr); };
  const units = state.org.units; const positions = state.org.positions;
  const unitName = (id?: string) => tx(unitById(state, id)?.name || { ar: id || '', en: id || '' });
  const posLabel = (p: Position) => `${tx(p.title)} · ${unitName(p.unitId)}`;
  const sortedPositions = positions.slice().sort((a, b) => units.findIndex((u) => u.id === a.unitId) - units.findIndex((u) => u.id === b.unitId));
  const condValueCtl = (i: number, c: StepCondition) => {
    if (c.field === 'group') return <select className="select-in" value={String(c.value)} disabled={!editable} onChange={(e) => upd(i, { when: { ...c, value: e.target.value } })}>{state.groups.map((g) => <option key={g.id} value={g.id}>{tx(g.name)}</option>)}</select>;
    if (c.field === 'subgroup') return <select className="select-in" value={String(c.value)} disabled={!editable} onChange={(e) => upd(i, { when: { ...c, value: e.target.value } })}>{state.groups.flatMap((g) => g.subgroups).map((g) => <option key={g.id} value={g.id}>{tx(g.name)}</option>)}</select>;
    if (c.field === 'location') return <select className="select-in" value={String(c.value)} disabled={!editable} onChange={(e) => upd(i, { when: { ...c, value: e.target.value } })}>{(['riyadh', 'abudhabi'] as const).map((l) => <option key={l} value={l}>{t.leave.location[l]}</option>)}</select>;
    return <input className="num-in num" type="number" min={0} value={Number(c.value) || 0} disabled={!editable} onChange={(e) => upd(i, { when: { ...c, value: Number(e.target.value) } })} />;
  };
  return (
    <Group className="route-ed">
      <div className="cell"><span className="cell-lead"><I.team /></span><span className="cell-main">{editable ? <input className="inline-in" value={lang === 'ar' ? route.name.ar : route.name.en} onChange={(e) => onRename(lang === 'ar' ? { ...route.name, ar: e.target.value } : { ...route.name, en: e.target.value })} /> : <span className="cell-title">{tx(route.name)}</span>}<span className="cell-sub">{route.id} · {t.policy.usesRoute}: <b className="num">{types.length}</b></span><LastChange head="routes" id={route.id} history={t.policy.hist.route} newInDraft={isNew} /></span></div>
      {/* v0.7: الأنواع التي تتبع هذا المسار رقاقاتٌ؛ الضغط على نوع (في المسودة) يُسنده إلى هذا المسار */}
      <div className="rt-types chips">{content.types.filter((x) => x.enabled).map((x) => { const on = x.route === route.id; return <button key={x.id} type="button" className={`pill ${on ? 'tint' : ''}`} aria-pressed={on} disabled={!editable || on || !onAssign} onClick={() => onAssign?.(x.id)}>{on ? <I.check /> : <I.plus />}{tx(x.name)}</button>; })}{!types.length ? <span className="cell-sub">{t.policy.noTypes}</span> : null}</div>
      <ol className="rt-steps v6">
        {route.steps.map((s, i) => { const a = s.agent; const isNotify = s.mode === 'notify'; const c = s.when; const esc = s.escalation; return (
          <li key={i} className={`rt-step ${s.mode}`}>
            <div className="rt-head"><span className="rp-n num">{i + 1}</span><b className="rt-title">{tx(s.title || stepTitle(s, pnames))}</b>
              {editable ? <span className="rt-tools"><button type="button" className="icon-btn" aria-label={t.policy.step.up} disabled={i === 0} onClick={() => move(i, -1)}><I.chev className="rot-up" /></button><button type="button" className="icon-btn" aria-label={t.policy.step.down} disabled={i === route.steps.length - 1} onClick={() => move(i, 1)}><I.chev className="rot-down" /></button><button type="button" className="icon-btn" aria-label={t.policy.step.remove} onClick={() => onChange(route.steps.filter((_, k) => k !== i))}><I.x /></button></span> : null}
            </div>
            <div className="ed-row">
              <label><span>{t.policy.step.mode}</span><div className="segmented sm">{(['approve', 'notify', 'fulfil'] as const).map((m) => <button key={m} type="button" aria-pressed={s.mode === m} disabled={!editable} onClick={() => upd(i, { mode: m, slaHours: m === 'notify' ? 0 : s.slaHours || 48 })}><span className="seg-txt">{t.policy.step[m]}</span></button>)}</div></label>
              <label><span>{t.policy.step.agent}</span><select className="select-in" value={a.kind} disabled={!editable} onChange={(e) => { const k = e.target.value as AgentKind; upd(i, { agent: k === 'orgHead' ? { kind: k, level: 'department' } : k === 'chain' ? { kind: k, upTo: 'ga' } : k === 'positions' ? { kind: k, positionIds: [], quorum: 'any' } : k === 'pool' ? { kind: k, unitId: 'O-211' } : { kind: k } }); }}>{AGENT_KINDS.map((k) => <option key={k} value={k}>{tx(AGENT_KIND_TITLE[k])}</option>)}</select></label>
              {a.kind === 'orgHead' ? <label><span>{t.policy.step.level}</span><select className="select-in" value={a.level || 'department'} disabled={!editable} onChange={(e) => upd(i, { agent: { ...a, level: e.target.value as OrgLevel } })}>{ORG_LEVELS.map((l) => <option key={l} value={l}>{tx(LEVEL_HEAD[l])} ({tx(LEVEL_TITLE[l])})</option>)}</select></label> : null}
              {a.kind === 'chain' ? <label><span>{t.policy.step.upTo}</span><select className="select-in" value={a.upTo || 'ga'} disabled={!editable} onChange={(e) => upd(i, { agent: { ...a, upTo: e.target.value as OrgLevel } })}>{ORG_LEVELS.map((l) => <option key={l} value={l}>{tx(LEVEL_HEAD[l])}</option>)}</select></label> : null}
              {a.kind === 'pool' ? <label><span>{t.policy.step.pool}</span><select className="select-in" value={a.unitId || ''} disabled={!editable} onChange={(e) => upd(i, { agent: { ...a, unitId: e.target.value } })}>{units.map((u) => <option key={u.id} value={u.id}>{tx(u.name)} · {u.id}</option>)}</select></label> : null}
              {!isNotify ? <label><span>{t.policy.step.sla}</span><input className="num-in num" type="number" min={1} value={s.slaHours} disabled={!editable} onChange={(e) => upd(i, { slaHours: Number(e.target.value) })} /></label> : null}
            </div>
            {a.kind === 'positions' ? (
              <div className="ed-row">
                <label style={{ flex: 3 }}><span>{t.policy.step.positions}</span><span className="chips">{(a.positionIds || []).map((id) => { const p = positionById(state, id); const h = holderOf(state, id); return <span key={id} className={`pill ${h ? 'tint' : 'warn'}`}>{p ? tx(p.title) : id}{h ? ` — ${lang === 'ar' ? h.name : h.nameEn}` : ` — ${t.policy.vacant}`}{editable ? <button type="button" className="chip-x" aria-label="remove" onClick={() => upd(i, { agent: { ...a, positionIds: (a.positionIds || []).filter((x) => x !== id) } })}>×</button> : null}</span>; })}
                  {editable ? <select className="select-in" value="" onChange={(e) => { const id = e.target.value; if (!id || (a.positionIds || []).includes(id)) return; upd(i, { agent: { ...a, positionIds: [...(a.positionIds || []), id] } }); }}><option value="">{t.policy.step.addPosition}</option>{sortedPositions.map((p) => <option key={p.id} value={p.id}>{posLabel(p)} · {p.id}</option>)}</select> : null}</span></label>
                {(a.positionIds || []).length > 1 ? <label><span>{t.policy.step.quorum}</span><div className="segmented sm">{(['any', 'all'] as const).map((q) => <button key={q} type="button" aria-pressed={(a.quorum || 'any') === q} disabled={!editable} onClick={() => upd(i, { agent: { ...a, quorum: q } })}><span className="seg-txt">{t.policy.step[q]}</span></button>)}</div></label> : null}
              </div>
            ) : null}
            <div className="ed-row rt-cond">
              <label><span>{t.policy.step.when}</span><select className="select-in" value={c ? c.field : ''} disabled={!editable} onChange={(e) => { const f = e.target.value as StepCondition['field'] | ''; upd(i, { when: f === '' ? undefined : { field: f, op: f === 'group' || f === 'subgroup' || f === 'location' ? 'eq' : 'gt', value: f === 'group' ? state.groups[0]?.id || '' : f === 'subgroup' ? state.groups[0]?.subgroups[0]?.id || '' : f === 'location' ? 'riyadh' : 30 } }); }}><option value="">{t.policy.step.always}</option>{COND_FIELDS.map((f) => <option key={f} value={f}>{t.policy.step[f]}</option>)}</select></label>
              {c ? <label><span>{t.policy.step.op}</span><select className="select-in" value={c.op} disabled={!editable} onChange={(e) => upd(i, { when: { ...c, op: e.target.value as StepCondition['op'] } })}>{(c.field === 'days' || c.field === 'workingDays' ? (['gt', 'gte', 'lt', 'lte', 'eq'] as const) : (['eq', 'in'] as const)).map((o) => <option key={o} value={o}>{t.policy.step[o]}</option>)}</select></label> : null}
              {c ? <label><span>{t.policy.step.value}</span>{c.op === 'in' ? <input value={Array.isArray(c.value) ? c.value.join(',') : String(c.value)} disabled={!editable} onChange={(e) => upd(i, { when: { ...c, value: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) } })} /> : condValueCtl(i, c)}</label> : null}
              {c ? <span className="cell-sub rt-reads">{t.policy.step.reads}: {conditionText(c, lang, gnames)}</span> : null}
            </div>
            {!isNotify ? (
              <div className="ed-row rt-esc">
                <label><span>{t.policy.step.remindAt}</span><input className="num-in num" type="number" min={10} max={100} value={esc?.remindAtPct ?? 80} disabled={!editable} onChange={(e) => upd(i, { escalation: { remindAtPct: Number(e.target.value), after: esc?.after || 'remind', moveToPositionId: esc?.moveToPositionId } })} /></label>
                <label><span>{t.policy.step.escalation}</span><select className="select-in" value={esc?.after || 'remind'} disabled={!editable} onChange={(e) => upd(i, { escalation: { remindAtPct: esc?.remindAtPct ?? 80, after: e.target.value as Escalation['after'], moveToPositionId: esc?.moveToPositionId } })}>{(['remind', 'notifyManager', 'moveTo'] as const).map((o) => <option key={o} value={o}>{t.policy.step[o]}</option>)}</select></label>
                {esc?.after === 'moveTo' ? <label><span>{t.policy.step.moveTo}</span><select className="select-in" value={esc.moveToPositionId || ''} disabled={!editable} onChange={(e) => upd(i, { escalation: { ...esc, moveToPositionId: e.target.value } })}><option value="">—</option>{sortedPositions.map((p) => <option key={p.id} value={p.id}>{posLabel(p)}</option>)}</select></label> : null}
              </div>
            ) : null}
          </li>
        ); })}
        <li className="rt-step sys"><span className="rp-n num">{route.steps.length + 1}</span><span className="rt-desk">{t.desks.system}</span><span className="cell-sub">{t.policy.readOnly}</span></li>
      </ol>
      {editable ? <div className="kbd-row"><button type="button" className="btn quiet" onClick={() => onChange([...route.steps, { agent: { kind: 'lineManager' }, mode: 'approve', slaHours: 48, escalation: { remindAtPct: 80, after: 'notifyManager' } }])}><I.plus />{t.policy.step.addStep}</button></div> : null}
    </Group>
  );
}

/* ——— الهيكل والمناصب: شجرة الوحدات ومناصبها وشاغليها كما تُقرأ من النظام المرجعي؛ وتغيير الشاغل محاكاةً لما يصل منه ——— */
function OrgTab({ isAdmin }: { isAdmin: boolean }) {
  const { state, dispatch } = useStore(); const { lang, t, tx } = useLang(); const toast = useToast();
  const units = state.org.units; const positions = state.org.positions;
  const children = (id?: string) => units.filter((u) => u.parentId === id);
  const roots = units.filter((u) => !u.parentId || !units.some((x) => x.id === u.parentId));
  const nm = (id?: string) => { const p = id ? state.people.find((x) => x.id === id) : undefined; return p ? (lang === 'ar' ? p.name : p.nameEn) : ''; };
  const setHolder = (pos: Position, personId: string) => { dispatch({ type: 'orgHolder', positionId: pos.id, personId: personId || undefined }); toast({ title: t.policy.holderChanged, sub: `${tx(pos.title)} → ${personId ? nm(personId) : t.policy.vacant}`, icon: 'team', tone: 'info' }); };
  const holderCtl = (pos: Position) => (isAdmin ? <select className="select-in sm" value={pos.holderId || ''} onChange={(e) => setHolder(pos, e.target.value)} aria-label={t.policy.changeHolder}><option value="">— {t.policy.vacant}</option>{state.people.slice().sort((a, b) => a.name.localeCompare(b.name)).map((p) => <option key={p.id} value={p.id}>{lang === 'ar' ? p.name : p.nameEn}</option>)}</select> : null);
  const posRow = (pos: Position, chief: boolean) => { const h = holderOf(state, pos.id); const r = !h ? resolveHolder(state, pos.id) : undefined; const via = r && r.personId ? state.people.find((x) => x.id === r.personId) : undefined; return (
    <div key={pos.id} className={`cell org-pos ${chief ? 'chief' : ''} ${h ? '' : 'vacant'}`}>
      {h ? <Avatar p={h} size="sm" /> : <span className="avatar sm warn">—</span>}
      <span className="cell-main"><span className="cell-title">{tx(pos.title)} <span className="mono dim">{pos.id}</span>{chief ? <Pill tone="tint">{t.policy.chief}</Pill> : null}</span>
        <span className="cell-sub">{h ? `${lang === 'ar' ? h.name : h.nameEn} · ${lang === 'ar' ? h.title : h.titleEn}` : <><Pill tone="warn">{t.policy.vacant}</Pill> {pos.deputyPositionId ? `${t.policy.deputy}: ${tx(positionById(state, pos.deputyPositionId)?.title)}${via ? ` — ${lang === 'ar' ? via.name : via.nameEn}` : ''}` : `${t.policy.noDeputy}${via ? ` · ${lang === 'ar' ? 'يقوم مقامه' : 'acting'}: ${lang === 'ar' ? via.name : via.nameEn}` : ''}`}</>}</span></span>
      <span className="cell-trail">{holderCtl(pos)}</span>
    </div>
  ); };
  const unitBlock = (u: OrgUnit, depth: number): React.ReactNode => { const chief = positions.find((p) => p.id === u.chiefPositionId); const others = positions.filter((p) => p.unitId === u.id && p.id !== u.chiefPositionId); return (
    <div key={u.id} className="org-unit" style={{ ['--depth' as string]: depth }}>
      <div className="org-head"><span className={`cell-lead ${u.level === 'section' ? 'plain' : u.level === 'department' ? '' : 'gold'}`}><I.grid /></span><span className="cell-main"><span className="cell-title">{tx(u.name)}</span><span className="cell-sub"><Pill>{tx(LEVEL_TITLE[u.level])}</Pill> · {u.id} · {positions.filter((p) => p.unitId === u.id).length} {t.policy.positionsCount}</span></span></div>
      <Group>{chief ? posRow(chief, true) : null}{others.map((p) => posRow(p, false))}</Group>
      {children(u.id).map((c) => unitBlock(c, depth + 1))}
    </div>
  ); };
  return (
    <Stagger>
      <Item><Notice icon="info">{t.policy.orgHint}{isAdmin ? ` ${t.policy.changeHolderHint}` : ''}</Notice></Item>
      <div className="org-tree">{roots.map((u) => unitBlock(u, 0))}</div>
    </Stagger>
  );
}

/* ——— نطاق التطبيق (D-013): مجموعات ومجموعات فرعية ومقار من النظام المرجعي؛ الفارغ = الجميع ——— */
function ScopePicker({ scope, editable, onChange }: { scope?: Scope; editable: boolean; onChange: (s: Scope | undefined) => void }) {
  const { state } = useStore(); const { t, tx } = useLang();
  const sc: Scope = scope || {};
  const toggle = <K extends keyof Scope>(k: K, id: string) => { const cur = (sc[k] || []) as string[]; const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]; const out: Scope = { ...sc, [k]: next.length ? next : undefined }; onChange(out.groups || out.subgroups || out.locations ? out : undefined); };
  const chip = (k: keyof Scope, id: string, label: string) => { const on = ((sc[k] || []) as string[]).includes(id); return <button key={id} type="button" className={`pill ${on ? 'tint' : ''}`} aria-pressed={on} disabled={!editable} onClick={() => toggle(k, id)}>{on ? <I.check /> : null}{label}</button>; };
  const empty = !sc.groups?.length && !sc.subgroups?.length && !sc.locations?.length;
  return (
    <div className="scope">
      <div className="scope-row"><span>{t.policy.scopeGroups}</span><span className="chips">{state.groups.map((g) => chip('groups', g.id, tx(g.name)))}</span></div>
      <div className="scope-row"><span>{t.policy.scopeSubgroups}</span><span className="chips">{state.groups.flatMap((g) => g.subgroups).map((g) => chip('subgroups', g.id, tx(g.name)))}</span></div>
      <div className="scope-row"><span>{t.policy.scopeLocations}</span><span className="chips">{(['riyadh', 'abudhabi'] as const).map((l) => chip('locations', l, t.leave.location[l]))}</span></div>
      <span className="cell-sub">{empty ? t.policy.scopeAll : ''} {t.policy.scopeHint}</span>
    </div>
  );
}
/* ——— تنفيذ الاستحقاق (D-014): من ينفّذ، ومهمة بمرجع أم إشعار، ومتى ——— */
function FulfilEditor({ f, editable, onChange }: { f: Fulfil; editable: boolean; onChange: (f: Fulfil) => void }) {
  const { state } = useStore(); const { t, tx } = useLang();
  const units = state.org.units; const positions = state.org.positions;
  const a = f.agent;
  return (
    <div className="ed-row fulfil-ed">
      <label><span>{t.policy.ent.fulfil}</span><div className="segmented sm">{(['task', 'notify'] as const).map((m) => <button key={m} type="button" aria-pressed={f.mode === m} disabled={!editable} onClick={() => onChange({ ...f, mode: m })}><span className="seg-txt">{t.policy.ent[m]}</span></button>)}</div></label>
      <label><span>{t.policy.ent.by}</span><select className="select-in" value={a.kind === 'positions' ? 'positions' : 'pool'} disabled={!editable} onChange={(e) => onChange({ ...f, agent: e.target.value === 'positions' ? { kind: 'positions', positionIds: [], quorum: 'any' } : { kind: 'pool', unitId: 'O-121' } })}><option value="pool">{t.policy.ent.pool}</option><option value="positions">{t.policy.ent.positions}</option></select></label>
      {a.kind === 'positions' ? <label style={{ flex: 2 }}><span>{t.policy.step.positions}</span><span className="chips">{(a.positionIds || []).map((id) => { const p = positionById(state, id); return <span key={id} className="pill tint">{p ? tx(p.title) : id}{editable ? <button type="button" className="chip-x" aria-label="remove" onClick={() => onChange({ ...f, agent: { ...a, positionIds: (a.positionIds || []).filter((x) => x !== id) } })}>×</button> : null}</span>; })}{editable ? <select className="select-in" value="" onChange={(e) => { const id = e.target.value; if (!id || (a.positionIds || []).includes(id)) return; onChange({ ...f, agent: { ...a, positionIds: [...(a.positionIds || []), id] } }); }}><option value="">{t.policy.step.addPosition}</option>{positions.map((p) => <option key={p.id} value={p.id}>{tx(p.title)} · {tx(unitById(state, p.unitId)?.name)}</option>)}</select> : null}</span></label>
        : <label><span>{t.policy.step.pool}</span><select className="select-in" value={a.unitId || ''} disabled={!editable} onChange={(e) => onChange({ ...f, agent: { ...a, unitId: e.target.value } })}>{units.map((u) => <option key={u.id} value={u.id}>{tx(u.name)}</option>)}</select></label>}
      <label><span>{t.policy.ent.timing}</span><select className="select-in" value={f.timing} disabled={!editable} onChange={(e) => onChange({ ...f, timing: e.target.value as Fulfil['timing'], daysBefore: e.target.value === 'beforeStart' ? f.daysBefore || 5 : undefined })}><option value="afterApproval">{t.policy.ent.afterApproval}</option><option value="beforeStart">{t.policy.ent.beforeStart}</option></select></label>
      {f.timing === 'beforeStart' ? <label><span>{t.policy.ent.daysBefore}</span><input className="num-in num" type="number" min={0} value={f.daysBefore ?? 5} disabled={!editable} onChange={(e) => onChange({ ...f, daysBefore: Number(e.target.value) })} /></label> : null}
      {f.mode === 'task' ? <label><span>{t.policy.step.sla}</span><input className="num-in num" type="number" min={1} value={f.slaHours} disabled={!editable} onChange={(e) => onChange({ ...f, slaHours: Number(e.target.value) })} /></label> : null}
    </div>
  );
}
