import React from 'react';
import { motion, Stagger, Item, SPRING } from './motion';
import { I } from './icons';
import { Avatar, Pill, useLang } from './components';
import { useStore } from '../app/store';
import { assigneesFor, stepWho } from '../domain/engine';
import type { Request, Step, Person, State, T2 } from '../domain/types';
import type { Check, SickView, LeaveType, EvalResult } from '../domain/policy';
import { workingDaysText } from '../app/i18n';

/** أسماء فئات النظام المرجعي باللغة الحالية (للشروط والنطاقات والدورات) */
export function useGroupNames() {
  const { state } = useStore(); const { lang, t } = useLang();
  return React.useMemo(() => ({
    group: (id: string) => { const g = state.groups.find((x) => x.id === id); return g ? (lang === 'ar' ? g.name.ar : g.name.en) : id; },
    subgroup: (id: string) => { const sg = state.groups.flatMap((x) => x.subgroups).find((x) => x.id === id); return sg ? (lang === 'ar' ? sg.name.ar : sg.name.en) : id; },
    location: (id: string) => t.leave.location[id as 'riyadh' | 'abudhabi'] || id,
  }), [state.groups, lang, t]);
}

/** نوع الإجازة كما كان في الإصدار الذي قُيِّم به الطلب (وإلا فالأحدث الذي يعرفه) */
export function leaveTypeOf(state: State, r: Request): LeaveType | undefined {
  if (!r.leave) return undefined;
  const vs = state.policy.versions; const v = vs.find((x) => x.number === r.policyVersion) || vs[vs.length - 1];
  return v?.content.types.find((x) => x.id === r.leave!.typeId) || vs.flatMap((x) => x.content.types).find((x) => x.id === r.leave!.typeId);
}

/** معاينة المسار: من سيعتمد (أشخاص لحظة المعاينة)، وكم ينتظر، ومن يُشعَر فقط، ولماذا استُخرج كل واحد؛ وما لا ينطبق ولماذا */
export function RoutePreview({ steps, requester, notApplied, why: showWhy = true }: { steps: Step[]; requester: Person; notApplied?: { title: T2; why: T2 }[]; why?: boolean }) {
  const { state } = useStore(); const { lang, t, tx } = useLang();
  const fake: Request = { id: 'preview', serviceId: 'TM-01', requesterId: requester.id, createdAt: 0, updatedAt: 0, status: 'in_review', steps, fields: [], docs: [], audit: [], channel: 'app' };
  return (
    <>
      <Stagger className="route-preview" step={0.05}>
        {steps.map((s, i) => { const people = assigneesFor(state, fake, s); const who = people[0]; const sys = s.desk === 'system' || s.mode === 'system'; const names = people.map((p) => (lang === 'ar' ? p.name : p.nameEn)); const many = people.length > 1; return (
          <Item key={s.key} className={`rp-item ${s.mode === 'fulfil' ? 'fulfil' : ''}`}>
            <span className={`rp-node ${s.notifyOnly ? 'notify' : ''} ${sys ? 'sys' : ''}`}>{sys ? <span className="cell-lead plain"><I.gear /></span> : who ? <Avatar p={who} /> : <span className="cell-lead plain"><I.person /></span>}{many ? <span className="rp-more num">+{people.length - 1}</span> : null}<span className="rp-n num">{i + 1}</span></span>
            <span className="rp-txt"><b>{tx(s.title)}</b><span>{names.length ? names.join(many && s.quorum === 'all' ? (lang === 'ar' ? ' و' : ' & ') : lang === 'ar' ? ' أو ' : ' or ') : sys ? t.desks.system : stepWho(state, fake, s, lang)}{s.notifyOnly ? ` · ${t.leave.notified}` : s.slaHours ? ` · ${s.slaHours}${lang === 'ar' ? ' س' : 'h'}` : ''}{many ? ` · ${s.quorum === 'all' ? t.inbox.quorumAll : t.inbox.quorumAny}` : ''}</span>{showWhy && s.why && !sys ? <span className="rp-why">{tx(s.why)}</span> : null}</span>
          </Item>
        ); })}
      </Stagger>
      {notApplied && notApplied.length > 0 ? (
        <div className="rp-skipped">
          <span className="rp-sk-title">{t.leave.notApplied}</span>
          {notApplied.map((n, i) => <span key={i} className="rp-sk"><I.dot /><b>{tx(n.title)}</b><span>{tx(n.why)}</span></span>)}
        </div>
      ) : null}
    </>
  );
}

/** قائمة التحققات: مانع، وتحذير، ومعلومة، ومقبول */
export function Checks({ checks }: { checks: Check[] }) {
  const { lang } = useLang();
  if (!checks.length) return null;
  const icon = (l: Check['level']) => (l === 'block' ? <I.x /> : l === 'warn' ? <I.alert /> : l === 'ok' ? <I.check /> : <I.info />);
  return (
    <Stagger className="checks" step={0.04}>
      {checks.map((c) => <Item key={c.key + c.level}><div className={`check ${c.level}`}>{icon(c.level)}<span>{lang === 'ar' ? c.text.ar : c.text.en}</span></div></Item>)}
    </Stagger>
  );
}

