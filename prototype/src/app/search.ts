// البحث: تطبيع عربي بسيط (همزات، تاء مربوطة، ألف مقصورة، تشكيل) ثم احتواء نصي
import { SERVICES, type Service } from '../data/catalog';

export function norm(s: string) { return s.replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').toLowerCase(); }
export const VISIBLE_SERVICES: Service[] = SERVICES.filter((s) => s.rec !== 'merge' && s.rec !== 'out');
/** v0.15: الخدمات المهيّأة السارية تدخل القائمة المرئية كخدمات متاحة (بنص الدليل حين تكون منه، وبرمزها الجديد حين لا تكون) */
export function mergeConfigured(list: Service[], configured: { id: string; domain: string; name: { ar: string; en: string }; description: { ar: string; en: string } }[]): Service[] {
  const out = list.map((s) => { const c = configured.find((x) => x.id === s.id); return c ? { ...s, name: c.name.ar || s.name, nameEn: c.name.en || s.nameEn, scope: c.description.ar || s.scope, rec: 'w1' as const } : s; });
  for (const c of configured) if (!out.some((s) => s.id === c.id)) out.push({ id: c.id, domain: c.domain, name: c.name.ar, nameEn: c.name.en, scope: c.description.ar, requester: [], target: '', freq: '', rec: 'w1' });
  return out;
}
export function searchServices(q: string, limit = 50, list: Service[] = VISIBLE_SERVICES): Service[] {
  const n = norm(q.trim()); if (!n) return [];
  const hits = list.filter((s) => norm(`${s.name} ${s.nameEn || ''} ${s.scope} ${s.id}`).includes(n));
  const rankOf = (s: Service) => (s.rec === 'w1' ? 0 : s.rec === 'w2' ? 1 : s.rec === 'w3' ? 2 : 3);
  return hits.sort((a, b) => rankOf(a) - rankOf(b)).slice(0, limit);
}
