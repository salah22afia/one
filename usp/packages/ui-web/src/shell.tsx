/* Shell primitives of the prototype's "Today" frame (app/ui.tsx + ui/Page.tsx): layout by the width of the app container
   (not the window), the scroll position, overlays rendered inside the app root, the bottom sheet, the horizontal rail and
   the page chrome (large title → small glass bar, iOS 26). */
import React, { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';
import { useI18n } from '@usp/i18n';
import { motion, AnimatePresence, useMotionValue, useReducedMotion, useDragControls, useTransform, type PanInfo } from 'motion/react';
import { I } from './icons';
import { Avatar } from './components';
import type { NavDir } from './motion';
import emblem from './emblem.png';

/** Width breakpoints of the prototype: sidebar from 900, desk bar and grids from 1024. */
export const WIDE = 900, DESK = 1024;

interface UICtx { wide: boolean; desk: boolean; width: number; rootRef: React.RefObject<HTMLDivElement | null>; person?: string }
const Ctx = createContext<UICtx | null>(null);

/** Measures the app root; {@code person} is the signed-in user's display name (avatar in the page chrome). */
export function UIProvider({ person, children }: { person?: string; children: (ctx: UICtx) => React.ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(() => window.innerWidth);
  useLayoutEffect(() => {
    const el = rootRef.current; if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth)); ro.observe(el); setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const value = useMemo<UICtx>(() => ({ wide: width >= WIDE, desk: width >= DESK, width, rootRef, person }), [width, person]);
  return <Ctx.Provider value={value}>{children(value)}</Ctx.Provider>;
}
export function useUI() { const v = useContext(Ctx); if (!v) throw new Error('UIProvider missing'); return v; }

/** How the current screen was entered: on pop it comes back as it was, without replaying its entrance. */
export const EnterCtx = createContext<NavDir>('tab');
export function useIntroSkip() { const reduce = useReducedMotion(); const enter = useContext(EnterCtx); return !!reduce || enter === 'pop'; }

/** Vertical scroll of the page as a motion value. */
export function useScrollY() {
  const y = useMotionValue(0);
  useEffect(() => {
    const read = () => y.set(window.scrollY);
    read(); window.addEventListener('scroll', read, { passive: true }); return () => window.removeEventListener('scroll', read);
  }, [y]);
  return y;
}

/** Overlays render inside the app root (#app-overlays), not document.body. */
export function Overlay({ children }: { children: React.ReactNode }) {
  const { rootRef } = useUI(); const host = rootRef.current?.querySelector<HTMLElement>('#app-overlays');
  return host ? createPortal(children, host) : null;
}

export function useLockScroll(on: boolean) {
  useEffect(() => { if (!on) return; const prev = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = prev; }; }, [on]);
}

/** Bottom sheet: springs up on a phone, a centred dialog when wide; dragged down by its grab or head to close. */
export function BottomSheet({ open, onClose, title, children, lead, tall, className = '' }: { open: boolean; onClose: () => void; title?: React.ReactNode; children: React.ReactNode; lead?: React.ReactNode; tall?: boolean; className?: string }) {
  const { wide } = useUI(); const controls = useDragControls(); const reduce = useReducedMotion(); const { t } = useI18n();
  useLockScroll(open);
  useEffect(() => { if (!open) return; const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [open, onClose]);
  const onDragEnd = (_: unknown, info: PanInfo) => { if (info.offset.y > 120 || info.velocity.y > 650) onClose(); };
  const start = (e: React.PointerEvent) => { if (!wide) controls.start(e); };
  return (
    <Overlay>
      <AnimatePresence>
        {open && (
          <React.Fragment key="lsheet">
            <motion.div key="scrim" className="lb-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }} onClick={onClose} />
            <motion.div key="sheet" className={`lb-sheet ${wide ? 'dialog' : ''} ${tall ? 'tall' : ''} ${className}`} role="dialog" aria-modal="true"
              initial={reduce ? { opacity: 0 } : wide ? { opacity: 0, scale: 0.94, y: '-47%' } : { y: '104%' }}
              animate={reduce ? { opacity: 1 } : wide ? { opacity: 1, scale: 1, y: '-50%' } : { y: 0 }}
              exit={reduce ? { opacity: 0 } : wide ? { opacity: 0, scale: 0.96, y: '-48%', transition: { duration: 0.16 } } : { y: '104%', transition: { type: 'spring', stiffness: 380, damping: 40 } }}
              transition={wide ? { type: 'spring', stiffness: 480, damping: 42 } : { type: 'spring', stiffness: 330, damping: 34, mass: 0.9 }}
              drag={wide || reduce ? false : 'y'} dragControls={controls} dragListener={false} dragConstraints={{ top: 0 }} dragElastic={{ top: 0.04, bottom: 1 }} dragSnapToOrigin onDragEnd={onDragEnd}>
              <div className="grab" onPointerDown={start} style={{ touchAction: 'none' }} />
              {title !== undefined ? <div className="sheet-head" onPointerDown={start}>{lead}<h2>{title}</h2><button type="button" className="icon-btn" aria-label={t('common.close')} onClick={onClose}><I.x /></button></div> : null}
              {children}
            </motion.div>
          </React.Fragment>
        )}
      </AnimatePresence>
    </Overlay>
  );
}

/** Horizontal rail: free finger scroll, mouse-draggable on desktop (no scrollbars), faded edges. */
export function Rail({ children, className = '', ariaLabel, snap = true }: { children: React.ReactNode; className?: string; ariaLabel?: string; snap?: boolean }) {
  const ref = useRef<HTMLDivElement>(null); const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const down = (e: React.PointerEvent) => { if (e.pointerType !== 'mouse' || !ref.current) return; drag.current = { x: e.clientX, left: ref.current.scrollLeft, moved: false }; };
  const move = (e: React.PointerEvent) => { const d = drag.current; if (!d || !ref.current) return; const dx = e.clientX - d.x; if (Math.abs(dx) > 4) d.moved = true; ref.current.scrollLeft = d.left - dx; };
  const up = () => { const d = drag.current; drag.current = null; if (d?.moved && ref.current) { ref.current.dataset.dragged = '1'; window.setTimeout(() => { if (ref.current) delete ref.current.dataset.dragged; }, 60); } };
  const click = (e: React.MouseEvent) => { if (ref.current?.dataset.dragged) { e.preventDefault(); e.stopPropagation(); } };
  return <div ref={ref} className={`lb-rail ${snap ? 'snap' : ''} ${className}`} role="list" aria-label={ariaLabel} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up} onClickCapture={click}>{children}</div>;
}

/** Light section head, no box. */
export function Head({ children, action, id }: { children: React.ReactNode; action?: React.ReactNode; id?: string }) {
  return <div className="lb-head" id={id}><h2>{children}</h2>{action}</div>;
}

/* Numbers, dates and codes inside free text never break or flip (REQ-2026-0386, 2026-12-20 → 2026-12-24, 01:23). */
const NB_RE = /(\d{4}-\d{2}-\d{2}(?:\s?→\s?\d{4}-\d{2}-\d{2})?|[A-Z]{1,6}(?:-[A-Z0-9]+)*-\d[\w/]*|\b\d{5,}\b|\b\d{1,2}:\d{2}\b|\b\d{4}\/\d{4}\b)/g;
export function Nb({ s }: { s: string }) {
  const parts = s.split(NB_RE); if (parts.length === 1) return <>{s}</>;
  return <>{parts.map((p, i) => (i % 2 === 1 ? <span key={i} className="nb">{p}</span> : <React.Fragment key={i}>{p}</React.Fragment>))}</>;
}

/** The General Secretariat emblem, once at the top of every tab root (C-UX-82). */
export function Mark({ size = 30, className = '' }: { size?: number; className?: string }) {
  return <img className={`lb-mark ${className}`} src={emblem} alt="" width={size} height={size} draggable={false} />;
}

/**
 * Page frame. Phone: a top row (back or avatar · emblem · action) and a 34pt title that becomes a 17pt glass bar on
 * scroll — never both at once. Wide: a title row with its actions.
 */
export function PageChrome({ title, sub, back, end, children, className = '', root = false, wideActions }: { title: string; sub?: string; back?: string; end?: React.ReactNode; children: React.ReactNode; className?: string; root?: boolean; wideActions?: React.ReactNode }) {
  const { wide, person } = useUI(); const { t } = useI18n(); const navigate = useNavigate();
  const y = useScrollY(); const barO = useTransform(y, [56, 100], [0, 1]); const barY = useTransform(y, [56, 100], [-6, 0]); const titleO = useTransform(y, [0, 56], [1, 0]);
  // The glass bar takes touches only while visible; its back button stays in thumb reach after scrolling, as on iOS.
  const barPE = useTransform(barO, (v) => (v > 0.6 ? 'auto' : 'none'));
  return (
    <div className={`lb-page lp ${root ? 'root' : ''} ${className}`}>
      {!wide && (
        <motion.div className="lb-topbar lp-bar" style={{ opacity: barO, y: barY, pointerEvents: barPE }} aria-hidden="true">
          <span className="lp-slot start">{back !== undefined ? <button type="button" className="back-btn" tabIndex={-1} onClick={() => navigate(back)}><I.chev className="backchev" />{t('nav.back')}</button> : null}</span>
          <b className="lp-bar-t">{title}</b>
          <span className="lp-slot end" />
        </motion.div>
      )}
      {!wide ? (
        <div className="lp-top">
          <span className="lp-slot start">{back !== undefined ? <motion.button type="button" className="back-btn" whileTap={{ scale: 0.94 }} onClick={() => navigate(back)}><I.chev className="backchev" />{t('nav.back')}</motion.button> : root ? <motion.button type="button" className="icon-btn lp-me" onClick={() => navigate('/me')} aria-label={t('tabs.me')} whileTap={{ scale: 0.9 }}><Avatar name={person} size="sm" /></motion.button> : null}</span>
          <Mark />
          <span className="lp-slot end">{end}</span>
        </div>
      ) : null}
      <motion.div className="lp-head" style={{ opacity: wide ? 1 : titleO }}>
        <div className="lp-head-txt"><h1>{title}</h1>{sub ? <p>{sub}</p> : null}</div>
        {wide ? <div className="lp-head-act">{wideActions ?? end}</div> : null}
      </motion.div>
      {children}
    </div>
  );
}
