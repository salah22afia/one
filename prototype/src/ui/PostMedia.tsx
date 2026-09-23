/* وسائط المنشور (v0.14): الفسيفساء والعارض.
   الفسيفساء ترتّب نفسها بعدد الوسائط (١ عريضة، ٢ جنباً إلى جنب، ٣ كبيرة واثنتان، ٤ مربع، وما زاد «+ن» على الأخيرة) فلا تصير سبع صور سبع شاشات تمرير؛
   والعارض بالإيماءات نفسها التي تعلّمها الموظف في القصص: سحب بين الوسائط، وتكبير بالأصابع أو بنقرتين، وسحب لأسفل للإغلاق، وعدّاد وتعليق. */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, useReducedMotion, animate } from 'motion/react';
import { useLang } from './components';
import { I } from './icons';
import { useMediaUrl, useMediaUrlById, fmtClock } from './media';
import { Overlay, useLockScroll } from '../app/ui';
import type { PostMedia } from '../domain/types';

/** بلاطة: المصغّرة إن وُجدت (التمرير خفيف)، وإطار الفيديو الأول ومدته */
export function MediaTile({ m, onClick, more, label }: { m: PostMedia; onClick?: () => void; more?: number; label?: string }) {
  const thumb = useMediaUrlById(m.thumbId || (m.kind === 'video' ? m.posterId : m.id));
  const full = useMediaUrl(m.kind === 'image' ? m : undefined);
  const src = thumb || (m.kind === 'image' ? full : null);
  const { tx } = useLang();
  return (
    <motion.button type="button" className="gal-t" onClick={onClick} whileTap={{ scale: 0.985 }} aria-label={label || (m.alt ? tx(m.alt) : m.kind === 'video' ? 'video' : 'image')}>
      {src ? <img src={src} alt="" loading="lazy" /> : <span className="gal-sk" />}
      {m.kind === 'video' ? <span className="gal-play"><I.play /></span> : null}
      {m.kind === 'video' && m.durationMs ? <span className="gal-dur num" dir="ltr">{fmtClock(m.durationMs)}</span> : null}
      {more ? <span className="gal-more" dir="ltr">+{more}</span> : null}
    </motion.button>
  );
}

/** المعرض: يرتّب نفسه بعدد ما فيه، وما زاد على أربع يُطوى في «+ن» على آخر بلاطة */
export function PostGallery({ list, onOpen }: { list: PostMedia[]; onOpen: (i: number) => void }) {
  if (!list.length) return null;
  const n = list.length; const shown = Math.min(n, 4); const rest = n - shown;
  return (
    <div className={`gal n${shown}`} role="group">
      {list.slice(0, shown).map((m, i) => <MediaTile key={m.id} m={m} more={i === shown - 1 && rest > 0 ? rest : undefined} onClick={() => onOpen(i)} />)}
    </div>
  );
}

const SPR = { type: 'spring' as const, stiffness: 380, damping: 36 };

