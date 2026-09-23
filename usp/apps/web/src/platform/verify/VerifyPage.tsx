import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { verifyDocument } from '@usp/api-client';
import { useI18n } from '@usp/i18n';
import { fmtDate } from '../../shared/format';

/** Public verification of an issued document (code printed on it / QR). No sign-in needed. */
export default function VerifyPage() {
  const { code = '' } = useParams();
  const { text, lang } = useI18n();
  const navigate = useNavigate();
  const [input, setInput] = useState(code);
  const q = useQuery({ queryKey: ['verify', code], queryFn: () => verifyDocument(code), enabled: !!code });
  return (
    <section className="stack">
      <h1>{text({ ar: 'التحقق من مستند', en: 'Verify a document' })}</h1>
      <form className="actions" onSubmit={(e) => { e.preventDefault(); navigate(`/verify/${input.trim()}`); }}>
        <input className="mono" value={input} onChange={(e) => setInput(e.target.value)} placeholder="GS-XXXX-XXXX-XXXX" />
        <button className="btn primary">{text({ ar: 'تحقق', en: 'Verify' })}</button>
      </form>
      {q.data ? (
        q.data.valid ? (
          <div className="card" data-ok="true">
            <b>{q.data.revoked ? text({ ar: 'مستند ملغى', en: 'Revoked document' }) : text({ ar: 'مستند صحيح صادر من البوابة', en: 'Valid document issued by the portal' })}</b>
            <dl className="fields">
              <div><dt>{text({ ar: 'النوع', en: 'Type' })}</dt><dd>{text(q.data.title!)}</dd></div>
              <div><dt>{text({ ar: 'الرقم', en: 'Number' })}</dt><dd className="mono">{q.data.number}</dd></div>
              <div><dt>{text({ ar: 'تاريخ الإصدار', en: 'Issued' })}</dt><dd>{fmtDate(q.data.issuedAt, lang)}</dd></div>
              <div><dt>{text({ ar: 'صاحب المستند', en: 'Holder' })}</dt><dd>{text(q.data.holder!)}</dd></div>
            </dl>
          </div>
        ) : <p className="error">{text({ ar: 'لا يوجد مستند بهذا الرمز', en: 'No document has this code' })}</p>
      ) : null}
    </section>
  );
}
