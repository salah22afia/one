/* My documents (prototype screens/Me.tsx Docs): a Wallet of pass cards, soonest expiry on top; tapping one brings it
   forward with its full number and the way to renew it (MD-05). */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ApiError, daysUntil, expiryState, getSession, type DocumentKind, type PersonalDocument } from '@usp/api-client';
import { useI18n } from '@usp/i18n';
import { AnimatePresence, Empty, I, PageChrome, motion, useNow, type IconName } from '@usp/ui-web';
import emblem from '@usp/ui-web/emblem.png';
import { useMyDocuments } from '../queries';

const ICON: Record<DocumentKind, IconName> = { passport: 'passport', id: 'idcard', card: 'card', licence: 'card', contract: 'doc', insurance: 'shield' };
const HUE: Record<DocumentKind, string> = { passport: 'night', id: 'green', card: 'gold', licence: 'bronze', contract: 'sage', insurance: 'teal' };

function PassCard({ d, front, onFront, now, employeeNo }: { d: PersonalDocument; front: boolean; onFront: () => void; now: number; employeeNo: string }) {
  const { t, text, date, plural } = useI18n(); const navigate = useNavigate(); const Ic = I[ICON[d.kind] ?? 'card'];
  const state = expiryState(d.expiresOn, now); const n = d.expiresOn ? daysUntil(d.expiresOn, now) : 0;
  const masked = d.number.length > 4 ? `${'•'.repeat(Math.min(6, d.number.length - 4))}${d.number.slice(-4)}` : d.number;
  return (
    <motion.div layout className={`pass hue-${HUE[d.kind] ?? 'gold'} ${state} ${front ? 'front' : ''}`} onClick={onFront} transition={{ type: 'spring', stiffness: 320, damping: 32 }} whileTap={{ scale: 0.985 }} role="button" tabIndex={0} aria-expanded={front}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onFront(); } }}>
      <span className="pass-orn" aria-hidden="true" />
      <div className="pass-head"><img className="pass-logo" src={emblem} alt="" /><span className="pass-org">{t('common.org')}</span><span className="pass-ic"><Ic /></span></div>
      <div className="pass-primary"><b>{text(d.title)}</b></div>
      <div className="pass-foot">
        <span className="pass-field"><small>{t('me.number')}</small><b className="num ltr">{front ? d.number : masked}</b></span>
        <span className="pass-field"><small>{t('me.expiresOn')}</small><b className="num">{d.expiresOn ? date(d.expiresOn, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</b></span>
        <span className={`pass-state ${state}`}>{state === 'expired' ? t('me.expired') : state === 'expiring' ? plural('me.daysLeft', n) : t('me.valid')}</span>
      </div>
      <AnimatePresence>{front ? (
        <motion.div className="pass-more" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.24 }}>
          <div className="pass-rows"><span><small>{t('me.issued')}</small><b>{t('me.issuer')}</b></span><span><small>{t('me.employeeNo')}</small><b className="mono">{t('me.cardNo', { n: employeeNo })}</b></span></div>
          <button type="button" className="btn soft block" onClick={(e) => { e.stopPropagation(); navigate('/new/MD-05'); }}><I.reset />{t('me.renew')}</button>
        </motion.div>
      ) : null}</AnimatePresence>
    </motion.div>
  );
}

export default function DocumentsPage() {
  const { t, text } = useI18n(); const now = useNow(); const q = useMyDocuments(); const [front, setFront] = useState<string | null>(null);
  const session = useQuery({ queryKey: ['session'], queryFn: getSession, staleTime: Infinity }).data;
  const docs = q.data ?? [];
  const ordered = front ? [...docs.filter((d) => d.id === front), ...docs.filter((d) => d.id !== front)] : docs;
  return (
    <PageChrome title={t('me.docs')} sub={t('me.walletSub')} back="/me" end={<Link className="btn soft sm" to="/new/MD-05"><I.plus />{t('me.update')}</Link>}>
      {q.isError ? <div className="lb-empty"><Empty icon="passport" title={q.error instanceof ApiError && q.error.title ? text(q.error.title) : t('me.unavailable')} /></div>
        : !q.data ? null
        : docs.length === 0 ? <div className="lb-empty"><Empty icon="passport" title={t('me.noDocs')} /></div>
        : (
          <div className={`wallet ${front ? 'has-front' : ''}`}>
            {ordered.map((d) => <PassCard key={d.id} d={d} now={now} employeeNo={session?.employeeNo ?? ''} front={front === d.id} onFront={() => setFront(front === d.id ? null : d.id)} />)}
          </div>
        )}
    </PageChrome>
  );
}
