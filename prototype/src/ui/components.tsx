import React, { useEffect, useMemo, useState } from 'react';
import { I, type IconName } from './icons';
import { STRINGS, type Lang, relTime, durText } from '../app/i18n';
import { useStore } from '../app/store';
import type { Request, Step, T2, Person, ReqStatus, Field as ReqField } from '../domain/types';
/** v0.15: قيمة حقل الطلب باللغة الحالية (القيمة الإنجليزية إن سُجِّلت) */
export function fv(f: ReqField, lang: Lang): string { return (lang === 'en' && f.valueEn) || f.value; }
import { personById, currentPerson, stepWho } from '../domain/engine';
import { displayValue } from '../domain/designer';
import { motion, ITEM, SPRING, useIsland, Sheet as MotionSheet, useReducedMotion } from './motion';

/* ——— اللغة ——— */
export function useLang() {
  const { state } = useStore();
  const lang = state.settings.lang as Lang;
  return { lang, t: STRINGS[lang], tx: (v: T2 | string | undefined) => (typeof v === 'string' ? v : v ? (lang === 'ar' ? v.ar : v.en || v.ar) : '') };
}

/* ——— الحبوب ——— */
export function Pill({ tone = '', children, icon }: { tone?: string; children: React.ReactNode; icon?: IconName }) {
  const Ic = icon ? I[icon] : null;
  return <span className={`pill ${tone}`}>{Ic ? <Ic /> : null}{children}</span>;
}
export function statusTone(s: ReqStatus): string { return s === 'in_review' ? 'tint' : s === 'returned' ? 'warn' : s === 'rejected' ? 'danger' : s === 'completed' ? 'done' : ''; }
export function StatusPill({ r }: { r: Request }) {
  const { t } = useLang(); const s = r.status;
  const icon: IconName | undefined = s === 'completed' ? 'check' : s === 'returned' ? 'ret' : s === 'rejected' ? 'x' : undefined;
  return <Pill tone={statusTone(s)} icon={icon}>{t.status[s]}</Pill>;
}

/* ——— المجموعات والخلايا ——— */
export function SectionLabel({ children, action, big }: { children: React.ReactNode; action?: React.ReactNode; big?: boolean }) {
  if (big) return <div className="section-head"><h2>{children}</h2>{action}</div>;
  return <div className="section-label"><span>{children}</span>{action}</div>;
}
export function Group({ children, foot, className = '' }: { children: React.ReactNode; foot?: React.ReactNode; className?: string }) {
  return <><div className={`group ${className}`}>{children}</div>{foot ? <div className="group-foot">{foot}</div> : null}</>;
}
/** الخلية: عنصر حركي؛ داخل Stagger تدخل متتابعة، وتستجيب للضغط، وتُقاس لتنزلق عند الحذف (layout) */
export function Cell({ icon, tone = '', title, sub, value, pill, onClick, href, chevron = true, lead, stacked, subClamp, className = '', layout }: {
  icon?: IconName; tone?: string; title: React.ReactNode; sub?: React.ReactNode; value?: React.ReactNode; pill?: React.ReactNode; onClick?: () => void; href?: string; chevron?: boolean; lead?: React.ReactNode; stacked?: boolean; subClamp?: boolean; className?: string; layout?: boolean;
}) {
  const Ic = icon ? I[icon] : null;
  const inner = (
    <>
      {lead ? lead : Ic ? <span className={`cell-lead ${tone}`}><Ic /></span> : null}
      <span className="cell-main"><span className="cell-title">{title}</span>{sub ? <span className={`cell-sub ${subClamp ? 'clamp' : ''}`}>{sub}</span> : null}</span>
      {(value || pill || ((onClick || href) && chevron)) ? <span className="cell-trail">{value ? <span className="cell-value">{value}</span> : null}{pill}{(onClick || href) && chevron ? <I.chev className="chev dirchev" /> : null}</span> : null}
    </>
  );
  const cls = `cell ${stacked ? 'stacked' : ''} ${className}`;
  const press = { whileTap: { scale: 0.985 }, transition: SPRING.snappy };
  if (href) return <motion.a className={cls} href={href} variants={ITEM} layout={layout} {...press}>{inner}</motion.a>;
  if (onClick) return <motion.button type="button" className={cls} onClick={onClick} variants={ITEM} layout={layout} {...press}>{inner}</motion.button>;
  return <motion.div className={cls} variants={ITEM} layout={layout}>{inner}</motion.div>;
}

