
/** Dates with Latin digits in both languages (as in the prototype). */
export function fmtDate(iso: string | null | undefined, lang: string, withTime = false): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(new Date(iso));
}
