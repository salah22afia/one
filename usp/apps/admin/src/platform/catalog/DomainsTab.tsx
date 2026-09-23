/* Domains tab (prototype policy-centre cards): one card per domain with its tile, code and counts; a sheet changes its
   names, description, icon, colour and order. Domains are the catalogue's fixed frame (one per business module), so
   they are changed, never added or removed here. */
import { useState } from 'react';
import { updateCatalogDomain, type AdminCatalog, type AdminCatalogDomain, type Tone } from '@usp/api-client';
import { useI18n, type LocalizedText } from '@usp/i18n';
import { Group, I, Item, Pill, Press, Sheet, Stagger } from '@usp/ui-web';
import { ErrorLine, IconChips, LangFields, ToneChips, filled, iconOf, useCatalogSave } from './parts';

export function DomainsTab({ catalog }: { catalog: AdminCatalog }) {
  const { t, text, plural } = useI18n(); const [editing, setEditing] = useState<AdminCatalogDomain | null>(null);
  return (
    <>
      <Stagger className="pt-grid" step={0.035}>
        {catalog.domains.map((d) => {
          const Ic = I[iconOf(d.icon)]; const all = catalog.services.filter((s) => s.domain === d.code);
          const listed = all.filter((s) => s.status !== 'hidden' && s.status !== 'merged').length; const available = all.filter((s) => s.status === 'available').length;
          return (
            <Item key={d.code}>
              <Press className="pt-card" onClick={() => setEditing(d)} lift>
                <span className={`qicon ${d.tone || 'g-sage'}`}><Ic /></span>
                <span className="pt-body">
                  <b>{text(d.name)} <span className="mono cell-code">{d.code}</span></b>
                  <span className="pt-meta">
                    <Pill tone="tint">{plural('services.n', listed)}</Pill>
                    {available ? <Pill tone="ok" icon="check"><span className="num">{available}</span> {t('catalogAdmin.status.available')}</Pill> : null}
                    <Pill>{t('catalogAdmin.field.order')} <span className="num">{d.order}</span></Pill>
                  </span>
                </span>
                <I.chev className="chev dirchev" />
              </Press>
            </Item>
          );
        })}
      </Stagger>
      <DomainSheet domain={editing} onClose={() => setEditing(null)} />
    </>
  );
}

function DomainSheet({ domain, onClose }: { domain: AdminCatalogDomain | null; onClose: () => void }) {
  const { text } = useI18n(); const Ic = I[iconOf(domain?.icon)];
  return (
    <Sheet open={!!domain} onClose={onClose} title={domain ? text(domain.name) : ''}
      lead={domain ? <span className={`qicon ${domain.tone || 'g-sage'}`} style={{ width: 40, height: 40, borderRadius: 13 }}><Ic /></span> : null}>
      {domain ? <DomainForm key={`${domain.code}:${domain.version}`} domain={domain} onClose={onClose} /> : null}
    </Sheet>
  );
}

function DomainForm({ domain, onClose }: { domain: AdminCatalogDomain; onClose: () => void }) {
  const { t } = useI18n();
  const [name, setName] = useState<LocalizedText>(domain.name); const [description, setDescription] = useState<LocalizedText>(domain.description);
  const [icon, setIcon] = useState(domain.icon); const [tone, setTone] = useState<Tone | null>(domain.tone); const [order, setOrder] = useState(String(domain.order));
  const save = useCatalogSave(() => updateCatalogDomain(domain.code, { name, description, icon, tone, order: Number(order), version: domain.version }), 'catalogAdmin.saved', onClose);
  const ok = filled(name) && Number.isInteger(Number(order)) && order.trim() !== '';
  return (
    <form className="type-editor" onSubmit={(e) => { e.preventDefault(); if (ok) save.mutate(undefined); }}>
      <Group>
        <div className="ed-row" style={{ padding: '12px 16px 8px' }}>
          <LangFields id="cd-name" label={t('catalogAdmin.field.name')} value={name} onChange={setName} max={120} />
          <LangFields id="cd-desc" label={t('catalogAdmin.field.description')} value={description} onChange={setDescription} rows={2} max={400} />
          <IconChips label={t('catalogAdmin.field.icon')} value={icon} onChange={setIcon} />
          <ToneChips label={t('catalogAdmin.field.tone')} value={tone} fallback="g-sage" onChange={setTone} />
          <label><span>{t('catalogAdmin.field.order')}</span>
            <input id="cd-order" className="num" type="number" dir="ltr" step={1} value={order} onChange={(e) => setOrder(e.target.value)} /></label>
        </div>
      </Group>
      <ErrorLine error={save.error} />
      <div style={{ height: 12 }} />
      <button type="submit" className="btn primary block lg" disabled={!ok || save.isPending}><I.check />{t('common.save')}</button>
    </form>
  );
}
