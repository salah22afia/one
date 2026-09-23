/* The digital employee card on the phone (prototype screens/Me.tsx IdCard): the face is read at a glance; tapped, it
   flips to a QR code the portal signed for a short time, which anyone can scan to check the card. */
import { useEffect, useRef } from 'react';
import { Animated, Image, Pressable, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { getCard, getProfile } from '@usp/api-client';
import { useI18n } from '@usp/i18n';
import { Gradient, QrCode } from '../../shared/kit';
import { I } from '../../shared/icons';
import { type } from '../../shared/theme';
import { T } from '../../shared/ui';
import emblem from '../../../assets/emblem.png';

const HERO: [string, string, string] = ['#11613e', '#0b4a2f', '#06331f'];
const GOLD_2 = '#d4b978';
const DIM = 'rgba(255,255,255,0.7)';

export function IdCard({ flipped, onFlip }: { flipped: boolean; onFlip: () => void }) {
  const { t, text, date } = useI18n();
  const card = useQuery({ queryKey: ['me', 'card'], queryFn: getCard, staleTime: 3_600_000 }).data;
  const profile = useQuery({ queryKey: ['me', 'profile'], queryFn: getProfile, staleTime: 60_000 }).data;
  const name = text(card?.name ?? profile?.name); const no = card?.employeeNo ?? profile?.employeeNo ?? '';
  const role = [text(profile?.title), text(profile?.unit)].filter(Boolean).join(' · ');
  const turn = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.spring(turn, { toValue: flipped ? 1 : 0, stiffness: 220, damping: 26, mass: 1, useNativeDriver: true }).start(); }, [flipped, turn]);
  const face = (from: string, to: string) => ({ transform: [{ perspective: 1100 }, { rotateY: turn.interpolate({ inputRange: [0, 1], outputRange: [from, to] }) }] });
  const side = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0, borderRadius: 24, overflow: 'hidden' as const, padding: 22, paddingBottom: 18, justifyContent: 'space-between' as const, backfaceVisibility: 'hidden' as const };
  const top = (sub: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <View style={{ flex: 1 }}><T weight="bold" size={type.cap} color={GOLD_2}>{t('common.org')}</T><T weight="semibold" size={type.cap} color={DIM}>{sub}</T></View>
      <Image source={emblem} style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: '#fff' }} />
    </View>
  );
  return (
    <Pressable onPress={onFlip} accessibilityRole="button" accessibilityLabel={t('card.label')} style={{ aspectRatio: 1.62, marginTop: 4, marginBottom: 14 }}>
      <Animated.View style={[side, face('0deg', '180deg')]}>
        <Gradient id="idcard-front" colors={HERO} />
        {top(t('card.issuer'))}
        <View><T weight="heavy" size={type.title2} color="#fff">{name}</T><T size={type.sub} color="rgba(255,255,255,0.78)">{role}</T></View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
          <View><T weight="semibold" size={type.cap} color={DIM}>{t('me.employeeNo')}</T><T weight="heavy" size={type.callout} color="#fff">{no ? t('me.cardNo', { n: no }) : ''}</T></View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><I.reset size={15} color={DIM} strokeWidth={1.9} /><T weight="semibold" size={type.cap} color={DIM}>{t('card.flip')}</T></View>
        </View>
      </Animated.View>
      <Animated.View style={[side, face('180deg', '360deg')]}>
        <Gradient id="idcard-back" colors={HERO} />
        {top(t('card.backTitle'))}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18, flex: 1 }}>
          <View style={{ width: 104, height: 104, borderRadius: 16, padding: 7, backgroundColor: '#fff' }}>{card ? <QrCode size={card.qr.size} path={card.qr.path} px={90} /> : null}</View>
          <View style={{ flex: 1, gap: 5 }}>
            <T weight="heavy" size={type.headline} color="#fff">{no ? t('me.cardNo', { n: no }) : ''}</T>
            <T weight="semibold" size={type.cap} color="rgba(255,255,255,0.75)">{t('card.scan')}</T>
            {card ? <T weight="semibold" size={type.cap} color={GOLD_2}>{t('card.validUntil', { t: date(card.expiresAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) })}</T> : null}
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}
