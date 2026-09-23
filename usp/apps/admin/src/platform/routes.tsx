import { lazy } from 'react';
import type { RouteObject } from 'react-router';
import type { LocalizedText } from '@usp/i18n';

export const adminTitle: LocalizedText = { ar: 'إدارة البوابة', en: 'Portal administration' };

// Cross-cutting admin features (§10.8). Module-specific admin features (policies, operations) come from module manifests.
const features: { path: string; label: LocalizedText; Component: RouteObject['Component'] }[] = [
  { path: 'modules', label: { ar: 'الوحدات والميزات', en: 'Modules & features' }, Component: lazy(() => import('./modules-registry/ModulesPage')) },
  { path: 'service-builder', label: { ar: 'منشئ الخدمات', en: 'Service builder' }, Component: lazy(() => import('./service-builder/ServiceBuilderPage')) },
  { path: 'versions', label: { ar: 'الإصدارات والاعتماد', en: 'Versions & approvals' }, Component: lazy(() => import('./versions/VersionsPage')) },
  { path: 'reference-lists', label: { ar: 'القوائم المرجعية', en: 'Reference lists' }, Component: lazy(() => import('./reference-lists/ReferenceListsPage')) },
  { path: 'integration', label: { ar: 'التكامل', en: 'Integration' }, Component: lazy(() => import('./integration/IntegrationPage')) },
  { path: 'org', label: { ar: 'الهيكل التنظيمي', en: 'Org structure' }, Component: lazy(() => import('./org/OrgPage')) },
  { path: 'roles', label: { ar: 'الأدوار والصلاحيات', en: 'Roles & permissions' }, Component: lazy(() => import('./roles/RolesPage')) },
  { path: 'reports', label: { ar: 'التقارير', en: 'Reports' }, Component: lazy(() => import('./reports/ReportsPage')) },
];

export const platformRoutes: RouteObject[] = [
  { index: true, Component: features[0]!.Component },
  ...features.map((f) => ({ path: f.path, Component: f.Component })),
];
export const platformNav = features.map((f) => ({ to: `/${f.path}`, label: f.label }));

/** Only for platform administrators (the sidebar shows them to them; the API enforces it). Labels are catalog keys. */
const adminOnly: { path: string; label: string; Component: RouteObject['Component'] }[] = [
  { path: 'catalog', label: 'catalogAdmin.title', Component: lazy(() => import('./catalog/CatalogAdminPage')) },
  { path: 'platform-users', label: 'users.title', Component: lazy(() => import('./platform-users/PlatformUsersPage')) },
];
export const adminOnlyRoutes: RouteObject[] = adminOnly.map((f) => ({ path: f.path, Component: f.Component }));
export const adminOnlyNav = adminOnly.map((f) => ({ to: `/${f.path}`, label: f.label }));
export const accountRoutes: RouteObject[] = [
  { path: 'account/password', Component: lazy(() => import('./account/PasswordPage')) },
];

