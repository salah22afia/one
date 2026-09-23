/* سياق الهيكل «اليوم» (v0.13، كان مختبر التصميم): ما يخص الموظف من القصص والمنشورات يُقرأ من مخزن البوابة (لا مفتاح مستقل)، وقواعد القصة والتأكيد من سياسة الأخبار والقصص،
   وأدوات مشتركة: عرض الحاوية (لا نافذة المتصفح) حتى يعمل إطار الهاتف على الحاسوب، ومتغير التمرير للحاوية الصحيحة، ولوح سفلي يُرسم داخل جذر الهيكل. */
import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useMotionValue, useReducedMotion, animate, useDragControls, type PanInfo } from 'motion/react';
import { useStore } from './store';
import { useLang, usePerson } from '../ui/components';
import { I } from '../ui/icons';
import { STR, type Strings } from './strings';
import type { PostKind } from '../domain/types';
import type { NavDir } from './router';
import { commsContent, seenOf, acksOf, calOf, dismissedOf } from '../domain/comms';

/** ما يخص الموظف الحالي وقواعد السياسة السارية (قراءة؛ التغيير بإجراءات المخزن) */
export interface UIState { seen: Record<string, string>; acks: Record<string, number>; cal: string[]; dismissed: string[]; phone: boolean; storyHours: number; storyVideoMaxSec: number; storyImageMaxMB: number; storyVideoMaxMB: number; ackKinds: PostKind[]; ackReminderDays: number }

interface UICtx { ui: UIState; L: Strings; wide: boolean; desk: boolean; width: number; rootRef: React.RefObject<HTMLDivElement>; scroller: () => HTMLElement | Window; framed: boolean }
const Ctx = createContext<UICtx | null>(null);

export function UIProvider({ children }: { children: (ctx: UICtx) => React.ReactNode }) {
  const { state } = useStore(); const me = usePerson();
  const content = commsContent(state);
  const ui = useMemo<UIState>(() => ({ seen: seenOf(state, me.id), acks: acksOf(state, me.id), cal: calOf(state, me.id), dismissed: dismissedOf(state, me.id), phone: !!state.settings.phoneFrame, storyHours: content.rules.storyHours, storyVideoMaxSec: content.rules.storyVideoMaxSec, storyImageMaxMB: content.rules.storyImageMaxMB, storyVideoMaxMB: content.rules.storyVideoMaxMB, ackKinds: content.kinds.filter((k) => k.ackAllowed && !k.endedAt).map((k) => k.id), ackReminderDays: content.rules.ackReminderDays }), [state, me.id, content]);
  const { lang } = useLang(); const L = STR[lang];
  const rootRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(() => window.innerWidth);
  const [vw, setVw] = useState(() => window.innerWidth);
  useEffect(() => { const on = () => setVw(window.innerWidth); window.addEventListener('resize', on); return () => window.removeEventListener('resize', on); }, []);
  /* إطار الهاتف لا يُفعَّل إلا على شاشة عريضة */
  const framed = ui.phone && vw >= 1024;
  useLayoutEffect(() => {
    const el = rootRef.current; if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth)); ro.observe(el); setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, [framed]);
  const wide = width >= 900, desk = width >= 1024;
  const scroller = useCallback((): HTMLElement | Window => (framed && rootRef.current ? rootRef.current : window), [framed]);
  const value = useMemo<UICtx>(() => ({ ui, L, wide, desk, width, rootRef, scroller, framed }), [ui, L, wide, desk, width, scroller, framed]);
  return <Ctx.Provider value={value}>{children(value)}</Ctx.Provider>;
}
export function useUI() { const v = useContext(Ctx); if (!v) throw new Error('UIProvider مفقود'); return v; }

/** كيف دخلت الشاشة الحالية: بالرجوع (pop) تعود كما كانت بلا إعادة تقديم لعناصرها، وما عداه تُقدَّم عناصرها بحركة الدخول */
export const EnterCtx = createContext<NavDir>('tab');
/** هل تُتخطّى حركة الدخول؟ عند تفضيل تقليل الحركة، أو عند الرجوع إلى شاشة (iOS لا يعيد تقديم القائمة عند الرجوع إليها) */
export function useIntroSkip() { const reduce = useReducedMotion(); const enter = useContext(EnterCtx); return !!reduce || enter === 'pop'; }

/** التمرير الرأسي للحاوية الصحيحة (النافذة، أو جذر المختبر داخل إطار الهاتف) */
export function useScrollY() {
  const { scroller, framed } = useUI(); const y = useMotionValue(0);
  useEffect(() => {
    const s = scroller(); const read = () => y.set(s instanceof Window ? s.scrollY : s.scrollTop);
    read(); s.addEventListener('scroll', read, { passive: true }); return () => s.removeEventListener('scroll', read);
  }, [scroller, framed, y]);
  return y;
}
export function scrollTop(s: HTMLElement | Window) { if (s instanceof Window) s.scrollTo({ top: 0 }); else s.scrollTop = 0; }

/** مضيف الطبقات داخل جذر المختبر (لا document.body) حتى تبقى داخل إطار الهاتف */
export function useOverlayHost() { const { rootRef } = useUI(); return rootRef.current?.querySelector('#app-overlays') as HTMLElement | null; }
export function Overlay({ children }: { children: React.ReactNode }) { const host = useOverlayHost(); return host ? createPortal(children, host) : null; }

