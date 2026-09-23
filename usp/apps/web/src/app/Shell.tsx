/* The prototype's "Today" shell (app/App.tsx v0.13, D-029), on react-router: sidebar when the app is ≥ 900 wide, desk
   bar with ⌘K search ≥ 1024, and on a phone a glass tab bar that shrinks on scroll with the search island beside it.
   Screens push/pop like iOS; scroll positions come back on return (ScrollRestoration). */
import type React from 'react';
import { Suspense, useEffect, useRef, useState } from 'react';
import { Link, ScrollRestoration, useLocation, useNavigate, useOutlet } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { catalogServices, getModules, getTasks, searchServices, type FeatureStatus, type SessionView } from '@usp/api-client';
import { useI18n } from '@usp/i18n';
import {
  AnimatePresence, Avatar, BottomSheet, EnterCtx, I, IslandProvider, LayoutGroup, MotionConfig, Page, SPRING, SearchField, UIProvider,
  motion, useMotionValueEvent, useReducedMotion, useScrollY, type IconName, type NavDir,
} from '@usp/ui-web';
import emblem from '@usp/ui-web/emblem.png';
import { modules } from './registry';

const MotionLink = motion.create(Link);

/** Depth of a screen: the five tab roots are 0, anything opened from them is 1. */
const TAB_ROOTS = new Set(['', 'inbox', 'services', 'requests', 'me']);
function depthOf(path: string) { const [a = '', b] = path.split('/').filter(Boolean); return TAB_ROOTS.has(a) ? (b ? 1 : 0) : 1; }
function useNavDir(path: string): NavDir {
  const prev = useRef(path); const dir = useRef<NavDir>('tab');
  if (prev.current !== path) { const rp = depthOf(prev.current), rn = depthOf(path); dir.current = rn > rp ? 'push' : rn < rp ? 'pop' : 'tab'; prev.current = path; }
  return dir.current;
}
const section = (path: string) => path.split('/').filter(Boolean)[0] ?? '';
/** Which tab a screen belongs to (new requests under Requests; profile pages under Me). */
function tabOf(path: string) {
  const a = section(path);
  if (a === 'mydata' || a === 'settings' || a === 'me') return 'me';
  if (a === 'documents') return 'requests';
  return a;
}

function Screen() {
  const { pathname } = useLocation(); const outlet = useOutlet(); const dir = useNavDir(pathname); const reduce = useReducedMotion();
  return (
    <div className="screen-host lb-screens">
      <AnimatePresence mode="popLayout" initial={false} custom={reduce ? 'tab' : dir}>
        <Page key={pathname} dir={reduce ? 'tab' : dir}><EnterCtx.Provider value={dir}><Suspense fallback={null}>{outlet}</Suspense></EnterCtx.Provider></Page>
      </AnimatePresence>
    </div>
  );
}

/** Tapping the active tab scrolls its page back to the top (as on iOS). */
function tapActive(e: React.MouseEvent, on: boolean) { if (!on) return; e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }

function useTaskCount() {
  const q = useQuery({ queryKey: ['tasks'], queryFn: getTasks, refetchInterval: 60_000 });
  return q.data?.length ?? 0;
}

function Side() {
  const { t } = useI18n(); const { pathname } = useLocation(); const tasks = useTaskCount(); const cur = tabOf(pathname);
  const item = (key: string, to: string, icon: IconName, label: string, n?: number) => {
    const Ic = I[icon]; const on = cur === key;
    return (
      <MotionLink key={key} className="side-item" to={to} aria-current={on ? 'page' : undefined} whileTap={{ scale: 0.97 }} transition={SPRING.snappy} onClick={(e: React.MouseEvent) => tapActive(e, on && pathname === to)}>
        {on ? <motion.span className="side-pill" layoutId="lb-side-pill" transition={{ type: 'spring', stiffness: 420, damping: 36 }} /> : null}
        <span className="side-ic"><Ic /></span><span className="side-label">{label}</span>{n ? <span className="count num">{n}</span> : null}
      </MotionLink>
    );
  };
  return (
    <LayoutGroup id="lb-side">
      <aside className="lb-side">
        <div className="brand"><img className="brand-emblem" src={emblem} alt="" /><div><b>{t('common.appName')}</b><span>{t('common.org')}</span></div></div>
        {item('', '/', 'home', t('tabs.home'))}
        {item('inbox', '/inbox', 'inbox', t('tabs.inbox'), tasks)}
        {item('services', '/services', 'grid', t('tabs.services'))}
        {item('requests', '/requests', 'doc', t('tabs.requests'))}
        {item('me', '/me', 'person', t('tabs.me'))}
        {item('notifications', '/notifications', 'bell', t('common.notifications'))}
        <div className="side-spacer" />
        <div className="side-orn" />
      </aside>
    </LayoutGroup>
  );
}

