/* هيكل البوابة v0.13 «اليوم» (كان مختبر التصميم 0.1→0.4، اعتمده عمر في 20 سبتمبر 2026، D-029): يُبنى بحاوية (لا نافذة) حتى يُعرض الهاتف في إطار على الحاسوب —
   شريط جانبي على العرض الواسع، وشريط ألسنة زجاجي يتصاغر عند التمرير وبجانبه جزيرة بحث على الهاتف (iOS 26)، وانتقالات دفع/رجوع تحفظ موضع كل شاشة. */
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MotionConfig, LayoutGroup, AnimatePresence, motion, useMotionValueEvent, useReducedMotion } from 'motion/react';
import { StoreProvider, useStore } from './store';
import { useRoute, nav, type NavDir, type Route } from './router';
import { I } from '../ui/icons';
import { useLang, usePerson, Avatar, Empty } from '../ui/components';
import { IslandProvider, SPRING, Page } from '../ui/motion';
import { tasksFor, policyTasksFor, notificationsFor } from '../domain/engine';
import { desksFor } from '../domain/need';
import emblem from '../assets/emblem.png';
import { UIProvider, useUI, useScrollY, scrollTop, EnterCtx } from './ui';
import { Home } from '../screens/Home';
import { SearchSheet } from '../ui/SearchSheet';
import { Inbox } from '../screens/Inbox';
import { Requests, RequestPage } from '../screens/Requests';
import { Services } from '../screens/Services';
import { Me, Docs, MyData, Balances, Pay, Family, Settings, Leaves, CustodyPage } from '../screens/Me';
import { Notifications } from '../screens/Notifications';
import { NewLeave } from '../screens/NewLeave';
import { NewNeed } from '../screens/NewNeed';
import { NewRequest } from '../screens/NewRequest';
import { PolicyCenter } from '../screens/PolicyCenter';
import { NeedPolicyCenter } from '../screens/NeedPolicyCenter';
import { ProcurementDesk, StoreDesk } from '../screens/Desks';
import { Design } from '../screens/Design';
import { CommsPolicyCenter } from '../screens/CommsPolicyCenter';
import { DesignerCenter } from '../screens/DesignerCenter';
import { ServiceDesigner } from '../screens/ServiceDesigner';
import { ConfiguredRequest } from '../screens/ConfiguredRequest';
import { AdminCenter } from '../screens/AdminCenter';
import { adminOverview } from '../domain/admin';
import { TenantsCenter } from '../screens/TenantsCenter';
import { ContractsCenter } from '../screens/ContractsCenter';
import { RegistersCenter } from '../screens/Registers';
import { configuredById } from '../domain/designer';

function Placeholder({ title }: { title: string }) {
  const { L } = useUI();
  return (
    <div className="lb-page lb-ph">
      <div className="lb-ph-top"><button type="button" className="back-btn" onClick={() => nav('#/home')}><I.chev className="backchev" />{L.backHome}</button></div>
      <h1 className="lb-ph-title">{title}</h1>
      <Empty icon="sparkle" title={L.placeholder} sub={L.placeholderSub} />
    </div>
  );
}

