import { lazy } from 'react';
import type { AppModule } from '../../app/module';

export const mydata: AppModule = {
  key: "mydata",
  name: { ar: "بياناتي ومستنداتي", en: "My Data & Documents" },
  routes: [
    { path: '/mydata/profile', feature: "profile", name: { ar: "ملفي", en: "My profile" }, Component: lazy(() => import('./features/profile/pages/ProfilePage')) },
    // @gen:routes
  ],
};
