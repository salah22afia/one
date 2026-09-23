/* أغلفة على الهوية: رسوم متجهية (لا صور) تُولَّد من المعيّن والنقش والتدرجات بألوان الأمانة — تقوم مقام الصور حتى تأتي الصور الحقيقية من القطاعات.
   كل غلاف: نوع رسم (art) ولون (hue) وبذرة تُثبّت العشوائية، ويُرسم في مقاسه (عريض، قصة، لافتة، مربع) لا يُقصّ من مقاس آخر. */
import React, { useId } from 'react';
import type { CoverSpec, Hue } from '../domain/types';

export type CoverRatio = 'wide' | 'story' | 'banner' | 'square' | 'tall';
const SIZE: Record<CoverRatio, [number, number]> = { wide: [600, 400], story: [450, 800], banner: [800, 450], square: [400, 400], tall: [400, 500] };

interface Pal { a: string; b: string; c: string; ink: string; light: string; accent: string; accent2: string }
const PAL: Record<Hue, Pal> = {
  green: { a: '#146b45', b: '#0b4a2f', c: '#06331f', ink: '#03130b', light: '#fff6dc', accent: '#e2c98a', accent2: '#b5944d' },
  gold: { a: '#e3cf95', b: '#b5944d', c: '#7d6128', ink: '#3a2c0f', light: '#fffaf0', accent: '#0b4a2f', accent2: '#fff1c9' },
  cream: { a: '#fdfbf6', b: '#f3ecd9', c: '#e5dcc2', ink: '#0b4a2f', light: '#ffffff', accent: '#0b4a2f', accent2: '#b5944d' },
  teal: { a: '#5db0a4', b: '#256b62', c: '#123f3a', ink: '#061f1c', light: '#e8fbf6', accent: '#e2c98a', accent2: '#bfeee6' },
  bronze: { a: '#c4a36c', b: '#7d5f2a', c: '#3f2e10', ink: '#1d1405', light: '#fff3d6', accent: '#fff1c9', accent2: '#0b4a2f' },
  night: { a: '#123b2b', b: '#082a1c', c: '#04160f', ink: '#000', light: '#e6f2ea', accent: '#d4b978', accent2: '#7cc5a2' },
  sage: { a: '#8fbf98', b: '#4c8a5f', c: '#2c5a3c', ink: '#10281a', light: '#f5fbf5', accent: '#fff6dc', accent2: '#0b4a2f' },
};
/* عشوائية ثابتة بالبذرة (LCG) */
function rng(seed: number) { let s = (seed * 9301 + 49297) % 233280; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }
function hexPts(cx: number, cy: number, r: number): string { const p: string[] = []; for (let i = 0; i < 6; i++) { const a = (Math.PI / 3) * i + Math.PI / 6; p.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`); } return p.join(' '); }

function Gems({ W, H, pal, r }: { W: number; H: number; pal: Pal; r: () => number }) {
  const gems = [{ x: W * 0.72, y: H * 0.6, s: Math.min(W, H) * 0.34 }, { x: W * 0.3, y: H * 0.32, s: Math.min(W, H) * 0.18 }, { x: W * (0.15 + r() * 0.1), y: H * 0.8, s: Math.min(W, H) * 0.1 }];
  return (
    <g fill="none" strokeLinejoin="round">
      {gems.map((g, i) => (
        <g key={i} opacity={i === 0 ? 0.95 : 0.7 - i * 0.15}>
          <polygon points={hexPts(g.x, g.y, g.s)} stroke={pal.accent} strokeWidth={g.s * 0.03} />
          <polygon points={hexPts(g.x + g.s * 0.05, g.y - g.s * 0.06, g.s * 0.66)} stroke={pal.light} strokeOpacity={0.6} strokeWidth={g.s * 0.016} />
          {Array.from({ length: 6 }).map((_, k) => { const a = (Math.PI / 3) * k + Math.PI / 6; const x1 = g.x + g.s * Math.cos(a), y1 = g.y + g.s * Math.sin(a); const x2 = g.x + g.s * 0.05 + g.s * 0.66 * Math.cos(a), y2 = g.y - g.s * 0.06 + g.s * 0.66 * Math.sin(a); return <line key={k} x1={x1} y1={y1} x2={x2} y2={y2} stroke={pal.accent} strokeOpacity={0.45} strokeWidth={g.s * 0.012} />; })}
        </g>
      ))}
    </g>
  );
}
function Dunes({ W, H, pal, r }: { W: number; H: number; pal: Pal; r: () => number }) {
  const layers = [0.52, 0.64, 0.76, 0.88].map((f, i) => { const y = H * f; const a = H * (0.06 + r() * 0.05), b = H * (0.04 + r() * 0.06); return { d: `M0 ${y + a} C ${W * 0.28} ${y - a}, ${W * 0.5} ${y + b}, ${W * 0.72} ${y - b * 0.6} S ${W} ${y + a * 0.4}, ${W} ${y} L ${W} ${H} L 0 ${H} Z`, o: 0.55 + i * 0.15 }; });
  const cols = [pal.a, pal.b, pal.c, pal.ink];
  return (
    <g>
      <circle cx={W * 0.68} cy={H * 0.3} r={Math.min(W, H) * 0.11} fill={pal.light} opacity={0.9} />
      <circle cx={W * 0.68} cy={H * 0.3} r={Math.min(W, H) * 0.2} fill={pal.light} opacity={0.14} />
      {layers.map((l, i) => <path key={i} d={l.d} fill={cols[i]} opacity={l.o} />)}
    </g>
  );
}
function Arch({ W, H, pal }: { W: number; H: number; pal: Pal }) {
  const cx = W * 0.5, rw = Math.min(W, H) * 0.3, top = H * 0.16, base = H * 0.96;
  const arch = (k: number) => `M ${cx - rw * k} ${base} L ${cx - rw * k} ${H * 0.5} Q ${cx - rw * k} ${top + (1 - k) * 60}, ${cx} ${top + (1 - k) * 60} Q ${cx + rw * k} ${top + (1 - k) * 60}, ${cx + rw * k} ${H * 0.5} L ${cx + rw * k} ${base} Z`;
  return (
    <g>
      <path d={arch(1)} fill={pal.accent} opacity={0.92} />
      <path d={arch(0.8)} fill="none" stroke={pal.accent2} strokeWidth={2} opacity={0.75} />
      <path d={arch(0.62)} fill={pal.a} opacity={0.35} />
      <rect x={0} y={base - 6} width={W} height={6} fill={pal.accent2} opacity={0.5} />
      {[0.12, 0.88].map((f, i) => <polygon key={i} points={hexPts(W * f, H * 0.3 + i * 40, Math.min(W, H) * 0.06)} fill="none" stroke={pal.accent2} strokeWidth={1.5} opacity={0.6} />)}
    </g>
  );
}
function Star({ W, H, pal, id }: { W: number; H: number; pal: Pal; id: string }) {
  const s = Math.min(W, H) * 0.22;
  return (
    <g>
      <defs>
        <pattern id={`${id}-p`} width={s} height={s} patternUnits="userSpaceOnUse">
          <rect x={s * 0.18} y={s * 0.18} width={s * 0.64} height={s * 0.64} fill="none" stroke={pal.accent} strokeWidth={1.2} opacity={0.55} />
          <rect x={s * 0.18} y={s * 0.18} width={s * 0.64} height={s * 0.64} fill="none" stroke={pal.accent} strokeWidth={1.2} opacity={0.55} transform={`rotate(45 ${s / 2} ${s / 2})`} />
          <circle cx={s / 2} cy={s / 2} r={s * 0.07} fill={pal.accent} opacity={0.5} />
        </pattern>
      </defs>
      <rect x={0} y={0} width={W} height={H} fill={`url(#${id}-p)`} opacity={0.75} />
    </g>
  );
}
function Bokeh({ W, H, pal, r }: { W: number; H: number; pal: Pal; r: () => number }) {
  const dots = Array.from({ length: 9 }).map(() => ({ x: W * r(), y: H * r(), rad: Math.min(W, H) * (0.05 + r() * 0.13), o: 0.25 + r() * 0.45, c: r() > 0.5 ? pal.light : pal.accent }));
  return <g>{dots.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={d.rad} fill={d.c} opacity={d.o} style={{ filter: `blur(${(d.rad * 0.25).toFixed(1)}px)` }} />)}</g>;
}
function Waves({ W, H, pal }: { W: number; H: number; pal: Pal }) {
  const lines = Array.from({ length: 9 }).map((_, i) => { const y = H * (0.42 + i * 0.062); const a = H * 0.06; return `M0 ${y} C ${W * 0.22} ${y - a}, ${W * 0.38} ${y + a}, ${W * 0.55} ${y} S ${W * 0.85} ${y - a}, ${W} ${y + a * 0.3}`; });
  return <g fill="none">{lines.map((d, i) => <path key={i} d={d} stroke={pal.accent} strokeWidth={1.6} opacity={0.22 + i * 0.07} />)}</g>;
}
function Grid({ W, H, pal }: { W: number; H: number; pal: Pal }) {
  const vx = W / 2, vy = H * 0.34; const cols = 14; const rows = [0.42, 0.5, 0.6, 0.72, 0.86, 1];
  return (
    <g fill="none" stroke={pal.accent2} strokeWidth={1}>
      {Array.from({ length: cols + 1 }).map((_, i) => { const x = (W * 1.6 * i) / cols - W * 0.3; return <line key={i} x1={vx} y1={vy} x2={x} y2={H} opacity={0.35} />; })}
      {rows.map((f, i) => <line key={i} x1={0} y1={H * f} x2={W} y2={H * f} opacity={0.2 + i * 0.1} />)}
      <circle cx={vx} cy={vy} r={Math.min(W, H) * 0.12} fill={pal.accent} opacity={0.18} style={{ filter: 'blur(14px)' }} />
    </g>
  );
}
function Type({ W, H, pal, text }: { W: number; H: number; pal: Pal; text: string }) {
  const fs = Math.min(W, H) * 0.58;
  return (
    <g fontFamily="Cairo, system-ui, sans-serif" fontWeight={900} fontSize={fs} textAnchor="middle">
      <text x={W / 2 + fs * 0.03} y={H / 2 + fs * 0.36} fill="none" stroke={pal.light} strokeOpacity={0.35} strokeWidth={fs * 0.012}>{text}</text>
      <text x={W / 2} y={H / 2 + fs * 0.33} fill={pal.accent}>{text}</text>
    </g>
  );
}

