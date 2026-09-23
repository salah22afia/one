import { describe, expect, it } from 'vitest';
import { catalogs } from './catalogs';
import { pick, translate } from './core';

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
});
