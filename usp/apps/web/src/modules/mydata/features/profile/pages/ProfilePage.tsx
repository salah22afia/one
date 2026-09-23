/* My data (prototype screens/Me.tsx MyData): contact and bank details (masked by the server) that open the services
   to change them, then what the system of record says — line manager, position, group, employee number. */
import { Link, useNavigate } from 'react-router';
import { ApiError } from '@usp/api-client';
import { useI18n } from '@usp/i18n';
import { Cell, Empty, Group, I, PageChrome } from '@usp/ui-web';
import { useProfile } from '../queries';

export default function ProfilePage() {
  const { t, text } = useI18n(); const navigate = useNavigate(); const q = useProfile(); const p = q.data;
  const join = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(' · ') || '—';
  return (
    <PageChrome title={t('me.data')} sub={t('me.dataSub')} back="/me" end={<Link className="btn soft sm" to="/new/MD-01"><I.pen />{t('me.update')}</Link>}>
      {q.isError ? <div className="lb-empty"><Empty icon="person" title={q.error instanceof ApiError && q.error.title ? text(q.error.title) : t('me.unavailable')} /></div> : null}
      {p ? (
        <>
          <Group>
            <Cell icon="person" tone="plain" title={t('me.mobile')} value={<span className="ltr">{p.mobile ?? '—'}</span>} onClick={() => navigate('/new/MD-01')} />
            <Cell icon="letter" tone="plain" title={t('me.email')} value={<span className="ltr">{p.email ?? '—'}</span>} onClick={() => navigate('/new/MD-01')} />
            <Cell icon="wallet" tone="plain" title={t('me.bank')} value={<span className="ltr">{p.bank?.iban ?? '—'}</span>} onClick={() => navigate('/new/MD-02')} />
          </Group>
          <div className="lb-head sm"><h2>{t('me.fromSap')}</h2></div>
          <Group>
            <Cell icon="team" tone="plain" title={t('me.manager')} sub={p.manager ? join(text(p.manager.name), text(p.manager.title)) : '—'} chevron={false} />
            <Cell icon="grid" tone="plain" title={t('me.position')} sub={join(text(p.title), p.positionId, text(p.unit))} chevron={false} />
            <Cell icon="idcard" tone="plain" title={t('me.group')} sub={join(text(p.group), text(p.subgroup), text(p.location))} chevron={false} />
            <Cell icon="idcard" tone="plain" title={t('me.employeeNo')} value={<span className="mono">{t('me.cardNo', { n: p.employeeNo })}</span>} chevron={false} />
          </Group>
        </>
      ) : null}
    </PageChrome>
  );
}
