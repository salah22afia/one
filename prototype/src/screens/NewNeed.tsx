import React, { useMemo, useState } from 'react';
import { useStore } from '../app/store';
import { I } from '../ui/icons';
import { Field, Group, LargeTitle, Notice, Pill, TopBar, useLang, usePerson, useMedia, SectionLabel, Cell } from '../ui/components';
import { motion, AnimatePresence, Stagger, Item, CheckMark, Press, SPRING } from '../ui/motion';
import { NeedRoutePreview } from '../ui/NeedBits';
import { toISO, liveNeed } from '../domain/policy';
import { lineManagerOf } from '../domain/engine';
import { needContent, needVersion, canOpenNeed, beneficiariesFor, buildNeedCtx, needSteps, siteOf, storeFor, entityOf, catalogFor } from '../domain/need';
import { fill } from '../app/i18n';
import type { T2 } from '../domain/types';

interface Line { key: number; catalogId?: string; name: T2; qty: number; unit?: T2; price?: number }
const STEPS = 3;

/* ——— «أحتاج شيئاً» (AS-01): معالج بثلاث خطوات — لمن وماذا، ثم التفاصيل، ثم المراجعة بالمسار المتوقع؛ يفتحه المستوى الإداري وحده (D-017) ——— */
export function NewNeed() {
  const { state, dispatch } = useStore(); const { lang, t, tx } = useLang(); const me = usePerson(); const wide = useMedia('(min-width: 1024px)');
  const today = toISO(Date.now()); const version = needVersion(state, today); const content = needContent(state, today);
  const gate = canOpenNeed(state, me, content); const manager = lineManagerOf(state, me);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1); const [dir, setDir] = useState(1);
  const [benId, setBenId] = useState(me.id); const [catId, setCatId] = useState(''); const [lines, setLines] = useState<Line[]>([]); const [free, setFree] = useState(''); const [freeQty, setFreeQty] = useState(1);
  const [why, setWhy] = useState(''); const [est, setEst] = useState(''); const [urgent, setUrgent] = useState(false); const [file, setFile] = useState(''); const [createdId, setCreatedId] = useState('');
  const bens = useMemo(() => beneficiariesFor(state, me), [state, me]); const ben = bens.find((p) => p.id === benId) || me;
  const cats = liveNeed(content.categories, today); const cat = cats.find((c) => c.id === catId);
  const site = siteOf(content, ben, today); const store = cat ? storeFor(content, cat, site) : undefined; const entity = entityOf(content, cat?.entityId);
  /* v0.10: كتالوج الاحتياجات بأسماء مألوفة وسعر استرشادي — لا أرقام أصناف أمام الطالب (تحددها الجهة الفنية أو المستودع) */
  const entries = useMemo(() => (cat ? catalogFor(content, cat.id, today) : []), [content, cat, today]);
  const ctx = useMemo(() => (cat ? buildNeedCtx(state, { requesterId: me.id, beneficiaryId: ben.id, categoryId: cat.id }, today) : null), [state, me.id, ben.id, cat, today]);
  const built = useMemo(() => (ctx ? needSteps(state, ctx, Date.now()) : null), [state, ctx]);
  const go = (n: 1 | 2 | 3 | 4) => { setDir(n > step ? 1 : -1); setStep(n); window.scrollTo({ top: 0 }); };
  const addEntry = (id: string) => { const k = entries.find((x) => x.id === id)!; setLines((ls) => (ls.some((l) => l.catalogId === id) ? ls.map((l) => (l.catalogId === id ? { ...l, qty: l.qty + 1 } : l)) : [...ls, { key: Date.now() + Math.random(), catalogId: id, name: k.name, qty: 1, unit: k.unit, price: k.price }])); };
  const addFree = () => { if (!free.trim()) return; setLines((ls) => [...ls, { key: Date.now(), name: { ar: free.trim(), en: free.trim() }, qty: Math.max(1, freeQty) }]); setFree(''); setFreeQty(1); };
  const setQty = (key: number, q: number) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, qty: Math.max(1, q) } : l)));
  const remove = (key: number) => setLines((ls) => ls.filter((l) => l.key !== key));
  const can1 = !!cat && lines.length > 0; const can2 = why.trim().length > 0;
  const submit = () => {
    if (!cat || !lines.length || !why.trim()) return;
    const id = 'REQ-2026-' + String(state.seq + 1).padStart(4, '0'); setCreatedId(id);
    dispatch({ type: 'needCreate', input: { requesterId: me.id, beneficiaryId: ben.id, categoryId: cat.id, lines: lines.map((l) => ({ catalogId: l.catalogId, name: l.name, qty: l.qty, unit: l.unit })), justification: why.trim(), urgent: urgent && content.rules.urgentEnabled, estimatedValue: est ? Number(est) : undefined, attachment: file || undefined } });
    go(4);
  };
  const pct = step === 1 ? 33 : step === 2 ? 66 : 100;
  const slide = { initial: { opacity: 0, x: dir * (lang === 'ar' ? -28 : 28) }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: dir * (lang === 'ar' ? 28 : -28), transition: { duration: 0.16 } }, transition: SPRING.soft };
  const levelName = t.need.levelName[gate.min];

  if (!gate.ok) {
    return (
      <div className="page narrow view leave-new">
        <TopBar title={t.need.title} back={() => history.back()} />
        <LargeTitle title={t.need.title} sub={t.need.sub} />
        <Stagger>
          <Item><Group><div className="empty need-gate"><span className="ic"><I.person /></span><b>{t.need.cannotOpen}</b><p>{fill(t.need.cannotOpenSub, { level: levelName })}</p></div></Group></Item>
          {manager ? <Item><Group><Cell icon="person" tone="tint" title={t.need.askManager} sub={`${lang === 'ar' ? manager.name : manager.nameEn} · ${lang === 'ar' ? manager.title : manager.titleEn}`} chevron={false} /></Group></Item> : null}
          <Item><div style={{ height: 12 }} /><Notice tone="tint" icon="info">{lang === 'ar' ? `يحدد مدير النظام المستوى الإداري الأدنى في سياسة الاحتياج (الآن: ${levelName} فأعلى).` : `The administrator sets the minimum management level in the need policy (now: ${levelName} and above).`}</Notice></Item>
        </Stagger>
      </div>
    );
  }

  const routeBox = built ? <Group><div style={{ padding: '12px 14px' }}><NeedRoutePreview steps={built.steps} requester={me} notApplied={built.notApplied} threshold={content.rules.tenderThreshold} tolerance={content.rules.tolerancePct} /></div></Group> : null;
  const indicative = lines.reduce((a, l) => a + (l.price || 0) * l.qty, 0);

  return (
    <div className="page narrow view leave-new need-new">
      <TopBar title={t.need.title} back={() => (step > 1 && step < 4 ? go((step - 1) as 1 | 2 | 3) : history.back())} />
      <LargeTitle title={t.need.title} sub={step < 4 ? `${t.leave.policyVersion} ${version.number} · ${t.need.site}: ${site ? tx(site.name) : ''}` : undefined} />
      {step < 4 && (<div className="steps"><span className="num">{t.newReq.step} {step} {t.newReq.of} {STEPS}</span><div className="bar"><motion.i initial={false} animate={{ width: `${pct}%` }} transition={SPRING.soft} /></div><span>{step === 1 ? t.need.what : step === 2 ? t.need.details : t.need.review}</span></div>)}
      <AnimatePresence mode="wait" initial={false}>
        {step === 1 && (
          <motion.div key="s1" {...slide}>
            <div className={wide ? 'grid-2 leave-grid' : ''}>
              <main>
                <SectionLabel>{t.need.forWhom}</SectionLabel>
                <Group>
                  <div className="chips" style={{ padding: '10px 14px' }}>
                    <button type="button" className={`pill ${benId === me.id ? 'tint' : ''}`} onClick={() => setBenId(me.id)}><I.person />{t.need.forMe}</button>
                    {bens.length > 1 ? <button type="button" className={`pill ${benId !== me.id ? 'tint' : ''}`} onClick={() => setBenId(bens[1].id)}><I.team />{t.need.forSomeone}</button> : null}
                  </div>
                  {benId !== me.id ? <div style={{ padding: '0 14px 12px' }}><select id="ben" className="select-in" value={benId} onChange={(e) => setBenId(e.target.value)}>{bens.filter((p) => p.id !== me.id).map((p) => <option key={p.id} value={p.id}>{lang === 'ar' ? p.name : p.nameEn} · {lang === 'ar' ? p.title : p.titleEn}</option>)}</select></div> : null}
                </Group>
                <SectionLabel>{t.need.pickCategory}</SectionLabel>
                <Stagger className="need-cats" step={0.035}>
                  {cats.map((c) => { const Ic = I[c.icon as keyof typeof I] || I.box; const on = c.id === catId; return (
                    <Item key={c.id}><Press className={`type-row ${on ? 'on' : ''}`} onClick={() => { setCatId(c.id); setLines([]); }} aria-pressed={on}>
                      <span className={`qicon ${c.tone}`}><Ic /></span>
                      <span className="tr-main"><b>{tx(c.name)}</b><span>{tx(c.guidance)}</span></span>
                      <span className="tr-trail">{on ? <span className="tr-check"><I.check /></span> : <I.chev className="chev dirchev" />}</span>
                    </Press></Item>
                  ); })}
                </Stagger>
                <AnimatePresence initial={false}>
                  {cat && (
                    <motion.div key={cat.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={SPRING.soft}>
                      <div className="kbd-row" style={{ padding: '4px 0 6px' }}>{entity ? <Pill icon="shield">{t.need.entity}: {tx(entity.name)}</Pill> : <Pill>{t.need.noEntity}</Pill>}{cat.kind === 'material' ? (store ? <Pill icon="box">{t.need.store}: {tx(store.name)}</Pill> : <Pill icon="plane">{t.need.noStore}</Pill>) : <Pill>{t.need.kindService}</Pill>}{cat.custody && cat.kind === 'material' ? <Pill tone="gold" icon="seal">{t.need.custodyFlag}</Pill> : null}</div>
                      <p className="hint-line" style={{ padding: '6px 4px 0' }}>{t.need.catalogHint}</p>
                      {entries.length > 0 ? (<><SectionLabel>{t.need.catalog}</SectionLabel><Stagger className="need-catalog" step={0.03}>{entries.map((k) => { const Ic = I[(k.icon || cat.icon) as keyof typeof I] || I.box; const inList = lines.find((l) => l.catalogId === k.id); return (
                        <Item key={k.id}><Press className={`need-k ${inList ? 'on' : ''}`} onClick={() => addEntry(k.id)} aria-pressed={!!inList} lift>
                          <span className={`qicon ${cat.tone}`}><Ic /></span>
                          <span className="need-k-main"><b>{tx(k.name)}</b>{k.guidance ? <span className="cell-sub">{tx(k.guidance)}</span> : null}</span>
                          <span className="need-k-trail">{k.price ? <span className="need-k-price"><span className="cell-sub">{t.need.indicative}</span><b className="num">{k.price.toLocaleString('en')}</b></span> : null}{inList ? <span className="tr-check"><I.check /></span> : <span className="need-k-add"><I.plus /></span>}</span>
                        </Press></Item>
                      ); })}</Stagger></>) : null}
                      <SectionLabel>{t.need.free}</SectionLabel>
                      <Group><div className="need-free"><input aria-label={t.need.freeName} placeholder={t.need.freeName} value={free} onChange={(e) => setFree(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addFree(); } }} /><input aria-label={t.need.qty} className="num qty" type="number" min={1} value={freeQty} onChange={(e) => setFreeQty(Number(e.target.value))} /><button type="button" className="btn soft" onClick={addFree} disabled={!free.trim()}><I.plus />{t.need.addLine}</button></div></Group>
                      <SectionLabel>{t.need.lines} · <span className="num">{lines.length}</span></SectionLabel>
                      <Group>{lines.length === 0 ? <div className="cell"><span className="cell-lead plain"><I.box /></span><span className="cell-main"><span className="cell-title">{t.need.pickItems}</span></span></div> : lines.map((l) => (
                        <div key={l.key} className="cell need-line"><span className="cell-main"><span className="cell-title">{tx(l.name)}</span><span className="cell-sub">{l.catalogId ? t.need.fromCatalog : t.need.freeText}{l.unit ? ` · ${tx(l.unit)}` : ''}{l.price ? <> · <span className="num">{(l.price * l.qty).toLocaleString('en')}</span></> : null}</span></span><span className="need-qty"><button type="button" className="icon-btn sm" aria-label="−" onClick={() => setQty(l.key, l.qty - 1)}>−</button><b className="num">{l.qty}</b><button type="button" className="icon-btn sm" aria-label="+" onClick={() => setQty(l.key, l.qty + 1)}>+</button></span><button type="button" className="icon-btn sm danger" aria-label={t.need.removeLine} onClick={() => remove(l.key)}><I.x /></button></div>
                      ))}</Group>
                    </motion.div>
                  )}
                </AnimatePresence>
              </main>
              {wide ? <aside><div className="section-head"><h2>{t.need.route}</h2></div>{routeBox || <Group><div className="empty"><span className="ic"><I.box /></span><b>{t.need.pickCategory}</b></div></Group>}</aside> : null}
            </div>
            <div style={{ height: 16 }} />
            <motion.button type="button" className="btn primary block lg" disabled={!can1} onClick={() => go(2)} whileTap={{ scale: 0.97 }}>{t.need.next}<I.chev className="dirchev" /></motion.button>
          </motion.div>
        )}
        {step === 2 && cat && (
          <motion.div key="s2" {...slide}>
            <Stagger>
              <Group>
                <Field id="n-why" label={t.need.why} error={why.trim() ? undefined : undefined}><textarea id="n-why" rows={3} value={why} onChange={(e) => setWhy(e.target.value)} /></Field>
                {indicative ? <div className="cell"><span className="cell-lead plain"><I.wallet /></span><span className="cell-main"><span className="cell-title">{t.need.indicativeTotal}</span><span className="cell-sub">{t.need.indicative} × {t.need.qty}</span></span><b className="num">{indicative.toLocaleString('en')}</b></div> : null}
                <Field id="n-est" label={t.need.est} hint={t.need.estHint}><input id="n-est" className="num" dir="ltr" type="number" min={0} value={est} onChange={(e) => setEst(e.target.value)} /></Field>
                <div className="cell"><span className="cell-lead plain"><I.globe /></span><span className="cell-main"><span className="cell-title">{t.need.site}</span><span className="cell-sub">{site ? tx(site.name) : ''}{store ? ` · ${tx(store.name)}` : cat.kind === 'material' ? ` · ${t.need.noStore}` : ''}</span></span></div>
                {content.rules.urgentEnabled ? <div className="cell"><span className="cell-lead plain"><I.alert /></span><span className="cell-main"><span className="cell-title">{t.need.urgent}</span><span className="cell-sub">{t.need.urgentHint}</span></span><input className="switch" type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} /></div> : null}
                <Field id="n-file" label={`${t.leave.attachments} (${t.newReq.optional})`}><div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}><label className="btn secondary" style={{ cursor: 'pointer' }}><I.clip />{file ? t.newReq.attached : t.newReq.chooseAttachment}<input id="n-file" type="file" style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }} onChange={(e) => setFile(e.target.files?.[0]?.name || '')} /></label>{file ? <Pill icon="clip">{file}</Pill> : null}</div></Field>
              </Group>
              <div style={{ height: 16 }} />
              <Item><motion.button type="button" className="btn primary block lg" disabled={!can2} onClick={() => go(3)} whileTap={{ scale: 0.97 }}>{t.need.review}<I.chev className="dirchev" /></motion.button></Item>
            </Stagger>
          </motion.div>
        )}
        {step === 3 && cat && (
          <motion.div key="s3" {...slide}>
            <Stagger>
              <Group>
                <Item><div className="summary-row"><span className="k">{t.need.beneficiary}</span><span className="v">{ben.id === me.id ? t.need.forMe : (lang === 'ar' ? ben.name : ben.nameEn)}</span></div></Item>
                <Item><div className="summary-row"><span className="k">{t.need.category}</span><span className="v">{tx(cat.name)}</span></div></Item>
                <Item><div className="summary-row"><span className="k">{t.need.lines}</span><span className="v">{lines.map((l) => `${tx(l.name)} × ${l.qty}`).join(lang === 'ar' ? '، ' : ', ')}</span></div></Item>
                <Item><div className="summary-row"><span className="k">{t.need.why}</span><span className="v">{why}</span></div></Item>
                {est ? <Item><div className="summary-row"><span className="k">{t.need.est.split(' (')[0]}</span><span className="v num">{Number(est).toLocaleString('en')}</span></div></Item> : indicative ? <Item><div className="summary-row"><span className="k">{t.need.indicativeTotal}</span><span className="v num">{indicative.toLocaleString('en')}</span></div></Item> : null}
                {urgent && content.rules.urgentEnabled ? <Item><div className="summary-row"><span className="k">{t.need.urgent}</span><span className="v">{lang === 'ar' ? 'نعم' : 'Yes'}</span></div></Item> : null}
                <Item><div className="summary-row"><span className="k">{t.leave.policyVersion}</span><span className="v num">{version.number}</span></div></Item>
              </Group>
              <div className="section-label"><span>{t.need.route}</span></div>
              {routeBox}
              <div style={{ height: 16 }} />
              <Item><motion.button type="button" className="btn primary block lg" onClick={submit} whileTap={{ scale: 0.97 }}><I.send />{t.need.submit}</motion.button></Item>
            </Stagger>
          </motion.div>
        )}
        {step === 4 && (
          <motion.div key="s4" className="success" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={SPRING.soft}>
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
