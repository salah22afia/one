import { expiryState } from '@usp/api-client';
import { useI18n } from '@usp/i18n';
import { MeTile } from '@usp/ui-web';
import { useMyDocuments } from './queries';

export function DocumentsWidget({ delay }: { delay: number }) {
  const { t } = useI18n(); const q = useMyDocuments(); const docs = q.data ?? [];
  const expiring = docs.filter((d) => expiryState(d.expiresOn) !== 'valid').length;
  return <MeTile to="/me/docs" icon="passport" tone="gold" title={t('me.docs')} value={q.data ? docs.length : '—'} sub={expiring ? t('me.docsExpiring', { n: expiring }) : t('me.docsOk')} warn={expiring > 0} delay={delay} />;
}
