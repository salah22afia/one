import { lazy } from 'react';
import type { AppModule } from '../../app/module';

export const needs: AppModule = {
  key: "needs",
  name: { ar: "الاحتياج والعهد والأصول", en: "Needs, Custody & Assets" },
  routes: [
    { path: '/needs/needs-policy', feature: "needs-policy", name: { ar: "سياسة الاحتياج", en: "Needs policy" }, Component: lazy(() => import('./features/needs-policy/pages/NeedsPolicyPage')) },
    // @gen:routes
  ],
};