/** عمق الشاشة: الألسنة الخمسة 0، وكل ما يُفتح منها 1 — بما فيه صفحات «ملفي» (بياناتي، والمحفظة…) التي صارت صفحات مدفوعة لا أقساماً */
const TAB_ROOTS = new Set(['', 'home', 'inbox', 'services', 'requests', 'me']);
function depthOf(parts: string[]) { const [a, b] = parts; if (!a || a === 'home') return 0; return TAB_ROOTS.has(a) ? (b ? 1 : 0) : 1; }
function useNavDir(r: Route): NavDir {
  const prev = useRef(r.key); const dir = useRef<NavDir>(r.dir);
  if (prev.current !== r.key) { const rp = depthOf(prev.current.split('/').filter(Boolean)), rn = depthOf(r.parts); dir.current = rn > rp ? 'push' : rn < rp ? 'pop' : r.dir; prev.current = r.key; }
  return dir.current;
}
function pick(r: Route, onSearch: () => void, state: ReturnType<typeof useStore>['state']): React.ReactNode {
  const [a, b] = r.parts;
  if (!a || a === 'home') return <Home onSearch={onSearch} openPostId={b === 'post' ? r.parts[2] : undefined} />;
  if (a === 'inbox') return <Inbox />;
  if (a === 'services') return b === 'q' ? <Services initialQuery={decodeURIComponent(r.parts[2] || '')} /> : <Services domainId={b} />;
  if (a === 'requests') return b ? <RequestPage id={b} /> : <Requests />;
  if (a === 'notifications') return <Notifications />;
  if (a === 'me') {
    if (b === 'docs') return <Docs />; if (b === 'data') return <MyData />; if (b === 'balances') return <Balances />; if (b === 'pay') return <Pay />; if (b === 'family') return <Family />; if (b === 'settings') return <Settings />;
    if (b === 'leaves') return <Official><Leaves /></Official>; if (b === 'custody') return <Official><CustodyPage /></Official>;
    return <Me />;
  }
  /* v0.15: الخدمة المهيّأة (من المصمّم) تُفتح بنموذجها المولَّد؛ والمبنيّة بشاشتها */
  if (a === 'new') return <Official>{b === 'TM-01' ? <NewLeave /> : b === 'AS-01' ? <NewNeed /> : configuredById(state, b) ? <ConfiguredRequest serviceId={b} renewOf={r.parts[2] === 'renew' ? r.parts[3] : undefined} /> : <NewRequest serviceId={b} />}</Official>;
  if (a === 'resubmit') { const orig = state.requests.find((x) => x.id === b); return <Official>{orig?.configured ? <ConfiguredRequest resubmitId={b} /> : <NewRequest resubmitId={b} />}</Official>; }
  if (a === 'desk') return <Official>{b === 'store' ? <StoreDesk /> : <ProcurementDesk />}</Official>;
  /* v0.18: مركز الإدارة صفحة واحدة (#/admin) وكل شاشة إدارة تحته؛ #/admin/policy/<tab> يفتح لساناً بعينه (الهيكل، التشغيل) */
  if (a === 'admin') return <Official>{!b ? <AdminCenter /> : b === 'need' ? <NeedPolicyCenter /> : b === 'comms' ? <CommsPolicyCenter /> : b === 'designer' ? (r.parts[2] === 'svc' && r.parts[3] ? <ServiceDesigner id={r.parts[3]} /> : <DesignerCenter />) : b === 'tenants' ? <TenantsCenter /> : b === 'contracts' ? <ContractsCenter /> : b === 'registers' ? <RegistersCenter id={r.parts[2]} /> : <PolicyCenter initialTab={r.parts[2]} />}</Official>;
  if (a === 'design') return <Official><Design /></Official>;
  return <Placeholder title={a} />;
}
/** الشاشات: الرئيسية والألسنة الأربعة والتنبيهات والملف وفروعه بتصميم «اليوم»؛ والنماذج والإدارة والمكاتب تحمل رأسها الخاص داخل الإطار نفسه.
    الانتقال كما في البوابة الرسمية (iOS): الأعمق يُدفع من جهة النهاية، والرجوع يعود إلى الخلف، وتبديل اللسان تلاشٍ خفيف — والحركة المخفَّضة تلاشٍ فقط. */
