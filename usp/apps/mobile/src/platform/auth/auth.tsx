import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useQueryClient } from '@tanstack/react-query';
import { getSession, login as apiLogin, logout as apiLogout, setAuthToken, setOnUnauthorized, type SessionView } from '@usp/api-client';
import { useI18n } from '@usp/i18n';

const KEY = 'usp.session';
// The token lives in the device keychain/keystore (web preview: memory only). The password is never stored on the device.
const store = {
  get: () => (Platform.OS === 'web' ? Promise.resolve(null) : SecureStore.getItemAsync(KEY)),
  set: (v: string) => (Platform.OS === 'web' ? Promise.resolve() : SecureStore.setItemAsync(KEY, v)),
  clear: () => (Platform.OS === 'web' ? Promise.resolve() : SecureStore.deleteItemAsync(KEY)),
};

type State = { status: 'loading' } | { status: 'signedOut' } | { status: 'signedIn'; session: SessionView };
interface Auth { state: State; signIn: (u: string, p: string) => Promise<void>; signOut: () => Promise<void> }
const Ctx = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [state, setState] = useState<State>({ status: 'loading' });
  const drop = useCallback(async () => { setAuthToken(null); await store.clear(); qc.clear(); setState({ status: 'signedOut' }); }, [qc]);

  useEffect(() => {
    setOnUnauthorized(() => { void drop(); });
    (async () => {
      const token = await store.get();
      if (!token) return setState({ status: 'signedOut' });
      setAuthToken(token);
      try { setState({ status: 'signedIn', session: await getSession() }); } catch { await drop(); }
    })();
    return () => setOnUnauthorized(null);
  }, [drop]);

  const value = useMemo<Auth>(() => ({
    state,
    signIn: async (u, p) => {
      const s = await apiLogin(u, p);
      setAuthToken(s.token);
      if (s.token) await store.set(s.token);
      setState({ status: 'signedIn', session: s });
    },
    signOut: async () => { try { await apiLogout(); } finally { await drop(); } },
  }), [state, drop]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): Auth {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}

/** The signed-in person's display name (avatar on tab roots). */
export function useMeName() {
  const { state } = useAuth(); const { text } = useI18n();
  return state.status === 'signedIn' ? text(state.session.name) || state.session.username : undefined;
}
