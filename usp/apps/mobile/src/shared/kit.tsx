/* More of the prototype's building blocks for React Native (ui/components.tsx, ui/motion.tsx, app/ui.tsx): segmented
   control, grouped rows, notices, form fields, progress dots, ring, bottom sheet, swipe row and the island toast —
   the same tones, radii and type as @usp/ui-web. */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Modal, PanResponder, Pressable, ScrollView, TextInput, View, type TextInputProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { requestProgress, type RequestStatus, type StepStatus } from '@usp/api-client';
import { useI18n } from '@usp/i18n';
import { I, type IconName } from './icons';
import { radius, type, useTheme } from './theme';
import { T } from './ui';

/* ——— Segmented control ——— */
export function Segmented<V extends string>({ value, onChange, options }: { value: V; onChange: (v: V) => void; options: { v: V; label: string; n?: number }[] }) {
  const th = useTheme();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: th.bgInset, borderRadius: 12, padding: 3, gap: 2 }} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.v === value;
        return (
          <Pressable key={o.v} onPress={() => onChange(o.v)} accessibilityRole="tab" accessibilityState={{ selected: on }}
            style={{ flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 7, borderRadius: 10, backgroundColor: on ? th.bgElev : 'transparent',
              shadowColor: '#16201b', shadowOpacity: on ? 0.08 : 0, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } }}>
            <T weight="bold" size={type.foot} color={on ? th.fg : th.fg2}>{o.label}</T>
            {o.n !== undefined ? <T weight="heavy" size={type.cap} color={th.fg3}>{o.n}</T> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/* ——— Grouped rows ——— */
export function Group({ children, pad }: { children: ReactNode; pad?: boolean }) {
  const th = useTheme();
  return <View style={{ backgroundColor: th.bgElev, borderRadius: radius.card, overflow: 'hidden', padding: pad ? 14 : 0, shadowColor: '#16201b', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1 }}>{children}</View>;
}

/** A light section head (lb-head): title and an optional count or action. */
export function Head({ title, count, action }: { title: string; count?: number; action?: ReactNode }) {
  const th = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingTop: 10 }}>
      <T weight="heavy" size={type.title2}>{title}</T>
      {count !== undefined ? <T weight="heavy" size={type.foot} color={th.fg3}>{count}</T> : action}
    </View>
  );
}

/** A summary row (label · value) inside a Group. */
export function SummaryRow({ k, v, last }: { k: string; v: ReactNode; last?: boolean }) {
  const th = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: last ? 0 : 1, borderColor: th.hair2 }}>
      <T size={type.sub} color={th.fg2}>{k}</T>
      <View style={{ flexShrink: 1, alignItems: 'flex-end' }}>{typeof v === 'string' ? <T weight="bold" size={type.sub}>{v}</T> : v}</View>
    </View>
  );
}

/* ——— Notice ——— */
export function Notice({ tone = '', icon = 'info', children }: { tone?: '' | 'tint' | 'warn' | 'danger' | 'gold'; icon?: IconName; children: ReactNode }) {
  const th = useTheme(); const Ic = I[icon];
  const [bg, fg] = { '': [th.bgInset, th.fg2], tint: [th.tintSoft, th.tint], warn: [th.warnSoft, th.warn], danger: [th.dangerSoft, th.danger], gold: [th.goldSoft, th.gold] }[tone];
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: bg, borderRadius: 14, padding: 12 }}>
      <Ic size={18} color={fg} />
      <View style={{ flex: 1 }}>{typeof children === 'string' ? <T size={type.sub} color={th.fg}>{children}</T> : children}</View>
    </View>
  );
}

/* ——— Form fields ——— */
export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  const th = useTheme();
  return (
    <View style={{ gap: 6, paddingVertical: 10, paddingHorizontal: 14 }}>
      <T weight="bold" size={type.foot} color={th.fg2}>{label}</T>
      {children}
      {error ? <T size={type.cap} color={th.danger}>{error}</T> : hint ? <T size={type.cap} color={th.fg3}>{hint}</T> : null}
    </View>
  );
}

