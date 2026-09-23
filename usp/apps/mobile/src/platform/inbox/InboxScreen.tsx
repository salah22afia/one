/* Tasks on the phone (prototype screens/Inbox.tsx, C-UX-83): approvals and fulfilment as rows — swipe to approve or
   return, tap for the decision sheet — and under them what is the person's to finish (returned requests). */
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, decide, getDoneTasks, getTasks, isStale, type DecisionAction, type RequestDetail, type TaskItem } from '@usp/api-client';
import { useI18n } from '@usp/i18n';
import { Field, Group, Head, Input, Segmented, Sheet, SummaryRow, SwipeRow, useIsland, useNow } from '../../shared/kit';
import { I } from '../../shared/icons';
import { type, useTheme } from '../../shared/theme';
import { Avatar, Button, Empty, Pill, Screen, T } from '../../shared/ui';
import { useAuth, useMeName } from '../auth/auth';
import { RouteRail } from '../requests/parts';
import { useMyRequests, useRequest } from '../requests/queries';

const DAY = 24 * 3600000;
const short = (name: string) => { const w = name.split(/\s+/).filter((x) => x && !['بن', 'بنت', 'bin', 'bint'].includes(x.toLowerCase())); return w.length > 2 ? `${w[0]} ${w[w.length - 1]}` : w.join(' '); };

function useAfterDecision() {
  const qc = useQueryClient();
  return () => { for (const key of ['tasks', 'tasks-done', 'requests', 'request']) void qc.invalidateQueries({ queryKey: [key] }); };
}

/** Sends a decision with the version the holder saw; the island says what happened; a stale request reloads. */
function useDecide(task: TaskItem, detail: RequestDetail | undefined, onDone: () => void, onFieldError?: (field: string, message: string) => void) {
  const { t, text } = useI18n(); const island = useIsland(); const qc = useQueryClient(); const after = useAfterDecision();
  return useMutation({
    mutationFn: ({ action, note, ref }: { action: DecisionAction; note?: string; ref?: string }) => decide(task.stepId, action, note, ref, detail?.request.version),
    onSuccess: (next, { action, ref }) => {
      qc.setQueryData(['request', task.requestId], next); after();
      const title = action === 'approve' ? t('inbox.approve') : action === 'return' ? t('inbox.return') : action === 'reject' ? t('inbox.reject') : action === 'done' ? t('inbox.fulfil') : text(task.stepTitle);
      island({ title, sub: `${text(task.serviceName)} · ${task.requestId}${action === 'done' && ref ? ` · ${ref}` : ''}`, icon: action === 'return' ? 'ret' : action === 'reject' ? 'x' : 'check', tone: action === 'reject' ? 'danger' : action === 'return' ? 'warn' : 'ok' });
      onDone();
    },
    onError: (e) => {
      if (isStale(e)) { island({ title: t('requests.stale'), icon: 'reset', tone: 'info' }); after(); return; }
      if (e instanceof ApiError && e.checks.length && onFieldError) { const c = e.checks[0]!; onFieldError(c.field ?? 'note', text(c.text)); return; }
      island({ title: e instanceof ApiError && e.title ? text(e.title) : t('form.failed'), icon: 'alert', tone: 'danger' });
    },
  });
}

function TaskRow({ tk, onOpen }: { tk: TaskItem; onOpen: () => void }) {
  const th = useTheme(); const { t, text, lang, ago, duration } = useI18n(); const now = useNow();
  const quick = useDecide(tk, undefined, () => {});
  const name = text(tk.requester.name);
  const left = tk.dueAt ? Date.parse(tk.dueAt) - now : Infinity;
  const pill = tk.overdue && tk.dueAt ? <Pill tone="danger">{t('inbox.overdueBy', { t: duration(now - Date.parse(tk.dueAt)) })}</Pill>
    : left < 90 * DAY ? <Pill tone={left < DAY ? 'warn' : 'tint'} icon="clock">{t('inbox.dueIn', { t: duration(left) })}</Pill> : null;
  const quickApprove = () => { if (tk.mode === 'fulfil') { onOpen(); return; } quick.mutate({ action: tk.mode === 'receipt' ? 'receive' : 'approve' }); };
  const actions = [
    { label: tk.mode === 'receipt' ? t('status.done') : tk.mode === 'fulfil' ? t('inbox.fulfil') : t('inbox.approve'), icon: 'check' as const, tone: 'ok' as const, onPress: quickApprove },
    ...(tk.decisions.includes('return') ? [{ label: t('inbox.return'), icon: 'ret' as const, tone: 'warn' as const, onPress: onOpen }] : []),
  ];
  return (
    <SwipeRow rtl={lang === 'ar'} onOpen={onOpen} actions={actions}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 11, paddingHorizontal: 14, backgroundColor: th.bgElev }}>
        <Avatar name={name} />
        <View style={{ flex: 1, gap: 2 }}>
          <T weight="heavy" size={type.callout} color={tk.overdue ? th.danger : th.fg}>{`${text(tk.serviceName)} · ${short(name)}`}</T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <T size={type.foot} color={th.fg2}>{text(tk.stepTitle)}{tk.shared ? ` · ${t('inbox.quorumAny')}` : ''} · {ago(tk.startedAt, now)}</T>{pill}
          </View>
        </View>
        <I.chev size={16} color={th.fg4} />
      </View>
    </SwipeRow>
  );
}

