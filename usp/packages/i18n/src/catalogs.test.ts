import { describe, expect, it } from 'vitest';
import { catalogs } from './catalogs';
import { ago, duration, pick, pluralKey, translate } from './core';

describe('catalogs', () => {
  it('every language has exactly the keys of the default language', () => {
    const base = Object.keys(catalogs.ar!).sort();
    for (const [code, c] of Object.entries(catalogs)) expect(Object.keys(c).sort(), code).toEqual(base);
  });
  it('falls back to the default language, then to the key', () => {
    const c = { ar: { a: 'أ', b: 'مرحباً {name}' }, en: { a: 'A' } };
    expect(translate(c, 'en', 'ar', 'b', { name: 'Salah' })).toBe('مرحباً Salah');
    expect(translate(c, 'fr', 'ar', 'a')).toBe('أ');
    expect(translate(c, 'en', 'ar', 'missing')).toBe('missing');
  });
  it('picks data texts with fallback', () => {
    expect(pick({ ar: '', en: 'Salah' }, 'ar')).toBe('Salah');
    expect(pick({ ar: 'صلاح' }, 'fr', 'ar')).toBe('صلاح');
    expect(pick(undefined, 'ar')).toBe('');
  });
  it('says how long ago and how long in each language, as the prototype', () => {
    const plural = (lang: string) => (key: string, n: number) => translate(catalogs, lang, 'ar', pluralKey(key, n, lang), { n });
    const now = Date.parse('2026-09-23T12:00:00Z');
    expect(ago(plural('ar'), 'الآن', now - 60_000, now)).toBe('الآن');
    expect(ago(plural('ar'), 'الآن', now - 5 * 60_000, now)).toBe('منذ 5 دقائق');
    expect(ago(plural('ar'), 'الآن', now - 2 * 3_600_000, now)).toBe('منذ ساعتين');
    expect(ago(plural('ar'), 'الآن', now - 15 * 86_400_000, now)).toBe('منذ 15 يوماً');
    expect(ago(plural('en'), 'now', now - 3 * 3_600_000, now)).toBe('3 h ago');
    expect(duration(plural('ar'), 2 * 86_400_000)).toBe('يومان');
    expect(duration(plural('en'), 30 * 60_000)).toBe('1 h');
  });
});
