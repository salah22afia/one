/* ═══ الحركة v0.3: نوابض لا منحنيات زمنية، وكل شيء يتحرك من مكانه ═══
   المبدأ (C-UX-15): الحركة فيزيائية (نابض بكتلة وتخميد)، تشرح ما حدث (من أين جاء الشيء وإلى أين ذهب)، وتُكافئ الإنجاز بلحظة واحدة لا أكثر،
   وتُطفأ كلها احتراماً لتفضيل تقليل الحركة. */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useMotionValue, useSpring, useReducedMotion, animate, useMotionValueEvent, useDragControls, type Variants, type Transition, type PanInfo } from 'motion/react';
import { I, type IconName } from './icons';
import type { NavDir } from '../app/router';

/* نسب التخميد (قاعدة Apple): الافتراضي مخمَّد حرجياً (≈1.0) بلا تجاوز؛ الارتداد فقط لما يحمل زخماً أو لحظةً مقصودة */
export const SPRING = {
  soft: { type: 'spring', stiffness: 260, damping: 32, mass: 1 } as Transition,      // ≈1.0: دخول، ألواح، تبديل
  snappy: { type: 'spring', stiffness: 520, damping: 43, mass: 0.9 } as Transition,  // ≈1.0: ضغط، مؤشرات منزلقة
  bouncy: { type: 'spring', stiffness: 430, damping: 21, mass: 0.9 } as Transition,  // ≈0.53: الجزيرة، الختم، الشارة (لحظات)
  gentle: { type: 'spring', stiffness: 150, damping: 24, mass: 1 } as Transition,    // ≈0.98: الحلقات والعدّادات
};
const isRtl = () => document.documentElement.dir !== 'ltr';
function useMQ(q: string) { const [m, setM] = useState(() => window.matchMedia(q).matches); useEffect(() => { const mq = window.matchMedia(q); const on = () => setM(mq.matches); mq.addEventListener('change', on); return () => mq.removeEventListener('change', on); }, [q]); return m; }

/* ——— انتقال الشاشات: دفع إلى العمق، أو رجوع، أو تبديل لسان ——— */
const PAGE: Variants = {
  enter: (d: NavDir) => { const s = isRtl() ? -1 : 1; return d === 'push' ? { x: `${s * 34}%`, opacity: 0 } : d === 'pop' ? { x: `${-s * 20}%`, opacity: 0 } : { opacity: 0, y: 14 }; },
  center: { x: 0, y: 0, opacity: 1, transition: { type: 'spring', stiffness: 420, damping: 40, mass: 1 } },
  exit: (d: NavDir) => { const s = isRtl() ? -1 : 1; return d === 'push' ? { x: `${-s * 18}%`, opacity: 0, transition: { duration: 0.26, ease: [0.4, 0, 0.2, 1] } } : d === 'pop' ? { x: `${s * 34}%`, opacity: 0, transition: { duration: 0.26, ease: [0.4, 0, 0.2, 1] } } : { opacity: 0, y: -8, transition: { duration: 0.14 } }; },
};
export const Page = React.forwardRef<HTMLDivElement, { dir: NavDir; children: React.ReactNode; className?: string }>(function Page({ dir, children, className = '' }, ref) {
  return <motion.div ref={ref} className={`screen ${className}`} custom={dir} variants={PAGE} initial="enter" animate="center" exit="exit">{children}</motion.div>;
});

/* ——— دخول القوائم متتابعاً ——— */
export const ITEM: Variants = { hide: { opacity: 0, y: 10, scale: 0.995 }, show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 380, damping: 32 } } };
export function Stagger({ children, className = '', delay = 0.04, step = 0.045, as = 'div' }: { children: React.ReactNode; className?: string; delay?: number; step?: number; as?: 'div' | 'section' }) {
  const C = as === 'section' ? motion.section : motion.div;
  return <C className={className} initial="hide" animate="show" variants={{ show: { transition: { staggerChildren: step, delayChildren: delay } }, hide: {} }}>{children}</C>;
}
export function Item({ children, className = '', style, layout }: { children: React.ReactNode; className?: string; style?: React.CSSProperties; layout?: boolean }) {
  return <motion.div className={`item ${className}`} style={style} variants={ITEM} layout={layout}>{children}</motion.div>;
}

