/* Catalogue tab (prototype DesignerCenter › catalogue): search and filter, domains folded with their counts, a row per
   service with its status, whether it is built, dock and "notify me" pills; a sheet to add or change a service. */
import { useMemo, useState } from 'react';
import {
  CATALOG_FREQUENCIES, CATALOG_STATUSES, addCatalogService, normalizeSearch, updateCatalogService,
  type AdminCatalog, type AdminCatalogService, type CatalogAdminStatus, type CatalogFrequency, type ServiceChange,
} from '@usp/api-client';
import { useI18n, type LocalizedText } from '@usp/i18n';
import { Group, I, Item, Notice, Pill, SearchField, Segmented, Sheet, Stagger } from '@usp/ui-web';
import { ErrorLine, LangFields, filled, iconOf, useCatalogSave } from './parts';

type Filter = 'all' | 'available' | 'coming' | 'hidden';
const COMING = new Set<CatalogAdminStatus>(['wave2', 'wave3', 'later']);
const ID = /^[A-Z]{2,4}-[0-9]{2}[A-Z]?$/;

export function ServicesTab({ catalog }: { catalog: AdminCatalog }) {
  const { t, text, plural } = useI18n();
  const [q, setQ] = useState(''); const [filter, setFilter] = useState<Filter>('all'); const [open, setOpen] = useState<string[]>([]);
  const [editing, setEditing] = useState<AdminCatalogService | null>(null); const [adding, setAdding] = useState(false);
  const rows = useMemo(() => {
    const n = normalizeSearch(q.trim());
    return catalog.services.filter((s) => {
      if (filter === 'available' && s.status !== 'available') return false;
      if (filter === 'coming' && !COMING.has(s.status)) return false;
      if (filter === 'hidden' && s.status !== 'hidden' && s.status !== 'merged') return false;
      return !n || normalizeSearch(`${Object.values(s.name).join(' ')} ${s.id}`).includes(n);
    });
  }, [catalog.services, q, filter]);
  const statusPill = (s: AdminCatalogService) => s.status === 'available' ? <Pill tone="tint">{t('catalogAdmin.status.available')}</Pill>
    : s.status === 'merged' ? <Pill tone="tint" icon="link">{t('catalogAdmin.mergedInto', { id: s.mergedInto ?? '' })}</Pill>
    : s.status === 'hidden' ? <Pill tone="warn" icon="x">{t('catalogAdmin.status.hidden')}</Pill>
    : <Pill>{t(`catalogAdmin.status.${s.status}`)}</Pill>;
  return (
    <Stagger>
      <Item><Notice icon="info">{t('catalogAdmin.hint')}</Notice></Item>
      <Item><div className="dz-tools">
        <SearchField id="catq" value={q} onChange={setQ} placeholder={t('catalogAdmin.search')} />
        <Segmented id="catf" value={filter} onChange={setFilter} options={[{ v: 'all', label: t('catalogAdmin.filter.all') }, { v: 'available', label: t('catalogAdmin.filter.available') }, { v: 'coming', label: t('catalogAdmin.filter.coming') }, { v: 'hidden', label: t('catalogAdmin.filter.hidden') }]} />
      </div></Item>
      <Item><button type="button" className="npc-add" onClick={() => setAdding(true)}><span className="cell-lead"><I.plus /></span>{t('catalogAdmin.newService')}<span className="cell-sub">{t('catalogAdmin.newServiceSub')}</span></button></Item>
      {catalog.domains.map((d) => {
        const list = rows.filter((s) => s.domain === d.code); if (!list.length) return null; const Ic = I[iconOf(d.icon)];
        // Folded with their count (78 services are a long scroll); searching or filtering opens them all.
        const folded = !q.trim() && filter === 'all' && !open.includes(d.code);
        return (
          <Item key={d.code}>
            <button type="button" className={`lb-head sm dz-domhead ${folded ? 'folded' : ''}`} aria-expanded={!folded} onClick={() => setOpen((o) => (o.includes(d.code) ? o.filter((z) => z !== d.code) : [...o, d.code]))}>
              <h2>{text(d.name)}</h2><span className="lb-muted">{d.code} · {list.length}</span><I.chevDown className={`lb-chev ${folded ? '' : 'up'}`} />
            </button>
            {folded ? null : (
              <Group>
                {list.map((s) => (
                  <div key={s.id} className={`cell stacked dz-row ${s.status === 'available' ? 'cfg' : ''}`}>
                    <span className="dz-row-main">
                      <span className={`cell-lead ${s.status === 'available' ? d.tone || '' : 'plain'}`}><Ic /></span>
                      <span className="cell-main"><span className="cell-title">{text(s.name)}<span className="mono cell-code">{s.id}</span></span><span className="cell-sub">{text(s.scope)}</span></span>
                    </span>
                    <span className="dz-row-meta">
                      {statusPill(s)}
                      {s.runnable ? <Pill tone="ok" icon="check">{t('catalogAdmin.built')}</Pill> : <Pill>{t('catalogAdmin.notBuilt')}</Pill>}
                      {s.inDock ? <Pill tone="gold" icon="home">{t('catalogAdmin.inDock')}</Pill> : null}
                      {s.interested ? <Pill tone="tint" icon="bell">{plural('catalogAdmin.waiting', s.interested)}</Pill> : null}
                      <button type="button" className="btn soft sm" onClick={() => setEditing(s)}><I.pen />{t('catalogAdmin.edit')}</button>
                    </span>
                  </div>
                ))}
              </Group>
            )}
          </Item>
        );
      })}
      <ServiceSheet catalog={catalog} service={editing} open={!!editing} onClose={() => setEditing(null)} />
      <ServiceSheet catalog={catalog} service={null} open={adding} onClose={() => setAdding(false)} />
    </Stagger>
  );
}

