/* Shared pieces of the catalogue administration, from the prototype's admin parts (designer basics: text per language,
   icon chips, tone swatches; policy centres: save handling). */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, TONES, getLanguages, type AdminCatalog, type Tone } from '@usp/api-client';
import { builtInLanguages, useI18n, type LocalizedText } from '@usp/i18n';
import { I, useIsland, type IconName } from '@usp/ui-web';

export const QUERY = ['admin-catalog'] as const;

/** An icon name from the catalogue, or the grid when this build does not have it. */
export const iconOf = (name: string | null | undefined): IconName => (name && name in I ? (name as IconName) : 'grid');

/** Icons offered for domains and the dock: the prototype designer's set plus the catalogue's domain icons. */
const ICON_CHOICES: IconName[] = ['leave', 'letter', 'doc', 'idcard', 'card', 'passport', 'shield', 'box', 'gear', 'wallet', 'plane', 'calendar', 'team',
  'person', 'family', 'home', 'globe', 'ribbon', 'sparkle', 'bell', 'grid', 'seal', 'book', 'building', 'star', 'hand', 'school', 'balance', 'medkit', 'heart'];

/** The administrator's enabled languages: every catalogue text is edited in each of them. */
export function useDataLanguages() {
  return useQuery({ queryKey: ['languages'], queryFn: getLanguages, staleTime: Infinity }).data ?? builtInLanguages;
}

/**
 * Saves a catalogue change. The server answers with the whole catalogue as it now stands, which replaces the cached one.
 * When someone else changed the same thing meanwhile (catalog.stale) the page reloads it and says so.
 */
export function useCatalogSave<V>(fn: (v: V) => Promise<AdminCatalog>, done: string, onDone: () => void) {
  const qc = useQueryClient(); const toast = useIsland(); const { t } = useI18n();
  return useMutation({
    mutationFn: fn,
    onSuccess: (catalog) => { qc.setQueryData(QUERY, catalog); void qc.invalidateQueries({ queryKey: ['catalog'] }); toast(t(done)); onDone(); },
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'catalog.stale') {
        void qc.invalidateQueries({ queryKey: QUERY }); toast({ title: t('catalogAdmin.stale'), icon: 'reset', tone: 'warn' }); onDone();
      }
    },
  });
}

/** The server's reason for refusing (already in every language), under the form. */
export function ErrorLine({ error }: { error: unknown }) {
  const { t, text } = useI18n();
  if (!error || (error instanceof ApiError && error.code === 'catalog.stale')) return null;
  return <p className="error" role="alert" style={{ margin: '10px 4px 0' }}>{error instanceof ApiError && error.title ? text(error.title) : t('common.saveFailed')}</p>;
}

/** One input per enabled language (ed-row labels); texts in languages no longer enabled are kept as they are. */
export function LangFields({ id, label, value, onChange, rows, max, full }: { id: string; label: string; value: LocalizedText; onChange: (v: LocalizedText) => void; rows?: number; max: number; full?: boolean }) {
  const { t } = useI18n(); const langs = useDataLanguages();
  return (
    <>
      {langs.map((l) => {
        const caption = langs.length > 1 ? t('catalogAdmin.inLanguage', { label, language: l.nativeName }) : label;
        const set = (v: string) => onChange({ ...value, [l.code]: v });
        return (
          <label key={l.code} style={full || rows ? { flexBasis: '100%' } : undefined}>
            <span>{caption}</span>
            {rows ? <textarea id={`${id}-${l.code}`} dir={l.direction} rows={rows} maxLength={max} value={value[l.code] ?? ''} onChange={(e) => set(e.target.value)} />
              : <input id={`${id}-${l.code}`} dir={l.direction} maxLength={max} value={value[l.code] ?? ''} onChange={(e) => set(e.target.value)} />}
          </label>
        );
      })}
    </>
  );
}

export function IconChips({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const choices = ICON_CHOICES.includes(value as IconName) || !(value in I) ? ICON_CHOICES : [value as IconName, ...ICON_CHOICES];
  return (
    <div className="ed-field" style={{ flexBasis: '100%' }} role="group" aria-label={label}>
      <span className="ed-field-l">{label}</span>
      <span className="chips">
        {choices.map((ic) => { const Ic = I[ic]; return <button key={ic} type="button" className={`dz-ic ${value === ic ? 'on' : ''}`} aria-pressed={value === ic} aria-label={ic} title={ic} onClick={() => onChange(ic)}><Ic /></button>; })}
      </span>
    </div>
  );
}

/** Tile colours; {@code fallback} is the colour the screen uses when none is chosen. */
export function ToneChips({ label, value, fallback, onChange }: { label: string; value: Tone | null; fallback: Tone; onChange: (v: Tone | null) => void }) {
  const { t } = useI18n();
  return (
    <div className="ed-field" style={{ flexBasis: '100%' }} role="group" aria-label={label}>
      <span className="ed-field-l">{label}</span>
      <span className="chips">
        <button type="button" className={`qicon ${fallback} dz-tone ${value === null ? 'on' : ''}`} aria-pressed={value === null} aria-label={t('catalogAdmin.tone.default')} title={t('catalogAdmin.tone.default')} onClick={() => onChange(null)}><I.reset /></button>
        {TONES.map((tn) => <button key={tn} type="button" className={`qicon ${tn} dz-tone ${value === tn ? 'on' : ''}`} aria-pressed={value === tn} aria-label={t(`catalogAdmin.tone.${tn}`)} title={t(`catalogAdmin.tone.${tn}`)} onClick={() => onChange(tn)} />)}
      </span>
    </div>
  );
}

/** Non-blank texts only (the server trims and drops blanks too). */
export const filled = (v: LocalizedText) => Object.values(v).some((x) => x.trim());
