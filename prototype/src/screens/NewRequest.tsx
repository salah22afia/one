import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../app/store';
import { nav } from '../app/router';
import { I } from '../ui/icons';
import { Field, Group, LargeTitle, Notice, Pill, TopBar, useLang, usePerson, useToast } from '../ui/components';
import { motion, AnimatePresence, Stagger, Item, CheckMark, SPRING } from '../ui/motion';
import { SERVICE_TITLE } from '../domain/engine';
import type { T2, Field as ReqField } from '../domain/types';

interface FDef { key: string; label: T2; type: 'text' | 'date' | 'select' | 'textarea' | 'number'; options?: T2[]; required?: boolean; hint?: T2 }
interface Form { fields: FDef[]; attachment?: { label: T2; required?: boolean }; next: T2 }
const o = (ar: string, en: string): T2 => ({ ar, en });
const FORMS: Record<string, Form> = {
  'TM-01': { fields: [
    { key: 'type', label: o('نوع الإجازة', 'Leave type'), type: 'select', required: true, options: [o('سنوية', 'Annual'), o('اضطرارية', 'Emergency'), o('مرضية', 'Sick'), o('بدون راتب', 'Unpaid')] },
    { key: 'from', label: o('من', 'From'), type: 'date', required: true }, { key: 'to', label: o('إلى', 'To'), type: 'date', required: true },
    { key: 'note', label: o('ملاحظة', 'Note'), type: 'textarea' },
  ], attachment: { label: o('تقرير طبي أو مستند داعم', 'Medical report or supporting document') }, next: o('يذهب إلى مديرك المباشر للاعتماد، ثم إلى شؤون الموظفين، ثم يُسجَّل في النظام المرجعي ويصدر قرار الإجازة.', 'Goes to your line manager, then personnel affairs, then it is posted to the system of record and the leave decision is issued.') },
  'DC-01': { fields: [
    { key: 'to', label: o('الجهة الموجه إليها', 'Addressed to'), type: 'text', required: true, hint: o('مثال: بنك الرياض، سفارة المملكة المتحدة', 'e.g. Riyad Bank, the UK Embassy') },
    { key: 'lang', label: o('اللغة', 'Language'), type: 'select', required: true, options: [o('العربية', 'Arabic'), o('الإنجليزية', 'English'), o('الاثنتان', 'Both')] },
    { key: 'salary', label: o('يتضمن الراتب', 'Includes salary'), type: 'select', required: true, options: [o('نعم', 'Yes'), o('لا', 'No')] },
  ], next: o('تصدره شؤون الموظفين برمز تحقق، وتجده في طلبك جاهزاً للتحميل.', 'Personnel affairs issue it with a verification code; you will find it in your request ready to download.') },
  'MD-01': { fields: [
    { key: 'field', label: o('البيان المراد تحديثه', 'Data to update'), type: 'select', required: true, options: [o('رقم الجوال', 'Mobile number'), o('البريد الإلكتروني', 'Email'), o('العنوان', 'Address'), o('الحالة الاجتماعية', 'Marital status'), o('رقم البطاقة', 'Card number')] },
    { key: 'value', label: o('القيمة الجديدة', 'New value'), type: 'text', required: true },
  ], attachment: { label: o('إثبات (إن لزم)', 'Proof (if needed)') }, next: o('تراجعه شؤون الموظفين ثم يُحدَّث في النظام المرجعي.', 'Personnel affairs review it, then it is updated in the system of record.') },
  'MD-02': { fields: [
    { key: 'bank', label: o('البنك', 'Bank'), type: 'select', required: true, options: [o('مصرف الراجحي', 'Al Rajhi Bank'), o('البنك الأهلي', 'SNB'), o('بنك الرياض', 'Riyad Bank'), o('بنك آخر', 'Other')] },
    { key: 'iban', label: o('الآيبان الجديد', 'New IBAN'), type: 'text', required: true, hint: o('يبدأ بـ SA ويتكون من 24 خانة', 'Starts with SA, 24 characters') },
  ], attachment: { label: o('خطاب تعريف بالحساب من البنك', 'Account letter from the bank'), required: true }, next: o('تتحقق شؤون الموظفين من المستند، ثم تؤكد الرواتب، ثم يُطبَّق على الراتب القادم.', 'Personnel affairs verify the document, payroll confirms, then it applies to the next salary.') },
  'MD-05': { fields: [
    { key: 'doc', label: o('المستند', 'Document'), type: 'select', required: true, options: [o('جواز السفر', 'Passport'), o('الهوية الوطنية', 'National ID'), o('البطاقة الإدارية', 'Administrative card'), o('رخصة القيادة', 'Driving licence'), o('بطاقة التأمين الطبي', 'Medical insurance card')] },
    { key: 'number', label: o('الرقم الجديد', 'New number'), type: 'text', required: true }, { key: 'expires', label: o('تاريخ الانتهاء', 'Expiry date'), type: 'date', required: true },
  ], attachment: { label: o('صورة المستند الجديد', 'Copy of the new document'), required: true }, next: o('تراجعه شؤون الموظفين ثم يُحدَّث المستند وتاريخه في النظام المرجعي.', 'Personnel affairs review it, then the document and its expiry are updated in the system of record.') },
  'AS-01': { fields: [
    { key: 'what', label: o('ما تحتاجه', 'What you need'), type: 'text', required: true, hint: o('مادة أو جهاز أو خدمة', 'An item, a device or a service') },
    { key: 'qty', label: o('الكمية', 'Quantity'), type: 'number', required: true }, { key: 'why', label: o('المبرر', 'Reason'), type: 'textarea', required: true },
  ], next: o('يعتمده مديرك، ثم يُصرف من المستودع إن توفر أو يتحول إلى طلب شراء، وتستلمه بتوقيع سند التسليم.', 'Your manager approves; then it is issued from stock or becomes a purchase request, and you receive it by signing the handover note.') },
  'FN-01': { fields: [
    { key: 'dest', label: o('الوجهة', 'Destination'), type: 'text', required: true }, { key: 'from', label: o('من', 'From'), type: 'date', required: true }, { key: 'to', label: o('إلى', 'To'), type: 'date', required: true },
    { key: 'purpose', label: o('الغرض', 'Purpose'), type: 'textarea', required: true },
  ], attachment: { label: o('خطاب الدعوة أو برنامج المهمة', 'Invitation letter or programme') }, next: o('يعتمده مديرك، ثم تحجز الانتدابات الاعتماد وتصدر القرار، ثم يُصرف المقدم وتُسجَّل المهمة في النظام.', 'Your manager approves; assignments commit the budget and issue the decision; then the advance is paid and the trip is recorded in the system.') },
};

