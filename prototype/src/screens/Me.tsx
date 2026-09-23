/* «ملفي» في المختبر: البطاقة الرقمية ثم شبكة ودجات تفتح صفحاتها (بياناتي، ومحفظة مستنداتي، وأرصدتي، وراتبي، وأسرتي، وعهدتي، وسجل إجازاتي، وإعداداتي)
   — لا كل شيء مفتوحاً (C-UX-87)؛ ومحفظة المستندات بطاقات على طريقة Wallet: الوجه للنظرة الخاطفة والتفاصيل عند التقديم. */
import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../app/store';
import { nav } from '../app/router';
import { I, type IconName } from '../ui/icons';
import { useLang, usePerson, Cell, Group, Pill, Empty, Notice, useNow, Segmented, Avatar, useToast } from '../ui/components';
import { SPRING, Ring, Ticker, Tilt } from '../ui/motion';
import { QR } from '../ui/QR';
import emblem from '../assets/emblem.png';
import { LeaveHistory, LeaveHistoryPreview } from '../screens/LeaveHistory';
import { Custody } from '../screens/Custody';
import { MyRegisters } from '../screens/Registers';
import { lineManagerOf, positionOf, unitOf } from '../domain/engine';
import { useGroupNames } from '../ui/LeaveBits';
import { desksFor } from '../domain/need';
import { fmtDate, fmtNum, daysUntil, fill } from '../app/i18n';
import type { EmpDoc, Payslip, NotifKind, PersonaKey } from '../domain/types';
import { clearMedia } from '../ui/media';
import { useUI, BottomSheet, useIntroSkip } from '../app/ui';
import { PageChrome, Mark } from '../ui/Page';

const DOC_ICON: Record<EmpDoc['icon'], IconName> = { passport: 'passport', id: 'idcard', card: 'card', licence: 'card', contract: 'doc', insurance: 'shield' };
const DOC_HUE: Record<EmpDoc['icon'], string> = { passport: 'night', id: 'green', card: 'gold', licence: 'bronze', contract: 'sage', insurance: 'teal' };

function Widget({ href, icon, tone = '', title, value, sub, delay = 0, warn }: { href: string; icon: IconName; tone?: string; title: string; value?: React.ReactNode; sub?: React.ReactNode; delay?: number; warn?: boolean }) {
  const Ic = I[icon]; const reduce = useIntroSkip();
  return (
    <motion.a className={`mw ${warn ? 'warn' : ''}`} href={href} initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING.soft, delay }} whileTap={{ scale: 0.975 }} role="listitem">
      <span className="mw-top"><span className={`wg-ic ${tone}`}><Ic /></span><I.chev className="dirchev mw-chev" /></span>
      <span className="mw-txt">{value !== undefined ? <b className="mw-val num">{value}</b> : null}<b className="mw-t">{title}</b>{sub ? <span>{sub}</span> : null}</span>
    </motion.a>
  );
}

