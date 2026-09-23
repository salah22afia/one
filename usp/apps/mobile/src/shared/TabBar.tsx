/* The prototype's phone tab bar (iOS 26): a floating glass capsule with a sliding pill, and the round search island
   beside it that opens the service search. */
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { Animated, Modal, Pressable, ScrollView, TextInput, View, type LayoutChangeEvent } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href, type Tabs } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { catalogServices, getModules, getTasks, searchServices } from '@usp/api-client';
import { useI18n } from '@usp/i18n';
import { modules } from '../registry';
import { I, type IconName } from './icons';
import { T } from './ui';
import { type as ty, useTheme } from './theme';

const TABS: Record<string, { icon: IconName; label: string }> = {
  index: { icon: 'home', label: 'tabs.home' }, inbox: { icon: 'inbox', label: 'tabs.inbox' }, services: { icon: 'grid', label: 'tabs.services' },
  requests: { icon: 'doc', label: 'tabs.requests' }, me: { icon: 'person', label: 'tabs.me' },
};

type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const th = useTheme(); const { t } = useI18n(); const insets = useSafeAreaInsets(); const [search, setSearch] = useState(false);
  const tasks = useQuery({ queryKey: ['tasks'], queryFn: getTasks, refetchInterval: 60_000 }).data?.length ?? 0;
  // The pill follows the measured frame of the selected tab (physical x), so it is right in RTL and LTR alike.
  const [frames, setFrames] = useState<Record<number, { x: number; width: number }>>({}); const x = useRef(new Animated.Value(0)).current;
  const target = frames[state.index];
  useEffect(() => { if (target) Animated.spring(x, { toValue: target.x, stiffness: 500, damping: 38, mass: 1, useNativeDriver: true }).start(); }, [target, x]);
  const glass = { borderRadius: 32, overflow: 'hidden' as const, borderWidth: 1, borderColor: th.glassEdge, backgroundColor: th.glass, shadowColor: '#0b4a2f', shadowOpacity: 0.14, shadowRadius: 20, shadowOffset: { width: 0, height: 10 } };
  return (
    <>
      <View style={{ position: 'absolute', left: 12, right: 12, bottom: insets.bottom + 12, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <View style={[glass, { flex: 1, height: 64 }]}>
          <BlurView intensity={60} tint={th.dark ? 'dark' : 'light'} style={{ flex: 1, flexDirection: 'row', padding: 6 }}>
            {target ? <Animated.View style={{ position: 'absolute', top: 9, bottom: 9, left: 4, width: target.width - 8, borderRadius: 24, backgroundColor: th.tintSoft, transform: [{ translateX: x }] }} /> : null}
            {state.routes.map((r, i) => {
              const tab = TABS[r.name]; if (!tab) return null;
              const on = state.index === i; const Ic = I[tab.icon]; const color = on ? th.tint : th.fg3;
              return (
                <Pressable key={r.key} accessibilityRole="tab" accessibilityState={{ selected: on }} onLayout={(e: LayoutChangeEvent) => { const { x: fx, width } = e.nativeEvent.layout; setFrames((f) => ({ ...f, [i]: { x: fx, width } })); }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 }}
                  onPress={() => { const e = navigation.emit({ type: 'tabPress', target: r.key, canPreventDefault: true }); if (!on && !e.defaultPrevented) navigation.navigate(r.name); }}>
                  <Ic size={25} color={color} strokeWidth={1.75} />
                  <T weight={on ? 'heavy' : 'bold'} size={11} color={color}>{t(tab.label)}</T>
                  {r.name === 'inbox' && tasks ? <View style={{ position: 'absolute', top: 5, start: '52%', minWidth: 18, height: 18, borderRadius: 9, backgroundColor: th.gold, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 }}><T weight="heavy" size={10} color="#fff">{tasks}</T></View> : null}
                </Pressable>
              );
            })}
          </BlurView>
        </View>
        <Pressable accessibilityLabel={t('search.island')} onPress={() => setSearch(true)} style={[glass, { width: 56, height: 56, borderRadius: 28 }]}>
          <BlurView intensity={60} tint={th.dark ? 'dark' : 'light'} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><I.search size={24} color={th.tint} strokeWidth={2} /></BlurView>
        </Pressable>
      </View>
      <SearchSheet open={search} onClose={() => setSearch(false)} />
    </>
  );
}

/** The search island's sheet: catalogue services; an available one opens its screen, others the services tab. */
function SearchSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const th = useTheme(); const { t, text } = useI18n(); const router = useRouter(); const insets = useSafeAreaInsets(); const [q, setQ] = useState('');
  const catalog = useQuery({ queryKey: ['modules'], queryFn: getModules, enabled: open, staleTime: 300_000 });
  useEffect(() => { if (!open) setQ(''); }, [open]);
  const hits = searchServices(catalog.data ?? [], q);
  const coded = (serviceId: string) => modules.flatMap((m) => m.screens).find((x) => x.serviceId === serviceId)?.href;
  const go = (serviceId: string, available: boolean) => { onClose(); router.push((available ? coded(serviceId) ?? `/service/${serviceId}` : '/services') as Href); };
  return (
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: th.bgElev, paddingHorizontal: 20, paddingTop: 8, paddingBottom: insets.bottom }}>
        <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: th.bgInset2, alignSelf: 'center', marginVertical: 8 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <T weight="heavy" size={ty.title2}>{t('search.island')}</T>
          <Pressable onPress={onClose} accessibilityLabel={t('common.close')} hitSlop={10}><I.x size={24} color={th.tint} /></Pressable>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: th.bgInset, borderRadius: 14, paddingHorizontal: 12 }}>
          <I.search size={18} color={th.fg3} />
          <TextInput value={q} onChangeText={setQ} placeholder={t('search.placeholder')} placeholderTextColor={th.fg4} autoFocus returnKeyType="search"
            style={{ flex: 1, paddingVertical: 12, fontFamily: 'Cairo_400Regular', fontSize: ty.callout, color: th.fg }} />
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingVertical: 12 }}>
          {!q.trim() ? <T size={ty.foot} color={th.fg2}>{t('search.hint', { n: catalogServices(catalog.data ?? []).length })}</T>
            : !hits.length ? <T size={ty.foot} color={th.fg2}>{t('search.noHits')}</T>
            : hits.map((s) => (
              <Pressable key={s.key} onPress={() => go(s.serviceId, s.status === 'AVAILABLE')} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 6, borderRadius: 14, backgroundColor: pressed ? th.bgInset : 'transparent' })}>
                <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: s.status === 'AVAILABLE' ? th.tintSoft : th.bgInset }}><I.grid size={20} color={s.status === 'AVAILABLE' ? th.tint : th.fg3} /></View>
                <View style={{ flex: 1 }}>
                  <T weight="bold" size={ty.callout}>{text(s.name)}</T>
                  <T size={ty.foot} color={th.fg2}>{s.status === 'AVAILABLE' ? t('services.available') : s.status === 'LATER' ? t('services.later') : `${t('services.soon')} · ${t('services.wave')} ${s.status === 'WAVE_2' ? 2 : 3}`}</T>
                </View>
              </Pressable>
            ))}
        </ScrollView>
      </View>
    </Modal>
  );
}
