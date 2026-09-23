import { PageChrome } from '@usp/ui-web';
import { useRef } from 'react';
import { useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ApiError, getDocumentHtml } from '@usp/api-client';
import { useI18n } from '@usp/i18n';
import { PdfButton } from '../requests/RequestDetailPage';

/** The issued document exactly as rendered by the server; print from the browser or download the server PDF. */
export default function DocumentPage() {
  const { id = '' } = useParams();
  const { text } = useI18n();
  const frame = useRef<HTMLIFrameElement>(null);
  const q = useQuery({ queryKey: ['document-html', id], queryFn: () => getDocumentHtml(id) });
  if (q.isError) return <p className="error">{text((q.error as ApiError).title ?? { ar: 'تعذّر فتح المستند', en: 'Could not open the document' })}</p>;
  const title = q.data?.match(/<title>([^<]*)<\/title>/)?.[1] ?? 'document';
  return (
    <PageChrome title={title} back="/requests">
    <div className="stack">
      <div className="actions">
        <button className="btn primary" onClick={() => frame.current?.contentWindow?.print()} disabled={!q.data}>{text({ ar: 'طباعة / حفظ PDF من المتصفح', en: 'Print / save as PDF' })}</button>
        <PdfButton id={id} name={title} />
      </div>
      {q.data ? <iframe ref={frame} className="doc-frame" title={title} srcDoc={q.data} /> : null}
    </div>
    </PageChrome>
  );
}