function DeskBar({ onSearch, session }: { onSearch: () => void; session: SessionView }) {
  const { t, text } = useI18n(); const navigate = useNavigate();
  useEffect(() => { const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); onSearch(); } }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onSearch]);
  const name = text(session.name) || session.username;
  return (
    <div className="lb-deskbar">
      <button type="button" className="search lb-deskq" onClick={onSearch}><I.search /><span className="lb-deskq-ph">{t('search.placeholder')}</span><span className="kbd" aria-hidden="true"><bdi>⌘K</bdi></span></button>
      <span className="spacer" />
      <motion.button type="button" className="icon-btn" onClick={() => navigate('/notifications')} aria-label={t('common.notifications')} whileTap={{ scale: 0.9 }}><I.bell /></motion.button>
      <motion.button type="button" className="user" onClick={() => navigate('/me')} whileTap={{ scale: 0.97 }}><Avatar name={name} size="sm" /><span style={{ textAlign: 'start' }}><b>{name}</b><span className="num">{session.employeeNo ?? session.username}</span></span></motion.button>
    </div>
  );
}

function TabBar({ onSearch }: { onSearch: () => void }) {
  const { t } = useI18n(); const { pathname } = useLocation(); const tasks = useTaskCount(); const cur = tabOf(pathname);
  const items: { key: string; label: string; icon: IconName; to: string; n?: number }[] = [
    { key: '', label: t('tabs.home'), icon: 'home', to: '/' }, { key: 'inbox', label: t('tabs.inbox'), icon: 'inbox', to: '/inbox', n: tasks },
    { key: 'services', label: t('tabs.services'), icon: 'grid', to: '/services' }, { key: 'requests', label: t('tabs.requests'), icon: 'doc', to: '/requests' },
    { key: 'me', label: t('tabs.me'), icon: 'person', to: '/me' },
  ];
  /* iOS 26: the bar shrinks while scrolling down and comes back on the way up. */
  const scrollY = useScrollY(); const [mini, setMini] = useState(false); const last = useRef(0); const routeAt = useRef(0);
  useMotionValueEvent(scrollY, 'change', (v) => { const d = v - last.current; last.current = v; if (performance.now() - routeAt.current < 500) return; if (v < 80) setMini(false); else if (d > 8) setMini(true); else if (d < -8) setMini(false); });
  useEffect(() => { setMini(false); routeAt.current = performance.now(); }, [pathname]);
  return (
    <LayoutGroup id="lb-tabs">
      <div className={`lb-tabs ${mini ? 'mini' : ''}`}>
        <motion.nav className="lb-tabbar" aria-label="main" animate={{ scale: mini ? 0.9 : 1, y: mini ? 10 : 0 }} transition={SPRING.soft}>
          {items.map((it) => { const Ic = I[it.icon]; const on = cur === it.key; return (
            <MotionLink key={it.key} className="tab" to={it.to} aria-current={on ? 'page' : undefined} whileTap={{ scale: 0.92 }} transition={SPRING.snappy} onClick={(e: React.MouseEvent) => tapActive(e, on && depthOf(pathname) === 0)}>
              {on ? <motion.span className="tab-pill" layoutId="lb-tab-pill" transition={{ type: 'spring', stiffness: 500, damping: 38 }} /> : null}
              <motion.span className="tab-ic" animate={on ? 'on' : 'off'} variants={{ on: { scale: [1, 1.22, 1], y: [0, -3, 0], transition: { duration: 0.42, times: [0, 0.4, 1] } }, off: { scale: 1, y: 0 } }}><Ic /></motion.span>
              <span className="tab-label">{it.label}</span>
              {it.n ? <motion.span className="badge num" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={SPRING.bouncy}>{it.n}</motion.span> : null}
            </MotionLink>
          ); })}
        </motion.nav>
        <motion.button type="button" className="lb-island" onClick={onSearch} aria-label={t('search.island')} whileTap={{ scale: 0.9 }} animate={{ scale: mini ? 0.9 : 1, y: mini ? 10 : 0 }} transition={SPRING.soft}><I.search /></motion.button>
      </div>
    </LayoutGroup>
  );
}

