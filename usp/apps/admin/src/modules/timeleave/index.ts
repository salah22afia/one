import { lazy } from 'react';
import type { AppModule } from '../../app/module';

export const timeleave: AppModule = {
  key: "timeleave",
  name: { ar: "الوقت والإجازات", en: "Time & Leave" },
  routes: [
    { path: '/timeleave/leave-policy', feature: "leave-policy", name: { ar: "سياسة الإجازات", en: "Leave policy" }, Component: lazy(() => import('./features/leave-policy/pages/LeavePolicyPage')) },
    { path: '/timeleave/leave-operations', feature: "leave-operations", name: { ar: "تشغيل الإجازات", en: "Leave operations" }, Component: lazy(() => import('./features/leave-operations/pages/LeaveOperationsPage')) },
    // @gen:routes
  ],
};
