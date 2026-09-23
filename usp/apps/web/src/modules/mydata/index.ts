import { lazy } from 'react';
import type { AppModule } from '../../app/module';
import { DocumentsWidget } from './features/documents/widget';
import { FamilyWidget } from './features/family/widget';
import { MyDataWidget } from './features/profile/widget';

export const mydata: AppModule = {
  key: "mydata",
  name: { ar: "بياناتي ومستنداتي", en: "My Data & Documents" },
  routes: [
    { path: '/me/data', feature: "profile", name: { ar: "بياناتي", en: "My data" }, Component: lazy(() => import('./features/profile/pages/ProfilePage')) },
    { path: '/me/docs', feature: "documents", name: { ar: "مستنداتي", en: "My documents" }, Component: lazy(() => import('./features/documents/pages/DocumentsPage')) },
    { path: '/me/family', feature: "family", name: { ar: "أسرتي", en: "My family" }, Component: lazy(() => import('./features/family/pages/FamilyPage')) },
    // @gen:routes
  ],
  meWidgets: [
    { key: 'profile', order: 10, Component: MyDataWidget },
    { key: 'documents', order: 20, Component: DocumentsWidget },
    { key: 'family', order: 50, Component: FamilyWidget },
  ],
};
