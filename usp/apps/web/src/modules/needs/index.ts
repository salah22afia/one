import { lazy } from 'react';
import type { AppModule } from '../../app/module';

export const needs: AppModule = {
  key: "needs",
  name: { ar: "الاحتياج والعهد والأصول", en: "Needs, Custody & Assets" },
  routes: [
    { path: '/needs/need-request', feature: "need-request", serviceId: "AS-01", name: { ar: "أحتاج شيئاً", en: "I need something" }, Component: lazy(() => import('./features/need-request/pages/NeedRequestPage')) },
    { path: '/needs/specification', feature: "specification", name: { ar: "تحديد الصنف", en: "Specification" }, Component: lazy(() => import('./features/specification/pages/SpecificationPage')) },
    { path: '/needs/store', feature: "store", name: { ar: "مكتب المستودع", en: "Store desk" }, Component: lazy(() => import('./features/store/pages/StorePage')) },
    { path: '/needs/procurement', feature: "procurement", name: { ar: "مكتب المشتريات", en: "Procurement desk" }, Component: lazy(() => import('./features/procurement/pages/ProcurementPage')) },
    { path: '/needs/budget', feature: "budget", name: { ar: "الموازنة", en: "Budget" }, Component: lazy(() => import('./features/budget/pages/BudgetPage')) },
    { path: '/needs/receipt', feature: "receipt", name: { ar: "الاستلام", en: "Receipt" }, Component: lazy(() => import('./features/receipt/pages/ReceiptPage')) },
    { path: '/needs/handover', feature: "handover", name: { ar: "التسليم", en: "Handover" }, Component: lazy(() => import('./features/handover/pages/HandoverPage')) },
    { path: '/needs/custody', feature: "custody", serviceId: "AS-02", name: { ar: "عهدتي", en: "My custody" }, Component: lazy(() => import('./features/custody/pages/CustodyPage')) },
    // @gen:routes
  ],
};