function Screen({ onSearch }: { onSearch: () => void }) {
  const r = useRoute(); const { scroller } = useUI(); const dir = useNavDir(r); const reduce = useReducedMotion(); const { state } = useStore();
  /* موضع التمرير يُحفظ لكل شاشة ويُستعاد عند الرجوع إليها (كما يفعل iOS)، وما عدا الرجوع يبدأ من الأعلى */
  const pos = useRef<Record<string, number>>({}); const cur = useRef(r.key); const frozen = useRef(0);
  useEffect(() => {
    const s = scroller(); const read = () => (s instanceof Window ? s.scrollY : s.scrollTop);
    /* يُسجَّل الموضع مع كل تمرير حقيقي؛ وتُهمل قفزات الموجّه إلى الأعلى وقفزة الاستعادة (خلال لحظة تغيّر المسار) حتى لا تمحو الموضع المحفوظ */
    const onScroll = () => { if (performance.now() - frozen.current < 200) return; pos.current[cur.current] = read(); };
    const onHash = () => { frozen.current = performance.now(); };
    s.addEventListener('scroll', onScroll, { passive: true }); window.addEventListener('hashchange', onHash, true);
    return () => { s.removeEventListener('scroll', onScroll); window.removeEventListener('hashchange', onHash, true); };
  }, [scroller]);
  useLayoutEffect(() => {
    const s = scroller(); const y = dir === 'pop' ? pos.current[r.key] || 0 : 0; cur.current = r.key; frozen.current = performance.now();
    const rd = () => (s instanceof Window ? s.scrollY : s.scrollTop); const set = (v: number) => { if (s instanceof Window) s.scrollTo({ top: v }); else s.scrollTop = v; };
    set(y);
    /* الموجّه الرسمي يعيد النافذة إلى الأعلى بعد تغيّر المسار مباشرة، فيُعاد تثبيت الموضع في الإطار التالي (قبل الرسم) وبعد المهمة الحالية */
    if (y > 0) { const fix = () => { if (Math.abs(rd() - y) > 1) set(y); }; requestAnimationFrame(fix); window.setTimeout(fix, 0); }
  }, [r.key, scroller]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="screen-host lb-screens">
      <AnimatePresence mode="popLayout" initial={false} custom={reduce ? 'tab' : dir}>
        <Page key={r.key} dir={reduce ? 'tab' : dir}><EnterCtx.Provider value={dir}>{pick(r, onSearch, state)}</EnterCtx.Provider></Page>
      </AnimatePresence>
    </div>
  );
}
/** الشاشة الرسمية داخل الهيكل: تحتفظ برأسها وبأسلوبها، وتنال الشريط الزجاجي وإطار الهاتف من الهيكل */
function Official({ children }: { children: React.ReactNode }) { return <div className="lb-official">{children}</div>; }

function Side() {
  const { state } = useStore(); const { t } = useLang(); const me = usePerson(); const r = useRoute(); const { L } = useUI(); const tapActive = useTapActive();
  const tasks = tasksFor(state, me).length + policyTasksFor(state, me).length; const unread = notificationsFor(state, me).filter((n) => !n.read).length; const desks = desksFor(state, me);
  const cur = r.parts[0] || 'home'; const sub = r.parts[1] || '';
  const adminFocus = me.persona === 'admin' ? adminOverview(state).focus.length : 0;
  const item = (key: string, href: string, icon: keyof typeof I, label: string, n?: number, on = cur === key) => { const Ic = I[icon]; return (
    <motion.a key={key} className="side-item" href={href} aria-current={on ? 'page' : undefined} whileTap={{ scale: 0.97 }} transition={SPRING.snappy} onClick={(e) => tapActive(e, on && r.key === href.slice(1))}>
      {on ? <motion.span className="side-pill" layoutId="lb-side-pill" transition={{ type: 'spring', stiffness: 420, damping: 36 }} /> : null}
      <span className="side-ic"><Ic /></span><span className="side-label">{label}</span>{n ? <span className="count num">{n}</span> : null}
    </motion.a>
  ); };
  return (
    <LayoutGroup id="lb-side">
      <aside className="lb-side">
        <div className="brand"><img className="brand-emblem" src={emblem} alt="" /><div><b>{t.appName}</b><span>{t.org}</span></div></div>
        {item('home', '#/home', 'home', t.tabs.home, undefined, cur === 'home' || cur === '')}
        {item('inbox', '#/inbox', 'inbox', t.tabs.inbox, tasks)}
        {item('services', '#/services', 'grid', t.tabs.services)}
        {item('requests', '#/requests', 'doc', t.tabs.requests)}
        {item('me', '#/me', 'person', t.tabs.me)}
        {item('notifications', '#/notifications', 'bell', t.nav.notifications, unread)}
        {desks.procurement ? item('desk-p', '#/desk/procurement', 'wallet', t.need.desk.proc, desks.procurementCount, cur === 'desk' && sub !== 'store') : null}
        {desks.store ? item('desk-s', '#/desk/store', 'box', t.need.desk.store, desks.storeCount, cur === 'desk' && sub === 'store') : null}
        {/* v0.18: مدخل واحد «الإدارة» بدل أربعة، وعدّاده ما يحتاج مدير النظام الآن */}
        {me.persona === 'admin' ? item('admin', '#/admin', 'shield', L.admin.title, adminFocus, cur === 'admin') : null}
        <div className="side-spacer" />
        {item('design', '#/design', 'sparkle', t.nav.design, undefined, cur === 'design')}
        <div className="side-orn" />
        <div className="side-foot">{t.home.demo}</div>
      </aside>
    </LayoutGroup>
  );
}

