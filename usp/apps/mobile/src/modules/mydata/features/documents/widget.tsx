import { router } from 'expo-router';
import { expiryState } from '@usp/api-client';
import { useI18n } from '@usp/i18n';
import { MeTile } from '../../../../shared/kit';
import { useMyDocuments } from './queries';

export function DocumentsWidget() {
  const { t } = useI18n(); const q = useMyDocuments(); const docs = q.data ?? [];
  const expiring = docs.filter((d) => expiryState(d.expiresOn) !== 'valid').length;
  return <MeTile icon="passport" tone="gold" title={t('me.docs')} value={q.data ? String(docs.length) : '—'} sub={expiring ? t('me.docsExpiring', { n: expiring }) : t('me.docsOk')} warn={expiring > 0} onPress={() => router.push('/mydata/documents')} />;
}
