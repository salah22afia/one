/* "Services" on the phone (prototype screens/Services.tsx): search first, then "Start now" as a rail of cards, then the
   domains as compact two-column rows (C-UX-86). The catalogue comes from the server, as the administrator configured
   it; coming services open a sheet that says when they arrive. */
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { searchCatalog, type CatalogService } from '@usp/api-client';
import { useI18n } from '@usp/i18n';
import { Group, SearchInput, Tile, tileTone } from '../../shared/kit';
import { I } from '../../shared/icons';
import { gutter, type, useTheme } from '../../shared/theme';
import { Empty, Screen, T } from '../../shared/ui';
import { useMeName } from '../auth/auth';
import { iconOf, openService, ServiceCard, ServiceRow, useComing } from './parts';
import { useCatalog } from './queries';

function SectionHead({ title, count }: { title: string; count?: string }) {
  const th = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, paddingTop: 10 }}>
      <T weight="heavy" size={type.title2}>{title}</T>
      {count ? <T size={type.foot} color={th.fg3}>{count}</T> : null}
    </View>
  );
}

export default function CatalogScreen() {
  const th = useTheme(); const { t, text, plural } = useI18n(); const me = useMeName();
  const catalog = useCatalog(); const [q, setQ] = useState('');
  const { setComing, sheet } = useComing(catalog.data); const open = (s: CatalogService) => openService(s, setComing);
  const all = useMemo(() => catalog.data?.services ?? [], [catalog.data]);
  const domains = useMemo(() => new Map((catalog.data?.domains ?? []).map((d) => [d.code, d])), [catalog.data]);
  const results = useMemo(() => (q.trim() ? searchCatalog(all, q, 12) : []), [q, all]);
  const available = useMemo(() => all.filter((s) => s.startable), [all]);
  const counted = [...domains.values()].map((d) => ({ d, n: all.filter((s) => s.domain === d.code).length })).filter((x) => x.n > 0);
  return (
    <Screen title={t('tabs.services')} root person={me} onRefresh={() => void catalog.refetch()} refreshing={catalog.isRefetching}>
      <SearchInput value={q} onChange={setQ} placeholder={plural('services.searchIn', all.length)} />
      {catalog.isError ? <Empty icon="grid" title={t('common.loadFailed')} /> : !catalog.data ? null : q.trim() ? (
        results.length === 0 ? <Empty icon="search" title={t('services.noResults')} sub={t('services.noResultsSub')} /> : (
          <>
            <SectionHead title={plural('services.n', results.length)} />
            <Group>{results.map((s, i) => <ServiceRow key={s.id} s={s} first={i === 0} domain={domains.get(s.domain)} onOpen={() => open(s)} />)}</Group>
          </>
        )
      ) : (
        <>
          {available.length ? (
            <>
              <SectionHead title={t('services.startNow')} count={plural('services.n', available.length)} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -gutter }} contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: 8, gap: 12 }} accessibilityLabel={t('services.startNow')}>
                {available.map((s) => <ServiceCard key={s.id} s={s} domain={domains.get(s.domain)} onOpen={() => open(s)} />)}
              </ScrollView>
            </>
          ) : null}
          <SectionHead title={t('services.domains')} count={plural('services.n', all.length)} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 }}>
            {counted.map(({ d, n }) => (
              <Pressable key={d.code} onPress={() => router.push(`/domain/${d.code}` as Href)} accessibilityRole="link"
                style={({ pressed }) => ({ width: '48.5%', flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 64, paddingVertical: 8, paddingStart: 10, paddingEnd: 8, backgroundColor: th.bgElev, borderRadius: 16, transform: [{ scale: pressed ? 0.97 : 1 }], shadowColor: '#16201b', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1 })}>
                <Tile icon={iconOf(d.icon)} tone={tileTone(d.tone, 'sage')} size={36} />
                <View style={{ flex: 1, gap: 1 }}>
                  <T weight="heavy" size={13.5} style={{ lineHeight: 17 }}>{text(d.name)}</T>
                  <T weight="semibold" size={11} color={th.fg3}>{plural('services.n', n)}</T>
                </View>
                <I.chev size={14} color={th.fg4} />
              </Pressable>
            ))}
          </View>
        </>
      )}
      {sheet}
    </Screen>
  );
}
