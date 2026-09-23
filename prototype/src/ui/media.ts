/* وسائط القصة في المختبر: الصورة أو الفيديو الذي يختاره الناشر من جهازه يُحفظ ملفاً ثنائياً في IndexedDB (لا في حالة المختبر النصية)،
   ويُعطى رابط كائن عند العرض. الصورة تُصغَّر إلى 1440px على الحافة الطويلة (JPEG) قبل الحفظ، والفيديو يُحفظ كما هو مع مدته وأبعاده.
   إن تعذّر التخزين الدائم بقيت الوسائط في الذاكرة لهذه الجلسة. */
import { useEffect, useState } from 'react';
import type { StoryMedia } from '../domain/types';

const DB = 'usp-media'; const STORE = 'blobs';
const mem = new Map<string, Blob>(); const urls = new Map<string, string>();

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('no-idb')); return; }
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
    req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
  });
}
export async function putMedia(id: string, blob: Blob): Promise<'db' | 'memory'> {
  mem.set(id, blob);
  try { const db = await openDb(); await new Promise<void>((res, rej) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(blob, id); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); return 'db'; }
  catch { return 'memory'; }
}
export async function getMedia(id: string): Promise<Blob | undefined> {
  const m = mem.get(id); if (m) return m;
  try { const db = await openDb(); const b = await new Promise<Blob | undefined>((res, rej) => { const tx = db.transaction(STORE, 'readonly'); const r = tx.objectStore(STORE).get(id); r.onsuccess = () => res(r.result as Blob | undefined); r.onerror = () => rej(r.error); }); if (b) mem.set(id, b); return b; }
  catch { return undefined; }
}
export async function deleteMedia(id: string) {
  mem.delete(id); const u = urls.get(id); if (u) { URL.revokeObjectURL(u); urls.delete(id); }
  try { const db = await openDb(); await new Promise<void>((res) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).delete(id); tx.oncomplete = () => res(); tx.onerror = () => res(); }); } catch { /* ignore */ }
}
export async function clearMedia() {
  for (const u of urls.values()) URL.revokeObjectURL(u); urls.clear(); mem.clear();
  try { const db = await openDb(); await new Promise<void>((res) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).clear(); tx.oncomplete = () => res(); tx.onerror = () => res(); }); } catch { /* ignore */ }
}
/** رابط الكائن لوسيطة محفوظة (null حتى تُحمَّل، و'' إن لم تُوجد) */
export function useMediaUrl(media?: StoryMedia): string | null {
  const id = media?.id; const [url, setUrl] = useState<string | null>(id ? urls.get(id) ?? null : null);
  useEffect(() => {
    if (!id) { setUrl(null); return; } const cached = urls.get(id); if (cached) { setUrl(cached); return; }
    let live = true;
    getMedia(id).then((b) => { if (!live) return; if (!b) { setUrl(''); return; } const u = URL.createObjectURL(b); urls.set(id, u); setUrl(u); });
    return () => { live = false; };
  }, [id]);
  return url;
}

/** رابط الكائن برقم الوسيطة مباشرة (للمصغّرة وللإطار الأول) */
export function useMediaUrlById(id?: string): string | null {
  const [url, setUrl] = useState<string | null>(id ? urls.get(id) ?? null : null);
  useEffect(() => {
    if (!id) { setUrl(null); return; } const cached = urls.get(id); if (cached) { setUrl(cached); return; }
    let live = true;
    getMedia(id).then((b) => { if (!live) return; if (!b) { setUrl(''); return; } const u = URL.createObjectURL(b); urls.set(id, u); setUrl(u); });
    return () => { live = false; };
  }, [id]);
  return url;
}

