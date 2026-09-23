import { useI18n } from '@usp/i18n';
import { MeTile } from '@usp/ui-web';
import { useMyFamily } from './queries';

export function FamilyWidget({ delay }: { delay: number }) {
  const { t, plural } = useI18n(); const q = useMyFamily(); const n = q.data?.length ?? 0;
  return <MeTile to="/me/family" icon="family" tone="sage" title={t('me.family')} value={q.data ? n : '—'} sub={plural('me.members', n)} delay={delay} />;
}