function TaskSheet({ task, onDone }: { task: TaskItem; onDone: () => void }) {
  const th = useTheme(); const { t, text, lang, ago } = useI18n(); const now = useNow(); const { state } = useAuth();
  const q = useRequest(task.requestId); const d = q.data;
  const [note, setNote] = useState(''); const [ref, setRef] = useState(''); const [err, setErr] = useState(''); const [refErr, setRefErr] = useState('');
  useEffect(() => { setNote(''); setRef(''); setErr(''); setRefErr(''); }, [task.stepId]);
  const act = useDecide(task, d, onDone, (field, m) => (field === 'ref' ? setRefErr(m) : setErr(m)));
  const me = state.status === 'signedIn' ? state.session.personId : undefined;
  const step = d?.steps.find((s) => s.id === task.stepId);
  const shared = step ? step.assignees.filter((p) => p.id !== me) : [];
  const valued = d ? d.fields.filter((f) => f.value !== undefined && f.value !== null && f.value !== '') : [];
  const isReceipt = task.mode === 'receipt'; const isFulfil = task.mode === 'fulfil';
  const can = (a: DecisionAction) => task.decisions.includes(a);
  const go = (action: DecisionAction) => {
    if ((action === 'return' || action === 'reject') && !note.trim()) { setErr(t('inbox.noteRequired')); return; }
    if (action === 'done' && !ref.trim()) { setRefErr(t('inbox.ref')); return; }
    act.mutate({ action, note: note.trim() || undefined, ref: action === 'done' ? ref.trim() : undefined });
  };
  return (
    <>
      <T size={type.foot} color={th.fg2}>{text(task.requester.name)} · {task.requestId} · {ago(d?.request.createdAt ?? task.startedAt, now)}</T>
      {task.why || shared.length ? (
        <View style={{ backgroundColor: th.bgInset, borderRadius: 14, padding: 12, gap: 6 }}>
          {task.why ? <T size={type.foot}><T weight="heavy" size={type.foot}>{t('inbox.whyMe')} </T>{text(task.why)}</T> : null}
          {shared.length ? <T size={type.foot}><T weight="heavy" size={type.foot}>{t('inbox.quorumAny')}</T> · {t('inbox.sharedWith')} {shared.map((p) => text(p.name)).join(lang === 'ar' ? '، ' : ', ')}</T> : null}
        </View>
      ) : null}
      {valued.length ? <Group>{valued.map((f, i) => <SummaryRow key={f.key} k={text(f.label)} v={f.type === 'attachment' ? <Pill icon="clip">{text(f.display)}</Pill> : text(f.display)} last={i === valued.length - 1} />)}</Group> : null}
      {d ? <Group pad><RouteRail steps={d.steps} now={now} /></Group> : null}
      {isFulfil ? (
        <Group>
          <Field label={t('inbox.ref')} hint={t('inbox.refHint')} error={refErr || undefined}><Input value={ref} maxLength={100} invalid={!!refErr} onChangeText={(v) => { setRef(v); setRefErr(''); }} autoCapitalize="characters" /></Field>
          <Field label={`${t('inbox.note')} (${t('inbox.optional')})`} error={err || undefined}><Input value={note} maxLength={1000} multiline invalid={!!err} onChangeText={(v) => { setNote(v); setErr(''); }} /></Field>
        </Group>
      ) : !isReceipt ? (
        <Group><Field label={t('inbox.note')} error={err || undefined}><Input value={note} maxLength={1000} multiline invalid={!!err} onChangeText={(v) => { setNote(v); setErr(''); }} /></Field></Group>
      ) : null}
      {isReceipt ? <Button icon="check" title={text(task.stepTitle)} disabled={act.isPending} onPress={() => go('receive')} />
        : isFulfil ? <Button icon="check" title={t('inbox.fulfil')} disabled={act.isPending} onPress={() => go('done')} />
        : can('approve') ? <Button icon="check" title={t('inbox.approve')} disabled={act.isPending} onPress={() => go('approve')} /> : null}
      {can('return') || can('reject') ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {can('return') ? <View style={{ flex: 1 }}><Button kind="secondary" icon="ret" title={t('inbox.return')} disabled={act.isPending} onPress={() => go('return')} /></View> : null}
          {can('reject') ? <View style={{ flex: 1 }}><Button kind="danger" icon="x" title={t('inbox.reject')} disabled={act.isPending} onPress={() => go('reject')} /></View> : null}
        </View>
      ) : null}
    </>
  );
}