function ServiceSheet({ catalog, service, open, onClose }: { catalog: AdminCatalog; service: AdminCatalogService | null; open: boolean; onClose: () => void }) {
  const { t, text } = useI18n(); const d = catalog.domains.find((x) => x.code === service?.domain); const Ic = I[iconOf(d?.icon)];
  return (
    <Sheet open={open} onClose={onClose} title={service ? text(service.name) : t('catalogAdmin.newService')}
      lead={<span className={`qicon ${d?.tone || 'g-sage'}`} style={{ width: 40, height: 40, borderRadius: 13 }}>{service ? <Ic /> : <I.plus />}</span>}>
      {open ? <ServiceForm key={service ? `${service.id}:${service.version}` : 'new'} catalog={catalog} service={service} onClose={onClose} /> : null}
    </Sheet>
  );
}

interface Form { id: string; domain: string; name: LocalizedText; scope: LocalizedText; requesters: LocalizedText; target: LocalizedText; keywords: LocalizedText; frequency: CatalogFrequency | ''; status: CatalogAdminStatus; mergedInto: string; order: string }

function ServiceForm({ catalog, service, onClose }: { catalog: AdminCatalog; service: AdminCatalogService | null; onClose: () => void }) {
  const { t, text } = useI18n();
  const [f, setF] = useState<Form>(() => service
    ? { id: service.id, domain: service.domain, name: service.name, scope: service.scope, requesters: service.requesters, target: service.target, keywords: service.keywords, frequency: service.frequency ?? '', status: service.status, mergedInto: service.mergedInto ?? '', order: String(service.order) }
    : { id: '', domain: catalog.domains[0]?.code ?? '', name: {}, scope: {}, requesters: {}, target: {}, keywords: {}, frequency: '', status: 'wave2', mergedInto: '', order: '' });
  const set = <K extends keyof Form>(k: K) => (v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  const change = (): ServiceChange => ({
    domain: f.domain, name: f.name, scope: f.scope, requesters: f.requesters, target: f.target, keywords: f.keywords, frequency: f.frequency || null,
    status: f.status, mergedInto: f.status === 'merged' ? f.mergedInto || null : null, order: f.order.trim() ? Number(f.order) : undefined,
  });
  const save = useCatalogSave(() => (service ? updateCatalogService(service.id, { ...change(), version: service.version }) : addCatalogService({ ...change(), id: f.id.trim().toUpperCase() })),
    service ? 'catalogAdmin.saved' : 'catalogAdmin.added', onClose);
  const idOk = !!service || ID.test(f.id.trim().toUpperCase());
  const ok = idOk && filled(f.name) && !!f.domain && (f.status !== 'merged' || !!f.mergedInto) && (!f.order.trim() || Number.isInteger(Number(f.order)));
  const targets = catalog.services.filter((s) => s.id !== service?.id && s.status !== 'merged');
  return (
    <form className="type-editor" onSubmit={(e) => { e.preventDefault(); if (ok) save.mutate(undefined); }}>
      <Group>
        <div className="ed-row" style={{ padding: '12px 16px 8px' }}>
          {service ? null : (
            <label><span>{t('catalogAdmin.field.code')}</span>
              <input id="cs-id" dir="ltr" className="mono" maxLength={7} autoCapitalize="characters" autoComplete="off" value={f.id} onChange={(e) => set('id')(e.target.value.toUpperCase())} aria-invalid={!!f.id && !idOk} />
              <span className="cell-sub">{t('catalogAdmin.codeHint')}</span></label>
          )}
          <label><span>{t('catalogAdmin.field.domain')}</span>
            <select id="cs-domain" className="select-in" value={f.domain} onChange={(e) => set('domain')(e.target.value)}>{catalog.domains.map((d) => <option key={d.code} value={d.code}>{text(d.name)} · {d.code}</option>)}</select></label>
          <LangFields id="cs-name" label={t('catalogAdmin.field.name')} value={f.name} onChange={set('name')} max={120} />
          <LangFields id="cs-scope" label={t('catalogAdmin.field.scope')} value={f.scope} onChange={set('scope')} rows={2} max={600} />
          <LangFields id="cs-req" label={t('catalogAdmin.field.requesters')} value={f.requesters} onChange={set('requesters')} max={200} />
          <LangFields id="cs-target" label={t('catalogAdmin.field.target')} value={f.target} onChange={set('target')} max={300} />
          <LangFields id="cs-kw" label={t('catalogAdmin.field.keywords')} value={f.keywords} onChange={set('keywords')} max={300} full />
          <p className="cell-sub" style={{ flexBasis: '100%', margin: 0 }}>{t('catalogAdmin.keywordsHint')}</p>
        </div>
      </Group>
      <div style={{ height: 10 }} />
      <Group>
        <div className="ed-row" style={{ padding: '12px 16px 8px' }}>
          <label><span>{t('catalogAdmin.field.status')}</span>
            <select id="cs-status" className="select-in" value={f.status} onChange={(e) => set('status')(e.target.value as CatalogAdminStatus)}>
              {CATALOG_STATUSES.map((st) => <option key={st} value={st} disabled={st === 'available' && !!service && !service.runnable}>{t(`catalogAdmin.status.${st}`)}</option>)}
            </select>
            <span className="cell-sub">{t('catalogAdmin.statusHint')}</span></label>
          {f.status === 'merged' ? (
            <label><span>{t('catalogAdmin.field.mergedInto')}</span>
              <select id="cs-merged" className="select-in" value={f.mergedInto} onChange={(e) => set('mergedInto')(e.target.value)}>
                <option value="">{t('catalogAdmin.chooseMerge')}</option>
                {targets.map((s) => <option key={s.id} value={s.id}>{s.id} · {text(s.name)}</option>)}
              </select></label>
          ) : null}
          <label><span>{t('catalogAdmin.field.frequency')}</span>
            <select id="cs-freq" className="select-in" value={f.frequency} onChange={(e) => set('frequency')(e.target.value as CatalogFrequency | '')}>
              <option value="">{t('catalogAdmin.frequency.none')}</option>
              {CATALOG_FREQUENCIES.map((x) => <option key={x} value={x}>{t(`catalogAdmin.frequency.${x}`)}</option>)}
            </select></label>
          <label><span>{t('catalogAdmin.field.order')}</span>
            <input id="cs-order" className="num" type="number" dir="ltr" step={1} value={f.order} onChange={(e) => set('order')(e.target.value)} />
            <span className="cell-sub">{t('catalogAdmin.orderHint')}</span></label>
        </div>
      </Group>
      <ErrorLine error={save.error} />
      <div style={{ height: 12 }} />
      <button type="submit" className="btn primary block lg" disabled={!ok || save.isPending}><I.check />{service ? t('common.save') : t('catalogAdmin.newService')}</button>
    </form>
  );
}
