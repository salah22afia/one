/* v0.13 «اليوم» (D-029…D-031): قصص القطاعات، والأخبار والتعاميم، وتأكيد الاطلاع — كائنات بوابة لا تمسّ النظام المرجعي.
   السياسة الثالثة «الأخبار والقصص» على آلة الإصدارات نفسها: القطاعات الناشرة ومناصبها (من الهيكل، P-10)، وأنواع المنشورات، وقواعد القصة والتأكيد والوسائط؛
   ولحظات التنبيه (P-03): تعميم يطلب تأكيدك، وتذكير بعد المهلة لمن لم يؤكد، وقصة جديدة من قطاعك (اختياري). */
import type { State, Person, Post, Story, StorySlide, T2 } from './types';
import { activeVersion, liveNeed, toISO, type CommsContent, type CommsSector, type PolicyVersion } from './policy';
import { notifyPeople, personById, positionById } from './engine';

const DAY = 86400000;
const EMPTY: CommsContent = { sectors: [], kinds: [], rules: { storyHours: 24, storyVideoMaxSec: 30, storyImageMaxMB: 8, storyVideoMaxMB: 60, ackReminderDays: 3, notifyCircular: true, notifyStory: false } };

export function commsVersion(state: State, today = toISO(Date.now())): PolicyVersion { return activeVersion(state.commsPolicy, today); }
export function commsContent(state: State, today = toISO(Date.now())): CommsContent { return commsVersion(state, today).content.comms || EMPTY; }
/** القطاعات السارية اليوم (الإلغاء إنهاء بتاريخ لا حذف) */
export function sectorsOf(state: State, today = toISO(Date.now())): CommsSector[] { return liveNeed(commsContent(state, today).sectors, today); }
export function sectorById(state: State, id?: string): CommsSector | undefined { return id ? commsContent(state).sectors.find((s) => s.id === id) : undefined; }
/** ناشرو القطاع: شاغلو مناصبه الناشرة الآن (تُعاد قراءتهم من الهيكل عند كل عرض) */
export function publishersOf(state: State, sector: CommsSector): Person[] { return sector.publisherPositionIds.map((pid) => positionById(state, pid)?.holderId).filter((x): x is string => !!x).map((id) => personById(state, id)).filter((p): p is Person => !!p); }
/** القطاعات التي يجوز لهذا الشخص النشر باسمها (بمنصبه)؛ مدير النظام ينشر باسم الأمانة العامة */
export function publishingSectors(state: State, person: Person, today = toISO(Date.now())): CommsSector[] {
  const live = sectorsOf(state, today);
  const mine = live.filter((s) => person.positionId && s.publisherPositionIds.includes(person.positionId));
  if (mine.length) return mine;
  return person.persona === 'admin' ? live.filter((s) => s.id === 'SEC-SG') : [];
}
export function canPublish(state: State, person: Person): boolean { return publishingSectors(state, person).length > 0; }
/** هل يطلب المنشور تأكيد الاطلاع فعلاً؟ الناشر يطلبه على المنشور، والسياسة تحدد الأنواع التي يجوز لها ذلك */
export function needsAck(state: State, p: { kind: Post['kind']; requiresAck?: boolean; withdrawnAt?: number }): boolean { if (p.withdrawnAt) return false; const k = commsContent(state).kinds.find((x) => x.id === p.kind); return !!p.requiresAck && !!k && k.ackAllowed && !k.endedAt; }

/** المنشورات الظاهرة للموظفين: ما لم يُسحب (المسحوب يبقى في السجل لا على الشاشات) */
export function livePosts(state: State): Post[] { return state.posts.filter((p) => !p.withdrawnAt); }
/** هل يجوز لهذا الشخص سحب هذا المنشور؟ ناشره، أو من يملك منصباً ناشراً باسم قطاعه، أو مدير النظام */
export function canWithdraw(state: State, person: Person, p: Post): boolean {
  if (p.withdrawnAt) return false;
  if (p.publisherId === person.id) return true;
  if (p.sectorId && publishingSectors(state, person).some((s) => s.id === p.sectorId)) return true;
  return person.persona === 'admin';
}
/** هل يجوز لهذا الشخص حذف هذا المقطع من قصة القطاع؟ من نشره، أو من يملك منصباً ناشراً باسم القطاع نفسه */
export function canDeleteStory(state: State, person: Person, story: Story, slide: StorySlide): boolean {
  void slide;
  if (story.publisherId === person.id) return true;
  return publishingSectors(state, person).some((s) => s.id === story.sectorId);
}

/* ——— ما يخص كل موظف ——— */
export function seenOf(state: State, personId: string): Record<string, string> { return state.comms.seen[personId] || {}; }
export function acksOf(state: State, personId: string): Record<string, number> { return state.comms.acks[personId] || {}; }
export function calOf(state: State, personId: string): string[] { return state.comms.cal[personId] || []; }
export function dismissedOf(state: State, personId: string): string[] { return state.comms.dismissed[personId] || []; }

