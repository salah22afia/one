/* The request form of a configured service, as the prototype's official request screen (screens/NewRequest.tsx):
   step 1 the fields, step 2 the review with what happens next, then the sent confirmation. The same screen completes a
   returned request ("Complete and resubmit"), pre-filled, with the reason it was returned. The server validates again. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { ApiError, type RequestDetail } from '@usp/api-client';
import { blocks, isVisible, validate, type Check, type FieldDef, type FormData, type ServiceDefinition } from '@usp/forms-core';
import { DynamicForm, fieldId, type FormParts } from '@usp/forms-web';
import { useI18n } from '@usp/i18n';
import { AnimatePresence, CheckMark, Field, Group, I, Item, LargeTitle, Notice, Pill, SPRING, Stagger, TopBar, motion } from '@usp/ui-web';

const parts: FormParts = { Group, Field };

export function ServiceRequestForm({ def, mode = 'new', initial = {}, returnedNote, backTo, onSubmit, onSent }: {
  def: ServiceDefinition;
  /** resubmit: completing a returned request, pre-filled from it. */
  mode?: 'new' | 'resubmit';
  initial?: FormData;
  /** The decider's reason for returning it, shown above the fields. */
  returnedNote?: string | null;
  backTo: string;
  onSubmit: (data: FormData) => Promise<RequestDetail>;
  /** After a resubmission the caller moves on; a new request shows the sent confirmation instead. */
  onSent?: (d: RequestDetail) => void;
}) {
  const { t, text, lang } = useI18n(); const navigate = useNavigate();
  const resubmit = mode === 'resubmit';
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [data, setData] = useState<FormData>(initial);
  const [checks, setChecks] = useState<Check[]>([]);
  const [sending, setSending] = useState(false);
  const [created, setCreated] = useState('');
  const [failure, setFailure] = useState('');
  const summaryRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (checks.some((c) => c.level === 'block')) summaryRef.current?.focus(); }, [checks]);
  const title = text(def.name);
  const errors = checks.filter((c) => c.level === 'block');
  const next = () => { const c = validate(def, data); setChecks(c); if (!blocks(c)) { setStep(2); window.scrollTo({ top: 0 }); } };
  const send = async () => {
    setSending(true); setFailure('');
    try {
      const d = await onSubmit(data);
      if (onSent) onSent(d); else { setCreated(d.request.id); setStep(3); window.scrollTo({ top: 0 }); }
    } catch (e) {
      // The server's own checks (it validates again, AB-35): back to the fields with its messages; else its reason.
      if (e instanceof ApiError && e.checks.length) { setChecks(e.checks); setStep(1); }
      else setFailure(e instanceof ApiError && e.title ? text(e.title) : t('form.failed'));
    } finally { setSending(false); }
  };
  const fieldOf = (key?: string) => def.fields.find((f) => f.key === key);
  const shown = def.form.pages.flatMap((p) => p.fields).map((k) => fieldOf(k)).filter((f): f is FieldDef => !!f && isVisible(f, data));
  const pct = step === 1 ? 33 : step === 2 ? 66 : 100;
  const slide = (dir: 1 | -1) => ({ opacity: 0, x: (lang === 'ar' ? -28 : 28) * dir });
  return (
    <div className="lb-official">
      <div className="page narrow view">
        <TopBar title={title} back onBack={() => (step === 2 ? setStep(1) : navigate(backTo))} />
        <LargeTitle title={resubmit ? t('requests.resubmitTitle') : title} sub={resubmit ? title : undefined} />
        {step < 3 && (
          <div className="steps">
            <span className="num">{t('form.step', { n: step, m: 2 })}</span>
            <div className="bar"><motion.i initial={false} animate={{ width: `${pct}%` }} transition={SPRING.soft} /></div>
            <span>{step === 1 ? t('form.details') : t('form.review')}</span>
          </div>
        )}
        <AnimatePresence mode="wait" initial={false}>
          {step === 1 && (
            <motion.div key="s1" initial={slide(1)} animate={{ opacity: 1, x: 0 }} exit={{ ...slide(-1), transition: { duration: 0.16 } }} transition={SPRING.soft}>
              {returnedNote ? <div style={{ marginBottom: 12 }}><Notice tone="warn" icon="ret">{returnedNote}</Notice></div> : null}
              {errors.length > 0 && (
                <div className="error-summary" ref={summaryRef} tabIndex={-1}>
                  <b>{t('form.fixErrors')}</b>
                  <ul>{errors.map((c) => (
                    <li key={c.key}><a href={`#${fieldId(c.field ?? '')}`} onClick={(e) => { e.preventDefault(); if (c.field) document.getElementById(fieldId(c.field))?.focus(); }}>
                      {fieldOf(c.field) ? `${text(fieldOf(c.field)!.label)}: ` : ''}{text(c.text)}</a></li>
                  ))}</ul>
                </div>
              )}
              <Stagger delay={0.05} step={0.05}>
                <DynamicForm def={def} value={data} onChange={(v) => { setData(v); if (checks.length) setChecks(validate(def, v).filter((c) => errors.some((e) => e.key === c.key))); }} checks={checks} parts={parts} />
                <div style={{ height: 16 }} />
                <Item><motion.button type="button" className="btn primary block lg" whileTap={{ scale: 0.97 }} onClick={next}>{t('form.next')}<I.chev className="dirchev" /></motion.button></Item>
              </Stagger>
            </motion.div>
          )}
          {step === 2 && (
            <motion.div key="s2" initial={slide(1)} animate={{ opacity: 1, x: 0 }} exit={{ ...slide(-1), transition: { duration: 0.16 } }} transition={SPRING.soft}>
              <Stagger delay={0.05} step={0.05}>
                <Group>
                  {shown.map((f) => { const v = display(f, data[f.key], text, t); return v ? <Item key={f.key}><div className="summary-row"><span className="k">{text(f.label)}</span><span className="v">{v}</span></div></Item> : null; })}
                </Group>
                <div style={{ height: 8 }} /><Item><button type="button" className="btn quiet" onClick={() => setStep(1)}>{t('form.edit')}</button></Item>
                {def.next ? <><div className="section-label"><span>{t('form.whatNext')}</span></div><Notice tone="tint" icon="clock">{text(def.next)}</Notice></> : null}
                <div style={{ height: 16 }} />
                {failure ? <><Notice tone="danger" icon="alert">{failure}</Notice><div style={{ height: 10 }} /></> : null}
                <Item><motion.button type="button" className="btn primary block lg" disabled={sending} onClick={() => void send()} whileTap={{ scale: 0.97 }}><I.send />{t('form.submit')}</motion.button></Item>
              </Stagger>
            </motion.div>
          )}
          {step === 3 && (
            <motion.div key="s3" className="success" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={SPRING.soft}>
              <CheckMark size={112} />
              <motion.b initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING.soft, delay: 0.85 }}>{t('form.sent')}</motion.b>
              <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING.soft, delay: 0.95 }}>{t('form.sentSub')}</motion.p>
              <motion.p className="mono success-id" initial={{ opacity: 0, filter: 'blur(6px)' }} animate={{ opacity: 1, filter: 'blur(0px)' }} transition={{ duration: 0.5, delay: 1.05 }}>{created}</motion.p>
              <motion.div className="btn-row" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING.soft, delay: 1.15 }}>
                <Link className="btn secondary" to="/">{t('tabs.home')}</Link>
                <Link className="btn primary" to={`/requests/${created}`}>{t('form.viewRequest')}</Link>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/** A value as the review shows it: option labels, yes/no, files as pills; empty values are left out. */
function display(f: FieldDef, v: unknown, text: (x: Record<string, string> | null | undefined) => string, t: (k: string) => string): ReactNode {
  if (v === undefined || v === null || v === '') return null;
  if (f.type === 'boolean') return v === true ? t('form.yes') : t('form.no');
  if (f.type === 'attachment') return <Pill icon="clip">{String(v)}</Pill>;
  const o = f.options?.find((x) => x.value === String(v));
  return o ? text(o.label) : String(v);
}
