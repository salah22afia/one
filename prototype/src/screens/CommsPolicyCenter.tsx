/* v0.13 «سياسة الأخبار والقصص» (D-030، D-031؛ P-10 وP-11 وP-12): السياسة الثالثة على آلة الإصدارات نفسها.
   القطاعات الناشرة تُربط بوحدات الهيكل ومناصبه — لا بأشخاص — فمن يشغل المنصب اليوم هو الناشر؛ والأنواع والقواعد ولحظات التنبيه تُضاف وتُلغى بتاريخ. */
import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '../app/store';
import { I } from '../ui/icons';
import { Field, Group, LargeTitle, Notice, Pill, Segmented, Sheet, TopBar, useLang, usePerson, useToast } from '../ui/components';
import { motion, AnimatePresence, Stagger, Item, Press, SPRING } from '../ui/motion';
import { statusOf, endOf, activeVersion, diffContent, labelFor, toISO, scheduleProblem, inForce, liveNeed, type PolicyContent, type CommsContent, type CommsSector, type CommsKind, type VersionStatus } from '../domain/policy';
import { unitById, holderOf, positionById } from '../domain/engine';
import { publishersOf, needsAck, livePosts } from '../domain/comms';
import { PosPicker, NameFields, EndDate } from './NeedPolicyCenter';
import { HUE_CSS } from '../ui/covers';
import { useUI } from '../app/ui';
import type { Hue, PostKind, T2 } from '../domain/types';
import { fmtDate, changesText, fill } from '../app/i18n';
import { AdminNav } from './AdminCenter';

type Tab = 'sectors' | 'kinds' | 'rules' | 'notify' | 'register' | 'diff' | 'log';
type CList = 'sectors' | 'kinds';
const HUES: Hue[] = ['green', 'gold', 'sage', 'teal', 'bronze', 'night', 'cream'];
const statusToneOf = (s: VersionStatus) => (s === 'active' ? 'ok' : s === 'scheduled' ? 'tint' : s === 'awaiting' ? 'gold' : s === 'draft' ? 'warn' : s === 'cancelled' || s === 'reverted' ? 'danger' : s === 'corrected' ? 'warn' : 'done');
const fmtVal = (v: string, lang: 'ar' | 'en') => (v === 'true' ? (lang === 'ar' ? 'نعم' : 'yes') : v === 'false' ? (lang === 'ar' ? 'لا' : 'no') : v === '' ? '—' : v.length > 60 ? `${v.slice(0, 60)}…` : v);

/** أيقونة القطاع نفسها التي يراها الموظف في شريط القصص — فما يضبطه المدير هنا هو ما يظهر هناك */
export function SectorMark({ sector, size = 54 }: { sector: { initials: T2; hue: Hue }; size?: number }) {
  const { lang } = useLang(); const hue = HUE_CSS[sector.hue];
  return <span className="qicon" style={{ background: hue.bg, color: hue.fg, width: size, height: size, borderRadius: size * 0.32, fontWeight: 800, fontSize: size * 0.36 }}>{lang === 'ar' ? sector.initials.ar : sector.initials.en}</span>;
}