export function Input({ invalid, style, ...p }: TextInputProps & { invalid?: boolean }) {
  const th = useTheme();
  return <TextInput placeholderTextColor={th.fg4} {...p} style={[{ backgroundColor: th.bgInset, borderRadius: radius.ctl, paddingHorizontal: 12, paddingVertical: 10, fontFamily: 'Cairo_400Regular', fontSize: type.body, color: th.fg, borderWidth: invalid ? 1.5 : 0, borderColor: th.danger, textAlign: 'auto' }, p.multiline ? { minHeight: 72, textAlignVertical: 'top' } : null, style]} />;
}

/* ——— Service tiles (qicon): the prototype's gradients as their middle tone ——— */
export const TILE = { green: '#16704a', gold: '#c4a660', sage: '#5f9570', bronze: '#a8744a', teal: '#2f7f86' } as const;
export type TileTone = keyof typeof TILE | 'plain';
/** A catalogue tone (g-green…) as a tile tone; {@code fallback} when it has none. */
export const tileTone = (tone: string | null | undefined, fallback: keyof typeof TILE): keyof typeof TILE =>
  tone && tone.startsWith('g-') && tone.slice(2) in TILE ? (tone.slice(2) as keyof typeof TILE) : fallback;
/** {@code plain}: the prototype's g-plain, for what cannot be started yet. */
export function Tile({ icon, tone = 'green', size = 44 }: { icon: IconName; tone?: TileTone; size?: number }) {
  const th = useTheme(); const Ic = I[icon]; const plain = tone === 'plain';
  return <View style={{ width: size, height: size, borderRadius: size * 0.32, backgroundColor: plain ? th.bgInset2 : TILE[tone], alignItems: 'center', justifyContent: 'center' }}><Ic size={size * 0.5} color={plain ? th.fg3 : '#fff'} strokeWidth={1.7} /></View>;
}

/* ——— Search field (the prototype's .search) ——— */
export function SearchInput({ value, onChange, placeholder, autoFocus }: { value: string; onChange: (v: string) => void; placeholder: string; autoFocus?: boolean }) {
  const th = useTheme(); const { t } = useI18n();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: th.bgInset, borderRadius: 14, paddingHorizontal: 12 }}>
      <I.search size={18} color={th.fg3} />
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={th.fg4} autoFocus={autoFocus} returnKeyType="search" accessibilityLabel={placeholder}
        style={{ flex: 1, paddingVertical: 12, fontFamily: 'Cairo_400Regular', fontSize: type.callout, color: th.fg, textAlign: 'auto' }} />
      {value ? <Pressable onPress={() => onChange('')} accessibilityLabel={t('common.close')} hitSlop={10}><I.x size={16} color={th.fg3} /></Pressable> : null}
    </View>
  );
}

/* ——— Progress ——— */
export function ProgressDots({ steps: all, status }: { steps: { status: StepStatus }[]; status: RequestStatus }) {
  const th = useTheme(); const { steps, idx } = requestProgress(all, status);
  return (
    <View style={{ flexDirection: 'row', gap: 3 }} accessibilityElementsHidden>
      {steps.map((s, i) => <View key={i} style={{ width: 16, height: 4, borderRadius: 2, backgroundColor: s.status === 'done' ? th.ok : s.status === 'returned' ? th.warn : i === idx && status !== 'completed' ? th.gold : th.bgInset2 }} />)}
    </View>
  );
}

