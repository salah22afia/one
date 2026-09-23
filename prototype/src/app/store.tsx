import React, { createContext, useContext, useEffect, useLayoutEffect, useMemo, useReducer } from 'react';
import type { State, Settings, Field, Notification, Step, LeaveInfo, T2 } from '../domain/types';
import { buildSeed, STATE_VERSION } from '../data/seed';
import { createRequest, decide, resubmit, withdraw, afterSchedule, afterApproval, afterRevert, activationTick, slaTick, setHolder, positionById, createCancellation, type Action as DecideAction, type DecideExtra } from '../domain/engine';
import { newDraft, updateDraft, scheduleVersion, cancelVersion, revertVersion, setPeriodClose, setScope, setWindow, setGroup, approveVersion, returnVersion, setGovernance, type PolicyContent, type SeasonalWindow, type Governance, type VersionScope } from '../domain/policy';
import { createNeed, storeDecision, specifyDecision, procurementDecision, quotesDecision, evaluationDecision, budgetDecision, tenderDecision, poDecision, updateExpected, receiptStart, receiptSign, closeRemainder, handoverStart, handoverSign, requestNeedCancel, decideNeedCancel, setCoordinators, provideDecision, rerouteDecision, setPoolStock, type NeedInput, type PrepareInput, type SpecInput, type ProvideInput, type ReceiptInput } from '../domain/need';
import type { NeedOffer, Post, StorySlide } from '../domain/types';
import { commsTick, markStorySeen, ackPost, addToCalendar, dismissLatest, publishStory, publishPost, deleteStorySlide, withdrawPost } from '../domain/comms';
import { createConfiguredRequest, designerTick, type ConfiguredInput } from '../domain/designer';
import { addTenant, updateTenant, switchTenant } from '../domain/tenants';
import { upsertBinding, testBinding } from '../domain/contracts';
import type { Tenant, ContractBinding } from '../domain/types';

const KEY = 'usp-portal-v1';

