/* My settings (prototype screens/Me.tsx Settings): language, appearance and text size — saved for the person, so every
   device shows the same — then the account and signing out. The prototype's review tools (personas, phone frame,
   demo reset) are not part of the portal. What reaches you arrives with notifications (1.4). */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { logout, type Appearance, type Preferences, type TextSize } from '@usp/api-client';
import { useI18n } from '@usp/i18n';
import { Avatar, Cell, Group, I, Mark, PageChrome, Segmented, useIsland } from '@usp/ui-web';
import { DEFAULT_PREFERENCES, usePreferences, useSavePreferences } from '../../app/preferences';
import { useSession } from '../../app/session';

export default function SettingsPage() {
  const { t, text, lang, languages } = useI18n(); const qc = useQueryClient(); const session = useSession(); const toast = useIsland();
  const prefs = usePreferences().data ?? DEFAULT_PREFERENCES; const save = useSavePreferences();
  const change = (patch: Partial<Preferences>) => save.mutate({ ...prefs, ...patch }, { onError: () => toast({ title: t('common.saveFailed'), icon: 'alert', tone: 'danger' }) });
  const out = useMutation({ mutationFn: logout, onSettled: () => { qc.clear(); location.assign('/login'); } });
  const name = session ? text(session.name) || session.username : '';
  return (
    <PageChrome title={t('me.settings')} back="/me">
      <Group>
        {languages.length > 1 ? (
          <div className="cell set-row"><span className="cell-lead plain"><I.globe /></span><span className="cell-main"><span className="cell-title">{t('settings.language')}</span></span>
            <span className="cell-trail"><Segmented id="lbs-lang" value={lang} onChange={(v) => change({ language: v })} options={languages.map((l) => ({ v: l.code, label: l.nativeName }))} /></span></div>
        ) : null}
        <div className="cell set-row"><span className="cell-lead plain"><I.moon /></span><span className="cell-main"><span className="cell-title">{t('settings.appearance')}</span></span>
          <span className="cell-trail"><Segmented<Appearance> id="lbs-theme" value={prefs.theme} onChange={(v) => change({ theme: v })} options={[{ v: 'auto', label: t('settings.auto') }, { v: 'light', label: t('settings.light') }, { v: 'dark', label: t('settings.dark') }]} /></span></div>
        <div className="cell set-row"><span className="cell-lead plain"><I.pen /></span><span className="cell-main"><span className="cell-title">{t('settings.textSize')}</span><span className="cell-sub">{t('settings.textSizeHint')}</span></span>
          <span className="cell-trail"><Segmented<TextSize> id="lbs-text" value={prefs.textSize} onChange={(v) => change({ textSize: v })} options={[{ v: 'normal', label: t('settings.size.normal') }, { v: 'large', label: t('settings.size.large') }, { v: 'xl', label: t('settings.size.xl') }]} /></span></div>
      </Group>
      <div className="lb-head sm"><h2>{t('settings.account')}</h2></div>
      <Group>
        <div className="cell"><Avatar name={name} /><span className="cell-main"><span className="cell-title">{name}</span><span className="cell-sub"><span className="mono">{session?.employeeNo ? t('me.cardNo', { n: session.employeeNo }) : session?.username}</span></span></span></div>
        <Cell icon="open" tone="plain" title={t('common.signOut')} onClick={() => out.mutate()} chevron={false} />
      </Group>
      <p className="lb-muted lb-foot-note"><Mark size={18} /> {t('common.org')} · {t('common.appName')}</p>
    </PageChrome>
  );
}
