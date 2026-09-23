import { useNavigate } from 'react-router';
import { useI18n } from '@usp/i18n';
import { Empty, I } from '@usp/ui-web';

/** A link to a screen this version does not have (prototype Placeholder). */
export default function NotFoundPage() {
  const { t } = useI18n(); const navigate = useNavigate();
  return (
    <div className="lb-page lb-ph">
      <div className="lb-ph-top"><button type="button" className="back-btn" onClick={() => navigate('/')}><I.chev className="backchev" />{t('notFound.backHome')}</button></div>
      <h1 className="lb-ph-title">{t('notFound.title')}</h1>
      <Empty icon="sparkle" title={t('notFound.title')} sub={t('notFound.sub')} />
    </div>
  );
}