export function Me() {
  const { state } = useStore(); const { lang, t, tx } = useLang(); const me = usePerson(); const now = useNow(); const { L, desk } = useUI();
  const [flipped, setFlipped] = useState(false);
  const docs = state.docs[me.id] || []; const pay = state.payslips[me.id] || []; const deps = state.dependants[me.id] || []; const bal = state.balances[me.id];
  const custody = state.custody.filter((c) => c.personId === me.id && !c.returnedAt);
  const expiring = docs.filter((d) => daysUntil(d.expiresAt, now) <= 30).length; const completeness = Math.round(((docs.length - expiring) / Math.max(1, docs.length)) * 100);
  const leaves = state.requests.filter((r) => r.requesterId === me.id && r.leave && r.status === 'completed').sort((a, b) => b.updatedAt - a.updatedAt);
  const desks = desksFor(state, me);
  let d = 0;
  return (
    <PageChrome title={t.me.title} root end={<button type="button" className="icon-btn" onClick={() => nav('#/me/settings')} aria-label={t.me.settings}><I.gear /></button>}>
      <div className={desk ? 'me-desk' : ''}>
        <div className="me-card"><IdCard flipped={flipped} onFlip={() => setFlipped((f) => !f)} /></div>
        <div className="mw-grid" role="list">
          <Widget href="#/me/data" icon="person" tone="" title={t.me.data} value={`${completeness}%`} sub={completeness < 100 ? L.pages.completeProfile : L.pages.profileOk} warn={completeness < 100} delay={d += 0.04} />
          <Widget href="#/me/docs" icon="passport" tone="gold" title={t.me.docs} value={docs.length} sub={expiring ? fill(L.pages.docsExpiring, { n: expiring }) : L.pages.docsOk} warn={expiring > 0} delay={d += 0.04} />
          {bal ? <Widget href="#/me/balances" icon="leave" tone="sage" title={t.me.balances} value={<>{fmtNum(bal.annual, lang, Number.isInteger(bal.annual) ? 0 : 1)} <small>{t.me.days}</small></>} sub={`${t.me.annual} · ${bal.annualTotal}`} delay={d += 0.04} /> : null}
          {pay.length ? <Widget href="#/me/pay" icon="wallet" tone="" title={t.me.pay} sub={`${L.pages.lastPayslip} · ${tx(pay[0].month)}`} delay={d += 0.04} /> : null}
          <Widget href="#/me/family" icon="family" tone="sage" title={t.me.family} value={deps.length} sub={deps.length === 1 ? L.pages.dependantsOne : fill(L.pages.dependants, { n: deps.length })} delay={d += 0.04} />
          <Widget href="#/me/custody" icon="box" tone="gold" title={t.need.custody.title} value={custody.length} sub={custody.length === 0 ? L.pages.custodyNone : custody.length === 1 ? L.pages.custodyOne : fill(L.pages.custodyN, { n: custody.length })} delay={d += 0.04} />
          <Widget href="#/me/leaves" icon="calendar" tone="" title={t.leaveHist.title} sub={leaves[0] ? `${L.pages.lastLeave} · ${fmtDate(leaves[0].updatedAt, lang, { day: 'numeric', month: 'long' })}` : t.leaveHist.empty} delay={d += 0.04} />
          <Widget href="#/me/settings" icon="gear" tone="" title={t.me.settings} sub={L.pages.settingsSub} delay={d += 0.04} />
        </div>
        {/* v0.16 (9.4): سجلاتي — ما صدر لي من تصاريح وبطاقات وقيود */}
        <MyRegisters />
        {(desks.procurement || desks.store || me.persona === 'admin') ? (
          <section className="lb-sec-list"><div className="lb-head"><h2>{L.pages.myTools}</h2></div><div className="lrow-list">
            {desks.procurement ? <a className="lrow" href="#/desk/procurement"><span className="qicon g-gold sv-ic"><I.wallet /></span><span className="lrow-txt"><b>{t.need.desk.proc}</b><span>{t.need.desk.procSub}</span></span><span className="lrow-trail">{desks.procurementCount ? <Pill tone="gold">{desks.procurementCount}</Pill> : null}<I.chev className="dirchev" /></span></a> : null}
            {desks.store ? <a className="lrow" href="#/desk/store"><span className="qicon g-bronze sv-ic"><I.box /></span><span className="lrow-txt"><b>{t.need.desk.store}</b><span>{t.need.desk.storeSub}</span></span><span className="lrow-trail">{desks.storeCount ? <Pill tone="gold">{desks.storeCount}</Pill> : null}<I.chev className="dirchev" /></span></a> : null}
            {/* v0.18: صف واحد «الإدارة» يفتح مركز الإدارة وفيه كل شيء */}
            {me.persona === 'admin' ? <a className="lrow" href="#/admin"><span className="qicon g-green sv-ic"><I.shield /></span><span className="lrow-txt"><b>{L.admin.title}</b><span>{L.admin.sub}</span></span><span className="lrow-trail"><I.chev className="dirchev" /></span></a> : null}
          </div></section>
        ) : null}
      </div>
    </PageChrome>
  );
}