/** قفل تمرير الحاوية أثناء لوح أو عارض */
export function useLockScroll(on: boolean) {
  const { scroller, rootRef } = useUI();
  useEffect(() => { if (!on) return; const s = scroller(); const el = s instanceof Window ? document.body : (rootRef.current as HTMLElement); const prev = el.style.overflow; el.style.overflow = 'hidden'; return () => { el.style.overflow = prev; }; }, [on, scroller, rootRef]);
}

/** اللوح السفلي للمختبر: ينبثق بنابض من الأسفل على الهاتف، ونافذة في الوسط على الحاسوب؛ يُسحب من مقبضه أو رأسه ليُغلق */
export function BottomSheet({ open, onClose, title, children, lead, tall, className = '' }: { open: boolean; onClose: () => void; title?: React.ReactNode; children: React.ReactNode; lead?: React.ReactNode; tall?: boolean; className?: string }) {
  const { wide } = useUI(); const controls = useDragControls(); const reduce = useReducedMotion();
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
              {title !== undefined ? <div className="sheet-head" onPointerDown={start}>{lead}<h2>{title}</h2><button type="button" className="icon-btn" aria-label="close" onClick={onClose}><I.x /></button></div> : null}
              {children}
            </motion.div>
          </React.Fragment>
        )}
      </AnimatePresence>
    </Overlay>
  );
}

/** الشريط الأفقي: سحب حر بالإصبع، وبالمؤشر على الحاسوب يُسحب أيضاً (لا أشرطة تمرير)، وتلاشٍ على الحافتين */
export function Rail({ children, className = '', ariaLabel, snap = true }: { children: React.ReactNode; className?: string; ariaLabel?: string; snap?: boolean }) {
  const ref = useRef<HTMLDivElement>(null); const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const down = (e: React.PointerEvent) => { if (e.pointerType !== 'mouse' || !ref.current) return; drag.current = { x: e.clientX, left: ref.current.scrollLeft, moved: false }; };
  const move = (e: React.PointerEvent) => { const d = drag.current; if (!d || !ref.current) return; const dx = e.clientX - d.x; if (Math.abs(dx) > 4) d.moved = true; ref.current.scrollLeft = d.left - dx; };
  const up = () => { const d = drag.current; drag.current = null; if (d?.moved && ref.current) { ref.current.dataset.dragged = '1'; window.setTimeout(() => { if (ref.current) delete ref.current.dataset.dragged; }, 60); } };
  const click = (e: React.MouseEvent) => { if (ref.current?.dataset.dragged) { e.preventDefault(); e.stopPropagation(); } };
  return <div ref={ref} className={`lb-rail ${snap ? 'snap' : ''} ${className}`} role="list" aria-label={ariaLabel} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up} onClickCapture={click}>{children}</div>;
}

/** رأس قسم خفيف بلا صندوق */
export function Head({ children, action, id }: { children: React.ReactNode; action?: React.ReactNode; id?: string }) {
  return <div className="lb-head" id={id}><h2>{children}</h2>{action}</div>;
}

/** التاريخ الهجري (أم القرى) بالعربية أو الإنجليزية */
export function hijri(ms: number, lang: 'ar' | 'en') {
  try { return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA-u-ca-islamic-umalqura-nu-latn' : 'en-US-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' }).format(ms); } catch { return ''; }
}

/** هل يطلب المنشور تأكيد الاطلاع فعلاً؟ الناشر يطلبه على المنشور، ومدير النظام يحدد الأنواع التي يجوز لها ذلك */
export function needsAck(p: { kind: PostKind; requiresAck?: boolean }, ui: UIState) { return !!p.requiresAck && ui.ackKinds.includes(p.kind); }

/** الاسم المختصر: الاسم الأول والأخير («أحمد بن سعود العتيبي» → «أحمد العتيبي»)، بلا «بن/بنت» */
export function shortName(p: { name: string; nameEn: string } | undefined, lang: 'ar' | 'en') {
  if (!p) return '';
  const parts = (lang === 'ar' ? p.name : p.nameEn).split(' ').filter((w) => w && !['بن', 'بنت', 'bin', 'bint'].includes(w));
  return parts.length > 2 ? `${parts[0]} ${parts[parts.length - 1]}` : parts.join(' ');
}

export { animate };

/* v0.17 (النظرة العميقة): الأرقام والتواريخ والرموز داخل نص حرّ لا تنكسر في منتصفها ولا تنقلب — REQ-2026-0386، و2026-12-20 → 2026-12-24، و01:23، وأرقام النظام المرجعي؛
   تُلفّ في <span class="nb"> (nowrap + اتجاه معزول). يُستعمل في سجل الأحداث والتنبيهات وأسطر المكاتب. */
const NB_RE = /(\d{4}-\d{2}-\d{2}(?:\s?→\s?\d{4}-\d{2}-\d{2})?|[A-Z]{1,6}(?:-[A-Z0-9]+)*-\d[\w/]*|\b\d{5,}\b|\b\d{1,2}:\d{2}\b|\b\d{4}\/\d{4}\b)/g;
export function Nb({ s }: { s: string }) {
  const parts = s.split(NB_RE); if (parts.length === 1) return <>{s}</>;
  return <>{parts.map((p, i) => (i % 2 === 1 ? <span key={i} className="nb">{p}</span> : <React.Fragment key={i}>{p}</React.Fragment>))}</>;
}
