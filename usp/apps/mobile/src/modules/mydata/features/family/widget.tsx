import { router } from 'expo-router';
import { useI18n } from '@usp/i18n';
import { MeTile } from '../../../../shared/kit';
import { useMyFamily } from './queries';

export function FamilyWidget() {
  const { t, plural } = useI18n(); const q = useMyFamily(); const n = q.data?.length ?? 0;
  return <MeTile icon="family" tone="sage" title={t('me.family')} value={q.data ? String(n) : '—'} sub={plural('me.members', n)} onPress={() => router.push('/mydata/family')} />;
}
