import React, { useMemo, useState } from 'react';
import { useStore } from '../app/store';
import { I } from '../ui/icons';
import { Cell, Empty, Group, LargeTitle, Notice, Pill, Segmented, TopBar, useLang, useNow, usePerson } from '../ui/components';
import { motion, ITEM, SPRING, Stagger, Item, Ticker } from '../ui/motion';
import { leaveHistory, leaveSummary, type LeaveEntry, type LeaveEntryStatus } from '../domain/engine';
import { activeVersion, fromISO, toISO, type LeaveType } from '../domain/policy';
import { daysText, workingDaysText } from '../app/i18n';

/* ——— v0.8.2 سجل إجازاتي (سؤال عمر بعين الموظف): صفحة واحدة تجمع ما أُخذ وما هو قادم وما ينتظر الاعتماد وما أُلغي، مصفّاةً بالسنة والنوع، وكل سطر يفتح طلبه ——— */

const TONE: Record<LeaveEntryStatus, string> = { taken: 'done', ongoing: 'ok', upcoming: 'tint', in_review: 'gold', returned: 'warn', rejected: 'danger', withdrawn: '', cancelling: 'warn', cancelled: 'danger' };
const ICON: Partial<Record<LeaveEntryStatus, keyof typeof I>> = { taken: 'check', ongoing: 'clock', upcoming: 'calendar', in_review: 'clock', returned: 'ret', rejected: 'x', cancelled: 'x', cancelling: 'ret' };

export function useLeaveTypes(): (id: string) => LeaveType | undefined {
  const { state } = useStore(); const now = useNow();
  const content = activeVersion(state.policy, toISO(now)).content;
  return (id: string) => content.types.find((x) => x.id === id) || state.policy.versions.flatMap((v) => v.content.types).find((x) => x.id === id);
}

/** سطر إجازة واحد: أيقونة النوع، والاسم مع حالته في السطر نفسه (تنزل الحالة تحته حين يضيق العرض)، ثم التواريخ والأيام ورقم القرار أو الطلب؛ يفتح الطلب إن كان له طلب.
 *  الحالة داخل المحتوى لا في ذيل الخلية، حتى لا تزاحم التواريخ على الهاتف (ملاحظة عمر 18 سبتمبر: «الرقاقة فوق التاريخ») */
export function LeaveRow({ e, typeOf, compact }: { e: LeaveEntry; typeOf: (id: string) => LeaveType | undefined; compact?: boolean }) {
  const { lang, t, tx } = useLang();
  const tp = typeOf(e.typeId); const Ic = tp ? (I[tp.icon as keyof typeof I] || I.leave) : I.leave;
  const dates = <bdi className="num lh-dates" dir="ltr">{e.from === e.to ? e.from : `${e.from} → ${e.to}`}</bdi>;
  /* v0.17: عدّ عربي سليم («يوم واحد»، «يومان»، «5 أيام»، «12 يوماً»؛ ومثله أيام العمل) */
  const days = e.halfDay ? t.leaveHist.halfDay : `${daysText(e.days, lang)}${e.workingDays !== undefined && !compact ? ` (${workingDaysText(e.workingDays, lang)})` : ''}`;
  const ref = e.decisionNo ? <span>{t.leaveHist.decision} <span className="num">{e.decisionNo}</span></span> : e.requestId ? <span className="mono">{e.requestId}</span> : <span>{t.leaveHist.posted}</span>;
  const inner = (
    <>
      <span className={`qicon ${tp?.tone || 'g-sage'}`}><Ic /></span>
      <span className="cell-main">
        <span className="lh-head"><span className="cell-title">{tp ? tx(tp.name) : e.typeId}</span><Pill tone={TONE[e.status]} icon={ICON[e.status]}>{t.leaveHist.status[e.status]}</Pill></span>
        <span className="cell-sub lh-sub">{dates}<span>{days}</span>{compact ? null : ref}</span>
      </span>
      {e.requestId ? <span className="cell-trail"><I.chev className="chev dirchev" /></span> : null}
    </>
  );
  const cls = `cell lh-row ${e.status}`;
  return e.requestId ? <motion.a className={cls} href={`#/requests/${e.requestId}`} variants={ITEM} whileTap={{ scale: 0.985 }} transition={SPRING.snappy}>{inner}</motion.a> : <motion.div className={cls} variants={ITEM}>{inner}</motion.div>;
}