function DeskBar({ onSearch }: { onSearch: () => void }) {
  const { state } = useStore(); const { lang, t } = useLang(); const me = usePerson(); const { L } = useUI();
  const unread = notificationsFor(state, me).filter((n) => !n.read).length;
  useEffect(() => { const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); onSearch(); } }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onSearch]);
  return (
    <div className="lb-deskbar">
      <button type="button" className="search lb-deskq" onClick={onSearch}><I.search /><span className="lb-deskq-ph">{L.searchPh}</span><span className="kbd" aria-hidden="true"><bdi>⌘K</bdi></span></button>
      <span className="spacer" />
      <motion.button type="button" className="icon-btn" onClick={() => nav('#/notifications')} aria-label={t.nav.notifications} whileTap={{ scale: 0.9 }}><motion.span animate={unread ? { rotate: [0, -14, 11, -7, 4, 0] } : { rotate: 0 }} transition={{ duration: 0.7, delay: 1.2, ease: 'easeInOut' }} style={{ display: 'inline-flex', transformOrigin: '50% 10%' }}><I.bell /></motion.span>{unread ? <span className="dot" style={{ boxShadow: '0 0 0 2px var(--bg-elev)' }} /> : null}</motion.button>
      <motion.button type="button" className="user" onClick={() => nav('#/me')} whileTap={{ scale: 0.97 }}><Avatar p={me} size="sm" /><span style={{ textAlign: 'start' }}><b>{lang === 'ar' ? me.name : me.nameEn}</b><span>{lang === 'ar' ? me.title : me.titleEn}</span></span></motion.button>
    </div>
  );
}