/** العارض: وسيطة واحدة ملء الشاشة، بالسحب بينها وبالتكبير */
export function MediaViewer({ list, start, onClose }: { list: PostMedia[]; start: number; onClose: () => void }) {
  const { lang, tx } = useLang(); const reduce = useReducedMotion();
  const [i, setI] = useState(Math.max(0, Math.min(start, list.length - 1)));
  const m = list[i];
  const stage = useRef<HTMLDivElement>(null); const W = () => stage.current?.clientWidth || 390;
  const x = useMotionValue(0); const y = useMotionValue(0); const z = useMotionValue(1);
  const [zoomed, setZoomed] = useState(false);
  const dim = useTransform(y, [0, 320], [1, 0.45]);
  useLockScroll(true);
  useEffect(() => { x.set(0); y.set(0); z.set(1); setZoomed(false); }, [i]); // eslint-disable-line react-hooks/exhaustive-deps
  const go = useCallback((d: 1 | -1) => { const n = i + d; if (n < 0 || n >= list.length) { animate(x, 0, SPR); return; } setI(n); x.set(0); }, [i, list.length, x]);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); else if (e.key === 'ArrowRight') go(lang === 'ar' ? -1 : 1); else if (e.key === 'ArrowLeft') go(lang === 'ar' ? 1 : -1); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [go, lang, onClose]);

  /* الإيماءات: إصبع واحد يسحب بين الوسائط أو لأسفل للإغلاق، وإصبعان يكبّران، ونقرتان تبدّلان التكبير */
  const pts = useRef(new Map<number, { x: number; y: number }>()); const base = useRef({ d: 0, z: 1 }); const active = useRef(false);
  const st = useRef({ x: 0, y: 0, t: 0, axis: '' as '' | 'x' | 'y', tap: 0 });
  const down = (e: React.PointerEvent) => {
    /* الالتقاط على المسرح لا على الصورة: الصورة تتبدّل مع الوسيطة فيضيع الالتقاط ويتكرر الإفلات */
    stage.current?.setPointerCapture?.(e.pointerId); active.current = true;
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.current.size === 2) { const [a, b] = [...pts.current.values()]; base.current = { d: Math.hypot(a.x - b.x, a.y - b.y), z: z.get() }; }
    st.current = { x: e.clientX, y: e.clientY, t: performance.now(), axis: '', tap: st.current.tap };
  };
  const move = (e: React.PointerEvent) => {
    if (!pts.current.has(e.pointerId)) return;
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.current.size >= 2) {
      const [a, b] = [...pts.current.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (base.current.d > 0) { const nz = Math.max(1, Math.min(4, base.current.z * (d / base.current.d))); z.set(nz); setZoomed(nz > 1.02); }
      return;
    }
    const dx = e.clientX - st.current.x, dy = e.clientY - st.current.y;
    if (z.get() > 1.02) { x.set(x.get() + (e.movementX || 0)); y.set(y.get() + (e.movementY || 0)); return; }
    if (!st.current.axis && Math.hypot(dx, dy) > 10) st.current.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    if (st.current.axis === 'x') x.set(dx);
    else if (st.current.axis === 'y' && dy > 0) y.set(dy);
  };
  const up = (e: React.PointerEvent) => {
    pts.current.delete(e.pointerId);
    if (pts.current.size >= 1) return;
    if (!active.current) return; active.current = false;
    if (z.get() > 1.02) { base.current = { d: 0, z: z.get() }; return; }
    const dx = x.get(), dy = y.get(), dt = performance.now() - st.current.t;
    if (st.current.axis === 'y' && (dy > 110 || (dy > 50 && dt < 260))) { onClose(); return; }
    /* السحب يسرة يقدّم ويمنة يرجع في اللغتين — وهو ما تعلّمه الموظف في عارض القصص بالعربية */
    if (st.current.axis === 'x' && (Math.abs(dx) > W() * 0.28 || (Math.abs(dx) > 40 && dt < 250))) { go(dx < 0 ? 1 : -1); animate(y, 0, SPR); return; }
    if (!st.current.axis) { /* نقرة: نقرتان متتاليتان تكبّران */
      const now = performance.now();
      if (now - st.current.tap < 300) { const nz = z.get() > 1.02 ? 1 : 2.4; animate(z, nz, SPR); setZoomed(nz > 1); st.current.tap = 0; }
      else st.current.tap = now;
    }
    animate(x, 0, SPR); animate(y, 0, SPR);
  };
  const reset = () => { animate(z, 1, SPR); animate(x, 0, SPR); animate(y, 0, SPR); setZoomed(false); };

  return (
    <Overlay>
      <motion.div className="mv" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
        <motion.div className="mv-dim" style={{ opacity: dim }} onClick={onClose} />
        <div className="mv-top">
          <span className="mv-count num" dir="ltr">{i + 1} / {list.length}</span>
          <span className="spacer" />
          {zoomed ? <button type="button" className="mv-btn" onClick={reset} aria-label="reset"><I.search /></button> : null}
          <button type="button" className="mv-x" aria-label="close" onClick={onClose}><I.x /></button>
        </div>
        <div className="mv-stage" ref={stage} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div key={m.id} className="mv-item" style={{ x, y, scale: z }} initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, transition: { duration: 0.14 } }} transition={SPR}>
              <MediaFull m={m} />
            </motion.div>
          </AnimatePresence>
        </div>
        {m.caption ? <div className="mv-cap">{tx(m.caption)}</div> : null}
        {list.length > 1 ? <div className="mv-dots">{list.map((it, k) => <span key={it.id} className={k === i ? 'on' : ''} />)}</div> : null}
      </motion.div>
    </Overlay>
  );
}

function MediaFull({ m }: { m: PostMedia }) {
  const url = useMediaUrl(m); const poster = useMediaUrlById(m.posterId);
  const { tx } = useLang();
  if (!url) return <span className="mv-sk" />;
  if (m.kind === 'video') return <video className="mv-v" src={url} poster={poster || undefined} controls playsInline preload="metadata" />;
  return <img className="mv-i" src={url} alt={m.alt ? tx(m.alt) : ''} draggable={false} />;
}

/** الغلاف الحقيقي في أعلى القارئ وفي البطاقة: صورة أو إطار الفيديو الأول */
export function MediaCover({ m, ratio = 'banner' }: { m: PostMedia; ratio?: 'banner' | 'wide' | 'square' }) {
  const url = useMediaUrl(m.kind === 'image' ? m : undefined); const poster = useMediaUrlById(m.posterId || m.thumbId);
  const src = m.kind === 'image' ? url || poster : poster;
  const { tx } = useLang();
  return (
    <span className={`mcv ${ratio}`}>
      {src ? <img src={src} alt={m.alt ? tx(m.alt) : ''} /> : <span className="gal-sk" />}
      {m.kind === 'video' ? <span className="gal-play lg"><I.play /></span> : null}
    </span>
  );
}