export function CommsPolicyCenter() {
  const { state, dispatch } = useStore(); const { lang, t, tx } = useLang(); const me = usePerson(); const toast = useToast(); const { L } = useUI();
  const today = toISO(Date.now()); const policy = state.commsPolicy; const versions = policy.versions; const active = activeVersion(policy, today);
  const anyDraft = versions.find((v) => statusOf(v, versions, today) === 'draft');
  const [selId, setSelId] = useState<string>(anyDraft ? anyDraft.id : active.id);
  const sel = versions.find((v) => v.id === selId) || active; const selStatus = statusOf(sel, versions, today);
  const isAdmin = me.persona === 'admin'; const editable = selStatus === 'draft' && isAdmin; const draft = selStatus === 'draft' ? sel : undefined;
  const [tab, setTab] = useState<Tab>('sectors');
  const [content, setContent] = useState<PolicyContent>(sel.content); const [why, setWhy] = useState('');
  useEffect(() => { setContent(sel.content); setWhy(''); }, [sel.id, sel.content]);
  const comms = content.comms!; const setComms = (f: (c: CommsContent) => CommsContent) => setContent((c) => ({ ...c, comms: f(c.comms!) }));
  const base = versions.find((v) => v.id === sel.baseId)?.content || sel.content;
  const pending = useMemo(() => diffContent(sel.content, content), [sel.content, content]);
  const diffs = useMemo(() => diffContent(base, content), [base, content]);
  const [schedOpen, setSchedOpen] = useState(false); const [sched, setSched] = useState({ from: sel.from, reason: sel.reason, reference: sel.reference });
  useEffect(() => { setSched({ from: sel.from, reason: sel.reason, reference: sel.reference }); }, [sel.id, sel.from, sel.reason, sel.reference]);
  const schedProblem = draft ? scheduleProblem(policy, draft.id, sched.from, today, content) : null;
  /* ما يمنع الجدولة: قطاع سارٍ بلا منصب ناشر، أو نوع منشور أُلغيت أنواعه كلها */
  const problems = useMemo(() => {
    const out: { kind: 'noPublisher' | 'noKinds'; name: T2 }[] = [];
    for (const s of liveNeed(comms.sectors, sched.from || today)) if (!s.publisherPositionIds.length) out.push({ kind: 'noPublisher', name: s.name });
    if (!liveNeed(comms.kinds, sched.from || today).length) out.push({ kind: 'noKinds', name: { ar: '', en: '' } });
    return out;
  }, [comms, sched.from, today]);

  const save = () => { if (!draft) return; dispatch({ type: 'commsPolicyUpdate', id: draft.id, content, by: me.id, why: why.trim() }); toast({ title: t.policy.saved, sub: changesText(pending.length, lang), icon: 'check', tone: 'ok' }); setWhy(''); };
  const newDraft = () => { dispatch({ type: 'commsPolicyDraft', by: me.id }); toast({ title: t.policy.created, sub: L.comms.title, icon: 'sparkle', tone: 'info' }); setTimeout(() => setSelId(`V-${versions.length + 1}`), 0); };
  const cancel = () => { if (!draft) return; dispatch({ type: 'commsPolicyCancel', id: draft.id }); setSelId(active.id); toast({ title: t.policy.cancelled, icon: 'x', tone: 'warn' }); };
  const schedule = () => { if (!draft || !sched.from || !sched.reason.trim() || !sched.reference.trim() || schedProblem || problems.length) return; if (pending.length) dispatch({ type: 'commsPolicyUpdate', id: draft.id, content, by: me.id, why: why.trim() || sched.reason }); dispatch({ type: 'commsPolicySchedule', id: draft.id, from: sched.from, reason: sched.reason, reference: sched.reference }); setSchedOpen(false); toast({ title: t.policy.scheduled, sub: `${draft.number} · ${t.policy.from} ${sched.from}`, icon: 'calendar', tone: 'gold' }); };
  const upd = <K extends CList>(list: K, id: string, patch: Partial<CommsContent[K][number]>) => setComms((c) => ({ ...c, [list]: (c[list] as { id: string }[]).map((x) => (x.id === id ? { ...x, ...patch } : x)) })) as void;
  const setRule = <K extends keyof CommsContent['rules']>(k: K, v: CommsContent['rules'][K]) => setComms((c) => ({ ...c, rules: { ...c.rules, [k]: v } }));
  const addSector = () => { const free = state.org.units.filter((u) => (u.level === 'sector' || u.level === 'ga' || u.level === 'sg') && !comms.sectors.some((s) => s.unitId === u.id))[0]; const id = `SEC-${Date.now().toString(36).slice(-4).toUpperCase()}`; const u = free; setComms((c) => ({ ...c, sectors: [...c.sectors, { id, unitId: u?.id || '', name: u ? u.name : { ar: 'قطاع ناشر جديد', en: 'New publishing sector' }, short: u ? u.name : { ar: 'قطاع', en: 'Sector' }, initials: { ar: 'ق', en: 'S' }, hue: 'sage', publisherPositionIds: [] }] })); setEdit({ list: 'sectors', id }); };

  const timeline = (
    <div className="ptl">
      {versions.filter((v) => !v.cancelled || v.revoked).map((v) => { const st = statusOf(v, versions, today); const end = endOf(v, versions); const on = v.id === sel.id; return (
        <Press key={v.id} className={`ptl-card ${st} ${on ? 'on' : ''}`} onClick={() => setSelId(v.id)} lift>
          {on ? <motion.span className="ptl-on" layoutId="cptl-on" transition={SPRING.snappy} /> : null}
          <span className="ptl-body"><span className="ptl-top"><b className="num">{v.number}</b><Pill tone={statusToneOf(st)}>{t.policy.status[st]}</Pill></span>
          <span className="ptl-dates num">{st === 'draft' ? (lang === 'ar' ? 'لم يُجدوَل' : 'not scheduled') : `${v.from} → ${end || t.policy.open}`}</span>
          <span className="ptl-sub">{v.changes.length ? changesText(v.changes.length, lang) : v.reason ? v.reason.slice(0, 40) : ''}</span></span>
        </Press>
      ); })}
      {isAdmin && !anyDraft ? <Press className="ptl-card new" onClick={newDraft} lift><span className="ptl-body"><span className="cell-lead"><I.plus /></span><b>{t.need.policy.newDraft}</b></span></Press> : null}
    </div>
  );

  const [edit, setEdit] = useState<{ list: CList; id: string } | null>(null);
  const editing = edit ? (comms[edit.list] as unknown as { id: string; name: T2 }[]).find((x) => x.id === edit.id) : undefined;
  const sw = (on: boolean, set: (v: boolean) => void, label: string, hint?: string) => (
    <label className="sw"><span>{label}{hint ? <span className="cell-sub">{hint}</span> : null}</span><input className="switch" type="checkbox" checked={on} disabled={!editable} onChange={(e) => set(e.target.checked)} /></label>
  );

  /* سجل التأكيدات: تشغيل لا سياسة — من أكّد اطلاعه على كل تعميم ومتى، بدل ورقة التوقيع */
  /* المسحوب يبقى في السجل: طلب التأكيد يوماً ما، فيُعرض مختوماً بسببه — لا يختفي */
  const register = useMemo(() => state.posts.filter((p) => needsAck(state, { ...p, withdrawnAt: undefined })).sort((a, b) => b.at - a.at).map((p) => {
    const rows = state.people.map((per) => ({ person: per, at: state.comms.acks[per.id]?.[p.id] })).filter((r) => r.person.id !== p.publisherId);
    return { post: p, done: rows.filter((r) => r.at).sort((a, b) => (b.at || 0) - (a.at || 0)), pending: rows.filter((r) => !r.at) };
  }), [state]);

  return (
    <div className="page view policy npc">
      <TopBar title={L.comms.title} back="#/admin" />
      <LargeTitle title={L.comms.title} sub={L.comms.sub} />
      <AdminNav />
      {!isAdmin ? <><Notice tone="warn" icon="info">{t.policy.onlyAdmin}</Notice><div style={{ height: 12 }} /></> : null}
      <div className="section-head" style={{ paddingTop: 6 }}><h2>{t.need.policy.versions}</h2>{draft && isAdmin ? <span className="kbd-row" style={{ padding: 0 }}><button type="button" className="btn quiet" onClick={cancel}>{t.need.policy.cancelDraft}</button><button type="button" className="btn soft" onClick={() => setSchedOpen(true)}><I.calendar />{t.need.policy.schedule}</button></span> : null}</div>
      {timeline}
      <div className="pv-head">
        <div className="pv-line"><span><b className="num">{sel.number}</b> <Pill tone={statusToneOf(selStatus)}>{t.policy.status[selStatus]}</Pill>{selStatus !== 'draft' ? <span className="cell-sub"> {t.policy.from} <span className="num">{sel.from}</span>{endOf(sel, versions) ? <> {t.policy.to} <span className="num">{endOf(sel, versions)}</span></> : null}</span> : null}</span></div>
        {sel.reason ? <p className="cell-sub">{sel.reason}{sel.reference ? ` · ${sel.reference}` : ''}</p> : null}
        {editable ? <p className="hint-line" style={{ padding: '6px 0 0' }}>{t.policy.hint}</p> : isAdmin && !anyDraft ? <p className="hint-line" style={{ padding: '6px 0 0' }}>{t.need.policy.noDraft}</p> : null}
      </div>
      <Segmented id="cpolicy" value={tab} onChange={setTab} options={[{ v: 'sectors', label: L.comms.sectors, n: liveNeed(comms.sectors, today).length }, { v: 'kinds', label: L.comms.kinds, n: liveNeed(comms.kinds, today).length }, { v: 'rules', label: L.comms.rules }, { v: 'notify', label: L.comms.notify }, { v: 'register', label: L.comms.register, n: register.length }, { v: 'diff', label: t.policy.diff, n: diffs.length }, { v: 'log', label: t.policy.changes }]} />
      <div style={{ height: 12 }} />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={tab + sel.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6, transition: { duration: 0.1 } }} transition={SPRING.soft}>

          {tab === 'sectors' && (
            <Stagger>
              <Item><Notice icon="info">{L.adminSheet.publishersSub} {L.adminSheet.erp}</Notice></Item>
              {editable ? <Item><button type="button" className="npc-add" onClick={addSector}><span className="cell-lead"><I.plus /></span>{L.comms.addSector}</button></Item> : null}
              <Stagger className="pt-grid" step={0.035}>{comms.sectors.map((s) => { const u = unitById(state, s.unitId); const pub = publishersOf(state, s); return (
                <Item key={s.id}><Press className={`pt-card ${s.endedAt && s.endedAt <= today ? 'off' : ''}`} onClick={() => setEdit({ list: 'sectors', id: s.id })} lift>
                  <SectorMark sector={s} />
                  <span className="pt-body"><b>{tx(s.name)}</b><span className="pt-meta">
                    {s.endedAt ? <Pill tone="danger" icon="x">{t.need.policy.ended} <span className="num">{s.endedAt}</span></Pill> : null}
                    {u ? <Pill icon="globe">{tx(u.name)}</Pill> : <Pill tone="danger" icon="alert">{lang === 'ar' ? 'بلا وحدة' : 'No unit'}</Pill>}
                    {pub.length ? pub.map((p) => <Pill key={p.id} tone="tint" icon="person">{lang === 'ar' ? p.name.split(' ')[0] : p.nameEn.split(' ')[0]}</Pill>) : <Pill tone="gold" icon="alert">{L.comms.noPublishers}</Pill>}
                  </span></span>
                  <I.chev className="chev dirchev" />
                </Press></Item>
              ); })}</Stagger>
            </Stagger>
          )}

          {tab === 'kinds' && (
            <Stagger>
              <Item><Notice icon="info">{L.adminSheet.ackSub}</Notice></Item>
              <Stagger className="pt-grid" step={0.035}>{comms.kinds.map((k) => (
                <Item key={k.id}><Press className={`pt-card ${k.endedAt && k.endedAt <= today ? 'off' : ''}`} onClick={() => setEdit({ list: 'kinds', id: k.id })} lift>
                  <span className={`qicon ${k.id === 'circular' ? 'g-gold' : k.id === 'event' ? 'g-teal' : 'g-green'}`}>{k.id === 'circular' ? <I.seal /> : k.id === 'event' ? <I.calendar /> : <I.doc />}</span>
                  <span className="pt-body"><b>{tx(k.name)}</b><span className="pt-meta">{k.endedAt ? <Pill tone="danger" icon="x">{t.need.policy.ended} <span className="num">{k.endedAt}</span></Pill> : null}{k.ackAllowed ? <Pill tone="gold" icon="check">{L.comms.ackAllowed}</Pill> : <Pill>{lang === 'ar' ? 'بلا تأكيد' : 'No acknowledgement'}</Pill>}{k.mediaAllowed !== false ? <Pill tone="tint" icon="image">{L.comms.media}</Pill> : null}<Pill tone="tint">{livePosts(state).filter((p) => p.kind === k.id).length} {lang === 'ar' ? 'منشوراً' : 'posts'}</Pill></span></span>
                  <I.chev className="chev dirchev" />
                </Press></Item>
              ))}</Stagger>
            </Stagger>
          )}

          {tab === 'rules' && (
            <Stagger>
              <Item><Notice icon="info">{L.adminSheet.mediaRulesSub}</Notice></Item>
              <Item><Group><div className="npc-rules">
                <label><span>{L.adminSheet.storyLife} ({L.adminSheet.hours})</span><input id="cp-hours" className="num" type="number" dir="ltr" min={1} max={168} value={comms.rules.storyHours} disabled={!editable} onChange={(e) => setRule('storyHours', Number(e.target.value))} /><span className="cell-sub">{lang === 'ar' ? 'تختفي القصة من الشريط بعد هذه المدة من نشرها.' : 'A story leaves the rail this long after it is posted.'}</span></label>
                <label><span>{L.adminSheet.videoMax} ({L.adminSheet.seconds})</span><input id="cp-vsec" className="num" type="number" dir="ltr" min={5} max={120} value={comms.rules.storyVideoMaxSec} disabled={!editable} onChange={(e) => setRule('storyVideoMaxSec', Number(e.target.value))} /></label>
                <label><span>{L.comms.imageMax}</span><input id="cp-img" className="num" type="number" dir="ltr" min={1} value={comms.rules.storyImageMaxMB} disabled={!editable} onChange={(e) => setRule('storyImageMaxMB', Number(e.target.value))} /></label>
                <label><span>{L.comms.videoMaxMB}</span><input id="cp-vid" className="num" type="number" dir="ltr" min={1} value={comms.rules.storyVideoMaxMB} disabled={!editable} onChange={(e) => setRule('storyVideoMaxMB', Number(e.target.value))} /></label>
                <label><span>{L.comms.postMaxMedia}</span><input id="cp-pmax" className="num" type="number" dir="ltr" min={1} max={30} value={comms.rules.postMaxMedia ?? 10} disabled={!editable} onChange={(e) => setRule('postMaxMedia', Number(e.target.value))} /><span className="cell-sub">{lang === 'ar' ? 'صور وفيديو المنشور الواحد.' : 'Photos and videos in one post.'}</span></label>
                <label><span>{L.comms.postImageMax}</span><input id="cp-pimg" className="num" type="number" dir="ltr" min={1} value={comms.rules.postImageMaxMB ?? 12} disabled={!editable} onChange={(e) => setRule('postImageMaxMB', Number(e.target.value))} /></label>
                <label><span>{L.comms.postVideoSec}</span><input id="cp-pvsec" className="num" type="number" dir="ltr" min={5} value={comms.rules.postVideoMaxSec ?? 180} disabled={!editable} onChange={(e) => setRule('postVideoMaxSec', Number(e.target.value))} /></label>
                <label><span>{L.comms.postVideoMax}</span><input id="cp-pvid" className="num" type="number" dir="ltr" min={1} value={comms.rules.postVideoMaxMB ?? 120} disabled={!editable} onChange={(e) => setRule('postVideoMaxMB', Number(e.target.value))} /></label>
                <label><span>{L.adminSheet.reminder} ({L.adminSheet.daysUnit})</span><input id="cp-remind" className="num" type="number" dir="ltr" min={1} max={30} value={comms.rules.ackReminderDays} disabled={!editable} onChange={(e) => setRule('ackReminderDays', Number(e.target.value))} /><span className="cell-sub">{lang === 'ar' ? 'تذكير واحد لمن لم يؤكد اطلاعه بعد هذه المدة من نشر التعميم.' : 'One reminder to those who have not acknowledged, this long after the circular was posted.'}</span></label>
              </div></Group></Item>
              <Item><Notice tone="tint" icon="info">{fill(L.adminSheet.sizes, { img: String(comms.rules.storyImageMaxMB), vid: String(comms.rules.storyVideoMaxMB) })}</Notice></Item>
            </Stagger>
          )}

          {tab === 'notify' && (
            <Stagger>
              <Item><Notice icon="bell">{lang === 'ar' ? 'لحظة واحدة لكل حدث (م-03): لا تنبيه إلا حين يُطلب من الموظف فعل، أو حين يختار قطاعه أن يخبره. وما يصل كل موظف يبقى تحت يده في «أنا › ما الذي يصلك».' : 'One moment per event (P-03): a notification only when the employee is asked to act, or when their own sector chooses to tell them. What reaches each employee stays under their control in Me › What reaches you.'}</Notice></Item>
              <Item><Group><div className="npc-rules">
                {sw(comms.rules.notifyCircular, (v) => setRule('notifyCircular', v), L.comms.notifyCircular, lang === 'ar' ? 'يصل التنبيه بالعنوان ورابط يفتح التعميم على زر التأكيد.' : 'The notification carries the title and a link that opens the circular on its acknowledge button.')}
                {sw(comms.rules.notifyStory, (v) => setRule('notifyStory', v), L.comms.notifyStory, lang === 'ar' ? 'موظفو وحدة القطاع وحدهم؛ والقصة تظهر للجميع في الشريط على كل حال.' : 'Only the sector’s own unit; the story appears in everyone’s rail regardless.')}
              </div></Group></Item>
            </Stagger>
          )}

          {tab === 'register' && (register.length === 0 ? <Group><div className="empty"><span className="ic"><I.seal /></span><b>{lang === 'ar' ? 'لا تعاميم تطلب التأكيد' : 'No circulars ask for acknowledgement'}</b><span>{L.comms.registerSub}</span></div></Group> : (
            <Stagger>
              <Item><Notice icon="seal">{L.comms.registerSub} — {lang === 'ar' ? 'يقوم مقام ورقة التوقيع، ويُصدَّر مع التعميم.' : 'It stands in for the signature sheet and is exported with the circular.'}</Notice></Item>
              {register.map((r) => (
                <Item key={r.post.id}><Group>
                  <div className="cpr-head"><b>{tx(r.post.title)}</b><span className="cell-sub num">{fmtDate(r.post.at, lang, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}{r.post.number ? ` · ${r.post.number}` : ''}</span>
                    {r.post.withdrawnAt ? <span className="cell-sub" style={{ color: 'var(--danger)' }}>{L.withdrawn} · {fmtDate(r.post.withdrawnAt, lang, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}{(() => { const w = state.people.find((x) => x.id === r.post.withdrawnBy); return w ? ` · ${lang === 'ar' ? w.name : w.nameEn}` : ''; })()}{r.post.withdrawReason ? ` · ${r.post.withdrawReason}` : ''}</span> : null}</div>
                  <div className="cpr-bar"><span className="cpr-fill" style={{ width: `${Math.round((r.done.length / Math.max(1, r.done.length + r.pending.length)) * 100)}%` }} /></div>
                  <div className="cpr-meta">{r.post.withdrawnAt ? <Pill tone="danger" icon="x">{L.withdrawn}</Pill> : null}<Pill tone="ok" icon="check">{r.done.length} {L.ackedBy}</Pill>{r.post.withdrawnAt ? null : r.pending.length ? <Pill tone="gold" icon="clock">{r.pending.length} {lang === 'ar' ? 'لم يؤكدوا' : 'not yet'}</Pill> : <Pill tone="ok" icon="seal">{lang === 'ar' ? 'اكتمل' : 'Complete'}</Pill>}{r.post.ackDue ? <Pill icon="calendar">{L.ackDue} <span className="num">{toISO(r.post.ackDue)}</span></Pill> : null}</div>
                  <div className="cpr-list">{r.done.slice(0, 8).map((x) => <span key={x.person.id} className="cpr-row"><b>{lang === 'ar' ? x.person.name : x.person.nameEn}</b><span className="num">{fmtDate(x.at!, lang, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></span>)}
                    {r.done.length > 8 ? <span className="cell-sub">{fill(L.more, { n: r.done.length - 8 })}</span> : null}
                    {!r.done.length ? <span className="cell-sub">{lang === 'ar' ? 'لم يؤكد أحد بعد.' : 'Nobody has acknowledged yet.'}</span> : null}</div>
                </Group></Item>
              ))}
            </Stagger>
          ))}

          {tab === 'diff' && (diffs.length === 0 ? <Group><div className="empty"><span className="ic"><I.check /></span><b>{t.policy.noChanges}</b></div></Group> : <Stagger><Group>{diffs.map((d) => { const lb = labelFor(d.path, content); return <Item key={d.path}><div className="diff-row"><b>{tx(lb)}</b><span className="diff-vals"><span className="before">{fmtVal(d.before, lang)}</span><I.chev className="dirchev" /><span className="after">{fmtVal(d.after, lang)}</span></span></div></Item>; })}</Group></Stagger>)}

          {tab === 'log' && (() => { const all = versions.flatMap((v) => v.changes.map((c) => ({ ...c, v: v.number }))).sort((a, b) => b.at - a.at); return all.length === 0 ? <Group><div className="empty"><span className="ic"><I.doc /></span><b>{t.policy.noChanges}</b></div></Group> : <Stagger><Group>{all.map((c, i) => { const who = state.people.find((p) => p.id === c.by); return <Item key={i}><div className="diff-row"><b>{tx(c.label)} <Pill tone="tint">{c.v}</Pill></b><span className="diff-vals"><span className="before">{fmtVal(c.before, lang)}</span><I.chev className="dirchev" /><span className="after">{fmtVal(c.after, lang)}</span></span><span className="cell-sub">{who ? (lang === 'ar' ? who.name : who.nameEn) : c.by} · {fmtDate(c.at, lang, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}{c.why ? ` · ${c.why}` : ''}</span></div></Item>; })}</Group></Stagger>; })()}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {editable && pending.length > 0 && (
          <motion.div className="savebar" initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} transition={SPRING.soft}>
            <span className="sb-n">{changesText(pending.length, lang)}</span>
            <input className="sb-why" value={why} onChange={(e) => setWhy(e.target.value)} placeholder={t.need.policy.why} />
            <motion.button type="button" className="btn primary" onClick={save} whileTap={{ scale: 0.97 }}><I.check />{t.need.policy.save}</motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      <Sheet open={!!edit && !!editing} onClose={() => setEdit(null)} title={editing ? tx(editing.name) : ''} lead={edit && editing ? (edit.list === 'sectors' ? <SectorMark sector={editing as unknown as CommsSector} size={40} /> : <span className="qicon g-gold" style={{ width: 40, height: 40, borderRadius: 13 }}><I.seal /></span>) : null}>
        {edit && editing ? (
          <div className="type-editor">
            {editable && !((base.comms![edit.list] || []) as { id: string }[]).some((x) => x.id === edit.id) ? <div className="section-label" style={{ paddingTop: 0 }}><span>{t.policy.basics}</span><Pill tone="gold" icon="sparkle">{lang === 'ar' ? 'جديد في هذه المسودة' : 'New in this draft'}</Pill></div> : null}
            <Group>
              <div className="ed-row" style={{ padding: '12px 16px 8px' }}>
                {edit.list === 'sectors' ? (() => { const s = editing as unknown as CommsSector; return (<>
                  <NameFields name={s.name} editable={editable} onChange={(name) => upd('sectors', s.id, { name })} t={t} />
                  <label><span>{lang === 'ar' ? 'الوحدة في الهيكل' : 'Unit in the structure'}</span><select className="select-in" value={s.unitId} disabled={!editable} onChange={(e) => upd('sectors', s.id, { unitId: e.target.value })}><option value="">—</option>{state.org.units.filter((u) => u.level === 'sg' || u.level === 'sector' || u.level === 'ga').map((u) => <option key={u.id} value={u.id}>{tx(u.name)}</option>)}</select><span className="cell-sub">{lang === 'ar' ? 'منها يُعرف من يخصّه تنبيه القصة.' : 'It decides who a story notification concerns.'}</span></label>
                  <label><span>{lang === 'ar' ? 'الاسم المختصر' : 'Short name'}</span><input value={s.short.ar} disabled={!editable} onChange={(e) => upd('sectors', s.id, { short: { ...s.short, ar: e.target.value } })} /></label>
                  <label><span>{lang === 'ar' ? 'الاسم المختصر (إنجليزي)' : 'Short name (English)'}</span><input dir="ltr" value={s.short.en} disabled={!editable} onChange={(e) => upd('sectors', s.id, { short: { ...s.short, en: e.target.value } })} /></label>
                  <label><span>{lang === 'ar' ? 'اسم الحلقة في الشريط' : 'Ring label in the rail'}</span><input value={s.ring?.ar || ''} disabled={!editable} onChange={(e) => upd('sectors', s.id, { ring: { ar: e.target.value, en: s.ring?.en || '' } })} /><span className="cell-sub">{lang === 'ar' ? 'يُترك فارغاً فيُستعمل الاسم المختصر.' : 'Leave it empty to use the short name.'}</span></label>
                  <label><span>{lang === 'ar' ? 'اسم الحلقة (إنجليزي)' : 'Ring label (English)'}</span><input dir="ltr" value={s.ring?.en || ''} disabled={!editable} onChange={(e) => upd('sectors', s.id, { ring: { ar: s.ring?.ar || '', en: e.target.value } })} /></label>
                  <label><span>{lang === 'ar' ? 'الحرف' : 'Initials'}</span><input maxLength={3} value={s.initials.ar} disabled={!editable} onChange={(e) => upd('sectors', s.id, { initials: { ...s.initials, ar: e.target.value } })} /></label>
                  <label><span>{lang === 'ar' ? 'الحرف (إنجليزي)' : 'Initials (English)'}</span><input dir="ltr" maxLength={3} value={s.initials.en} disabled={!editable} onChange={(e) => upd('sectors', s.id, { initials: { ...s.initials, en: e.target.value } })} /></label>
                  <label style={{ flexBasis: '100%' }}><span>{lang === 'ar' ? 'لون القطاع' : 'Sector colour'}</span><span className="chips">{HUES.map((h) => <button key={h} type="button" className="cp-hue" style={{ background: HUE_CSS[h].bg, outline: s.hue === h ? '2px solid var(--tint)' : 'none', outlineOffset: 2 }} aria-label={h} aria-pressed={s.hue === h} disabled={!editable} onClick={() => upd('sectors', s.id, { hue: h })} />)}</span><span className="cell-sub">{lang === 'ar' ? 'لون الحلقة وأيقونة القطاع في شريط القصص.' : 'The ring and sector mark in the stories rail.'}</span></label>
                  <div style={{ flexBasis: '100%' }}><PosPicker label={L.comms.positions} ids={s.publisherPositionIds} editable={editable} onChange={(publisherPositionIds) => upd('sectors', s.id, { publisherPositionIds })} /><p className="cell-sub" style={{ margin: '2px 0 0' }}>{lang === 'ar' ? 'المنصب هو الناشر لا الشخص؛ من يشغله اليوم ينشر باسم القطاع، ومن يخلفه غداً يرث النشر بلا تعديل سياسة (م-10).' : 'The position publishes, not the person: whoever holds it today publishes for the sector, and their successor inherits it with no policy change (P-10).'}</p>
                    {s.publisherPositionIds.map((pid) => { const pos = positionById(state, pid); const h = holderOf(state, pid); const u = pos ? unitById(state, pos.unitId) : undefined; return <p key={pid} className="cell-sub" style={{ margin: 0 }}>{pos ? tx(pos.title) : pid}{u ? ` · ${tx(u.name)}` : ''} — {h ? (lang === 'ar' ? h.name : h.nameEn) : <b style={{ color: 'var(--gold)' }}>{lang === 'ar' ? 'شاغر الآن' : 'vacant now'}</b>}</p>; })}
                  </div>
                  <EndDate endedAt={s.endedAt} editable={editable} today={today} onChange={(endedAt) => upd('sectors', s.id, { endedAt })} t={t} lang={lang} />
                </>); })() : (() => { const k = editing as unknown as CommsKind; return (<>
                  <NameFields name={k.name} editable={editable} onChange={(name) => upd('kinds', k.id, { name })} t={t} />
                  {sw(k.ackAllowed, (v) => upd('kinds', k.id, { ackAllowed: v }), L.comms.ackAllowed, lang === 'ar' ? 'يظهر للناشر خيار «يطلب تأكيد الاطلاع» على منشور من هذا النوع.' : 'The publisher sees the “ask for acknowledgement” option on a post of this kind.')}
                  {sw(k.mediaAllowed !== false, (v) => upd('kinds', k.id, { mediaAllowed: v }), L.comms.mediaAllowed, lang === 'ar' ? 'يستطيع الناشر إضافة صور وفيديو إلى منشور من هذا النوع؛ وإن مُنع بقيت زخرفة الهوية غلافاً.' : 'The publisher may add photos and video to a post of this kind; if not, the identity artwork stays the cover.')}
                  <EndDate endedAt={k.endedAt} editable={editable} today={today} onChange={(endedAt) => upd('kinds', k.id, { endedAt })} t={t} lang={lang} />
                </>); })()}
              </div>
            </Group>
            {!editable ? <><div style={{ height: 10 }} /><Notice tone="tint" icon="info">{isAdmin ? t.need.policy.noDraft : t.policy.onlyAdmin}</Notice></> : null}
          </div>
        ) : null}
      </Sheet>

      <Sheet open={schedOpen} onClose={() => setSchedOpen(false)} title={t.need.policy.schedule}>
        <Group>
          <Field id="csc-from" label={t.policy.effective} error={schedProblem === 'past' ? t.policy.schedErrPast : schedProblem === 'taken' ? t.policy.schedErrTaken : schedProblem === 'beforeTip' ? (() => { const b = versions.filter((v) => v.id !== draft?.id && inForce(v) && v.from > sched.from).sort((a, c) => (a.from < c.from ? -1 : 1))[0]; return fill(t.policy.schedErrBeforeTip, { from: b?.from || '', number: b?.number || '' }); })() : undefined} hint={sched.from === today ? t.policy.schedToday : undefined}><input id="csc-from" type="date" className="num" dir="ltr" value={sched.from} min={today} onChange={(e) => setSched((x) => ({ ...x, from: e.target.value }))} /></Field>
          <Field id="csc-reason" label={t.need.policy.reason}><textarea id="csc-reason" rows={2} value={sched.reason} onChange={(e) => setSched((x) => ({ ...x, reason: e.target.value }))} /></Field>
          <Field id="csc-ref" label={t.need.policy.reference}><input id="csc-ref" value={sched.reference} onChange={(e) => setSched((x) => ({ ...x, reference: e.target.value }))} /></Field>
        </Group>
        <div style={{ height: 10 }} />
        <Notice tone={schedProblem === 'empty' ? 'warn' : 'tint'} icon="target">{diffs.length ? changesText(diffs.length, lang) : t.policy.vscope.nothingYet}{schedProblem === 'empty' ? <> — {t.policy.schedErrEmpty}</> : null}</Notice>
        {problems.length ? <><div style={{ height: 10 }} /><Notice tone="danger" icon="alert">{t.need.policy.problemsTitle}<ul className="sched-list">{problems.map((p, i) => <li key={i}>{p.kind === 'noPublisher' ? (lang === 'ar' ? `${p.name.ar}: قطاع سارٍ بلا منصب ناشر.` : `${p.name.en}: a live sector with no publishing position.`) : lang === 'ar' ? 'لا نوع منشور سارٍ: لن يستطيع أحد النشر.' : 'No live post kind: nobody would be able to publish.'}</li>)}</ul></Notice></> : null}
        <div style={{ height: 10 }} />
        <Notice tone="tint" icon="clock">{lang === 'ar' ? `يسري هذا الإصدار آلياً في ${sched.from || '…'} وينتهي الإصدار الساري في اليوم الذي قبله؛ ما نُشر قبله يبقى كما هو.` : `This version takes effect automatically on ${sched.from || '…'}; the current version ends the day before. What was already published stays as it is.`}</Notice>
        <div style={{ height: 12 }} />
        <motion.button type="button" className="btn primary block lg" disabled={!sched.from || !sched.reason.trim() || !sched.reference.trim() || !!schedProblem || problems.length > 0} onClick={schedule} whileTap={{ scale: 0.97 }}><I.calendar />{t.need.policy.schedule}</motion.button>
      </Sheet>
    </div>
  );
}