/* ——— محفظة المستندات ——— */
function PassCard({ d, onFront, front, now }: { d: EmpDoc; onFront: () => void; front: boolean; now: number }) {
  const { lang, t, tx } = useLang(); const { L } = useUI(); const me = usePerson(); const Ic = I[DOC_ICON[d.icon]];
  const n = daysUntil(d.expiresAt, now); const state = n < 0 ? 'expired' : n <= 30 ? 'expiring' : 'valid';
  const masked = d.number.length > 4 ? `${'•'.repeat(Math.min(6, d.number.length - 4))}${d.number.slice(-4)}` : d.number;
  return (
    <motion.div layout className={`pass hue-${DOC_HUE[d.icon]} ${state} ${front ? 'front' : ''}`} onClick={onFront} transition={{ type: 'spring', stiffness: 320, damping: 32 }} whileTap={{ scale: 0.985 }} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onFront(); } }}>
      <span className="pass-orn" aria-hidden="true" />
      <div className="pass-head"><img className="pass-logo" src={emblem} alt="" /><span className="pass-org">{t.org}</span><span className="pass-ic"><Ic /></span></div>
      <div className="pass-primary"><b>{tx(d.title)}</b></div>
      <div className="pass-foot">
        <span className="pass-field"><small>{L.pages.number}</small><b className="num ltr">{front ? d.number : masked}</b></span>
        <span className="pass-field"><small>{L.pages.expiresOn}</small><b className="num">{fmtDate(d.expiresAt, lang, { day: 'numeric', month: 'short', year: 'numeric' })}</b></span>
        <span className={`pass-state ${state}`}>{state === 'expired' ? L.pages.expired : state === 'expiring' ? `${n} ${t.me.daysLeft}` : L.pages.valid}</span>
      </div>
      <AnimatePresence>{front ? (
        <motion.div className="pass-more" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.24 }}>
          <div className="pass-rows"><span><small>{L.pages.issued}</small><b>{lang === 'ar' ? 'النظام المرجعي' : 'System of record'}</b></span><span><small>{t.me.employeeNo}</small><b className="mono">GCC-{me.empNo}</b></span></div>
          <button type="button" className="btn soft block" onClick={(e) => { e.stopPropagation(); nav('#/new/MD-05'); }}><I.reset />{L.pages.renew}</button>
        </motion.div>
      ) : null}</AnimatePresence>
    </motion.div>
  );
}

export function Docs() {
  const { state } = useStore(); const { t } = useLang(); const me = usePerson(); const now = useNow(); const { L } = useUI();
  const docs = useMemo(() => (state.docs[me.id] || []).slice().sort((a, b) => daysUntil(a.expiresAt, now) - daysUntil(b.expiresAt, now)), [state.docs, me.id, now]);
  const [front, setFront] = useState<string | null>(null);
  const ordered = front ? [docs.find((d) => d.id === front)!, ...docs.filter((d) => d.id !== front)] : docs;
  return (
    <PageChrome title={t.me.docs} sub={L.pages.walletSub} back="#/me" end={<a className="btn soft sm" href="#/new/MD-05"><I.plus />{t.me.update}</a>}>
      {docs.length === 0 ? <div className="lb-empty"><Empty icon="passport" title={t.requests.noDocs} /></div> : (
        <div className={`wallet ${front ? 'has-front' : ''}`}>
          {ordered.map((d) => <PassCard key={d.id} d={d} now={now} front={front === d.id} onFront={() => setFront(front === d.id ? null : d.id)} />)}
        </div>
      )}
    </PageChrome>
  );
}

