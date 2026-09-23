import type React from 'react';
import { Suspense } from 'react';
import { createBrowserRouter, Link, Outlet, RouterProvider, useLocation, type RouteObject } from 'react-router';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { getLanguages, getSession, logout, type SessionView } from '@usp/api-client';
import { I18nProvider, useI18n } from '@usp/i18n';
import { Avatar, ChangePassword, IslandProvider, LayoutGroup, MotionConfig, SignIn, UIProvider, motion } from '@usp/ui-web';
import emblem from '@usp/ui-web/emblem.png';
import { modules } from './registry';
import { platformRoutes, platformNav, adminTitle, adminOnlyRoutes, accountRoutes } from '../platform/routes';

const queryClient = new QueryClient();
const applyDir = (lang: string, dir: 'rtl' | 'ltr') => { document.documentElement.lang = lang; document.documentElement.dir = dir; };

/** Signed in (platform account or SAP user), with the temporary password replaced; otherwise the sign-in screens. */
function Gate() {
  const { t, text } = useI18n();
  const session = useQuery({ queryKey: ['session'], queryFn: getSession, retry: false });
  if (session.isPending) return null;
  if (session.isError) return <SignIn title={text(adminTitle)} hint={t('auth.adminHint')} onSignedIn={(s) => queryClient.setQueryData(['session'], s)} />;
  if (session.data.mustChangePassword)
    return <ChangePassword title={text(adminTitle)} required onDone={(s) => queryClient.setQueryData(['session'], s)} onLeave={signOut} />;
  return <Shell session={session.data} />;
}

function signOut() {
  void logout().finally(() => { queryClient.clear(); location.assign('/'); });
}

/** The prototype's frame (sidebar ≥ 900); administration is a desk tool, so there is no phone tab bar. */
function Shell({ session }: { session: SessionView }) {
  const { t, text } = useI18n(); const { pathname } = useLocation();
  const link = (to: string, label: string) => {
    const on = to === '/' ? pathname === '/' : pathname.startsWith(to);
    return (
      <Link key={to} className="side-item" to={to} aria-current={on ? 'page' : undefined}>
        {on ? <motion.span className="side-pill" layoutId="adm-side-pill" transition={{ type: 'spring', stiffness: 420, damping: 36 }} /> : null}
        <span className="side-label">{label}</span>
      </Link>
    );
  };
  const name = text(session.name) || session.username;
  return (
    <MotionConfig reducedMotion="user">
      <UIProvider person={name}>
        {({ wide, desk, rootRef }) => (
          <div className="app-root" ref={rootRef} data-wide={wide || undefined} data-desk={desk || undefined}>
            <IslandProvider>
              <div className="lb-shell">
                <LayoutGroup id="adm-side">
                  <aside className="lb-side">
                    <div className="brand"><img className="brand-emblem" src={emblem} alt="" /><div><b>{text(adminTitle)}</b></div></div>
                    {platformNav.map((n) => link(n.to, text(n.label)))}
                    {session.admin ? link('/platform-users', t('users.title')) : null}
                    {modules.filter((m) => m.routes.length).map((m) => (
                      <div key={m.key}>
                        <div className="section-label"><span>{text(m.name)}</span></div>
                        {m.routes.map((r) => link(r.path, text(r.name)))}
                      </div>
                    ))}
                    <div className="side-spacer" />
                    <div className="adm-me">
                      <Avatar name={name} size="sm" />
                      <span><b>{name}</b><span className="num">{session.employeeNo ?? session.username}</span></span>
                    </div>
                    {session.kind === 'platform' ? link('/account/password', t('auth.changePassword')) : null}
                    <button type="button" className="side-item" onClick={signOut}><span className="side-label">{t('common.signOut')}</span></button>
                  </aside>
                </LayoutGroup>
                <main className="lb-main"><Suspense fallback={null}><Outlet /></Suspense></main>
              </div>
              <div id="app-overlays" />
            </IslandProvider>
          </div>
        )}
      </UIProvider>
    </MotionConfig>
  );
}

const routes: RouteObject[] = [
  ...platformRoutes,
  ...adminOnlyRoutes,
  ...accountRoutes,
  ...modules.flatMap((m) => m.routes.map((r) => ({ path: r.path, Component: r.Component }))),
];
const router = createBrowserRouter([{ Component: Gate, children: routes }]);

/** The administrator's languages (settings in PostgreSQL); the built-in list until they arrive. */
function WithLanguages({ children }: { children: React.ReactNode }) {
  const languages = useQuery({ queryKey: ['languages'], queryFn: getLanguages, staleTime: Infinity });
  return <I18nProvider languages={languages.data} onChange={applyDir}>{children}</I18nProvider>;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WithLanguages>
        <RouterProvider router={router} />
      </WithLanguages>
    </QueryClientProvider>
  );
}
