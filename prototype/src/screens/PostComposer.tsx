/* مؤلّف المنشور (v0.13، D-030 وD-031): الناشر يكتب خبراً أو تعميماً أو فعالية باسم قطاعه — ويطلب تأكيد الاطلاع إن أجازت السياسة نوعه.
   لا يُرى الزر إلا لمن يملك منصباً ناشراً (P-10)؛ والنوع والغلاف يُعاينان كما سيراهما الموظف قبل النشر. */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../app/store';
import { useLang, usePerson, useToast, Pill, Notice } from '../ui/components';
import { I } from '../ui/icons';
import { Cover } from '../ui/covers';
import { useUI, BottomSheet } from '../app/ui';
import { commsContent, publishingSectors } from '../domain/comms';
import { preparePostMedia, dropMedia, fmtClock, useMediaUrlById, type PrepareFail } from '../ui/media';
import { MediaTile, MediaCover } from '../ui/PostMedia';
import { Sheet } from '../ui/components';
import { liveNeed, toISO } from '../domain/policy';
import { fill } from '../app/i18n';
import type { CoverArt, Hue, PostKind, PostMedia, T2 } from '../domain/types';

const ARTS: CoverArt[] = ['gems', 'dunes', 'arch', 'star', 'bokeh', 'waves', 'grid'];
const DAY = 86400000;

