import type { MobileModule } from '../../module';

export const timeleave: MobileModule = {
  key: "timeleave",
  name: { ar: "الوقت والإجازات", en: "Time & Leave" },
  screens: [
    { href: '/timeleave/leave-request', feature: "leave-request", serviceId: "TM-01", name: { ar: "طلب إجازة", en: "Leave request" } },
    { href: '/timeleave/leave-cancellation', feature: "leave-cancellation", serviceId: "TM-01C", name: { ar: "إلغاء إجازة معتمدة", en: "Leave cancellation" } },
    { href: '/timeleave/leave-history', feature: "leave-history", name: { ar: "سجل إجازاتي", en: "Leave history" } },
    // @gen:screens
  ],
};
