import type { MobileModule } from '../../module';

export const mydata: MobileModule = {
  key: "mydata",
  name: { ar: "بياناتي ومستنداتي", en: "My Data & Documents" },
  screens: [
    { href: '/mydata/profile', feature: "profile", name: { ar: "ملفي", en: "My profile" } },
    // @gen:screens
  ],
};
