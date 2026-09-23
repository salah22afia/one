import React, { useMemo, useState } from 'react';
import { useStore } from '../app/store';
import { I } from '../ui/icons';
import { Avatar, Field, Group, Notice, Pill, useLang, usePerson, useToast } from './components';
import { motion, Stagger, Item } from './motion';
import { personById, positionById, requestTitle, assigneesFor, type TaskView } from '../domain/engine';
import { needContent, needStages, needSummary, categoryOf, storeOf, entityOf, stockOf, methodOf, linesValue, SEGMENT_TITLE, poolsOf, poolOf, poolStock, canProvide, splitAlertFor, readyLines, readyQty, remainingQty, receiptProgress, inspectionNeeded, receiptSigners, type SpecInput, type ReceiptInput } from '../domain/need';
import { liveNeed, toISO } from '../domain/policy';
import { fmtDate, fill } from '../app/i18n';
import type { Request, Doc, NeedLine, NeedOffer, Person, Step, T2, NeedReceipt, ReceiptLineResult } from '../domain/types';
import { ReceiptDocument } from './Documents';

const TONE: Record<NeedLine['status'], string> = { open: '', reserved: 'tint', issued: 'ok', purchasing: 'gold', received: 'tint', delivered: 'ok', cancelled: 'danger', provided: 'tint' };
const CURRENCIES = ['SAR', 'USD', 'EUR', 'AED', 'GBP'];

/** v0.11: منتقي مرفق — اسم الملف يُحفظ في الطلب (النموذج الحي لا يرفع الملفات) */
export function FilePick({ id, label, value, onChange, required }: { id: string; label: string; value: string; onChange: (name: string) => void; required?: boolean }) {
  const { t } = useLang();
  return (
    <div className="field np-file"><span className="np-file-label">{label}{required ? '' : ` (${t.newReq.optional})`}</span>
      <label className={`btn ${value ? 'soft' : 'secondary'} sm`} style={{ cursor: 'pointer' }}><I.clip />{value ? <span className="np-file-name">{value}</span> : t.need.task.attach}<input id={id} type="file" style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }} onChange={(e) => onChange(e.target.files?.[0]?.name || '')} /></label>
    </div>
  );
}
/** v0.11: ملف الشراء — مرفقات الرحلة بمحطاتها (عرض مورّد، محضر، مواصفات، توصية، استلام) */
export function NeedFile({ r }: { r: Request }) {
  const { state } = useStore(); const { lang, t, tx } = useLang();
  const docs = r.docs.filter((d) => d.kind === 'attachment'); if (!docs.length) return null;
  return (
    <div className="np-file-list"><b>{t.need.file.title}</b>
      <ul>{docs.map((d) => { const who = d.by ? personById(state, d.by) : undefined; return <li key={d.id}><I.clip /><span className="np-file-main"><span className="np-file-name">{tx(d.title)}</span><span className="cell-sub">{d.stage ? tx(d.stage) : t.need.card.title}{who ? ` · ${lang === 'ar' ? who.name.split(' ')[0] : who.nameEn.split(' ')[0]}` : ''} · {fmtDate(d.at, lang, { day: 'numeric', month: 'short' })}</span></span></li>; })}</ul>
    </div>
  );
}

/** بطاقة الاحتياج: الفئة والمستفيد والمقر والبنود بحالاتها — تُعرض في المهمة والطلب */
export function NeedCard({ r, compact }: { r: Request; compact?: boolean }) {
  const { state } = useStore(); const { lang, t, tx } = useLang();
  const n = r.need!; const content = needContent(state); const cat = categoryOf(content, n.categoryId); const sum = needSummary(state, r, lang);
  const Ic = cat ? (I[cat.icon as keyof typeof I] || I.box) : I.box; const store = storeOf(content, n.storeId); const entity = entityOf(content, n.entityId);
  return (
    <div className="need-card">
      <div className="nc-head"><span className={`qicon ${cat?.tone || 'g-sage'}`}><Ic /></span><div className="nc-main"><b>{sum.category}</b><span className="cell-sub">{t.need.beneficiary}: {sum.beneficiary} · {sum.site}{n.urgent ? <> · <Pill tone="danger" icon="alert">{t.need.urgent}</Pill></> : null}</span></div></div>
      <ul className="nc-lines">{n.lines.map((l) => <li key={l.id}><span className="nc-line-name">{tx(l.name)} <span className="num">× {l.qty}</span> <span className="cell-sub">{tx(l.unit)}{l.specifiedBy && l.itemId ? <> · <span className="mono">{l.itemId}</span></> : l.specifiedBy && l.materialGroup ? <> · {t.need.task.materialGroup} <span className="mono">{l.materialGroup}</span></> : l.catalogId ? ` · ${t.need.fromCatalog}` : ` · ${t.need.freeText}`}{l.unitPrice ? <> · <span className="num">{(l.unitPrice * l.qty).toLocaleString('en')}</span></> : null}</span>{l.asked && l.asked.ar !== l.name.ar ? <span className="nc-asked">{t.need.asked}: {tx(l.asked)}</span> : null}</span><Pill tone={TONE[l.status]}>{t.need.lineStatus[l.status]}{(l.status === 'purchasing' || l.status === 'received') && (l.received || 0) > 0 && (l.received || 0) < l.qty ? <span className="num"> {l.received}/{l.qty}</span> : null}</Pill></li>)}</ul>
      {!compact ? <p className="nc-why">{n.justification}</p> : null}
      {!compact ? <div className="kbd-row nc-meta">{entity ? <Pill icon="shield">{t.need.entity}: {tx(entity.name)}</Pill> : <Pill>{t.need.noEntity}</Pill>}{n.kind === 'material' ? (store ? <Pill icon="box">{t.need.store}: {tx(store.name)}</Pill> : <Pill icon="plane">{t.need.noStore}</Pill>) : null}{cat?.custody && n.kind === 'material' ? <Pill tone="gold" icon="seal">{t.need.custodyFlag}</Pill> : null}{n.estimatedValue ? <Pill>{n.lines.some((l) => l.specifiedBy) || n.procurement?.preparedAt ? t.need.card.estimate : t.need.indicativeTotal}: <span className="num">{n.estimatedValue.toLocaleString('en')}</span></Pill> : null}</div> : null}
    </div>
  );
}

/** المراحل بمراجعها كما يراها الطالب: ما تم وما هو الآن وما بقي وما تُخُطِّي ولماذا */
export function NeedStages({ r }: { r: Request }) {
  const { lang, t, tx } = useLang(); const stages = needStages(r); const p = r.need?.procurement;
  let seg = '';
  return (
    <div className="need-stages">
      {stages.map((s) => { const head = s.segment !== seg ? s.segment : ''; seg = s.segment; return (
        <React.Fragment key={s.key}>
        {head ? <div className={`ns-seg ${stages.filter((x) => x.segment === head).every((x) => x.state === 'done' || x.state === 'skipped') ? 'done' : stages.some((x) => x.segment === head && x.state === 'current') ? 'current' : ''}`}><span>{t.need.segments[head]}</span></div> : null}
        <div className={`ns ${s.state}`}>
          <span className="ns-dot">{s.state === 'done' ? <I.check /> : s.state === 'skipped' ? <I.x /> : s.state === 'current' ? <I.clock /> : <I.dot />}</span>
          <span className="ns-main"><span className="ns-title">{tx(s.title)}</span><span className="ns-sub">{s.sub ? tx(s.sub) : null}{s.sub && (s.ref || s.at) ? ' · ' : ''}{s.ref ? <span className="mono">{s.ref}</span> : null}{s.ref && s.at ? ' · ' : ''}{s.at ? fmtDate(s.at, lang, { day: 'numeric', month: 'short' }) : null}</span></span>
        </div>
        </React.Fragment>
      ); })}
      {p?.expectedAt && r.status === 'in_review' ? <p className="ns-expected"><I.calendar /> {t.need.card.expected}: <b className="num">{p.expectedAt}</b>{(p.expectedLog || []).length > 1 ? ` (${(p.expectedLog || []).length - 1} ${lang === 'ar' ? 'تغيير' : 'changes'})` : ''}</p> : null}
    </div>
  );
}

