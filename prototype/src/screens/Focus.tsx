/* «يحتاجك»: بطاقة واحدة تجمع كل ما يحتاج فعلاً من الموظف، مجمَّعاً (الاعتمادات صفاً واحداً، والمستندات صفاً واحداً…) بلا تكرار مع بقية الرئيسية،
   وسطر «آخر ما حدث» واحد يحمل بقية التنبيهات إلى الجرس. الهدوء حالة: سطر واحد لا صندوق فارغ. */
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../app/store';
import { nav } from '../app/router';
import { useLang, usePerson, Pill } from '../ui/components';
import { Ticker } from '../ui/motion';
import { I, type IconName } from '../ui/icons';
import { tasksFor, policyTasksFor, notificationsFor, requestTitle, personById } from '../domain/engine';
import { desksFor } from '../domain/need';
import { relTime, fmtDate, daysUntil, fill } from '../app/i18n';
import type { Post } from '../domain/types';
import { useUI, needsAck, useIntroSkip } from '../app/ui';

export interface FocusItem { id: string; icon: IconName; tone: string; title: string; sub?: string; action: string; go: () => void; danger?: boolean }

export function useFocus(now: number, posts: Post[], openPost: (p: Post) => void) {
  const { state } = useStore(); const { lang, tx } = useLang(); const me = usePerson(); const { L, ui } = useUI();
  const tasks = tasksFor(state, me, now); const policyTasks = policyTasksFor(state, me, now);
  const mine = state.requests.filter((r) => r.requesterId === me.id);
  const returned = mine.filter((r) => r.status === 'returned');
  const docs = (state.docs[me.id] || []).filter((d) => daysUntil(d.expiresAt, now) <= 30);
  const acks = posts.filter((p) => needsAck(p, ui) && !ui.acks[p.id]);
  const desks = desksFor(state, me);
  const first = (p?: { name: string; nameEn: string }) => (p ? (lang === 'ar' ? p.name : p.nameEn).split(' ')[0] : '');
  const items: FocusItem[] = [];
  for (const r of returned.slice(0, 2)) { const note = r.steps.find((s) => s.status === 'returned')?.note; items.push({ id: `ret-${r.id}`, icon: 'ret', tone: 'warn', title: tx(requestTitle(r)), sub: note ? `${L.returnedTo} · ${note}` : L.returnedTo, action: L.act.attach, go: () => nav(`#/requests/${r.id}`) }); }
  if (tasks.length) { const overdue = tasks.filter((t) => t.overdue).length; const names = tasks.slice(0, 2).map((t) => first(personById(state, t.request.requesterId))).join(lang === 'ar' ? '، ' : ', '); items.push({ id: 'approvals', icon: 'inbox', tone: '', title: tasks.length === 1 ? L.approvalsOne : tasks.length === 2 ? L.approvalsTwo : fill(tasks.length <= 10 ? L.approvalsN : L.approvalsMany, { n: tasks.length }), sub: `${names}${tasks.length > 2 ? ` +${tasks.length - 2}` : ''}${overdue ? ` · ${overdue} ${lang === 'ar' ? 'متأخر' : 'overdue'}` : ''}`, action: L.act.approve, go: () => nav('#/inbox'), danger: overdue > 0 }); }
  for (const pt of policyTasks) items.push({ id: `pol-${pt.version.id}`, icon: 'shield', tone: 'gold', title: `${L.policyTask} ${pt.version.number}`, sub: relTime(pt.requestedAt, lang, now), action: L.act.open, go: () => nav('#/admin/policy') });
  if (acks.length) items.push({ id: 'acks', icon: 'seal', tone: 'gold', title: acks.length === 1 ? L.ackNeeded : acks.length === 2 ? L.ackTwo : fill(L.ackNeededN, { n: acks.length }), sub: tx(acks[0].title), action: L.act.read, go: () => openPost(acks[0]) });
  if (desks.procurementCount) items.push({ id: 'desk-p', icon: 'wallet', tone: 'gold', title: fill(L.deskN, { n: desks.procurementCount, desk: lang === 'ar' ? 'مكتب المشتريات' : 'the procurement desk' }), action: L.act.open, go: () => nav('#/desk/procurement') });
  if (desks.storeCount) items.push({ id: 'desk-s', icon: 'box', tone: 'gold', title: fill(L.deskN, { n: desks.storeCount, desk: lang === 'ar' ? 'المستودع' : 'the store' }), action: L.act.open, go: () => nav('#/desk/store') });
  if (docs.length) { const d = docs[0]; const n = daysUntil(d.expiresAt, now); items.push({ id: 'docs', icon: 'alert', tone: n <= 15 ? 'danger' : 'warn', title: docs.length === 1 ? tx(d.title) : docs.length === 2 ? L.docsTwo : fill(L.docsN, { n: docs.length }), sub: docs.length === 1 ? `${lang === 'ar' ? 'ينتهي' : 'Expires'} ${fmtDate(d.expiresAt, lang, { day: 'numeric', month: 'long' })} · ${n} ${lang === 'ar' ? 'يوماً' : 'days'}` : docs.map((x) => tx(x.title)).join(' · '), action: L.act.renew, go: () => nav('#/me/docs'), danger: n <= 15 }); }
  /* آخر ما حدث: أحدث تنبيه غير مقروء ليس ممثَّلاً في «يحتاجك» (لا مهام، ولا انتهاء مستندات، ولا الطلبات المعادة) */
  const covered = new Set([...returned.map((r) => r.id), ...tasks.map((t) => t.request.id)]);
  const mentions = (n: { link?: string; title: { ar: string; en: string }; body?: { ar: string; en: string } }) => [...covered].some((id) => (n.link || '').includes(id) || n.title.ar.includes(id) || (n.body?.ar || '').includes(id));
  /* v0.13: تعميم يطلب التأكيد ممثَّل في «يحتاجك» ما لم يُؤكَّد، فلا يتكرر في «آخر ما حدث» (C-UX-72) */
  const pending = new Set(acks.map((p) => p.id));
  const latest = notificationsFor(state, me).filter((n) => !n.read && n.kind !== 'task' && n.kind !== 'expiry' && !mentions(n) && !ui.dismissed.includes(n.id) && !((n.kind === 'circular' || n.kind === 'reminder') && [...pending].some((id) => n.link === `#/home/post/${id}`)));
  return { items, total: items.length, latest, tasks };
}

