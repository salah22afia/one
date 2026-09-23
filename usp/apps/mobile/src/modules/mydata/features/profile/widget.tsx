import { router } from 'expo-router';
import { expiryState } from '@usp/api-client';
import { useI18n } from '@usp/i18n';
import { MeTile } from '../../../../shared/kit';
import { useMyDocuments } from '../documents/queries';

/** "My data" on Me: how complete the file is — the share of documents not expiring (the prototype's measure). */
export function MyDataWidget() {
  const { t } = useI18n(); const docs = useMyDocuments().data ?? [];
  const expiring = docs.filter((d) => expiryState(d.expiresOn) !== 'valid').length;
  const completeness = Math.round(((docs.length - expiring) / Math.max(1, docs.length)) * 100);
  return <MeTile icon="person" title={t('me.data')} value={`${completeness}%`} sub={completeness < 100 ? t('me.completeProfile') : t('me.profileOk')} warn={completeness < 100} onPress={() => router.push('/mydata/profile')} />;
}
