import ar from '../locales/ar.json';
import en from '../locales/en.json';
import type { Catalog, Language } from './core';

/**
 * UI catalogs shipped with the apps. To add a language: add locales/<code>.json here (and the backend
 * messages_<code>.properties), then enable it in the admin language settings.
 */
export const catalogs: Record<string, Catalog> = { ar, en };

/** Used until the server's language list arrives, and when it cannot be reached. */
export const builtInLanguages: Language[] = [
  { code: 'ar', nativeName: 'العربية', direction: 'rtl', isDefault: true },
  { code: 'en', nativeName: 'English', direction: 'ltr' },
];