export function markStorySeen(state: State, personId: string, sectorId: string, slideId: string): State {
  const cur = seenOf(state, personId); if (cur[sectorId] === slideId) return state;
  return { ...state, comms: { ...state.comms, seen: { ...state.comms.seen, [personId]: { ...cur, [sectorId]: slideId } } } };
}
/** تأكيد الاطلاع: يُسجَّل باسم الموظف ووقته في سجل التعميم (عدّاد التعميم يزيد واحداً) */
export function ackPost(state: State, personId: string, postId: string, at = Date.now()): State {
  const cur = acksOf(state, personId); if (cur[postId]) return state;
  return { ...state, comms: { ...state.comms, acks: { ...state.comms.acks, [personId]: { ...cur, [postId]: at } } }, posts: state.posts.map((p) => (p.id === postId ? { ...p, ackCount: (p.ackCount || 0) + 1 } : p)) };
}
export function addToCalendar(state: State, personId: string, postId: string): State {
  const cur = calOf(state, personId); if (cur.includes(postId)) return state;
  return { ...state, comms: { ...state.comms, cal: { ...state.comms.cal, [personId]: [...cur, postId] } } };
}
export function dismissLatest(state: State, personId: string, notificationId: string): State {
  const cur = dismissedOf(state, personId); if (cur.includes(notificationId)) return state;
  return { ...state, comms: { ...state.comms, dismissed: { ...state.comms.dismissed, [personId]: [...cur, notificationId] } } };
}

/* ——— الحذف والسحب (v0.13.1): القصة تُحذف لأنها عابرة، والمنشور يُسحب بسبب لأنه بلغ الجميع ——— */
/** حذف مقطع من قصة القطاع: يختفي فوراً من الشريط والعارض؛ وتُحذف القصة إن لم يبق فيها مقطع */
export function deleteStorySlide(state: State, personId: string, storyId: string, slideId: string): State {
  const person = personById(state, personId); const story = state.stories.find((x) => x.id === storyId);
  if (!person || !story) return state;
  const slide = story.slides.find((x) => x.id === slideId); if (!slide) return state;
  if (!canDeleteStory(state, person, story, slide)) return state;
  const stories = state.stories.map((st) => (st.id === storyId ? { ...st, slides: st.slides.filter((x) => x.id !== slideId) } : st)).filter((st) => st.slides.length > 0);
  /* مشاهدات هذا المقطع تُنسى حتى لا يبقى القطاع «مشاهَداً» بمقطع لم يعد موجوداً */
  const seen: State['comms']['seen'] = {};
  for (const [pid, m] of Object.entries(state.comms.seen)) { const c = { ...m }; if (c[story.sectorId] === slideId) delete c[story.sectorId]; seen[pid] = c; }
  return { ...state, stories, comms: { ...state.comms, seen } };
}
/** سحب منشور: لا يُحذف — يختفي من الشاشات، ويتوقف طلب التأكيد والتذكير، ويبقى في سجل التأكيدات بسببه ووقته ومن سحبه */
export function withdrawPost(state: State, personId: string, postId: string, reason: string, at = Date.now()): State {
  const person = personById(state, personId); const post = state.posts.find((x) => x.id === postId);
  if (!person || !post || !canWithdraw(state, person, post)) return state;
  const posts = state.posts.map((p) => (p.id === postId ? { ...p, withdrawnAt: at, withdrawnBy: person.id, withdrawReason: reason.trim() } : p));
  /* تنبيهات هذا المنشور تُحذف ممن لم يقرأها بعد، فلا يُطلب فعلٌ على شيء سُحب */
  const link = `#/home/post/${postId}`;
  const notifications = state.notifications.filter((n) => !(n.link === link && !n.read));
  return { ...state, posts, notifications, comms: { ...state.comms, reminded: { ...state.comms.reminded, [postId]: at } } };
}