/* ——— بياناتي ——— */
export function MyData() {
  const { state } = useStore(); const { lang, t, tx } = useLang(); const me = usePerson(); const { L } = useUI();
  const manager = lineManagerOf(state, me); const gnames = useGroupNames(); const pos = positionOf(state, me); const unit = unitOf(state, me);
  return (
    <PageChrome title={t.me.data} sub={L.pages.dataSub} back="#/me" end={<a className="btn soft sm" href="#/new/MD-01"><I.pen />{t.me.update}</a>}>
      <Group>
        <Cell icon="person" tone="plain" title={t.me.mobile} value={<span className="ltr">+966 5• ••• •412</span>} href="#/new/MD-01" />
        <Cell icon="letter" tone="plain" title={t.me.email} value={<span className="ltr">a.aldosari@gcc-sg.org</span>} href="#/new/MD-01" />
        <Cell icon="wallet" tone="plain" title={t.me.bank} value={<span className="ltr">SA•• •••• 4471</span>} href="#/new/MD-02" />
      </Group>
      <div className="lb-head sm"><h2>{lang === 'ar' ? 'من النظام المرجعي' : 'From the system of record'}</h2></div>
      <Group>
        <Cell icon="team" tone="plain" title={t.me.manager} sub={manager ? `${lang === 'ar' ? manager.name : manager.nameEn}${manager.positionId ? ` · ${tx(state.org.positions.find((x) => x.id === manager.positionId)?.title)}` : ''}` : '—'} chevron={false} />
        <Cell icon="grid" tone="plain" title={t.me.position} sub={pos ? `${tx(pos.title)} · ${pos.id}${unit ? ` · ${tx(unit.name)}` : ''}` : '—'} chevron={false} />
        <Cell icon="idcard" tone="plain" title={t.me.group} sub={me.group ? `${gnames.group(me.group)}${me.subgroup ? ` · ${gnames.subgroup(me.subgroup)}` : ''} · ${t.leave.location[me.location || 'riyadh']}` : '—'} chevron={false} />
        <Cell icon="idcard" tone="plain" title={t.me.employeeNo} value={<span className="mono">GCC-{me.empNo}</span>} chevron={false} />
      </Group>
    </PageChrome>
  );
}

/* ——— أرصدتي ——— */
export function Balances() {
  const { state } = useStore(); const { t } = useLang(); const me = usePerson(); const bal = state.balances[me.id];
  return (
    <PageChrome title={t.me.balances} back="#/me">
      {bal ? (
        <div className="tiles rings lb-rings">
          <div className="tile ringtile"><Ring value={bal.annual} max={bal.annualTotal} size={84} stroke={9} delay={0.2}><b className="num"><Ticker value={bal.annual} decimals={Number.isInteger(bal.annual) ? 0 : 1} delay={0.2} /></b></Ring><span>{t.me.annual}<small className="num"> / {bal.annualTotal}</small></span></div>
          <div className="tile ringtile"><Ring value={bal.sick} max={30} size={84} stroke={9} color="var(--gold)" delay={0.3}><b className="num"><Ticker value={bal.sick} delay={0.3} /></b></Ring><span>{t.me.sick}</span></div>
          <div className="tile ringtile"><Ring value={bal.emergency} max={5} size={84} stroke={9} color="var(--info)" delay={0.4}><b className="num"><Ticker value={bal.emergency} delay={0.4} /></b></Ring><span>{t.me.emergency}</span></div>
        </div>
      ) : <div className="lb-empty"><Empty icon="leave" title="—" /></div>}
      <div className="lb-head sm"><h2>{t.leaveHist.latest}</h2><a className="lb-link" href="#/me/leaves">{t.leaveHist.viewAll}</a></div>
      <LeaveHistoryPreview />
    </PageChrome>
  );
}

