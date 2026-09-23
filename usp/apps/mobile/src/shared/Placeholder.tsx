import { useI18n, type LocalizedText } from '@usp/i18n';
import { Screen, T } from './ui';
import { useTheme } from './theme';

/** Stand-in screen for a scaffolded feature until it is implemented. */
export function Placeholder({ title, feature, root, person }: { title: LocalizedText; feature: string; root?: boolean; person?: string }) {
  const { t, text } = useI18n(); const th = useTheme();
  return (
    <Screen title={text(title)} root={root} back={!root} person={person}>
      <T size={13} color={th.fg3}>{feature}</T>
      <T color={th.fg2}>{t('common.skeleton')}</T>
    </Screen>
  );
}
