/* My settings on the phone (prototype screens/Me.tsx Settings): language, appearance and text size — saved for the
   person, so the web shows the same — then the account and signing out. */
import type { ReactNode } from 'react';
import { View } from 'react-native';
import type { Appearance, Preferences, TextSize } from '@usp/api-client';
import { useI18n } from '@usp/i18n';
import { Cell, Group, Segmented, useIsland } from '../../shared/kit';
import { type, useTheme } from '../../shared/theme';
import { Screen, T } from '../../shared/ui';
import { useAuth, useMeName } from '../auth/auth';
import { DEFAULT_PREFERENCES, usePreferences, useSavePreferences } from './preferences';

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  const th = useTheme();
  return (
    <View style={{ gap: 8, paddingVertical: 12, paddingHorizontal: 16, borderTopWidth: 1, borderColor: th.hair2 }}>
      <T weight="bold">{label}</T>
      {hint ? <T size={type.sub} color={th.fg2}>{hint}</T> : null}
      {children}
    </View>
  );
}

export default function SettingsScreen() {
  const { t, lang, languages } = useI18n(); const th = useTheme(); const { state, signOut } = useAuth(); const me = useMeName(); const toast = useIsland();
  const prefs = usePreferences().data ?? DEFAULT_PREFERENCES; const save = useSavePreferences();
  const change = (patch: Partial<Preferences>) => save.mutate({ ...prefs, ...patch }, { onError: () => toast({ title: t('common.saveFailed'), icon: 'alert', tone: 'danger' }) });
  const employeeNo = state.status === 'signedIn' ? state.session.employeeNo : null;
  return (
    <Screen title={t('me.settings')} back>
      <Group>
        {languages.length > 1 ? <Row label={t('settings.language')}><Segmented value={lang} onChange={(v) => change({ language: v })} options={languages.map((l) => ({ v: l.code, label: l.nativeName }))} /></Row> : null}
        <Row label={t('settings.appearance')}><Segmented<Appearance> value={prefs.theme} onChange={(v) => change({ theme: v })} options={[{ v: 'auto', label: t('settings.auto') }, { v: 'light', label: t('settings.light') }, { v: 'dark', label: t('settings.dark') }]} /></Row>
        <Row label={t('settings.textSize')} hint={t('settings.textSizeHint')}><Segmented<TextSize> value={prefs.textSize} onChange={(v) => change({ textSize: v })} options={[{ v: 'normal', label: t('settings.size.normal') }, { v: 'large', label: t('settings.size.large') }, { v: 'xl', label: t('settings.size.xl') }]} /></Row>
      </Group>
      <View style={{ paddingTop: 8 }}><T weight="heavy" size={type.headline}>{t('settings.account')}</T></View>
      <Group>
        <Cell first icon="person" title={me ?? ''} sub={employeeNo ? t('me.cardNo', { n: employeeNo }) : undefined} />
        <Cell icon="open" title={t('common.signOut')} onPress={() => { void signOut(); }} chevron={false} />
      </Group>
      <T size={type.foot} color={th.fg3} style={{ textAlign: 'center', marginTop: 8 }}>{t('common.org')} · {t('common.appName')}</T>
    </Screen>
  );
}
