import type { MobileModule } from '../../module';
import { PayslipsWidget } from './features/payslips/widget';

export const finance: MobileModule = {
  key: "finance",
  name: { ar: "المعاملات المالية للموظف", en: "Employee Finance" },
  screens: [
    { href: '/finance/payslips', feature: "payslips", name: { ar: "راتبي", en: "My pay" } },
    // @gen:screens
  ],
  meWidgets: [{ key: 'payslips', order: 40, Component: PayslipsWidget }],
};
