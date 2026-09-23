import { PageChrome } from '@usp/ui-web';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ApiError, apiGet, submitRequest } from '@usp/api-client';
import { blocks, validate, type Check, type FormData, type ServiceDefinition } from '@usp/forms-core';
import { DynamicForm } from '@usp/forms-web';
import { useI18n } from '@usp/i18n';

/** Runs any configured service from its definition (no service-specific code). The server re-validates on submit. */
export default function DynamicServicePage() {
  const { serviceId = '' } = useParams();
  const { text } = useI18n();
  const navigate = useNavigate();
  const [data, setData] = useState<FormData>({});
  const [tried, setTried] = useState(false);
  const [serverChecks, setServerChecks] = useState<Check[]>([]);
  const q = useQuery({ queryKey: ['service', serviceId], queryFn: () => apiGet<ServiceDefinition>(`/services/${serviceId}/definition`) });
  const submit = useMutation({
    mutationFn: () => submitRequest(serviceId, data, 'web'),
    onSuccess: (d) => navigate(`/requests/${d.request.id}`),
    onError: (e) => setServerChecks(e instanceof ApiError ? e.checks : []),
  });
  if (q.isPending) return null;
  if (q.isError) return <p className="muted">{serviceId}: {text({ ar: 'الخدمة غير متاحة', en: 'service not available' })}</p>;
  const checks = tried ? [...validate(q.data, data), ...serverChecks] : [];
  return (
    <PageChrome title={text(q.data.name)} back="/services">
      <div className="stack">
      <DynamicForm def={q.data} value={data} onChange={(v) => { setData(v); setServerChecks([]); }} checks={checks} />
      {q.data.next ? <p className="note">{text(q.data.next)}</p> : null}
      {submit.isError && !(submit.error instanceof ApiError && submit.error.checks.length) ? <p className="error">{text((submit.error as ApiError).title ?? { ar: 'تعذّر الإرسال', en: 'Could not submit' })}</p> : null}
      <div className="actions">
        <button className="btn primary" disabled={submit.isPending} onClick={() => {
          setTried(true);
          if (!blocks(validate(q.data, data))) submit.mutate();
        }}>{text({ ar: 'إرسال الطلب', en: 'Submit request' })}</button>
      </div>
    </div></PageChrome>
  );
}
