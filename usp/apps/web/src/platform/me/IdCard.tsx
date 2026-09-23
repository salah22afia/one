/* The digital employee card (prototype screens/Me.tsx IdCard): the face is read at a glance; flipped, its back shows a
   QR code the portal signed for a short time, which anyone can scan to check the card (owner decision 2026-09-23). */
import { useQuery } from '@tanstack/react-query';
import { getCard, getProfile } from '@usp/api-client';
import { useI18n } from '@usp/i18n';
import { I, QrCode, Tilt } from '@usp/ui-web';
import emblem from '@usp/ui-web/emblem.png';

export function IdCard({ flipped, onFlip }: { flipped: boolean; onFlip: () => void }) {
  const { t, text, date } = useI18n();
  // A fresh code each time the card is shown after an hour; the code itself is valid for longer (usp.card.code-validity).
  const card = useQuery({ queryKey: ['me', 'card'], queryFn: getCard, staleTime: 3_600_000 }).data;
  const profile = useQuery({ queryKey: ['me', 'profile'], queryFn: getProfile, staleTime: 60_000 }).data;
  const name = text(card?.name ?? profile?.name); const no = card?.employeeNo ?? profile?.employeeNo ?? '';
  const role = [text(profile?.title), text(profile?.unit)].filter(Boolean).join(' · ');
  return (
    <Tilt className="idcard-tilt" flipped={flipped} onFlip={onFlip} back={
      <section className="idcard back" aria-hidden={!flipped}>
        <div className="orn" />
        <div className="id-top"><div className="id-org">{t('common.org')}<small>{t('card.backTitle')}</small></div><img className="id-emblem" src={emblem} alt="" /></div>
        <div className="id-back-body">
          <div className="qr lg">{card ? <QrCode size={card.qr.size} path={card.qr.path} label={t('card.scan')} /> : null}</div>
          <div className="id-back-txt">
            <b className="mono">{no ? t('me.cardNo', { n: no }) : ''}</b>
            <span>{t('card.scan')}</span>
            {card ? <span className="id-valid">{t('card.validUntil', { t: date(card.expiresAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) })}</span> : null}
          </div>
        </div>
      </section>
    }>
      <section className="idcard" aria-label={t('card.label')}>
        <div className="orn" />
        <div className="id-shine" aria-hidden="true" />
        <div className="id-top"><div className="id-org">{t('common.org')}<small>{t('card.issuer')}</small></div><img className="id-emblem" src={emblem} alt="" /></div>
        <div><div className="id-name">{name}</div><div className="id-title">{role}</div></div>
        <div className="id-bottom"><div className="id-no">{t('me.employeeNo')}<b>{no ? t('me.cardNo', { n: no }) : ''}</b></div><div className="id-flip-hint"><I.reset />{t('card.flip')}</div></div>
      </section>
    </Tilt>
  );
}
