import { useParams } from 'react-router';
import { useI18n } from '@usp/i18n';
import { PageChrome } from '@usp/ui-web';
import { DocumentViewer } from './DocumentViewer';

/** The issued document exactly as rendered by the server; print from the browser or download the server PDF. */
export default function DocumentPage() {
  const { id = '' } = useParams();
  const { t } = useI18n();
  return (
    <PageChrome title={t('documents.title')} back="/requests">
      <DocumentViewer id={id} name={id} />
    </PageChrome>
  );
}
