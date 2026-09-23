import React from 'react';

/** رمز استجابة تجريبي: نمط ثابت مشتق من نص (ليس رمزاً حقيقياً؛ في الإنتاج يُولَّد من رابط التحقق) */
export function QR({ seed, color = '#0b4a2f' }: { seed: string; color?: string }) {
  const n = 21; let h = 2166136261; for (const ch of seed) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  const cells: string[] = [];
  const finder = (x: number, y: number) => (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (finder(x, y)) { const ex = x >= n - 7 ? x - (n - 7) : x, ey = y >= n - 7 ? y - (n - 7) : y; const on = ex === 0 || ey === 0 || ex === 6 || ey === 6 || (ex >= 2 && ex <= 4 && ey >= 2 && ey <= 4); if (on) cells.push(`M${x} ${y}h1v1h-1z`); continue; }
    h ^= (x * 73856093) ^ (y * 19349663); h = Math.imul(h, 2654435761) >>> 0; if ((h >>> 13) & 1) cells.push(`M${x} ${y}h1v1h-1z`);
  }
  return <svg viewBox={`0 0 ${n} ${n}`} shapeRendering="crispEdges"><path d={cells.join('')} fill={color} /></svg>;
}
