/* الأخبار والتعاميم: بطاقات بأغلفة على الهوية (شريط على الهاتف، وبطاقة رئيسية مع عمود على الحاسوب)، وقارئ في لوح بغلاف يتمدد،
   وتأكيد الاطلاع على التعميم بلحظة ختم ذهبية وسجل بالوقت. */
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { useStore } from '../app/store';
import { useLang, usePerson, Pill, useToast } from '../ui/components';
import { I } from '../ui/icons';
import { fmtDate, relTime } from '../app/i18n';
import type { Post } from '../domain/types';
import { sectorById, canPublish, canWithdraw } from '../domain/comms';
import { Cover } from '../ui/covers';
import { PostGallery, MediaViewer, MediaCover } from '../ui/PostMedia';
import { fill } from '../app/i18n';
import { useUI, BottomSheet, Rail, Head, needsAck, useIntroSkip } from '../app/ui';

function Kicker({ p }: { p: Post }) {
  const { L } = useUI(); const { lang } = useLang(); const { state } = useStore(); const sec = sectorById(state, p.sectorId);
  return <span className={`nk nk-${p.kind}`}><b>{L.kinds[p.kind]}</b>{sec ? <span>· {lang === 'ar' ? sec.short.ar : sec.short.en}</span> : null}</span>;
}
function AckBadge({ p }: { p: Post }) {
  const { L, ui } = useUI(); if (!needsAck(p, ui)) return null;
  return ui.acks[p.id] ? <Pill tone="ok" icon="check">{L.acked}</Pill> : <Pill tone="gold" icon="seal">{L.ackRequired}</Pill>;
}

export function PostCard({ p, onOpen, size = 'rail', delay = 0 }: { p: Post; onOpen: () => void; size?: 'rail' | 'feature' | 'row'; delay?: number }) {
  const { lang, tx } = useLang(); const reduce = useReducedMotion(); const skip = useIntroSkip(); const { L, ui } = useUI();
  const now = Date.now(); const ack = needsAck(p, ui);
  /* الغلاف الحقيقي إن وُجد، وشارة تقول ما وراء البطاقة (صور أو فيديو) فتستحق البطاقة الضغطة */
  const all = p.media || []; const lead = all.length ? all.find((m) => m.id === p.coverMediaId) || all[0] : undefined;
  const vids = all.filter((m) => m.kind === 'video').length; const imgs = all.length - vids;
  const badge = !all.length ? null : vids ? L.videoIn : imgs === 1 ? L.photo1 : imgs === 2 ? L.photos2 : fill(L.photosN, { n: String(imgs) });
  if (size === 'row') return (
    <motion.button type="button" className="pc row" onClick={onOpen} whileTap={{ scale: 0.98 }} initial={skip ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 28, delay }} role="listitem">
      <span className="pc-thumb">{lead ? <MediaCover m={lead} ratio="square" /> : <Cover spec={p.cover} ratio="square" grain={false} />}</span>
      <span className="pc-body"><Kicker p={p} /><b className="pc-title">{tx(p.title)}</b><span className="pc-meta">{relTime(p.at, lang, now)}</span>{ack ? <span className="pc-rowack"><AckBadge p={p} /></span> : null}</span>
    </motion.button>
  );
  return (
    <motion.button type="button" className={`pc ${size}`} onClick={onOpen} whileTap={{ scale: 0.975 }} whileHover={reduce ? undefined : { y: -3 }} initial={skip ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 28, delay }} role="listitem">
      <span className="pc-cover">{lead ? <MediaCover m={lead} ratio={size === 'feature' ? 'banner' : 'wide'} /> : <Cover spec={p.cover} ratio={size === 'feature' ? 'banner' : 'wide'} />}<span className="pc-ack">{ack ? <AckBadge p={p} /> : null}</span>{badge ? <span className="pc-media"><I.image />{badge}</span> : null}</span>
      <span className="pc-body">
        <Kicker p={p} />
        <b className="pc-title">{tx(p.title)}</b>
        {size === 'feature' ? <span className="pc-sum">{tx(p.summary)}</span> : null}
        <span className="pc-meta">{tx(p.source)} · {relTime(p.at, lang, now)} · {p.readMin} {p.readMin > 2 ? L.readMins : L.readMin}</span>
      </span>
    </motion.button>
  );
}