/** النقر على اللسان النشط يعيد صفحته إلى الأعلى (كما في iOS) */
function useTapActive() {
  const { scroller } = useUI();
  return (e: React.MouseEvent, on: boolean) => { if (!on) return; e.preventDefault(); const s = scroller(); if (s instanceof Window) s.scrollTo({ top: 0, behavior: 'smooth' }); else s.scrollTo({ top: 0, behavior: 'smooth' }); };
}
function TabBar({ onSearch }: { onSearch: () => void }) {
  const { state } = useStore(); const { t } = useLang(); const me = usePerson(); const r = useRoute(); const { L } = useUI(); const tapActive = useTapActive();
  const tasks = tasksFor(state, me).length + policyTasksFor(state, me).length; const cur = r.parts[0] || 'home';
  const items: { key: string; label: string; icon: keyof typeof I; href: string; n?: number }[] = [
    { key: 'home', label: t.tabs.home, icon: 'home', href: '#/home' }, { key: 'inbox', label: t.tabs.inbox, icon: 'inbox', href: '#/inbox', n: tasks }, { key: 'services', label: t.tabs.services, icon: 'grid', href: '#/services' }, { key: 'requests', label: t.tabs.requests, icon: 'doc', href: '#/requests' }, { key: 'me', label: t.tabs.me, icon: 'person', href: '#/me' },
  ];
  const isCur = (k: string) => (k === 'home' ? cur === 'home' || cur === '' : k === 'requests' ? cur === 'requests' || cur === 'new' : k === 'me' ? cur === 'me' || cur === 'admin' || cur === 'desk' : cur === k);
  /* iOS 26: الشريط يتصاغر عند التمرير إلى الأسفل ويعود عند الصعود */
  const scrollY = useScrollY(); const [mini, setMini] = useState(false); const last = useRef(0); const routeAt = useRef(0);
  useMotionValueEvent(scrollY, 'change', (v) => { const d = v - last.current; last.current = v; if (performance.now() - routeAt.current < 500) return; /* قفزة استعادة الموضع بعد الرجوع ليست تمريراً */ if (v < 80) setMini(false); else if (d > 8) setMini(true); else if (d < -8) setMini(false); });
  useEffect(() => { setMini(false); routeAt.current = performance.now(); }, [r.key]);
  return (
    <LayoutGroup id="lb-tabs">
      <div className={`lb-tabs ${mini ? 'mini' : ''}`}>
        <motion.nav className="lb-tabbar" aria-label="main" animate={{ scale: mini ? 0.9 : 1, y: mini ? 10 : 0 }} transition={SPRING.soft}>
          {items.map((it) => { const Ic = I[it.icon]; const on = isCur(it.key); return (
            <motion.a key={it.key} className="tab" href={it.href} aria-current={on ? 'page' : undefined} whileTap={{ scale: 0.92 }} transition={SPRING.snappy} onClick={(e) => tapActive(e, on && r.parts.length <= 1)}>
              {on ? <motion.span className="tab-pill" layoutId="lb-tab-pill" transition={{ type: 'spring', stiffness: 500, damping: 38 }} /> : null}
              <motion.span className="tab-ic" animate={on ? 'on' : 'off'} variants={{ on: { scale: [1, 1.22, 1], y: [0, -3, 0], transition: { duration: 0.42, times: [0, 0.4, 1] } }, off: { scale: 1, y: 0 } }}><Ic /></motion.span>
              <span className="tab-label">{it.label}</span>
              {it.n ? <motion.span className="badge num" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={SPRING.bouncy}>{it.n}</motion.span> : null}
            </motion.a>
          ); })}
        </motion.nav>
        <motion.button type="button" className="lb-island" onClick={onSearch} aria-label={L.searchIsland} whileTap={{ scale: 0.9 }} animate={{ scale: mini ? 0.9 : 1, y: mini ? 10 : 0 }} transition={SPRING.soft}><I.search /></motion.button>
      </div>
    </LayoutGroup>
  );
}

function Shell() {
  const { wide, desk, framed, rootRef, L } = useUI(); const { state } = useStore();
  const [sheet, setSheet] = useState<'' | 'search'>('');
  const openSearch = () => setSheet('search');
  const dark = state.settings.theme === 'dark' || (state.settings.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  return (
    <div className={`app-stage ${framed ? 'framed' : ''}`} data-dark={dark || undefined}>
      {framed ? <div className="app-device-cap"><span className="num">390 × 844</span> · {L.phoneFrame}</div> : null}
      <div className={`app-device ${framed ? 'on' : ''}`}>
        {framed ? <span className="app-notch" aria-hidden="true" /> : null}
        <div className="app-root" ref={rootRef} data-wide={wide || undefined} data-desk={desk || undefined}>
          <IslandProvider>
          <div className="lb-shell">
            {wide ? <Side /> : null}
            <main className="lb-main">
              {desk ? <DeskBar onSearch={openSearch} /> : null}
              <Screen onSearch={openSearch} />
            </main>
          </div>
          {!wide ? <TabBar onSearch={openSearch} /> : null}
          <div id="app-overlays" />
          <SearchSheet open={sheet === 'search'} onClose={() => setSheet('')} />
          </IslandProvider>
        </div>
      </div>
    </div>
  );
}

export function App() {
  return <MotionConfig reducedMotion="user"><StoreProvider><UIProvider>{() => <Shell />}</UIProvider></StoreProvider></MotionConfig>;
}