/** الصورة: تُقرأ وتُصغَّر إلى 1440px على الحافة الطويلة وتُحوَّل JPEG (الصور الشفافة تبقى PNG) */
export function prepareImage(file: File, maxEdge = 1440): Promise<{ blob: Blob; w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image(); const src = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
      const c = document.createElement('canvas'); c.width = w; c.height = h; const ctx = c.getContext('2d');
      if (!ctx) { URL.revokeObjectURL(src); resolve({ blob: file, w: img.naturalWidth, h: img.naturalHeight }); return; }
      ctx.drawImage(img, 0, 0, w, h); URL.revokeObjectURL(src);
      const png = file.type === 'image/png';
      c.toBlob((b) => resolve({ blob: b || file, w, h }), png ? 'image/png' : 'image/jpeg', 0.86);
    };
    img.onerror = () => { URL.revokeObjectURL(src); reject(new Error('image')); };
    img.src = src;
  });
}
/** الفيديو: المدة والأبعاد من البيانات الوصفية */
export function readVideoMeta(file: File): Promise<{ durationMs: number; w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video'); const src = URL.createObjectURL(file); v.preload = 'metadata'; v.muted = true;
    v.onloadedmetadata = () => { const out = { durationMs: Math.round((isFinite(v.duration) ? v.duration : 0) * 1000), w: v.videoWidth, h: v.videoHeight }; URL.revokeObjectURL(src); resolve(out); };
    v.onerror = () => { URL.revokeObjectURL(src); reject(new Error('video')); };
    v.src = src;
  });
}
export const fmtMB = (bytes: number) => (bytes < 1048576 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1048576).toFixed(bytes > 10 * 1048576 ? 0 : 1)} MB`);
export const fmtSec = (ms: number, lang: 'ar' | 'en') => { const s = Math.round(ms / 1000); return lang === 'ar' ? `${s} ث` : `${s}s`; };

/* ——— v0.14: وسائط المنشور (عدة صور وفيديو) ——— */
/** نسخة مصغّرة للفسيفساء وللشريط: 480px على الحافة الطويلة — حتى لا يثقل التمرير بصور كاملة */
export async function makeThumb(blob: Blob, maxEdge = 480): Promise<Blob> {
  const file = blob instanceof File ? blob : new File([blob], 'x.jpg', { type: blob.type || 'image/jpeg' });
  try { const { blob: out } = await prepareImage(file, maxEdge); return out; } catch { return blob; }
}
/** الإطار الأول للفيديو: يُلتقط عند الاختيار فلا يظهر مربع أسود قبل التشغيل */
export function captureVideoPoster(file: File, maxEdge = 1280): Promise<{ blob: Blob; w: number; h: number } | null> {
  return new Promise((resolve) => {
    const v = document.createElement('video'); const src = URL.createObjectURL(file);
    let done = false; const finish = (r: { blob: Blob; w: number; h: number } | null) => { if (done) return; done = true; URL.revokeObjectURL(src); resolve(r); };
    v.preload = 'metadata'; v.muted = true; (v as HTMLVideoElement & { playsInline: boolean }).playsInline = true;
    v.onloadeddata = () => {
      try {
        const scale = Math.min(1, maxEdge / Math.max(v.videoWidth || 1, v.videoHeight || 1));
        const w = Math.round((v.videoWidth || 0) * scale), h = Math.round((v.videoHeight || 0) * scale);
        if (!w || !h) { finish(null); return; }
        const c = document.createElement('canvas'); c.width = w; c.height = h; const ctx = c.getContext('2d');
        if (!ctx) { finish(null); return; }
        ctx.drawImage(v, 0, 0, w, h);
        c.toBlob((b) => finish(b ? { blob: b, w, h } : null), 'image/jpeg', 0.82);
      } catch { finish(null); }
    };
    v.onerror = () => finish(null);
    window.setTimeout(() => finish(null), 4000);
    v.src = src; v.currentTime = 0.1;
  });
}
export interface MediaLimits { maxMedia: number; imageMB: number; videoMB: number; videoSec: number }
export type PrepareFail = { name: string; why: 'type' | 'size' | 'duration' | 'read'; max?: string };
/** تجهيز ملفات الناشر واحداً واحداً: ما نجح يُحفظ، وما فشل يُقال سببه — ولا يسقط الباقي بسبب ملف */
export async function preparePostMedia(files: File[], limits: MediaLimits, existing: number, onStep?: (done: number, total: number) => void): Promise<{ media: PostMediaDraft[]; failed: PrepareFail[] }> {
  const room = Math.max(0, limits.maxMedia - existing);
  const list = files.slice(0, room); const media: PostMediaDraft[] = []; const failed: PrepareFail[] = [];
  for (const f of files.slice(room)) failed.push({ name: f.name, why: 'size', max: String(limits.maxMedia) });
  let done = 0;
  for (const file of list) {
    const isVid = file.type.startsWith('video/'); const isImg = file.type.startsWith('image/');
    const step = () => { done += 1; onStep?.(done, list.length); };
    if (!isVid && !isImg) { failed.push({ name: file.name, why: 'type' }); step(); continue; }
    const maxMB = isVid ? limits.videoMB : limits.imageMB;
    if (file.size > maxMB * 1048576) { failed.push({ name: file.name, why: 'size', max: `${maxMB} MB` }); step(); continue; }
    const id = `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    try {
      if (isImg) {
        const { blob, w, h } = await prepareImage(file);
        await putMedia(id, blob);
        const thumb = await makeThumb(blob); const thumbId = `${id}-t`; await putMedia(thumbId, thumb);
        media.push({ id, kind: 'image', w, h, size: blob.size, name: file.name, thumbId });
      } else {
        const meta = await readVideoMeta(file);
        if (limits.videoSec && meta.durationMs > (limits.videoSec + 1) * 1000) { failed.push({ name: file.name, why: 'duration', max: String(limits.videoSec) }); step(); continue; }
        await putMedia(id, file);
        const poster = await captureVideoPoster(file);
        let posterId: string | undefined; let thumbId: string | undefined;
        if (poster) { posterId = `${id}-p`; await putMedia(posterId, poster.blob); thumbId = `${id}-t`; await putMedia(thumbId, await makeThumb(poster.blob)); }
        media.push({ id, kind: 'video', w: meta.w, h: meta.h, durationMs: meta.durationMs, size: file.size, name: file.name, posterId, thumbId });
      }
    } catch { failed.push({ name: file.name, why: 'read' }); }
    step();
  }
  return { media, failed };
}
export interface PostMediaDraft { id: string; kind: 'image' | 'video'; w?: number; h?: number; durationMs?: number; size?: number; name?: string; thumbId?: string; posterId?: string }
/** حذف وسائط منشور من المخزن (عند التراجع عن المؤلّف) */
export async function dropMedia(list: { id: string; thumbId?: string; posterId?: string }[]) {
  for (const m of list) { await deleteMedia(m.id); if (m.thumbId) await deleteMedia(m.thumbId); if (m.posterId) await deleteMedia(m.posterId); }
}
export const fmtClock = (ms: number) => { const s = Math.max(0, Math.round(ms / 1000)); const m = Math.floor(s / 60); return `${m}:${String(s % 60).padStart(2, '0')}`; };
