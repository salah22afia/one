import type { MobileModule } from '../../module';

export const needs: MobileModule = {
  key: "needs",
  name: { ar: "الاحتياج والعهد والأصول", en: "Needs, Custody & Assets" },
  screens: [
    { href: '/needs/need-request', feature: "need-request", serviceId: "AS-01", name: { ar: "أحتاج شيئاً", en: "I need something" } },
    { href: '/needs/specification', feature: "specification", name: { ar: "تحديد الصنف", en: "Specification" } },
    { href: '/needs/store', feature: "store", name: { ar: "مكتب المستودع", en: "Store desk" } },
    { href: '/needs/procurement', feature: "procurement", name: { ar: "مكتب المشتريات", en: "Procurement desk" } },
    { href: '/needs/budget', feature: "budget", name: { ar: "الموازنة", en: "Budget" } },
    { href: '/needs/receipt', feature: "receipt", name: { ar: "الاستلام", en: "Receipt" } },
    { href: '/needs/handover', feature: "handover", name: { ar: "التسليم", en: "Handover" } },
    { href: '/needs/custody', feature: "custody", serviceId: "AS-02", name: { ar: "عهدتي", en: "My custody" } },
    // @gen:screens
  ],
};