export function NewRequest({ serviceId, resubmitId }: { serviceId?: string; resubmitId?: string }) {
  const { state, dispatch } = useStore(); const { lang, t, tx } = useLang(); const me = usePerson(); const toast = useToast();
  const original = resubmitId ? state.requests.find((r) => r.id === resubmitId) : undefined;
  const sid = serviceId || original?.serviceId || 'TM-01';
  const form = FORMS[sid] || FORMS['MD-01']; const title = tx(SERVICE_TITLE[sid] || { ar: sid, en: sid });
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [vals, setVals] = useState<Record<string, string>>(() => { const v: Record<string, string> = {}; original?.fields.forEach((f) => { v[f.key] = f.value; }); return v; });
  const [file, setFile] = useState<string>(original?.docs.find((d) => d.kind === 'attachment') ? tx(original!.docs.find((d) => d.kind === 'attachment')!.title) : '');
  const [errors, setErrors] = useState<Record<string, string>>({}); const [createdId, setCreatedId] = useState('');
  const summaryRef = useRef<HTMLDivElement>(null);
  const returnedNote = original?.steps.find((s) => s.status === 'returned')?.note;
  useEffect(() => { if (Object.keys(errors).length) summaryRef.current?.focus(); }, [errors]);
  const set = (k: string, v: string) => { setVals((x) => ({ ...x, [k]: v })); if (errors[k]) setErrors((e) => { const c = { ...e }; delete c[k]; return c; }); };
  const validate = () => {
    const e: Record<string, string> = {};
    form.fields.forEach((f) => { if (f.required && !(vals[f.key] || '').trim()) e[f.key] = t.newReq.required; });
    if (form.attachment?.required && !file) e['__file'] = t.newReq.required;
    if (vals.from && vals.to && vals.to < vals.from) e['to'] = lang === 'ar' ? 'تاريخ النهاية قبل البداية' : 'End date is before the start';
    setErrors(e); return Object.keys(e).length === 0;
  };
  const fields = useMemo<ReqField[]>(() => form.fields.map((f) => ({ key: f.key, label: f.label, value: vals[f.key] || '' })), [form, vals]);
  const submit = () => {
    if (original) { dispatch({ type: 'resubmit', requestId: original.id, fields }); toast(t.newReq.successTitle); nav(`#/requests/${original.id}`); return; }
    const id = 'REQ-2026-' + String(state.seq + 1).padStart(4, '0');
    setCreatedId(id);
    dispatch({ type: 'create', serviceId: sid, requesterId: me.id, fields, attachment: file || undefined });
    setStep(3); window.scrollTo({ top: 0 });
  };
  const pct = step === 1 ? 33 : step === 2 ? 66 : 100;
  return (
    <div className="page narrow view">
      <TopBar title={title} back={() => (step === 2 ? setStep(1) : history.back())} />
      <LargeTitle title={original ? t.requests.resubmit : title} sub={original ? title : undefined} />
      {step < 3 && (
        <div className="steps"><span className="num">{t.newReq.step} {step} {t.newReq.of} 2</span><div className="bar"><motion.i initial={false} animate={{ width: `${pct}%` }} transition={SPRING.soft} /></div><span>{step === 1 ? t.newReq.details : t.newReq.review}</span></div>
      )}

      <AnimatePresence mode="wait" initial={false}>
      {step === 1 && (
        <motion.div key="s1" initial={{ opacity: 0, x: lang === 'ar' ? -28 : 28 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: lang === 'ar' ? 28 : -28, transition: { duration: 0.16 } }} transition={SPRING.soft}>
          {returnedNote && <div style={{ marginBottom: 12 }}><Notice tone="warn" icon="ret">{returnedNote}</Notice></div>}
          {Object.keys(errors).length > 0 && (
            <div className="error-summary" ref={summaryRef} tabIndex={-1}><b>{t.newReq.fixErrors}</b><ul>{Object.entries(errors).map(([k, v]) => <li key={k}><a href={`#f-${k}`} onClick={(e) => { e.preventDefault(); document.getElementById(`f-${k}`)?.focus(); }}>{k === '__file' ? tx(form.attachment!.label) : tx(form.fields.find((f) => f.key === k)!.label)}: {v}</a></li>)}</ul></div>
          )}
          <Stagger delay={0.05} step={0.05}>
          <Group>
            {form.fields.map((f) => (
              <Field key={f.key} id={`f-${f.key}`} label={tx(f.label) + (f.required ? '' : ` (${t.newReq.optional})`)} hint={f.hint ? tx(f.hint) : undefined} error={errors[f.key]}>
                {f.type === 'select' ? (
                  <select id={`f-${f.key}`} value={vals[f.key] || ''} onChange={(e) => set(f.key, e.target.value)}><option value="">—</option>{f.options!.map((op) => <option key={op.ar} value={op.ar}>{tx(op)}</option>)}</select>
                ) : f.type === 'textarea' ? (
                  <textarea id={`f-${f.key}`} rows={3} value={vals[f.key] || ''} onChange={(e) => set(f.key, e.target.value)} />
                ) : (
                  <input id={`f-${f.key}`} type={f.type} inputMode={f.type === 'number' ? 'numeric' : undefined} min={f.type === 'number' ? 1 : undefined} value={vals[f.key] || ''} onChange={(e) => set(f.key, e.target.value)} dir={f.type === 'date' || f.type === 'number' || f.key === 'iban' ? 'ltr' : undefined} style={f.type === 'date' || f.type === 'number' || f.key === 'iban' ? { textAlign: 'end' } : undefined} />
                )}
              </Field>
            ))}
            {form.attachment && (
              <Field id="f-__file" label={tx(form.attachment.label) + (form.attachment.required ? '' : ` (${t.newReq.optional})`)} error={errors['__file']}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <label className="btn secondary" style={{ cursor: 'pointer' }}><I.clip />{file ? t.newReq.attached : t.newReq.chooseAttachment}<input id="f-__file" type="file" style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }} onChange={(e) => { setFile(e.target.files?.[0]?.name || ''); setErrors((x) => { const c = { ...x }; delete c['__file']; return c; }); }} /></label>
                  {file ? <Pill icon="clip">{file}</Pill> : null}
                </div>
              </Field>
            )}
          </Group>
          <div style={{ height: 10 }} />
          <Notice icon="info">{t.newReq.placeholderNote}</Notice>
          <div style={{ height: 16 }} />
          <Item><motion.button type="button" className="btn primary block lg" whileTap={{ scale: 0.97 }} onClick={() => { if (validate()) { setStep(2); window.scrollTo({ top: 0 }); } }}>{t.newReq.next}<I.chev className="dirchev" /></motion.button></Item>
          </Stagger>
        </motion.div>
      )}

      {step === 2 && (
        <motion.div key="s2" initial={{ opacity: 0, x: lang === 'ar' ? -28 : 28 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: lang === 'ar' ? 28 : -28, transition: { duration: 0.16 } }} transition={SPRING.soft}>
          <Stagger delay={0.05} step={0.05}>
          <Group>
            {fields.filter((f) => f.value).map((f) => <Item key={f.key}><div className="summary-row"><span className="k">{tx(f.label)}</span><span className="v">{f.value}</span></div></Item>)}
            {file ? <Item><div className="summary-row"><span className="k">{t.requests.attachment}</span><span className="v"><Pill icon="clip">{file}</Pill></span></div></Item> : null}
          </Group>
          <div style={{ height: 8 }} /><Item><button type="button" className="btn quiet" onClick={() => setStep(1)}>{t.newReq.edit}</button></Item>
          <div className="section-label"><span>{t.newReq.whatNext}</span></div>
          <Notice tone="tint" icon="clock">{tx(form.next)}</Notice>
          <div style={{ height: 16 }} />
          <Item><motion.button type="button" className="btn primary block lg" onClick={submit} whileTap={{ scale: 0.97 }}><I.send />{t.newReq.submit}</motion.button></Item>
          </Stagger>
        </motion.div>
      )}

      {step === 3 && (
        <motion.div key="s3" className="success" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={SPRING.soft}>
          <CheckMark size={112} />
          <motion.b initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING.soft, delay: 0.85 }}>{t.newReq.successTitle}</motion.b>
          <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING.soft, delay: 0.95 }}>{t.newReq.successSub}</motion.p>
          <motion.p className="mono success-id" initial={{ opacity: 0, filter: 'blur(6px)' }} animate={{ opacity: 1, filter: 'blur(0px)' }} transition={{ duration: 0.5, delay: 1.05 }}>{createdId}</motion.p>
          <motion.div className="btn-row" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING.soft, delay: 1.15 }}><motion.a className="btn secondary" href="#/home" whileTap={{ scale: 0.97 }}>{t.tabs.home}</motion.a><motion.a className="btn primary" href={`#/requests/${createdId}`} whileTap={{ scale: 0.97 }}>{t.newReq.viewRequest}</motion.a></motion.div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}