export default function InboxScreen() {
  const th = useTheme(); const { t, text, ago } = useI18n(); const now = useNow(); const me = useMeName();
  const [tab, setTab] = useState<'pending' | 'done'>('pending'); const [openId, setOpenId] = useState<number | null>(null);
  const tasks = useQuery({ queryKey: ['tasks'], queryFn: getTasks, refetchInterval: 60_000 });
  const done = useInfiniteQuery({ queryKey: ['tasks-done'], queryFn: ({ pageParam }) => getDoneTasks(pageParam), initialPageParam: null as string | null, getNextPageParam: (last) => last.next });
  const mine = useMyRequests('ongoing');
  const yours = (mine.data?.pages.flatMap((p) => p.items) ?? []).filter((r) => r.status === 'returned');
  const pending = tasks.data ?? [];
  const selected = pending.find((x) => x.stepId === openId);
  const [shown, setShown] = useState<TaskItem | undefined>(undefined);
  useEffect(() => { if (selected) setShown(selected); }, [selected]);
  const doneItems = done.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <Screen title={t('inbox.title')} root person={me} onRefresh={() => { void tasks.refetch(); void done.refetch(); }} refreshing={tasks.isRefetching}>
      <Segmented value={tab} onChange={setTab} options={[{ v: 'pending', label: t('inbox.pending'), n: pending.length }, { v: 'done', label: t('inbox.done'), n: done.data?.pages[0]?.total }]} />
      {tab === 'pending' ? (
        <>
          {tasks.isPending ? null : pending.length === 0 ? (
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: th.bgElev, borderRadius: 22, padding: 16 }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: th.okSoft, alignItems: 'center', justifyContent: 'center' }}><I.check size={22} color={th.ok} strokeWidth={2.4} /></View>
              <View style={{ flex: 1 }}><T weight="heavy">{t('inbox.noTasks')}</T><T size={type.foot} color={th.fg2}>{t('inbox.noTasksSub')}</T></View>
            </View>
          ) : (
            <>
              <Head title={t('inbox.approvals')} count={pending.length} />
              <T size={type.cap} color={th.fg3}>{t('inbox.swipeHint')}</T>
              <Group>{pending.map((tk) => <TaskRow key={tk.stepId} tk={tk} onOpen={() => setOpenId(tk.stepId)} />)}</Group>
            </>
          )}
          {yours.length ? (
            <>
              <Head title={t('inbox.yours')} count={yours.length} />
              <Group>
                {yours.map((r) => (
                  <Pressable key={r.id} onPress={() => router.push(`/request/${r.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 14 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: th.warnSoft, alignItems: 'center', justifyContent: 'center' }}><I.ret size={18} color={th.warn} /></View>
                    <View style={{ flex: 1 }}><T weight="heavy">{text(r.serviceName)}</T><T size={type.foot} color={th.fg2}>{r.waiting?.note ? `${t('requests.returnedTo')} · ${r.waiting.note}` : t('requests.returnedTo')}</T></View>
                    <T weight="heavy" size={type.foot} color={th.tint}>{t('requests.finish')}</T>
                  </Pressable>
                ))}
              </Group>
            </>
          ) : null}
        </>
      ) : done.isPending ? null : doneItems.length === 0 ? <Empty icon="check" title={t('inbox.emptyDone')} /> : (
        <>
          <Group>
            {doneItems.map((x) => {
              const name = text(x.requester.name);
              const [tone, label] = x.action === 'return' ? ['warn', t('status.returned')] as const : x.action === 'reject' ? ['danger', t('status.rejected')] as const : ['ok', t('status.done')] as const;
              return (
                <Pressable key={`${x.stepId}-${x.at}`} onPress={() => router.push(`/request/${x.requestId}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 14 }}>
                  <Avatar name={name} />
                  <View style={{ flex: 1 }}><T weight="heavy">{text(x.serviceName)} · {short(name)}</T><T size={type.foot} color={th.fg2}>{text(x.stepTitle)} · {ago(x.at, now)}</T></View>
                  <Pill tone={tone}>{label}</Pill>
                </Pressable>
              );
            })}
          </Group>
          {done.hasNextPage ? <Button kind="plain" title={t('requests.more')} disabled={done.isFetchingNextPage} onPress={() => void done.fetchNextPage()} /> : null}
        </>
      )}
      <Sheet open={openId !== null && !!selected} onClose={() => setOpenId(null)} title={shown ? text(shown.serviceName) : ''} lead={<Avatar name={shown ? text(shown.requester.name) : undefined} size={34} />}>
        {shown ? <TaskSheet task={shown} onDone={() => setOpenId(null)} /> : null}
      </Sheet>
    </Screen>
  );
}