export function NewsSection({ list, onOpen, onCompose }: { list: Post[]; onOpen: (p: Post) => void; onCompose?: () => void }) {
  const { L, desk } = useUI(); const { state } = useStore(); const me = usePerson();
  /* زر النشر لمن يملك منصباً ناشراً وحده (P-10) */
  const head = <Head action={<span className="lb-head-acts">{onCompose && canPublish(state, me) ? <button type="button" className="lb-link add" onClick={onCompose}><I.plus />{L.newPost}</button> : null}<button type="button" className="lb-link">{L.newsAll}</button></span>}>{L.news}</Head>;
  if (desk) {
    const [first, ...rest] = list;
    return (
      <section className="lb-news desk">
        {head}
        <div className="lb-news-grid">
          <PostCard p={first} size="feature" onOpen={() => onOpen(first)} />
          <div className="lb-news-col">{rest.slice(0, 3).map((p, i) => <PostCard key={p.id} p={p} size="row" onOpen={() => onOpen(p)} delay={0.06 + i * 0.05} />)}</div>
        </div>
      </section>
    );
  }
  return (
    <section className="lb-news">
      {head}
      <Rail className="lb-news-rail" ariaLabel={L.news}>{list.slice(0, 6).map((p, i) => <PostCard key={p.id} p={p} onOpen={() => onOpen(p)} delay={0.05 + i * 0.05} />)}</Rail>
    </section>
  );
}