export function LeaveHistory() {
  const { state } = useStore(); const { lang, t, tx } = useLang(); const me = usePerson(); const now = useNow(); const today = toISO(now);
  const typeOf = useLeaveTypes();
  const entries = useMemo(() => leaveHistory(state, me.id, today), [state, me.id, today]);
  const years = useMemo(() => Array.from(new Set(entries.map((e) => Number(e.from.slice(0, 4))))).sort((a, b) => b - a), [entries]);
  const thisYear = new Date(now).getFullYear();
  const [year, setYear] = useState<string>(years.includes(thisYear) ? String(thisYear) : years[0] ? String(years[0]) : 'all');
  const [typeId, setTypeId] = useState<string>('all');
  const yearNum = year === 'all' ? null : Number(year);
  const inYear = entries.filter((e) => yearNum === null || e.from.startsWith(String(yearNum)));
  const typesUsed = Array.from(new Set(inYear.map((e) => e.typeId)));
  const list = inYear.filter((e) => typeId === 'all' || e.typeId === typeId);
  const sum = leaveSummary(entries, yearNum);
  /* تجميع بالشهر (الأحدث أولاً) */
  const months: { key: string; label: string; items: LeaveEntry[] }[] = [];
  for (const e of list) { const key = e.from.slice(0, 7); let m = months.find((x) => x.key === key); if (!m) { m = { key, label: new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA-u-nu-latn-ca-gregory' : 'en-GB', { month: 'long', year: 'numeric' }).format(fromISO(e.from)), items: [] }; months.push(m); } m.items.push(e); }
  const yearOptions = [...years.map((y) => ({ v: String(y), label: String(y) })), { v: 'all', label: t.leaveHist.allYears }];
  return (
    <div className="page view list-page leave-history">
      <TopBar title={t.leaveHist.title} back="#/me" />
      <LargeTitle title={t.leaveHist.title} sub={t.leaveHist.sub} />
      <Stagger className="tiles lh-tiles" delay={0.1}>
        <Item><div className="tile"><b className="num"><Ticker value={sum.taken} delay={0.2} /></b><span>{t.leaveHist.taken} · {yearNum === null ? t.leaveHist.allYears : <span className="num">{yearNum}</span>}</span></div></Item>
        <Item><div className="tile soft"><b className="num"><Ticker value={sum.upcoming} delay={0.3} /></b><span>{t.leaveHist.upcoming}</span></div></Item>
        <Item><div className="tile soft"><b className="num"><Ticker value={sum.pending} delay={0.4} /></b><span>{t.leaveHist.pending}</span></div></Item>
      </Stagger>
      <div style={{ height: 12 }} />
      {years.length > 1 ? <><Segmented id="lh-year" value={year} onChange={setYear} options={yearOptions} /><div style={{ height: 10 }} /></> : null}
      {typesUsed.length > 1 ? <div className="chips lh-types"><button type="button" className={`pill ${typeId === 'all' ? 'tint' : ''}`} aria-pressed={typeId === 'all'} onClick={() => setTypeId('all')}>{t.leaveHist.all}</button>{typesUsed.map((id) => { const tp = typeOf(id); const on = typeId === id; return <button key={id} type="button" className={`pill ${on ? 'tint' : ''}`} aria-pressed={on} onClick={() => setTypeId(on ? 'all' : id)}>{on ? <I.check /> : null}{tp ? tx(tp.name) : id}</button>; })}</div> : null}
      <div style={{ height: 6 }} />
      {list.length === 0 ? <Group><Empty icon="calendar" title={entries.length ? t.leaveHist.emptyFilter : t.leaveHist.empty} sub={entries.length ? undefined : t.leaveHist.emptySub} /></Group> : (
        <Stagger>
          {months.map((m) => (
            <React.Fragment key={m.key}>
              <div className="section-label"><span>{m.label}</span>{(() => { const n = m.items.reduce((k, e) => k + (e.status === 'taken' || e.status === 'ongoing' || e.status === 'upcoming' || e.status === 'cancelling' ? e.days : 0), 0); return n > 0 ? <span className="num">{n} {t.leaveHist.days}</span> : null; })()}</div>
              <Group>{m.items.map((e) => <Item key={e.key}><LeaveRow e={e} typeOf={typeOf} /></Item>)}</Group>
            </React.Fragment>
          ))}
        </Stagger>
      )}
      <div style={{ height: 12 }} />
      <Notice tone="tint" icon="info">{t.leaveHist.source}</Notice>
    </div>
  );
}

/** المعاينة المختصرة في «ملفي»: آخر ثلاث إجازات ورابط السجل كاملاً */
export function LeaveHistoryPreview() {
  const { state } = useStore(); const { t } = useLang(); const me = usePerson(); const now = useNow(); const today = toISO(now);
  const typeOf = useLeaveTypes();
  const entries = useMemo(() => leaveHistory(state, me.id, today), [state, me.id, today]);
  const latest = entries.slice(0, 3);
  if (!entries.length) return null;
  return (
    <Group>
      {latest.map((e) => <LeaveRow key={e.key} e={e} typeOf={typeOf} compact />)}
      <Cell icon="calendar" tone="plain" title={t.leaveHist.viewAll} sub={`${entries.length} ${t.leaveHist.countLabel}`} href="#/me/leaves" />
    </Group>
  );
}