export function PostComposer({ open, onClose, now }: { open: boolean; onClose: () => void; now: number }) {
  const { L } = useUI(); const { state, dispatch } = useStore(); const { lang, tx } = useLang(); const me = usePerson(); const toast = useToast();
  const content = commsContent(state); const kinds = useMemo(() => liveNeed(content.kinds, toISO(now)), [content, now]);
  const mine = publishingSectors(state, me);
  const [sectorId, setSectorId] = useState(''); const sector = mine.find((x) => x.id === sectorId) || mine[0];
  const [kind, setKind] = useState<PostKind>('news');
  const [title, setTitle] = useState(''); const [summary, setSummary] = useState(''); const [body, setBody] = useState('');
  const [art, setArt] = useState(0); const [ack, setAck] = useState(false); const [due, setDue] = useState(3);
  const [eventAt, setEventAt] = useState(''); const [place, setPlace] = useState(''); const [number, setNumber] = useState('');
  /* الوسائط: ترتيبها ترتيب المعرض، وأولها الغلاف ما لم يُحدَّد غيره */
  const [media, setMedia] = useState<PostMedia[]>([]); const [coverId, setCoverId] = useState<string | undefined>();
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null); const [fails, setFails] = useState<PrepareFail[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null); const mediaRef = useRef<PostMedia[]>([]); mediaRef.current = media;
  useEffect(() => { if (open) return; setTitle(''); setSummary(''); setBody(''); setAck(false); setKind('news'); setArt(0); setEventAt(''); setPlace(''); setNumber('');
    /* التراجع عن المؤلّف يحرّر ما جُهِّز ولم يُنشر */
    if (mediaRef.current.length) { void dropMedia(mediaRef.current); setMedia([]); setCoverId(undefined); } setFails([]); setBusy(null); setEditId(null); }, [open]);
  const kindRule = kinds.find((k) => k.id === kind); const ackAllowed = !!kindRule?.ackAllowed;
  useEffect(() => { if (!ackAllowed && ack) setAck(false); }, [ackAllowed]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!sector) return null;
  const hue: Hue = sector.hue; const cover = { art: ARTS[art], hue, seed: 7 + art * 3 };
  /* حدود الوسائط من السياسة (P-12)، وإجازتها لكل نوع منشور */
  const mediaAllowed = kindRule?.mediaAllowed !== false;
  const limits = { maxMedia: content.rules.postMaxMedia ?? 10, imageMB: content.rules.postImageMaxMB ?? 12, videoMB: content.rules.postVideoMaxMB ?? 120, videoSec: content.rules.postVideoMaxSec ?? 180 };
  const ordered = coverId ? [...media].sort((a, b) => (a.id === coverId ? -1 : b.id === coverId ? 1 : 0)) : media;
  const coverMedia = ordered[0];
  const pickFiles = async (files: File[]) => {
    if (!files.length) return; setFails([]); setBusy({ done: 0, total: files.length });
    const { media: got, failed } = await preparePostMedia(files, limits, media.length, (done, total) => setBusy({ done, total }));
    setMedia((m) => [...m, ...got]); setFails(failed); setBusy(null);
  };
  const removeMedia = (id: string) => { const m = media.find((x) => x.id === id); if (m) void dropMedia([m]); setMedia((list) => list.filter((x) => x.id !== id)); if (coverId === id) setCoverId(undefined); setEditId(null); };
  const updMedia = (id: string, patch: Partial<PostMedia>) => setMedia((list) => list.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const moveMedia = (id: string, d: -1 | 1) => setMedia((list) => { const i = list.findIndex((x) => x.id === id); const j = i + d; if (i < 0 || j < 0 || j >= list.length) return list; const c = [...list]; [c[i], c[j]] = [c[j], c[i]]; return c; });
  const editing = media.find((x) => x.id === editId);
  const t2 = (v: string): T2 => ({ ar: v, en: v });
  const ready = title.trim().length > 2 && summary.trim().length > 2 && (kind !== 'event' || !!eventAt);
  const publish = () => {
    if (!ready) return;
    const paras = body.split('\n').map((x) => x.trim()).filter(Boolean).map(t2);
    const words = (body || summary).split(/\s+/).filter(Boolean).length;
    dispatch({ type: 'postPublish', publisherId: me.id, post: {
      kind, sectorId: sector.id, source: sector.name, title: t2(title.trim()), summary: t2(summary.trim()),
      body: paras.length ? paras : [t2(summary.trim())], cover, readMin: Math.max(1, Math.round(words / 180)),
      requiresAck: ack || undefined, ackDue: ack ? now + due * DAY : undefined, number: number.trim() || undefined,
      eventAt: kind === 'event' && eventAt ? new Date(eventAt).getTime() : undefined, place: place.trim() ? t2(place.trim()) : undefined,
      media: mediaAllowed && ordered.length ? ordered : undefined, coverMediaId: mediaAllowed && coverMedia ? coverMedia.id : undefined,
    } });
    setMedia([]); setCoverId(undefined);
    toast({ title: L.postPublished, sub: `${tx(sector.short)}${ack ? ` · ${L.ackRequired}` : ''}`, icon: 'check', tone: 'ok' });
    onClose();
  };
  return (
    <BottomSheet open={open} onClose={onClose} title={L.newPost} tall lead={<span className="qicon g-green" style={{ width: 40, height: 40, borderRadius: 13 }}><I.letter /></span>}>
      <div className="pcx">
        {mine.length > 1 ? (
          <label className="pcx-f"><span>{L.asSector}</span>
            <span className="chips">{mine.map((s) => <button key={s.id} type="button" className={`pill ${s.id === sector.id ? 'tint' : ''}`} aria-pressed={s.id === sector.id} onClick={() => setSectorId(s.id)}>{tx(s.short)}</button>)}</span>
          </label>
        ) : <p className="cell-sub">{L.asSector} <b>{tx(sector.name)}</b></p>}

        <label className="pcx-f"><span>{L.postKind}</span>
          <span className="segmented sm">{kinds.map((k) => <button key={k.id} type="button" aria-pressed={kind === k.id} onClick={() => setKind(k.id)}><span className="seg-txt">{tx(k.name)}</span></button>)}</span>
        </label>

        <label className="pcx-f"><span>{L.postTitle}</span><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={L.postPh.title} maxLength={90} /></label>
        <label className="pcx-f"><span>{L.postSummary}</span><textarea rows={2} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder={L.postPh.summary} maxLength={200} /></label>
        <label className="pcx-f"><span>{L.postBody}</span><textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder={L.postPh.body} /></label>

        {kind === 'event' ? (
          <div className="pcx-two">
            <label className="pcx-f"><span>{L.postEventAt}</span><input type="datetime-local" dir="ltr" className="num" value={eventAt} onChange={(e) => setEventAt(e.target.value)} /></label>
            <label className="pcx-f"><span>{L.postPlace}</span><input value={place} onChange={(e) => setPlace(e.target.value)} /></label>
          </div>
        ) : null}
        {kind === 'circular' ? <label className="pcx-f"><span>{L.postNumber}</span><input dir="ltr" className="mono" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="ت-2026-000" /></label> : null}

        {mediaAllowed ? (
          <div className="pcx-f pcx-media">
            <span>{L.postMedia} <span className="cell-sub">{fill(L.postMediaLimits, { n: String(limits.maxMedia), img: String(limits.imageMB), sec: String(limits.videoSec), vid: String(limits.videoMB) })}</span></span>
            <input ref={fileRef} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => { const f = Array.from(e.target.files || []); e.target.value = ''; void pickFiles(f); }} />
            {media.length ? (
              <div className="pcx-strip" role="list">
                {ordered.map((m, i) => (
                  <span key={m.id} className={`pcx-mi ${i === 0 ? 'cover' : ''}`} role="listitem">
                    <MediaTile m={m} onClick={() => setEditId(m.id)} label={m.name} />
                    {i === 0 ? <span className="pcx-mc">{L.coverBadge}</span> : null}
                    <button type="button" className="pcx-mx" aria-label={L.removeMedia} onClick={() => removeMedia(m.id)}><I.x /></button>
                    {m.caption ? <span className="pcx-mcap"><I.doc /></span> : null}
                  </span>
                ))}
                {media.length < limits.maxMedia ? <button type="button" className="pcx-madd" onClick={() => fileRef.current?.click()} aria-label={L.addMediaPost}><I.plus /></button> : null}
              </div>
            ) : (
              <button type="button" className="pcx-mempty" onClick={() => fileRef.current?.click()}>
                <span className="pcx-me-ic"><I.image /></span>
                <span><b>{L.addMediaPost}</b><span>{L.postMediaHint}</span></span>
              </button>
            )}
            {busy ? <p className="cell-sub pcx-busy"><span className="pcx-bar"><i style={{ width: `${Math.round((busy.done / Math.max(1, busy.total)) * 100)}%` }} /></span>{fill(L.preparingN, { n: String(busy.done), m: String(busy.total) })}</p> : null}
            {fails.length ? <div className="pcx-fails">{fails.map((f, i) => <span key={i}><b>{f.name}</b> — {f.why === 'type' ? L.badFile : f.why === 'duration' ? fill(L.tooLong, { sec: f.max || '' }) : f.why === 'size' ? fill(L.tooBig, { max: f.max || '' }) : L.badFile}</span>)}</div> : null}
          </div>
        ) : <Notice tone="tint" icon="info">{L.noMediaKind}</Notice>}

        {!media.length ? <label className="pcx-f"><span>{L.postCover}</span>
          <span className="pcx-arts">{ARTS.map((a, i) => <button key={a} type="button" className={`pcx-art ${i === art ? 'on' : ''}`} aria-pressed={i === art} aria-label={a} onClick={() => setArt(i)}><Cover spec={{ art: a, hue, seed: 7 + i * 3 }} ratio="square" grain={false} /></button>)}</span>
        </label> : null}

        {ackAllowed ? (
          <div className="pcx-ack">
            <label className="sw" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><span>{L.postAsk}</span><input className="switch" type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} /></label>
            {ack ? <><label className="pcx-f"><span>{L.postDue}</span><input className="num" type="number" dir="ltr" min={1} max={30} value={due} onChange={(e) => setDue(Number(e.target.value))} /></label>
              <p className="cell-sub">{lang === 'ar' ? `يصل التنبيه لكل الموظفين، ويُذكَّر من لم يؤكد بعد ${content.rules.ackReminderDays} أيام.` : `Everyone is notified, and those who have not acknowledged are reminded after ${content.rules.ackReminderDays} days.`}</p></> : null}
          </div>
        ) : null}

        {/* المعاينة: الغلاف والعنوان كما سيظهران في الرئيسية */}
        <div className="pcx-prev">
          <span className="pcx-prev-lb">{L.postPreview}</span>
          <div className="pc feature" style={{ pointerEvents: 'none' }}>
            <span className="pc-cover">{coverMedia ? <MediaCover m={coverMedia} /> : <Cover spec={cover} ratio="banner" />}<span className="pc-ack">{ack ? <Pill tone="gold" icon="seal">{L.ackRequired}</Pill> : null}</span></span>
            <span className="pc-body">
              <span className={`nk nk-${kind}`}><b>{L.kinds[kind]}</b><span>· {tx(sector.short)}</span></span>
              <b className="pc-title">{title.trim() || L.postPh.title}</b>
              <span className="pc-sum">{summary.trim() || L.postPh.summary}</span>
            </span>
          </div>
        </div>

        <motion.button type="button" className="btn primary block lg" disabled={!ready} onClick={publish} whileTap={{ scale: 0.97 }}><I.send />{L.postPublish}</motion.button>
      </div>

      {/* لكل وسيطة: تعليقها ووصفها للمكفوفين وموضعها، وجعلها غلافاً — فالأرشيف يبقى مفهوماً بعد سنة */}
      <Sheet open={!!editing} onClose={() => setEditId(null)} title={editing ? (editing.kind === 'video' ? L.videoLbl : L.photoLbl) : ''} lead={editing ? <span className="qicon g-teal" style={{ width: 40, height: 40, borderRadius: 13 }}>{editing.kind === 'video' ? <I.play /> : <I.image />}</span> : null}>
        {editing ? (
          <div className="pcx">
            <div className="pcx-medit"><MediaCover m={editing} /></div>
            <p className="cell-sub">{editing.name}{editing.kind === 'video' && editing.durationMs ? ` · ${fmtClock(editing.durationMs)}` : ''}{editing.w ? ` · ${editing.w}×${editing.h}` : ''}</p>
            <label className="pcx-f"><span>{L.mediaCaption}</span><input value={editing.caption?.ar || ''} onChange={(e) => updMedia(editing.id, { caption: { ar: e.target.value, en: editing.caption?.en || '' } })} placeholder={L.mediaCaptionPh} /></label>
            <label className="pcx-f"><span>{L.mediaCaptionEn}</span><input dir="ltr" value={editing.caption?.en || ''} onChange={(e) => updMedia(editing.id, { caption: { ar: editing.caption?.ar || '', en: e.target.value } })} /></label>
            <label className="pcx-f"><span>{L.mediaAlt}</span><input value={editing.alt?.ar || ''} onChange={(e) => updMedia(editing.id, { alt: { ar: e.target.value, en: editing.alt?.en || e.target.value } })} placeholder={L.mediaAltPh} /><span className="cell-sub">{L.mediaAltHint}</span></label>
            <div className="btn-row">
              <button type="button" className="btn quiet" onClick={() => moveMedia(editing.id, -1)} disabled={media.findIndex((x) => x.id === editing.id) === 0}><I.chev className="dirchev" />{L.moveEarlier}</button>
              <button type="button" className="btn quiet" onClick={() => moveMedia(editing.id, 1)} disabled={media.findIndex((x) => x.id === editing.id) === media.length - 1}>{L.moveLater}<I.chev /></button>
            </div>
            {editing.kind === 'image' ? <button type="button" className="btn soft block" onClick={() => { setCoverId(editing.id); setEditId(null); }} disabled={ordered[0]?.id === editing.id}><I.image />{L.makeCover}</button> : null}
            <button type="button" className="btn quiet block" style={{ color: 'var(--danger)' }} onClick={() => removeMedia(editing.id)}><I.trash />{L.removeMedia}</button>
          </div>
        ) : null}
      </Sheet>
    </BottomSheet>
  );
}