/* ——— الضغط: كل ما يُلمس يستجيب ——— */
export function Press({ as = 'button', lift, className = '', children, ...rest }: { as?: 'button' | 'a' | 'div'; lift?: boolean; className?: string; children: React.ReactNode } & Record<string, unknown>) {
  const C = (as === 'a' ? motion.a : as === 'div' ? motion.div : motion.button) as typeof motion.button;
  return <C className={className} whileTap={{ scale: 0.965 }} whileHover={lift ? { y: -3 } : undefined} transition={SPRING.snappy} {...(rest as object)}>{children}</C>;
}

/* ——— العدّاد: الرقم يصعد إلى قيمته ——— */
export function Ticker({ value, decimals = 0, className = '', delay = 0 }: { value: number; decimals?: number; className?: string; delay?: number }) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(reduce ? value : 0);
  const [txt, setTxt] = useState(() => (reduce ? value : 0).toFixed(decimals));
  useEffect(() => { if (reduce) { mv.set(value); setTxt(value.toFixed(decimals)); return; } const c = animate(mv, value, { type: 'spring', stiffness: 70, damping: 22, mass: 1, delay }); return () => c.stop(); }, [value, reduce, decimals, delay, mv]);
  useMotionValueEvent(mv, 'change', (v) => setTxt(v.toFixed(decimals)));
  return <span className={`tk ${className}`}>{txt}</span>;
}

/* ——— الحلقة: رصيد أو اكتمال ——— */
export function Ring({ value, max, size = 84, stroke = 9, color = 'var(--tint)', track = 'var(--bg-inset-2)', delay = 0.1, children, className = '' }: { value: number; max: number; size?: number; stroke?: number; color?: string; track?: string; delay?: number; children?: React.ReactNode; className?: string }) {
  const r = (size - stroke) / 2; const p = Math.max(0.02, Math.min(1, max ? value / max : 0));
  return (
    <div className={`ring ${className}`} style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} initial={{ pathLength: 0 }} animate={{ pathLength: p }} transition={{ type: 'spring', stiffness: 55, damping: 20, delay }} />
      </svg>
      <div className="ring-c">{children}</div>
    </div>
  );
}

/* ——— علامة الإتمام: تُرسم كما في إتمام الدفع ——— */
export function CheckMark({ size = 104 }: { size?: number }) {
  return (
    <motion.svg viewBox="0 0 96 96" width={size} height={size} className="checkmark" initial="hide" animate="show" aria-hidden="true">
      <motion.circle cx="48" cy="48" r="42" fill="none" stroke="var(--tint)" strokeWidth="4" transform="rotate(-90 48 48)" variants={{ hide: { pathLength: 0, opacity: 0.4 }, show: { pathLength: 1, opacity: 1, transition: { duration: 0.55, ease: [0.4, 0, 0.2, 1] } } }} />
      <motion.circle cx="48" cy="48" r="42" fill="var(--tint)" style={{ transformOrigin: '48px 48px' }} variants={{ hide: { scale: 0 }, show: { scale: 1, transition: { type: 'spring', stiffness: 320, damping: 22, delay: 0.42 } } }} />
      <motion.path d="M30 49.5l12 12 24-26" fill="none" stroke="var(--tint-fg)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" variants={{ hide: { pathLength: 0, opacity: 0 }, show: { pathLength: 1, opacity: 1, transition: { duration: 0.32, delay: 0.66, ease: 'easeOut' } } }} />
    </motion.svg>
  );
}