/** مراجع النظام المرجعي في الطلب: طلب الشراء، وأمر الشراء، والاستلام، والاعتماد، والمناقصات، والسند */
export function NeedRefs({ r }: { r: Request }) {
  const { state } = useStore(); const { t, tx } = useLang(); const p = r.need?.procurement; const h = r.need?.handover;
  const shared = p?.purchaseFile ? state.requests.filter((x) => x.id !== r.id && x.need?.procurement?.purchaseFile === p.purchaseFile) : [];
  const n = (x?: number) => (x ? x.toLocaleString('en') : undefined);
  const prov = r.need?.provision;
  const rows: { k: string; v?: string }[] = [{ k: t.need.file.pool, v: prov ? prov.pools.map((x) => `${tx(x.name)} × ${x.qty}`).join(' · ') : undefined }, { k: t.need.file.provisionRef, v: prov ? prov.pools.map((x) => x.ref).filter(Boolean).join(' · ') || undefined : undefined }, { k: t.need.file.releaseOrder, v: prov ? prov.pools.map((x) => x.releaseOrderNo).filter(Boolean).join(' · ') || undefined : p?.releaseOrderNo }, { k: t.need.card.method, v: p?.methodName ? `${tx(p.methodName)}${p.methodFlags?.minOffers && p.methodFlags.offers ? ` · ${t.need.task.minOffersNeed.replace('{n}', String(p.methodFlags.minOffers))}` : ''}` : undefined }, { k: t.need.card.estimate, v: n(p?.estimatedValue) }, { k: t.need.card.contract, v: p?.contractNo }, { k: t.need.card.file, v: p?.purchaseFile && shared.length ? p.purchaseFile : undefined }, { k: t.need.card.mergedWith, v: shared.length ? shared.map((x) => x.id).join(' · ') : undefined }, { k: t.need.card.band, v: p?.band ? tx(p.band.name) : undefined }, { k: t.need.file.splitAlert, v: p?.splitAlert ? `${p.splitAlert.ids.join(' · ')} · ${n(p.splitAlert.total)}` : undefined }, { k: t.need.card.fundsReservation, v: p?.reservation ? `${p.reservation.no} · ${n(p.reservation.amount)}${p.reservation.released ? ` · ${t.need.card.released}` : ''}` : p?.budgetRef }, { k: t.need.card.tender, v: p?.tender?.ref }, { k: t.need.card.offers, v: p?.offers ? `${p.offers.count}${p.offers.shortfall ? ` · ${t.need.file.shortfall}` : ''}` : undefined }, { k: t.need.card.recommendation, v: p?.recommendation ? `${p.recommendation.offer}${p.recommendation.amount ? ` · ${n(p.recommendation.amount)}` : ''}` : undefined }, { k: t.need.file.awardRule, v: p?.awardAuto ? t.need.file.awardAuto : p?.awardWhy?.length ? p.awardWhy.map((w) => tx(w)).join(' · ') : undefined }, { k: t.need.card.award, v: p?.award ? `${p.award.supplier}${p.award.supplierId ? ` (${p.award.supplierId})` : ''} · ${n(p.award.amount)}` : undefined }, { k: t.need.card.pr, v: p?.prNo }, { k: t.need.card.po, v: p?.poNo ? `${p.poNo}${p.poSource === 'manual' ? ` · ${t.need.policy.erpManual}` : ''}` : undefined }, { k: t.need.card.expected, v: p?.expectedAt }, { k: t.need.card.receipts, v: (p?.receipts || []).filter((x) => x.status === 'issued').map((x) => `${x.no}${x.erpNo ? ` · ${x.erpNo}` : ''}`).join(' · ') || undefined }, { k: t.need.card.progress, v: r.need && r.need.kind === 'material' && receiptProgress(r.need).total ? `${receiptProgress(r.need).received} / ${receiptProgress(r.need).total}${receiptProgress(r.need).closed ? ` · ${t.need.card.closedRemainder} ${receiptProgress(r.need).closed}` : ''}` : undefined }, { k: t.need.card.closedRemainder, v: p?.deliveryCompleted ? `${p.deliveryCompleted.why}${p.deliveryCompleted.releasedAmount ? ` · ${t.need.card.released} ${n(p.deliveryCompleted.releasedAmount)}` : ''}` : undefined }, { k: t.need.card.handover, v: (r.need?.handovers || []).length > 1 ? (r.need?.handovers || []).map((x) => x.number).join(' · ') : h?.number }].filter((x) => x.v);
  if (!rows.length) return null;
  /* الأرقام والمراجع بخط أحادي المسافة؛ النصوص العربية (التوصية) بالخط العادي */
  return <Group>{rows.map((x) => <div key={x.k} className="summary-row"><span className="k">{x.k}</span><span className={`v ${/^[\w\d\-/ .·]+$/.test(x.v || '') ? 'mono' : ''}`}>{x.v}</span></div>)}</Group>;
}

/* ——— المسار المتوقع للاحتياج: الخطوات المشتركة ثم المقطعان (المخزون / الشراء) لأن المحرك يختار بينهما بنتيجة خطوة المستودع ——— */
export function NeedRoutePreview({ steps, requester, notApplied, threshold, tolerance }: { steps: Step[]; requester: Person; notApplied?: { title: T2; why: T2 }[]; threshold?: number; tolerance?: number }) {
  const { state } = useStore(); const { lang, t, tx } = useLang();
  const fake: Request = { id: 'preview', serviceId: 'AS-01', requesterId: requester.id, createdAt: 0, updatedAt: 0, status: 'in_review', steps, fields: [], docs: [], audit: [], channel: 'app' };
  const provided = steps.filter((s) => s.branch === 'provided');
  const common = steps.filter((s) => !s.branch && s.desk !== 'system'); const stock = steps.filter((s) => s.branch === 'stock'); const purchase = steps.filter((s) => s.branch && s.branch !== 'stock' && s.branch !== 'provided' && !(s.desk === 'system' && s.role !== 'pr')); const sys = steps.filter((s) => s.desk === 'system' && s.role !== 'pr');
  /* v0.11: الخطوات المشتركة حتى الجهة الفنية، ثم مقطع «إن وفّرته الجهة من رصيدها»، ثم بقية المشترك (المستودع) والمقطعان */
  const entityIdx = common.findIndex((s) => s.role === 'entity'); const commonHead = provided.length && entityIdx >= 0 ? common.slice(0, entityIdx + 1) : common; const commonTail = provided.length && entityIdx >= 0 ? common.slice(entityIdx + 1) : [];
  const awardRule = needContent(state).rules.awardApproval || 'always';
  let n = 0;
  const cond = (s: Step) => (s.branch === 'tender' ? fill(t.need.routeGroups.ifOver, { n: (threshold || 0).toLocaleString('en') }) : s.branch === 'quotes' ? t.need.routeGroups.ifQuotes : s.branch === 'topUp' ? fill(t.need.routeGroups.ifTopUp, { n: String(tolerance ?? 0) }) : s.branch === 'award' ? (awardRule === 'exception' ? t.need.routeGroups.ifAwardException : t.need.routeGroups.ifAward) : '');
  const row = (s: Step) => { n += 1; const people = assigneesFor(state, fake, s); const who = people[0]; const isSys = s.desk === 'system' || s.mode === 'system'; const names = people.map((p) => (lang === 'ar' ? p.name : p.nameEn)); const many = people.length > 1; const c = cond(s); return (
    <Item key={s.key} className={`rp-item ${s.mode === 'fulfil' ? 'fulfil' : ''} ${c ? 'cond' : ''}`}>
      <span className={`rp-node ${isSys ? 'sys' : ''}`}>{isSys ? <span className="cell-lead plain"><I.gear /></span> : who ? <Avatar p={who} /> : <span className="cell-lead plain"><I.person /></span>}{many ? <span className="rp-more num">+{people.length - 1}</span> : null}<span className="rp-n num">{n}</span></span>
      <span className="rp-txt"><b>{tx(s.title)}{c ? <span className="rp-cond"> · {c}</span> : null}</b><span>{names.length ? names.join(s.quorum === 'all' ? (lang === 'ar' ? ' و' : ' & ') : lang === 'ar' ? ' أو ' : ' or ') : isSys ? t.desks.system : ''}{s.slaHours ? ` · ${s.slaHours}${lang === 'ar' ? ' س' : 'h'}` : ''}{many ? ` · ${s.quorum === 'all' ? t.inbox.quorumAll : t.inbox.quorumAny}` : ''}</span></span>
    </Item>
  ); };
  const group = (title: string, tone: string, list: Step[]) => (list.length ? <><div className="rp-branch"><Pill tone={tone}>{title}</Pill></div>{list.map(row)}</> : null);
  return (
    <>
      <Stagger className="route-preview" step={0.04}>
        {commonHead.map(row)}
        {group(t.need.routeGroups.ifProvided, 'tint', provided)}
        {provided.length && (commonTail.length || stock.length || purchase.length) ? <div className="rp-branch"><Pill>{t.need.routeGroups.ifNotProvided}</Pill></div> : null}
        {commonTail.map(row)}
        {group(t.need.routeGroups.ifStock, 'ok', stock)}
        {group(stock.length ? t.need.routeGroups.ifNot : t.need.routeGroups.direct, 'gold', purchase)}
        {sys.length ? <div className="rp-branch"><Pill>{t.need.routeGroups.then}</Pill></div> : null}
        {sys.map(row)}
      </Stagger>
      {notApplied && notApplied.length > 0 ? (
        <div className="rp-skipped">
          <span className="rp-sk-title">{t.leave.notApplied}</span>
          {notApplied.map((x, i) => <span key={i} className="rp-sk"><I.dot /><b>{tx(x.title)}</b><span>{tx(x.why)}</span></span>)}
        </div>
      ) : null}
    </>
  );
}

/* ——— ملخص الشراء: يُعرض لمعتمد الشراء ومعتمد الترسية (اعتماد عادي) وفي الطلب والمكتب ——— */
export function NeedPurchaseSummary({ r }: { r: Request }) {
  const { t, tx } = useLang(); const p = r.need?.procurement; if (!p || !p.preparedAt) return null;
  const n = (x?: number) => (x ? x.toLocaleString('en') : '—');
  const cur = r.steps.find((s) => s.status === 'current');
  return (
    <div className="np-sum">
      <div className="np-sum-head"><b>{t.need.task.purchaseSummary}</b>{p.methodName ? <Pill tone="gold" icon="wallet">{tx(p.methodName)}</Pill> : null}</div>
      <div className="np-sum-grid">
        <span><i>{t.need.card.estimate}</i><b className="num">{n(p.estimatedValue)}</b></span>
        {p.contractNo ? <span><i>{t.need.card.contract}</i><b className="mono">{p.contractNo}</b></span> : null}
        {p.reservation ? <span><i>{t.need.card.fundsReservation}</i><b className="num">{n(p.reservation.amount)} <span className="mono">{p.reservation.no}</span></b></span> : null}
        {p.recommendation ? <span><i>{t.need.card.recommendation}</i><b>{p.recommendation.offer}{p.recommendation.amount ? <> · <span className="num">{n(p.recommendation.amount)}</span></> : null}</b></span> : null}
        {p.band ? <span><i>{t.need.card.band}</i><b>{tx(p.band.name)}</b></span> : null}
      </div>
      {p.methodWhy ? <p className="cell-sub">{t.need.task.methodWhy}: {p.methodWhy}</p> : null}
      {/* v0.11 (ق-08): تنبيه التجزئة يراه معتمد الشراء */}
      {p.splitAlert ? <Notice tone="warn" icon="alert"><b>{t.need.task.splitTitle}</b> — {fill(t.need.task.splitBody, { ids: p.splitAlert.ids.join('، '), days: String(p.splitAlert.days), total: n(p.splitAlert.total), band: p.splitAlert.band ? tx(p.splitAlert.band) : '' })}</Notice> : null}
      {p.offers?.list?.length ? <table className="np-offers"><thead><tr><th>{t.need.task.supplier}</th><th>{t.need.task.amount}</th><th>{t.need.task.validUntil}</th><th>{t.need.task.offerAttachment}</th></tr></thead><tbody>{p.offers.list.map((o, i) => <tr key={i} className={p.recommendation?.offer === o.supplier ? 'win' : ''}><td>{o.supplier}{o.supplierNew ? <> <Pill tone="warn">{t.need.file.supplierNew}</Pill></> : o.supplierId ? <> <span className="mono cell-sub">{o.supplierId}</span></> : null}{p.recommendation?.offer === o.supplier ? <> <I.check /></> : null}</td><td className="num">{o.amount.toLocaleString('en')}{o.currency && o.currency !== 'SAR' && o.fxAmount ? <span className="cell-sub"> ({o.fxAmount.toLocaleString('en')} {o.currency})</span> : null}</td><td className="num">{o.validUntil || '—'}</td><td>{o.attachment ? <span className="np-file-name"><I.clip />{o.attachment}</span> : '—'}</td></tr>)}</tbody></table> : null}
      {p.offers?.shortfall ? <p className="cell-sub"><Pill tone="warn" icon="alert">{t.need.file.shortfall}</Pill> {p.offers.shortfall.why}</p> : null}
      {p.recommendation?.note ? <p className="cell-sub">{t.need.task.evalNote}: {p.recommendation.note}</p> : null}
      {/* v0.11 (D-024): سبب فتح اعتماد الترسية أو اعتمادها آلياً */}
      {p.awardAuto ? <p className="cell-sub np-award ok"><I.check /> {t.need.file.awardAuto}</p> : p.awardWhy?.length ? <div className="np-award"><b>{cur?.role === 'awardApproval' ? t.need.file.awardWhy : t.need.task.deviations}</b><ul>{p.awardWhy.map((w, i) => <li key={i}>{tx(w)}</li>)}</ul></div> : null}
      <NeedFile r={r} />
    </div>
  );
}

