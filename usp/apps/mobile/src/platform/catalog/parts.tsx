/* Building blocks of the Services screen and a domain's screen on the phone (prototype screens/Services.tsx): the
   service row, the "Start now" card, and the sheet of a coming service with "Notify me". Icons and tones come from the
   catalogue's domains, with the prototype's fallbacks when a domain has no tone. */
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, registerInterest, withdrawInterest, type Catalog, type CatalogDomain, type CatalogService } from '@usp/api-client';
import { useI18n } from '@usp/i18n';
import { modules } from '../../registry';
import { Group, Notice, Sheet, SummaryRow, Tile, tileTone, useIsland } from '../../shared/kit';
import { I, type IconName } from '../../shared/icons';
import { type, useTheme } from '../../shared/theme';
import { Button, Pill, T } from '../../shared/ui';

/** An icon name from the catalogue, or the grid when this build does not have it. */
export const iconOf = (name: string | null | undefined): IconName => (name && name in I ? (name as IconName) : 'grid');

/** Where a startable service opens: its module's screen when coded, the configured-service renderer otherwise. */
export function startHref(serviceId: string): string {
  return modules.flatMap((m) => m.screens).find((x) => x.serviceId === serviceId)?.href ?? `/service/${encodeURIComponent(serviceId)}`;
}

/** "Available" · "Coming · Wave 2" · "Later" (the prototype's wave labels). */
export function useStatusText() {
  const { t } = useI18n();
  return (s: CatalogService) => s.startable ? t('services.available')
    : s.status === 'later' ? t('services.later')
    : s.status === 'wave2' || s.status === 'wave3' ? `${t('services.soon')} · ${t('services.wave')} ${s.status === 'wave2' ? 2 : 3}`
    : t('services.soon');
}

/** A startable service opens its request screen; any other shows when it is coming. */
export const openService = (s: CatalogService, onComing: (s: CatalogService) => void) =>
  s.startable ? router.push(startHref(s.id) as Href) : onComing(s);

/** A row of a grouped list (lrow); pass {@code first} for the top one so no separator is drawn above it. */
export function ServiceRow({ s, domain, first, onOpen }: { s: CatalogService; domain: CatalogDomain | undefined; first?: boolean; onOpen: () => void }) {
  const th = useTheme(); const { text } = useI18n(); const status = useStatusText();
  return (
    <Pressable onPress={onOpen} accessibilityRole="button"
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 11, paddingHorizontal: 14, backgroundColor: pressed ? th.bgInset : 'transparent', borderTopWidth: first ? 0 : 1, borderColor: th.hair2 })}>
      <Tile icon={iconOf(domain?.icon)} tone={s.startable ? tileTone(domain?.tone, 'green') : 'plain'} size={40} />
      <View style={{ flex: 1, gap: 2 }}>
        <T weight="heavy" size={type.callout} color={s.startable ? th.fg : th.fg2}>{text(s.name)}</T>
        <T size={type.foot} color={th.fg2} style={{ lineHeight: 19 }}>{text(s.scope)}</T>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Pill tone={s.startable ? 'tint' : ''}>{status(s)}</Pill>
        <I.chev size={16} color={th.fg4} />
      </View>
    </Pressable>
  );
}

/** The "Start now" card (sv). */
export function ServiceCard({ s, domain, onOpen, width = 156 }: { s: CatalogService; domain: CatalogDomain | undefined; onOpen: () => void; width?: number }) {
  const th = useTheme(); const { text } = useI18n();
  return (
    <Pressable onPress={onOpen} accessibilityRole="button"
      style={({ pressed }) => ({ width, minHeight: 132, padding: 14, gap: 8, backgroundColor: th.bgElev, borderRadius: 20, transform: [{ scale: pressed ? 0.96 : 1 }], shadowColor: '#16201b', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1 })}>
      <Tile icon={iconOf(domain?.icon)} tone={tileTone(domain?.tone, 'green')} size={40} />
      <T weight="heavy" size={type.callout} style={{ lineHeight: 21 }}>{text(s.name)}</T>
      <T size={type.cap} color={th.fg3} style={{ lineHeight: 17 }}>{text(s.scope)}</T>
    </Pressable>
  );
}

/** The sheet of a coming service: what it covers, when it arrives, who asks for it — and "Notify me" (kept per person). */
export function ComingSheet({ service, interested, onClose }: { service: CatalogService | null; interested: boolean; onClose: () => void }) {
  const th = useTheme(); const { t, text } = useI18n(); const toast = useIsland(); const qc = useQueryClient();
  const toggle = useMutation({
    mutationFn: ({ id, on }: { id: string; on: boolean }) => (on ? registerInterest(id) : withdrawInterest(id)),
    onSuccess: (_, { id, on }) => {
      qc.setQueryData<Catalog>(['catalog'], (c) => c && { ...c, interested: on ? [...c.interested.filter((x) => x !== id), id] : c.interested.filter((x) => x !== id) });
      toast({ title: t(on ? 'services.notifyOn' : 'services.notifyOff'), icon: 'bell' });
      onClose();
    },
    onError: (e) => toast({ title: e instanceof ApiError && e.title ? text(e.title) : t('common.saveFailed'), icon: 'alert', tone: 'danger' }),
  });
  const requesters = service ? text(service.requesters) : ''; const target = service ? text(service.target) : '';
  return (
    <Sheet open={!!service} onClose={onClose} title={service ? text(service.name) : ''}>
      {service ? (
        <>
          <T size={type.sub} color={th.fg2}>{text(service.scope)}</T>
          <Notice tone="tint" icon="clock">{service.status === 'wave2' || service.status === 'wave3' ? t('services.comingWave', { n: service.status === 'wave2' ? 2 : 3 }) : t('services.comingLater')}</Notice>
          {requesters || target ? (
            <Group>
              {requesters ? <SummaryRow k={t('services.requestFrom')} v={requesters} last={!target} /> : null}
              {target ? <SummaryRow k={t('services.endsIn')} v={target} last /> : null}
            </Group>
          ) : null}
          <Button kind="secondary" icon={interested ? 'check' : 'bell'} title={t(interested ? 'services.notifyOn' : 'services.notify')} disabled={toggle.isPending}
            onPress={() => toggle.mutate({ id: service.id, on: !interested })} />
        </>
      ) : null}
    </Sheet>
  );
}

/** The coming service whose sheet is open, and whether the viewer asked to be told about it. */
export function useComing(catalog: Catalog | undefined) {
  const [coming, setComing] = useState<CatalogService | null>(null);
  const sheet = <ComingSheet service={coming} interested={!!coming && !!catalog?.interested.includes(coming.id)} onClose={() => setComing(null)} />;
  return { setComing, sheet };
}