/** The search island: services of the catalogue; an available one opens its page, others their domain. */
function SearchSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, text } = useI18n(); const navigate = useNavigate(); const [q, setQ] = useState('');
  const catalog = useQuery({ queryKey: ['modules'], queryFn: getModules, enabled: open, staleTime: 300_000 });
  useEffect(() => { if (!open) setQ(''); }, [open]);
  const services = catalogServices(catalog.data ?? []); const n = q.trim();
  const hits = searchServices(catalog.data ?? [], q);
  const codedPath = (serviceId: string) => modules.flatMap((m) => m.routes).find((r) => r.serviceId === serviceId)?.path;
  const go = (serviceId: string, available: boolean) => { onClose(); navigate(available ? codedPath(serviceId) ?? `/services/${serviceId}` : '/services'); };
  const statusText = (s: FeatureStatus) => s === 'AVAILABLE' ? t('services.available') : s === 'LATER' ? t('services.later') : `${t('services.soon')} · ${t('services.wave')} ${s === 'WAVE_2' ? 2 : 3}`;
  return (
    <BottomSheet open={open} onClose={onClose} title={t('search.island')} tall>
      <SearchField id="uspq" value={q} onChange={setQ} placeholder={t('search.placeholder')} autoFocus />
      <div className="lb-hits">
        {!n ? <p className="lb-muted">{t('search.hint', { n: services.length })}</p> : hits.length === 0 ? <p className="lb-muted">{t('search.noHits')}</p> : hits.map((s) => (
          <button key={s.key} type="button" className="cell" onClick={() => go(s.serviceId, s.status === 'AVAILABLE')}>
            <span className={`cell-lead ${s.status === 'AVAILABLE' ? '' : 'plain'}`}><I.grid /></span>
            <span className="cell-main"><span className="cell-title">{text(s.name)}</span><span className="cell-sub">{statusText(s.status)}</span></span>
            <I.chev className="chev dirchev" />
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}

/** The signed-in frame around every screen except sign-in and public verification. */
export function Shell({ session }: { session: SessionView }) {
  const { text } = useI18n(); const [search, setSearch] = useState(false); const openSearch = () => setSearch(true);
  return (
    <MotionConfig reducedMotion="user">
      <UIProvider person={text(session.name) || session.username}>
        {({ wide, desk, rootRef }) => (
          <div className="app-stage">
            <div className="app-device">
              <div className="app-root" ref={rootRef} data-wide={wide || undefined} data-desk={desk || undefined}>
                <IslandProvider>
                  <div className="lb-shell">
                    {wide ? <Side /> : null}
                    <main className="lb-main">
                      {desk ? <DeskBar onSearch={openSearch} session={session} /> : null}
                      <Screen />
                    </main>
                  </div>
                  {!wide ? <TabBar onSearch={openSearch} /> : null}
                  <div id="app-overlays" />
                  <SearchSheet open={search} onClose={() => setSearch(false)} />
                </IslandProvider>
              </div>
            </div>
            <ScrollRestoration />
          </div>
        )}
      </UIProvider>
    </MotionConfig>
  );
}
