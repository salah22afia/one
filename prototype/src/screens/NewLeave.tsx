import React, { useMemo, useState } from 'react';
import { useStore } from '../app/store';
import { nav } from '../app/router';
import { I } from '../ui/icons';
import { Field, Group, LargeTitle, Notice, Pill, Sheet, TopBar, useLang, usePerson, useMedia, SectionLabel } from '../ui/components';
import { motion, AnimatePresence, Stagger, Item, CheckMark, Ring, Ticker, Press, SPRING } from '../ui/motion';
import { RangeCalendar } from '../ui/Calendar';
import { RoutePreview, Checks, TierBar, useGroupNames } from '../ui/LeaveBits';
import { activeVersion, evaluateLeave, toISO, hijriText, typeSummary, agentTitle, SECTIONS, type LeaveType } from '../domain/policy';
import { leaveSteps, namesFor } from '../domain/engine';
import { fill } from '../app/i18n';
import type { Field as ReqField } from '../domain/types';

const STEPS = 3;

export function NewLeave() {
  const { state, dispatch } = useStore(); const { lang, t, tx } = useLang(); const me = usePerson(); const wide = useMedia('(min-width: 1024px)');
  const today = toISO(Date.now()); const version = activeVersion(state.policy, today); const content = version.content;
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1); const [dir, setDir] = useState(1);
  const [typeId, setTypeId] = useState<string>(''); const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [half, setHalf] = useState(false);
  const [file, setFile] = useState(''); const [note, setNote] = useState(''); const [ents, setEnts] = useState<string[]>([]); const [createdId, setCreatedId] = useState(''); const [detailOpen, setDetailOpen] = useState(false);
  const type = content.types.find((x) => x.id === typeId);
  const bal = state.balances[me.id];
  const myRequests = useMemo(() => state.requests.filter((r) => r.requesterId === me.id && r.leave).map((r) => ({ typeId: r.leave!.typeId, year: Number(r.leave!.from.slice(0, 4)), entitlements: r.status === 'in_review' || r.status === 'completed' ? r.leave!.entitlements : undefined, from: r.leave!.from, to: r.leave!.to, open: r.status === 'in_review' || r.status === 'returned' })), [state.requests, me.id]);
  const ev = useMemo(() => (type ? evaluateLeave({ content, person: me, type, from, to, halfDay: half && type.unit === 'halfday', today, absences: state.absences, balances: bal, ops: state.policy, requests: myRequests }) : null), [content, me, type, from, to, half, today, state.absences, bal, myRequests]);
  const evType = useMemo(() => (type ? evaluateLeave({ content, person: me, type, from: '', to: '', today, absences: state.absences, balances: bal, ops: state.policy, requests: myRequests }) : null), [content, me, type, today, state.absences, bal, myRequests]);
  const eligibilityBlocks = evType ? evType.checks.filter((c) => c.level === 'block' && ['elig', 'service', 'once', 'enabled', 'season'].includes(c.key)) : [];
  /* المسار المستخرج من الهيكل التنظيمي لهذا الموظف الآن (CAP-01): الأشخاص وسبب كل واحد، وما لا ينطبق ولماذا؛ ثم خطوات تنفيذ الاستحقاقات المختارة */
  const gnames = useGroupNames(); const pnames = namesFor(state);
  const built = useMemo(() => (type ? leaveSteps(state, me, content, type.route, { typeId: type.id, from, to, days: ev?.days || 0, workingDays: ev?.workingDays || 0, entitlements: ents }, Date.now(), gnames) : null), [state, me, content, type, from, to, ev?.days, ev?.workingDays, ents, gnames]);
  const groupLine = `${gnames.group(me.group || '')}${me.subgroup ? ` · ${gnames.subgroup(me.subgroup)}` : ''}`;
  const entTiming = (e: (typeof content.entitlements)[number]) => (e.fulfil.timing === 'beforeStart' ? fill(t.leave.entBefore, { n: e.fulfil.daysBefore || 0 }) : t.leave.entAfter);
  const [showUnavail, setShowUnavail] = useState(false);
  /* تقسيم الأنواع للاختيار: الأكثر استخداماً بطاقات، وبقية المتاح صفوف مجمّعة، وغير المتاح مطوي مع سببه */
  const picker = useMemo(() => {
    const enabled = content.types.filter((x) => x.enabled);
    const why = new Map<string, string>();
    for (const tp of enabled) { const ev0 = evaluateLeave({ content, person: me, type: tp, from: '', to: '', today, absences: state.absences, balances: bal, ops: state.policy, requests: myRequests }); const b = ev0.checks.find((c) => c.level === 'block' && ['elig', 'service', 'once', 'season'].includes(c.key)); if (b) why.set(tp.id, lang === 'ar' ? b.text.ar : b.text.en); }
    const avail = enabled.filter((x) => !why.has(x.id));
    const core = avail.filter((x) => (x.section || 'other') === 'core');
    const groups = SECTIONS.filter((sec) => sec !== 'core').map((sec) => ({ sec, items: avail.filter((x) => (x.section || 'other') === sec) })).filter((g) => g.items.length > 0);
    const unavailable = enabled.filter((x) => why.has(x.id)).map((tp) => ({ tp, why: why.get(tp.id)! }));
    return { core, groups, unavailable };
  }, [content, me, today, state.absences, bal, myRequests, lang]);
  const go = (n: 1 | 2 | 3 | 4 | 5) => { setDir(n > step ? 1 : -1); setStep(n); window.scrollTo({ top: 0 }); };
  const pickType = (tp: LeaveType) => { if (tp.id !== typeId) { setFrom(''); setTo(''); setHalf(tp.unit === 'halfday'); setEnts([]); } setTypeId(tp.id); setDetailOpen(true); };
  const onDates = (f: string, tt: string) => { setFrom(f); setTo(tt); };
  const attachOk = !type?.attachment?.required || !!file;
  const canNext2 = !!ev && ev.ok && !!from && !!to;
  const submit = () => {
    if (!type || !ev || !ev.ok) return;
    const id = 'REQ-2026-' + String(state.seq + 1).padStart(4, '0'); setCreatedId(id);
    const fields: ReqField[] = [
      { key: 'type', label: { ar: 'نوع الإجازة', en: 'Leave type' }, value: tx(type.name) }, { key: 'from', label: { ar: 'من', en: 'From' }, value: from }, { key: 'to', label: { ar: 'إلى', en: 'To' }, value: to },
      { key: 'days', label: { ar: 'الأيام', en: 'Days' }, value: String(ev.days) }, ...(note ? [{ key: 'note', label: { ar: 'ملاحظة', en: 'Note' }, value: note }] : []),
    ];
    dispatch({ type: 'create', serviceId: 'TM-01', requesterId: me.id, fields, attachment: file || undefined, steps: built?.steps, notApplied: built?.notApplied, policyVersion: version.number, leave: { typeId: type.id, from, to, days: ev.days, workingDays: ev.workingDays, halfDay: half && type.unit === 'halfday', entitlements: ents, payBreakdown: ev.sick?.slices } });
    go(5);
  };
  const pct = step === 1 ? 25 : step === 2 ? 50 : step === 3 ? 75 : 100;
  const slide = { initial: { opacity: 0, x: dir * (lang === 'ar' ? -28 : 28) }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: dir * (lang === 'ar' ? 28 : -28), transition: { duration: 0.16 } }, transition: SPRING.soft };
  const payLabel = (p: LeaveType['pay']) => (p === 'paid' ? t.leave.paid : p === 'partial' ? t.leave.partial : t.leave.unpaid);

  /* تفاصيل النوع المختار: الرصيد والشروط والمسار والدورة، ثم «التالي» — تظهر في ورقة على الهاتف وفي عمود جانبي على الحاسوب */
  const detail = type ? (
    <>
      <Group>
        <div className="td-head">
          {type.balance === 'annual' && bal ? <Ring value={bal.annual} max={bal.annualTotal} size={64} stroke={7} delay={0.1}><b className="num"><Ticker value={bal.annual} decimals={Number.isInteger(bal.annual) ? 0 : 1} /></b></Ring> : type.balance === 'emergency' && bal ? <Ring value={bal.emergency} max={5} size={64} stroke={7} color="var(--gold)" delay={0.1}><b className="num"><Ticker value={bal.emergency} /></b></Ring> : null}
          <div>{wide ? <b>{tx(type.name)}</b> : null}<p className="cell-sub">{tx(type.guidance)}</p></div>
        </div>
        <div className="kbd-row" style={{ paddingTop: 0 }}>
          <Pill tone="tint">{tx(content.routes.find((r) => r.id === type.route)?.name || { ar: type.route, en: type.route })}</Pill>
          <Pill>{payLabel(type.pay)}</Pill>
          {type.attachment?.required ? <Pill icon="clip">{tx(type.attachment.label)}</Pill> : null}
          {type.fixedDays ? <Pill icon="calendar">{type.fixedDays} {lang === 'ar' ? 'يوماً' : 'days'}</Pill> : null}
          {type.windowAfterEnd ? <Pill icon="clock">{lang === 'ar' ? `حتى ${type.windowAfterEnd} أيام عمل بعد الانتهاء` : `up to ${type.windowAfterEnd} working days after`}</Pill> : null}
        </div>
        {eligibilityBlocks.length > 0 ? <div style={{ padding: '0 14px 12px' }}><Checks checks={eligibilityBlocks} /></div> : null}
        <div className="td-route"><div className="section-label" style={{ padding: '6px 0 6px' }}><span>{t.leave.route}</span></div>{built ? <RoutePreview steps={built.steps} requester={me} notApplied={built.notApplied} why={false} /> : null}</div>
        {evType?.sick ? <div style={{ padding: '4px 14px 14px' }}><div className="section-label" style={{ padding: '6px 0 6px' }}><span>{t.leave.cycle}</span></div><TierBar sick={evType.sick} days={0} /></div> : null}
      </Group>
      <div style={{ height: 14 }} />
      <motion.button type="button" className="btn primary block lg" disabled={eligibilityBlocks.length > 0} onClick={() => { setDetailOpen(false); go(2); }} whileTap={{ scale: 0.97 }}>{t.leave.next}<I.chev className="dirchev" /></motion.button>
    </>
  ) : null;

  return (
    <div className="page narrow view leave-new">
      <TopBar title={t.leave.title} back={() => (step > 1 && step < 5 ? go((step - 1) as 1 | 2 | 3 | 4) : history.back())} />
      <LargeTitle title={t.leave.title} sub={step < 5 ? `${t.leave.policyVersion} ${version.number} · ${groupLine} · ${t.leave.location[me.location || 'riyadh']}` : undefined} />
      {step < 5 && (<div className="steps"><span className="num">{t.newReq.step} {Math.min(step, STEPS + 1)} {t.newReq.of} {STEPS + 1}</span><div className="bar"><motion.i initial={false} animate={{ width: `${pct}%` }} transition={SPRING.soft} /></div><span>{step === 1 ? t.leave.pickType : step === 2 ? t.leave.dates : step === 3 ? t.leave.attachments : t.leave.review}</span></div>)}

      <AnimatePresence mode="wait" initial={false}>
        {step === 1 && (
          <motion.div key="s1" {...slide}>
            <div className={wide ? 'grid-2 leave-grid' : ''}>
              <main>
                {/* الأكثر استخداماً: بطاقتان بالرصيد على حلقة */}
                {picker.core.length > 0 && (
                  <Stagger className="hero-types" step={0.05}>
                    {picker.core.map((tp) => { const Ic = I[tp.icon as keyof typeof I] || I.leave; const on = tp.id === typeId; const b = tp.balance === 'annual' && bal ? { v: bal.annual, m: bal.annualTotal } : tp.balance === 'emergency' && bal ? { v: bal.emergency, m: 5 } : null; return (
                      <Item key={tp.id}><Press className={`type-hero ${on ? 'on' : ''}`} onClick={() => pickType(tp)} aria-pressed={on}>
                        <span className="th-top"><span className={`qicon ${tp.tone}`}><Ic /></span>{b ? <Ring value={b.v} max={b.m} size={46} stroke={5} color={tp.balance === 'emergency' ? 'var(--gold)' : 'var(--tint)'} delay={0.2}><b className="num th-ring"><Ticker value={b.v} decimals={Number.isInteger(b.v) ? 0 : 1} delay={0.2} /></b></Ring> : null}</span>
                        <b>{tx(tp.name)}</b>
                        <span className="th-sub">{b ? <><span className="num">{b.v}</span> {t.leave.ofTotal} <span className="num">{b.m}</span> {lang === 'ar' ? 'يوماً' : 'days'} · {tx(content.routes.find((r) => r.id === tp.route)?.name || tp.name)}</> : typeSummary(tp, content, lang)}</span>
                      </Press></Item>
                    ); })}
                  </Stagger>
                )}
                {/* بقية الأنواع صفوفاً مجمّعة */}
                {picker.groups.map((g) => (
                  <React.Fragment key={g.sec}>
                    <SectionLabel>{t.leave.sections[g.sec]}</SectionLabel>
                    <Stagger step={0.035}><Group>
                      {g.items.map((tp) => { const Ic = I[tp.icon as keyof typeof I] || I.leave; const on = tp.id === typeId; return (
                        <Item key={tp.id}><Press className={`type-row ${on ? 'on' : ''}`} onClick={() => pickType(tp)} aria-pressed={on}>
                          <span className={`qicon ${tp.tone}`}><Ic /></span>
                          <span className="tr-main"><b>{tx(tp.name)}</b><span>{typeSummary(tp, content, lang)}</span></span>
                          <span className="tr-trail">{on ? <span className="tr-check"><I.check /></span> : <I.chev className="chev dirchev" />}</span>
                        </Press></Item>
                      ); })}
                    </Group></Stagger>
                  </React.Fragment>
                ))}
                {/* ما لا يستحقه الموظف الآن: مطوي مع السبب */}
                {picker.unavailable.length > 0 && (
                  <>
                    <SectionLabel action={<button type="button" onClick={() => setShowUnavail((v) => !v)}>{showUnavail ? t.leave.hide : t.leave.show}</button>}>{t.leave.unavailable} · <span className="num">{picker.unavailable.length}</span></SectionLabel>
                    <AnimatePresence initial={false}>
                      {showUnavail && (
                        <motion.div key="unavail" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={SPRING.soft} style={{ overflow: 'hidden' }}>
                          <Group>
                            {picker.unavailable.map(({ tp, why }) => { const Ic = I[tp.icon as keyof typeof I] || I.leave; return (
                              <div key={tp.id} className="type-row off"><span className={`qicon ${tp.tone}`}><Ic /></span><span className="tr-main"><b>{tx(tp.name)}</b><span>{why}</span></span></div>
                            ); })}
                          </Group>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                )}
              </main>
              {wide ? (
                <aside>
                  <AnimatePresence mode="wait">
                    {type ? <motion.div key={type.id} className="type-detail" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }} transition={SPRING.soft}>{detail}</motion.div>
                      : <motion.div key="none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><Group><div className="empty"><span className="ic"><I.leave /></span><b>{t.leave.pickType}</b><p>{lang === 'ar' ? 'اختر نوعاً لترى شروطه ومساره ورصيدك.' : 'Pick a type to see its rules, route and your balance.'}</p></div></Group></motion.div>}
                  </AnimatePresence>
                </aside>
              ) : null}
            </div>
            {!wide ? (
              <Sheet open={!!type && detailOpen} onClose={() => setDetailOpen(false)} title={type ? tx(type.name) : ''} lead={type ? <span className={`qicon ${type.tone}`}>{React.createElement(I[type.icon as keyof typeof I] || I.leave)}</span> : null}>
                {type ? detail : null}
              </Sheet>
            ) : null}
          </motion.div>
        )}

        {step === 2 && type && ev && (
          <motion.div key="s2" {...slide}>
            <div className={wide ? 'grid-2 leave-grid' : ''}>
              <main>
                <Group>
                  <div style={{ padding: '12px 14px 4px' }}>
                    <RangeCalendar from={from} to={to} onChange={onDates} loc={me.location || 'riyadh'} cal={content.calendar} lang={lang} fixedDays={type.fixedDays} single={type.unit === 'halfday'} closedUntil={state.policy.periodClose?.until} />
                  </div>
                  {type.unit === 'halfday' ? <div className="cell"><span className="cell-lead plain"><I.clock /></span><span className="cell-main"><span className="cell-title">{t.leave.halfDay}</span></span><input className="switch" type="checkbox" checked={half} onChange={(e) => setHalf(e.target.checked)} /></div> : null}
                </Group>
                <div style={{ height: 12 }} />
                <AnimatePresence mode="wait">
                  {from && to ? (
                    <motion.div key={`${from}-${to}-${half}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={SPRING.soft}>
                      <div className="tiles days-tiles">
                        <div className="tile"><b className="num"><Ticker value={ev.days} decimals={ev.days % 1 ? 1 : 0} /></b><span>{t.leave.calendarDays}</span></div>
                        <div className="tile"><b className="num"><Ticker value={ev.workingDays} decimals={ev.workingDays % 1 ? 1 : 0} /></b><span>{t.leave.workingDays}</span></div>
                        {ev.balanceAfter !== undefined ? <div className={`tile ${ev.balanceAfter < 0 ? 'bad' : 'soft'}`}><b className="num"><bdi dir="ltr"><Ticker value={ev.balanceAfter} decimals={ev.balanceAfter % 1 ? 1 : 0} /></bdi></b><span>{t.leave.balance} {t.leave.after}</span></div> : ev.sick ? <div className={`tile ${ev.sick.slices.some((x) => x.pay < 100) ? 'bad' : 'soft'}`}><b className="num">{Math.min(...ev.sick.slices.map((x) => x.pay))}%</b><span>{lang === 'ar' ? 'أجر هذا الطلب' : 'Pay for this request'}</span></div> : ev.hijriFrom ? <div className="tile soft"><b style={{ fontSize: '1rem' }}>{hijriText(from, lang)}</b><span>{t.leave.hijri}</span></div> : <div className="tile soft"><b className="num">{built ? built.steps.length : ev.steps.length}</b><span>{lang === 'ar' ? 'خطوات الاعتماد' : 'approval steps'}</span></div>}
                      </div>
                      <div style={{ height: 12 }} />
                      {ev.sick ? <Group><div style={{ padding: '12px 14px' }}><div className="section-label" style={{ padding: '0 0 8px' }}><span>{t.leave.cycle} · {gnames.group(me.group || '')}</span></div><TierBar sick={ev.sick} days={ev.days} /></div></Group> : null}
                      {ev.sick ? <div style={{ height: 12 }} /> : null}
                      <Checks checks={ev.checks.filter((c) => !['elig', 'service', 'once', 'enabled', 'season', 'att'].includes(c.key))} />
                      {ev.entitlements.length > 0 && (
                        <>
                          <div className="section-label"><span>{t.leave.entitlement}</span></div>
                          <Group>
                            {ev.entitlements.map(({ e }) => { const on = ents.includes(e.id); return (
                              <label key={e.id} className={`cell ent-cell ${on ? 'on' : ''}`} style={{ cursor: 'pointer' }}><input className="checkbox" type="checkbox" checked={on} onChange={(ev2) => setEnts((x) => (ev2.target.checked ? [...x, e.id] : x.filter((k) => k !== e.id)))} /><span className="cell-main"><span className="cell-title">{tx(e.name)}</span><span className="cell-sub">{tx(e.action)}</span><span className="cell-sub ent-to"><I.send /> {t.leave.entTo} {tx(agentTitle(e.fulfil.agent, pnames))} · {entTiming(e)}{e.fulfil.mode === 'task' ? ` · ${lang === 'ar' ? 'مهمة تُغلق بمرجع' : 'task closed with a reference'}` : ''}</span></span></label>
                            ); })}
                          </Group>
                        </>
                      )}
                    </motion.div>
                  ) : <motion.p key="hint" className="hint-line" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{t.leave.chooseDates}</motion.p>}
                </AnimatePresence>
              </main>
              {wide ? <aside><div className="section-head"><h2>{t.leave.route}</h2></div><Group><div style={{ padding: '12px 14px' }}>{built ? <RoutePreview steps={built.steps} requester={me} notApplied={built.notApplied} /> : null}</div></Group></aside> : null}
            </div>
            <div style={{ height: 16 }} />
            <motion.button type="button" className="btn primary block lg" disabled={!canNext2} onClick={() => go(3)} whileTap={{ scale: 0.97 }}>{t.leave.next}<I.chev className="dirchev" /></motion.button>
          </motion.div>
        )}

        {step === 3 && type && (
          <motion.div key="s3" {...slide}>
            <Stagger>
              <Group>
                {type.attachment ? (
                  <Field id="f-file" label={tx(type.attachment.label) + (type.attachment.required ? '' : ` (${t.newReq.optional})`)} error={!attachOk && file === '' ? undefined : undefined}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <label className="btn secondary" style={{ cursor: 'pointer' }}><I.clip />{file ? t.newReq.attached : t.newReq.chooseAttachment}<input id="f-file" type="file" style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }} onChange={(e) => setFile(e.target.files?.[0]?.name || '')} /></label>
                      {file ? <Pill icon="clip">{file}</Pill> : null}
                    </div>
                  </Field>
                ) : <div className="cell"><span className="cell-lead plain"><I.clip /></span><span className="cell-main"><span className="cell-title">{lang === 'ar' ? 'لا مرفقات مطلوبة لهذا النوع' : 'No attachment needed for this type'}</span></span></div>}
                <Field id="f-note" label={`${t.leave.note} (${t.newReq.optional})`}><textarea id="f-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
              </Group>
              {type.external ? <><div style={{ height: 10 }} /><Notice tone="warn" icon="info">{tx(type.external)}</Notice></> : null}
              <div style={{ height: 16 }} />
              <Item><motion.button type="button" className="btn primary block lg" disabled={!attachOk} onClick={() => go(4)} whileTap={{ scale: 0.97 }}>{t.leave.review}<I.chev className="dirchev" /></motion.button></Item>
            </Stagger>
          </motion.div>
        )}

        {step === 4 && type && ev && (
          <motion.div key="s4" {...slide}>
            <Stagger>
              <Group>
                <Item><div className="summary-row"><span className="k">{t.leave.pickType}</span><span className="v">{tx(type.name)}</span></div></Item>
                <Item><div className="summary-row"><span className="k">{t.leave.dates}</span><span className="v"><bdi dir="ltr" className="num">{from} → {to}</bdi> · <span className="num">{ev.days}</span> {half && type.unit === 'halfday' ? t.leave.halfDay : lang === 'ar' ? 'يوماً' : 'days'}</span></div></Item>
                {ev.balanceAfter !== undefined ? <Item><div className="summary-row"><span className="k">{t.leave.balance} {t.leave.after}</span><span className="v num">{ev.balanceAfter}</span></div></Item> : null}
                {file ? <Item><div className="summary-row"><span className="k">{t.leave.attachments}</span><span className="v"><Pill icon="clip">{file}</Pill></span></div></Item> : null}
                {note ? <Item><div className="summary-row"><span className="k">{t.leave.note}</span><span className="v">{note}</span></div></Item> : null}
                {ents.length ? <Item><div className="summary-row"><span className="k">{t.leave.entitlement}</span><span className="v">{ents.map((e) => tx(content.entitlements.find((x) => x.id === e)!.name)).join('، ')}</span></div></Item> : null}
                <Item><div className="summary-row"><span className="k">{t.leave.policyVersion}</span><span className="v num">{version.number}</span></div></Item>
              </Group>
              <div className="section-label"><span>{t.leave.route}</span></div>
              <Group><div style={{ padding: '12px 14px' }}>{built ? <RoutePreview steps={built.steps} requester={me} notApplied={built.notApplied} /> : null}</div></Group>
              <div style={{ height: 16 }} />
              <Item><motion.button type="button" className="btn primary block lg" onClick={submit} whileTap={{ scale: 0.97 }}><I.send />{t.leave.submit}</motion.button></Item>
            </Stagger>
          </motion.div>
        )}

        {step === 5 && (
          <motion.div key="s5" className="success" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={SPRING.soft}>
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