export function Ring({ value, max, size = 58, stroke = 6, color, track, children }: { value: number; max: number; size?: number; stroke?: number; color: string; track: string; children?: ReactNode }) {
  const r = (size - stroke) / 2; const c = 2 * Math.PI * r; const p = Math.max(0.02, Math.min(1, max ? value / max : 0));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${c * p} ${c}`} />
      </Svg>
      {children}
    </View>
  );
}

/* ——— Bottom sheet ——— */
export function Sheet({ open, onClose, title, lead, children }: { open: boolean; onClose: () => void; title?: string; lead?: ReactNode; children: ReactNode }) {
  const th = useTheme(); const insets = useSafeAreaInsets(); const { t } = useI18n();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: th.scrim }} onPress={onClose} accessibilityLabel={t('common.close')} />
      <View style={{ maxHeight: '88%', backgroundColor: th.bg, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingBottom: insets.bottom + 16 }}>
        <View style={{ alignSelf: 'center', width: 38, height: 5, borderRadius: 3, backgroundColor: th.fg4, marginTop: 8 }} />
        {title !== undefined ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 6 }}>
            {lead}
            <T weight="heavy" size={type.headline} style={{ flex: 1 }}>{title}</T>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close')} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: th.bgInset, alignItems: 'center', justifyContent: 'center' }}><I.x size={16} color={th.fg2} /></Pressable>
          </View>
        ) : null}
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, gap: 10 }} keyboardShouldPersistTaps="handled">{children}</ScrollView>
      </View>
    </Modal>
  );
}

/* ——— Swipe row: reveals the decision buttons (as in Mail) ——— */
export function SwipeRow({ children, actions, onOpen, rtl }: { children: ReactNode; actions: { label: string; icon: IconName; tone: 'ok' | 'warn'; onPress: () => void }[]; onOpen: () => void; rtl: boolean }) {
  const th = useTheme(); const W = actions.length * 92; const sign = rtl ? 1 : -1;
  const x = useRef(new Animated.Value(0)).current; const open = useRef(false);
  const settle = (to: number) => { open.current = to !== 0; Animated.spring(x, { toValue: to, useNativeDriver: true, stiffness: 520, damping: 43, mass: 0.9 }).start(); };
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderMove: (_, g) => { const base = open.current ? sign * W : 0; const v = base + g.dx; x.setValue(sign > 0 ? Math.max(0, Math.min(W, v)) : Math.min(0, Math.max(-W, v))); },
    onPanResponderRelease: (_, g) => { const o = g.dx * sign; settle(open.current ? (o < -W * 0.3 ? 0 : sign * W) : (o > W * 0.4 || g.vx * sign > 0.4 ? sign * W : 0)); },
  })).current;
  return (
    <View style={{ borderRadius: 16, overflow: 'hidden' }}>
      <View style={{ position: 'absolute', top: 0, bottom: 0, [rtl ? 'left' : 'right']: 0, width: W, flexDirection: 'row' }}>
        {actions.map((a) => { const Ic = I[a.icon]; const bg = a.tone === 'ok' ? th.ok : th.warn; return (
          <Pressable key={a.label} onPress={() => { settle(0); a.onPress(); }} style={{ flex: 1, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', gap: 4 }} accessibilityRole="button" accessibilityLabel={a.label}>
            <Ic size={20} color="#fff" /><T weight="bold" size={type.cap} color="#fff">{a.label}</T>
          </Pressable>
        ); })}
      </View>
      <Animated.View style={{ transform: [{ translateX: x }] }} {...pan.panHandlers}>
        <Pressable onPress={() => (open.current ? settle(0) : onOpen())}>{children}</Pressable>
      </Animated.View>
    </View>
  );
}

/* ——— Island: a toast that drops from the top and says what happened ——— */
export interface IslandMsg { title: string; sub?: string; icon?: IconName; tone?: 'ok' | 'warn' | 'danger' | 'info' }
const IslandCtx = createContext<(m: string | IslandMsg) => void>(() => {});
export function IslandProvider({ children }: { children: ReactNode }) {
  const th = useTheme(); const insets = useSafeAreaInsets();
  const [msg, setMsg] = useState<IslandMsg | null>(null); const y = useRef(new Animated.Value(-120)).current; const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = useCallback((m: string | IslandMsg) => {
    const it = typeof m === 'string' ? { title: m } : m; setMsg({ icon: 'check', tone: 'ok', ...it });
    Animated.spring(y, { toValue: 0, useNativeDriver: true, stiffness: 430, damping: 21 }).start();
    clearTimeout(timer.current); timer.current = setTimeout(() => Animated.timing(y, { toValue: -120, duration: 200, useNativeDriver: true }).start(() => setMsg(null)), it.sub ? 3600 : 2800);
  }, [y]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const Ic = msg ? I[msg.icon ?? 'check'] : null; const fg = msg?.tone === 'danger' ? th.danger : msg?.tone === 'warn' ? th.warn : msg?.tone === 'info' ? th.info : th.ok;
  return (
    <IslandCtx.Provider value={show}>
      {children}
      {msg && Ic ? (
        <Animated.View pointerEvents="none" style={{ position: 'absolute', top: insets.top + 6, alignSelf: 'center', transform: [{ translateY: y }], flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#111', borderRadius: 26, paddingVertical: 10, paddingHorizontal: 16, maxWidth: '90%' }}>
          <Ic size={20} color={fg} strokeWidth={2.2} />
          <View style={{ flexShrink: 1 }}><T weight="heavy" size={type.sub} color="#fff">{msg.title}</T>{msg.sub ? <T size={type.cap} color="rgba(255,255,255,0.72)">{msg.sub}</T> : null}</View>
        </Animated.View>
      ) : null}
    </IslandCtx.Provider>
  );
}
export function useIsland() { return useContext(IslandCtx); }

export function useNow(tick = 60000) {
  const [n, setN] = useState(Date.now());
  useEffect(() => { const h = setInterval(() => setN(Date.now()), tick); return () => clearInterval(h); }, [tick]);
  return n;
}

/* ——— Grouped cell (the prototype's .cell): a round lead icon, title and line, a value or pill, a chevron ——— */
export function Cell({ icon, title, sub, value, pill, onPress, chevron = !!onPress, first }: {
  icon: IconName; title: string; sub?: string; value?: ReactNode; pill?: ReactNode; onPress?: () => void; chevron?: boolean; first?: boolean;
}) {
  const th = useTheme(); const Ic = I[icon];
  const body = (pressed: boolean) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16, minHeight: 60, borderTopWidth: first ? 0 : 1, borderColor: th.hair2, backgroundColor: pressed ? th.bgInset : 'transparent' }}>
      <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: th.bgInset, alignItems: 'center', justifyContent: 'center' }}><Ic size={21} color={th.fg2} strokeWidth={1.75} /></View>
      <View style={{ flex: 1, gap: 2 }}>
        <T weight="bold">{title}</T>
        {sub ? <T size={type.sub} color={th.fg2}>{sub}</T> : null}
      </View>
      {typeof value === 'string' ? <T weight="bold" size={type.callout} color={th.fg2}>{value}</T> : value}
      {pill}
      {chevron ? <I.chev size={16} color={th.fg4} /> : null}
    </View>
  );
  return onPress ? <Pressable onPress={onPress} accessibilityRole="button">{({ pressed }) => body(pressed)}</Pressable> : body(false);
}

/* ——— Me widget tile (the prototype's .mw): icon, optional big value, title and a line; opens its screen ——— */
export function MeTile({ icon, tone = '', title, value, sub, warn, onPress }: { icon: IconName; tone?: '' | 'gold' | 'sage'; title: string; value?: ReactNode; sub?: string; warn?: boolean; onPress: () => void }) {
  const th = useTheme(); const Ic = I[icon];
  const [bg, fg] = tone === 'gold' ? [th.goldSoft, th.gold] : tone === 'sage' ? [th.okSoft, th.ok] : [th.tintSoft, th.tint];
  return (
    <Pressable onPress={onPress} accessibilityRole="button"
      style={({ pressed }) => ({ width: '48.5%', minHeight: 118, justifyContent: 'space-between', gap: 10, padding: 12, backgroundColor: th.bgElev, borderRadius: 20, borderWidth: warn ? 1.5 : 0, borderColor: th.gold,
        transform: [{ scale: pressed ? 0.975 : 1 }], shadowColor: '#16201b', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1 })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}><Ic size={17} color={fg} strokeWidth={1.9} /></View>
        <I.chev size={15} color={th.fg4} />
      </View>
      <View style={{ gap: 2 }}>
        {value !== undefined ? (typeof value === 'string' || typeof value === 'number' ? <T weight="heavy" size={22.4}>{value}</T> : value) : null}
        <T weight="heavy" size={type.sub}>{title}</T>
        {sub ? <T size={type.cap} color={th.fg3}>{sub}</T> : null}
      </View>
    </Pressable>
  );
}

/** A diagonal gradient filling its parent (the prototype's hero and pass gradients), drawn with react-native-svg. */
export function Gradient({ colors, id }: { colors: [string, string, string]; id: string }) {
  return (
    <Svg style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} width="100%" height="100%" preserveAspectRatio="none">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={colors[0]} /><Stop offset="0.55" stopColor={colors[1]} /><Stop offset="1" stopColor={colors[2]} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

/** A QR code drawn from its module path (encoded by the server). */
export function QrCode({ size, path, px, color = '#0b4a2f' }: { size: number; path: string; px: number; color?: string }) {
  return <Svg width={px} height={px} viewBox={`0 0 ${size} ${size}`}><Path d={path} fill={color} /></Svg>;
}
