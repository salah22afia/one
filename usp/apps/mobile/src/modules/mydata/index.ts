import type { MobileModule } from '../../module';
import { DocumentsWidget } from './features/documents/widget';
import { FamilyWidget } from './features/family/widget';
import { MyDataWidget } from './features/profile/widget';

export const mydata: MobileModule = {
  key: "mydata",
  name: { ar: "بياناتي ومستنداتي", en: "My Data & Documents" },
  screens: [
    { href: '/mydata/profile', feature: "profile", name: { ar: "بياناتي", en: "My data" } },
    { href: '/mydata/documents', feature: "documents", name: { ar: "مستنداتي", en: "My documents" } },
    { href: '/mydata/family', feature: "family", name: { ar: "أسرتي", en: "My family" } },
    // @gen:screens
  ],
  meWidgets: [
    { key: 'profile', order: 10, Component: MyDataWidget },
    { key: 'documents', order: 20, Component: DocumentsWidget },
    { key: 'family', order: 50, Component: FamilyWidget },
  ],
};
