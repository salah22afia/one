import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, TextInput, View } from 'react-native';
import { ApiError } from '@usp/api-client';
import { useI18n } from '@usp/i18n';
import { Button, colors } from '../../shared/ui';
import { useAuth } from './auth';

/** Sign-in with the SAP user (SU01). The password is sent to the portal backend only and never stored on the device. */
export function LoginScreen() {
  const { t, text, lang, setLang } = useI18n();
  const { signIn } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = { borderWidth: 1, borderColor: colors.hair, borderRadius: 10, padding: 12, backgroundColor: '#fff' } as const;
  const submit = async () => {
    setBusy(true); setError(null);
    try { await signIn(username.trim(), password); } catch (e) {
      setError(text(e instanceof ApiError && e.title ? e.title : { ar: 'تعذّر تسجيل الدخول', en: 'Sign-in failed' }));
    } finally { setBusy(false); }
  };
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 14, backgroundColor: colors.bg }}>
      <Text style={{ fontSize: 24, fontWeight: '800', color: colors.tint }}>{t('common.appName')}</Text>
      <Text style={{ color: colors.mute }}>{t('common.signInHint')}</Text>
      <TextInput style={input} placeholder={t('common.username')} accessibilityLabel={t('common.username')} autoCapitalize="characters" autoCorrect={false}
        textContentType="username" value={username} onChangeText={setUsername} />
      <TextInput style={input} placeholder={t('common.password')} accessibilityLabel={t('common.password')} secureTextEntry textContentType="password"
        value={password} onChangeText={setPassword} onSubmitEditing={submit} />
      {error ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text> : null}
      <Button title={busy ? '…' : t('common.signIn')} disabled={busy || !username || !password} onPress={submit} />
      <View style={{ alignItems: 'center' }}>
        <Button kind="plain" title={lang === 'ar' ? 'English' : 'العربية'} onPress={() => setLang(lang === 'ar' ? 'en' : 'ar')} />
      </View>
    </KeyboardAvoidingView>
  );
}
