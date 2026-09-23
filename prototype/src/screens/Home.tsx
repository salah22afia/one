/* الرئيسية الجديدة «اليوم»: الرأس الأخضر يحمل التحية والتاريخين والحدث القادم وشريط القصص، ثم بطاقة «يحتاجك» متراكبة، ثم مرسى الخدمات، ثم الأخبار والتعاميم، ثم «لي». */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useTransform, useMotionValue, useSpring, useReducedMotion } from 'motion/react';
import { useStore } from '../app/store';
import { nav } from '../app/router';
import { I } from '../ui/icons';
import { Avatar, useLang, useNow, usePerson } from '../ui/components';
import { notificationsFor } from '../domain/engine';
import { fmtDate, daysUntil, fill } from '../app/i18n';
import { HeroArt } from '../ui/HeroArt';
import { Mark } from '../ui/Page';
import type { Post } from '../domain/types';
import { useUI, useScrollY, hijri, useIntroSkip } from '../app/ui';
import { livePosts } from '../domain/comms';
import { StoriesRail, StoryViewer, StoryComposer, useStoryGroups } from './Stories';
import { NewsSection, ReaderSheet } from './News';
import { PostComposer } from './PostComposer';
import { FocusCard } from './Focus';
import { MineSection } from './Widgets';

const DOCK = [
  { id: 'TM-01', icon: I.leave, g: 'g-green', label: { ar: 'إجازة', en: 'Leave' }, href: '#/new/TM-01' },
  { id: 'DC-01', icon: I.letter, g: 'g-gold', label: { ar: 'خطاب', en: 'Letter' }, href: '#/new/DC-01' },
  { id: 'AS-01', icon: I.box, g: 'g-bronze', label: { ar: 'أحتاج شيئاً', en: 'I need' }, href: '#/new/AS-01' },
  { id: 'FN-01', icon: I.plane, g: 'g-teal', label: { ar: 'انتداب', en: 'Trip' }, href: '#/new/FN-01' },
];

