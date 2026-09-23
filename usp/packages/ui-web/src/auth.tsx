/* Sign-in and password change, shared by the web portal and the admin portal. */
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ApiError, changePassword, login, type SessionView } from '@usp/api-client';
import { useI18n } from '@usp/i18n';
import emblem from './emblem.png';

const MIN_PASSWORD = 12;

function Brand({ title }: { title: string }) {
  const { t } = useI18n();
  return <div className="brand"><img className="brand-emblem" src={emblem} alt="" /><div><b>{title}</b><span>{t('common.org')}</span></div></div>;
}

/**
 * One form for everyone: an SAP user (checked against SAP) or a platform account (checked by the portal). The
 * password goes to the backend only. {@code title} names the portal (web or administration).
 */
export function SignIn({ title, hint, onSignedIn }: { title: string; hint: string; onSignedIn: (s: SessionView) => void }) {
  const { t, text, lang, setLang, languages } = useI18n();
  const [username, setUsername] = useState(''); const [password, setPassword] = useState('');
  const m = useMutation({ mutationFn: () => login(username, password), onSuccess: onSignedIn });
  const err = m.error instanceof ApiError ? m.error : null;
  const other = languages.find((l) => l.code !== lang);
  return (
    <main className="login">
      <form className="login-card" onSubmit={(e) => { e.preventDefault(); if (username && password) m.mutate(); }}>
        <Brand title={title} />
        <p className="lb-muted">{hint}</p>
        <label>{t('common.username')}<input autoComplete="username" autoCapitalize="none" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus /></label>
        <label>{t('common.password')}<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        {err ? <p className="error" role="alert">{text(err.title ?? { ar: 'تعذّر تسجيل الدخول', en: 'Sign-in failed' })}</p> : null}
        <button className="btn primary" disabled={m.isPending || !username || !password}>{m.isPending ? '…' : t('common.signIn')}</button>
        {other ? <button type="button" className="btn quiet" onClick={() => setLang(other.code)}>{other.nativeName}</button> : null}
      </form>
    </main>
  );
}

/** A platform account replaces its password: required after an administrator set or reset it (leaving = sign out), or by choice (leaving = cancel). */
export function ChangePassword({ title, required, onDone, onLeave }: { title: string; required: boolean; onDone: (s: SessionView) => void; onLeave: () => void }) {
  const { t, text } = useI18n();
  const [current, setCurrent] = useState(''); const [next, setNext] = useState(''); const [again, setAgain] = useState('');
  const m = useMutation({ mutationFn: () => changePassword(current, next), onSuccess: onDone });
  const mismatch = again.length > 0 && again !== next;
  const err = m.error instanceof ApiError ? text(m.error.title ?? { ar: 'تعذّر تغيير كلمة المرور', en: 'Could not change the password' }) : null;
  return (
    <main className="login">
      <form className="login-card" onSubmit={(e) => { e.preventDefault(); if (!mismatch && next.length >= MIN_PASSWORD) m.mutate(); }}>
        <Brand title={title} />
        <h1>{t('auth.newPasswordTitle')}</h1>
        <p className="lb-muted">{required ? t('auth.newPasswordRequired') : ''} {t('auth.newPasswordHint', { n: MIN_PASSWORD })}</p>
        <label>{t('auth.currentPassword')}<input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} autoFocus /></label>
        <label>{t('auth.newPassword')}<input type="password" autoComplete="new-password" minLength={MIN_PASSWORD} value={next} onChange={(e) => setNext(e.target.value)} /></label>
        <label>{t('auth.confirmPassword')}<input type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} /></label>
        {mismatch ? <p className="error" role="alert">{t('auth.mismatch')}</p> : err ? <p className="error" role="alert">{err}</p> : null}
        <button className="btn primary" disabled={m.isPending || !current || next.length < MIN_PASSWORD || next !== again}>{m.isPending ? '…' : t('common.save')}</button>
        <button type="button" className="btn quiet" onClick={onLeave}>{required ? t('common.signOut') : t('common.cancel')}</button>
      </form>
    </main>
  );
}