export function FocusCard({ now, posts, openPost }: { now: number; posts: Post[]; openPost: (p: Post) => void }) {
  const { items, latest } = useFocus(now, posts, openPost); const { L } = useUI(); const { lang, tx } = useLang(); const { dispatch } = useStore(); const me = usePerson(); const reduce = useIntroSkip();
  const shown = items.slice(0, 3); const rest = items.length - shown.length;
  const top = latest[0];
  const openLatest = () => { if (!top) return; dispatch({ type: 'read', id: top.id }); nav(top.link || '#/notifications'); };
  const dismissLatest = () => { if (!top) return; dispatch({ type: 'dismiss', personId: me.id, notificationId: top.id }); dispatch({ type: 'read', id: top.id }); };
  return (
    <motion.section className={`fc ${items.length ? '' : 'calm'}`} initial={reduce ? false : { opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 240, damping: 26, delay: 0.1 }} aria-label={L.focus}>
      {items.length ? (
        <>
          <div className="fc-head"><span className="fc-label">{L.focus}</span><span className="fc-count num"><Ticker value={items.length} delay={0.25} /></span></div>
          <motion.ul className="fc-list" initial="hide" animate="show" variants={{ show: { transition: { staggerChildren: 0.05, delayChildren: 0.2 } }, hide: {} }}>
            <AnimatePresence initial={false}>
              {shown.map((it) => { const Ic = I[it.icon]; return (
                <motion.li key={it.id} layout variants={{ hide: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }} exit={{ opacity: 0, x: lang === 'ar' ? 24 : -24, transition: { duration: 0.2 } }}>
                  <button type="button" className={`fc-row ${it.danger ? 'danger' : ''}`} onClick={it.go}>
                    <span className={`fc-ic ${it.tone}`}><Ic /></span>
                    <span className="fc-txt"><b>{it.title}</b>{it.sub ? <span>{it.sub}</span> : null}</span>
                    <span className="fc-act">{it.action}<I.chev className="dirchev" /></span>
                  </button>
                </motion.li>
              ); })}
            </AnimatePresence>
          </motion.ul>
          {rest > 0 ? <a className="fc-more" href="#/inbox">{fill(L.more, { n: rest })} <I.chev className="dirchev" /></a> : null}
        </>
      ) : (
        <div className="fc-calm"><motion.span className="fc-ok" initial={reduce ? false : { scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 360, damping: 18, delay: 0.3 }}><I.check /></motion.span><span><b>{L.focusCalm}</b><span>{L.focusCalmSub}</span></span></div>
      )}
      {top ? (
        <div className="fc-latest">
          <button type="button" className="fc-latest-btn" onClick={openLatest}><span className="fc-latest-k">{L.latest}</span><span className="fc-latest-t">{tx(top.title)}</span><span className="fc-latest-w">{relTime(top.at, lang, now)}</span></button>
          {latest.length > 1 ? <a className="fc-latest-n" href="#/notifications"><Pill tone="tint">+{latest.length - 1}</Pill></a> : null}
          <button type="button" className="fc-latest-x" aria-label={L.dismiss} onClick={dismissLatest}><I.x /></button>
        </div>
      ) : null}
    </motion.section>
  );
}
