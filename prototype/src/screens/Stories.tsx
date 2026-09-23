/* قصص القطاعات: شريط الحلقات في الرأس الأخضر، والعارض كامل الشاشة (مقاطع تقدّم، نقر للتقدّم في اتجاه القراءة، ضغط مطوّل للإيقاف،
   سحب أفقي بين القطاعات بمكعب، سحب لأسفل للإغلاق، وفيديو بصوت اختياري)، ومؤلّف القصة لناشري القطاع: صورة أو فيديو من الجهاز بمعاينة
   هي الشاشة نفسها التي يراها الموظف، أو غلاف من الهوية. */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, useReducedMotion, animate } from 'motion/react';
import { useStore } from '../app/store';
import { useLang, usePerson, Avatar, useToast } from '../ui/components';
import { I } from '../ui/icons';
import { relTime, fill } from '../app/i18n';
import { personById } from '../domain/engine';
import type { T2 } from '../domain/types';
import type { CoverSpec, StorySlide, StoryMedia } from '../domain/types';
import { storyGroups as groupsOf, publishingSectors, canPublish as canPublishOf, canDeleteStory, type StoryGroup } from '../domain/comms';
import type { CommsSector } from '../domain/policy';
import { Cover, HUE_CSS } from '../ui/covers';
import { useUI, Overlay, useLockScroll, BottomSheet, Rail, shortName, useIntroSkip } from '../app/ui';
import { useMediaUrl, putMedia, prepareImage, readVideoMeta, fmtMB, fmtSec } from '../ui/media';

export type { StoryGroup };
const SLIDE_MS = 5000;

/* أيقونات الوسائط (على شبكة أيقونات البوابة نفسها: 24، خط 1.6) */
type SP = React.SVGProps<SVGSVGElement>;
const B = ({ children, ...p }: SP) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>{children}</svg>;
const Ic = {
  photo: (p: SP) => <B {...p}><rect x="3.5" y="5" width="17" height="14" rx="2.5" /><circle cx="9" cy="10" r="1.8" /><path d="M20.5 16.5 16 12l-6.5 6.5" /></B>,
  sound: (p: SP) => <B {...p}><path d="M4 9.5v5h3.5L12 18V6L7.5 9.5z" /><path d="M15.5 9.5a3.5 3.5 0 0 1 0 5M18 7a7 7 0 0 1 0 10" /></B>,
  mute: (p: SP) => <B {...p}><path d="M4 9.5v5h3.5L12 18V6L7.5 9.5z" /><path d="M16 9.5l5 5M21 9.5l-5 5" /></B>,
  trash: (p: SP) => <B {...p}><path d="M5 7h14M9.5 7V4.5h5V7M7 7l.8 12.5h8.4L17 7" /></B>,
};

/** وجه المقطع: صورة أو فيديو من الجهاز إن وُجدا (ويُحمَّلان من التخزين)، وإلا غلاف الهوية؛ المعاينة في المؤلّف تمرّر رابطها مباشرة */
export function SlideMedia({ slide, override, playing = true, muted = true, grain = true, onDuration }: { slide: StorySlide; override?: { kind: 'image' | 'video'; url: string }; playing?: boolean; muted?: boolean; grain?: boolean; onDuration?: (ms: number) => void }) {
  const stored = useMediaUrl(override ? undefined : slide.media); const url = override ? override.url : stored; const kind = override ? override.kind : slide.media?.kind;
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => { const v = ref.current; if (!v) return; v.muted = muted; if (playing) v.play().catch(() => { /* autoplay blocked: stays on the first frame */ }); else v.pause(); }, [playing, muted, url]);
  if (url && kind === 'video') return <video ref={ref} className="stv-media" src={url} playsInline muted preload="auto" onLoadedMetadata={(e) => onDuration?.(Math.round(e.currentTarget.duration * 1000))} />;
  if (url && kind === 'image') return <img className="stv-media" src={url} alt="" draggable={false} />;
  return <Cover spec={slide.cover} ratio="story" grain={grain} />;
}
/** مدة المقطع: الفيديو بمدته حتى الحد الأقصى، وغيره خمس ثوانٍ */
export function slideMs(slide: StorySlide, maxSec: number) { return slide.media?.kind === 'video' ? Math.min(Math.max(slide.media.durationMs || SLIDE_MS, 1500), maxSec * 1000) : slide.ms || SLIDE_MS; }

