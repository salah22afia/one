/* Building blocks of the Services screen and a domain's page (prototype screens/Services.tsx): the service row, the
   "Start now" card, and the sheet of a coming service with "Notify me". Icons and tones come from the catalogue's
   domains (administrator-configured), with the prototype's fallbacks when a domain has no tone. */
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, registerInterest, withdrawInterest, type Catalog, type CatalogDomain, type CatalogService } from '@usp/api-client';
import { useI18n } from '@usp/i18n';
import { BottomSheet, Group, I, Notice, Pill, SPRING, motion, useIsland, type IconName } from '@usp/ui-web';
import { startPath } from '../../app/links';

/** An icon name from the catalogue, or the grid when this build does not have it. */
export const iconOf = (name: string | null | undefined): IconName => (name && name in I ? (name as IconName) : 'grid');

/** "Available" · "Coming · Wave 2" · "Later" (the prototype's wave labels). */
export function useStatusText() {
  const { t } = useI18n();
  return (s: CatalogService) => s.startable ? t('services.available')
    : s.status === 'later' ? t('services.later')
    : s.status === 'wave2' || s.status === 'wave3' ? `${t('services.soon')} · ${t('services.wave')} ${s.status === 'wave2' ? 2 : 3}`
    : t('services.soon');
}

/** A startable service opens its request page; any other shows when it is coming. */
export function useOpenService(onComing: (s: CatalogService) => void) {
  const navigate = useNavigate();
  return (s: CatalogService) => (s.startable ? navigate(startPath(s.id)) : onComing(s));
}

export function ServiceRow({ s, domain, onOpen }: { s: CatalogService; domain: CatalogDomain | undefined; onOpen: () => void }) {
  const { text } = useI18n(); const status = useStatusText(); const Ic = I[iconOf(domain?.icon)];
  return (
    <button type="button" className={`lrow ${s.startable ? '' : 'dim'}`} onClick={onOpen} role="listitem">
      <span className={`qicon ${s.startable ? domain?.tone || 'g-green' : 'g-plain'} sv-ic`}><Ic /></span>
      <span className="lrow-txt"><b>{text(s.name)}</b><span>{text(s.scope)}</span></span>
      <span className="lrow-trail"><Pill tone={s.startable ? 'tint' : ''}>{status(s)}</Pill><I.chev className="dirchev" /></span>
    </button>
  );
}

export function ServiceCard({ s, domain, i, onOpen, reduce, skip }: { s: CatalogService; domain: CatalogDomain | undefined; i: number; onOpen: () => void; reduce: boolean; skip: boolean }) {
  const { text } = useI18n(); const Ic = I[iconOf(domain?.icon)];
  return (
    <motion.button type="button" className="sv" onClick={onOpen} initial={skip ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING.soft, delay: 0.05 + i * 0.04 }} whileTap={{ scale: 0.96 }} whileHover={reduce ? undefined : { y: -2 }}>
      <span className={`qicon ${domain?.tone || 'g-green'} sv-ic`}><Ic /></span>
      <b>{text(s.name)}</b>
      <span>{text(s.scope)}</span>
    </motion.button>
  );
}

/** The sheet of a coming service: what it covers, when it arrives, who asks for it — and "Notify me" (kept per person). */
export function ComingSheet({ service, interested, onClose }: { service: CatalogService | null; interested: boolean; onClose: () => void }) {
  const { t, text } = useI18n(); const toast = useIsland(); const qc = useQueryClient();
  const toggle = useMutation({
    mutationFn: ({ id, on }: { id: string; on: boolean }) => (on ? registerInterest(id) : withdrawInterest(id)),
    onSuccess: (_, { id, on }) => {
      qc.setQueryData<Catalog>(['catalog'], (c) => c && { ...c, interested: on ? [...c.interested.filter((x) => x !== id), id] : c.interested.filter((x) => x !== id) });
      toast({ title: t(on ? 'services.notifyOn' : 'services.notifyOff'), icon: 'bell', tone: on ? 'ok' : '' });
      onClose();
    },
    onError: (e) => toast({ title: e instanceof ApiError && e.title ? text(e.title) : t('common.saveFailed'), icon: 'alert', tone: 'danger' }),
  });
  const requesters = service ? text(service.requesters) : ''; const target = service ? text(service.target) : '';
  return (
    <BottomSheet open={!!service} onClose={onClose} title={service ? text(service.name) : ''}>
      {service && (<>
        <p className="lb-muted">{text(service.scope)}</p>
        <Notice tone="tint" icon="clock">{service.status === 'wave2' || service.status === 'wave3' ? t('services.comingWave', { n: service.status === 'wave2' ? 2 : 3 }) : t('services.comingLater')}</Notice>
        {requesters || target ? (<>
          <div style={{ height: 10 }} />
          <Group>
            {requesters ? <div className="summary-row"><span className="k">{t('services.requestFrom')}</span><span className="v">{requesters}</span></div> : null}
            {target ? <div className="summary-row"><span className="k">{t('services.endsIn')}</span><span className="v">{target}</span></div> : null}
          </Group>
        </>) : null}
        <div style={{ height: 12 }} />
        <button type="button" className="btn secondary block" aria-pressed={interested} disabled={toggle.isPending} onClick={() => toggle.mutate({ id: service.id, on: !interested })}>
          {interested ? <><I.check />{t('services.notifyOn')}</> : <><I.bell />{t('services.notify')}</>}
        </button>
      </>)}
    </BottomSheet>
  );
}

/** The coming service whose sheet is open, and whether the viewer asked to be told about it. */
export function useComing(catalog: Catalog | undefined) {
  const [coming, setComing] = useState<CatalogService | null>(null);
  const sheet = <ComingSheet service={coming} interested={!!coming && !!catalog?.interested.includes(coming.id)} onClose={() => setComing(null)} />;
  return { setComing, sheet };
}