/* ——— القارئ ——— */
export function ReaderSheet({ post, onClose, now }: { post: Post | null; onClose: () => void; now: number }) {
  const { lang, tx } = useLang(); const { L, ui } = useUI(); const { state, dispatch } = useStore(); const me = usePerson(); const toast = useToast(); const reduce = useReducedMotion();
  const [justAcked, setJustAcked] = useState<string | null>(null);
  const [wdOpen, setWdOpen] = useState(false); const [wdWhy, setWdWhy] = useState(''); const [wdErr, setWdErr] = useState(false);
  const [view, setView] = useState<number | null>(null);
  useEffect(() => { if (!post) { setWdOpen(false); setWdWhy(''); setWdErr(false); setView(null); } }, [post]);
  /* المنشور الحي من المخزن (عدّاد التأكيد يتحدث)، والمعروض يبقى ثابتاً أثناء إغلاق اللوح */
  const p = post ? state.posts.find((x) => x.id === post.id) || post : null; const acked = p ? ui.acks[p.id] : undefined; const inCal = p ? ui.cal.includes(p.id) : false;
  const all = p?.media || []; const lead = all.length ? all.find((m) => m.id === p?.coverMediaId) || all[0] : undefined;
  const order = lead ? [lead, ...all.filter((m) => m.id !== lead.id)] : all; const rest = order.slice(1);
  const ack = () => { if (!p) return; dispatch({ type: 'ack', personId: me.id, postId: p.id }); setJustAcked(p.id); toast({ title: lang === 'ar' ? 'سُجّل تأكيد اطلاعك' : 'Your acknowledgement is recorded', sub: lang === 'ar' ? `باسمك ${me.name.split(' ')[0]} · الآن` : `As ${me.nameEn} · now`, icon: 'seal', tone: 'gold' }); };
  const addCal = () => { if (!p) return; dispatch({ type: 'calAdd', personId: me.id, postId: p.id }); toast({ title: L.added, icon: 'calendar' }); };
  /* السحب: لمن نشره أو يملك منصباً ناشراً باسم قطاعه أو لمدير النظام — بسبب مكتوب، فلا يختفي شيء بلا جواب */
  const mayWithdraw = !!p && canWithdraw(state, me, p);
  const withdraw = () => { if (!p) return; if (!wdWhy.trim()) { setWdErr(true); return; } dispatch({ type: 'postWithdraw', personId: me.id, postId: p.id, reason: wdWhy.trim() }); toast({ title: L.withdrawDone, sub: wdWhy.trim(), icon: 'x', tone: 'warn' }); setWdOpen(false); onClose(); };
  return (
    <BottomSheet open={!!p} onClose={onClose} tall className="reader">
      {p && (
        <article className="rd">
          <div className="rd-cover">{lead ? <button type="button" className="rd-lead-btn" onClick={() => setView(0)} aria-label={L.galleryOf}><MediaCover m={lead} /></button> : <Cover spec={p.cover} ratio="banner" />}<button type="button" className="rd-x" aria-label="close" onClick={onClose}><I.x /></button><span className="rd-kicker"><Kicker p={p} />{p.number ? <span className="rd-no num">{p.number}</span> : null}</span></div>
          <div className="rd-body">
            <h1 className="rd-title">{tx(p.title)}</h1>
            <p className="rd-meta">{tx(p.source)} · {fmtDate(p.at, lang, { weekday: 'long', day: 'numeric', month: 'long' })} · {p.readMin} {p.readMin > 2 ? L.readMins : L.readMin}</p>
            {p.kind === 'event' && p.eventAt ? (
              <div className="rd-event">
                <span className="rd-ev-ic"><I.calendar /></span>
                <span className="rd-ev-txt"><b>{fmtDate(p.eventAt, lang, { weekday: 'long', day: 'numeric', month: 'long' })}</b><span>{p.place ? tx(p.place) : ''}</span></span>
                <motion.button type="button" className={`btn ${inCal ? 'soft' : 'secondary'}`} whileTap={{ scale: 0.96 }} onClick={addCal} disabled={inCal}>{inCal ? <><I.check />{L.added}</> : <><I.plus />{L.addToCal}</>}</motion.button>
              </div>
            ) : null}
            <p className="rd-lead">{tx(p.summary)}</p>
            {/* المعرض: بقية الوسائط (الغلاف فوق، فلا تتكرر صورة) */}
            {rest.length ? <div className="rd-gal"><PostGallery list={rest} onOpen={(i) => setView(i + 1)} />{lead?.caption ? <span className="rd-gal-cap">{tx(lead.caption)}</span> : null}</div> : null}
            {p.body.map((b, i) => <p key={i} className="rd-p">{tx(b)}</p>)}
            {p.attachments?.length ? (
              <div className="rd-att">
                <span className="rd-att-h">{L.attachments}</span>
                {p.attachments.map((a) => <button key={a.name} type="button" className="rd-att-row"><span className="cell-lead plain"><I.clip /></span><span className="cell-main"><span className="cell-title">{a.name}</span><span className="cell-sub">{a.size}</span></span><I.open className="rd-att-ic" /></button>)}
              </div>
            ) : null}
            {p.link ? <a className="btn secondary rd-link" href={p.link.href}><I.open />{tx(p.link.label)}</a> : null}
            {needsAck(p, ui) ? (
              <div className={`rd-ack ${acked ? 'done' : ''}`}>
                {acked ? (
                  <div className="rd-ack-done">
                    <span className="rd-seal">
                      {justAcked === p.id && !reduce ? <motion.span className="seal-bloom" initial={{ scale: 0.3, opacity: 0.9 }} animate={{ scale: 2.8, opacity: 0 }} transition={{ duration: 0.9, delay: 0.15, ease: 'easeOut' }} /> : null}
                      <motion.span className="rd-seal-ic" initial={justAcked === p.id && !reduce ? { scale: 1.9, rotate: -18, opacity: 0 } : false} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 380, damping: 17, delay: 0.1 }}><I.seal /></motion.span>
                    </span>
                    <span><b>{L.ackedAt}</b><span>{fmtDate(acked, lang, { day: 'numeric', month: 'long' })} · {new Date(acked).toLocaleTimeString(lang === 'ar' ? 'ar-SA-u-nu-latn' : 'en-GB', { hour: '2-digit', minute: '2-digit' })} · {lang === 'ar' ? 'مسجَّل باسمك في سجل التعميم' : 'recorded in the circular’s register under your name'}</span></span>
                  </div>
                ) : (
                  <>
                    <div className="rd-ack-txt"><span className="rd-ack-ic"><I.seal /></span><span><b>{L.ackTitle}</b><span>{L.ackText}</span>{p.ackDue ? <span className="rd-ack-due">{L.ackDue}: {fmtDate(p.ackDue, lang, { day: 'numeric', month: 'long' })}</span> : null}</span></div>
                    <motion.button type="button" className="btn primary block lg" whileTap={{ scale: 0.97 }} onClick={ack}><I.check />{L.ackBtn}</motion.button>
                  </>
                )}
                <p className="rd-ack-count">{L.ackedBy} {p.ackCount || 0} {L.employees}</p>
              </div>
            ) : null}
            {/* السحب في آخر القارئ: فعل نادر لا يزاحم القراءة، ونتيجته مكتوبة قبل الضغط */}
            {mayWithdraw ? (
              <div className="rd-wd">
                {!wdOpen ? (
                  <button type="button" className="btn quiet block" onClick={() => setWdOpen(true)}><I.x />{L.withdraw}</button>
                ) : (
                  <div className="rd-wd-open">
                    <b>{L.withdrawTitle}</b>
                    <p>{L.withdrawHint}</p>
                    <label><span>{L.withdrawWhy}</span><input value={wdWhy} onChange={(e) => { setWdWhy(e.target.value); setWdErr(false); }} placeholder={L.withdrawWhyPh} /></label>
                    {wdErr ? <span className="rd-wd-err">{L.withdrawWhy}</span> : null}
                    <div className="btn-row">
                      <button type="button" className="btn quiet" onClick={() => { setWdOpen(false); setWdErr(false); }}>{L.cancelAct}</button>
                      <motion.button type="button" className="btn danger" whileTap={{ scale: 0.97 }} onClick={withdraw}><I.x />{L.withdraw}</motion.button>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </article>
      )}
      <AnimatePresence>{view !== null && order.length ? <MediaViewer key="mv" list={order} start={view} onClose={() => setView(null)} /> : null}</AnimatePresence>
    </BottomSheet>
  );
}
