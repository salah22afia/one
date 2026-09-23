/* Each person's display preferences (Me › Settings), kept by the server so every device shows the same, and cached on
   this device so the next visit starts in the right language and appearance before the server answers. */
import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getPreferences, savePreferences, type Preferences } from '@usp/api-client';
import { useI18n } from '@usp/i18n';

const KEY = 'usp.preferences';
const QUERY = ['me', 'preferences'] as const;
export const DEFAULT_PREFERENCES: Preferences = { language: null, theme: 'auto', textSize: 'normal' };

/** The appearance and text size on the page root (the prototype's data-theme / data-text). */
export function applyDisplay(p: Pick<Preferences, 'theme' | 'textSize'>) {
  const root = document.documentElement;
  if (p.theme === 'auto') delete root.dataset.theme; else root.dataset.theme = p.theme;
  if (p.textSize === 'normal') delete root.dataset.text; else root.dataset.text = p.textSize;
}

/** What this device last knew (may be missing, e.g. in a private window). */
export function cachedPreferences(): Preferences | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Preferences) : null;
  } catch {
    return null;
  }
}

function remember(p: Preferences) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* storage unavailable: the server still has them */ }
}

/** The signed-in person's preferences (loaded once per session). */
export function usePreferences() {
  return useQuery({ queryKey: QUERY, queryFn: getPreferences, staleTime: Infinity });
}

/** Loads the signed-in person's preferences once and applies them (in the shell). */
export function usePreferencesApplied() {
  const { setLang } = useI18n();
  const q = usePreferences();
  useEffect(() => {
    if (!q.data) return;
    applyDisplay(q.data); remember(q.data);
    if (q.data.language) setLang(q.data.language);
  }, [q.data, setLang]);
  return q.data;
}

/** Changes one preference: applied at once, then saved (and put back if the server refuses). */
export function useSavePreferences() {
  const qc = useQueryClient(); const { setLang, lang } = useI18n();
  return useMutation({
    mutationFn: savePreferences,
    onMutate: (next) => {
      const before = qc.getQueryData<Preferences>(QUERY);
      qc.setQueryData(QUERY, next); applyDisplay(next); if (next.language) setLang(next.language);
      return { before, lang };
    },
    onSuccess: (saved) => { qc.setQueryData(QUERY, saved); remember(saved); },
    onError: (_e, _next, ctx) => {
      if (!ctx?.before) return;
      qc.setQueryData(QUERY, ctx.before); applyDisplay(ctx.before); setLang(ctx.before.language ?? ctx.lang);
    },
  });
}