type Act =
  | { type: 'create'; serviceId: string; requesterId: string; fields: Field[]; attachment?: string; steps?: Step[]; notApplied?: { title: T2; why: T2 }[]; leave?: LeaveInfo; policyVersion?: string }
  | { type: 'policyDraft'; by: string; correctsId?: string; scope?: VersionScope }
  | { type: 'policyScope'; id: string; scope: VersionScope }
  | { type: 'policyRevert'; id: string; by: string; reason: string }
  | { type: 'policyPeriodClose'; close: { until: string; reason: string; reference: string } | null; by: string }
  | { type: 'cancelLeave'; requestId: string; reason: string }
  | { type: 'policyUpdate'; id: string; content: PolicyContent; by: string; why: string }
  | { type: 'policySchedule'; id: string; from: string; reason: string; reference: string }
  | { type: 'policyCancel'; id: string }
  | { type: 'policyWindow'; typeId: string; window: SeasonalWindow; by: string }
  | { type: 'policyGroup'; groupId: string; members: string[]; by: string }
  | { type: 'policyGovernance'; governance: Governance; by: string }
  | { type: 'policyApprove'; id: string; by: string; note?: string }
  | { type: 'policyReturn'; id: string; by: string; note: string }
  | { type: 'orgHolder'; positionId: string; personId?: string }
  | { type: 'tick' }
  /* v0.9 الاحتياج (AS-01) */
  | { type: 'needCreate'; input: NeedInput }
  | { type: 'needStore'; requestId: string; actorId: string; decisions: { lineId: string; action: 'reserve' | 'purchase' }[]; note?: string; specs?: SpecInput[] }
  /* v0.10 (AS-01 2.0): تحديد الصنف، وتجهيز الشراء، والعروض، وحجز الاعتماد بمبلغ */
  | { type: 'needSpecify'; requestId: string; actorId: string; input: { specs: SpecInput[]; note?: string; attachment?: string } }
  /* v0.11 (D-023): التوفير من رصيد الجهة، والتحويل إلى جهة أخرى، وتعديل الرصيد (تشغيل) */
  | { type: 'needProvide'; requestId: string; actorId: string; input: ProvideInput }
  | { type: 'needReroute'; requestId: string; actorId: string; input: { categoryId: string; note: string } }
  | { type: 'needPoolStock'; poolId: string; poolName: T2; qty: number; by: string; why: string }
  | { type: 'needProcurement'; requestId: string; actorId: string; input: PrepareInput }
  | { type: 'needQuotes'; requestId: string; actorId: string; input: { offers: NeedOffer[]; note?: string; shortfallWhy?: string } }
  | { type: 'needEvaluate'; requestId: string; actorId: string; input: { offer: string; amount?: number; note: string; attachment?: string } }
  | { type: 'needBudget'; requestId: string; actorId: string; ref: string; note?: string; amount?: number }
  | { type: 'needTender'; requestId: string; actorId: string; input: { ref: string; result: string; supplier?: string; supplierId?: string; amount?: number; attachment?: string } }
  | { type: 'needPO'; requestId: string; actorId: string; input: { poNo?: string; expectedAt?: string } }
  | { type: 'needExpected'; requestId: string; actorId: string; expectedAt: string; why: string }
  | { type: 'needReceipt'; requestId: string; actorId: string; input: ReceiptInput }
  | { type: 'needReceiptSign'; requestId: string; actorId: string }
  | { type: 'needCloseRemainder'; requestId: string; actorId: string; why: string }
  | { type: 'needHandoverStart'; requestId: string; actorId: string }
  | { type: 'needHandoverSign'; requestId: string; actorId: string }
  | { type: 'needCancelRequest'; requestId: string; reason: string }
  | { type: 'needCancelDecide'; requestId: string; actorId: string; accepted: boolean; note: string }
  | { type: 'needCoordinators'; sectorId: string; sectorName: T2; positionIds: string[]; by: string }
  | { type: 'needPolicyDraft'; by: string }
  | { type: 'needPolicyUpdate'; id: string; content: PolicyContent; by: string; why: string }
  | { type: 'needPolicySchedule'; id: string; from: string; reason: string; reference: string }
  | { type: 'needPolicyCancel'; id: string }
  /* v0.13 «اليوم»: القصص والمنشورات وتأكيد الاطلاع وسياسة الأخبار والقصص */
  | { type: 'storySeen'; personId: string; sectorId: string; slideId: string }
  | { type: 'ack'; personId: string; postId: string }
  | { type: 'calAdd'; personId: string; postId: string }
  | { type: 'dismiss'; personId: string; notificationId: string }
  | { type: 'storyPublish'; publisherId: string; sectorId: string; slide: StorySlide }
  | { type: 'postPublish'; publisherId: string; post: Omit<Post, 'id' | 'at' | 'publisherId'> }
  | { type: 'storyDelete'; personId: string; storyId: string; slideId: string }
  | { type: 'postWithdraw'; personId: string; postId: string; reason: string }
  | { type: 'commsPolicyDraft'; by: string }
  | { type: 'commsPolicyUpdate'; id: string; content: PolicyContent; by: string; why: string }
  | { type: 'commsPolicySchedule'; id: string; from: string; reason: string; reference: string }
  | { type: 'commsPolicyCancel'; id: string }
  /* v0.15 مصمّم الخدمات (CAP-02): سياسة رابعة على الآلة نفسها، وطلب على خدمة مهيّأة */
  | { type: 'designerDraft'; by: string }
  | { type: 'designerUpdate'; id: string; content: PolicyContent; by: string; why: string }
  | { type: 'designerSchedule'; id: string; from: string; reason: string; reference: string }
  | { type: 'designerCancel'; id: string }
  | { type: 'configuredCreate'; input: ConfiguredInput }
  /* v0.16: المستأجرون وربط العقود */
  | { type: 'tenantAdd'; tenant: Tenant }
  | { type: 'tenantUpdate'; id: string; patch: Partial<Tenant> }
  | { type: 'tenantSwitch'; id: string }
  | { type: 'bindingUpsert'; binding: Omit<ContractBinding, 'id' | 'createdAt'> & { id?: string } }
  | { type: 'bindingTest'; id: string; by: string }
  | { type: 'decide'; requestId: string; action: DecideAction; actorId: string; note?: string; ref?: string; extra?: DecideExtra }
  | { type: 'resubmit'; requestId: string; fields: Field[]; values?: Record<string, string | string[] | boolean> }
  | { type: 'withdraw'; requestId: string }
  | { type: 'read'; id: string }
  | { type: 'readAll'; personId: string }
  | { type: 'settings'; patch: Partial<Settings> }
  | { type: 'reset' };

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const v = JSON.parse(raw) as State; if (v && v.version === STATE_VERSION) return v; }
  } catch { /* ignore */ }
  return buildSeed();
}
/** الفحوص الدورية: سريان الإصدارات التي بلغت تاريخها، ومهل الخطوات (تذكير وتصعيد) */
const tick = (s: State) => designerTick(commsTick(slaTick(activationTick(s))));
function reducer(state: State, a: Act): State {
  switch (a.type) {
    case 'create': { const [s] = createRequest(state, { serviceId: a.serviceId, requesterId: a.requesterId, fields: a.fields, attachment: a.attachment, steps: a.steps, notApplied: a.notApplied, leave: a.leave, policyVersion: a.policyVersion }); return s; }
    case 'policyDraft': return { ...state, policy: newDraft(state.policy, a.by, Date.now(), a.correctsId, a.scope) };
    case 'policyScope': return { ...state, policy: setScope(state.policy, a.id, a.scope) };
    case 'policyRevert': { const v = state.policy.versions.find((x) => x.id === a.id); if (!v) return state; return afterRevert({ ...state, policy: revertVersion(state.policy, a.id, a.by, a.reason) }, v, a.reason); }
    case 'policyPeriodClose': return { ...state, policy: setPeriodClose(state.policy, a.close, a.by) };
    case 'cancelLeave': { const [s] = createCancellation(state, a.requestId, a.reason); return s; }
    case 'policyUpdate': return { ...state, policy: updateDraft(state.policy, a.id, a.content, a.by, a.why) };
    case 'policySchedule': return activationTick(afterSchedule({ ...state, policy: scheduleVersion(state.policy, a.id, a.from, a.reason, a.reference) }, a.id));
    case 'policyCancel': return { ...state, policy: cancelVersion(state.policy, a.id) };
    case 'policyWindow': return { ...state, policy: setWindow(state.policy, a.typeId, a.window, a.by) };
    case 'policyGroup': return { ...state, policy: setGroup(state.policy, a.groupId, a.members, a.by) };
    case 'policyGovernance': return { ...state, policy: setGovernance(state.policy, a.governance, a.by, positionById(state, a.governance.approverPositionId)?.title.ar || a.governance.approverPositionId) };
    case 'policyApprove': return activationTick(afterApproval({ ...state, policy: approveVersion(state.policy, a.id, a.by, a.note) }, a.id));
    case 'policyReturn': return afterApproval({ ...state, policy: returnVersion(state.policy, a.id, a.by, a.note) }, a.id);
    case 'orgHolder': return setHolder(state, a.positionId, a.personId);
    case 'tick': return tick(state);
    case 'decide': { const r = state.requests.find((x) => x.id === a.requestId); const cur = r?.steps.find((x) => x.status === 'current'); if (r?.need && cur?.role === 'handoverSign' && a.action === 'receive') return handoverSign(state, a.requestId, a.actorId); return decide(state, a.requestId, a.action, a.actorId, a.note, Date.now(), a.ref, a.extra); }
    case 'needCreate': { const [s] = createNeed(state, a.input); return s; }
    case 'needStore': return storeDecision(state, a.requestId, a.actorId, a.decisions, Date.now(), a.note, a.specs);
    case 'needSpecify': return specifyDecision(state, a.requestId, a.actorId, a.input);
    case 'needProvide': return provideDecision(state, a.requestId, a.actorId, a.input);
    case 'needReroute': return rerouteDecision(state, a.requestId, a.actorId, a.input);
    case 'needPoolStock': return setPoolStock(state, a.poolId, a.poolName, a.qty, a.by, a.why);
    case 'needProcurement': return procurementDecision(state, a.requestId, a.actorId, a.input);
    case 'needQuotes': return quotesDecision(state, a.requestId, a.actorId, a.input);
    case 'needEvaluate': return evaluationDecision(state, a.requestId, a.actorId, a.input);
    case 'needBudget': return budgetDecision(state, a.requestId, a.actorId, a.ref, Date.now(), a.note, a.amount);
    case 'needTender': return tenderDecision(state, a.requestId, a.actorId, a.input);
    case 'needPO': return poDecision(state, a.requestId, a.actorId, a.input);
    case 'needExpected': return updateExpected(state, a.requestId, a.actorId, a.expectedAt, a.why);
    case 'needReceipt': return receiptStart(state, a.requestId, a.actorId, a.input);
    case 'needReceiptSign': return receiptSign(state, a.requestId, a.actorId);
    case 'needCloseRemainder': return closeRemainder(state, a.requestId, a.actorId, a.why);
    case 'needHandoverStart': return handoverStart(state, a.requestId, a.actorId);
    case 'needHandoverSign': return handoverSign(state, a.requestId, a.actorId);
    case 'needCancelRequest': return requestNeedCancel(state, a.requestId, a.reason);
    case 'needCancelDecide': return decideNeedCancel(state, a.requestId, a.actorId, a.accepted, a.note);
    case 'needCoordinators': return { ...state, needPolicy: setCoordinators(state.needPolicy, a.sectorId, a.sectorName, a.positionIds, a.by) };
    case 'needPolicyDraft': return { ...state, needPolicy: newDraft(state.needPolicy, a.by) };
    case 'needPolicyUpdate': return { ...state, needPolicy: updateDraft(state.needPolicy, a.id, a.content, a.by, a.why) };
    case 'needPolicySchedule': return { ...state, needPolicy: scheduleVersion(state.needPolicy, a.id, a.from, a.reason, a.reference) };
    case 'needPolicyCancel': return { ...state, needPolicy: cancelVersion(state.needPolicy, a.id) };
    case 'storySeen': return markStorySeen(state, a.personId, a.sectorId, a.slideId);
    case 'ack': return ackPost(state, a.personId, a.postId);
    case 'calAdd': return addToCalendar(state, a.personId, a.postId);
    case 'dismiss': return dismissLatest(state, a.personId, a.notificationId);
    case 'storyPublish': { const p = state.people.find((x) => x.id === a.publisherId); return p ? publishStory(state, p, a.sectorId, a.slide) : state; }
    case 'postPublish': { const p = state.people.find((x) => x.id === a.publisherId); return p ? publishPost(state, p, a.post) : state; }
    case 'storyDelete': return deleteStorySlide(state, a.personId, a.storyId, a.slideId);
    case 'postWithdraw': return withdrawPost(state, a.personId, a.postId, a.reason);
    case 'commsPolicyDraft': return { ...state, commsPolicy: newDraft(state.commsPolicy, a.by) };
    case 'commsPolicyUpdate': return { ...state, commsPolicy: updateDraft(state.commsPolicy, a.id, a.content, a.by, a.why) };
    case 'commsPolicySchedule': return { ...state, commsPolicy: scheduleVersion(state.commsPolicy, a.id, a.from, a.reason, a.reference) };
    case 'commsPolicyCancel': return { ...state, commsPolicy: cancelVersion(state.commsPolicy, a.id) };
    case 'designerDraft': return { ...state, designer: newDraft(state.designer, a.by) };
    case 'designerUpdate': return { ...state, designer: updateDraft(state.designer, a.id, a.content, a.by, a.why) };
    case 'designerSchedule': return { ...state, designer: scheduleVersion(state.designer, a.id, a.from, a.reason, a.reference) };
    case 'designerCancel': return { ...state, designer: cancelVersion(state.designer, a.id) };
    case 'configuredCreate': { const [s] = createConfiguredRequest(state, a.input); return s; }
    case 'tenantAdd': return addTenant(state, a.tenant);
    case 'tenantUpdate': return updateTenant(state, a.id, a.patch);
    case 'tenantSwitch': return switchTenant(state, a.id);
    case 'bindingUpsert': return upsertBinding(state, a.binding);
    case 'bindingTest': return testBinding(state, a.id, a.by);
    case 'resubmit': return resubmit(state, a.requestId, a.fields, Date.now(), a.values);
    case 'withdraw': return withdraw(state, a.requestId);
    case 'read': return { ...state, notifications: state.notifications.map((n: Notification) => (n.id === a.id ? { ...n, read: true } : n)) };
    case 'readAll': return { ...state, notifications: state.notifications.map((n) => (n.to === a.personId ? { ...n, read: true } : n)) };
    case 'settings': return { ...state, settings: { ...state.settings, ...a.patch } };
    case 'reset': { const fresh = buildSeed(); return { ...fresh, settings: { ...fresh.settings, lang: state.settings.lang, theme: state.settings.theme, phoneFrame: state.settings.phoneFrame } }; }
  }
}

