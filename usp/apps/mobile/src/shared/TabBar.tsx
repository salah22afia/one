/* The prototype's phone tab bar (iOS 26): a floating glass capsule with a sliding pill, and the round search island
   beside it that opens the service search (passed in, as it belongs to the catalogue feature). */
import { useEffect, useRef, useState, type ComponentProps, type ComponentType } from 'react';
import { Animated, Pressable, View, type LayoutChangeEvent } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Tabs } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { getTasks } from '@usp/api-client';
import { useI18n } from '@usp/i18n';
import { I, type IconName } from './icons';
import { T } from './ui';
import { useTheme } from './theme';

const TABS: Record<string, { icon: IconName; label: string }> = {
  index: { icon: 'home', label: 'tabs.home' }, inbox: { icon: 'inbox', label: 'tabs.inbox' }, services: { icon: 'grid', label: 'tabs.services' },
  requests: { icon: 'doc', label: 'tabs.requests' }, me: { icon: 'person', label: 'tabs.me' },
};

type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];
/** The sheet the search island opens (the catalogue search, provided by the routes layout). */
export type SearchSheetType = ComponentType<{ open: boolean; onClose: () => void }>;

export function TabBar({ state, navigation, SearchSheet }: BottomTabBarProps & { SearchSheet: SearchSheetType }) {
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