/* ——— التحكم المقسّم: المؤشر ينزلق بين الخيارات ——— */
export function Segmented<T extends string>({ value, onChange, options, id = 'seg' }: { value: T; onChange: (v: T) => void; options: { v: T; label: string; n?: number }[]; id?: string }) {
  return (
    <div className="segmented" role="group">
      {options.map((o) => (
        <button key={o.v} type="button" aria-pressed={value === o.v} onClick={() => onChange(o.v)}>
          {value === o.v ? <motion.span className="seg-thumb" layoutId={`${id}-thumb`} transition={SPRING.snappy} /> : null}
          <span className="seg-txt">{o.label}{o.n !== undefined ? <span className="n num">{o.n}</span> : null}</span>
        </button>
      ))}
    </div>
  );
}

/* ——— البحث ——— */
export function SearchField({ value, onChange, placeholder, id = 'q', onFocus, onBlur, autoFocus }: { value: string; onChange: (v: string) => void; placeholder: string; id?: string; onFocus?: () => void; onBlur?: () => void; autoFocus?: boolean }) {
  const { t } = useLang();
  return (
    <label className="search" htmlFor={id}>
      <I.search />
      <input id={id} type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete="off" enterKeyHint="search" onFocus={onFocus} onBlur={onBlur} autoFocus={autoFocus} />
      {value ? <button type="button" className="clear" onClick={() => onChange('')}>{t.common.close}</button> : null}
    </label>
  );
}

/* ——— الصورة الرمزية ——— */
export function Avatar({ p, size = '', tone = '' }: { p?: Person; size?: '' | 'sm' | 'lg'; tone?: string }) {
  const { lang } = useLang();
  return <span className={`avatar ${size} ${tone}`}>{p ? (lang === 'ar' ? p.initials.ar : p.initials.en) : '?'}</span>;
}

/* ——— الحالة الفارغة ——— */
export function Empty({ icon = 'inbox', title, sub }: { icon?: IconName; title: string; sub?: string }) {
  const Ic = I[icon];
  return <motion.div className="empty" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={SPRING.soft}><motion.span className="ic" initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ ...SPRING.bouncy, delay: 0.08 }}><Ic /></motion.span><b>{title}</b>{sub ? <p>{sub}</p> : null}</motion.div>;
}

/* ——— التنبيه المؤقت: الجزيرة ——— */
export function useToast() { return useIsland(); }
export const Sheet = MotionSheet;

/* ——— رأس الصفحة ——— */
export function TopBar({ title, start, end, back }: { title: string; start?: React.ReactNode; end?: React.ReactNode; back?: string | (() => void) }) {
  const [sc, setSc] = useState(false); const { t } = useLang();
  useEffect(() => { const on = () => setSc(window.scrollY > 40); on(); window.addEventListener('scroll', on, { passive: true }); return () => window.removeEventListener('scroll', on); }, []);
  return (
    <div className={`topbar ${sc ? 'scrolled' : ''} ${back !== undefined ? 'has-back' : ''}`}>
      {back !== undefined ? <motion.button type="button" className="back-btn" whileTap={{ scale: 0.94 }} onClick={() => (typeof back === 'function' ? back() : (location.hash = back))}><I.chev className="backchev" />{t.nav.back}</motion.button> : start}
      <div className="tb-title">{title}</div>
      {end || <span style={{ width: 40 }} />}
    </div>
  );
}
export function LargeTitle({ title, sub, avatar }: { title: string; sub?: string; avatar?: React.ReactNode }) {
  return <div className={`large-title ${avatar ? 'with-avatar' : ''}`}>{avatar}<div><h1>{title}</h1>{sub ? <p className="sub">{sub}</p> : null}</div></div>;
}