/** مجموعات القصص الحية (خلال مدة القصة من السياسة)، مرتبة: قصتي، ثم غير المشاهَد بالأحدث، ثم المشاهَد */
export function useStoryGroups(now: number): StoryGroup[] {
  const { state } = useStore(); const me = usePerson();
  return useMemo(() => groupsOf(state, me, now), [state, me, now]);
}

/** حلقة القطاع */
function StoryRing({ g, onOpen, delay }: { g: StoryGroup; onOpen: () => void; delay: number }) {
  const { lang } = useLang(); const reduce = useIntroSkip(); const { L } = useUI();
  const hue = HUE_CSS[g.sector.hue];
  return (
    <motion.button type="button" className={`stry ${g.seen ? 'seen' : 'unseen'} ${g.mine ? 'mine' : ''}`} onClick={onOpen} whileTap={{ scale: 0.92 }} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 26, delay }}>
      <span className="stry-ring"><span className="stry-av" style={{ background: hue.bg, color: hue.fg }}>{lang === 'ar' ? g.sector.initials.ar : g.sector.initials.en}</span></span>
      <span className="stry-label">{g.mine ? L.yourStory : lang === 'ar' ? (g.sector.ring || g.sector.short).ar : (g.sector.ring || g.sector.short).en}</span>
    </motion.button>
  );
}

export function StoriesRail({ now, onOpen, onCompose }: { now: number; onOpen: (i: number) => void; onCompose: () => void }) {
  const groups = useStoryGroups(now); const me = usePerson(); const { state } = useStore(); const { L } = useUI(); const reduce = useIntroSkip();
  const canPublish = canPublishOf(state, me);
  return (
    <Rail className="stories" ariaLabel={L.stories} snap={false}>
      {canPublish && (
        <motion.button type="button" className="stry add" onClick={onCompose} whileTap={{ scale: 0.92 }} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 26 }}>
          <span className="stry-ring"><span className="stry-av"><Avatar p={me} /><span className="stry-plus"><I.plus /></span></span></span>
          <span className="stry-label">{L.addStory}</span>
        </motion.button>
      )}
      {groups.map((g, i) => <StoryRing key={g.sector.id} g={g} onOpen={() => onOpen(i)} delay={0.05 + i * 0.04} />)}
    </Rail>
  );
}

/* ——— العارض ——— */
function rubber(over: number, dim: number, c = 0.55) { return (over * dim * c) / (dim + c * Math.abs(over)); }

