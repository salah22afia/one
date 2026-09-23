/* Change log (prototype policy centres › changes): what changed, before → after for codes, which texts changed, who
   and when. Newest first; the server keeps it append-only and sends the latest usp.catalog.log-size entries. */
import type { AdminCatalog, FieldChange } from '@usp/api-client';
import { useI18n } from '@usp/i18n';
import { Group, I, Item, Nb, Pill, Stagger } from '@usp/ui-web';

export function LogTab({ catalog }: { catalog: AdminCatalog }) {
  const { t, text, date } = useI18n();
  const domains = new Map(catalog.domains.map((d) => [d.code, d]));
  /** A code shown in words where the portal has them (status, colour, frequency, domain). */
  const value = (c: FieldChange, v: string | null) => {
    if (v === null || v === '') return '—';
    if (c.field === 'status') return t(`catalogAdmin.status.${v}`);
    if (c.field === 'tone') return t(`catalogAdmin.tone.${v}`);
    if (c.field === 'frequency') return t(`catalogAdmin.frequency.${v}`);
    if (c.field === 'domain') { const d = domains.get(v); return d ? `${text(d.name)} · ${v}` : v; }
    return v;
  };
  if (!catalog.log.length) return <Group><div className="empty"><span className="ic"><I.doc /></span><b>{t('catalogAdmin.noChanges')}</b></div></Group>;
  return (
    <Stagger>
      <Group>
        {catalog.log.map((e, i) => {
          const codes = e.changes.filter((c) => c.from !== null || c.to !== null); const texts = e.changes.filter((c) => c.from === null && c.to === null);
          return (
            <Item key={i}>
              <div className="diff-row">
                <b><Nb s={text(e.what)} /></b>
                {codes.map((c) => (
                  <span key={c.field} className="diff-vals">
                    <span className="cell-sub">{t(`catalogAdmin.field.${c.field}`)}</span>
                    <span className="before"><Nb s={value(c, c.from)} /></span><I.chev className="dirchev" /><span className="after"><Nb s={value(c, c.to)} /></span>
                  </span>
                ))}
                {texts.length ? <span className="chips">{texts.map((c) => <Pill key={c.field} icon="pen">{t(`catalogAdmin.field.${c.field}`)}</Pill>)}</span> : null}
                <span className="cell-sub">{text(e.by.name) || e.by.id} · <span className="num">{date(e.at, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></span>
              </div>
            </Item>
          );
        })}
      </Group>
    </Stagger>
  );
}
