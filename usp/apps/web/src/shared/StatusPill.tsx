import type { RequestStatus } from '@usp/api-client';
import { useI18n } from '@usp/i18n';
import { Pill, type IconName } from '@usp/ui-web';

/** The prototype's status tones (statusTone): in review = tint, returned = warn, rejected = danger, completed = done. */
const TONE: Record<RequestStatus, [string, IconName?]> = {
  in_review: ['tint'], returned: ['warn', 'ret'], rejected: ['danger', 'x'], completed: ['done', 'check'], withdrawn: [''],
};

export function StatusPill({ status }: { status: RequestStatus }) {
  const { t } = useI18n();
  const [tone, icon] = TONE[status];
  return <Pill tone={tone} icon={icon}>{t(`status.${status}`)}</Pill>;
}
