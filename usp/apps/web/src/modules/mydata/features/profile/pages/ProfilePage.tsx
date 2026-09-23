import { PageChrome } from '@usp/ui-web';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ApiError, getProfile } from '@usp/api-client';
import { useI18n } from '@usp/i18n';

const hijri = (iso: string) => new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${iso}T12:00:00`));
const greg = (iso: string, ar: boolean) => new Intl.DateTimeFormat(ar ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${iso}T12:00:00`));

/** mydata.profile (ME-01): the employee's own data, read live from SAP on every visit and never stored by the portal. */
export default function ProfilePage() {
  const { t, text, lang } = useI18n();
  const q = useQuery({ queryKey: ['profile'], queryFn: getProfile, staleTime: 0, gcTime: 0 });
  return (
    <PageChrome title={text({ ar: 'ملفي', en: 'My profile' })} root end={<Link className="lb-link" to="/settings">{t('common.settings')}</Link>}>
      <div className="stack">
      {q.isPending ? <p className="muted">…</p> : null}
      {q.isError ? <p className="error" role="alert">{text((q.error as ApiError).title ?? { ar: 'تعذّر قراءة البيانات', en: 'Could not load your data' })}</p> : null}
      {q.data ? (
        <div className="card">
          <dl className="fields">
            <div><dt>{t('common.employeeNo')}</dt><dd className="mono">{q.data.employeeNo}</dd></div>
            <div><dt>{t('common.arabicName')}</dt><dd>{q.data.name.ar || '—'}</dd></div>
            <div><dt>{t('common.englishName')}</dt><dd>{q.data.name.en || '—'}</dd></div>
            <div><dt>{t('common.dateOfBirth')}</dt><dd>{q.data.dateOfBirth ? <>{greg(q.data.dateOfBirth, lang === 'ar')}<br /><small className="muted">{hijri(q.data.dateOfBirth)}</small></> : '—'}</dd></div>
          </dl>
          <small className="muted">{t('common.liveFromSap')}</small>
        </div>
      ) : null}
    </div></PageChrome>
  );
}
