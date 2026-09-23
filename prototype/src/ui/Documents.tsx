import React from 'react';
import { motion, SPRING } from './motion';
import { useLang } from './components';
import { useStore } from '../app/store';
import { personById, positionById, namesFor } from '../domain/engine';
import { serviceOfRequest, allFields, displayValue } from '../domain/designer';
import { fmtDate, daysText, workingDaysText, fill } from '../app/i18n';
import { hijriText, hijriMonthName, endOf, statusOf, DESK_TITLE, toISO, stepTitle, agentTitle, conditionText, cancelRuleOf, onCancelOf, touchedIn, type PolicyVersion, type ConfiguredService, type LeaveType, type CycleRule, type Touched } from '../domain/policy';
import { needContent, entityOf, needSummary, poolOf, categoryOf, receiptSigners } from '../domain/need';
import { useGroupNames } from './LeaveBits';
import type { Request, Doc, Person, T2, NeedReceipt } from '../domain/types';
import { QR } from './QR';
import emblem from '../assets/emblem.png';

/* ——— v0.12 (P-13): ورقة المستند الرسمي بهوية «مجموعة النماذج المطبوعة»: ترويسة ثنائية بالشعار في الوسط، وكتلة البيانات الأربع، وشريط العنوان بشارة النوع والمعيّن الذهبي، وكتلة التوقيع بالختم الإلكتروني، والتذييل الثلاثي برمز التحقق ورمز النموذج. الشكل من المجموعة، والمحتوى من إجرائنا ——— */
export function verifyCode(seed: string): string { let h = 2166136261; for (const ch of seed) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } const hex = h.toString(16).toUpperCase().padStart(8, '0'); return `GS-${hex.slice(0, 4)}-${hex.slice(4, 8)}`; }
export interface SheetMeta { k: string; v: React.ReactNode; strong?: boolean; mono?: boolean; sub?: React.ReactNode }
export interface SheetSign { role: string; name?: string; sub?: string; at?: number; kind: 'seal' | 'sign' | 'line' }
export function DocSheet({ code, version = '1.0', office, meta, badge, title, children, signs, aside, appendix, number, classification, seed, still, draft, tone }: { code?: string; version?: string; office?: T2; meta: SheetMeta[]; badge: string; title: string; children: React.ReactNode; signs?: SheetSign[]; aside?: React.ReactNode; appendix?: React.ReactNode; number: string; classification?: string; seed: string; still?: boolean; draft?: boolean; tone?: 'green' | 'gold' }) {
  const { lang, t } = useLang(); const d = t.doc;
  const anim = still ? {} : { initial: { opacity: 0, y: 16, rotateX: 6 }, animate: { opacity: 1, y: 0, rotateX: 0 }, transition: { ...SPRING.soft, delay: 0.08 }, style: { transformPerspective: 900 } };
  const dateOf = (at?: number) => (at ? fmtDate(at, 'en', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '');
  return (
    <motion.div className={`doc-preview official docsheet ${draft ? 'draft' : ''} ${tone === 'gold' ? 'gold' : ''}`} dir={lang === 'ar' ? 'rtl' : 'ltr'} {...anim}>
      <div className="sh-head">
        <div className="sh-org sh-ar" dir="rtl"><b>{d.orgAr1}</b><span>{d.orgAr2}</span><small>{d.gaAr}</small>{office ? <small className="sh-office">{office.ar}</small> : null}</div>
        <img className="sh-emblem" src={emblem} alt="" />
        <div className="sh-org sh-en" dir="ltr"><b>{d.orgEn1}</b><span>{d.orgEn2}</span><small>{d.gaEn}</small>{office ? <small className="sh-office">{office.en}</small> : null}</div>
      </div>
      <div className="sh-meta">{meta.map((m, i) => <div key={i} className="sh-cell"><i>{m.k}</i><b className={`${m.strong ? 'strong' : ''} ${m.mono ? 'mono' : ''}`} dir={m.mono ? 'ltr' : undefined}>{m.v}</b>{m.sub ? <small>{m.sub}</small> : null}</div>)}</div>
      <div className="sh-title"><span className="sh-badge">{badge}</span><h3>{title}</h3><span className="sh-diamond" aria-hidden="true"><i /></span></div>
      <div className="sh-body">{children}</div>
      {signs && signs.length ? (
        <div className={`dp-sign sh-signs ${aside ? 'with-aside' : ''}`}>
          {signs.map((sg, i) => (
            <div key={i} className={`sh-sig k-${sg.kind}`}>
              <i>{sg.role}</i>
              <b>{sg.name || '—'}</b>
              {sg.sub ? <small>{sg.sub}</small> : null}
              {sg.kind === 'seal' ? <motion.span className="sh-seal" initial={still ? false : { scale: 1.8, opacity: 0, rotate: -14 }} animate={{ scale: 1, opacity: 1, rotate: -6 }} transition={{ type: 'spring', stiffness: 360, damping: 18, delay: 0.5 }}><img src={emblem} alt="" /><span>{d.eSigned}</span><small className="num">{dateOf(sg.at)}</small><em>{d.portalName}</em></motion.span>
                : sg.kind === 'sign' ? <span className="sh-esign"><span>✓ {d.eSign}</span><small className="num">{sg.at ? fmtDate(sg.at, 'en', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</small></span>
                : <span className="sh-line"><span>{d.signature}</span><small>{d.pending}</small></span>}
            </div>
          ))}
          {aside ? <div className="sh-aside">{aside}</div> : null}
        </div>
      ) : aside ? <div className="dp-sign sh-signs"><div className="sh-aside">{aside}</div></div> : null}
      {appendix ? <div className="sh-chain">{appendix}</div> : null}
      <div className="dp-foot sh-foot">
        <span className="sh-foot-r"><b className="mono" dir="ltr">{number}</b>{classification ? <span> · {classification}</span> : null}</span>
        <span className="sh-foot-c"><span>{d.issued} <b className="mono" dir="ltr">{verifyCode(seed)}</b></span></span>
        <span className="sh-foot-l"><span className="dp-qr" aria-hidden="true"><QR seed={seed} /></span><span className="num">{fill(d.page, { n: 1, m: 1 })}</span></span>
      </div>
      <div className="sh-code">{code ? <>{d.form} <b className="mono" dir="ltr">{code}</b> · {d.version} {version}</> : <>{d.policy.internalDoc}</>}{draft ? <> · <span className="sh-draft-txt">{d.draft}</span></> : null}</div>
      {draft ? <span className="sh-draft">{d.draftStamp}</span> : null}
    </motion.div>
  );
}

/* ——— قرار الإجازة (TM-01) بصيغة القرار الإداري: الديباجة والمواد والموقّع من اعتمد فعلاً بمسمّاه، ونسخة إلى، وسلسلة الاعتماد كما وقعت ——— */
export function LeaveDecision({ r, doc, type, still }: { r: Request; doc: Doc; type?: LeaveType; still?: boolean }) {
  const { state } = useStore(); const { lang, t, tx } = useLang(); const d = t.leave.decision; const dd = t.doc;
  const p = personById(state, r.requesterId); const lv = r.leave!;
  const name = p ? (lang === 'ar' ? p.name : p.nameEn) : ''; const typeName = type ? tx(type.name) : lv.typeId;
  const version = state.policy.versions.find((v) => v.number === r.policyVersion);
  const ents = (lv.entitlements || []).map((id) => { const e = version?.content.entitlements.find((x) => x.id === id); return e ? tx(e.name) : id; });
  const slices = lv.payBreakdown || []; const partial = slices.some((s) => s.pay < 100);
  const payLine = type?.pay === 'unpaid' ? d.payNone : partial ? fill(d.payTiers, { slices: slices.map((s) => fill(d.slice, { days: daysText(s.days, lang), pay: s.pay })).join(lang === 'ar' ? '، ' : ', ') }) : d.payFull;
  const approvals = r.steps.filter((s) => s.status === 'done' && s.desk !== 'requester');
  const humans = approvals.filter((s) => s.actorId && s.actorId !== 'system' && s.mode !== 'notify' && !s.notifyOnly);
  const signerStep = humans[humans.length - 1]; const signer = signerStep?.actorId ? personById(state, signerStep.actorId) : undefined; const signerPos = signer?.positionId ? positionById(state, signer.positionId) : undefined;
  const chain = humans.slice(0, -1).map((s) => { const who = personById(state, s.actorId!); const pos = who?.positionId ? positionById(state, who.positionId) : undefined; return pos ? tx(pos.title) : who ? (lang === 'ar' ? who.title : who.titleEn) : tx(s.title); });
  const arts: { k: string; text: string }[] = [
    { k: d.first, text: fill(d.grant, { name, type: typeName, days: lv.halfDay ? d.halfDay : daysText(lv.days, lang), wd: workingDaysText(lv.workingDays, lang), from: lv.from, to: lv.to }) },
    { k: d.second, text: payLine },
    ...(ents.length ? [{ k: d.third, text: fill(d.ents, { list: ents.join(lang === 'ar' ? ' و' : ' and ') }) }] : []),
    { k: ents.length ? d.fourth : d.third, text: d.post },
  ];
  const payEffect = type?.pay !== 'paid' || approvals.some((s) => s.desk === 'payrollManager' || s.desk === 'payroll');
  const copies = [...dd.decision.copies.slice(0, 3), ...(payEffect ? [dd.decision.payrollCopy] : []), dd.decision.copies[3]];
  const iso = toISO(doc.at);
  return (
    <DocSheet code={doc.code || 'FR-HR-01'} office={{ ar: dd.officeHr, en: dd.officeHrEn }} number={doc.number || ''} classification={dd.restricted} seed={`${r.id}:${doc.number}`} still={still} badge={tx(doc.title)} title={fill(dd.decision.subject, { name, type: typeName })}
      meta={[{ k: dd.decision.no, v: doc.number || '', strong: true, mono: true }, { k: dd.date, v: fmtDate(doc.at, 'en', { day: '2-digit', month: '2-digit', year: 'numeric' }), mono: true, sub: `${dd.hijri} ${hijriText(iso, lang)}` }, { k: dd.requestRef, v: r.id, mono: true }, { k: dd.classification, v: dd.restricted, strong: true }]}
      signs={[{ role: dd.decision.authority, name: signer ? (lang === 'ar' ? signer.name : signer.nameEn) : t.desks.system, sub: signerPos ? tx(signerPos.title) : signer ? (lang === 'ar' ? signer.title : signer.titleEn) : undefined, at: signerStep?.at || doc.at, kind: 'seal' }]}
      aside={<><b className="sh-aside-title">{dd.copyTo}:</b><ul className="sh-copies">{copies.map((c, i) => <li key={i}>— {c}</li>)}</ul></>} appendix={<LeaveChain r={r} />}>
      <p className="sh-lead">{dd.decision.authorityIntro}</p>
      <p className="sh-p">{fill(dd.decision.basis1, { v: r.policyVersion || '' })}</p>
      <p className="sh-p">{fill(dd.decision.basis2, { id: r.id, name, no: p ? `GCC-${p.empNo}` : '', title: p ? (lang === 'ar' ? p.title : p.titleEn) : '', unit: p ? (lang === 'ar' ? p.unit : p.unitEn) : '', date: fmtDate(r.createdAt, 'en', { day: '2-digit', month: '2-digit', year: 'numeric' }), chain: chain.length ? `${dd.decision.chainPrefix}${chain.join(lang === 'ar' ? ' و' : ' and ')}` : '' })}</p>
      <p className="sh-p">{dd.decision.basis3}</p>
      <p className="sh-resolved">{dd.decision.resolved}</p>
      <ol className="dp-arts sh-arts">{arts.map((a) => <li key={a.k}><b>{a.k}</b><span>{a.text}</span></li>)}</ol>
      <p className="sh-closing">{dd.decision.closing}</p>
    </DocSheet>
  );
}
function LeaveChain({ r }: { r: Request }) {
  const { state } = useStore(); const { lang, t, tx } = useLang(); const d = t.leave.decision;
  const approvals = r.steps.filter((s) => s.status === 'done' && s.desk !== 'requester');
  return (
    <>
        <b className="dp-sec">{d.approvals}</b>
        <table className="dt small"><tbody>
          {approvals.map((s) => { const who = s.actorId && s.actorId !== 'system' ? personById(state, s.actorId) : undefined; const pos = who?.positionId ? positionById(state, who.positionId) : undefined; return <tr key={s.key}><td>{tx(s.title)}{s.ref ? <> · <span className="mono">{s.ref}</span></> : null}</td><td>{who ? `${lang === 'ar' ? who.name : who.nameEn} · ${pos ? tx(pos.title) : lang === 'ar' ? who.title : who.titleEn}` : s.desk === 'system' || s.mode === 'system' ? d.system : tx(DESK_TITLE[s.desk])}</td><td className="num" dir="ltr">{s.at ? fmtDate(s.at, 'en', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</td></tr>; })}
          {(r.fulfilments || []).filter((f) => f.status === 'done' && f.ref).map((f) => <tr key={f.id}><td>{tx(f.name)}</td><td>{f.actorId ? (personById(state, f.actorId)?.[lang === 'ar' ? 'name' : 'nameEn'] || '') : ''}</td><td className="num" dir="ltr"><span className="mono">{f.ref}</span></td></tr>)}
        </tbody></table>
        <p className="dp-meta"><span>{d.request}: <span className="mono">{r.id}</span></span><span>{d.version}: <span className="mono">{r.policyVersion}</span></span></p>
    </>
  );
}

/* ——— سند التسليم والاستلام (AS-01): سند لكل دفعة، بتوقيع المستلم وختم المسلِّم ——— */
export function HandoverNote({ r, doc, still }: { r: Request; doc: Doc; still?: boolean }) {
  const { state } = useStore(); const { lang, t, tx } = useLang(); const dd = t.doc; const n = r.need!;
  const h = (n.handovers || []).find((x) => x.number === (doc.refId || doc.number)) || n.handover;
  const ben = personById(state, n.beneficiaryId); const issuer = h?.startedBy ? personById(state, h.startedBy) : undefined; const issuerPos = h?.issuerPositionId ? positionById(state, h.issuerPositionId) : undefined;
  const content = needContent(state); const entity = entityOf(content, n.entityId); const cat = categoryOf(content, n.categoryId); const store = content.stores.find((s) => s.id === n.storeId); const site = content.sites.find((s) => s.id === n.siteId);
  const prov = !!n.provision;
  const rows = (h?.lines && h.lines.length ? h.lines : n.lines.filter((l) => l.status === 'delivered').map((l) => ({ lineId: l.id, qty: l.qty, materialDocNo: l.materialDocNo, assetNo: l.assetNo, ref: l.provisionRef }))).map((x) => ({ x, l: n.lines.find((y) => y.id === x.lineId)! })).filter((z) => !!z.l);
  const isCustody = (lineId: string) => { const l = n.lines.find((y) => y.id === lineId)!; const pool = poolOf(content, l.poolId); const item = state.erp.items.find((it) => it.id === (pool?.itemId || l.itemId)); return item ? item.custody : pool ? pool.custody : !!cat?.custody; };
  const docs = rows.map((z) => z.x.materialDocNo).filter(Boolean).join(lang === 'ar' ? '، ' : ', ');
  const name = ben ? (lang === 'ar' ? ben.name : ben.nameEn) : '';
  const vars = { ben: name, benTitle: ben ? (lang === 'ar' ? ben.title : ben.titleEn) : '', benUnit: ben ? (lang === 'ar' ? ben.unit : ben.unitEn) : '', issuer: issuer ? (lang === 'ar' ? issuer.name : issuer.nameEn) : '', issuerTitle: issuerPos ? tx(issuerPos.title) : issuer ? (lang === 'ar' ? issuer.title : issuer.titleEn) : '', id: r.id, batch: (h?.batch || 1) > 1 ? fill(dd.handover.batch, { n: h!.batch! }) : '', docs: docs ? fill(dd.handover.docs, { docs }) : '', entity: entity ? tx(entity.name) : '' };
  const placeName = prov ? (entity ? tx(entity.name) : '') : store ? tx(store.name) : site ? tx(site.name) : '';
  return (
    <DocSheet code={doc.code || 'FR-PR-01'} office={prov && entity ? { ar: `${dd.officeProc} · ${entity.name.ar}`, en: `${dd.officeProcEn} · ${entity.name.en}` } : { ar: dd.officeStores, en: dd.officeStoresEn }} number={doc.number || ''} seed={`${r.id}:${doc.number}`} still={still} badge={tx(doc.title)} title={needSummary(state, r, lang).lines}
      meta={[{ k: dd.handover.no, v: doc.number || '', strong: true, mono: true }, { k: dd.date, v: fmtDate(doc.at, 'en', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }), mono: true }, { k: dd.needRef, v: r.id, mono: true }, { k: prov ? dd.handover.entity : dd.handover.store, v: placeName, strong: true }]}
      signs={[{ role: dd.handover.receiver, name, sub: ben ? (lang === 'ar' ? ben.title : ben.titleEn) : undefined, at: h?.signedAt, kind: h?.signedAt ? 'sign' : 'line' }, { role: prov ? dd.handover.issuer : dd.handover.issuerStore, name: issuer ? (lang === 'ar' ? issuer.name : issuer.nameEn) : '', sub: issuerPos ? tx(issuerPos.title) : undefined, at: h?.startedAt, kind: 'seal' }]}>
      <p className="sh-p">{fill(prov ? dd.handover.introProvided : dd.handover.intro, vars)}</p>
      <table className="dt"><thead><tr><th>#</th><th>{dd.handover.item}</th><th>{dd.handover.qty}</th><th>{dd.handover.unit}</th><th>{dd.handover.kind}</th><th>{dd.handover.serial}</th></tr></thead><tbody>
        {rows.map((z, i) => <tr key={z.l.id}><td className="num">{i + 1}</td><td>{tx(z.l.name)}{z.l.itemId ? <> <span className="mono small">{z.l.itemId}</span></> : null}</td><td className="num">{z.x.qty}</td><td>{tx(z.l.unit)}</td><td>{isCustody(z.l.id) ? dd.handover.custody : dd.handover.consumable}</td><td className="mono">{z.x.assetNo || z.x.ref || '—'}</td></tr>)}
      </tbody></table>
      <p className="sh-note"><b>{dd.handover.custody}:</b> {dd.handover.custodyNote}</p>
    </DocSheet>
  );
}

/* ——— محضر الاستلام (D-026): محضر فحص واستلام للمواد، ومحضر استلام خدمة للخدمات — من ملف الشراء، بتوقيع مسؤول الاستلام ومن يلزم ——— */
export function ReceiptDocument({ r, receipt, still, draft }: { r: Request; receipt: NeedReceipt; still?: boolean; draft?: boolean }) {
  const { state } = useStore(); const { lang, t, tx } = useLang(); const dd = t.doc; const rd = dd.receipt; const n = r.need!; const p = n.procurement || {};
  const material = receipt.kind === 'material';
  const who = (id?: string) => (id ? personById(state, id) : undefined); const nm = (x?: Person) => (x ? (lang === 'ar' ? x.name : x.nameEn) : '');
  const posTitle = (x?: Person) => { const pos = x?.positionId ? positionById(state, x.positionId) : undefined; return pos ? tx(pos.title) : x ? (lang === 'ar' ? x.title : x.titleEn) : ''; };
  const officer = who(receipt.by);
  const signerDefs = receipt.signers.length ? receipt.signers : [{ personId: receipt.by, role: 'officer' as const }, ...(draft && receipt.committee ? receiptSigners(state, r, receipt.by).filter((x) => material || x.role === 'buyer') : [])];
  const supplier = p.award ? `${p.award.supplier}` : p.tender?.supplier || '—';
  const num = (x?: number) => (x ? x.toLocaleString('en') : '—');
  const number = receipt.no || (material ? 'INS-…' : 'REC-…');
  const roleLabel = (role: 'officer' | 'entity' | 'buyer') => (role === 'officer' ? (material ? (n.storeId ? rd.storekeeper : rd.officer) : rd.serviceOwner) : role === 'entity' ? rd.entityRep : rd.buyer);
  const signs: SheetSign[] = signerDefs.map((sg) => { const person = who(sg.personId); const sig = receipt.signatures.find((x) => x.personId === sg.personId); return { role: roleLabel(sg.role), name: nm(person), sub: posTitle(person), at: sig?.at, kind: sig ? (sg.role === 'officer' ? 'seal' : 'sign') : 'line' }; });
  const members = signerDefs.map((sg) => nm(who(sg.personId))).filter(Boolean).join(lang === 'ar' ? ' و' : ', ');
  const batchTxt = receipt.batch > 1 ? fill(rd.batch, { n: receipt.batch, id: r.id }) : fill(rd.first, { id: r.id });
  const noteTxt = receipt.supplierNote?.no ? fill(rd.note, { no: receipt.supplierNote.no, date: receipt.supplierNote.date ? fill(rd.noteDate, { date: receipt.supplierNote.date }) : '' }) : '';
  const title = needSummary(state, r, lang).lines;
  if (material) {
    return (
      <DocSheet code="FR-PR-04" office={{ ar: dd.officeStores, en: dd.officeStoresEn }} number={number} seed={`${r.id}:${receipt.id}`} still={still} draft={draft} badge={tx({ ar: 'محضر فحص واستلام', en: 'Inspection and receipt record' })} title={title}
        meta={[{ k: rd.no, v: number, strong: true, mono: true }, { k: dd.date, v: fmtDate(receipt.issuedAt || receipt.at, 'en', { day: '2-digit', month: '2-digit', year: 'numeric' }), mono: true }, { k: rd.po, v: p.poNo || '—', mono: true }, { k: rd.gr, v: receipt.erpNo || (draft ? rd.grPending : '—'), mono: !!receipt.erpNo }]}
        signs={signs}>
        <p className="sh-p">{fill(receipt.committee ? rd.introCommittee : rd.introOfficer, { members, officer: nm(officer), officerTitle: posTitle(officer), supplier, batch: batchTxt, note: noteTxt, result: rd.result[receipt.result] })}</p>
        <table className="dt"><thead><tr><th>#</th><th>{rd.item}</th><th>{rd.ordered}</th><th>{rd.before}</th><th>{rd.delivered}</th><th>{rd.accepted}</th><th>{rd.resultCol}</th></tr></thead><tbody>
          {receipt.lines.map((rl, i) => { const l = n.lines.find((y) => y.id === rl.lineId); return <tr key={rl.lineId}><td className="num">{i + 1}</td><td>{l ? tx(l.name) : rl.lineId}{l?.itemId ? <> <span className="mono small">{l.itemId}</span></> : null}</td><td className="num">{rl.ordered}</td><td className="num">{rl.before || '—'}</td><td className="num">{rl.delivered}</td><td className="num">{rl.accepted}</td><td>{rd.lineResult[rl.result]}{rl.note ? ` — ${rl.note}` : ''}</td></tr>; })}
        </tbody></table>
        <p className="sh-note"><b>{rd.notes}:</b> {receipt.notes || rd.noNotes}{receipt.result !== 'ok' && receipt.remedyDays ? ` — ${fill(rd.remedy, { n: receipt.remedyDays })}` : ''}</p>
      </DocSheet>
    );
  }
  const owner = officer; const status = receipt.result === 'rejected' ? rd.serviceStatus.rejected : receipt.result === 'note' ? rd.serviceStatus.note : rd.serviceStatus.ok;
  const criteria = receipt.criteria && receipt.criteria.length ? receipt.criteria : n.lines.map((l) => ({ text: tx(l.name), evidence: '', ok: receipt.result !== 'rejected' }));
  return (
    <DocSheet code="FR-PR-05" office={{ ar: dd.officeProc, en: dd.officeProcEn }} number={number} seed={`${r.id}:${receipt.id}`} still={still} draft={draft} badge={tx({ ar: 'محضر استلام خدمة', en: 'Service receipt record' })} title={title}
      meta={[{ k: rd.no, v: number, strong: true, mono: true }, { k: dd.date, v: fmtDate(receipt.issuedAt || receipt.at, 'en', { day: '2-digit', month: '2-digit', year: 'numeric' }), mono: true }, { k: rd.po, v: p.poNo || '—', mono: true }, { k: rd.value, v: `${num(receipt.value ?? p.award?.amount)} ${lang === 'ar' ? 'ر.س' : 'SAR'}`, strong: true, sub: receipt.erpNo ? <span className="mono" dir="ltr">{rd.ses} {receipt.erpNo}</span> : draft ? rd.grPending : undefined }]}
      signs={signs}>
      <p className="sh-p">{fill(rd.serviceIntro, { owner: nm(owner), ownerUnit: owner ? (lang === 'ar' ? owner.unit : owner.unitEn) : '', supplier, period: receipt.period ? fill(rd.period, { from: receipt.period.from, to: receipt.period.to }) : '', status })}</p>
      <table className="dt"><thead><tr><th>#</th><th>{rd.criterion}</th><th>{rd.evidence}</th><th>{rd.resultCol}</th></tr></thead><tbody>
        {criteria.map((c, i) => <tr key={i}><td className="num">{i + 1}</td><td>{c.text}</td><td>{c.evidence || '—'}</td><td>{c.ok ? `✓ ${rd.met}` : `✗ ${rd.notMet}`}</td></tr>)}
      </tbody></table>
      <p className="sh-note">{receipt.notes ? `${receipt.notes} — ` : ''}{rd.serviceNote}{receipt.last ? ` · ${rd.lastBatch}` : ''}</p>
    </DocSheet>
  );
}

/* ——— مستند إصدار السياسة: يُصدَّر من مركز السياسات كما هو، بجداوله وسجل ما تغيّر — بهوية المجموعة بلا رمز نموذج (ليس في المجموعة) ——— */
function tiersText(rule: CycleRule, lang: 'ar' | 'en'): string {
  const parts = rule.tiers.map((tt) => (tt.months === null ? (lang === 'ar' ? `ثم ${tt.pay === 0 ? 'بلا أجر' : `${tt.pay}%`}` : `then ${tt.pay === 0 ? 'unpaid' : `${tt.pay}%`}`) : lang === 'ar' ? `${tt.months} ${tt.months === 1 ? 'شهر' : tt.months === 2 ? 'شهران' : tt.months <= 10 ? 'أشهر' : 'شهراً'} ${tt.pay === 0 ? 'بلا أجر' : `بأجر ${tt.pay}%`}` : `${tt.months} month${tt.months === 1 ? '' : 's'} ${tt.pay === 0 ? 'unpaid' : `at ${tt.pay}%`}`));
  return `${lang === 'ar' ? `دورة ${rule.years === 1 ? 'سنة' : rule.years === 2 ? 'سنتان' : `${rule.years} سنوات`}` : `${rule.years}-year cycle`}: ${parts.join(lang === 'ar' ? '، ' : ', ')}`;
}
function touchedName(x: Touched, c: PolicyVersion['content'], tx: (v: { ar: string; en: string } | undefined) => string, cal: string, warn: string): string {
  if (x.head === 'types') return tx(c.types.find((k) => k.id === x.id)?.name || { ar: x.id || '', en: x.id || '' });
  if (x.head === 'routes') return tx(c.routes.find((k) => k.id === x.id)?.name || { ar: x.id || '', en: x.id || '' });
  if (x.head === 'entitlements') return tx(c.entitlements.find((k) => k.id === x.id)?.name || { ar: x.id || '', en: x.id || '' });
  return x.head === 'calendar' ? cal : warn;
}
export function PolicyDocument({ version, still }: { version: PolicyVersion; still?: boolean }) {
  const { state } = useStore(); const { lang, t, tx } = useLang(); const d = t.policy.doc; const dd = t.doc; const c = version.content; const gnames = useGroupNames(); const pnames = namesFor(state);
  const posTitle = (id: string) => tx(positionById(state, id)?.title || { ar: id, en: id });
  const today = toISO(Date.now()); const status = statusOf(version, state.policy.versions, today); const end = endOf(version, state.policy.versions);
  const by = personById(state, version.createdBy); const approver = version.approval?.by ? personById(state, version.approval.by) : undefined;
  const nm = (p?: Person) => (p ? (lang === 'ar' ? p.name : p.nameEn) : '');
  const routeName = (id: string) => tx(c.routes.find((r) => r.id === id)?.name || { ar: id, en: id });
  const payLabel = (p: LeaveType['pay']) => (p === 'paid' ? t.leave.paid : p === 'partial' ? t.leave.partial : t.leave.unpaid);
  /* ضوابط النوع كاملةً في سطر واحد (لا ملخص الاختيار): المدة، والتكرار، والنوافذ، والأهلية، والسقوف، وشرائح الأجر لكل فئة */
  const rules = (tp: LeaveType) => { const ar = lang === 'ar'; const parts: string[] = [];
    if (tp.fixedDays) parts.push(ar ? `${tp.fixedDays} يوماً` : `${tp.fixedDays} days`); else if (tp.unit === 'halfday') parts.push(ar ? 'نصف يوم' : 'half day');
    if (tp.balance === 'annual') parts.push(ar ? 'تُخصم من الرصيد السنوي' : 'deducted from the annual balance'); if (tp.balance === 'emergency') parts.push(ar ? 'تُخصم من رصيد الاضطرارية' : 'deducted from the emergency balance');
    if (tp.onceInCareer) parts.push(ar ? 'مرة واحدة في العمر الوظيفي' : 'once in a career');
    if (tp.hijriWindow) parts.push(ar ? `من ${tp.hijriWindow.fromDay} إلى ${tp.hijriWindow.toDay} ${hijriMonthName(tp.hijriWindow.month, 'ar')}` : `${tp.hijriWindow.fromDay}–${tp.hijriWindow.toDay} ${hijriMonthName(tp.hijriWindow.month, 'en')}`);
    if (tp.seasonal) parts.push(ar ? `داخل نافذة ${tx(tp.dateWindow?.label || tp.name)} التي يفتحها مدير النظام` : `within the ${tx(tp.dateWindow?.label || tp.name)} window opened by the administrator`); else if (tp.dateWindow) parts.push(`${tx(tp.dateWindow.label)}: ${tp.dateWindow.from} → ${tp.dateWindow.to}`);
    if (tp.eligibility?.includes('female')) parts.push(ar ? 'للموظفات' : 'female employees'); if (tp.eligibility?.includes('parent')) parts.push(ar ? 'للآباء والأمهات' : 'parents');
    if (tp.minServiceYears) parts.push(ar ? `بعد ${tp.minServiceYears} سنوات خدمة` : `after ${tp.minServiceYears} years of service`);
    if (tp.maxMonthsPerYears) parts.push(ar ? `حتى ${tp.maxMonthsPerYears.months} شهراً كل ${tp.maxMonthsPerYears.years} سنوات` : `up to ${tp.maxMonthsPerYears.months} months per ${tp.maxMonthsPerYears.years} years`);
    if (tp.windowAfterEnd) parts.push(ar ? `التقديم حتى ${tp.windowAfterEnd} أيام عمل بعد الانتهاء` : `submit up to ${tp.windowAfterEnd} working days after it ends`); if (tp.advanceMin) parts.push(ar ? `قبل ${tp.advanceMin} أيام على الأقل` : `${tp.advanceMin}+ days in advance`); if (tp.maxPerRequest && !tp.fixedDays) parts.push(ar ? `حتى ${tp.maxPerRequest} في الطلب الواحد` : `max ${tp.maxPerRequest} per request`);
    if (tp.cycle) for (const cat of Object.keys(tp.cycle)) parts.push(`${gnames.group(cat)}: ${tiersText(tp.cycle[cat]!, lang)}${tp.cycle[cat]!.condition ? ` (${tx(tp.cycle[cat]!.condition)})` : ''}`);
    if (tp.scope && ((tp.scope.groups && tp.scope.groups.length) || (tp.scope.subgroups && tp.scope.subgroups.length) || (tp.scope.locations && tp.scope.locations.length))) parts.push(`${lang === 'ar' ? 'لفئات' : 'for'}: ${[...(tp.scope.groups || []).map(gnames.group), ...(tp.scope.subgroups || []).map(gnames.subgroup), ...(tp.scope.locations || []).map(gnames.location)].join(lang === 'ar' ? '، ' : ', ')}`);
    if (tp.external) parts.push(tx(tp.external));
    if (tp.erp?.subtype) parts.push(ar ? `نوع الغياب في النظام المرجعي: ${tp.erp.subtype} (التجميع ${tp.erp.grouping})` : `absence type in the system of record: ${tp.erp.subtype} (grouping ${tp.erp.grouping})`); else parts.push(ar ? 'غير مرتبط بالنظام المرجعي' : 'not linked to the system of record');
    const cr = cancelRuleOf(tp); const crRoute = cr.route === 'none' ? (ar ? 'بلا اعتماد، يُبلَّغ المدير المباشر' : 'no approval, line manager notified') : routeName(cr.route);
    parts.push(cr.allowed === 'never' ? (ar ? 'لا يُلغى بعد اعتماده' : 'cannot be cancelled once approved') : ar ? `الإلغاء ${cr.allowed === 'beforeStart' ? 'قبل بدايتها' : 'حتى نهايتها'} (${crRoute})` : `cancellation ${cr.allowed === 'beforeStart' ? 'before it starts' : 'until it ends'} (${crRoute})`);
    return parts.join(ar ? '؛ ' : '; ') || '—'; };
  const number = `POL-LEAVE-${version.number}`;
  return (
    <DocSheet office={{ ar: dd.officePolicy, en: dd.officePolicyEn }} number={number} classification={dd.internal} seed={`POL:${version.id}:${version.number}`} still={still} badge={d.title} title={`${d.version} ${version.number} · ${t.policy.status[status]}`}
      meta={[{ k: dd.policy.no, v: number, strong: true, mono: true }, { k: dd.date, v: fmtDate(version.createdAt, 'en', { day: '2-digit', month: '2-digit', year: 'numeric' }), mono: true }, { k: d.effective, v: version.scheduled ? `${version.from} → ${end || t.policy.open}` : t.policy.status.draft, mono: true }, { k: d.createdBy, v: nm(by), strong: true, sub: version.approval ? (version.approval.status === 'approved' ? `${t.policy.approvedBy} ${nm(approver) || posTitle(version.approval.positionId)}` : version.approval.status === 'pending' ? `${t.policy.awaitingSince} ${posTitle(version.approval.positionId)}` : t.policy.returnedBy) : undefined }]}>
      <p className="dp-ref sh-p">{d.reasonRef}: {version.reason || '—'}{version.reference ? ` (${version.reference})` : ''}</p>
      {/* v0.8 (D-016): ملحق التعديل أولاً — نطاقه وما تغيّر فقط، وهو ما يُعمَّم؛ ثم النص الكامل بعد التعديل */}
      {version.changes.length > 0 ? (
        <div className="dp-amend">
          <b className="dp-sec">{d.amendment} · {version.number}</b>
          <p className="dp-p"><b>{d.scopeLine}:</b> {touchedIn(version).map((x: Touched) => touchedName(x, c, tx, t.policy.vscope.calendarObj, t.policy.vscope.warningsObj)).join(lang === 'ar' ? '، ' : ', ')} — {d.amendmentSub}</p>
          <table className="dt"><thead><tr><th>{d.field}</th><th>{d.before}</th><th>{d.after}</th><th>{t.policy.why}</th></tr></thead><tbody>
            {version.changes.map((ch, i) => <tr key={i}><td>{tx(ch.label)}</td><td>{ch.before || '—'}</td><td>{ch.after || '—'}</td><td>{ch.why || ''}</td></tr>)}
          </tbody></table>
          <b className="dp-sec">{d.fullText}</b>
        </div>
      ) : null}
      <b className="dp-sec">{d.rules}</b>
      <table className="dt"><thead><tr><th>{d.type}</th><th>{d.route}</th><th>{d.pay}</th><th>{d.attachment}</th><th>{d.rules2}</th></tr></thead><tbody>
        {c.types.filter((x) => x.enabled).map((tp) => <tr key={tp.id}><td><b>{tx(tp.name)}</b></td><td>{routeName(tp.route)}</td><td>{payLabel(tp.pay)}</td><td>{tp.attachment?.required ? tx(tp.attachment.label) : '—'}</td><td>{rules(tp)}</td></tr>)}
      </tbody></table>
      <b className="dp-sec">{d.routes}</b>
      <table className="dt"><thead><tr><th>{d.route}</th><th>{d.steps}</th></tr></thead><tbody>
        {c.routes.map((r) => <tr key={r.id}><td><b>{tx(r.name)}</b><br /><small>{c.types.filter((x) => x.route === r.id && x.enabled).map((x) => tx(x.name)).join('، ') || '—'}</small></td><td>{r.steps.map((s) => `${tx(s.title || stepTitle(s, pnames))}${s.mode === 'notify' ? ` (${t.leave.notified})` : s.slaHours ? ` (${s.slaHours}${lang === 'ar' ? ' س' : 'h'})` : ''}${s.when ? ` [${conditionText(s.when, lang, gnames)}]` : ''}`).join(lang === 'ar' ? ' ← ' : ' → ')} {lang === 'ar' ? '←' : '→'} {t.desks.system}</td></tr>)}
      </tbody></table>
      <b className="dp-sec">{d.ents}</b>
      <table className="dt"><thead><tr><th>{d.type}</th><th>{d.condition}</th><th>{d.action}</th></tr></thead><tbody>
        {c.entitlements.filter((e) => e.enabled).map((e) => <tr key={e.id}><td><b>{tx(e.name)}</b></td><td>{e.eligibility === 'outsideHome' ? (lang === 'ar' ? 'جنسية الموظف ≠ بلد مقر عمله وبند العقد' : 'nationality ≠ work-location country and the contract element') : `${lang === 'ar' ? 'فئات' : 'groups'}: ${[...(e.scope?.groups || []).map(gnames.group), ...(e.scope?.subgroups || []).map(gnames.subgroup), ...(e.scope?.locations || []).map(gnames.location)].join('، ') || (lang === 'ar' ? 'الجميع' : 'all')}${lang === 'ar' ? ' واستثناءات مدير النظام' : ' plus administrator exceptions'}`} · {e.leaveTypes.map((id) => tx(c.types.find((x) => x.id === id)?.name || { ar: id, en: id })).join('، ')} · {lang === 'ar' ? `${e.minDays} يوماً فأكثر · ${e.perYear} في السنة` : `${e.minDays}+ days · ${e.perYear}/year`}</td><td>{tx(e.action)} · {t.leave.entTo} {tx(agentTitle(e.fulfil.agent, pnames))} ({e.fulfil.mode === 'task' ? (lang === 'ar' ? 'مهمة بمرجع' : 'task with a reference') : (lang === 'ar' ? 'إشعار' : 'notice')}){(() => { const oc = onCancelOf(e); return oc.reversal === 'none' && !oc.approval ? '' : lang === 'ar' ? ` · عند إلغاء الإجازة بعد التنفيذ: ${oc.approval ? 'موافقة الجهة المنفذة، ثم ' : ''}${oc.reversal === 'task' ? 'مهمة استرداد بمرجع' : oc.reversal === 'notify' ? 'إشعار الجهة' : 'لا استرداد'}` : ` · on cancellation after fulfilment: ${oc.approval ? 'executing office approval, then ' : ''}${oc.reversal === 'task' ? 'a reversal task with a reference' : oc.reversal === 'notify' ? 'the office is notified' : 'no reversal'}`; })()}</td></tr>)}
      </tbody></table>
      <b className="dp-sec">{d.calendar}</b>
      <p className="dp-p">{d.weekendRiyadh}؛ {d.weekendAbudhabi}. {c.calendar.holidays.map((h) => `${tx(h.name)} ${h.date} (${h.locations.map((l) => t.leave.location[l]).join('، ')})`).join(lang === 'ar' ? '؛ ' : '; ')}. {d.warning}: {c.warnings.tierPct}% {lang === 'ar' ? 'أو' : 'or'} {c.warnings.tierDays} {lang === 'ar' ? 'أيام متبقية' : 'days left'}.</p>
      {version.changes.length === 0 ? <><b className="dp-sec">{d.changes}</b><p className="dp-p">{d.noChanges}</p></> : null}
      <p className="dp-meta"><span>{d.issuedFrom}</span><span className="num">{fmtDate(Date.now(), 'en', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span></p>
    </DocSheet>
  );
}

/* ——— v0.15 (CAP-02، P-13): مستند الخدمة المهيّأة على ورقة الهوية نفسها — العنوان من المخرج، والحقول التي عُلِّمت «تظهر في المستند»، والموقّع من أنجز الخطوة البشرية الأخيرة، وسلسلة الاعتماد كما وقعت؛ شكلٌ من المجموعة ومحتوى من الخدمة ——— */
export function ConfiguredDocument({ r, doc, still, svc: svcProp }: { r: Request; doc: Doc; still?: boolean; svc?: ConfiguredService }) {
  const { state } = useStore(); const { lang, t, tx } = useLang(); const dd = t.doc;
  /* v0.18: الخدمة تُمرَّر صراحةً في معاينة المصمّم (مسودة لم تُحفظ بعد)؛ وإلا تُقرأ من الطلب */
  const p = personById(state, r.requesterId); const svc = svcProp || serviceOfRequest(state, r); const c = r.configured!;
  const name = p ? (lang === 'ar' ? p.name : p.nameEn) : '';
  const fields = svc ? allFields(svc).filter((f) => f.inDoc && f.kind !== 'guidance' && f.kind !== 'attachment') : [];
  const rows = fields.map((f) => ({ k: tx(f.label), v: displayValue(state, f, c.values[f.id], lang, p) })).filter((x) => x.v);
  /* v0.16 (خريطة الحالات 4.2–4.5): القالب المدموج، ونوع المستند من المجموعة، والموقّع المهيّأ، والصلاحية، ونسخة إلى؛ وإلا صيغة v0.15 العامة */
  const templated = !!doc.body && doc.body.length > 0;
  const humans = r.steps.filter((s) => s.status === 'done' && s.desk !== 'requester' && s.actorId && s.actorId !== 'system' && s.mode !== 'notify' && !s.notifyOnly);
  const signerStep = humans[humans.length - 1]; const signer = signerStep?.actorId ? personById(state, signerStep.actorId) : undefined; const signerPos = signer?.positionId ? positionById(state, signer.positionId) : undefined;
  const iso = toISO(doc.at);
  const kind = doc.docKind || 'letter';
  const kindBadge = kind === 'decision' ? (lang === 'ar' ? 'قرار إداري' : 'Administrative decision') : kind === 'certificate' ? (lang === 'ar' ? 'شهادة' : 'Certificate') : kind === 'permit' ? (lang === 'ar' ? 'تصريح' : 'Permit') : (lang === 'ar' ? 'خطاب' : 'Letter');
  const intro = lang === 'ar'
    ? `تشهد الأمانة العامة لمجلس التعاون لدول الخليج العربية بأن ${name} (${p ? `GCC-${p.empNo}` : ''})، ${p?.title || ''}، ${p?.unit || ''}، من منسوبيها، ويُصدر هذا المستند بناءً على الطلب رقم ${r.id} بعد اكتمال مساره واعتماده وفق إصدار الخدمة ${c.version}.`
    : `The General Secretariat of the Cooperation Council for the Arab States of the Gulf certifies that ${name} (${p ? `GCC-${p.empNo}` : ''}), ${p?.titleEn || ''}, ${p?.unitEn || ''}, is one of its employees. This document is issued on request ${r.id} after its route was completed and approved under service version ${c.version}.`;
  const signs = doc.signatory === null ? [] : doc.signatory ? [{ role: tx(doc.signatory.role) || dd.decision.authority, name: tx(doc.signatory.name), at: doc.signatory.at, kind: 'seal' as const }] : [{ role: signerPos ? tx(signerPos.title) : dd.decision.authority, name: signer ? (lang === 'ar' ? signer.name : signer.nameEn) : t.desks.system, sub: signer ? (lang === 'ar' ? signer.unit : signer.unitEn) : undefined, at: signerStep?.at || doc.at, kind: 'seal' as const }];
  const meta = [{ k: dd.decision.ref, v: doc.number || '', strong: true, mono: true }, { k: dd.date, v: fmtDate(doc.at, 'en', { day: '2-digit', month: '2-digit', year: 'numeric' }), mono: true, sub: `${dd.hijri} ${hijriText(iso, lang)}` }, { k: dd.requestRef, v: r.id, mono: true }, doc.validUntil ? { k: lang === 'ar' ? 'صالح حتى' : 'Valid until', v: doc.validUntil, mono: true, strong: true } : { k: dd.classification, v: dd.internal, strong: true }];
  return (
    <DocSheet code={doc.code || 'FR-GN-01'} office={{ ar: dd.officeHr, en: dd.officeHrEn }} number={doc.number || ''} classification={dd.internal} seed={`${r.id}:${doc.number}`} still={still} badge={templated ? kindBadge : tx(doc.title)} title={tx(doc.title)} tone={kind === 'decision' ? 'gold' : undefined}
      meta={meta}
      signs={signs}
      appendix={<>{doc.copyTo?.length ? <p className="dp-copy"><b>{lang === 'ar' ? 'نسخة إلى:' : 'Copy to:'}</b> {doc.copyTo.map((x) => tx(x)).join(lang === 'ar' ? '، ' : ', ')}</p> : null}<b className="dp-sec">{dd.decision.approvals}</b><table className="dt small"><tbody>{r.steps.filter((s) => s.status === 'done' && s.desk !== 'requester').map((s) => { const who = s.actorId && s.actorId !== 'system' ? personById(state, s.actorId) : undefined; const pos = who?.positionId ? positionById(state, who.positionId) : undefined; return <tr key={s.key}><td>{tx(s.title)}{s.ref ? <> · <span className="mono">{s.ref}</span></> : null}</td><td>{who ? `${lang === 'ar' ? who.name : who.nameEn} · ${pos ? tx(pos.title) : lang === 'ar' ? who.title : who.titleEn}` : t.desks.system}</td><td className="num" dir="ltr">{s.at ? fmtDate(s.at, 'en', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</td></tr>; })}</tbody></table></>}>
      {templated ? doc.body!.map((para, i) => <p key={i} className={i === 0 ? 'sh-lead' : 'sh-para'}>{tx(para)}</p>) : (<>
        <p className="sh-lead">{intro}</p>
        {rows.length ? <table className="dt"><tbody>{rows.map((x, i) => <tr key={i}><td style={{ width: '38%' }}>{x.k}</td><td>{x.v}</td></tr>)}</tbody></table> : null}
        <p className="sh-closing">{lang === 'ar' ? 'وقد أُعطي هذا المستند بناءً على طلب صاحبه لتقديمه إلى الجهة المعنية، دون أدنى مسؤولية على الأمانة العامة تجاه الغير.' : 'This document is given at the request of its holder for presentation to the party concerned, without any liability on the General Secretariat towards third parties.'}</p>
      </>)}
    </DocSheet>
  );
}
