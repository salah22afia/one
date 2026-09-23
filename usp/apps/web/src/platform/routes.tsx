import { lazy } from 'react';
import { Navigate, type RouteObject } from 'react-router';

// Cross-cutting features (not business modules). Each folder is a feature: pages + api + components.
export const platformRoutes: RouteObject[] = [
  { index: true, Component: lazy(() => import('./home/HomePage')) },
  { path: 'services', Component: lazy(() => import('./catalog/CatalogPage')) },
  { path: 'services/:code', Component: lazy(() => import('./catalog/DomainPage')) },
  // A configured service's request form (coded services open their module's page instead).
  { path: 'new/:serviceId', Component: lazy(() => import('./dynamic-service/DynamicServicePage')) },
  { path: 'inbox', Component: lazy(() => import('./inbox/InboxPage')) },
  { path: 'requests', Component: lazy(() => import('./requests/RequestsPage')) },
  { path: 'requests/:id', Component: lazy(() => import('./requests/RequestDetailPage')) },
  { path: 'requests/:id/resubmit', Component: lazy(() => import('./requests/ResubmitPage')) },
  { path: 'notifications', Component: lazy(() => import('./notifications/NotificationsPage')) },
  { path: 'documents/:id', Component: lazy(() => import('./documents/DocumentPage')) },
  // Me: the card and widgets; the pages behind the widgets come from the modules (mydata, timeleave, finance).
  { path: 'me', Component: lazy(() => import('./me/MePage')) },
  { path: 'me/settings', Component: lazy(() => import('./me/SettingsPage')) },
  // Earlier addresses.
  { path: 'settings', element: <Navigate to="/me/settings" replace /> },
  { path: 'mydata/profile', element: <Navigate to="/me/data" replace /> },
];

export const notFoundRoute: RouteObject = { path: '*', Component: lazy(() => import('./not-found/NotFoundPage')) };


