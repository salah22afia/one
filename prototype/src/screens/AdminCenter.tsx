/* v0.18 «مركز الإدارة» (ملاحظة عمر بعد v0.17: «انظر إلى شاشات الإدارة كلها واجعلها الأفضل لمدير النظام… كصفحة إدارة وفيها كل شيء للإدارة»):
   صفحة واحدة لمدير النظام: «يحتاجك» بما ينتظره الآن، والسياسات الأربع بحالة إصداراتها، والبنية والتشغيل بأرقامها، والطلبات بأعدادها والمتأخر منها،
   وشريط «أقسام الإدارة» نفسه يظهر في كل شاشة إدارة فينتقل بينها بلا رجوع (C-UX-118). لا يغيّر شيئاً؛ كل فعل يفتح شاشته. */
import React, { useMemo } from 'react';
import { useStore } from '../app/store';
import { I } from '../ui/icons';
import { LargeTitle, Notice, Pill, TopBar, useLang, useNow, usePerson } from '../ui/components';
import { motion, Stagger, Item, Press, Ticker } from '../ui/motion';
import { useUI, Nb } from '../app/ui';
import { useRoute, nav } from '../app/router';
import { adminOverview, policyTitle, type PolicyCard } from '../domain/admin';
import { currentTenant } from '../domain/tenants';
import { fmtDate, fill } from '../app/i18n';
import { requestTitle } from '../domain/engine';

const NAV: { key: string; href: string; icon: keyof typeof I; match: (parts: string[]) => boolean }[] = [
  { key: 'home', href: '#/admin', icon: 'shield', match: (p) => p[0] === 'admin' && !p[1] },
  { key: 'leave', href: '#/admin/policy', icon: 'leave', match: (p) => p[1] === 'policy' && p[2] !== 'org' && p[2] !== 'ops' },
  { key: 'need', href: '#/admin/need', icon: 'box', match: (p) => p[1] === 'need' },
  { key: 'comms', href: '#/admin/comms', icon: 'sparkle', match: (p) => p[1] === 'comms' },
  { key: 'designer', href: '#/admin/designer', icon: 'gear', match: (p) => p[1] === 'designer' },
  { key: 'tenants', href: '#/admin/tenants', icon: 'building', match: (p) => p[1] === 'tenants' },
  { key: 'contracts', href: '#/admin/contracts', icon: 'plug', match: (p) => p[1] === 'contracts' },
  { key: 'registers', href: '#/admin/registers', icon: 'book', match: (p) => p[1] === 'registers' },
  { key: 'org', href: '#/admin/policy/org', icon: 'team', match: (p) => p[1] === 'policy' && p[2] === 'org' },
  { key: 'ops', href: '#/admin/policy/ops', icon: 'clock', match: (p) => p[1] === 'policy' && p[2] === 'ops' },
];

/** شريط أقسام الإدارة: يظهر تحت عنوان كل شاشة إدارة، والقسم الحالي مضاء */
export function AdminNav() {
  const { L } = useUI(); const r = useRoute(); const x = L.admin.nav as Record<string, string>;
  return (
    <nav className="adm-nav" aria-label={L.admin.title}>
      {NAV.map((n) => { const Ic = I[n.icon]; const on = n.match(r.parts); return <a key={n.key} className={`pill adm-chip ${on ? 'on' : ''}`} href={n.href} aria-current={on ? 'page' : undefined}><Ic />{x[n.key]}</a>; })}
    </nav>
  );
}

function PolicyTile({ p }: { p: PolicyCard }) {
  const { lang, tx } = useLang(); const { L } = useUI(); const x = L.admin.policies; const title = tx(policyTitle(p.key));
  const icon: keyof typeof I = p.key === 'leave' ? 'leave' : p.key === 'need' ? 'box' : p.key === 'comms' ? 'sparkle' : 'gear';
  const tone = p.key === 'leave' ? 'g-green' : p.key === 'need' ? 'g-bronze' : p.key === 'comms' ? 'g-teal' : 'g-gold'; const Ic = I[icon];
  const state = p.awaiting ? { t: `${x.awaiting} · ${p.awaiting.number}`, tone: 'warn' } : p.draft ? { t: `${x.draft} · ${p.draft.number}`, tone: 'tint' } : p.scheduled ? { t: `${x.scheduled} ${p.scheduled.from} · ${p.scheduled.number}`, tone: 'tint' } : null;
  return (
    <Press className="adm-tile" onClick={() => nav(p.href)} lift>
      <span className={`qicon ${tone}`}><Ic /></span>
      <span className="adm-tile-txt">
        <b>{title}</b>
        <span className="adm-tile-line">{p.active ? <><Pill tone="ok">{x.active} <span className="num">{p.active.number}</span></Pill><span className="cell-sub">{x.from} <Nb s={p.active.from} /></span></> : <Pill>{x.none}</Pill>}</span>
        {state ? <span className="adm-tile-line"><Pill tone={state.tone}><Nb s={state.t} /></Pill></span> : null}
        <small>{tx(p.countText)}{p.lastChangeAt ? ` · ${x.lastChange} ${fmtDate(p.lastChangeAt, lang, { day: 'numeric', month: 'short' })}` : ''}</small>
      </span>
      <I.chev className="chev dirchev" />
    </Press>
  );
}