/* ——— النشر ——— */
/** قصة جديدة باسم القطاع: تُضاف مقطعاً إلى قصة القطاع اليوم؛ وتُبلَّغ وحدة القطاع إن كانت القاعدة كذلك (لا الجميع) */
export function publishStory(state: State, publisher: Person, sectorId: string, slide: StorySlide, at = Date.now()): State {
  const story: Story = { id: `st-${at}`, sectorId, publisherId: publisher.id, slides: [{ ...slide, at }] };
  let s: State = { ...state, stories: [story, ...state.stories] };
  const content = commsContent(s); const sector = content.sectors.find((x) => x.id === sectorId);
  if (content.rules.notifyStory && sector) {
    const ids = s.people.filter((p) => p.id !== publisher.id && unitChainOf(s, p).includes(sector.unitId)).map((p) => p.id);
    s = notifyPeople(s, ids, { kind: 'story', at, link: '#/home', title: { ar: `قصة جديدة من ${sector.name.ar}`, en: `A new story from ${sector.name.en}` }, body: { ar: slide.caption.ar, en: slide.caption.en } });
  }
  return s;
}
/** منشور جديد (خبر أو تعميم أو فعالية): تعميم يطلب التأكيد يُبلَّغ به الجميع (P-03) */
export function publishPost(state: State, publisher: Person, post: Omit<Post, 'id' | 'at' | 'publisherId'>, at = Date.now()): State {
  const id = `p-${at}`; const p: Post = { ...post, id, at, publisherId: publisher.id, ackCount: 0 };
  let s: State = { ...state, posts: [p, ...state.posts] };
  s = circularNotification(s, p, at);
  return s;
}
/** لحظة التنبيه: تعميم يطلب تأكيدك — لكل الموظفين عدا الناشر */
export function circularNotification(state: State, p: Post, at = p.at): State {
  if (!needsAck(state, p) || !commsContent(state).rules.notifyCircular) return state;
  const ids = state.people.filter((x) => x.id !== p.publisherId).map((x) => x.id);
  return notifyPeople(state, ids, { kind: 'circular', at, link: `#/home/post/${p.id}`, title: { ar: `تعميم يطلب تأكيد اطلاعك: ${p.title.ar}`, en: `A circular asks for your acknowledgement: ${p.title.en}` }, body: { ar: p.ackDue ? `أكّد اطلاعك من الرئيسية قبل ${toISO(p.ackDue)}.` : 'أكّد اطلاعك من الرئيسية.', en: p.ackDue ? `Acknowledge it from Home before ${toISO(p.ackDue)}.` : 'Acknowledge it from Home.' } });
}
/** الفحص الدوري: تذكير واحد لكل تعميم بعد مهلة التذكير لمن لم يؤكد بعد */
export function commsTick(state: State, now = Date.now()): State {
  const content = commsContent(state); let s = state;
  for (const p of state.posts) {
    if (!needsAck(state, p) || s.comms.reminded[p.id]) continue;
    if (now < p.at + content.rules.ackReminderDays * DAY) continue;
    const ids = s.people.filter((x) => x.id !== p.publisherId && !acksOf(s, x.id)[p.id]).map((x) => x.id);
    s = notifyPeople(s, ids, { kind: 'reminder', at: now, link: `#/home/post/${p.id}`, title: { ar: `تذكير: تعميم لم تؤكد اطلاعك عليه بعد`, en: 'Reminder: a circular you have not acknowledged yet' }, body: { ar: p.title.ar, en: p.title.en } });
    s = { ...s, comms: { ...s.comms, reminded: { ...s.comms.reminded, [p.id]: now } } };
  }
  return s;
}
/** سلسلة وحدات الشخص من منصبه صعوداً (قسمه ثم إدارته ثم إدارته العامة ثم قطاعه)، فتصله قصة أي وحدة هو تحتها */
export function unitChainOf(state: State, p: Person): string[] {
  const pos = positionById(state, p.positionId); if (!pos) return [];
  const out: string[] = []; const seen = new Set<string>();
  let u = state.org.units.find((x) => x.id === pos.unitId);
  while (u && !seen.has(u.id)) { seen.add(u.id); out.push(u.id); u = u.parentId ? state.org.units.find((x) => x.id === u!.parentId) : undefined; }
  return out;
}

/** مجموعات القصص الحية (خلال مدة القصة من السياسة)، مرتبة: قصتي، ثم غير المشاهَد بالأحدث، ثم المشاهَد */
export interface StoryGroup { sector: CommsSector; story: Story; seen: boolean; mine: boolean }
export function storyGroups(state: State, me: Person, now = Date.now()): StoryGroup[] {
  const content = commsContent(state); const cutoff = now - content.rules.storyHours * 3600000; const seen = seenOf(state, me.id); const mineSectors = publishingSectors(state, me).map((s) => s.id);
  const bySector = new Map<string, Story>();
  for (const st of state.stories) { const slides = st.slides.filter((x) => x.at >= cutoff); if (!slides.length) continue; const cur = bySector.get(st.sectorId); if (cur) cur.slides = [...cur.slides, ...slides].sort((a, b) => a.at - b.at); else bySector.set(st.sectorId, { ...st, slides: [...slides].sort((a, b) => a.at - b.at) }); }
  const groups: StoryGroup[] = sectorsOf(state).filter((sec) => bySector.has(sec.id)).map((sec) => { const story = bySector.get(sec.id)!; const last = story.slides[story.slides.length - 1]; return { sector: sec, story, seen: seen[sec.id] === last.id, mine: mineSectors.includes(sec.id) }; });
  const latest = (g: StoryGroup) => g.story.slides[g.story.slides.length - 1].at;
  return groups.sort((a, b) => (a.mine === b.mine ? (a.seen === b.seen ? latest(b) - latest(a) : a.seen ? 1 : -1) : a.mine ? -1 : 1));
}
export const t2c = (ar: string, en: string): T2 => ({ ar, en });
