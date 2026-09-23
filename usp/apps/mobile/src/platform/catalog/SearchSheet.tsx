/* The search island's sheet on the phone (prototype ui/SearchSheet.tsx): searches the catalogue; a startable service
   opens, any other its domain. */
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { searchCatalog, type CatalogService } from '@usp/api-client';
import { useI18n } from '@usp/i18n';
import { SearchInput } from '../../shared/kit';
import { I } from '../../shared/icons';
import { type as ty, useTheme } from '../../shared/theme';
import { T } from '../../shared/ui';
import { startHref, useStatusText } from './parts';
import { useCatalog } from './queries';

export function SearchSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const th = useTheme(); const { t, text, plural } = useI18n(); const router = useRouter(); const insets = useSafeAreaInsets(); const status = useStatusText(); const [q, setQ] = useState('');
  const catalog = useCatalog(open);
  useEffect(() => { if (!open) setQ(''); }, [open]);
  const services = catalog.data?.services ?? [];
  const hits = searchCatalog(services, q, 8);
  const go = (s: CatalogService) => { onClose(); router.push((s.startable ? startHref(s.id) : `/domain/${s.domain}`) as Href); };
  return (
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: th.bgElev, paddingHorizontal: 20, paddingTop: 8, paddingBottom: insets.bottom }}>
        <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: th.bgInset2, alignSelf: 'center', marginVertical: 8 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <T weight="heavy" size={ty.title2}>{t('search.island')}</T>
          <Pressable onPress={onClose} accessibilityLabel={t('common.close')} hitSlop={10}><I.x size={24} color={th.tint} /></Pressable>
        </View>
        <SearchInput value={q} onChange={setQ} placeholder={t('search.placeholder')} autoFocus />
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingVertical: 12 }}>
          {!q.trim() ? <T size={ty.foot} color={th.fg2}>{plural('search.hint', services.length)}</T>
            : !hits.length ? <T size={ty.foot} color={th.fg2}>{t('search.noHits')}</T>
            : hits.map((s) => (
              <Pressable key={s.id} onPress={() => go(s)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 6, borderRadius: 14, backgroundColor: pressed ? th.bgInset : 'transparent' })}>
                <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: s.startable ? th.tintSoft : th.bgInset }}><I.grid size={20} color={s.startable ? th.tint : th.fg3} /></View>
                <View style={{ flex: 1 }}>
                  <T weight="bold" size={ty.callout}>{text(s.name)}</T>
                  <T size={ty.foot} color={th.fg2}>{status(s)}</T>
                </View>
              </Pressable>
            ))}
        </ScrollView>
      </View>
    </Modal>
  );
}
