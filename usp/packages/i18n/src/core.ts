// Framework-free i18n core, shared by web, admin and mobile.
// UI wording: one JSON catalog per language (locales/<code>.json, flat dotted keys).
// Data texts (service names, SAP names, labels): LocalizedText maps keyed by language code.

/** Text in any number of languages, e.g. { ar: "…", en: "…" }. Mirrors the backend LocalizedText. */
export type LocalizedText = Record<string, string>;

export interface Language { code: string; nativeName: string; direction: 'rtl' | 'ltr'; isDefault?: boolean }

export type Catalog = Record<string, string>;
export type Params = Record<string, string | number>;

/** The text in `lang`, else in the fallback language, else any non-empty one. */
export function pick(text: LocalizedText | null | undefined, lang: string, fallback = 'ar'): string {
  if (!text) return '';
  return text[lang] || text[fallback] || Object.values(text).find((v) => !!v) || '';
}

/** `{name}` placeholders. */
export function interpolate(pattern: string, params?: Params): string {
  return params ? pattern.replace(/\{(\w+)\}/g, (m, k: string) => (params[k] !== undefined ? String(params[k]) : m)) : pattern;
}

/** Catalog lookup with fallback to the default language, then the key itself (visible, so gaps are noticed). */
export function translate(catalogs: Record<string, Catalog>, lang: string, fallback: string, key: string, params?: Params): string {
  return interpolate(catalogs[lang]?.[key] ?? catalogs[fallback]?.[key] ?? key, params);
}

/** Intl locale for a language: Latin digits and the Gregorian calendar everywhere (as in the prototype). */
export function intlLocale(lang: string): string {
  return `${lang}-u-nu-latn-ca-gregory`;
}

export function formatDate(iso: string | Date | null | undefined, lang: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat(intlLocale(lang), opts).format(typeof iso === 'string' ? new Date(iso.length === 10 ? `${iso}T12:00:00` : iso) : iso);
}

export function formatHijri(iso: string | Date, lang: string): string {
  const d = typeof iso === 'string' ? new Date(iso.length === 10 ? `${iso}T12:00:00` : iso) : iso;
  return new Intl.DateTimeFormat(`${lang}-u-ca-islamic-umalqura-nu-latn`, { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
}

export function formatNumber(n: number, lang: string, opts?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(intlLocale(lang), opts).format(n);
}

/** The catalog key for a count: `${key}.${CLDR plural category}` (Arabic: zero, one, two, few, many, other). */
export function pluralKey(key: string, n: number, lang: string): string {
  return `${key}.${new Intl.PluralRules(lang).select(n)}`;
}

type Plural = (key: string, n: number) => string;

/** How long ago, as the prototype says it: now · 5 min ago · 3 h ago · 2 d ago (in the catalog's words). */
export function ago(plural: Plural, now: string, at: string | number | Date, current = Date.now()): string {
  const ms = typeof at === 'number' ? at : new Date(at).getTime();
  const d = Math.max(0, current - ms);
  const mins = Math.round(d / 60000), hrs = Math.round(d / 3600000), days = Math.round(d / 86400000);
  if (mins < 2) return now;
  if (mins < 60) return plural('time.minutesAgo', mins);
  if (hrs < 24) return plural('time.hoursAgo', hrs);
  return plural('time.daysAgo', days);
}

/** A span of time in hours under a day, in days beyond: 5 h · 3 d. */
export function duration(plural: Plural, ms: number): string {
  const hrs = Math.round(ms / 3600000), days = Math.round(ms / 86400000);
  return hrs < 24 ? plural('time.hours', Math.max(1, hrs)) : plural('time.days', days);
}
