// موجّه بسيط على الـ hash: يعمل داخل ملف واحد وفي صفحة Artifact بلا خادم.
// v0.3: يعرف اتجاه الانتقال (دفع إلى الأعمق، أو رجوع، أو تبديل بين الألسنة) لتتحرك الشاشات كما في iOS.
import { useEffect, useState } from 'react';

export type NavDir = 'push' | 'pop' | 'tab';
export interface Route { path: string; parts: string[]; dir: NavDir; key: string }

const TABS = new Set(['', 'home', 'inbox', 'services', 'requests', 'me']);
/** عمق الشاشة: الألسنة 0، وكل ما يُفتح منها 1 (تفاصيل طلب، طلب جديد، مجال، التنبيهات…) */
function rank(parts: string[]): number {
  const [a, b] = parts;
  if (!a || a === 'home') return 0;
  if (a === 'me') return 0;
  if (TABS.has(a)) return b ? 1 : 0;
  return 1;
}
function parseParts(): string[] { return (location.hash || '#/home').replace(/^#\/?/, '').split('/').filter(Boolean); }
function keyOf(parts: string[]) { return '/' + parts.join('/'); }

let stack: string[] = [keyOf(parseParts())];
let lastDir: NavDir = 'tab';

function step(): Route {
  const parts = parseParts(); const key = keyOf(parts); const prevKey = stack[stack.length - 1];
  if (key !== prevKey) {
    const prevParts = prevKey.split('/').filter(Boolean);
    const rp = rank(prevParts), rn = rank(parts);
    if (stack.length > 1 && stack[stack.length - 2] === key) { stack.pop(); lastDir = rn < rp ? 'pop' : rn > rp ? 'push' : 'tab'; }
    else { stack.push(key); if (stack.length > 60) stack.shift(); lastDir = rn > rp ? 'push' : rn < rp ? 'pop' : 'tab'; }
  }
  return { path: key, parts, dir: lastDir, key };
}

export function useRoute(): Route {
  const [r, setR] = useState<Route>(() => ({ path: keyOf(parseParts()), parts: parseParts(), dir: 'tab', key: keyOf(parseParts()) }));
  useEffect(() => {
    const on = () => { setR(step()); window.scrollTo({ top: 0 }); };
    window.addEventListener('hashchange', on);
    if (!location.hash) location.replace('#/home');
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return r;
}
export function nav(to: string) { location.hash = to.startsWith('#') ? to : '#' + to; }
export function back(fallback = '#/home') { if (history.length > 1) history.back(); else nav(fallback); }
