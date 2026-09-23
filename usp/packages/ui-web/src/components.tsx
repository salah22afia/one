/* The prototype's base components (ui/components.tsx), fed by the i18n catalogs and live data instead of the demo store. */
import type React from 'react';
import { useEffect, useState } from 'react';
import { useI18n } from '@usp/i18n';
import { I, type IconName } from './icons';
import { motion, ITEM, SPRING, useReducedMotion } from './motion';

/* ——— Pills ——— */
export function Pill({ tone = '', children, icon }: { tone?: string; children: React.ReactNode; icon?: IconName }) {
  const Ic = icon ? I[icon] : null;
  return <span className={`pill ${tone}`}>{Ic ? <Ic /> : null}{children}</span>;
}

/* ——— Groups and cells ——— */
export function SectionLabel({ children, action, big }: { children: React.ReactNode; action?: React.ReactNode; big?: boolean }) {
  if (big) return <div className="section-head"><h2>{children}</h2>{action}</div>;
  return <div className="section-label"><span>{children}</span>{action}</div>;
}
export function Group({ children, foot, className = '' }: { children: React.ReactNode; foot?: React.ReactNode; className?: string }) {
  return <><div className={`group ${className}`}>{children}</div>{foot ? <div className="group-foot">{foot}</div> : null}</>;
}
/** A cell: enters in sequence inside Stagger, responds to press, and slides on removal (layout). */
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

/* ——— Segmented control: the thumb slides between options ——— */
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

/* ——— Search field ——— */
export function SearchField({ value, onChange, placeholder, id = 'q', onFocus, onBlur, autoFocus }: { value: string; onChange: (v: string) => void; placeholder: string; id?: string; onFocus?: () => void; onBlur?: () => void; autoFocus?: boolean }) {
  const { t } = useI18n();
  return (
    <label className="search" htmlFor={id}>
      <I.search />
      <input id={id} type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete="off" enterKeyHint="search" onFocus={onFocus} onBlur={onBlur} autoFocus={autoFocus} />
      {value ? <button type="button" className="clear" onClick={() => onChange('')}>{t('common.close')}</button> : null}
    </label>
  );
}

/* ——— Avatar ——— */
const PARTICLES = new Set(['بن', 'بنت', 'bin', 'bint']);
const words = (name: string) => name.split(/\s+/).filter((w) => w && !PARTICLES.has(w.toLowerCase()));
/** First and last name ("أحمد بن سعود العتيبي" → "أحمد العتيبي"), without bin/bint. */
export function shortName(name: string) {
  const w = words(name);
  return w.length > 2 ? `${w[0]} ${w[w.length - 1]}` : w.join(' ');
}
/** As the prototype: one Arabic letter; in Latin script first + last initials, ignoring "Al-" ("Mona Al-Qahtani" → "MQ"). */
export function initials(name: string) {
  const [first = '', ...rest] = words(name);
  if (!first) return '?';
  if (/[\u0600-\u06FF]/.test(first)) return first.charAt(0);
  const last = (rest.at(-1) ?? '').replace(/^al-/i, '');
  return (first.charAt(0) + last.charAt(0)).toUpperCase();
}
export function Avatar({ name, size = '', tone = '' }: { name?: string; size?: '' | 'sm' | 'lg'; tone?: string }) {
  return <span className={`avatar ${size} ${tone}`}>{name ? initials(name) : '?'}</span>;
}

/* ——— Empty state ——— */
export function Empty({ icon = 'inbox', title, sub }: { icon?: IconName; title: string; sub?: string }) {
  const Ic = I[icon];
  return <motion.div className="empty" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={SPRING.soft}><motion.span className="ic" initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ ...SPRING.bouncy, delay: 0.08 }}><Ic /></motion.span><b>{title}</b>{sub ? <p>{sub}</p> : null}</motion.div>;
}

/* ——— Page head (official screens) ——— */
export function TopBar({ title, start, end, back, onBack }: { title: string; start?: React.ReactNode; end?: React.ReactNode; back?: boolean; onBack?: () => void }) {
  const [sc, setSc] = useState(false); const { t } = useI18n();
  useEffect(() => { const on = () => setSc(window.scrollY > 40); on(); window.addEventListener('scroll', on, { passive: true }); return () => window.removeEventListener('scroll', on); }, []);
  return (
    <div className={`topbar ${sc ? 'scrolled' : ''} ${back ? 'has-back' : ''}`}>
      {back ? <motion.button type="button" className="back-btn" whileTap={{ scale: 0.94 }} onClick={onBack ?? (() => history.back())}><I.chev className="backchev" />{t('nav.back')}</motion.button> : start}
      <div className="tb-title">{title}</div>
      {end || <span style={{ width: 40 }} />}
    </div>
  );
}
export function LargeTitle({ title, sub, avatar }: { title: string; sub?: string; avatar?: React.ReactNode }) {
  return <div className={`large-title ${avatar ? 'with-avatar' : ''}`}>{avatar}<div><h1>{title}</h1>{sub ? <p className="sub">{sub}</p> : null}</div></div>;
}

/* ——— Seal: the issued document is stamped with a spring and a gold glow ——— */
export function Seal({ title, number, onOpen, delay = 0.15 }: { title: string; number?: string; onOpen: () => void; delay?: number }) {
  const { t } = useI18n(); const reduce = useReducedMotion();
  return (
    <motion.div className="seal" initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING.soft, delay }}>
      <span className="seal-ic">
        <motion.span className="seal-bloom" initial={reduce ? false : { scale: 0.3, opacity: 0.9 }} animate={{ scale: 2.6, opacity: 0 }} transition={{ duration: 0.9, delay: delay + 0.28, ease: 'easeOut' }} />
        <motion.span className="seal-stamp" initial={reduce ? false : { scale: 1.9, rotate: -18, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 380, damping: 17, delay: delay + 0.2 }}><I.seal /></motion.span>
      </span>
      <div><b>{title}</b>{number ? <span className="mono">{number}</span> : null}</div>
      <motion.button type="button" className="btn soft seal-act" onClick={onOpen} whileTap={{ scale: 0.96 }}><I.open />{t('requests.openDoc')}</motion.button>
    </motion.div>
  );
}

/* ——— Forms ——— */
export function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return <motion.div className={`field ${error ? 'invalid' : ''}`} variants={ITEM}><label htmlFor={id}>{label}</label>{children}{error ? <motion.span className="err" id={`${id}-err`} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}>{error}</motion.span> : hint ? <span className="hint">{hint}</span> : null}</motion.div>;
}
export function Notice({ tone = '', children, icon = 'info' }: { tone?: string; children: React.ReactNode; icon?: IconName }) {
  const Ic = I[icon]; return <motion.div className={`notice ${tone}`} variants={ITEM}><Ic /><span>{children}</span></motion.div>;
}

/* ——— Utilities ——— */
export function useNow(tick = 60000) { const [n, setN] = useState(Date.now()); useEffect(() => { const h = window.setInterval(() => setN(Date.now()), tick); return () => window.clearInterval(h); }, [tick]); return n; }
