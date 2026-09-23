import type React from 'react';
import { Suspense, lazy } from 'react';
import { createBrowserRouter, Navigate, RouterProvider, type RouteObject } from 'react-router';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { ApiError, getLanguages, getSession, logout, setOnUnauthorized } from '@usp/api-client';
import { I18nProvider, useI18n } from '@usp/i18n';
import { ChangePassword } from '@usp/ui-web';
import { modules } from './registry';
import { platformRoutes, notFoundRoute } from '../platform/routes';
import { Shell } from './Shell';
import { cachedPreferences } from './preferences';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: (n, e) => !(e instanceof ApiError && e.status < 500) && n < 2 } } });
const applyDir = (lang: string, dir: 'rtl' | 'ltr') => { document.documentElement.lang = lang; document.documentElement.dir = dir; };
setOnUnauthorized(() => { queryClient.clear(); if (location.pathname !== '/login') location.assign('/login'); });

/** Everything except /login and /verify needs a signed-in user. */
function SignedIn() {
  const session = useQuery({ queryKey: ['session'], queryFn: getSession });
  if (session.isPending) return null;
  if (session.isError) return <Navigate to="/login" replace />;
  if (session.data.mustChangePassword) return <PasswordFirst />;
  return <Shell session={session.data} />;
}

/** A platform account with a temporary password sets its own before anything else. */
function PasswordFirst() {
  const { t } = useI18n();
  const out = () => { void logout().finally(() => { queryClient.clear(); location.assign('/login'); }); };
  return <ChangePassword title={t('common.appName')} required onDone={(s) => queryClient.setQueryData(['session'], s)} onLeave={out} />;
}

const LoginPage = lazy(() => import('../platform/auth/LoginPage'));
const VerifyPage = lazy(() => import('../platform/verify/VerifyPage'));
const CardVerifyPage = lazy(() => import('../platform/verify/CardVerifyPage'));

const routes: RouteObject[] = [
  ...platformRoutes,
  ...modules.flatMap((m) => m.routes.map((r) => ({ path: r.path, Component: r.Component }))),
  notFoundRoute,
];
const router = createBrowserRouter([
  { path: '/login', element: <Suspense fallback={null}><LoginPage /></Suspense> },
  // Public: anyone holding a document or shown a digital card can check it without signing in.
  { path: '/verify/card/:code', element: <main className="main"><Suspense fallback={null}><CardVerifyPage /></Suspense></main> },
  { path: '/verify/:code?', element: <main className="main"><Suspense fallback={null}><VerifyPage /></Suspense></main> },
  { Component: SignedIn, children: routes },
]);

/** The administrator's languages (settings in PostgreSQL); the built-in list until they arrive. */
function WithLanguages({ children }: { children: React.ReactNode }) {
  const languages = useQuery({ queryKey: ['languages'], queryFn: getLanguages, staleTime: Infinity });
  return <I18nProvider languages={languages.data} initial={cachedPreferences()?.language ?? undefined} onChange={applyDir}>{children}</I18nProvider>;
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