/* ——— المسار: سير المعاملة يُرسم خطوةً خطوة، والخطوة الحالية تنبض ——— */
export function Rail({ r, now = Date.now(), animated = true }: { r: Request; now?: number; animated?: boolean }) {
  const { lang, t, tx } = useLang(); const { state } = useStore(); const reduce = useReducedMotion();
  const anim = animated && !reduce;
  return (
    <ol className="rail">
      {r.steps.map((s: Step, i) => {
        const cls = s.status === 'done' ? 'done' : s.status === 'current' ? 'current' : s.status === 'returned' ? 'returned' : s.status === 'rejected' ? 'rejected' : '';
        const who = stepWho(state, r, s, lang);
        const quorum = s.status === 'current' && (s.assigneeIds || []).length > 1 ? ` · ${s.quorum === 'all' ? `${t.inbox.quorumAll} (${(s.decisions || []).length}/${(s.assigneeIds || []).length})` : t.inbox.quorumAny}` : '';
        let sub = '';
        if (s.status === 'done') sub = `${who} · ${s.at ? relTime(s.at, lang, now) : ''}${s.ref ? ` · ${s.ref}` : ''}`;
        else if (s.status === 'current') sub = `${who}${quorum} · ${t.requests.elapsed} ${durText(now - (s.startedAt || r.createdAt), lang)}`;
        else if (s.status === 'returned' || s.status === 'rejected') sub = `${who} · ${s.at ? relTime(s.at, lang, now) : ''}`;
        else if (s.status === 'skipped') sub = t.status.skipped;
        else sub = who;
        const Ic = s.status === 'done' ? I.check : s.status === 'returned' ? I.ret : s.status === 'rejected' ? I.x : s.status === 'current' ? I.clock : I.dot;
        const d = i * 0.07;
        return (
          <motion.li key={s.key} className={cls} initial={anim ? { opacity: 0, x: lang === 'ar' ? 10 : -10 } : false} animate={{ opacity: 1, x: 0 }} transition={{ ...SPRING.soft, delay: d }}>
            {i < r.steps.length - 1 ? <motion.span className="rail-line" initial={anim ? { scaleY: 0 } : false} animate={{ scaleY: 1 }} transition={{ duration: 0.32, delay: d + 0.12, ease: [0.4, 0, 0.2, 1] }} /> : null}
            <motion.span className="node" initial={anim ? { scale: 0.4 } : false} animate={{ scale: 1 }} transition={{ ...SPRING.bouncy, delay: d + 0.05 }}><Ic /></motion.span>
            <div><div className="t">{tx(s.title)}{s.group ? <span className="rail-tag"><I.branch /></span> : null}</div><div className="s">{sub}{s.status === 'current' && s.mode === 'wait' && s.waitUntil ? ` · ${s.waitUntil}` : ''}</div>{s.why && s.status !== 'done' && s.status !== 'skipped' ? <div className="why">{tx(s.why)}</div> : null}
              {/* v0.16 (9.3): نتيجة الخطوة وما أُدخل فيها وما عُدِّل وما طُلب تصحيحه */}
              <StepDetails s={s} />
              {s.note ? <div className="note">{s.note}</div> : null}</div>
          </motion.li>
        );
      })}
    </ol>
  );
}

