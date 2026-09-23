/* An issued document exactly as the server renders it (the official template), with print and the server PDF.
   Used by the document page and by the reader sheet the request page opens from a document's seal. */
import { useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { getDocumentHtml, getDocumentPdf } from '@usp/api-client';
import { useI18n } from '@usp/i18n';
import { I } from '@usp/ui-web';

export function DocumentViewer({ id, name }: { id: string; name: string }) {
  const { t } = useI18n();
  const frame = useRef<HTMLIFrameElement>(null);
  const q = useQuery({ queryKey: ['document-html', id], queryFn: () => getDocumentHtml(id) });
  if (q.isError) return <p className="lb-muted">{t('documents.unavailable')}</p>;
  return (
    <>
      <div className="btn-row doc-actions">
        <button type="button" className="btn secondary" onClick={() => frame.current?.contentWindow?.print()} disabled={!q.data}><I.doc />{t('documents.print')}</button>
        <PdfButton id={id} name={name} />
      </div>
      {q.data ? <iframe ref={frame} className="doc-frame" title={name} srcDoc={q.data} /> : null}
    </>
  );
}

/** Fetches the PDF with the caller's credentials, then saves it (a plain link could not send them). */
export function PdfButton({ id, name }: { id: string; name: string }) {
  const { t } = useI18n();
  const m = useMutation({
    mutationFn: () => getDocumentPdf(id),
    onSuccess: (blob) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${name}.pdf`; a.click(); URL.revokeObjectURL(a.href); },
  });
  return (
    <>
      <button type="button" className="btn secondary" disabled={m.isPending} onClick={() => m.mutate()}><I.download />{t('documents.pdf')}</button>
      {m.isError ? <small className="lb-muted">{t('documents.pdfFailed')}</small> : null}
    </>
  );
}
