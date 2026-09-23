/* My family (prototype screens/Me.tsx Family): each member with their relation and how long their document runs. */
import { Link } from 'react-router';
import { ApiError, daysUntil } from '@usp/api-client';
import { useI18n } from '@usp/i18n';
import { Cell, Empty, Group, I, PageChrome, Pill, useNow } from '@usp/ui-web';
import { useMyFamily } from '../queries';

export default function FamilyPage() {
  const { t, text, plural } = useI18n(); const now = useNow(); const q = useMyFamily(); const members = q.data ?? [];
  const docPill = (iso: string) => {
    const n = daysUntil(iso, now);
    return n < 0 ? <Pill tone="danger">{t('me.expired')}</Pill> : n <= 30 ? <Pill tone={n <= 15 ? 'danger' : 'warn'} icon="alert">{plural('me.daysLeft', n)}</Pill> : <Pill tone="done">{t('me.valid')}</Pill>;
  };
  return (
    <PageChrome title={t('me.family')} back="/me" end={<Link className="btn soft sm" to="/services/MD"><I.plus />{t('me.addDependant')}</Link>}>
      {q.isError ? <div className="lb-empty"><Empty icon="family" title={q.error instanceof ApiError && q.error.title ? text(q.error.title) : t('me.unavailable')} /></div>
        : !q.data ? null
        : members.length ? <Group>{members.map((m) => <Cell key={m.id} icon="family" tone="plain" title={text(m.name)} sub={text(m.relation)} pill={m.documentExpiresOn ? docPill(m.documentExpiresOn) : undefined} chevron={false} />)}</Group>
        : <div className="lb-empty"><Empty icon="family" title={t('me.noFamily')} /></div>}
    </PageChrome>
  );
}