function Stat({ n, label, tone = '' }: { n: number; label: string; tone?: string }) {
  return <div className={`adm-stat ${tone}`}><b className="num"><Ticker value={n} delay={0.2} /></b><span>{label}</span></div>;
}

export function AdminCenter() {
  const { state } = useStore(); const { lang, t, tx } = useLang(); const me = usePerson(); const now = useNow(); const { L } = useUI(); const x = L.admin;
  const ov = useMemo(() => adminOverview(state, now), [state, now]);
  const tenant = currentTenant(state);
  if (me.persona !== 'admin') return <div className="page view policy npc"><TopBar title={x.title} back="#/me" /><Notice tone="warn" icon="info">{t.policy.onlyAdmin}</Notice></div>;
  const actionText = (a: string) => (x.focus as Record<string, string>)[a] || x.focus.open;
  return (
    <div className="page view policy npc adm">
      <TopBar title={x.title} back="#/me" />
      <LargeTitle title={x.title} sub={`${x.sub}${tenant ? ` · ${tx(tenant.short)} · ${tenant.id}` : ''}`} />
      <AdminNav />
      <div className="adm-grid">
        <div className="adm-main">
          {/* يحتاجك */}
          <section className={`fc adm-focus ${ov.focus.length ? '' : 'calm'}`} aria-label={x.focus.title}>
            {ov.focus.length ? (<>
              <div className="fc-head"><span className="fc-label">{x.focus.title}</span><span className="fc-count num"><Ticker value={ov.focus.length} delay={0.25} /></span></div>
              <motion.ul className="fc-list" initial="hide" animate="show" variants={{ show: { transition: { staggerChildren: 0.05, delayChildren: 0.15 } }, hide: {} }}>
                {ov.focus.map((it) => { const Ic = I[it.icon]; return (
                  <motion.li key={it.id} variants={{ hide: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}>
                    <a className={`fc-row ${it.tone === 'danger' ? 'danger' : ''}`} href={it.href} onClick={(e) => { if (it.href === '#/admin#overdue') { e.preventDefault(); document.getElementById('adm-overdue')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }}>
                      <span className={`fc-ic ${it.tone === 'tint' ? '' : it.tone === 'info' ? 'gold' : it.tone}`}><Ic /></span>
                      <span className="fc-txt"><b><Nb s={tx(it.title)} /></b>{it.sub ? <span><Nb s={tx(it.sub)} /></span> : null}</span>
                      <span className="fc-act">{actionText(it.action)}<I.chev className="dirchev" /></span>
                    </a>
                  </motion.li>
                ); })}
              </motion.ul>
            </>) : (
              <div className="fc-calm"><span className="fc-ok"><I.check /></span><span><b>{x.focus.title}</b><span>{x.focus.quiet}</span></span></div>
            )}
          </section>
          {/* السياسات والتهيئة */}
          <div className="lb-head sm"><h2>{x.policies.title}</h2></div>
          <Stagger className="adm-tiles" step={0.04}>{ov.policies.map((p) => <Item key={p.key}><PolicyTile p={p} /></Item>)}</Stagger>
          {/* الطلبات المتأخرة */}
          <div className="lb-head sm" id="adm-overdue"><h2>{x.monitor.title}</h2><span className="lb-muted">{x.monitor.sub}</span></div>
          {ov.overdue.length ? (
            <div className="lrow-list">
              {ov.overdue.map((o) => (
                <a key={`${o.r.id}-${o.step.key}`} className="lrow late" href={`#/requests/${o.r.id}`}>
                  <span className="qicon g-bronze sv-ic"><I.clock /></span>
                  <span className="lrow-txt"><b>{tx(requestTitle(o.r))} · <span className="mono">{o.r.id}</span></b><span className="lrow-line"><span>{tx(o.step.title)} · {x.monitor.at} {lang === 'ar' ? o.holder : o.holderEn}</span><Pill tone="danger" icon="clock">{x.monitor.since} {o.hours < 1 ? (lang === 'ar' ? 'أقل من ساعة' : 'under an hour') : o.hours < 48 ? (lang === 'ar' ? (o.hours === 1 ? 'ساعة' : o.hours === 2 ? 'ساعتين' : o.hours <= 10 ? `${o.hours} ساعات` : `${o.hours} ساعة`) : `${o.hours} h`) : (lang === 'ar' ? (Math.round(o.hours / 24) === 2 ? 'يومين' : Math.round(o.hours / 24) <= 10 ? `${Math.round(o.hours / 24)} أيام` : `${Math.round(o.hours / 24)} يوماً`) : `${Math.round(o.hours / 24)} d`)}</Pill></span></span>
                  <span className="lrow-trail"><I.chev className="dirchev" /></span>
                </a>
              ))}
            </div>
          ) : <div className="adm-quiet"><I.check />{x.monitor.none}</div>}
        </div>
        <aside className="adm-side">
          {/* الطلبات بأعدادها */}
          <div className="lb-head sm"><h2>{x.numbers.title}</h2></div>
          <div className="adm-stats">
            <Stat n={ov.numbers.inReview} label={x.numbers.inReview} />
            <Stat n={ov.numbers.overdue} label={x.numbers.overdue} tone={ov.numbers.overdue ? 'bad' : ''} />
            <Stat n={ov.numbers.returned} label={x.numbers.returned} />
            <Stat n={ov.numbers.newWeek} label={x.numbers.newWeek} />
            <Stat n={ov.numbers.completedWeek} label={x.numbers.completedWeek} tone="ok" />
          </div>
          {/* البنية والتشغيل */}
          <div className="lb-head sm"><h2>{x.structure.title}</h2></div>
          <div className="lrow-list adm-list">
            <a className="lrow" href="#/admin/policy/org"><span className="qicon g-green sv-ic"><I.team /></span><span className="lrow-txt"><b>{x.nav.org}</b><span>{ov.structure.units} {x.structure.units} · {ov.structure.positions} {x.structure.positions}{ov.structure.vacant ? ` · ${ov.structure.vacant} ${x.structure.vacant}` : ''}</span></span><span className="lrow-trail"><I.chev className="dirchev" /></span></a>
            <a className="lrow" href="#/admin/tenants"><span className="qicon g-teal sv-ic"><I.building /></span><span className="lrow-txt"><b>{x.nav.tenants}</b><span>{ov.tenants.total} {x.structure.tenants} · {ov.tenants.active} {x.structure.activeT}{ov.tenants.onboarding ? ` · ${ov.tenants.onboarding} ${x.structure.onboardingT}` : ''}</span></span><span className="lrow-trail"><I.chev className="dirchev" /></span></a>
            <a className="lrow" href="#/admin/contracts"><span className="qicon g-gold sv-ic"><I.plug /></span><span className="lrow-txt"><b>{x.nav.contracts}</b><span>{ov.contracts.total} {x.structure.contracts} · {ov.contracts.bound} {x.structure.bound} · {ov.contracts.tested} {x.structure.tested}</span></span><span className="lrow-trail">{ov.contracts.unboundUsed ? <Pill tone="danger">{ov.contracts.unboundUsed}</Pill> : null}<I.chev className="dirchev" /></span></a>
            <a className="lrow" href="#/admin/registers"><span className="qicon g-sage sv-ic"><I.book /></span><span className="lrow-txt"><b>{x.nav.registers}</b><span>{ov.registers.entries} {x.structure.entries}{ov.registers.expiring ? ` · ${ov.registers.expiring} ${x.structure.expiring}` : ''}</span></span><span className="lrow-trail">{ov.registers.expiring ? <Pill tone="warn">{ov.registers.expiring}</Pill> : null}<I.chev className="dirchev" /></span></a>
            <a className="lrow" href="#/admin/policy/ops"><span className="qicon g-bronze sv-ic"><I.clock /></span><span className="lrow-txt"><b>{x.nav.ops}</b><span>{ov.ops.periodUntil ? `${x.structure.periodClosed} ${ov.ops.periodUntil}` : x.structure.periodOpen}{ov.ops.openWindows.length ? ` · ${ov.ops.openWindows.length} ${x.structure.windowsOpen}` : ''}</span></span><span className="lrow-trail"><I.chev className="dirchev" /></span></a>
            <a className="lrow" href="#/me"><span className="qicon g-green sv-ic"><I.person /></span><span className="lrow-txt"><b>{x.review.title}</b><span>{x.review.sub}</span></span><span className="lrow-trail"><I.chev className="dirchev" /></span></a>
          </div>
          <p className="cell-sub adm-foot">{fill(lang === 'ar' ? 'آخر تحديث {d}' : 'Last refreshed {d}', { d: fmtDate(now, lang, { hour: '2-digit', minute: '2-digit' }) })}</p>
        </aside>
      </div>
    </div>
  );
}
