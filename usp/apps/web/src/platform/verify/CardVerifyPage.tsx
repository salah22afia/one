import { useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { verifyCard } from '@usp/api-client';
import { useI18n } from '@usp/i18n';
import { fmtDate } from '../../shared/format';

/** Public check of a digital employee card's QR code (signed by the portal for a short time). No sign-in needed. */
export default function CardVerifyPage() {
  const { code = '' } = useParams(); const { t, text, lang } = useI18n();
  const q = useQuery({ queryKey: ['verify-card', code], queryFn: () => verifyCard(code), enabled: !!code, retry: false });
  const c = q.data;
  return (
    <section className="stack">
      <h1>{t('card.verifyTitle')}</h1>
      {c ? (
        c.valid || c.expired ? (
          <div className="card" data-ok={c.valid}>
            <b>{c.valid ? t('card.genuine') : t('card.expiredCode')}</b>
            <dl className="fields">
              <div><dt>{t('card.holder')}</dt><dd>{text(c.name)}</dd></div>
              <div><dt>{t('me.employeeNo')}</dt><dd className="mono">{c.employeeNo ? t('me.cardNo', { n: c.employeeNo }) : ''}</dd></div>
              <div><dt>{t('card.validUntilLabel')}</dt><dd>{fmtDate(c.expiresAt, lang, true)}</dd></div>
            </dl>
          </div>
        ) : <p className="error">{t('card.invalid')}</p>
      ) : q.isError ? <p className="error">{t('common.loadFailed')}</p> : null}
    </section>
  );
}
