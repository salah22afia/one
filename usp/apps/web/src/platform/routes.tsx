import { lazy } from 'react';
import { Navigate, type RouteObject } from 'react-router';

// Cross-cutting features (not business modules). Each folder is a feature: pages + api + components.
export const platformRoutes: RouteObject[] = [
  { index: true, Component: lazy(() => import('./home/HomePage')) },
  { path: 'services', Component: lazy(() => import('./catalog/CatalogPage')) },
  { path: 'services/:serviceId', Component: lazy(() => import('./dynamic-service/DynamicServicePage')) },
  { path: 'inbox', Component: lazy(() => import('./inbox/InboxPage')) },
  { path: 'requests', Component: lazy(() => import('./requests/RequestsPage')) },
  { path: 'requests/:id', Component: lazy(() => import('./requests/RequestDetailPage')) },
  { path: 'notifications', Component: lazy(() => import('./notifications/NotificationsPage')) },
  { path: 'documents/:id', Component: lazy(() => import('./documents/DocumentPage')) },
  { path: 'settings', Component: lazy(() => import('./settings/SettingsPage')) },
  // The Me tab; its own screens arrive in Slice 1, until then it opens the profile.
  { path: 'me', element: <Navigate to="/mydata/profile" replace /> },
];

export const notFoundRoute: RouteObject = { path: '*', Component: lazy(() => import('./not-found/NotFoundPage')) };


