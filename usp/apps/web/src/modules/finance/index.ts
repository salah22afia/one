import { lazy } from 'react';
import type { AppModule } from '../../app/module';
import { PayslipsWidget } from './features/payslips/widget';

export const finance: AppModule = {
  key: "finance",
  name: { ar: "المعاملات المالية للموظف", en: "Employee Finance" },
  routes: [
    { path: '/me/pay', feature: "payslips", name: { ar: "راتبي", en: "My pay" }, Component: lazy(() => import('./features/payslips/pages/PayslipsPage')) },
    // @gen:routes
  ],
  meWidgets: [{ key: 'payslips', order: 40, Component: PayslipsWidget }],
};