/* ——— راتبي ——— */
export function Pay() {
  const { state } = useStore(); const { lang, t, tx } = useLang(); const me = usePerson(); const pay = state.payslips[me.id] || [];
  const [slip, setSlip] = useState<Payslip | null>(null);
  return (
    <PageChrome title={t.me.pay} back="#/me">
      <Group>{pay.map((p) => <Cell key={p.id} icon="wallet" tone="plain" title={tx(p.month)} sub={`${t.me.net} ${fmtNum(p.net, lang, 2)}`} value={<span className="num">{fmtNum(p.net, lang, 0)}</span>} onClick={() => setSlip(p)} />)}</Group>
      <BottomSheet open={!!slip} onClose={() => setSlip(null)} title={slip ? `${t.me.payslip} · ${tx(slip.month)}` : ''}>
        {slip && (<>
          <Group>
            <div className="summary-row"><span className="k">{t.me.gross}</span><span className="v num">{fmtNum(slip.gross, lang, 2)}</span></div>
            <div className="summary-row"><span className="k">{t.me.deductions}</span><span className="v num">{fmtNum(slip.deductions, lang, 2)}</span></div>
            <div className="summary-row"><span className="k"><b>{t.me.net}</b></span><span className="v num"><b>{fmtNum(slip.net, lang, 2)}</b></span></div>
            <div className="summary-row"><span className="k">{t.requests.issued}</span><span className="v">{fmtDate(slip.issuedAt, lang)}</span></div>
          </Group>
          <div style={{ height: 10 }} />
          <Notice icon="info">{lang === 'ar' ? 'أرقام تجريبية. القسيمة الحقيقية تُقرأ من نتائج الرواتب في النظام المرجعي.' : 'Fictional figures. The real payslip is read from payroll results in the system of record.'}</Notice>
        </>)}
      </BottomSheet>
    </PageChrome>
  );
}

/* ——— أسرتي ——— */
export function Family() {
  const { state } = useStore(); const { t, tx } = useLang(); const me = usePerson(); const now = useNow(); const deps = state.dependants[me.id] || [];
  const docPill = (expiresAt: number) => { const n = daysUntil(expiresAt, now); return n < 0 ? <Pill tone="danger">{t.me.expired}</Pill> : n <= 30 ? <Pill tone={n <= 15 ? 'danger' : 'warn'} icon="alert">{n} {t.me.daysLeft}</Pill> : <Pill tone="done">{t.me.valid}</Pill>; };
  return (
    <PageChrome title={t.me.family} back="#/me" end={<a className="btn soft sm" href="#/services/MD"><I.plus />{t.me.addDependant}</a>}>
      {deps.length ? <Group>{deps.map((d) => <Cell key={d.id} icon="family" tone="plain" title={tx(d.name)} sub={tx(d.relation)} pill={d.docExpiresAt ? docPill(d.docExpiresAt) : undefined} chevron={false} />)}</Group> : <div className="lb-empty"><Empty icon="family" title="—" /></div>}
    </PageChrome>
  );
}

