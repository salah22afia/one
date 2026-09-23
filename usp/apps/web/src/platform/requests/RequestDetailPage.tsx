import { PageChrome } from '@usp/ui-web';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, decide, getDocumentPdf, getRequest, type DecisionAction, type StepDetail } from '@usp/api-client';
import { useI18n } from '@usp/i18n';
import { StatusPill } from '../../shared/StatusPill';
import { fmtDate } from '../../shared/format';

/** Request detail: data, timeline with who is on each step now, decisions for the current assignee, documents, audit. */
export default function RequestDetailPage() {
  const { id = '' } = useParams();
  const { text, lang } = useI18n();
  const q = useQuery({ queryKey: ['request', id], queryFn: () => getRequest(id) });
  if (q.isPending) return null;
  if (q.isError) return <p className="error">{text((q.error as ApiError).title ?? { ar: 'تعذّر فتح الطلب', en: 'Could not open the request' })}</p>;
  const { request: r, fields, steps, documents, audit } = q.data;
  const mine = steps.find((s) => s.mine);
  return (
    <PageChrome title={text(r.serviceName)} sub={`${r.id} · ${text(r.requester.name)} · ${fmtDate(r.createdAt, lang, true)}`} back="/requests" end={<StatusPill status={r.status} />}>
    <div className="stack">

      {mine ? <DecisionPanel step={mine} requestId={r.id} /> : null}

      <div className="card">
        <b>{text({ ar: 'بيانات الطلب', en: 'Request data' })}</b>
        <dl className="fields">{fields.map((f) => <div key={f.key}><dt>{text(f.label)}</dt><dd>{text(f.display)}</dd></div>)}</dl>
      </div>

      {documents.length ? (
        <div className="card">
          <b>{text({ ar: 'المستندات الصادرة', en: 'Issued documents' })}</b>
          {documents.map((d) => (
            <div key={d.id} className="hrow">
              <span><b>{text(d.title)}</b><small className="mono muted">{d.number} · {d.verifyCode}</small></span>
              <span className="actions">
                <Link className="btn" to={`/documents/${d.id}`}>{text({ ar: 'عرض وطباعة', en: 'View & print' })}</Link>
                <PdfButton id={d.id} name={d.number} />
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="card">
        <b>{text({ ar: 'مسار الطلب', en: 'Route' })}</b>
        <ol className="timeline">
          {steps.map((s) => (
            <li key={s.id} data-status={s.status}>
              <div className="hrow"><b>{text(s.title)}</b><StatusPill status={s.status} /></div>
              {s.actor ? <small>{text(s.actor.name)} · {text(s.actor.title)} · {fmtDate(s.completedAt, lang, true)}</small>
                : s.assignees.length ? <small>{text({ ar: 'عند: ', en: 'With: ' })}{s.assignees.map((a) => text(a.name)).join('، ')}</small> : null}
              {s.why ? <small className="muted">{text(s.why)}</small> : null}
              {s.ref ? <small className="mono">{text({ ar: 'المرجع: ', en: 'Ref: ' })}{s.ref}</small> : null}
              {s.note ? <small>“{s.note}”</small> : null}
              {s.status === 'current' && s.dueAt ? <small className="muted">{text({ ar: 'المهلة حتى ', en: 'Due ' })}{fmtDate(s.dueAt, lang, true)}</small> : null}
            </li>
          ))}
        </ol>
      </div>

      <details className="card">
        <summary><b>{text({ ar: 'سجل الطلب', en: 'Audit trail' })}</b></summary>
        <ul className="audit">{audit.map((a, i) => <li key={i}><small className="muted">{fmtDate(a.at, lang, true)}</small> {text(a.what)}{a.actor ? ` — ${text(a.actor.name)}` : ''}</li>)}</ul>
      </details>
    </div>
    </PageChrome>
  );
}

function DecisionPanel({ step, requestId }: { step: StepDetail; requestId: string }) {
  const { text } = useI18n();
  const qc = useQueryClient();
  const [note, setNote] = useState('');
  const [ref, setRef] = useState('');
  const m = useMutation({
    mutationFn: (action: DecisionAction) => decide(step.id, action, note || undefined, ref || undefined),
    onSuccess: (d) => { qc.setQueryData(['request', requestId], d); qc.invalidateQueries({ queryKey: ['tasks'] }); },
  });
  const err = m.error instanceof ApiError ? m.error : null;
  return (
    <div className="card decision">
      <b>{text({ ar: 'بانتظار قرارك', en: 'Awaiting your decision' })}: {text(step.title)}</b>
      {step.mode === 'fulfil' ? <label className="dyn-field"><span>{text({ ar: 'مرجع التنفيذ', en: 'Fulfilment reference' })} *</span><input value={ref} onChange={(e) => setRef(e.target.value)} /></label> : null}
      <label className="dyn-field"><span>{text({ ar: 'ملاحظة (إلزامية عند الرفض)', en: 'Note (required to reject)' })}</span><textarea value={note} onChange={(e) => setNote(e.target.value)} /></label>
      {err ? <p className="error">{text(err.checks[0]?.text ?? err.title ?? { ar: 'تعذّر', en: 'Failed' })}</p> : null}
      <div className="actions">
        {step.mode === 'approve' ? <button className="btn primary" disabled={m.isPending} onClick={() => m.mutate('approve')}>{text({ ar: 'اعتماد', en: 'Approve' })}</button> : null}
        {step.mode === 'fulfil' ? <button className="btn primary" disabled={m.isPending} onClick={() => m.mutate('done')}>{text({ ar: 'تم التنفيذ', en: 'Done' })}</button> : null}
        {step.mode === 'receipt' ? <button className="btn primary" disabled={m.isPending} onClick={() => m.mutate('receive')}>{text({ ar: 'استلمت', en: 'Received' })}</button> : null}
        {step.mode !== 'receipt' ? <button className="btn danger" disabled={m.isPending} onClick={() => m.mutate('reject')}>{text({ ar: 'رفض', en: 'Reject' })}</button> : null}
      </div>
    </div>
  );
}

/** Fetches the PDF with the caller's credentials, then saves it (a plain link could not send them). */
export function PdfButton({ id, name }: { id: string; name: string }) {
  const { text } = useI18n();
  const m = useMutation({
    mutationFn: () => getDocumentPdf(id),
    onSuccess: (blob) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${name}.pdf`; a.click(); URL.revokeObjectURL(a.href); },
  });
  return (
    <>
      <button className="btn" disabled={m.isPending} onClick={() => m.mutate()}>{m.isPending ? '…' : text({ ar: 'تنزيل PDF', en: 'Download PDF' })}</button>
      {m.isError ? <small className="error">{text((m.error as ApiError).title ?? { ar: 'تعذّر إنشاء PDF', en: 'PDF failed' })}</small> : null}
    </>
  );
}