const Ctx = createContext<{ state: State; dispatch: React.Dispatch<Act> } | null>(null);
export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ } }, [state]);
  /* الفحوص عند الفتح وعند العودة إلى التطبيق وكل دقيقة: سريان الإصدارات، وتذكير المهل وتصعيدها */
  useEffect(() => { dispatch({ type: 'tick' }); const on = () => { if (document.visibilityState === 'visible') dispatch({ type: 'tick' }); }; document.addEventListener('visibilitychange', on); const h = window.setInterval(() => dispatch({ type: 'tick' }), 60000); return () => { document.removeEventListener('visibilitychange', on); window.clearInterval(h); }; }, []);
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.setAttribute('lang', state.settings.lang); root.setAttribute('dir', state.settings.lang === 'ar' ? 'rtl' : 'ltr');
    if (state.settings.theme === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', state.settings.theme);
    /* v0.17: حجم النص من الإعدادات — يكبر النص في الشاشات كلها (الطباعة بالـrem) */
    if (!state.settings.textSize || state.settings.textSize === 'normal') root.removeAttribute('data-text'); else root.setAttribute('data-text', state.settings.textSize);
  }, [state.settings.lang, state.settings.theme, state.settings.textSize]);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useStore() { const v = useContext(Ctx); if (!v) throw new Error('store'); return v; }