/* ——— إعداداتي ——— */
export function Settings() {
  const { state, dispatch } = useStore(); const { lang, t } = useLang(); const { L, ui } = useUI(); const me = usePerson(); const toast = useToast();
  const prefs = state.settings.notifPrefs;
  const KIND_ICON: Record<NotifKind, IconName> = { task: 'inbox', status: 'doc', document: 'seal', expiry: 'alert', reminder: 'clock', policy: 'shield', circular: 'seal', story: 'sparkle' };
  const personas: PersonaKey[] = ['employee', 'manager', 'hr', 'buyer', 'admin'];
  const canFrame = window.innerWidth >= 1024;
  return (
    <PageChrome title={t.me.settings} back="#/me">
      <Group>
        <div className="cell set-row"><span className="cell-lead plain"><I.globe /></span><span className="cell-main"><span className="cell-title">{t.settings.language}</span></span><span className="cell-trail"><Segmented id="lbs-lang" value={state.settings.lang} onChange={(v) => dispatch({ type: 'settings', patch: { lang: v } })} options={[{ v: 'ar' as const, label: 'العربية' }, { v: 'en' as const, label: 'English' }]} /></span></div>
        <div className="cell set-row"><span className="cell-lead plain"><I.moon /></span><span className="cell-main"><span className="cell-title">{t.settings.appearance}</span></span><span className="cell-trail"><Segmented id="lbs-theme" value={state.settings.theme} onChange={(v) => dispatch({ type: 'settings', patch: { theme: v } })} options={[{ v: 'auto' as const, label: t.settings.auto }, { v: 'light' as const, label: t.settings.light }, { v: 'dark' as const, label: t.settings.dark }]} /></span></div>
        {/* v0.17 (النظرة العميقة): حجم النص بثلاث درجات — «واضحة لمن في التسعين» */}
        <div className="cell set-row"><span className="cell-lead plain"><I.pen /></span><span className="cell-main"><span className="cell-title">{L.pages.textSize}</span><span className="cell-sub">{L.pages.textSizeHint}</span></span><span className="cell-trail"><Segmented id="lbs-text" value={state.settings.textSize || 'normal'} onChange={(v) => dispatch({ type: 'settings', patch: { textSize: v } })} options={[{ v: 'normal' as const, label: L.pages.textSizes.normal }, { v: 'large' as const, label: L.pages.textSizes.large }, { v: 'xl' as const, label: L.pages.textSizes.xl }]} /></span></div>
      </Group>
      <div className="lb-head sm"><h2>{L.pages.notifKinds}</h2></div>
      <Group>
        {(Object.keys(t.notif.kinds) as NotifKind[]).map((k) => { const Ic = I[KIND_ICON[k]]; return (
          <label key={k} className="cell" style={{ cursor: 'pointer' }}><span className="cell-lead plain"><Ic /></span><span className="cell-main"><span className="cell-title">{t.notif.kinds[k]}</span></span><input className="switch" type="checkbox" checked={prefs[k] ?? true} onChange={(e) => dispatch({ type: 'settings', patch: { notifPrefs: { ...prefs, [k]: e.target.checked } } })} /></label>
        ); })}
      </Group>
      <div className="lb-head sm"><h2>{lang === 'ar' ? 'الحساب' : 'Account'}</h2></div>
      <Group><div className="cell"><Avatar p={me} /><span className="cell-main"><span className="cell-title">{lang === 'ar' ? me.name : me.nameEn}</span><span className="cell-sub">{lang === 'ar' ? me.title : me.titleEn} · <span className="mono">GCC-{me.empNo}</span></span></span></div></Group>
      {/* أدوات المراجعة (النموذج الحي): الشخصية، وأي موظف بعينه، وإطار الهاتف على الحاسوب، ولغة التصميم، وإعادة الضبط */}
      <div className="lb-head sm"><h2>{L.settings.tools}</h2></div>
      <Group foot={L.settings.personaHint}>
        {personas.map((pk) => { const p = state.people.find((x) => x.persona === pk); if (!p) return null; const on = me.id === p.id; return <Cell key={pk} lead={<Avatar p={p} tone={on ? '' : 'gold'} />} title={lang === 'ar' ? p.name : p.nameEn} sub={`${t.personas[pk]} · ${lang === 'ar' ? p.title : p.titleEn}`} pill={on ? <Pill tone="tint" icon="check">{t.common.you}</Pill> : undefined} onClick={() => { dispatch({ type: 'settings', patch: { persona: pk, actAs: undefined } }); nav('#/home'); }} chevron={!on} />; })}
        <div className="cell actas"><span className="cell-lead plain"><I.person /></span><span className="cell-main"><span className="cell-title">{L.settings.actAs}</span><span className="cell-sub">{t.me.actAsHint}</span></span><span className="cell-trail"><select id="act-as" className="select-in" value={me.id} onChange={(e) => { const p = state.people.find((x) => x.id === e.target.value); if (!p) return; dispatch({ type: 'settings', patch: { persona: p.persona, actAs: p.id } }); nav('#/home'); }}>{state.people.slice().sort((a, b) => (a.positionId || '').localeCompare(b.positionId || '')).map((p) => <option key={p.id} value={p.id}>{lang === 'ar' ? p.name : p.nameEn} · {lang === 'ar' ? p.title : p.titleEn}</option>)}</select></span></div>
      </Group>
      <div style={{ height: 10 }} />
      <Group>
        {canFrame ? <label className="cell" style={{ cursor: 'pointer' }}><span className="cell-lead plain"><I.person /></span><span className="cell-main"><span className="cell-title">{L.phoneFrame}</span><span className="cell-sub">390 × 844</span></span><input className="switch" type="checkbox" checked={ui.phone} onChange={(e) => dispatch({ type: 'settings', patch: { phoneFrame: e.target.checked } })} /></label> : null}
        <Cell icon="sparkle" tone="plain" title={L.settings.design} href="#/design" />
        <Cell icon="reset" tone="plain" title={L.settings.reset} sub={L.settings.resetSub} onClick={() => { clearMedia(); dispatch({ type: 'reset' }); toast({ title: t.settings.resetDone, icon: 'reset', tone: 'info' }); }} chevron={false} />
      </Group>
      <p className="lb-muted lb-foot-note"><Mark size={18} /> {t.org} · {L.settings.about} · {L.settings.version} 0.13 · 20/09/2026</p>
    </PageChrome>
  );
}