/** v0.16: تفاصيل خطوة خدمة مهيّأة على المسار — خيار القرار، وقيم نموذج الخطوة، وتعديلات صاحب الخطوة، والحقول المطلوب تصحيحها */
function StepDetails({ s }: { s: Step }) {
  const { lang, tx } = useLang(); const { state } = useStore();
  if (!s.form && !s.outcome && !s.values && !s.edits) return null;
  const outcome = s.outcome && s.outcome !== '__auto' ? (s.form?.outcomes || []).find((o) => o.id === s.outcome) : undefined;
  const fields = (s.form?.fields || []).filter((f) => s.values && s.values[f.id] !== undefined && s.values[f.id] !== '' && f.kind !== 'guidance');
  const edits = s.edits || [];
  if (!outcome && !fields.length && !edits.length && !(s.returnFields || []).length) return null;
  return (
    <div className="rail-details">
      {outcome ? <span className={`pill t-${outcome.tone || 'ok'}`}>{tx(outcome.name)}</span> : null}
      {fields.map((f) => <span key={f.id} className="rail-kv"><i>{tx(f.label)}</i><b>{displayValue(state, f, s.values?.[f.id], lang)}</b></span>)}
      {edits.map((e, i) => <span key={i} className="rail-kv edit"><i>{tx(e.label)}</i><b><s>{e.before || '—'}</s> ← {e.after || '—'}</b></span>)}
      {(s.returnFields || []).length ? <span className="rail-kv"><i>{lang === 'ar' ? 'المطلوب تصحيحه' : 'To fix'}</i><b>{(s.returnFields || []).join(lang === 'ar' ? '، ' : ', ')}</b></span> : null}
    </div>
  );
}

/* ——— الختم: المستند الصادر يُختم بنابض ووهج ذهبي ——— */
export function Seal({ title, number, onOpen, delay = 0.15 }: { title: string; number?: string; onOpen: () => void; delay?: number }) {
  const { t } = useLang(); const reduce = useReducedMotion();
  return (
    <motion.div className="seal" initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING.soft, delay }}>
      <span className="seal-ic">
        <motion.span className="seal-bloom" initial={reduce ? false : { scale: 0.3, opacity: 0.9 }} animate={{ scale: 2.6, opacity: 0 }} transition={{ duration: 0.9, delay: delay + 0.28, ease: 'easeOut' }} />
        <motion.span className="seal-stamp" initial={reduce ? false : { scale: 1.9, rotate: -18, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 380, damping: 17, delay: delay + 0.2 }}><I.seal /></motion.span>
      </span>
      <div><b>{title}</b>{number ? <span className="mono">{number}</span> : null}</div>
      <motion.button type="button" className="btn soft seal-act" onClick={onOpen} whileTap={{ scale: 0.96 }}><I.open />{t.requests.openDoc}</motion.button>
    </motion.div>
  );
}

/* ——— النماذج ——— */
export function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return <motion.div className={`field ${error ? 'invalid' : ''}`} variants={ITEM}><label htmlFor={id}>{label}</label>{children}{error ? <motion.span className="err" id={`${id}-err`} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}>{error}</motion.span> : hint ? <span className="hint">{hint}</span> : null}</motion.div>;
}
export function Notice({ tone = '', children, icon = 'info' }: { tone?: string; children: React.ReactNode; icon?: IconName }) {
  const Ic = I[icon]; return <motion.div className={`notice ${tone}`} variants={ITEM}><Ic /><span>{children}</span></motion.div>;
}

/* ——— أدوات ——— */
export function useNow(tick = 60000) { const [n, setN] = useState(Date.now()); useEffect(() => { const h = window.setInterval(() => setN(Date.now()), tick); return () => window.clearInterval(h); }, [tick]); return n; }
export function useMedia(q: string) { const [m, setM] = useState(() => window.matchMedia(q).matches); useEffect(() => { const mq = window.matchMedia(q); const on = () => setM(mq.matches); mq.addEventListener('change', on); return () => mq.removeEventListener('change', on); }, [q]); return m; }
export function usePerson() { const { state } = useStore(); return useMemo(() => currentPerson(state), [state]); }
