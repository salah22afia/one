import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { builtInLanguages, catalogs } from './catalogs';
import { ago, duration, formatDate, formatHijri, formatNumber, pick, pluralKey, translate, type Language, type LocalizedText, type Params } from './core';

export * from './core';
export { catalogs, builtInLanguages } from './catalogs';

export interface I18n {
  lang: string;
  dir: 'rtl' | 'ltr';
  languages: Language[];
  setLang: (code: string) => void;
  /** UI wording from the catalogs: t('home.title'), t('requests.count', { n: 3 }). */
  t: (key: string, params?: Params) => string;
  /** Data text in the current language (with fallback): text(service.name). */
  text: (value: LocalizedText | null | undefined) => string;
  date: (iso: string | Date | null | undefined, opts?: Intl.DateTimeFormatOptions) => string;
  hijri: (iso: string | Date) => string;
  number: (n: number, opts?: Intl.NumberFormatOptions) => string;
  /** A catalog text chosen by count: plural('time.days', 3) looks up time.days.few in Arabic, time.days.other in English. */
  plural: (key: string, n: number) => string;
  /** How long ago (now · 5 min ago · 3 h ago · 2 d ago). */
  ago: (at: string | number | Date, now?: number) => string;
  /** A span of time: 5 h · 3 d. */
  duration: (ms: number) => string;
}

const Ctx = createContext<I18n | null>(null);

/**
 * `languages`: the administrator's enabled languages (GET /api/v1/settings/languages); only those with a UI catalog are
 * offered. `onChange` lets each platform apply the direction (web: <html dir/lang>, native: I18nManager).
 */
export function I18nProvider({ children, languages = builtInLanguages, initial, onChange }: {
  children: ReactNode; languages?: Language[]; initial?: string; onChange?: (lang: string, dir: 'rtl' | 'ltr') => void;
}) {
  const offered = useMemo(() => {
    const ok = languages.filter((l) => catalogs[l.code]);
    return ok.length ? ok : builtInLanguages;
  }, [languages]);
  const fallback = (offered.find((l) => l.isDefault) ?? offered[0]!).code;
  const [lang, setLangState] = useState(() => (initial && offered.some((l) => l.code === initial) ? initial : fallback));
  const current = offered.some((l) => l.code === lang) ? lang : fallback;
  const dir = offered.find((l) => l.code === current)?.direction ?? 'rtl';

  const setLang = useCallback((code: string) => {
    if (offered.some((x) => x.code === code)) setLangState(code);
  }, [offered]);
  // Applied for the starting language too, and when the administrator's list changes the default.
  useEffect(() => { onChange?.(current, dir); }, [current, dir, onChange]);

  const value = useMemo<I18n>(() => {
    const t = (key: string, params?: Params) => translate(catalogs, current, fallback, key, params);
    const plural = (key: string, n: number) => {
      const k = pluralKey(key, n, current);
      return catalogs[current]?.[k] !== undefined ? t(k, { n }) : t(`${key}.other`, { n });
    };
    return {
      lang: current,
      dir,
      languages: offered,
      setLang,
      t,
      text: (v) => pick(v, current, fallback),
      date: (iso, opts) => formatDate(iso, current, opts),
      hijri: (iso) => formatHijri(iso, current),
      number: (n, opts) => formatNumber(n, current, opts),
      plural,
      ago: (at, now) => ago(plural, t('time.now'), at, now),
      duration: (ms) => duration(plural, ms),
    };
  }, [current, dir, offered, setLang, fallback]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const v = useContext(Ctx);
  if (!v) throw new Error('useI18n outside I18nProvider');
  return v;
}