export { LeaveHistory as Leaves, Custody as CustodyPage };

/* البطاقة الرقمية: وجه يُقرأ بنظرة، وظهر فيه رمز التحقق — تُقلب بالنقر */
export function IdCard({ flipped, onFlip }: { flipped: boolean; onFlip: () => void }) {
  const { lang, t } = useLang(); const me = usePerson();
  return (
      <Tilt className="idcard-tilt" flipped={flipped} onFlip={onFlip} back={
        <section className="idcard back" aria-hidden="true">
          <div className="orn" />
          <div className="id-top"><div className="id-org">{t.org}<small>{lang === 'ar' ? 'بطاقة تحقق رقمية' : 'Digital verification card'}</small></div><img className="id-emblem" src={emblem} alt="" /></div>
          <div className="id-back-body"><div className="qr lg" aria-hidden="true"><QR seed={me.empNo} /></div><div className="id-back-txt"><b className="mono">GCC-{me.empNo}</b><span>{lang === 'ar' ? 'امسح الرمز للتحقق من صلاحية البطاقة' : 'Scan to verify this card'}</span><span className="id-valid">{lang === 'ar' ? 'سارية حتى' : 'Valid until'} 12/2027</span></div></div>
        </section>
      }>
      <section className="idcard" aria-label={lang === 'ar' ? 'بطاقة الموظف الرقمية' : 'Digital employee card'}>
        <div className="orn" />
        <div className="id-shine" aria-hidden="true" />
        <div className="id-top"><div className="id-org">{t.org}<small>{lang === 'ar' ? 'الإدارة العامة للشؤون المالية والإدارية' : 'General Administration for Financial & Administrative Affairs'}</small></div><img className="id-emblem" src={emblem} alt="" /></div>
        <div><div className="id-name">{lang === 'ar' ? me.name : me.nameEn}</div><div className="id-title">{lang === 'ar' ? me.title : me.titleEn} · {lang === 'ar' ? me.unit : me.unitEn}</div></div>
        <div className="id-bottom"><div className="id-no">{t.me.employeeNo}<b>GCC-{me.empNo}</b></div><div className="id-flip-hint"><I.reset />{lang === 'ar' ? 'اقلب للتحقق' : 'Flip to verify'}</div></div>
      </section>
      </Tilt>
  );
}
