import type React from 'react';
import { I18nManager, Platform } from 'react-native';
import { Stack } from 'expo-router';
import Constants from 'expo-constants';
import { useFonts, Cairo_400Regular, Cairo_600SemiBold, Cairo_700Bold, Cairo_800ExtraBold } from '@expo-google-fonts/cairo';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { ApiError, getLanguages, setApiBase } from '@usp/api-client';
import { I18nProvider } from '@usp/i18n';
import { AuthProvider, useAuth } from '../src/platform/auth/auth';
import { LoginScreen } from '../src/platform/auth/LoginScreen';
import { IslandProvider } from '../src/shared/kit';
import { PreferencesProvider } from '../src/platform/me/preferences';

setApiBase((Constants.expoConfig?.extra?.apiUrl as string | undefined) ?? 'http://localhost:8080');
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: (n, e) => !(e instanceof ApiError && e.status < 500) && n < 2 } } });
// Native: direction changes need an app reload (I18nManager). Web (react-native-web) reads it from the document.
const applyDir = (lang: string, dir: 'rtl' | 'ltr') => {
  if (Platform.OS === 'web') { document.documentElement.lang = lang; document.documentElement.dir = dir; }
  else I18nManager.forceRTL(dir === 'rtl');
};

/** Nothing but the sign-in screen until there is a portal session. */
function Gate() {
  const { state } = useAuth();
  if (state.status === 'loading') return null;
  if (state.status === 'signedOut') return <LoginScreen />;
  return (
    <PreferencesProvider>
      <IslandProvider>
        {/* Screens draw the prototype's own page chrome (back · emblem · action, large title). */}
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="request/[id]" />
          <Stack.Screen name="resubmit/[id]" />
          <Stack.Screen name="service/[id]" />
          <Stack.Screen name="domain/[code]" />
          <Stack.Screen name="settings" />
        </Stack>
      </IslandProvider>
    </PreferencesProvider>
  );
}

/** The administrator's languages (settings in PostgreSQL); the built-in list until they arrive. */
function WithLanguages({ children }: { children: React.ReactNode }) {
  const languages = useQuery({ queryKey: ['languages'], queryFn: getLanguages, staleTime: Infinity });
  return <I18nProvider languages={languages.data} onChange={applyDir}>{children}</I18nProvider>;
}

export default function RootLayout() {
  // Cairo, as the prototype; nothing is drawn until it is ready so no screen flashes in a fallback font.
  const [fonts] = useFonts({ Cairo_400Regular, Cairo_600SemiBold, Cairo_700Bold, Cairo_800ExtraBold });
  if (!fonts) return null;
  return (
    <QueryClientProvider client={queryClient}>
      <WithLanguages>
        <AuthProvider><Gate /></AuthProvider>
      </WithLanguages>
    </QueryClientProvider>
  );
}
