/* The prototype's base components for React Native, with the same tones, radii and type as @usp/ui-web. */
import type { ReactNode } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, Text, View, type TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { REQUEST_STATUS, STEP_STATUS, type RequestStatus, type StepStatus } from '@usp/api-client';
import { useI18n } from '@usp/i18n';
import { I, type IconName } from './icons';
import { font, gutter, radius, type, useTheme } from './theme';
import emblem from '../../assets/emblem.png';


/** Light palette for screens not yet on useTheme(). */
export const colors = { tint: '#0b4a2f', ok: '#2e7d4f', danger: '#b3352c', warn: '#9a6a12', mute: '#8a948e', hair: 'rgba(22, 32, 27, 0.10)', card: '#fff', bg: '#fbf9f3' };

/** Text in Cairo at a prototype weight. */
export function T({ children, weight = 'regular', size = type.body, color, style }: { children: ReactNode; weight?: keyof typeof font; size?: number; color?: string; style?: TextStyle }) {
  const th = useTheme();
  return <Text style={[{ fontFamily: font[weight], fontSize: size, color: color ?? th.fg, textAlign: 'auto' }, style]}>{children}</Text>;
}

export function Card({ children }: { children: ReactNode }) {
  const th = useTheme();
  return <View style={{ backgroundColor: th.bgElev, borderRadius: radius.card, padding: 16, gap: 8, shadowColor: '#16201b', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 1 }}>{children}</View>;
}

type Tone = '' | 'tint' | 'ok' | 'warn' | 'danger' | 'info' | 'gold' | 'done';
/** The prototype's pill tones; with {@code status} it shows a request/step status as the web does. */
export function Pill({ status, tone = '', icon, children }: { status?: RequestStatus | StepStatus; tone?: Tone; icon?: IconName; children?: ReactNode }) {
  const th = useTheme(); const { text } = useI18n();
  let tn = tone; let ic = icon; let label = children;
  if (status) {
    label = text((REQUEST_STATUS as Record<string, { ar: string; en: string }>)[status] ?? STEP_STATUS[status as StepStatus]);
    [tn, ic] = status === 'in_review' || status === 'current' ? ['tint', undefined] : status === 'returned' ? ['warn', 'ret'] : status === 'waiting' ? ['warn', undefined]
      : status === 'rejected' ? ['danger', 'x'] : status === 'completed' || status === 'done' ? ['done', 'check'] : ['', undefined];
  }
  const [bg, fg] = { '': [th.bgInset, th.fg2], tint: [th.tintSoft, th.tint], ok: [th.okSoft, th.ok], warn: [th.warnSoft, th.warn], danger: [th.dangerSoft, th.danger], info: [th.infoSoft, th.info], gold: [th.goldSoft, th.gold], done: ['transparent', th.fg3] }[tn];
  const Ic = ic ? I[ic] : null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', backgroundColor: bg, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3, borderWidth: tn === 'done' ? 1 : 0, borderColor: th.hair }}>
      {Ic ? <Ic size={12} color={fg} strokeWidth={2.2} /> : null}
      <T weight="heavy" size={type.cap} color={fg}>{label}</T>
    </View>
  );
}

/** Buttons: primary (deep green), soft, secondary, danger; {@code plain} is the prototype's quiet button. */
export function Button({ title, onPress, kind = 'primary', disabled, icon }: { title: string; onPress: () => void; kind?: 'primary' | 'soft' | 'secondary' | 'danger' | 'plain'; disabled?: boolean; icon?: IconName }) {
  const th = useTheme();
  const [bg, fg] = { primary: [th.tint, th.tintFg], soft: [th.tintSoft, th.tint], secondary: [th.bgElev, th.fg], danger: [th.dangerSoft, th.danger], plain: ['transparent', th.tint] }[kind];
  const Ic = icon ? I[icon] : null;
  return (
    <Pressable disabled={disabled} onPress={onPress} accessibilityRole="button"
      style={({ pressed }) => ({ flexDirection: 'row', gap: 8, backgroundColor: bg, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 20, opacity: disabled ? 0.45 : 1, alignItems: 'center', justifyContent: 'center', transform: [{ scale: pressed ? 0.97 : 1 }], borderWidth: kind === 'secondary' ? 1 : 0, borderColor: th.hair })}>
      {Ic ? <Ic size={18} color={fg} strokeWidth={2} /> : null}
      <T weight="heavy" size={type.callout} color={fg}>{title}</T>
    </Pressable>
  );
}

export function Avatar({ name, size = 42 }: { name?: string; size?: number }) {
  const th = useTheme();
  const words = (name ?? '').split(/\s+/).filter((w) => w && !['بن', 'بنت', 'bin', 'bint'].includes(w.toLowerCase()));
  const first = words[0] ?? ''; const last = (words.length > 1 ? words[words.length - 1]! : '').replace(/^al-/i, '');
  const initials = !first ? '?' : /[؀-ۿ]/.test(first) ? first.charAt(0) : (first.charAt(0) + last.charAt(0)).toUpperCase();
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: th.tintSoft2, alignItems: 'center', justifyContent: 'center' }}><T weight="heavy" size={size * 0.36} color={th.tint}>{initials}</T></View>;
}

export function Empty({ icon = 'inbox', title, sub }: { icon?: IconName; title: string; sub?: string }) {
  const th = useTheme(); const Ic = I[icon];
  return (
    <View style={{ alignItems: 'center', gap: 8, paddingVertical: 40, paddingHorizontal: 24 }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: th.tintSoft, alignItems: 'center', justifyContent: 'center' }}><Ic size={30} color={th.tint} /></View>
      <T weight="heavy" size={type.headline}>{title}</T>
      {sub ? <T size={type.sub} color={th.fg2} style={{ textAlign: 'center' }}>{sub}</T> : null}
    </View>
  );
}

/** Page frame of the prototype on a phone: top row (back or avatar · emblem · action), then a 34pt title. */
export function Screen({ title, sub, back, root, person, end, onRefresh, refreshing = false, children }: { title: string; sub?: string; back?: boolean; root?: boolean; person?: string; end?: ReactNode; onRefresh?: () => void; refreshing?: boolean; children: ReactNode }) {
  const th = useTheme(); const { t, dir } = useI18n(); const router = useRouter(); const insets = useSafeAreaInsets();
  return (
    <ScrollView style={{ backgroundColor: th.bg }} refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={th.tint} /> : undefined} contentContainerStyle={{ paddingTop: insets.top + 6, paddingHorizontal: gutter, paddingBottom: 120, gap: 12 }}>
      <View style={{ height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ minWidth: 40 }}>
          {back ? <Pressable onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}><View style={{ transform: [{ scaleX: dir === 'rtl' ? 1 : -1 }] }}><I.chev size={20} color={th.tint} /></View><T weight="bold" color={th.tint}>{t('nav.back')}</T></Pressable>
            : root ? <Pressable onPress={() => router.push('/me')} accessibilityLabel={t('tabs.me')}><Avatar name={person} size={34} /></Pressable> : null}
        </View>
        <Image source={emblem} style={{ width: 30, height: 30, position: 'absolute', left: '50%', marginLeft: -15 }} />
        <View style={{ minWidth: 40, alignItems: 'flex-end' }}>{end}</View>
      </View>
      <View style={{ paddingTop: 8, paddingBottom: 4 }}>
        <T weight="heavy" size={32.8} style={{ lineHeight: 40 }}>{title}</T>
        {sub ? <T size={type.sub} color={th.fg2}>{sub}</T> : null}
      </View>
      {children}
    </ScrollView>
  );
}