export function Home({ onSearch, openPostId }: { onSearch: () => void; openPostId?: string }) {
  const { state } = useStore(); const { lang, t, tx } = useLang(); const me = usePerson(); const now = useNow(); const { L, desk, wide } = useUI(); const reduce = useReducedMotion(); const skip = useIntroSkip();
  const unread = notificationsFor(state, me).filter((n) => !n.read).length;
  const hour = new Date(now).getHours(); const greet = hour < 12 ? t.greeting.morning : hour < 17 ? t.greeting.afternoon : t.greeting.evening;
  const firstName = (lang === 'ar' ? me.name : me.nameEn).split(' ')[0];
  const postsList = useMemo(() => livePosts(state).sort((a, b) => b.at - a.at), [state.posts]); // eslint-disable-line react-hooks/exhaustive-deps
  const cal = useMemo(() => state.calendar.filter((c) => c.at >= now).sort((a, b) => a.at - b.at), [state.calendar, now]);
  const nextEv = cal[0]; const nd = nextEv ? daysUntil(nextEv.at, now) : 0;
  const when = nextEv ? (nd <= 0 ? L.today : nd === 1 ? L.tomorrow : fill(nd <= 10 ? L.inDays : L.inDaysMany, { n: nd })) : '';
  const groups = useStoryGroups(now);
  const [viewer, setViewer] = useState<{ groups: typeof groups; start: number } | null>(null); const [reader, setReader] = useState<Post | null>(null); const [compose, setCompose] = useState(false); const [writing, setWriting] = useState(false);
  /* رابط التنبيه #/home/post/<id> يفتح القارئ على المنشور مباشرة (تعميم يطلب تأكيدك) */
  useEffect(() => { if (!openPostId) return; const p = livePosts(state).find((x) => x.id === openPostId); if (p) setReader(p); }, [openPostId]); // eslint-disable-line react-hooks/exhaustive-deps
  /* الرأس يتنفس مع التمرير (على الهاتف): التحية تصعد وتخفت، والزخرفة أبطأ، وشريط زجاجي يظهر مكانها */
  const scrollY = useScrollY();
  const greetY = useTransform(scrollY, [0, 160], [0, wide ? 0 : -18]); const greetO = useTransform(scrollY, [0, 110], [1, wide ? 1 : 0]);
  const artY = useTransform(scrollY, [0, 400], [0, wide ? 30 : 60]); const barO = useTransform(scrollY, [100, 150], [0, 1]); const barY = useTransform(scrollY, [100, 150], [-8, 0]);
  const barPE = useTransform(barO, (v) => (v > 0.6 ? 'auto' : 'none'));
  const mx = useMotionValue(0), my = useMotionValue(0); const px = useSpring(mx, { stiffness: 60, damping: 20 }), py = useSpring(my, { stiffness: 60, damping: 20 }); const artRot = useTransform(py, (v) => v * 0.08);
  const heroRef = useRef<HTMLElement>(null);
  const onMove = (e: React.PointerEvent) => { if (!wide || reduce || e.pointerType === 'touch' || !heroRef.current) return; const b = heroRef.current.getBoundingClientRect(); mx.set(((e.clientX - b.left) / b.width - 0.5) * 18); my.set(((e.clientY - b.top) / b.height - 0.5) * 12); };
  const onLeave = () => { mx.set(0); my.set(0); };
  const dockItems = [...DOCK, { id: 'all', icon: I.grid, g: 'g-all', label: { ar: 'الخدمات', en: 'Services' }, href: '#/services' }];
  return (
    <div className="lb-home">
      {!wide && (
        <motion.div className="lb-topbar" style={{ opacity: barO, y: barY, pointerEvents: barPE }} aria-hidden="true">
          <button type="button" className="icon-btn lp-me" tabIndex={-1} onClick={() => nav('#/me')}><Avatar p={me} size="sm" /></button><b>{firstName}</b><span className="spacer" /><button type="button" className="icon-btn" tabIndex={-1} onClick={() => nav('#/notifications')}><I.bell />{unread ? <span className="dot" /> : null}</button>
        </motion.div>
      )}
      <section className="lb-hero" data-daypart={hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'} ref={heroRef} onPointerMove={onMove} onPointerLeave={onLeave}>
        <motion.div className="hero-art-wrap" style={{ y: artY, x: px, rotateZ: artRot }}><HeroArt /></motion.div>
        <div className="lb-hero-top">
          <motion.button type="button" className="icon-btn" onClick={() => nav('#/me')} aria-label={t.tabs.me} whileTap={{ scale: 0.9 }}><Avatar p={me} size="sm" /></motion.button>
          <span className="spacer" /><Mark className="lb-hero-mark" /><span className="spacer" />
          <motion.button type="button" className="icon-btn" onClick={() => nav('#/notifications')} aria-label={t.nav.notifications} whileTap={{ scale: 0.9 }}><motion.span animate={unread && !reduce ? { rotate: [0, -14, 11, -7, 4, 0] } : { rotate: 0 }} transition={{ duration: 0.7, delay: 1.1, ease: 'easeInOut' }} style={{ display: 'inline-flex', transformOrigin: '50% 10%' }}><I.bell /></motion.span>{unread ? <motion.span className="dot" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.6, type: 'spring', stiffness: 400, damping: 18 }} /> : null}</motion.button>
        </div>
        <motion.div className="lb-hero-text" style={{ y: greetY, opacity: greetO }}>
          <motion.div className="lb-greet" initial={skip ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 28, delay: 0.05 }}>{greet}، {firstName}</motion.div>
          <motion.div className="lb-date" initial={skip ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 28, delay: 0.14 }}>
            <span>{fmtDate(now, lang, { weekday: 'long', day: 'numeric', month: 'long' })}</span><span className="lb-date-sep">·</span><span className="num">{hijri(now, lang)}</span>
          </motion.div>
          {nextEv && (
            <motion.button type="button" className="lb-next" initial={skip ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 28, delay: 0.22 }} whileTap={{ scale: 0.96 }} onClick={() => { const p = postsList.find((x) => x.kind === 'event' && x.eventAt && Math.abs(x.eventAt - nextEv.at) < 86400000 * 2); if (p) setReader(p); }}>
              <I.calendar /><span><b>{tx(nextEv.title)}</b> · {when}{nextEv.sub ? ` · ${tx(nextEv.sub)}` : ''}</span>
            </motion.button>
          )}
        </motion.div>
        <div className="lb-stories"><StoriesRail now={now} onOpen={(i) => setViewer({ groups, start: i })} onCompose={() => setCompose(true)} /></div>
      </section>

      <div className="lb-overlap"><FocusCard now={now} posts={postsList} openPost={(p) => setReader(p)} /></div>

      <nav className="lb-dock" aria-label={L.dock}>
        {dockItems.map((q, i) => { const Ic = q.icon; return (
          <motion.a key={q.id} href={q.href} className="lb-dock-it" whileTap={{ scale: 0.9 }} initial={skip ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 28, delay: 0.25 + i * 0.04 }}>
            <span className={`qicon ${q.g}`}><Ic /></span><span className="lb-dock-l">{tx(q.label)}</span>
          </motion.a>
        ); })}
      </nav>

      <NewsSection list={postsList} onOpen={(p) => setReader(p)} onCompose={() => setWriting(true)} />
      <MineSection now={now} />
      <p className="lb-demo">{L.demo}</p>

      <AnimatePresence>{viewer ? <StoryViewer key="stv" groups={viewer.groups} start={viewer.start} onClose={() => setViewer(null)} /> : null}</AnimatePresence>
      <ReaderSheet post={reader} onClose={() => setReader(null)} now={now} />
      <StoryComposer open={compose} onClose={() => setCompose(false)} now={now} />
      <PostComposer open={writing} onClose={() => setWriting(false)} now={now} />
    </div>
  );
}