/** شريط الشرائح: الدورة الحالية للأجر المتدرج مع موقع هذا الطلب */
export function TierBar({ sick, days }: { sick: SickView; days: number }) {
  const { lang, t } = useLang();
  const total = sick.tiers.reduce((n, x) => (x.toDay === null ? n : Math.max(n, x.toDay)), 0) || 1;
  const span = total * 1.15; // مساحة إضافية لشريحة «بقية الدورة»
  const segs = sick.tiers.map((x) => ({ pay: x.pay, from: x.fromDay - 1, to: x.toDay === null ? span : x.toDay }));
  const usedPct = Math.min(100, (sick.usedDays / span) * 100); const reqPct = Math.min(100 - usedPct, (days / span) * 100);
  return (
    <div className="tierbar">
      <div className="tb-track">
        {segs.map((s, i) => <span key={i} className={`tb-seg p${s.pay}`} style={{ insetInlineStart: `${(s.from / span) * 100}%`, width: `${((s.to - s.from) / span) * 100}%` }}><b>{s.pay}%</b></span>)}
        <motion.span className="tb-used" initial={{ width: 0 }} animate={{ width: `${usedPct}%` }} transition={{ ...SPRING.gentle, delay: 0.2 }} />
        <motion.span className="tb-req" initial={{ width: 0 }} animate={{ width: `${reqPct}%` }} style={{ insetInlineStart: `${usedPct}%` }} transition={{ ...SPRING.gentle, delay: 0.5 }} />
      </div>
      <div className="tb-legend">
        <span><i className="key-dot used" />{t.leave.used}: <b className="num">{sick.usedDays}</b></span>
        {days > 0 ? <span><i className="key-dot req" />{lang === 'ar' ? 'هذا الطلب' : 'This request'}: <b className="num">{days}</b></span> : null}
        <span>{t.leave.cycle}: <span className="num">{sick.cycleStart}</span> → <span className="num">{sick.cycleEnd}</span></span>
      </div>
      {sick.slices.length > 0 && sick.slices.some((s) => s.pay < 100) ? <div className="tb-slices">{sick.slices.map((s, i) => <Pill key={i} tone={s.pay === 100 ? 'ok' : s.pay === 0 ? 'danger' : 'warn'}>{s.days} {lang === 'ar' ? 'يوماً بأجر' : 'days at'} {s.pay}%</Pill>)}</div> : null}
    </div>
  );
}

/** بطاقة ملخص الإجازة داخل الطلب والمهمة */
export function LeaveCard({ r, type }: { r: Request; type?: LeaveType }) {
  const { lang, t, tx } = useLang();
  if (!r.leave) return null;
  const lv = r.leave;
  return (
    <div className={`leave-card ${lv.cancelOf ? 'cancel' : ''} ${lv.cancelled ? 'cancelled' : ''}`}>
      {lv.cancelOf ? <div className="lc-cancel"><I.x /><b>{t.requests.cancel.cancelOf} <span className="mono">{lv.cancelOf}</span></b>{lv.cancelReason ? <span> · {t.requests.cancel.reasonLabel}: {lv.cancelReason}</span> : null}</div> : null}
      <div className="lc-top"><span className={`qicon ${type?.tone || 'g-green'}`}>{type ? React.createElement(I[type.icon as keyof typeof I] || I.leave) : <I.leave />}</span><div><b>{type ? tx(type.name) : lv.typeId}</b><span><bdi dir="ltr" className="num">{lv.from} → {lv.to}</bdi></span></div><span className="lc-days"><b className="num">{lv.days}</b><small>{lv.halfDay ? t.leave.halfDay : lang === 'ar' ? 'يوماً' : 'days'}</small></span></div>
      <div className="lc-meta">
        {lv.cancelled ? <Pill tone="danger" icon="x">{t.requests.cancel.cancelled}</Pill> : null}
        <Pill icon="calendar">{workingDaysText(lv.workingDays, lang)}</Pill>
        {r.policyVersion ? <Pill tone="tint">{t.leave.policyVersion} {r.policyVersion}</Pill> : null}
        {lv.payBreakdown && lv.payBreakdown.some((p) => p.pay < 100) ? lv.payBreakdown.map((p, i) => <Pill key={i} tone={p.pay === 100 ? 'ok' : p.pay === 0 ? 'danger' : 'warn'}>{p.days} × {p.pay}%</Pill>) : null}
        {(lv.entitlements || []).map((e) => { const st = lv.cancelOf ? r.steps.filter((x) => x.entitlementId === e).pop() : r.steps.find((x) => x.entitlementId === e); const base = e === 'tickets' ? (lang === 'ar' ? 'تذاكر الإجازة' : 'Leave tickets') : lang === 'ar' ? 'راتب مقدّم' : 'Advance salary'; const name = lv.cancelOf ? `${lang === 'ar' ? 'استرداد' : 'Recover'} ${base}` : base; const done = st?.status === 'done'; const status = !st ? '' : done ? (st.notifyOnly ? t.leave.entNotified : `${t.leave.entDone}${st.ref ? ` ${st.ref}` : ''}`) : st.status === 'current' ? t.leave.entPending : ''; return <Pill key={e} tone={done ? 'ok' : 'gold'} icon={done ? 'check' : 'seal'}>{name}{status ? ` · ${status}` : ''}</Pill>; })}
      </div>
    </div>
  );
}

export function EvalBadge({ ev }: { ev: EvalResult }) {
  const { t } = useLang();
  return ev.ok ? <Pill tone="ok" icon="check">{t.policy.ok}</Pill> : <Pill tone="danger" icon="x">{t.policy.blocked}</Pill>;
}