/* ——— لوحات المهام بحسب الدور: كل لوحة تقرر وتُغلق المهمة ——— */
export function NeedTaskPanel({ task, onDone }: { task: TaskView; onDone: () => void }): React.ReactElement | null {
  const { state, dispatch } = useStore(); const { lang, t, tx } = useLang(); const me = usePerson(); const toast = useToast();
  const r = task.request; const st = task.step; const n = r.need!; const role = st.role; const today = toISO(Date.now());
  const done = (title: string, sub?: string) => { try { navigator.vibrate?.(12); } catch { /* لا اهتزاز */ } toast({ title, sub: sub || `${tx(requestTitle(r))} · ${r.id}`, icon: 'check', tone: 'ok' }); onDone(); };
  /* المستودع: قرار لكل بند */
  const [dec, setDec] = useState<Record<string, 'reserve' | 'purchase'>>({});
  const [f, setF] = useState<Record<string, string>>({}); const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));
  const [err, setErr] = useState('');
  const content = needContent(state); const entity = entityOf(content, n.entityId); const requester = personById(state, r.requesterId); const cat = categoryOf(content, n.categoryId);
  const entityPeople = useMemo(() => { if (!entity) return [] as Person[]; const ids = entity.agent.positionIds || []; return ids.map((pid) => positionById(state, pid)?.holderId).filter((x): x is string => !!x).map((id) => personById(state, id)).filter((p): p is Person => !!p); }, [entity, state]);
  const [evalKind, setEvalKind] = useState<'entity' | 'requester' | 'other'>(entity ? 'entity' : 'requester'); const [evalOther, setEvalOther] = useState('');
  /* v0.10 تحديد الصنف (الجهة الفنية أو المستودع): لكل بند رقم صنف من قائمة النظام المرجعي أو بند نصي بمجموعة أصناف، والكمية والسعر */
  const catItems = useMemo(() => state.erp.items.filter((it) => !cat || it.categoryHint === cat.id), [state.erp.items, cat]);
  const [spec, setSpec] = useState<Record<string, { mode: 'item' | 'text'; itemId: string; text: string; group: string; qty: string; price: string }>>(() => Object.fromEntries(n.lines.map((l) => [l.id, { mode: l.itemId || (!l.specifiedBy && cat?.kind === 'material') ? 'item' : 'text', itemId: l.itemId || '', text: l.asked ? l.asked.ar : l.name.ar, group: l.materialGroup || '', qty: String(l.qty), price: l.unitPrice ? String(l.unitPrice) : '' }])));
  const setSpecOf = (id: string, patch: Partial<{ mode: 'item' | 'text'; itemId: string; text: string; group: string; qty: string; price: string }>) => setSpec((x) => ({ ...x, [id]: { ...x[id], ...patch } }));
  const pickItem = (id: string, itemId: string) => { const it = state.erp.items.find((x) => x.id === itemId); setSpecOf(id, { itemId, price: it?.price ? String(it.price) : spec[id].price }); };
  const specsInput = (): SpecInput[] => n.lines.map((l) => { const sp = spec[l.id]; return sp.mode === 'item' ? { lineId: l.id, itemId: sp.itemId, qty: Number(sp.qty) || l.qty, unitPrice: sp.price ? Number(sp.price) : undefined } : { lineId: l.id, text: sp.text.trim() || l.name.ar, materialGroup: sp.group.trim() || undefined, qty: Number(sp.qty) || l.qty, unitPrice: sp.price ? Number(sp.price) : undefined }; });
  const specOk = n.lines.every((l) => { const sp = spec[l.id]; return sp && (sp.mode === 'item' ? !!sp.itemId : !!sp.text.trim()) && Number(sp.qty) > 0; });
  const specTotal = n.lines.reduce((a, l) => { const sp = spec[l.id]; return a + (Number(sp?.price) || 0) * (Number(sp?.qty) || l.qty); }, 0);
  const specRows = (hint: string) => (
    <>
      <div className="np-head"><b>{t.need.task.specTitle}</b><span className="cell-sub">{hint}</span></div>
      {n.lines.map((l) => { const sp = spec[l.id]; return (
        <div key={l.id} className="np-line np-spec">
          <div className="np-line-main"><b>{l.asked ? tx(l.asked) : tx(l.name)} <span className="num">× {l.qty}</span></b><span className="cell-sub">{l.catalogId ? `${t.need.fromCatalog}${l.unitPrice ? ` · ${t.need.indicative} ${l.unitPrice.toLocaleString('en')}` : ''}` : t.need.freeText}</span></div>
          {cat?.kind === 'material' ? <div className="np-choice"><button type="button" className={`pill ${sp.mode === 'item' ? 'tint' : ''}`} onClick={() => setSpecOf(l.id, { mode: 'item' })}><I.box />{t.need.task.pickItem}</button><button type="button" className={`pill ${sp.mode === 'text' ? 'tint' : ''}`} onClick={() => setSpecOf(l.id, { mode: 'text' })}><I.doc />{t.need.task.textItem}</button></div> : null}
          {sp.mode === 'item' ? <select className="select-in" aria-label={t.need.task.pickItem} value={sp.itemId} onChange={(e) => pickItem(l.id, e.target.value)}><option value="">— {t.need.task.pickItem} —</option>{catItems.map((it) => <option key={it.id} value={it.id}>{it.id} · {tx(it.name)}{it.specs ? ` · ${tx(it.specs)}` : ''}{it.price ? ` · ${it.price.toLocaleString('en')}` : ''}</option>)}</select>
            : <div className="np-two"><Field id={`sp-text-${l.id}`} label={t.need.task.textItem}><input id={`sp-text-${l.id}`} value={sp.text} onChange={(e) => setSpecOf(l.id, { text: e.target.value })} /></Field><Field id={`sp-group-${l.id}`} label={t.need.task.materialGroup}><input id={`sp-group-${l.id}`} className="mono" dir="ltr" placeholder="SW-LIC" value={sp.group} onChange={(e) => setSpecOf(l.id, { group: e.target.value })} /></Field></div>}
          <div className="np-two"><Field id={`sp-qty-${l.id}`} label={t.need.qty}><input id={`sp-qty-${l.id}`} className="num" dir="ltr" type="number" min={1} value={sp.qty} onChange={(e) => setSpecOf(l.id, { qty: e.target.value })} /></Field><Field id={`sp-price-${l.id}`} label={t.need.task.unitPrice}><input id={`sp-price-${l.id}`} className="num" dir="ltr" type="number" min={0} value={sp.price} onChange={(e) => setSpecOf(l.id, { price: e.target.value })} /></Field></div>
        </div>
      ); })}
      <div className="np-total"><span>{t.need.task.estimateTotal}</span><b className="num">{specTotal.toLocaleString('en')}</b></div>
    </>
  );
  if (!role) return null;
  if (role === 'entity') {
    /* v0.11 (D-023): خطوة قرار بنتيجة كالمستودع — اعتماد وتحديد الصنف، أو متوفر لدينا فنوفّره من رصيدنا، أو ليست من اختصاصنا فتُحوَّل، أو إعادة */
    const mode = (f.mode || 'spec') as 'spec' | 'provide' | 'reroute';
    const pools = poolsOf(content, n.entityId, today); const provideAllowed = canProvide(n.availability) || pools.length > 0;
    const pick = (l: NeedLine) => f[`pool-${l.id}`] || l.poolId || pools[0]?.id || '';
    const needBy: Record<string, number> = {}; n.lines.forEach((l) => { const id = pick(l); needBy[id] = (needBy[id] || 0) + l.qty; });
    const enough = (poolId: string) => poolStock(state, poolOf(content, poolId)) >= (needBy[poolId] || 0);
    const provideOk = pools.length > 0 && n.lines.every((l) => pick(l) && enough(pick(l)));
    const rerouteCats = liveNeed(content.categories, today).filter((c) => c.id !== n.categoryId && c.kind === cat?.kind && c.entityId);
    const rerouteOk = !!f.rerouteTo && (f.rerouteWhy || '').trim();
    return (
      <Group>
        <div className="np-head"><b>{t.need.task.entityMode}</b></div>
        <div className="chips np-mode" style={{ padding: '0 14px 10px' }}>
          <button type="button" className={`pill ${mode === 'spec' ? 'tint' : ''}`} aria-pressed={mode === 'spec'} onClick={() => set('mode', 'spec')}>{mode === 'spec' ? <I.check /> : <I.box />}{t.need.task.modeSpec}</button>
          {provideAllowed ? <button type="button" className={`pill ${mode === 'provide' ? 'ok' : ''}`} aria-pressed={mode === 'provide'} onClick={() => set('mode', 'provide')}>{mode === 'provide' ? <I.check /> : <I.sparkle />}{t.need.task.modeProvide}</button> : null}
          <button type="button" className={`pill ${mode === 'reroute' ? 'gold' : ''}`} aria-pressed={mode === 'reroute'} onClick={() => set('mode', 'reroute')}>{mode === 'reroute' ? <I.check /> : <I.ret />}{t.need.task.modeReroute}</button>
        </div>
        {mode === 'spec' ? (<>
          {specRows(t.need.task.specHint)}
          <FilePick id="np-spec-att" label={t.need.task.specAttachment} value={f.specAtt || ''} onChange={(v) => set('specAtt', v)} />
          <Field id="np-note" label={`${t.inbox.note} (${t.newReq.optional})`} error={err || undefined}><textarea id="np-note" rows={2} value={f.note || ''} onChange={(e) => { set('note', e.target.value); setErr(''); }} /></Field>
          <div style={{ height: 10 }} />
          <motion.button type="button" className="btn primary block lg" disabled={!specOk} onClick={() => { dispatch({ type: 'needSpecify', requestId: r.id, actorId: me.id, input: { specs: specsInput(), note: f.note || undefined, attachment: f.specAtt || undefined } }); done(t.need.task.confirmSpec); }} whileTap={{ scale: 0.97 }}><I.check />{specOk ? t.need.task.confirmSpec : t.need.task.specNeeded}</motion.button>
          <div style={{ height: 10 }} />
          <div className="btn-row" style={{ padding: '0 14px 14px' }}><motion.button type="button" className="btn secondary" onClick={() => { if (!(f.note || '').trim()) { setErr(t.inbox.noteRequired); return; } dispatch({ type: 'decide', requestId: r.id, action: 'return', actorId: me.id, note: f.note.trim() }); toast({ title: t.inbox.ret, sub: `${tx(requestTitle(r))} · ${r.id}`, icon: 'ret', tone: 'warn' }); onDone(); }} whileTap={{ scale: 0.97 }}><I.ret />{t.need.task.returnWithNote}</motion.button></div>
        </>) : mode === 'provide' ? (<>
          <div className="np-head"><b>{t.need.task.provideTitle}</b><span className="cell-sub">{t.need.task.provideHint}</span></div>
          {!pools.length ? <div style={{ padding: '0 14px 12px' }}><Notice tone="warn" icon="alert">{t.need.task.noPools}</Notice></div> : n.lines.map((l) => { const id = pick(l); const pool = poolOf(content, id); const left = poolStock(state, pool); const ok = !!pool && enough(id); return (
            <div key={l.id} className="np-line np-provide">
              <div className="np-line-main"><b>{l.asked ? tx(l.asked) : tx(l.name)} <span className="num">× {l.qty}</span></b><span className="cell-sub">{pool ? <>{t.need.task.poolLeft}: <span className="num">{left}</span> {tx(pool.unit)} · {t.need.policy.erpKindOf[pool.erpKind]}{pool.custody ? ` · ${t.need.file.digital}` : ''}</> : null}</span></div>
              <select className="select-in" aria-label={t.need.task.pool} value={id} onChange={(e) => set(`pool-${l.id}`, e.target.value)}>{pools.map((p) => <option key={p.id} value={p.id}>{tx(p.name)} · {poolStock(state, p)} {tx(p.unit)}</option>)}</select>
              <Field id={`np-ref-${l.id}`} label={t.need.task.provisionRef}><input id={`np-ref-${l.id}`} className="mono" dir="ltr" placeholder={pool?.erpKind === 'contract' ? '— (أمر تنفيذ آلي)' : 'LIC-0000'} value={f[`ref-${l.id}`] || ''} onChange={(e) => set(`ref-${l.id}`, e.target.value)} /></Field>
              {!ok && pool ? <span className="cell-sub" style={{ color: 'var(--danger)' }}>{t.need.task.provideShort}</span> : null}
            </div>
          ); })}
          <Field id="np-pnote" label={`${t.inbox.note} (${t.newReq.optional})`}><textarea id="np-pnote" rows={2} value={f.pnote || ''} onChange={(e) => set('pnote', e.target.value)} /></Field>
          <div style={{ height: 10 }} />
          <motion.button type="button" className="btn primary block lg" disabled={!provideOk} onClick={() => { dispatch({ type: 'needProvide', requestId: r.id, actorId: me.id, input: { items: n.lines.map((l) => ({ lineId: l.id, poolId: pick(l), ref: (f[`ref-${l.id}`] || '').trim() || undefined })), note: f.pnote || undefined } }); done(t.need.task.confirmProvide); }} whileTap={{ scale: 0.97 }}><I.check />{t.need.task.confirmProvide}</motion.button>
        </>) : (<>
          <div className="np-head"><b>{t.need.task.rerouteTitle}</b><span className="cell-sub">{t.need.task.rerouteHint}</span></div>
          <div className="field"><label htmlFor="np-reroute">{t.need.task.rerouteTo}</label><select id="np-reroute" className="select-in" value={f.rerouteTo || ''} onChange={(e) => set('rerouteTo', e.target.value)}><option value="">—</option>{rerouteCats.map((c) => <option key={c.id} value={c.id}>{tx(c.name)} · {tx(entityOf(content, c.entityId)?.name || { ar: '', en: '' })}</option>)}</select></div>
          <Field id="np-reroutewhy" label={t.need.task.rerouteWhy}><input id="np-reroutewhy" value={f.rerouteWhy || ''} onChange={(e) => set('rerouteWhy', e.target.value)} /></Field>
          <div style={{ height: 10 }} />
          <motion.button type="button" className="btn primary block lg" disabled={!rerouteOk} onClick={() => { dispatch({ type: 'needReroute', requestId: r.id, actorId: me.id, input: { categoryId: f.rerouteTo, note: f.rerouteWhy.trim() } }); done(t.need.task.confirmReroute); }} whileTap={{ scale: 0.97 }}><I.ret />{t.need.task.confirmReroute}</motion.button>
        </>)}
      </Group>
    );
  }
  if (role === 'store') {
    const needSpec = n.lines.some((l) => !l.itemId); const allDecided = n.lines.every((l) => dec[l.id]);
    const [showSpec, setShowSpec] = [f.showSpec === '1', (v: boolean) => set('showSpec', v ? '1' : '')];
    return (
      <Group>
        {needSpec || showSpec ? specRows(needSpec ? t.need.task.storePick : t.need.task.changeItem) : null}
        <div className="np-head"><b>{t.need.task.storeTitle}</b><span className="cell-sub">{t.need.task.storeHint}{!needSpec && !showSpec ? <> · <button type="button" className="link-btn" onClick={() => setShowSpec(true)}>{t.need.task.changeItem}</button></> : null}</span></div>
        {n.lines.map((l) => { const sp = spec[l.id]; const itemId = needSpec || showSpec ? (sp?.mode === 'item' ? sp.itemId : '') : l.itemId; const avail = stockOf(state, itemId, l.storeId); const can = !!itemId && avail >= (Number(sp?.qty) || l.qty); const d = dec[l.id]; return (
          <div key={l.id} className="np-line">
            <div className="np-line-main"><b>{tx(l.name)} <span className="num">× {sp?.qty || l.qty}</span></b><span className="cell-sub">{t.need.task.available}: <span className="num">{avail}</span> {tx(l.unit)}{itemId ? <> · <span className="mono">{itemId}</span></> : ` · ${t.need.freeText}`}</span></div>
            <div className="np-choice"><button type="button" className={`pill ${d === 'reserve' ? 'ok' : ''}`} disabled={!can} onClick={() => setDec((x) => ({ ...x, [l.id]: 'reserve' }))}><I.check />{t.need.task.reserve}</button><button type="button" className={`pill ${d === 'purchase' ? 'gold' : ''}`} onClick={() => setDec((x) => ({ ...x, [l.id]: 'purchase' }))}><I.wallet />{t.need.task.toPurchase}</button></div>
          </div>
        ); })}
        <Field id="np-note" label={`${t.inbox.note} (${t.newReq.optional})`}><textarea id="np-note" rows={2} value={f.note || ''} onChange={(e) => set('note', e.target.value)} /></Field>
        <div style={{ height: 10 }} />
        <motion.button type="button" className="btn primary block lg" disabled={!allDecided || ((needSpec || showSpec) && !specOk)} onClick={() => { dispatch({ type: 'needStore', requestId: r.id, actorId: me.id, decisions: n.lines.map((l) => ({ lineId: l.id, action: dec[l.id] })), note: f.note || undefined, specs: needSpec || showSpec ? specsInput() : undefined }); done(t.need.task.confirmStore); }} whileTap={{ scale: 0.97 }}><I.check />{allDecided ? t.need.task.confirmStore : t.need.task.needAll}</motion.button>
      </Group>
    );
  }
  if (role === 'procurement') {
    /* v0.10 تجهيز الشراء: التقدير النهائي وطريقة الشراء (حرية المكتب بسبب) والعقد والدمج في ملف شراء والمقيّم */
    const methods = liveNeed(content.methods || [], today); const threshold = n.tenderThreshold ?? content.rules.tenderThreshold;
    const estVal = f.est !== undefined ? f.est : n.estimatedValue ? String(n.estimatedValue) : '';
    const over = Number(estVal) > threshold; const m = methods.find((x) => x.id === (f.method || methods[0]?.id)); const eff = over ? methods.find((x) => x.tender) || m : m;
    const needsOffers = !!eff && eff.offers && !over; const evaluators = evalKind === 'entity' ? entityPeople.map((p) => p.id) : evalKind === 'requester' ? [r.requesterId] : evalOther ? [evalOther] : [];
    const people = state.people.filter((p) => p.id !== me.id);
    /* ق.ح-11 الدمج: ملف شراء لاحتياج آخر جارٍ يُختار فتشترك الاحتياجات في طلب الشراء ويحتفظ كل احتياج برقمه وحالته */
    const openFiles = Array.from(new Map(state.requests.filter((x) => x.id !== r.id && x.need?.procurement?.purchaseFile && x.status === 'in_review' && !x.need.procurement.prNo).map((x) => [x.need!.procurement!.purchaseFile!, x])).values());
    /* v0.11 (P-10): العقد الإطاري من قائمة عقود النظام المرجعي السارية بقيمة متبقية؛ وتنبيه التجزئة (ق-08) قبل القرار */
    const contracts = (state.erp.contracts || []).filter((c) => c.validTo >= today && c.target - c.consumed > 0);
    const split = Number(estVal) > 0 ? splitAlertFor(state, r, Number(estVal), today) : null;
    const ok = Number(estVal) > 0 && !!eff && (f.methodWhy || '').trim() && (!eff.contract || (f.contract || '').trim()) && (!needsOffers || (evaluators.length > 0 && (f.evalWhy || '').trim()));
    return (
      <Group>
        <div className="np-head"><b>{t.need.task.prepTitle}</b><span className="cell-sub">{t.need.task.prepHint}</span></div>
        <Field id="np-est" label={t.need.task.estValue} hint={n.indicativeValue ? `${t.need.indicativeTotal}: ${n.indicativeValue.toLocaleString('en')}` : undefined}><input id="np-est" className="num" dir="ltr" type="number" min={0} value={estVal} onChange={(e) => set('est', e.target.value)} /></Field>
        {split ? <div style={{ padding: '0 14px 10px' }}><Notice tone="warn" icon="alert"><b>{t.need.task.splitTitle}</b> — {fill(t.need.task.splitBody, { ids: split.ids.join('، '), days: String(split.days), total: split.total.toLocaleString('en'), band: split.band ? tx(split.band) : '' })}</Notice></div> : null}
        <div className="cell stacked"><span className="cell-title">{t.need.task.method}</span>
          <div className="chips" style={{ paddingTop: 6 }}>{methods.map((x) => <button key={x.id} type="button" className={`pill ${eff?.id === x.id ? 'tint' : ''}`} disabled={over && !x.tender} aria-pressed={eff?.id === x.id} onClick={() => set('method', x.id)}>{eff?.id === x.id ? <I.check /> : null}{tx(x.name)}</button>)}</div>
          {eff?.guidance ? <span className="cell-sub" style={{ paddingTop: 6 }}>{tx(eff.guidance)}{needsOffers ? ` · ${fill(t.need.task.minOffersNeed, { n: String(eff.minOffers) })}` : ''}</span> : null}
          {over ? <span className="cell-sub" style={{ paddingTop: 6, color: 'var(--gold)' }}>{t.need.task.forcedTender} ({threshold.toLocaleString('en')})</span> : null}
        </div>
        {eff?.contract ? <div className="field"><label htmlFor="np-contract">{t.need.task.contractPick}</label>{contracts.length ? <select id="np-contract" className="select-in" value={f.contract || ''} onChange={(e) => set('contract', e.target.value)}><option value="">—</option>{contracts.map((c) => { const sup = (state.erp.suppliers || []).find((x) => x.id === c.supplierId); return <option key={c.id} value={c.id}>{c.id} · {tx(c.name)}{sup ? ` · ${tx(sup.name)}` : ''} · {t.need.task.contractLeft} {(c.target - c.consumed).toLocaleString('en')}</option>; })}</select> : <span className="cell-sub" style={{ color: 'var(--danger)' }}>{t.need.task.contractNone}</span>}</div> : null}
        <Field id="np-methodwhy" label={t.need.task.methodWhy}><input id="np-methodwhy" value={f.methodWhy || ''} onChange={(e) => set('methodWhy', e.target.value)} /></Field>
        {openFiles.length ? <div className="field"><label htmlFor="np-merge">{t.need.task.mergeFile}</label><select id="np-merge" className="select-in" value={f.file || ''} onChange={(e) => set('file', e.target.value)}><option value="">{t.need.task.mergeNoneFile}</option>{openFiles.map((x) => <option key={x.id} value={x.need!.procurement!.purchaseFile}>{x.need!.procurement!.purchaseFile} · {x.id} · {needSummary(state, x, lang).lines}</option>)}</select><span className="hint">{t.need.task.mergeHint}</span></div> : null}
        {needsOffers ? (<>
          <div className="cell stacked"><span className="cell-title">{t.need.task.evaluator}</span>
            <div className="chips" style={{ paddingTop: 6 }}>{entity ? <button type="button" className={`pill ${evalKind === 'entity' ? 'tint' : ''}`} onClick={() => setEvalKind('entity')}>{t.need.task.evalEntity} · {tx(entity.name)}</button> : null}<button type="button" className={`pill ${evalKind === 'requester' ? 'tint' : ''}`} onClick={() => setEvalKind('requester')}>{t.need.task.evalRequester} · {requester ? (lang === 'ar' ? requester.name.split(' ')[0] : requester.nameEn.split(' ')[0]) : ''}</button><button type="button" className={`pill ${evalKind === 'other' ? 'tint' : ''}`} onClick={() => setEvalKind('other')}>{t.need.task.evalOther}</button></div>
            {evalKind === 'other' ? <select className="select-in" style={{ marginTop: 8 }} value={evalOther} onChange={(e) => setEvalOther(e.target.value)}><option value="">—</option>{people.map((p) => <option key={p.id} value={p.id}>{lang === 'ar' ? p.name : p.nameEn} · {lang === 'ar' ? p.title : p.titleEn}</option>)}</select> : null}
          </div>
          <Field id="np-evalwhy" label={t.need.task.evalWhy}><input id="np-evalwhy" value={f.evalWhy || ''} onChange={(e) => set('evalWhy', e.target.value)} /></Field>
        </>) : null}
        <div style={{ height: 10 }} />
        <motion.button type="button" className="btn primary block lg" disabled={!ok} onClick={() => { dispatch({ type: 'needProcurement', requestId: r.id, actorId: me.id, input: { estimatedValue: Number(estVal), methodId: eff!.id, methodWhy: f.methodWhy.trim(), contractNo: eff!.contract ? f.contract.trim() : undefined, purchaseFile: f.file || undefined, evaluatorPersonIds: needsOffers ? evaluators : [], evaluatorWhy: needsOffers ? f.evalWhy.trim() : '' } }); done(t.need.task.confirmPrep, tx(eff!.name)); }} whileTap={{ scale: 0.97 }}><I.check />{t.need.task.confirmPrep}</motion.button>
      </Group>
    );
  }
  if (role === 'quotes') {
    /* v0.11: المورّد من قائمة شركاء الأعمال (أو جديد يُنشأ في النظام المرجعي)، والعملة والمعادل بالريال، والصلاحية، ومستند العرض الإلزامي؛ وعروض أقل من الحد بمبرر (D-025) */
    const min = n.procurement?.methodFlags?.minOffers || 1; const rows = Number(f.rows || Math.max(min, 1)); const attReq = content.rules.offerAttachmentRequired !== false;
    const suppliers = (state.erp.suppliers || []).filter((x) => !x.blocked);
    const offerAt = (i: number): NeedOffer => { const sid = f[`sid${i}`] || ''; const sup = suppliers.find((x) => x.id === sid); const cur = f[`cur${i}`] || 'SAR'; return { supplier: sid === 'new' ? (f[`sup${i}`] || '').trim() : sup ? sup.name.ar : '', supplierId: sup?.id, supplierNew: sid === 'new', amount: Number(f[`amt${i}`] || 0), currency: cur, fxAmount: cur !== 'SAR' && f[`fx${i}`] ? Number(f[`fx${i}`]) : undefined, validUntil: f[`val${i}`] || undefined, attachment: f[`att${i}`] || undefined }; };
    const offers = Array.from({ length: rows }, (_, i) => offerAt(i)).filter((o) => o.supplier && o.amount > 0);
    const missingAtt = attReq && offers.some((o) => !o.attachment); const shortfall = offers.length > 0 && offers.length < min;
    const ok = offers.length > 0 && !missingAtt && (!shortfall || (f.shortfallWhy || '').trim());
    return (
      <Group>
        <div className="np-head"><b>{t.need.task.quotesTitle}</b><span className="cell-sub">{t.need.task.quotesHint} · {fill(t.need.task.minOffersNeed, { n: String(min) })}{attReq ? ` · ${t.need.task.attachmentRequired}` : ''}</span></div>
        {Array.from({ length: rows }, (_, i) => { const sid = f[`sid${i}`] || ''; const cur = f[`cur${i}`] || 'SAR'; return (
          <div key={i} className="np-offer-row">
            <span className="num np-offer-n">{i + 1}</span>
            <select className="select-in np-offer-sup" aria-label={t.need.task.supplierPick} value={sid} onChange={(e) => set(`sid${i}`, e.target.value)}><option value="">— {t.need.task.supplierPick} —</option>{suppliers.map((x) => <option key={x.id} value={x.id}>{tx(x.name)}{x.city ? ` · ${tx(x.city)}` : ''} · {x.id}</option>)}<option value="new">+ {t.need.task.supplierNew}</option></select>
            {sid === 'new' ? <input className="np-offer-new" aria-label={t.need.task.supplierName} placeholder={t.need.task.supplierName} value={f[`sup${i}`] || ''} onChange={(e) => set(`sup${i}`, e.target.value)} /> : null}
            <select className="select-in np-offer-cur" aria-label={t.need.task.currency} value={cur} onChange={(e) => set(`cur${i}`, e.target.value)}>{CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
            {cur !== 'SAR' ? <input aria-label={t.need.task.fxAmount} className="num np-offer-fx" dir="ltr" type="number" min={0} placeholder={t.need.task.fxAmount} value={f[`fx${i}`] || ''} onChange={(e) => set(`fx${i}`, e.target.value)} /> : null}
            <input aria-label={cur !== 'SAR' ? t.need.task.amountSar : t.need.task.amount} className="num np-offer-amt" dir="ltr" type="number" min={0} placeholder={cur !== 'SAR' ? t.need.task.amountSar : t.need.task.amount} value={f[`amt${i}`] || ''} onChange={(e) => set(`amt${i}`, e.target.value)} />
            <input aria-label={t.need.task.validUntil} className="num np-offer-val" dir="ltr" type="date" value={f[`val${i}`] || ''} onChange={(e) => set(`val${i}`, e.target.value)} />
            <label className={`btn ${f[`att${i}`] ? 'soft' : 'secondary'} sm np-offer-att`} style={{ cursor: 'pointer' }}><I.clip />{f[`att${i}`] ? <span className="np-file-name">{f[`att${i}`]}</span> : t.need.task.offerAttachment}<input id={`np-att-${i}`} type="file" style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }} onChange={(e) => set(`att${i}`, e.target.files?.[0]?.name || '')} /></label>
          </div>
        ); })}
        <div style={{ padding: '4px 14px 8px' }}><button type="button" className="btn soft" onClick={() => set('rows', String(rows + 1))}><I.plus />{t.need.task.addOffer}</button></div>
        {shortfall ? <><div style={{ padding: '0 14px 6px' }}><Notice tone="warn" icon="alert">{fill(t.need.task.shortfallHint, { n: String(min) })}</Notice></div><Field id="np-shortfall" label={t.need.task.shortfallWhy}><input id="np-shortfall" value={f.shortfallWhy || ''} onChange={(e) => set('shortfallWhy', e.target.value)} /></Field></> : null}
        <div style={{ height: 6 }} />
        <motion.button type="button" className="btn primary block lg" disabled={!ok} onClick={() => { dispatch({ type: 'needQuotes', requestId: r.id, actorId: me.id, input: { offers, shortfallWhy: shortfall ? f.shortfallWhy.trim() : undefined } }); done(t.need.task.confirmQuotes, `${offers.length}`); }} whileTap={{ scale: 0.97 }}><I.check />{missingAtt ? t.need.task.attachmentRequired : shortfall ? t.need.task.confirmQuotesShort : t.need.task.confirmQuotes}</motion.button>
      </Group>
    );
  }
  if (role === 'evaluator') {
    const list = n.procurement?.offers?.list || []; const pick = f.offer || ''; const ok = (pick || '').trim() && (f.evalNote || '').trim();
    const lowest = list.length ? Math.min(...list.map((o) => o.amount)) : 0;
    return (
      <Group>
        <div className="np-head"><b>{t.need.task.evalTitle}</b><span className="cell-sub">{n.procurement?.offers ? `${t.need.card.offers}: ${n.procurement.offers.count}` : ''}{n.procurement?.reservation ? ` · ${t.need.card.reserved}: ${n.procurement.reservation.amount.toLocaleString('en')}` : ''}{n.awardRule === 'exception' ? ` · ${t.need.task.awardAutoHint}` : ''}</span></div>
        {list.length ? <div className="np-pick">{list.map((o, i) => <button key={i} type="button" className={`np-pick-row ${pick === o.supplier ? 'on' : ''}`} aria-pressed={pick === o.supplier} onClick={() => set('offer', o.supplier)}><span className="np-pick-dot">{pick === o.supplier ? <I.check /> : null}</span><span className="np-pick-main"><b>{o.supplier}</b><span className="cell-sub">{o.validUntil ? `${t.need.task.validUntil} ${o.validUntil}` : ''}{o.attachment ? `${o.validUntil ? ' · ' : ''}${o.attachment}` : ''}{o.amount === lowest ? ` · ${lang === 'ar' ? 'الأدنى' : 'lowest'}` : ''}</span></span><b className="num">{o.amount.toLocaleString('en')}</b></button>)}</div>
          : <Field id="np-offer" label={t.need.task.offer}><input id="np-offer" value={pick} onChange={(e) => set('offer', e.target.value)} placeholder={lang === 'ar' ? 'اسم المورّد' : 'Supplier'} /></Field>}
        <Field id="np-evalnote" label={t.need.task.evalNote}><textarea id="np-evalnote" rows={2} value={f.evalNote || ''} onChange={(e) => set('evalNote', e.target.value)} /></Field>
        <FilePick id="np-evalatt" label={t.need.task.evalAttachment} value={f.evalAtt || ''} onChange={(v) => set('evalAtt', v)} />
        <div style={{ height: 10 }} />
        <motion.button type="button" className="btn primary block lg" disabled={!ok} onClick={() => { const o = list.find((x) => x.supplier === pick); dispatch({ type: 'needEvaluate', requestId: r.id, actorId: me.id, input: { offer: pick.trim(), amount: o?.amount, note: f.evalNote.trim(), attachment: f.evalAtt || undefined } }); done(t.need.task.confirmEval); }} whileTap={{ scale: 0.97 }}><I.check />{t.need.task.confirmEval}</motion.button>
      </Group>
    );
  }
  if (role === 'budget' || role === 'budgetTopUp') {
    const topUp = role === 'budgetTopUp'; const p = n.procurement; const suggested = topUp ? p?.recommendation?.amount ?? p?.estimatedValue ?? 0 : p?.estimatedValue ?? n.estimatedValue ?? 0;
    const amt = f.amount !== undefined ? f.amount : String(suggested || '');
    return (
      <Group>
        <div className="np-head"><b>{topUp ? t.need.task.topUpTitle : t.need.task.budgetTitle}</b><span className="cell-sub">{topUp ? `${t.need.task.topUpHint} · ${t.need.card.reserved}: ${(p?.reservation?.amount || 0).toLocaleString('en')} · ${t.need.card.recommendation}: ${(p?.recommendation?.amount || 0).toLocaleString('en')}` : t.need.task.budgetHint}</span></div>
        <div className="np-two"><Field id="np-budget" label={topUp ? `${t.need.task.reservationNo} (${t.newReq.optional})` : t.need.task.reservationNo} error={err || undefined}><input id="np-budget" className="mono" dir="ltr" placeholder={topUp ? p?.reservation?.no || '' : 'FM-2026-0000'} value={f.ref || ''} onChange={(e) => { set('ref', e.target.value); setErr(''); }} /></Field><Field id="np-amount" label={topUp ? t.need.task.newAmount : t.need.task.reservedAmount}><input id="np-amount" className="num" dir="ltr" type="number" min={0} value={amt} onChange={(e) => set('amount', e.target.value)} /></Field></div>
        <div style={{ height: 10 }} />
        <motion.button type="button" className="btn primary block lg" disabled={!(Number(amt) > 0)} onClick={() => { if (!topUp && !(f.ref || '').trim()) { setErr(t.need.task.required); return; } dispatch({ type: 'needBudget', requestId: r.id, actorId: me.id, ref: (f.ref || '').trim(), amount: Number(amt) }); done(topUp ? t.need.task.confirmTopUp : t.need.task.confirmReserve, f.ref); }} whileTap={{ scale: 0.97 }}><I.check />{topUp ? t.need.task.confirmTopUp : t.need.task.confirmReserve}</motion.button>
      </Group>
    );
  }
  if (role === 'tender') {
    /* v0.11: المورّد الفائز من قائمة شركاء الأعمال، ومحضر اللجنة مرفقاً إلزامياً */
    const suppliers = (state.erp.suppliers || []).filter((x) => !x.blocked);
    const ok = (f.tref || '').trim() && (f.tres || '').trim() && (f.tsid || '').trim() && Number(f.tamt) > 0 && (f.tatt || '').trim();
    return (
      <Group>
        <div className="np-head"><b>{t.need.task.tenderTitle}</b><span className="cell-sub">{t.need.task.tenderWhy} · {(n.procurement?.estimatedValue || 0).toLocaleString('en')}</span></div>
        <Field id="np-tref" label={t.need.task.tenderRef}><input id="np-tref" className="mono" dir="ltr" placeholder="TND-2026-00" value={f.tref || ''} onChange={(e) => set('tref', e.target.value)} /></Field>
        <Field id="np-tres" label={t.need.task.tenderResult}><input id="np-tres" value={f.tres || ''} onChange={(e) => set('tres', e.target.value)} /></Field>
        <div className="field"><label htmlFor="np-tsup">{t.need.task.tenderSupplier}</label><select id="np-tsup" className="select-in" value={f.tsid || ''} onChange={(e) => set('tsid', e.target.value)}><option value="">— {t.need.task.supplierPick} —</option>{suppliers.map((x) => <option key={x.id} value={x.id}>{tx(x.name)} · {x.id}</option>)}</select></div>
        <Field id="np-tamt" label={t.need.task.tenderAmount}><input id="np-tamt" className="num" dir="ltr" type="number" min={0} value={f.tamt || ''} onChange={(e) => set('tamt', e.target.value)} /></Field>
        <FilePick id="np-tatt" label={t.need.task.tenderMinutes} value={f.tatt || ''} onChange={(v) => set('tatt', v)} required />
        <div style={{ height: 10 }} />
        <motion.button type="button" className="btn primary block lg" disabled={!ok} onClick={() => { const sup = suppliers.find((x) => x.id === f.tsid); dispatch({ type: 'needTender', requestId: r.id, actorId: me.id, input: { ref: f.tref.trim(), result: f.tres.trim(), supplier: sup?.name.ar, supplierId: f.tsid, amount: Number(f.tamt), attachment: f.tatt } }); done(t.need.task.confirmTender, f.tref); }} whileTap={{ scale: 0.97 }}><I.check />{t.need.task.confirmTender}</motion.button>
      </Group>
    );
  }
  if (role === 'po') {
    const manual = content.rules.erpNumbers === 'manual'; const lead = content.rules.leadDays || 14; const p = n.procurement || {};
    const exp = f.exp || toISO(Date.now() + lead * 86400000); const ok = manual ? (f.po || '').trim() && exp : !!exp;
    return (
      <Group>
        <div className="np-head"><b>{manual ? t.need.task.poTitle : t.need.task.poErpTitle}</b><span className="cell-sub">{manual ? t.need.task.poManualHint : t.need.task.poErpHint}</span></div>
        <div className="np-erp">
          <span><i>{t.need.card.pr}</i><b className="mono">{p.prNo || '—'}</b></span>
          {p.award ? <span><i>{t.need.task.supplier}</i><b>{p.award.supplier}{p.award.supplierId ? <> <span className="mono cell-sub">{p.award.supplierId}</span></> : null}</b></span> : null}
          {p.award ? <span><i>{t.need.task.amount}</i><b className="num">{p.award.amount.toLocaleString('en')}</b></span> : null}
          {p.contractNo ? <span><i>{t.need.card.contract}</i><b className="mono">{p.contractNo}{p.releaseOrderNo ? ` · ${p.releaseOrderNo}` : ''}</b></span> : null}
          {p.reservation ? <span><i>{t.need.card.fundsReservation}</i><b className="mono">{p.reservation.no}</b></span> : null}
        </div>
        {manual ? <Field id="np-po" label={t.need.task.poNo}><input id="np-po" className="mono" dir="ltr" placeholder="4500012900" value={f.po || ''} onChange={(e) => set('po', e.target.value)} /></Field> : null}
        <Field id="np-exp" label={manual ? t.need.task.expectedAt : t.need.task.poLead}><input id="np-exp" type="date" dir="ltr" value={exp} onChange={(e) => set('exp', e.target.value)} /></Field>
        <div style={{ height: 10 }} />
        <motion.button type="button" className="btn primary block lg" disabled={!ok} onClick={() => { dispatch({ type: 'needPO', requestId: r.id, actorId: me.id, input: { poNo: manual ? f.po.trim() : undefined, expectedAt: exp } }); done(manual ? t.need.task.confirmPo : t.need.task.poErpBtn, manual ? f.po : undefined); }} whileTap={{ scale: 0.97 }}><I.check />{manual ? t.need.task.confirmPo : t.need.task.poErpBtn}</motion.button>
      </Group>
    );
  }
  if (role === 'receipt') return <ReceiptPanel r={r} st={st} me={me} done={done} />;
  if (role === 'receiptSign') {
    const rc = (n.procurement?.receipts || []).find((x) => x.status === 'signing'); if (!rc) return null;
    const pending = rc.signers.filter((x) => !rc.signatures.some((y) => y.personId === x.personId)); const mine = pending.some((x) => x.personId === me.id);
    const nm = (id: string) => { const who = personById(state, id); return who ? (lang === 'ar' ? who.name : who.nameEn) : ''; };
    return (
      <Group>
        <div className="np-head"><b>{rc.kind === 'material' ? t.need.task.recTitleMat : t.need.task.recTitleSvc}{rc.batch > 1 ? ` · ${fill(t.need.task.recBatch, { n: rc.batch })}` : ''}</b><span className="cell-sub">{rc.signatures.map((x) => `${t.need.task.recSigned} ${nm(x.personId)}`).join(' · ')}{pending.length ? ` · ${t.need.task.recAwaiting} ${pending.map((x) => nm(x.personId)).join('، ')}` : ''}</span></div>
        <div className="np-doc"><ReceiptDocument r={r} receipt={rc} draft /></div>
        <div style={{ height: 10 }} />
        <motion.button type="button" className="btn primary block lg" disabled={!mine} onClick={() => { dispatch({ type: 'needReceiptSign', requestId: r.id, actorId: me.id }); done(t.need.task.recSignOnly); }} whileTap={{ scale: 0.97 }}><I.pen />{t.need.task.recSignOnly}</motion.button>
      </Group>
    );
  }
  if (role === 'handover') {
    const ready = readyLines(n); const ben = personById(state, n.beneficiaryId); const batch = st.batch || 1;
    return (
      <Group>
        <div className="np-head"><b>{t.need.task.handoverTitle}{batch > 1 ? ` · ${fill(t.need.task.handoverBatch, { n: batch })}` : ''}</b><span className="cell-sub">{t.need.task.handoverHint}</span></div>
        <ul className="nc-lines" style={{ padding: '0 14px 8px' }}>{ready.map((l) => <li key={l.id}><span className="nc-line-name">{tx(l.name)} <span className="num">× {readyQty(l)}</span>{readyQty(l) < l.qty ? <span className="cell-sub"> {lang === 'ar' ? 'من' : 'of'} {l.qty}</span> : null}</span><Pill tone="ok" icon="check">{t.need.task.ready}</Pill></li>)}</ul>
        <div style={{ padding: '0 14px 12px' }}><Notice tone="tint" icon="person">{lang === 'ar' ? 'المستلم' : 'Receiver'}: {ben ? (lang === 'ar' ? ben.name : ben.nameEn) : ''}</Notice></div>
        <motion.button type="button" className="btn primary block lg" onClick={() => { dispatch({ type: 'needHandoverStart', requestId: r.id, actorId: me.id }); done(t.need.task.startHandover); }} whileTap={{ scale: 0.97 }}><I.pen />{t.need.task.startHandover}</motion.button>
      </Group>
    );
  }
  if (role === 'handoverSign') {
    const h = n.handover; const rows = (h?.lines && h.lines.length ? h.lines : readyLines(n).map((l) => ({ lineId: l.id, qty: readyQty(l) }))).map((x) => ({ x, l: n.lines.find((y) => y.id === x.lineId)! })).filter((z) => !!z.l); const issuer = h?.startedBy ? personById(state, h.startedBy) : undefined;
    return (
      <Group>
        <div className="np-head"><b>{t.need.task.signTitle}{(h?.batch || 1) > 1 ? ` · ${fill(t.need.task.handoverBatch, { n: h!.batch! })}` : ''}</b><span className="cell-sub">{t.need.task.signHint}</span></div>
        <ul className="nc-lines" style={{ padding: '0 14px 8px' }}>{rows.map((z) => <li key={z.l.id}><span className="nc-line-name">{tx(z.l.name)} <span className="num">× {z.x.qty}</span></span><Pill tone="ok" icon="check">{t.need.task.ready}</Pill></li>)}</ul>
        {issuer ? <div style={{ padding: '0 14px 12px' }}><Notice tone="tint" icon="pen">{lang === 'ar' ? 'المسلِّم' : 'Issuer'}: {lang === 'ar' ? issuer.name : issuer.nameEn} · {fmtDate(n.handover!.startedAt!, lang, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</Notice></div> : null}
        <motion.button type="button" className="btn primary block lg" onClick={() => { dispatch({ type: 'needHandoverSign', requestId: r.id, actorId: me.id }); done(t.need.task.sign); }} whileTap={{ scale: 0.97 }}><I.pen />{t.need.task.sign}</motion.button>
      </Group>
    );
  }
  return null;
}

/* ——— v0.12 (D-026، D-027): لوحة الاستلام — المحضر مملوء من ملف الشراء، يكمله مسؤول الاستلام ويعاينه ويوقّعه؛ والاستلام على دفعات؛ وإقفال المتبقي ——— */
type RecLine = { delivered: string; accepted: string; result: ReceiptLineResult; note: string };
function ReceiptPanel({ r, st, me, done }: { r: Request; st: Step; me: Person; done: (title: string, sub?: string) => void }) {
  const { state, dispatch } = useStore(); const { lang, t, tx } = useLang(); const n = r.need!; const material = n.kind === 'material'; const p = n.procurement || {};
  const content = needContent(state); const rules = content.rules; const batch = st.batch || 1;
  const bought = n.lines.filter((l) => l.status === 'purchasing' && remainingQty(l) > 0);
  const [lines, setLines] = useState<Record<string, RecLine>>(() => Object.fromEntries(bought.map((l) => [l.id, { delivered: String(remainingQty(l)), accepted: String(remainingQty(l)), result: 'ok' as ReceiptLineResult, note: '' }])));
  const setLine = (id: string, patch: Partial<RecLine>) => setLines((x) => ({ ...x, [id]: { ...x[id], ...patch } }));
  const [meta, setMeta] = useState({ supNo: '', supDate: '', notes: '', remedy: String(rules.remedyDays ?? 5), att: '', from: '', to: '', value: p.award?.amount ? String(p.award.amount) : '', last: true, status: 'ok' as 'ok' | 'note' | 'rejected' });
  const [criteria, setCriteria] = useState<{ text: string; evidence: string; ok: boolean }[]>(() => n.lines.filter((l) => l.status === 'purchasing').map((l) => ({ text: tx(l.name), evidence: '', ok: true })));
  const [preview, setPreview] = useState(false); const [closing, setClosing] = useState(false); const [closeWhy, setCloseWhy] = useState('');
  const committee = material ? inspectionNeeded(state, r) : true; const others = receiptSigners(state, r, me.id).filter((x) => material || x.role === 'buyer');
  const names = others.map((o) => { const who = personById(state, o.personId); return who ? (lang === 'ar' ? who.name : who.nameEn) : ''; }).filter(Boolean).join(lang === 'ar' ? ' و' : ' and ');
  const prog = receiptProgress(n);
  const input = (): ReceiptInput => material
    ? { supplierNote: meta.supNo ? { no: meta.supNo, date: meta.supDate || undefined } : undefined, attachment: meta.att || undefined, notes: meta.notes || undefined, remedyDays: Number(meta.remedy) || undefined, lines: bought.map((l) => { const x = lines[l.id]; const delivered = Math.max(0, Number(x.delivered) || 0); const accepted = Math.max(0, Math.min(Number(x.accepted) || 0, delivered)); return { lineId: l.id, delivered, accepted, result: x.result === 'ok' && accepted < delivered ? (accepted === 0 ? 'rejected' as const : 'short' as const) : x.result, note: x.note || undefined }; }) }
    : { attachment: meta.att || undefined, notes: meta.notes || undefined, remedyDays: Number(meta.remedy) || undefined, period: meta.from && meta.to ? { from: meta.from, to: meta.to } : undefined, value: Number(meta.value) || undefined, criteria: criteria.filter((c) => c.text.trim()), last: meta.last, status: meta.status };
  const draft = (): NeedReceipt => { const inp = input(); const rl = material ? inp.lines!.map((x) => { const l = n.lines.find((y) => y.id === x.lineId)!; return { lineId: x.lineId, ordered: l.qty, before: l.received || 0, delivered: x.delivered, accepted: x.accepted, result: x.result, note: x.note }; }) : bought.map((l) => ({ lineId: l.id, ordered: l.qty, before: l.received || 0, delivered: meta.status === 'rejected' ? 0 : meta.last ? remainingQty(l) : 0, accepted: meta.status === 'rejected' ? 0 : meta.last ? remainingQty(l) : 0, result: (meta.status === 'rejected' ? 'rejected' : meta.status === 'note' ? 'note' : 'ok') as ReceiptLineResult }));
    const accepted = rl.reduce((a, x) => a + x.accepted, 0); const result: NeedReceipt['result'] = material ? (!accepted ? 'rejected' : rl.some((x) => x.result === 'short' || x.result === 'rejected' || x.accepted < x.delivered) ? 'partial' : rl.some((x) => x.result === 'note') ? 'note' : 'ok') : meta.status === 'rejected' ? 'rejected' : meta.status === 'note' ? 'note' : 'ok';
    return { id: `RC-${r.id}-${batch}`, kind: n.kind, batch, at: Date.now(), by: me.id, status: 'signing', supplierNote: inp.supplierNote, attachment: inp.attachment, lines: rl, result, notes: inp.notes, remedyDays: result === 'ok' ? undefined : inp.remedyDays, period: inp.period, value: inp.value, criteria: inp.criteria, last: material ? undefined : meta.last, committee, signers: [{ personId: me.id, role: 'officer' }, ...(committee ? others : [])], signatures: [] }; };
  const valid = material ? bought.every((l) => { const x = lines[l.id]; const d = Number(x.delivered); const a = Number(x.accepted); return d >= 0 && a >= 0 && a <= d && a <= remainingQty(l); }) : (meta.status === 'rejected' || (Number(meta.value) > 0));
  const send = () => { dispatch({ type: 'needReceipt', requestId: r.id, actorId: me.id, input: input() }); done(committee && others.length ? t.need.task.recSignSend : t.need.task.recSign); };
  const closeIt = () => { if (!closeWhy.trim()) return; dispatch({ type: 'needCloseRemainder', requestId: r.id, actorId: me.id, why: closeWhy.trim() }); done(t.need.task.closeDone); };
  if (preview) {
    const d = draft();
    return (
      <Group>
        <div className="np-head"><b>{material ? t.need.task.recTitleMat : t.need.task.recTitleSvc}{batch > 1 ? ` · ${fill(t.need.task.recBatch, { n: batch })}` : ''}</b><span className="cell-sub">{committee && others.length ? fill(t.need.task.recCommittee, { names }) : t.need.task.recSingle}</span></div>
        <div className="np-doc"><ReceiptDocument r={r} receipt={d} draft /></div>
        {d.result === 'rejected' ? <div style={{ padding: '8px 14px 0' }}><Notice tone="warn" icon="alert">{t.need.task.recRejectedHint}</Notice></div> : null}
        <div className="np-actions">
          <motion.button type="button" className="btn secondary" onClick={() => setPreview(false)} whileTap={{ scale: 0.97 }}>{t.need.task.recBack}</motion.button>
          <motion.button type="button" className="btn primary lg" id="np-rec-sign" onClick={send} whileTap={{ scale: 0.97 }}><I.pen />{committee && others.length ? t.need.task.recSignSend : t.need.task.recSign}</motion.button>
        </div>
      </Group>
    );
  }
  return (
    <Group>
      <div className="np-head"><b>{material ? t.need.task.recTitleMat : t.need.task.recTitleSvc}{batch > 1 ? ` · ${fill(t.need.task.recBatch, { n: batch })}` : ''}</b><span className="cell-sub">{p.poNo ? `${t.need.card.po} ${p.poNo}` : ''}{p.award ? ` · ${p.award.supplier}` : ''}{material && prog.total ? ` · ${fill(t.need.task.recProgress, { a: prog.received, b: prog.total })}` : ''}</span></div>
      <p className="cell-sub" style={{ padding: '0 14px 6px' }}>{t.need.task.recHint}</p>
      {committee && others.length ? <div style={{ padding: '0 14px 8px' }}><Notice tone="tint" icon="shield">{fill(t.need.task.recCommittee, { names })}</Notice></div> : null}
      {material ? bought.map((l) => { const x = lines[l.id]; const rem = remainingQty(l); return (
        <div key={l.id} className="np-line np-rec">
          <div className="np-line-main"><b>{tx(l.name)}</b><span className="cell-sub">{t.need.task.recRemaining}: <span className="num">{rem}</span> {tx(l.unit)}{(l.received || 0) > 0 ? ` · ${fill(t.need.task.recProgress, { a: l.received || 0, b: l.qty })}` : ''}</span></div>
          <div className="np-three">
            <Field id={`rec-del-${l.id}`} label={t.need.task.recDelivered}><input id={`rec-del-${l.id}`} className="num" dir="ltr" type="number" min={0} value={x.delivered} onChange={(e) => { const d = e.target.value; setLine(l.id, { delivered: d, accepted: String(Math.min(Number(d) || 0, rem, Number(x.accepted) || 0) || Math.min(Number(d) || 0, rem)) }); }} /></Field>
            <Field id={`rec-acc-${l.id}`} label={t.need.task.recAccepted}><input id={`rec-acc-${l.id}`} className="num" dir="ltr" type="number" min={0} max={rem} value={x.accepted} onChange={(e) => setLine(l.id, { accepted: e.target.value })} /></Field>
            <label className="field"><span className="np-file-label">{t.need.task.recResult}</span><select className="select-in np-rec-result" value={x.result} onChange={(e) => setLine(l.id, { result: e.target.value as ReceiptLineResult })}>{(['ok', 'note', 'short', 'rejected'] as const).map((k) => <option key={k} value={k}>{t.need.task.recResultOpts[k]}</option>)}</select></label>
          </div>
          {x.result !== 'ok' ? <Field id={`rec-note-${l.id}`} label={t.need.task.recLineNote}><input id={`rec-note-${l.id}`} value={x.note} onChange={(e) => setLine(l.id, { note: e.target.value })} /></Field> : null}
        </div>
      ); }) : (
        <div className="np-line np-rec">
          <div className="np-two"><Field id="rec-from" label={t.need.task.recPeriodFrom}><input id="rec-from" type="date" dir="ltr" value={meta.from} onChange={(e) => setMeta((m) => ({ ...m, from: e.target.value }))} /></Field><Field id="rec-to" label={t.need.task.recPeriodTo}><input id="rec-to" type="date" dir="ltr" value={meta.to} onChange={(e) => setMeta((m) => ({ ...m, to: e.target.value }))} /></Field></div>
          <div className="np-two"><Field id="rec-value" label={t.need.task.recValue}><input id="rec-value" className="num" dir="ltr" type="number" min={0} value={meta.value} onChange={(e) => setMeta((m) => ({ ...m, value: e.target.value }))} /></Field><label className="field"><span className="np-file-label">{t.need.task.recStatus}</span><select id="rec-status" className="select-in" value={meta.status} onChange={(e) => setMeta((m) => ({ ...m, status: e.target.value as typeof m.status }))}>{(['ok', 'note', 'rejected'] as const).map((k) => <option key={k} value={k}>{t.need.task.recStatusOpts[k]}</option>)}</select></label></div>
          <div className="np-criteria"><b>{t.need.task.recCriteria}</b>{criteria.map((c, i) => <div key={i} className="np-crit"><input aria-label={t.need.task.recCriteria} value={c.text} onChange={(e) => setCriteria((cs) => cs.map((y, k) => (k === i ? { ...y, text: e.target.value } : y)))} /><input aria-label={t.need.task.recEvidence} placeholder={t.need.task.recEvidence} value={c.evidence} onChange={(e) => setCriteria((cs) => cs.map((y, k) => (k === i ? { ...y, evidence: e.target.value } : y)))} /><label className="sw"><input className="switch" type="checkbox" checked={c.ok} onChange={(e) => setCriteria((cs) => cs.map((y, k) => (k === i ? { ...y, ok: e.target.checked } : y)))} /><span>{t.need.task.recMet}</span></label></div>)}</div>
          <label className="sw" style={{ padding: '4px 0' }}><span>{t.need.task.recLast}</span><input id="rec-last" className="switch" type="checkbox" checked={meta.last} onChange={(e) => setMeta((m) => ({ ...m, last: e.target.checked }))} /></label>
        </div>
      )}
      {material ? <div className="np-two" style={{ padding: '0 14px' }}><Field id="rec-supno" label={`${t.need.task.recSupplierNote} (${t.newReq.optional})`}><input id="rec-supno" className="mono" dir="ltr" value={meta.supNo} onChange={(e) => setMeta((m) => ({ ...m, supNo: e.target.value }))} /></Field><Field id="rec-supdate" label={t.need.task.recSupplierDate}><input id="rec-supdate" type="date" dir="ltr" value={meta.supDate} onChange={(e) => setMeta((m) => ({ ...m, supDate: e.target.value }))} /></Field></div> : null}
      <div style={{ padding: '0 14px' }}>
        <Field id="rec-notes" label={`${t.need.task.recNotes} (${t.newReq.optional})`}><textarea id="rec-notes" rows={2} value={meta.notes} onChange={(e) => setMeta((m) => ({ ...m, notes: e.target.value }))} /></Field>
        {material && bought.some((l) => { const x = lines[l.id]; return x.result !== 'ok' || Number(x.accepted) < Number(x.delivered); }) || (!material && meta.status !== 'ok') ? <Field id="rec-remedy" label={t.need.task.recRemedy}><input id="rec-remedy" className="num" dir="ltr" type="number" min={1} value={meta.remedy} onChange={(e) => setMeta((m) => ({ ...m, remedy: e.target.value }))} /></Field> : null}
        <FilePick id="np-recatt" label={t.need.task.recAttachment} value={meta.att} onChange={(v) => setMeta((m) => ({ ...m, att: v }))} />
      </div>
      <div style={{ height: 10 }} />
      <motion.button type="button" className="btn primary block lg" id="np-rec-preview" disabled={!valid} onClick={() => setPreview(true)} whileTap={{ scale: 0.97 }}><I.doc />{t.need.task.recPreview}</motion.button>
      {batch > 1 || prog.received > 0 ? (
        <div className="np-close">
          {closing ? <>
            <Notice tone="warn" icon="alert"><b>{t.need.task.closeTitle}</b> — {t.need.task.closeHint}</Notice>
            <Field id="np-closewhy" label={t.need.task.closeWhy}><input id="np-closewhy" value={closeWhy} onChange={(e) => setCloseWhy(e.target.value)} /></Field>
            <div className="np-actions"><button type="button" className="btn secondary" onClick={() => setClosing(false)}>{t.common.cancel}</button><motion.button type="button" className="btn danger" id="np-closebtn" disabled={!closeWhy.trim()} onClick={closeIt} whileTap={{ scale: 0.97 }}><I.x />{t.need.task.closeBtn}</motion.button></div>
          </> : <button type="button" className="btn quiet sm" id="np-closeopen" onClick={() => setClosing(true)}><I.x />{t.need.task.closeTitle}</button>}
        </div>
      ) : null}
    </Group>
  );
}
/** أدوار لها لوحة خاصة (غير الاعتماد العادي)؛ اعتماد الشراء والترسية اعتماد عادي مع ملخص الشراء */
export const NEED_PANEL_ROLES = ['entity', 'store', 'procurement', 'quotes', 'evaluator', 'budget', 'budgetTopUp', 'tender', 'po', 'receipt', 'receiptSign', 'handover', 'handoverSign'];
export const NEED_SUMMARY_ROLES = ['purchaseApproval', 'awardApproval'];
export function needTaskHint(role: string | undefined, t: ReturnType<typeof useLang>['t']): string | null { if (role === 'coordinator') return t.need.task.coordinator; if (role === 'purchaseApproval') return t.need.task.approveHint; if (role === 'awardApproval') return t.need.task.awardHint; return null; }
void methodOf; void linesValue; void SEGMENT_TITLE;
