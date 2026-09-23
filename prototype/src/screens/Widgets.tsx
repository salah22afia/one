/* «لي»: ودجات بارتفاع ثابت بحجم ودجات iOS — الرصيد، والعهدة، وكل طلب جارٍ بلاطةً بمرحلته، وفريقي للمدير، والراتب — تُعرض شريطاً على الهاتف وعموداً على الحاسوب؛
   الإحصاءات الفارغة لا تُعرض. */
import React from 'react';
import { motion } from 'motion/react';
import { useStore } from '../app/store';
import { useLang, usePerson, StatusPill } from '../ui/components';
import { Ring, Ticker } from '../ui/motion';
import { I } from '../ui/icons';
import { requestTitle, stepWho, teamOf } from '../domain/engine';
import { fmtNum, relTime, fill } from '../app/i18n';
import { useUI, Rail, Head, useIntroSkip } from '../app/ui';

function W({ children, href, className = '', delay = 0 }: { children: React.ReactNode; href?: string; className?: string; delay?: number }) {
  const reduce = useIntroSkip();
  const props = { className: `wg ${className}`, initial: reduce ? false : { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { type: 'spring', stiffness: 300, damping: 28, delay }, whileTap: { scale: 0.975 } } as const;
  return href ? <motion.a href={href} {...props} role="listitem">{children}</motion.a> : <motion.div {...props} role="listitem">{children}</motion.div>;
}

export function MineSection({ now }: { now: number }) {
  const { state } = useStore(); const { lang, t, tx } = useLang(); const me = usePerson(); const { L, desk } = useUI();
  const bal = state.balances[me.id];
  const custody = state.custody.filter((c) => c.personId === me.id && !c.returnedAt);
  const ongoing = state.requests.filter((r) => r.requesterId === me.id && (r.status === 'in_review' || r.status === 'returned')).slice(0, 4);
  const team = teamOf(state, me); const onLeave = team.filter((p) => p.onLeaveToday).length;
  const slips = state.payslips[me.id] || [];
  const tiles: React.ReactNode[] = [];
  let d = 0.05;
  if (bal) tiles.push(
    <W key="bal" href="#/me/leaves" className="wg-bal" delay={d += 0.05}>
      <Ring value={bal.annual} max={bal.annualTotal} size={64} stroke={7} delay={0.5}><b className="num wg-ring-n"><Ticker value={bal.annual} decimals={Number.isInteger(bal.annual) ? 0 : 1} delay={0.5} /></b></Ring>
      <span className="wg-txt"><b>{L.annual}</b><span>{fmtNum(bal.annual, lang, 1)} {fill(L.ofDays, { n: bal.annualTotal })} {L.days}</span><small>{t.me.sick} {bal.sick} · {t.me.emergency} {bal.emergency}</small></span>
    </W>,
  );
  for (const r of ongoing) {
    const steps = r.steps.filter((s) => s.status !== 'skipped'); const done = steps.filter((s) => s.status === 'done').length; const cur = r.steps.find((s) => s.status === 'current' || s.status === 'returned');
    tiles.push(
      <W key={r.id} href={`#/requests/${r.id}`} className={`wg-req ${r.status === 'returned' ? 'ret' : ''}`} delay={d += 0.05}>
        <span className="wg-top"><span className="wg-ic"><I.doc /></span>{r.status === 'returned' ? <StatusPill r={r} /> : null}</span>
        <span className="wg-txt"><b>{tx(requestTitle(r))}</b><span>{cur ? `${tx(cur.title)} · ${stepWho(state, r, cur, lang)}` : ''}</span><small>{cur ? relTime(cur.startedAt || cur.at || r.createdAt, lang, now) : ''}</small></span>
        <span className="wg-prog" aria-hidden="true">{steps.map((s, i) => <i key={i} className={i < done ? 'on' : s.status === 'current' ? 'cur' : ''} />)}</span>
      </W>,
    );
  }
  if (custody.length) tiles.push(
    <W key="cus" href="#/me/custody" className="wg-cus" delay={d += 0.05}>
      <span className="wg-top"><span className="wg-ic gold"><I.box /></span></span>
      <span className="wg-txt"><b className="wg-big num"><Ticker value={custody.length} delay={0.4} /> <small>{custody.length === 1 ? L.item : L.items}</small></b><span>{L.custody}</span><small>{custody.slice(0, 2).map((c) => tx(c.name)).join(' · ')}</small></span>
    </W>,
  );
  if (team.length) tiles.push(
    <W key="team" href="#/inbox" className="wg-team" delay={d += 0.05}>
      <span className="wg-top"><span className="wg-ic sage"><I.team /></span></span>
      <span className="wg-txt"><b className="wg-big num"><Ticker value={team.length} delay={0.4} /></b><span>{L.team}</span><small>{onLeave ? `${onLeave} ${L.onLeave}` : lang === 'ar' ? 'الجميع على رأس العمل' : 'Everyone is in'}</small></span>
    </W>,
  );
  if (slips.length) tiles.push(
    <W key="pay" href="#/me" className="wg-pay" delay={d += 0.05}>
      <span className="wg-top"><span className="wg-ic"><I.wallet /></span></span>
      <span className="wg-txt"><b>{L.payslip}</b><span>{tx(slips[0].month)}</span><small>{lang === 'ar' ? 'القسيمة جاهزة في ملفي' : 'Payslip ready in Me'}</small></span>
    </W>,
  );
  if (!tiles.length) return null;
  return (
    <section className="lb-mine">
      <Head action={ongoing.length ? <a className="lb-link" href="#/requests">{L.ongoing}</a> : undefined}>{L.mine}</Head>
      {desk ? <div className="lb-mine-grid" role="list">{tiles}</div> : <Rail className="lb-mine-rail" ariaLabel={L.mine}>{tiles}</Rail>}
    </section>
  );
}