/* ——— الجزيرة: تنبيه يهبط من الأعلى، يتمدد ليقول ما حدث، ثم ينكمش ——— */
export interface IslandMsg { title: string; sub?: string; icon?: IconName; tone?: '' | 'ok' | 'gold' | 'warn' | 'danger' | 'info' }
const IslandCtx = createContext<(m: string | IslandMsg) => void>(() => {});
export function IslandProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState<(IslandMsg & { id: number }) | null>(null); const timer = useRef<number>(); const seq = useRef(0);
  const show = useCallback((m: string | IslandMsg) => {
    const it: IslandMsg = typeof m === 'string' ? { title: m } : m; seq.current += 1;
    setMsg({ icon: 'check', tone: 'ok', ...it, id: seq.current });
    window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setMsg(null), it.sub ? 3600 : 2800);
  }, []);
  const Ic = msg ? I[msg.icon || 'check'] : null;
  return (
    <IslandCtx.Provider value={show}>
      {children}
      <div className="island-host" role="status" aria-live="polite">
        <AnimatePresence mode="wait">
          {msg && Ic && (
            <motion.div key={msg.id} className={`island ${msg.tone || ''}`} initial={{ y: -34, scale: 0.5, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} exit={{ y: -24, scale: 0.55, opacity: 0, transition: { duration: 0.2, ease: 'easeIn' } }} transition={SPRING.bouncy} onClick={() => setMsg(null)} layout>
              <motion.span className="island-ic" initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={{ ...SPRING.bouncy, delay: 0.1 }}><Ic /></motion.span>
              <motion.span className="island-txt" initial={{ opacity: 0, x: isRtl() ? -8 : 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.14, duration: 0.25 }}><b>{msg.title}</b>{msg.sub ? <span>{msg.sub}</span> : null}</motion.span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </IslandCtx.Provider>
  );
}
export function useIsland() { return useContext(IslandCtx); }

/* ——— اللوح السفلي: ينبثق بنابض، ويُسحب من مقبضه أو رأسه ليُغلق ——— */
export function Sheet({ open, onClose, title, children, lead, wideDialog = true }: { open: boolean; onClose: () => void; title?: React.ReactNode; children: React.ReactNode; lead?: React.ReactNode; wideDialog?: boolean }) {
  const wide = useMQ('(min-width: 900px)') && wideDialog; const controls = useDragControls(); const reduce = useReducedMotion();
  useEffect(() => { if (!open) return; const prev = document.body.style.overflow; document.body.style.overflow = 'hidden'; const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', k); }; }, [open, onClose]);
  const onDragEnd = (_: unknown, info: PanInfo) => { if (info.offset.y > 120 || info.velocity.y > 650) onClose(); };
  const start = (e: React.PointerEvent) => { if (!wide) controls.start(e); };
  return createPortal(
    <AnimatePresence>
      {open && (
        <React.Fragment key="sheet-root">
          <motion.div key="scrim" className="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }} onClick={onClose} />
          <motion.div key="sheet" className={`sheet ${wide ? 'dialog' : ''}`} role="dialog" aria-modal="true"
            initial={reduce ? { opacity: 0 } : wide ? { opacity: 0, scale: 0.94, y: '-47%' } : { y: '104%' }}
            animate={reduce ? { opacity: 1 } : wide ? { opacity: 1, scale: 1, y: '-50%' } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : wide ? { opacity: 0, scale: 0.96, y: '-48%', transition: { duration: 0.16 } } : { y: '104%', transition: { type: 'spring', stiffness: 380, damping: 40 } }}
            transition={wide ? { type: 'spring', stiffness: 480, damping: 42 } : { type: 'spring', stiffness: 330, damping: 34, mass: 0.9 }}
            drag={wide || reduce ? false : 'y'} dragControls={controls} dragListener={false} dragConstraints={{ top: 0 }} dragElastic={{ top: 0.04, bottom: 1 }} dragSnapToOrigin onDragEnd={onDragEnd}>
            <div className="grab" onPointerDown={start} style={{ touchAction: 'none' }} />
            {title ? <div className="sheet-head" onPointerDown={start}>{lead}<h2>{title}</h2><button type="button" className="icon-btn" aria-label="close" onClick={onClose}><I.x /></button></div> : null}
            {children}
          </motion.div>
        </React.Fragment>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/* ——— الصف القابل للسحب: يكشف أزرار القرار (كما في البريد) ——— */
export function SwipeRow({ children, actions, disabled, onOpen, ariaLabel, rtl = isRtl() }: { children: React.ReactNode; actions: { label: string; icon: IconName; tone: string; onClick: () => void }[]; disabled?: boolean; onOpen: () => void; ariaLabel?: string; rtl?: boolean }) {
  const x = useMotionValue(0); const W = actions.length * 92; const sign = rtl ? 1 : -1; const openRef = useRef(false); const dragged = useRef(false);
  const settle = (to: number, velocity = 0) => { animate(x, to, { ...SPRING.snappy, velocity }); openRef.current = to !== 0; }; // تسليم سرعة الإصبع إلى النابض: لا درزة بين السحب والحركة
  const onDragStart = () => { dragged.current = true; };
  const onDragEnd = (_: unknown, info: PanInfo) => { const o = info.offset.x * sign; const v = info.velocity.x * sign; const vel = info.velocity.x; if (openRef.current) { settle(o < -W * 0.3 || v < -300 ? 0 : sign * W, vel); } else settle(o > W * 0.4 || v > 420 ? sign * W : 0, vel); window.setTimeout(() => { dragged.current = false; }, 80); };
  return (
    <div className="swipe">
      <div className="swipe-actions" style={{ width: W }} aria-hidden={!openRef.current}>
        {actions.map((a) => { const Ic = I[a.icon]; return <button key={a.label} type="button" className={`swipe-act ${a.tone}`} tabIndex={-1} onClick={() => { settle(0); a.onClick(); }}><Ic /><span>{a.label}</span></button>; })}
      </div>
      <motion.div className="swipe-front" style={{ x }} drag={disabled ? false : 'x'} dragDirectionLock dragConstraints={rtl ? { left: 0, right: W } : { left: -W, right: 0 }} dragElastic={0.06} onDragStart={onDragStart} onDragEnd={onDragEnd}
        onTap={() => { if (dragged.current) return; if (openRef.current) { settle(0); return; } onOpen(); }} role="button" tabIndex={0} aria-label={ariaLabel} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}>
        {children}
      </motion.div>
    </div>
  );
}

/* ——— البطاقة المائلة: تتبع المؤشر بمنظور، وتنقلب بلمسة ——— */
export function Tilt({ children, back, flipped, onFlip, className = '', max = 9 }: { children: React.ReactNode; back?: React.ReactNode; flipped?: boolean; onFlip?: () => void; className?: string; max?: number }) {
  const rx = useMotionValue(0), ry = useMotionValue(0); const reduce = useReducedMotion();
  const sx = useSpring(rx, { stiffness: 180, damping: 22 }), sy = useSpring(ry, { stiffness: 180, damping: 22 });
  const onMove = (e: React.PointerEvent) => { if (reduce || e.pointerType === 'touch') return; const b = e.currentTarget.getBoundingClientRect(); const px = (e.clientX - b.left) / b.width - 0.5; const py = (e.clientY - b.top) / b.height - 0.5; rx.set(-py * max * 2); ry.set(px * max * 2); };
  const reset = () => { rx.set(0); ry.set(0); };
  return (
    <motion.div className={`tilt ${className}`} style={{ rotateX: sx, rotateY: sy, transformPerspective: 1100 }} onPointerMove={onMove} onPointerLeave={reset} whileTap={{ scale: 0.985 }} onTap={onFlip} transition={SPRING.snappy}>
      <motion.div className="tilt-inner" animate={{ rotateY: flipped ? 180 : 0 }} transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 220, damping: 26 }}>
        <div className="tilt-face">{children}</div>
        {back ? <div className="tilt-face tilt-back">{back}</div> : null}
      </motion.div>
    </motion.div>
  );
}

export { motion, AnimatePresence, useMotionValue, useSpring, useReducedMotion, animate };
