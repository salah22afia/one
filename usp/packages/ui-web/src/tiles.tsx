/* The Me screen's widget tile (prototype screens/Me.tsx Widget, C-UX-87): an icon, an optional big value, a title and a
   line under it; it opens its page. */
import type React from 'react';
import { Link } from 'react-router';
import { I, type IconName } from './icons';
import { motion, SPRING } from './motion';
import { useIntroSkip } from './shell';

const MotionLink = motion.create(Link);

export function MeTile({ to, icon, tone = '', title, value, sub, delay = 0, warn }: {
  to: string; icon: IconName; tone?: string; title: string; value?: React.ReactNode; sub?: React.ReactNode; delay?: number; warn?: boolean;
}) {
  const Ic = I[icon]; const skip = useIntroSkip();
  return (
    <MotionLink className={`mw ${warn ? 'warn' : ''}`} to={to} initial={skip ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING.soft, delay }} whileTap={{ scale: 0.975 }} role="listitem">
      <span className="mw-top"><span className={`wg-ic ${tone}`}><Ic /></span><I.chev className="dirchev mw-chev" /></span>
      <span className="mw-txt">{value !== undefined ? <b className="mw-val num">{value}</b> : null}<b className="mw-t">{title}</b>{sub ? <span>{sub}</span> : null}</span>
    </MotionLink>
  );
}

/** A QR code drawn from its module path (the server encodes it; no HTML is passed around). */
export function QrCode({ size, path, color = '#0b4a2f', label }: { size: number; path: string; color?: string; label?: string }) {
  return <svg viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}><path d={path} fill={color} /></svg>;
}
