import React from 'react';

/** زخرفة الرأس: «المعيّن» السداسي من قلب شعار الأمانة العامة، مجرّداً من الشعار نفسه، يطفو ذهبياً مفرّغاً بأحجام وأعماق مختلفة.
 *  v0.2.4: المعيّن خطوط فقط بلا تعبئة — إطار سداسي خارجي، وسداسي داخلي بإزاحة منظورية، وستة أضلاع شطف تصل بينهما،
 *  فيُقرأ كإطار ذهبي مجوّف يُضاء من أعلى اليسار. القريب حاد والبعيد مموّه، وحولها هالة ذهبية خفيفة، وكلها تتنفس ببطء. */
function hex(R: number, cx = 0, cy = 0): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < 6; i++) { const a = (Math.PI / 3) * i; pts.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]); }
  return pts;
}
const EDGE_ALPHA = [0.55, 0.38, 0.32, 0.42, 0.85, 0.72]; // الإضاءة من أعلى اليسار: الأضلاع العلوية أسطع
const EDGE_COLOR = ['#e8d49a', '#c9a85c', '#bf9d52', '#c9a85c', '#fff1c9', '#f1dea9'];

function Gem({ x, y, r, blur, alpha, dur, delay, id }: { x: number; y: number; r: number; blur: number; alpha: number; dur: number; delay: number; id: string }) {
  const outer = hex(r); const inner = hex(r * 0.66, r * 0.05, -r * 0.06);
  const P = (p: [number, number][]) => p.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ');
  const wOuter = r * 0.028, wInner = r * 0.015, wEdge = r * 0.011;
  return (
    <g className="gem" style={{ ['--gx' as string]: `${x}px`, ['--gy' as string]: `${y}px`, ['--dur' as string]: `${dur}s`, ['--delay' as string]: `${delay}s` }} filter={`url(#${id}-fx)`} opacity={alpha} fill="none" strokeLinejoin="round" strokeLinecap="round">
      <defs>
        <filter id={`${id}-fx`} x="-40%" y="-40%" width="180%" height="180%">
          {blur ? <feGaussianBlur stdDeviation={blur} /> : null}
          <feDropShadow dx="0" dy="0" stdDeviation={r * 0.035} floodColor="#e2c98a" floodOpacity="0.55" />
          <feDropShadow dx="0" dy={r * 0.05} stdDeviation={r * 0.09} floodColor="#b5944d" floodOpacity="0.22" />
        </filter>
        <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stopColor="#fff6dc" stopOpacity="0.98" /><stop offset="0.55" stopColor="#e2c98a" stopOpacity="0.85" /><stop offset="1" stopColor="#b5944d" stopOpacity="0.55" /></linearGradient>
      </defs>
      {outer.map((p, i) => { const q = inner[i]; return <line key={i} x1={p[0].toFixed(1)} y1={p[1].toFixed(1)} x2={q[0].toFixed(1)} y2={q[1].toFixed(1)} stroke={EDGE_COLOR[i]} strokeOpacity={EDGE_ALPHA[i]} strokeWidth={wEdge} />; })}
      <polygon points={P(inner)} stroke="#fff6dc" strokeOpacity="0.62" strokeWidth={wInner} />
      <polygon points={P(outer)} stroke={`url(#${id}-rim)`} strokeWidth={wOuter} />
    </g>
  );
}

export function HeroArt() {
  return (
    <svg className="hero-art" viewBox="0 0 640 400" preserveAspectRatio="xMaxYMid meet" aria-hidden="true">
      <Gem id="g1" x={455} y={300} r={170} blur={0} alpha={0.92} dur={13} delay={0} />
      <Gem id="g2" x={230} y={150} r={92} blur={1.1} alpha={0.78} dur={11} delay={-4} />
      <Gem id="g3" x={330} y={58} r={46} blur={2.2} alpha={0.58} dur={9} delay={-2} />
      <Gem id="g4" x={110} y={330} r={58} blur={2.8} alpha={0.48} dur={15} delay={-7} />
    </svg>
  );
}
