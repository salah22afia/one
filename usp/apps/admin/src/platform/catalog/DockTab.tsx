/* Home "Start" dock: a preview as Home draws it (lb-dock, then "Services"), the services in order with their label,
   icon and colour, and the prototype's save bar. The whole dock is saved at once, with the version it was read at. */
import { useState } from 'react';
import { updateDock, type AdminCatalog, type DockItem, type Tone } from '@usp/api-client';
import { useI18n, type LocalizedText } from '@usp/i18n';
import { AnimatePresence, Group, I, Item, Notice, Pill, SPRING, Sheet, Stagger, motion } from '@usp/ui-web';
import { ErrorLine, IconChips, LangFields, ToneChips, filled, iconOf, useCatalogSave } from './parts';

const LABEL_MAX = 24;
const DEFAULT_TONE: Tone = 'g-green';

export function DockTab({ catalog }: { catalog: AdminCatalog }) {
  // A new version (saved here or elsewhere) starts a fresh draft from what is now in force.
  return <DockEditor key={catalog.dock.version} catalog={catalog} />;
}

function DockEditor({ catalog }: { catalog: AdminCatalog }) {
  const { t, text } = useI18n(); const { max } = catalog.dock;
  const [items, setItems] = useState<DockItem[]>(catalog.dock.items); const [editing, setEditing] = useState<number | null>(null);
  const dirty = JSON.stringify(items) !== JSON.stringify(catalog.dock.items);
  const save = useCatalogSave(() => updateDock(items, catalog.dock.version), 'catalogAdmin.dockSaved', () => {});
  const services = new Map(catalog.services.map((s) => [s.id, s])); const domains = new Map(catalog.domains.map((d) => [d.code, d]));
  const startable = (id: string) => { const s = services.get(id); return !!s && s.status === 'available' && s.runnable; };
  const candidates = catalog.services.filter((s) => startable(s.id) && !items.some((i) => i.serviceId === s.id));
  const add = (id: string) => {
    const s = services.get(id); if (!s) return; const d = domains.get(s.domain);
    const label = Object.fromEntries(Object.entries(s.name).map(([k, v]) => [k, v.slice(0, LABEL_MAX)]));
    setItems((xs) => [...xs, { serviceId: id, label, icon: d?.icon ?? 'grid', tone: d?.tone ?? null }]);
  };
  const move = (i: number, by: -1 | 1) => setItems((xs) => { const out = [...xs]; const [it] = out.splice(i, 1); out.splice(i + by, 0, it!); return out; });
  const remove = (i: number) => setItems((xs) => xs.filter((_, k) => k !== i));
  return (
    <Stagger>
      <Item><Notice icon="home">{t('catalogAdmin.dockSub', { max })}</Notice></Item>
      <Item>
        <div className="section-label"><span>{t('catalogAdmin.preview')}</span></div>
        <Group>
          <nav className="lb-dock" aria-label={t('catalogAdmin.preview')} style={{ margin: 0, padding: '14px 8px' }}>
            {items.map((it) => { const Ic = I[iconOf(it.icon)]; return <span key={it.serviceId} className="lb-dock-it"><span className={`qicon ${it.tone || DEFAULT_TONE}`}><Ic /></span><span className="lb-dock-l">{text(it.label)}</span></span>; })}
            <span className="lb-dock-it"><span className="qicon g-all"><I.grid /></span><span className="lb-dock-l">{t('tabs.services')}</span></span>
          </nav>
        </Group>
      </Item>
      <Item>
        <div className="section-label"><span>{t('catalogAdmin.field.services')}</span><span className="num">{items.length}/{max}</span></div>
        <Group>
          {items.map((it, i) => {
            const s = services.get(it.serviceId); const Ic = I[iconOf(it.icon)];
            return (
              <div key={it.serviceId} className="cell stacked dz-row">
                <span className="dz-row-main">
                  <span className={`cell-lead ${it.tone || DEFAULT_TONE}`}><Ic /></span>
                  <span className="cell-main"><span className="cell-title">{text(it.label)}<span className="mono cell-code">{it.serviceId}</span></span><span className="cell-sub">{s ? text(s.name) : ''}</span></span>
                </span>
                <span className="dz-row-meta">
                  {startable(it.serviceId) ? null : <Pill tone="warn" icon="alert">{t('catalogAdmin.notBuilt')}</Pill>}
                  <button type="button" className="icon-btn" aria-label={t('catalogAdmin.moveUp')} title={t('catalogAdmin.moveUp')} disabled={i === 0} onClick={() => move(i, -1)}><I.chevDown style={{ transform: 'rotate(180deg)' }} /></button>
                  <button type="button" className="icon-btn" aria-label={t('catalogAdmin.moveDown')} title={t('catalogAdmin.moveDown')} disabled={i === items.length - 1} onClick={() => move(i, 1)}><I.chevDown /></button>
                  <button type="button" className="icon-btn" aria-label={t('catalogAdmin.remove')} title={t('catalogAdmin.remove')} onClick={() => remove(i)}><I.trash /></button>
                  <button type="button" className="btn soft sm" onClick={() => setEditing(i)}><I.pen />{t('catalogAdmin.edit')}</button>
                </span>
              </div>
            );
          })}
        </Group>
      </Item>
      <Item>
        {items.length >= max ? <Notice tone="gold" icon="info">{t('catalogAdmin.dockFull', { max })}</Notice>
          : !candidates.length ? <Notice icon="info">{t('catalogAdmin.dockNone')}</Notice>
          : (
            <Group>
              <div className="ed-row" style={{ padding: '12px 16px 8px' }}>
                <label><span>{t('catalogAdmin.dockAdd')}</span>
                  <select id="dock-add" className="select-in" value="" onChange={(e) => add(e.target.value)}>
                    <option value="">{t('catalogAdmin.dockPick')}</option>
                    {candidates.map((s) => <option key={s.id} value={s.id}>{s.id} · {text(s.name)}</option>)}
                  </select></label>
              </div>
            </Group>
          )}
        <ErrorLine error={save.error} />
      </Item>
      <DockItemSheet item={editing === null ? null : items[editing] ?? null} onClose={() => setEditing(null)}
        onApply={(next) => { setItems((xs) => xs.map((x, k) => (k === editing ? next : x))); setEditing(null); }} />
      <AnimatePresence>
        {dirty && (
          <motion.div className="savebar" initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} transition={SPRING.soft}>
            <span className="sb-n">{t('catalogAdmin.unsaved')}</span>
            <button type="button" className="btn quiet" onClick={() => setItems(catalog.dock.items)}>{t('catalogAdmin.discard')}</button>
            <motion.button type="button" className="btn primary" disabled={save.isPending} onClick={() => save.mutate(undefined)} whileTap={{ scale: 0.97 }}><I.check />{t('common.save')}</motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </Stagger>
  );
}

function DockItemSheet({ item, onClose, onApply }: { item: DockItem | null; onClose: () => void; onApply: (next: DockItem) => void }) {
  const { text } = useI18n(); const Ic = I[iconOf(item?.icon)];
  return (
    <Sheet open={!!item} onClose={onClose} title={item ? text(item.label) : ''}
      lead={item ? <span className={`qicon ${item.tone || DEFAULT_TONE}`} style={{ width: 40, height: 40, borderRadius: 13 }}><Ic /></span> : null}>
      {item ? <DockItemForm key={item.serviceId} item={item} onApply={onApply} /> : null}
    </Sheet>
  );
}

function DockItemForm({ item, onApply }: { item: DockItem; onApply: (next: DockItem) => void }) {
  const { t } = useI18n();
  const [label, setLabel] = useState<LocalizedText>(item.label); const [icon, setIcon] = useState(item.icon); const [tone, setTone] = useState<Tone | null>(item.tone);
  return (
    <form className="type-editor" onSubmit={(e) => { e.preventDefault(); if (filled(label)) onApply({ ...item, label, icon, tone }); }}>
      <Group>
        <div className="ed-row" style={{ padding: '12px 16px 8px' }}>
          <LangFields id="dk-label" label={t('catalogAdmin.field.label')} value={label} onChange={setLabel} max={LABEL_MAX} />
          <IconChips label={t('catalogAdmin.field.icon')} value={icon} onChange={setIcon} />
          <ToneChips label={t('catalogAdmin.field.tone')} value={tone} fallback={DEFAULT_TONE} onChange={setTone} />
        </div>
      </Group>
      <div style={{ height: 12 }} />
      <button type="submit" className="btn primary block lg" disabled={!filled(label)}><I.check />{t('catalogAdmin.apply')}</button>
    </form>
  );
}