export function StoryViewer({ groups, start, onClose }: { groups: StoryGroup[]; start: number; onClose: () => void }) {
  const { lang, tx } = useLang(); const { state, dispatch } = useStore(); const me = usePerson(); const { ui, L, wide } = useUI(); const reduce = useReducedMotion(); const toast = useToast();
  const dir = lang === 'ar' ? -1 : 1;
  const [gi, setGi] = useState(start); const [si, setSi] = useState(0); const [paused, setPaused] = useState(false); const [muted, setMuted] = useState(true); const [askDel, setAskDel] = useState(false);
  const g = groups[gi]; const slides = g.story.slides; const slide = slides[si];
  const stageRef = useRef<HTMLDivElement>(null); const W = () => stageRef.current?.clientWidth || 390;
  const x = useMotionValue(0); const y = useMotionValue(0); const prog = useMotionValue(0);
  useLockScroll(true);
  /* تعليم القصة مشاهَدة عند فتحها (آخر مقطع) */
  useEffect(() => { const last = slides[slides.length - 1]; if (ui.seen[g.sector.id] !== last.id) dispatch({ type: 'storySeen', personId: me.id, sectorId: g.sector.id, slideId: last.id }); }, [gi]); // eslint-disable-line react-hooks/exhaustive-deps
  /* المؤقّت: يتقدّم بالإطار، ويتوقف بالضغط، ويُستأنف من مكانه */
  const startedAt = useRef(performance.now()); const acc = useRef(0); const pausedRef = useRef(false); pausedRef.current = paused;
  const dur = slideMs(slide, ui.storyVideoMaxSec); const isVideo = slide.media?.kind === 'video';
  const advance = useCallback(() => {
    if (si < slides.length - 1) { setSi(si + 1); return; }
    if (gi < groups.length - 1) { switchGroup(1); return; }
    onClose();
  }, [si, gi, slides.length, groups.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const back = useCallback(() => { if (si > 0) setSi(si - 1); else if (gi > 0) switchGroup(-1); else { startedAt.current = performance.now(); acc.current = 0; prog.set(0); } }, [si, gi]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { startedAt.current = performance.now(); acc.current = 0; prog.set(0); }, [gi, si, prog]);
  useEffect(() => {
    let raf = 0; let lastTs = performance.now();
    const loop = (ts: number) => { if (!pausedRef.current) { acc.current += ts - lastTs; const p = Math.min(1, acc.current / dur); prog.set(p); if (p >= 1) { advance(); lastTs = ts; raf = requestAnimationFrame(loop); return; } } lastTs = ts; raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
  }, [dur, advance, prog]);
  /* الانتقال بين القطاعات: مكعب يدور، ثم يُبدَّل المحتوى بلا قفزة */
  const switching = useRef(false);
  const switchGroup = (d: 1 | -1) => {
    const ni = gi + d; if (ni < 0 || ni >= groups.length || switching.current) return;
    switching.current = true;
    const to = -d * dir * W();
    const done = () => { setGi(ni); setSi(0); x.set(0); switching.current = false; setPaused(false); };
    if (reduce) { done(); return; }
    animate(x, to, { type: 'spring', stiffness: 260, damping: 30, velocity: vel.current.x, onComplete: done });
  };
  /* الإيماءات: نقر / ضغط مطوّل / سحب أفقي / سحب لأسفل */
  const ptr = useRef<{ x0: number; y0: number; t0: number; lock: 'x' | 'y' | null; held: boolean; timer: number; hist: { t: number; x: number; y: number }[] } | null>(null);
  const vel = useRef({ x: 0, y: 0 });
  const onDown = (e: React.PointerEvent) => {
    if (switching.current || (e.target as HTMLElement).closest('button')) return; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const timer = window.setTimeout(() => { if (ptr.current) { ptr.current.held = true; setPaused(true); } }, 220);
    ptr.current = { x0: e.clientX, y0: e.clientY, t0: performance.now(), lock: null, held: false, timer, hist: [{ t: performance.now(), x: e.clientX, y: e.clientY }] };
  };
  const onMove = (e: React.PointerEvent) => {
    const p = ptr.current; if (!p) return; const dx = e.clientX - p.x0, dy = e.clientY - p.y0;
    p.hist.push({ t: performance.now(), x: e.clientX, y: e.clientY }); if (p.hist.length > 6) p.hist.shift();
    if (!p.lock && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) { p.lock = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'; window.clearTimeout(p.timer); setPaused(true); }
    if (p.lock === 'x') { const w = W(); const fwd = dx * -dir; const atEnd = (fwd > 0 && gi >= groups.length - 1) || (fwd < 0 && gi <= 0); x.set(atEnd ? rubber(dx, w, 0.3) : dx); }
    else if (p.lock === 'y') { y.set(Math.max(0, dy)); }
  };
  const onUp = (e: React.PointerEvent) => {
    const p = ptr.current; if (!p) return; ptr.current = null; window.clearTimeout(p.timer);
    const h = p.hist; const a = h[0], b = h[h.length - 1]; const dt = Math.max(1, b.t - a.t); vel.current = { x: ((b.x - a.x) / dt) * 1000, y: ((b.y - a.y) / dt) * 1000 };
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (p.lock === 'x') {
      const off = x.get(); const fwd = off * -dir; const vf = vel.current.x * -dir; const w = W();
      if ((fwd < -w * 0.28 || vf < -520) && gi < groups.length - 1) switchGroup(1);
      else if ((fwd > w * 0.28 || vf > 520) && gi > 0) switchGroup(-1);
      else { animate(x, 0, { type: 'spring', stiffness: 380, damping: 34, velocity: vel.current.x }); setPaused(false); }
      return;
    }
    if (p.lock === 'y') {
      if (y.get() > 120 || vel.current.y > 600) { animate(y, rect.height, { type: 'spring', stiffness: 300, damping: 34, velocity: vel.current.y, onComplete: onClose }); }
      else { animate(y, 0, { type: 'spring', stiffness: 380, damping: 34, velocity: vel.current.y }); setPaused(false); }
      return;
    }
    if (p.held) { setPaused(false); return; }
    const rx = (e.clientX - rect.left) / rect.width; const forward = lang === 'ar' ? rx < 0.7 : rx > 0.3;
    if (forward) advance(); else back();
  };
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); else if (e.key === 'ArrowRight') (lang === 'ar' ? back() : advance()); else if (e.key === 'ArrowLeft') (lang === 'ar' ? advance() : back()); else if (e.key === ' ') { e.preventDefault(); setPaused((v) => !v); } }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [advance, back, lang, onClose]);
  /* تحويلات المكعب من موضع السحب */
  const scale = useTransform(y, [0, 300], [1, 0.9]); const radius = useTransform(y, [0, 60], [wide ? 28 : 0, 28]); const dim = useTransform(y, [0, 300], [1, 0.6]);
  /* المكعب: الحاوية تتراجع نصف العرض ثم تدور، فيبقى الوجه الأمامي في مستواه؛ وبلا سحب لا تحويل ثلاثي الأبعاد أصلاً (دقة اللمس) */
  const rotCur = useTransform(x, (v) => (v === 0 ? 'none' : `translateZ(${-W() / 2}px) rotateY(${((v / W()) * 90).toFixed(2)}deg)`));
  const frontFace = useTransform(x, (v) => (v === 0 ? 'none' : `rotateY(0deg) translateZ(${W() / 2}px)`));
  const nextG = groups[gi + 1], prevG = groups[gi - 1];
  const publisher = personById(state, g.story.publisherId);
  const mayDelete = canDeleteStory(state, me, g.story, slide);
  const face = (angle: number) => ({ transform: `rotateY(${angle}deg) translateZ(${W() / 2}px)` });
  return (
    <Overlay>
      <motion.div className="stv" initial={reduce ? { opacity: 0 } : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
        <motion.div className="stv-dim" style={{ opacity: dim }} onClick={onClose} />
        {/* الفتح: البطاقة تكبر من 92% بنابض (لا تلاشٍ فقط)، والإغلاق يعود بالطريق نفسه */}
        <motion.div className="stv-zoom" initial={reduce ? false : { scale: 0.92, opacity: 0, borderRadius: 28 }} animate={{ scale: 1, opacity: 1, borderRadius: wide ? 28 : 0 }} exit={reduce ? { opacity: 0 } : { scale: 0.96, opacity: 0, borderRadius: 28, transition: { duration: 0.16 } }} transition={{ type: 'spring', stiffness: 380, damping: 34 }}>
        <motion.div className="stv-frame" style={{ y, scale, borderRadius: radius }}>
          <div className="stv-cube" ref={stageRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
            <motion.div className="stv-cube-in" style={{ transform: rotCur }}>
              {prevG && <div className="stv-face side" style={face(-90 * dir)}><FaceStatic g={prevG} lang={lang} /></div>}
              <motion.div className="stv-face" style={{ transform: frontFace }}>
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.div key={slide.id} className={`stv-slide ${slide.media ? 'media' : ''}`} initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, transition: { duration: 0.18 } }} transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}>
                    <SlideMedia slide={slide} playing={!paused} muted={muted} />
                  </motion.div>
                </AnimatePresence>
                <div className="stv-top">
                  <div className="stv-bars">{slides.map((s, i) => <span key={s.id} className="stv-bar"><motion.i style={{ scaleX: i < si ? 1 : i === si ? prog : 0 }} /></span>)}</div>
                  <div className="stv-who">
                    <span className="stv-av" style={{ background: HUE_CSS[g.sector.hue].bg, color: HUE_CSS[g.sector.hue].fg }}>{lang === 'ar' ? g.sector.initials.ar : g.sector.initials.en}</span>
                    <span className="stv-name"><b>{tx(g.sector.name)}</b><span>{shortName(publisher, lang)} · {relTime(slide.at, lang, Date.now())}</span></span>
                    {isVideo ? <button type="button" className="stv-snd" aria-label={muted ? L.sound : L.muteLbl} aria-pressed={!muted} onClick={() => setMuted((m) => !m)}>{muted ? <Ic.mute /> : <Ic.sound />}</button> : null}
                    {mayDelete ? <button type="button" className="stv-snd stv-del" aria-label={L.deleteStory} onClick={(e) => { e.stopPropagation(); setPaused(true); setAskDel(true); }}><I.trash /></button> : null}
                    <button type="button" className="stv-x" aria-label="close" onClick={onClose}><I.x /></button>
                  </div>
                </div>
                <motion.div className="stv-cap" animate={{ opacity: paused && ptr.current?.held ? 0.25 : 1 }} transition={{ duration: 0.2 }}>
                  <b>{tx(slide.caption)}</b>{slide.sub ? <span>{tx(slide.sub)}</span> : null}
                </motion.div>
                {paused && !ptr.current?.held && !askDel ? <span className="stv-paused"><I.clock /></span> : null}
                {/* حذف القصة: تأكيد قصير داخل العارض — الفعل نادر ولا رجعة فيه، فيُقال ذلك بوضوح */}
                <AnimatePresence>{askDel ? (
                  <motion.div className="stv-ask" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
                    <motion.div className="stv-ask-card" initial={reduce ? false : { y: 24, scale: 0.96 }} animate={{ y: 0, scale: 1 }} exit={reduce ? { opacity: 0 } : { y: 16, opacity: 0, transition: { duration: 0.15 } }} transition={{ type: 'spring', stiffness: 380, damping: 32 }}>
                      <span className="stv-ask-ic"><I.trash /></span>
                      <b>{L.deleteStory}</b>
                      <p>{L.deleteStoryAsk}</p>
                      <div className="btn-row">
                        <button type="button" className="btn quiet" onClick={() => { setAskDel(false); setPaused(false); }}>{L.cancelAct}</button>
                        <button type="button" className="btn danger" onClick={() => { dispatch({ type: 'storyDelete', personId: me.id, storyId: g.story.id, slideId: slide.id }); toast({ title: L.deleteStoryDone, sub: tx(g.sector.short), icon: 'x', tone: 'warn' }); setAskDel(false); onClose(); }}><I.trash />{L.delete}</button>
                      </div>
                    </motion.div>
                  </motion.div>
                ) : null}</AnimatePresence>
              </motion.div>
              {nextG && <div className="stv-face side" style={face(90 * dir)}><FaceStatic g={nextG} lang={lang} /></div>}
            </motion.div>
          </div>
        </motion.div>
        </motion.div>
        {wide && (
          <>
            {prevG ? <motion.button type="button" className="stv-peek prev" onClick={() => switchGroup(-1)} aria-label="previous" initial={reduce ? false : { opacity: 0, x: dir * 16 }} animate={{ opacity: 1, x: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 28, delay: 0.12 }} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}><SlideMedia slide={prevG.story.slides[0]} playing={false} grain={false} /><span>{tx(prevG.sector.short)}</span></motion.button> : null}
            {nextG ? <motion.button type="button" className="stv-peek next" onClick={() => switchGroup(1)} aria-label="next" initial={reduce ? false : { opacity: 0, x: -dir * 16 }} animate={{ opacity: 1, x: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 28, delay: 0.12 }} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}><SlideMedia slide={nextG.story.slides[0]} playing={false} grain={false} /><span>{tx(nextG.sector.short)}</span></motion.button> : null}
          </>
        )}
        <p className="stv-hint">{L.storyHint}</p>
      </motion.div>
    </Overlay>
  );
}
function FaceStatic({ g, lang }: { g: StoryGroup; lang: 'ar' | 'en' }) {
  const s = g.story.slides[0];
  return <div className={`stv-slide ${s.media ? 'media' : ''}`}><SlideMedia slide={s} playing={false} grain={false} /><div className="stv-cap"><b>{lang === 'ar' ? s.caption.ar : s.caption.en}</b></div></div>;
}

