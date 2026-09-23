/* My documents on the phone (prototype screens/Me.tsx Docs): a Wallet of pass cards, soonest expiry on top; tapping one
   brings it forward with its full number and the way to renew it (MD-05). */
import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ApiError, daysUntil, expiryState, getSession, type DocumentKind, type PersonalDocument } from '@usp/api-client';
import { useI18n } from '@usp/i18n';
import { Gradient, useNow } from '../../../../shared/kit';
import { I, type IconName } from '../../../../shared/icons';
import { type, useTheme } from '../../../../shared/theme';
import { Button, Empty, Screen, T } from '../../../../shared/ui';
import emblem from '../../../../../assets/emblem.png';
import { useMyDocuments } from './queries';

const ICON: Record<DocumentKind, IconName> = { passport: 'passport', id: 'idcard', card: 'card', licence: 'card', contract: 'doc', insurance: 'shield' };
/** The prototype's pass hues (.pass.hue-*) as gradient stops. */
const HUE: Record<DocumentKind, [string, string, string]> = {
  passport: ['#24303a', '#161f26', '#0e151a'], id: ['#0f5c3b', '#0b4a2f', '#083a25'], card: ['#c9a85c', '#b5944d', '#96793b'],
  licence: ['#9c7a4b', '#7d5f36', '#5f4728'], contract: ['#7c9a84', '#5f7d67', '#4a6551'], insurance: ['#2f7c7a', '#1f5f5e', '#164847'],
};
const WHITE_70 = 'rgba(255,255,255,0.7)';

function PassCard({ d, front, first, onFront, now, employeeNo }: { d: PersonalDocument; front: boolean; first: boolean; onFront: () => void; now: number; employeeNo: string }) {
  const { t, text, date, plural } = useI18n(); const th = useTheme(); const Ic = I[ICON[d.kind] ?? 'card'];
  const state = expiryState(d.expiresOn, now); const n = d.expiresOn ? daysUntil(d.expiresOn, now) : 0;
  const masked = d.number.length > 4 ? `${'•'.repeat(Math.min(6, d.number.length - 4))}${d.number.slice(-4)}` : d.number;
  const small = (s: string) => <T weight="bold" size={10} color={WHITE_70}>{s.toUpperCase()}</T>;
  return (
    <Pressable onPress={onFront} accessibilityRole="button" accessibilityState={{ expanded: front }}
      style={({ pressed }) => ({ marginTop: first || front ? 0 : -104, marginBottom: front ? 14 : 0, minHeight: 184, borderRadius: 22, overflow: 'hidden', padding: 14, paddingHorizontal: 16,
        borderWidth: state === 'expiring' ? 2 : 0, borderColor: '#d4b978', transform: [{ scale: pressed ? 0.985 : 1 }], shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 17, shadowOffset: { width: 0, height: 14 }, elevation: 6, zIndex: front ? 2 : 0 })}>
      <Gradient id={`pass-${d.id}`} colors={HUE[d.kind] ?? HUE.card} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Image source={emblem} style={{ width: 26, height: 26, borderRadius: 13 }} />
        <T weight="bold" size={11} color="rgba(255,255,255,0.85)" style={{ flex: 1 }}>{t('common.org')}</T>
        <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }}><Ic size={17} color="#fff" /></View>
      </View>
      <T weight="heavy" size={type.title2} color="#fff" style={{ marginTop: 8 }}>{text(d.title)}</T>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, marginTop: 22 }}>
        <View>{small(t('me.number'))}<T weight="heavy" size={type.sub} color="#fff">{front ? d.number : masked}</T></View>
        <View>{small(t('me.expiresOn'))}<T weight="heavy" size={type.sub} color="#fff">{d.expiresOn ? date(d.expiresOn, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</T></View>
        <View style={{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: state === 'valid' ? 'rgba(255,255,255,0.18)' : '#fff' }}>
          <T weight="heavy" size={11} color={state === 'expired' ? th.danger : state === 'expiring' ? th.warn : '#fff'}>{state === 'expired' ? t('me.expired') : state === 'expiring' ? plural('me.daysLeft', n) : t('me.valid')}</T>
        </View>
      </View>
      {front ? (
        <View>
          <View style={{ flexDirection: 'row', gap: 18, marginTop: 14, marginBottom: 12 }}>
            <View>{small(t('me.issued'))}<T weight="heavy" size={type.sub} color="#fff">{t('me.issuer')}</T></View>
            <View>{small(t('me.employeeNo'))}<T weight="heavy" size={type.sub} color="#fff">{t('me.cardNo', { n: employeeNo })}</T></View>
          </View>
          <Pressable onPress={() => router.push('/service/MD-05' as Href)} accessibilityRole="button"
            style={{ flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 14, paddingVertical: 12 }}>
            <I.reset size={18} color="#0b4a2f" /><T weight="heavy" size={type.callout} color="#0b4a2f">{t('me.renew')}</T>
          </Pressable>
        </View>
      ) : null}
    </Pressable>
  );
}

export default function DocumentsScreen() {
  const { t, text } = useI18n(); const now = useNow(); const q = useMyDocuments(); const [front, setFront] = useState<string | null>(null);
  const session = useQuery({ queryKey: ['session'], queryFn: getSession, staleTime: Infinity }).data;
  const docs = q.data ?? [];
  const ordered = front ? [...docs.filter((d) => d.id === front), ...docs.filter((d) => d.id !== front)] : docs;
  return (
    <Screen title={t('me.docs')} sub={t('me.walletSub')} back onRefresh={() => void q.refetch()} refreshing={q.isRefetching}
      end={<Button kind="soft" small icon="plus" title={t('me.update')} onPress={() => router.push('/service/MD-05' as Href)} />}>
      {q.isError ? <Empty icon="passport" title={q.error instanceof ApiError && q.error.title ? text(q.error.title) : t('me.unavailable')} />
        : !q.data ? null
        : docs.length === 0 ? <Empty icon="passport" title={t('me.noDocs')} />
        : <View style={{ marginTop: 6 }}>{ordered.map((d, i) => <PassCard key={d.id} d={d} first={i === 0} now={now} employeeNo={session?.employeeNo ?? ''} front={front === d.id} onFront={() => setFront(front === d.id ? null : d.id)} />)}</View>}
    </Screen>
  );
}
