import { lazy } from 'react';
import type { AppModule } from '../../app/module';
import { BalancesWidget } from './features/balances/widget';

export const timeleave: AppModule = {
  key: "timeleave",
  name: { ar: "الوقت والإجازات", en: "Time & Leave" },
  routes: [
    { path: '/timeleave/leave-request', feature: "leave-request", serviceId: "TM-01", name: { ar: "طلب إجازة", en: "Leave request" }, Component: lazy(() => import('./features/leave-request/pages/LeaveRequestPage')) },
    { path: '/timeleave/leave-cancellation', feature: "leave-cancellation", serviceId: "TM-01C", name: { ar: "إلغاء إجازة معتمدة", en: "Leave cancellation" }, Component: lazy(() => import('./features/leave-cancellation/pages/LeaveCancellationPage')) },
    { path: '/timeleave/leave-history', feature: "leave-history", name: { ar: "سجل إجازاتي", en: "Leave history" }, Component: lazy(() => import('./features/leave-history/pages/LeaveHistoryPage')) },
    { path: '/me/balances', feature: "balances", name: { ar: "أرصدتي", en: "My balances" }, Component: lazy(() => import('./features/balances/pages/BalancesPage')) },
    // @gen:routes
  ],
  meWidgets: [{ key: 'balances', order: 30, Component: BalancesWidget }],
};