/* ——— مؤلّف القصة (للناشر): صورة أو فيديو من الجهاز بمعاينة حية هي شاشة العارض نفسها، أو غلاف من الهوية؛ ثم النشر ——— */
const COVER_CHOICES: CoverSpec[] = [{ art: 'gems', hue: 'green' }, { art: 'dunes', hue: 'gold' }, { art: 'bokeh', hue: 'teal' }, { art: 'arch', hue: 'cream' }, { art: 'star', hue: 'night' }, { art: 'waves', hue: 'sage' }];
interface Picked { kind: 'image' | 'video'; blob: Blob; url: string; w: number; h: number; durationMs?: number; size: number; name: string }

export function StoryComposer({ open, onClose, now }: { open: boolean; onClose: () => void; now: number }) {
  const { L, ui } = useUI(); const { state, dispatch } = useStore(); const { lang, tx } = useLang(); const me = usePerson(); const toast = useToast(); const reduce = useReducedMotion();
  const [cover, setCover] = useState(0); const [text, setText] = useState(''); const [sectorId, setSectorId] = useState<string>('');
  const [media, setMedia] = useState<Picked | null>(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null); const [muted, setMuted] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null); const mediaRef = useRef<Picked | null>(null); mediaRef.current = media;
  /* القطاعات التي يجوز للناشر النشر باسمها (بمنصبه من سياسة الأخبار والقصص)؛ إن تعدّدت اختار */
  const mySectors = publishingSectors(state, me); const sector: CommsSector = mySectors.find((x) => x.id === sectorId) || mySectors[0] || { id: '', unitId: '', name: { ar: '', en: '' }, short: { ar: '', en: '' }, initials: { ar: '', en: '' }, hue: 'green', publisherPositionIds: [] };
  const limits = { img: ui.storyImageMaxMB, vid: ui.storyVideoMaxMB, sec: ui.storyVideoMaxSec };
  /* عند الإغلاق يُفرَّغ المؤلّف ويُحرَّر رابط المعاينة */
  useEffect(() => { if (open) return; const m = mediaRef.current; if (m) URL.revokeObjectURL(m.url); setMedia(null); setText(''); setErr(null); setBusy(false); setMuted(true); }, [open]);
  const pick = async (file: File) => {
    setErr(null);
    const isVid = file.type.startsWith('video/'); const isImg = file.type.startsWith('image/');
    if (!isVid && !isImg) { setErr(L.badFile); return; }
    const maxMB = isVid ? limits.vid : limits.img;
    if (file.size > maxMB * 1048576) { setErr(fill(L.tooBig, { max: `${maxMB} MB` })); return; }
    setBusy(true);
    try {
      const prev = mediaRef.current; if (prev) URL.revokeObjectURL(prev.url);
      if (isImg) { const { blob, w, h } = await prepareImage(file); setMedia({ kind: 'image', blob, url: URL.createObjectURL(blob), w, h, size: blob.size, name: file.name }); }
      else { const meta = await readVideoMeta(file); setMedia({ kind: 'video', blob: file, url: URL.createObjectURL(file), ...meta, size: file.size, name: file.name }); if (meta.durationMs > limits.sec * 1000) setErr(fill(L.tooLong, { sec: limits.sec })); }
    } catch { setErr(L.badFile); }
    setBusy(false);
  };
  const remove = () => { const m = mediaRef.current; if (m) URL.revokeObjectURL(m.url); setMedia(null); setErr(null); };
  const publish = async () => {
    if (busy) return; setBusy(true);
    const caption: T2 = { ar: text.trim() || (lang === 'ar' ? 'قصة جديدة' : 'New story'), en: text.trim() || 'New story' };
    let ref: StoryMedia | undefined;
    if (media) {
      const id = `m-${Date.now()}`; const where = await putMedia(id, media.blob);
      ref = { kind: media.kind, id, w: media.w, h: media.h, durationMs: media.durationMs, size: media.size, name: media.name };
      if (where === 'memory') toast({ title: L.storedMemory, icon: 'info', tone: 'info' });
    }
    const slide: StorySlide = { id: `s-me-${Date.now()}`, cover: COVER_CHOICES[cover], caption, at: now, media: ref };
    dispatch({ type: 'storyPublish', publisherId: me.id, sectorId: sector.id, slide });
    toast({ title: L.published, sub: lang === 'ar' ? `باسم «${sector.name.ar}» · ${ui.storyHours} ساعة` : `As “${sector.name.en}” · ${ui.storyHours} h`, icon: 'check', tone: 'ok' });
    setBusy(false); onClose();
  };
  const previewSlide: StorySlide = { id: 'preview', cover: COVER_CHOICES[cover], caption: { ar: text, en: text }, at: now };
  const hue = HUE_CSS[sector.hue];
  return (
    <BottomSheet open={open} onClose={onClose} title={L.addStory} tall lead={<span className="stv-av sm" style={{ background: hue.bg, color: hue.fg }}>{lang === 'ar' ? sector.initials.ar : sector.initials.en}</span>}>
      <div className="lb-sp-grid">
        <div className="lb-sp-wrap">
          <div className={`lb-sp ${media ? media.kind : 'art'}`} aria-label={L.previewNote}>
            <SlideMedia slide={previewSlide} override={media ? { kind: media.kind, url: media.url } : undefined} playing={open} muted={muted} grain={false} />
            <div className="stv-top">
              <div className="stv-bars"><span className="stv-bar"><i style={{ transform: 'scaleX(0.38)' }} /></span></div>
              <div className="stv-who"><span className="stv-av sm" style={{ background: hue.bg, color: hue.fg }}>{lang === 'ar' ? sector.initials.ar : sector.initials.en}</span><span className="stv-name"><b>{tx(sector.short)}</b><span>{shortName(me, lang)} · {L.justNow}</span></span></div>
            </div>
            {media?.kind === 'video' ? <button type="button" className="stv-snd" aria-label={muted ? L.sound : L.muteLbl} aria-pressed={!muted} onClick={() => setMuted((m) => !m)}>{muted ? <Ic.mute /> : <Ic.sound />}</button> : null}
            {media ? <span className="lb-sp-badge">{media.kind === 'video' ? `${L.videoLbl} · ${fmtSec(media.durationMs || 0, lang)}` : L.photoLbl} · {fmtMB(media.size)}</span> : null}
            <div className="stv-cap"><b className={text.trim() ? '' : 'ph'}>{text.trim() || L.captionPh}</b></div>
            <AnimatePresence>{busy ? <motion.span className="lb-sp-busy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>{L.preparing}</motion.span> : null}</AnimatePresence>
          </div>
          <p className="lb-sp-note">{L.previewNote}</p>
        </div>
        <div className="lb-sp-side">
          {mySectors.length > 1 ? <div className="lb-field"><span>{L.asSector}</span><div className="lb-chips">{mySectors.map((x) => <button key={x.id} type="button" className={`pill ${x.id === sector.id ? 'tint' : ''}`} aria-pressed={x.id === sector.id} onClick={() => setSectorId(x.id)}>{tx(x.short)}</button>)}</div></div> : null}
          <div className="lb-sp-actions">
            <input ref={fileRef} type="file" accept="image/*,video/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = ''; }} />
            <motion.button type="button" className="btn secondary" whileTap={{ scale: 0.97 }} onClick={() => fileRef.current?.click()} disabled={busy}><Ic.photo />{media ? L.replaceMedia : L.addMedia}</motion.button>
            {media ? <motion.button type="button" className="btn soft" whileTap={{ scale: 0.97 }} onClick={remove}><Ic.trash />{L.removeMedia}</motion.button> : null}
          </div>
          <p className="lb-sp-limits">{fill(L.mediaLimits, { img: limits.img, vid: limits.vid, sec: limits.sec })}</p>
          <AnimatePresence>{err ? <motion.p className="lb-sp-err" initial={reduce ? false : { opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>{err}</motion.p> : null}</AnimatePresence>
          {!media ? (
            <div className="lb-sp-covers"><span className="lb-sec-h">{L.orCover}</span>
              <div className="lb-covers">{COVER_CHOICES.map((c, i) => <button key={i} type="button" className={`lb-cover-pick ${i === cover ? 'on' : ''}`} onClick={() => setCover(i)} aria-pressed={i === cover}><Cover spec={c} ratio="square" grain={false} /></button>)}</div>
            </div>
          ) : null}
          <label className="lb-field"><span>{L.caption}</span><textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={L.captionPh} maxLength={140} /></label>
          <p className="lb-muted">{lang === 'ar' ? `تُنشر باسم «${sector.name.ar}» وتظهر في الرئيسية لكل الموظفين ${ui.storyHours} ساعة.` : `Published as “${sector.name.en}” and shown on everyone’s home for ${ui.storyHours} hours.`}</p>
          <motion.button type="button" className="btn primary block lg" whileTap={{ scale: 0.97 }} onClick={publish} disabled={busy}><I.send />{L.publish}</motion.button>
        </div>
      </div>
    </BottomSheet>
  );
}
