import React, { useState } from 'react';
import { motion, AnimatePresence, SPRING } from './motion';
import { I } from './icons';
import { addDays, fromISO, toISO, isWeekend, holidayOn, type Calendar as Cal, type Loc } from '../domain/policy';
import { fmtDate } from '../app/i18n';

/** تقويم اختيار المدة: يميّز أيام العمل من نهاية الأسبوع والعطل حسب مقر عمل الموظف، ويختار البداية ثم النهاية بلمستين */
export function RangeCalendar({ from, to, onChange, loc, cal, lang, min, fixedDays, single, closedUntil }: { from: string; to: string; onChange: (from: string, to: string) => void; loc: Loc; cal: Cal; lang: 'ar' | 'en'; min?: string; fixedDays?: number; single?: boolean; closedUntil?: string }) {
  const start = from ? fromISO(from) : new Date();
  const [view, setView] = useState({ y: start.getFullYear(), m: start.getMonth() });
  const [dir, setDir] = useState(1);
  const weekStart = loc === 'abudhabi' ? 1 : 0; // الأحد للرياض، الاثنين لأبوظبي
  const first = new Date(view.y, view.m, 1); const offset = (first.getDay() - weekStart + 7) % 7;
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (string | null)[] = []; for (let i = 0; i < offset; i++) cells.push(null); for (let d = 1; d <= daysInMonth; d++) cells.push(toISO(new Date(view.y, view.m, d)));
  while (cells.length % 7) cells.push(null);
  const names = lang === 'ar' ? ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const heads = Array.from({ length: 7 }, (_, i) => names[(i + weekStart) % 7]);
  const pick = (d: string) => {
    if (fixedDays) { onChange(d, addDays(d, fixedDays - 1)); return; }
    if (single) { onChange(d, d); return; }
    if (!from || (from && to && to !== from) || d < from) onChange(d, d); else onChange(from, d);
  };
  const move = (k: number) => { setDir(k); setView((v) => { const m = v.m + k; return { y: v.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 }; }); };
  const title = fmtDate(new Date(view.y, view.m, 1).getTime(), lang, { month: 'long', year: 'numeric' });
  return (
    <div className="cal">
      <div className="cal-head">
        <motion.button type="button" className="icon-btn" onClick={() => move(-1)} whileTap={{ scale: 0.9 }} aria-label="prev"><I.chev className="backchev" /></motion.button>
        <AnimatePresence mode="wait" initial={false}><motion.b key={`${view.y}-${view.m}`} initial={{ opacity: 0, x: dir * (lang === 'ar' ? -12 : 12) }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: dir * (lang === 'ar' ? 12 : -12) }} transition={SPRING.snappy}>{title}</motion.b></AnimatePresence>
        <motion.button type="button" className="icon-btn" onClick={() => move(1)} whileTap={{ scale: 0.9 }} aria-label="next"><I.chev className="dirchev" /></motion.button>
      </div>
      <div className="cal-grid cal-names">{heads.map((h) => <span key={h}>{h}</span>)}</div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={`${view.y}-${view.m}`} className="cal-grid" initial={{ opacity: 0, x: dir * (lang === 'ar' ? -24 : 24) }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: dir * (lang === 'ar' ? 24 : -24), transition: { duration: 0.12 } }} transition={SPRING.soft}>
          {cells.map((d, i) => {
            if (!d) return <span key={`e${i}`} className="cal-empty" />;
            const we = isWeekend(d, loc, cal); const hol = holidayOn(d, loc, cal); const sel = from && to && d >= from && d <= to; const edge = d === from || d === to; const closed = !!closedUntil && d <= closedUntil; const disabled = (!!min && d < min) || closed;
            return (
              <motion.button key={d} type="button" className={`cal-day ${we ? 'we' : ''} ${hol ? 'hol' : ''} ${sel ? 'sel' : ''} ${edge ? 'edge' : ''} ${d === from ? 'first' : ''} ${d === to ? 'last' : ''} ${closed ? 'closed' : ''}`} disabled={disabled} onClick={() => pick(d)} whileTap={{ scale: 0.9 }} title={closed ? (lang === 'ar' ? 'فترة مقفلة' : 'Closed period') : hol ? (lang === 'ar' ? hol.name.ar : hol.name.en) : undefined}>
                <span className="num">{Number(d.slice(-2))}</span>{hol ? <i className="cal-dot" /> : null}
              </motion.button>
            );
          })}
        </motion.div>
      </AnimatePresence>
      <div className="cal-legend"><span><i className="key-dot we" />{lang === 'ar' ? 'نهاية الأسبوع' : 'Weekend'}</span><span><i className="key-dot hol" />{lang === 'ar' ? 'عطلة رسمية' : 'Public holiday'}</span><span><i className="key-dot sel" />{lang === 'ar' ? 'أيام الإجازة' : 'Leave days'}</span>{closedUntil ? <span><i className="key-dot closed" />{lang === 'ar' ? `فترة مقفلة حتى ${closedUntil}` : `Closed up to ${closedUntil}`}</span> : null}</div>
    </div>
  );
}
