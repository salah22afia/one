import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { I } from './icons';
import { motion } from './motion';
import { useLang } from './components';

/** طباعة مستند وحده: يُرسم في حاضنة خارج الصدفة، ويُخفى كل ما عداه أثناء الطباعة، ثم تُزال */
function host(): HTMLElement {
  let el = document.getElementById('print-host');
  if (!el) { el = document.createElement('div'); el.id = 'print-host'; el.className = 'print-host'; document.body.appendChild(el); }
  return el;
}
export function usePrint(): [boolean, () => void, (node: React.ReactNode) => React.ReactPortal | null] {
  const [on, setOn] = useState(false); const armed = useRef(false);
  useEffect(() => {
    if (!on) return;
    document.body.classList.add('printing');
    const done = () => { document.body.classList.remove('printing'); setOn(false); armed.current = false; };
    window.addEventListener('afterprint', done, { once: true });
    const h = window.setTimeout(() => { try { window.print(); } catch { /* لا طباعة */ } window.setTimeout(done, 1500); }, 120);
    return () => { window.clearTimeout(h); window.removeEventListener('afterprint', done); };
  }, [on]);
  const start = () => { if (!armed.current) { armed.current = true; setOn(true); } };
  const portal = (node: React.ReactNode) => (on ? createPortal(<div className="print-page">{node}</div>, host()) : null);
  return [on, start, portal];
}
export function PrintButton({ onClick, label }: { onClick: () => void; label?: string }) {
  const { t } = useLang();
  return <motion.button type="button" className="btn soft" onClick={onClick} whileTap={{ scale: 0.97 }}><I.open />{label || t.policy.print}</motion.button>;
}
