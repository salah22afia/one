import { REQUEST_STATUS, STEP_STATUS, type RequestStatus, type StepStatus } from '@usp/api-client';
import { useI18n } from '@usp/i18n';
import { Pill, type IconName } from '@usp/ui-web';

/** The prototype's status tones: in review = tint, returned/waiting = warn, rejected = danger, completed = done. */
const TONE: Record<string, [string, IconName?]> = {
  in_review: ['tint'], current: ['tint'], returned: ['warn', 'ret'], waiting: ['warn'], rejected: ['danger', 'x'],
  completed: ['done', 'check'], done: ['done', 'check'],
};

export function StatusPill({ status }: { status: RequestStatus | StepStatus }) {
  const { text } = useI18n();
  const label = (REQUEST_STATUS as Record<string, { ar: string; en: string }>)[status] ?? STEP_STATUS[status as StepStatus];
  const [tone = '', icon] = TONE[status] ?? [];
  return <Pill tone={tone} icon={icon}>{text(label)}</Pill>;
}
