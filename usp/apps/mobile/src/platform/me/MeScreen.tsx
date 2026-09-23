/* "Me" on the phone (prototype screens/Me.tsx, C-UX-87): the digital card, then a grid of widgets that open their
   screens — each business module adds its own (My data, documents, balances, pay, family…), and Settings closes it. */
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { useI18n } from '@usp/i18n';
import { modules } from '../../registry';
import { MeTile } from '../../shared/kit';
import { I } from '../../shared/icons';
import { useTheme } from '../../shared/theme';
import { Screen } from '../../shared/ui';
import { useMeName } from '../auth/auth';
import { IdCard } from './IdCard';

const WIDGETS = modules.flatMap((m) => m.meWidgets ?? []).sort((a, b) => a.order - b.order);

export default function MeScreen() {
  const { t } = useI18n(); const th = useTheme(); const me = useMeName(); const [flipped, setFlipped] = useState(false);
  return (
    <Screen title={t('me.title')} root person={me}
      end={<Pressable onPress={() => router.push('/settings' as Href)} accessibilityRole="button" accessibilityLabel={t('me.settings')} hitSlop={8}><I.gear size={24} color={th.tint} /></Pressable>}>
      <IdCard flipped={flipped} onFlip={() => setFlipped((f) => !f)} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 }}>
        {WIDGETS.map((w) => <w.Component key={w.key} />)}
        <MeTile icon="gear" title={t('me.settings')} sub={t('me.settingsSub')} onPress={() => router.push('/settings' as Href)} />
      </View>
    </Screen>
  );
}