export function Cover({ spec, ratio = 'wide', className = '', grain = true, children }: { spec: CoverSpec; ratio?: CoverRatio; className?: string; grain?: boolean; children?: React.ReactNode }) {
  const id = useId().replace(/[:]/g, '');
  const [W, H] = SIZE[ratio]; const pal = PAL[spec.hue]; const r = rng((spec.seed ?? 7) + spec.art.length * 13 + spec.hue.length);
  const isLight = spec.hue === 'cream';
  return (
    <svg className={`cover ${className}`} viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={pal.a} /><stop offset="0.55" stopColor={pal.b} /><stop offset="1" stopColor={pal.c} /></linearGradient>
        <radialGradient id={`${id}-lt`} cx="0.85" cy="0.05" r="0.9"><stop offset="0" stopColor={pal.light} stopOpacity={isLight ? 0.6 : 0.28} /><stop offset="0.6" stopColor={pal.light} stopOpacity="0" /></radialGradient>
        <filter id={`${id}-gr`} x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" /><feColorMatrix values="0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0.5 0" /></filter>
      </defs>
      <rect width={W} height={H} fill={`url(#${id}-bg)`} />
      {spec.art === 'gems' && <Gems W={W} H={H} pal={pal} r={r} />}
      {spec.art === 'dunes' && <Dunes W={W} H={H} pal={pal} r={r} />}
      {spec.art === 'arch' && <Arch W={W} H={H} pal={pal} />}
      {spec.art === 'star' && <Star W={W} H={H} pal={pal} id={id} />}
      {spec.art === 'bokeh' && <Bokeh W={W} H={H} pal={pal} r={r} />}
      {spec.art === 'waves' && <Waves W={W} H={H} pal={pal} />}
      {spec.art === 'grid' && <Grid W={W} H={H} pal={pal} />}
      {spec.art === 'type' && <Type W={W} H={H} pal={pal} text={spec.text || '٩٦'} />}
      <rect width={W} height={H} fill={`url(#${id}-lt)`} />
      {grain ? <rect width={W} height={H} filter={`url(#${id}-gr)`} opacity={0.16} style={{ mixBlendMode: 'overlay' }} /> : null}
      {children}
    </svg>
  );
}

/** لون الحلقة والخلفية لأيقونة القطاع */
export const HUE_CSS: Record<Hue, { bg: string; fg: string }> = {
  green: { bg: 'linear-gradient(150deg,#1f8a58,#0b4a2f)', fg: '#fff' }, gold: { bg: 'linear-gradient(150deg,#e0c88a,#a8863f)', fg: '#fff' }, cream: { bg: 'linear-gradient(150deg,#fbf6e8,#e9dfc4)', fg: '#0b4a2f' },
  teal: { bg: 'linear-gradient(150deg,#4c9e93,#1f5f57)', fg: '#fff' }, bronze: { bg: 'linear-gradient(150deg,#b3925c,#6e5424)', fg: '#fff' }, night: { bg: 'linear-gradient(150deg,#1f4d38,#06331f)', fg: '#e6f2ea' }, sage: { bg: 'linear-gradient(150deg,#7fb08a,#3f7a52)', fg: '#fff' },
};
