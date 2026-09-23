import { useMutation, useQueryClient } from '@tanstack/react-query';
import { logout } from '@usp/api-client';
import { useI18n } from '@usp/i18n';
import { PageChrome } from '@usp/ui-web';

export default function SettingsPage() {
  const { t, lang, setLang, languages } = useI18n(); const queryClient = useQueryClient();
  const out = useMutation({ mutationFn: logout, onSettled: () => { queryClient.clear(); location.assign('/login'); } });
  return (
    <PageChrome title={t('common.settings')} back="/me">
      <div className="stack">
        <label>{t('common.language')}{' '}
          <select value={lang} onChange={(e) => setLang(e.target.value)}>
            {languages.map((l) => <option key={l.code} value={l.code}>{l.nativeName}</option>)}
          </select>
        </label>
        <button type="button" className="btn" onClick={() => out.mutate()} disabled={out.isPending}>{t('common.signOut')}</button>
      </div>
    </PageChrome>
  );
}
