import { useI18n, type LocalizedText } from '@usp/i18n';
import { PageChrome } from './shell';

export * from './icons';
export * from './motion';
export * from './components';
export * from './shell';
export * from './auth';
export * from './tiles';

/** Stand-in page for a scaffolded feature until it is implemented. */
export function Placeholder({ title, feature }: { title: LocalizedText; feature: string }) {
  const { t, text } = useI18n();
  return (
    <PageChrome title={text(title)} root>
      <p className="mono">{feature}</p>
      <p className="lb-muted">{t('common.skeleton')}</p>
    </PageChrome>
  );
}
