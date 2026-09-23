/* Each person's display preferences (Me › Settings), kept by the server so the phone and the web show the same:
   language, appearance and text size, provided to every screen once signed in. */
import { useEffect, useMemo, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getPreferences, savePreferences, type Preferences } from '@usp/api-client';
import { useI18n } from '@usp/i18n';
import { DisplayContext, TEXT_SCALE } from '../../shared/theme';

const QUERY = ['me', 'preferences'] as const;
export const DEFAULT_PREFERENCES: Preferences = { language: null, theme: 'auto', textSize: 'normal' };

export function usePreferences() {
  return useQuery({ queryKey: QUERY, queryFn: getPreferences, staleTime: Infinity });
}

/** Loads the preferences once, switches the language and provides appearance and text scale. */
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { setLang } = useI18n(); const p = usePreferences().data ?? DEFAULT_PREFERENCES;
  useEffect(() => { if (p.language) setLang(p.language); }, [p.language, setLang]);
  const display = useMemo(() => ({ appearance: p.theme, scale: TEXT_SCALE[p.textSize] }), [p.theme, p.textSize]);
  return <DisplayContext.Provider value={display}>{children}</DisplayContext.Provider>;
}

/** Changes one preference: shown at once, then saved (and put back if the server refuses). */
export function useSavePreferences() {
  const qc = useQueryClient(); const { setLang, lang } = useI18n();
  return useMutation({
    mutationFn: savePreferences,
    onMutate: (next) => {
      const before = qc.getQueryData<Preferences>(QUERY);
      qc.setQueryData(QUERY, next); if (next.language) setLang(next.language);
      return { before, lang };
    },
    onSuccess: (saved) => { qc.setQueryData(QUERY, saved); },
    onError: (_e, _next, ctx) => {
      if (!ctx?.before) return;
      qc.setQueryData(QUERY, ctx.before); setLang(ctx.before.language ?? ctx.lang);
    },
  });
}
