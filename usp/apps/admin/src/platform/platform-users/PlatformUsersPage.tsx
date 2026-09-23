import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, createPlatformUser, getSession, listPlatformUsers, resetPlatformUserPassword, updatePlatformUser, type PlatformUser } from '@usp/api-client';
import { useI18n } from '@usp/i18n';
import { Avatar, BottomSheet, Empty, I, PageChrome, Pill, useIsland } from '@usp/ui-web';

const MIN_PASSWORD = 12;

/** Platform accounts: people who sign in without an SAP user (not employees). Administrators create and manage them. */
export default function PlatformUsersPage() {
  const { t, text, date } = useI18n();
  const users = useQuery({ queryKey: ['platform-users'], queryFn: listPlatformUsers });
  const session = useQuery({ queryKey: ['session'], queryFn: getSession });
  const [editing, setEditing] = useState<PlatformUser | null>(null); const [creating, setCreating] = useState(false);
  const newButton = <button type="button" className="btn primary sm" onClick={() => setCreating(true)}><I.plus />{t('users.new')}</button>;
  return (
    <PageChrome title={t('users.title')} sub={t('users.sub')} end={newButton}>
      {users.isError ? <p className="error">{text((users.error as ApiError).title ?? { ar: 'تعذّر التحميل', en: 'Could not load' })}</p> : null}
      {users.data && !users.data.length ? <Empty icon="person" title={t('users.title')} /> : null}
      {users.data?.length ? (
        <div className="lrow-list">
          {users.data.map((u) => {
            const you = session.data?.personId === `u:${u.username}`;
            return (
              <button key={u.id} type="button" className={`lrow ${u.enabled ? '' : 'dim'}`} onClick={() => setEditing(u)}>
                <Avatar name={text(u.name) || u.username} />
                <span className="lrow-txt">
                  <b>{text(u.name) || u.username}{you ? ` · ${t('users.you')}` : ''}</b>
                  <span><bdi className="num">{u.username}</bdi>{u.email ? ` · ${u.email}` : ''} · {u.lastLoginAt ? `${t('users.lastLogin')} ${date(u.lastLoginAt)}` : t('users.never')}</span>
                </span>
                <span className="lrow-trail">
                  {u.admin ? <Pill tone="gold" icon="shield">{t('users.admin')}</Pill> : null}
                  {!u.enabled ? <Pill tone="danger">{t('users.disabled')}</Pill> : u.mustChangePassword ? <Pill tone="warn">{t('users.mustChange')}</Pill> : null}
                  <I.chev className="dirchev" />
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
      <CreateSheet open={creating} onClose={() => setCreating(false)} />
      <EditSheet user={editing} onClose={() => setEditing(null)} />
    </PageChrome>
  );
}

function useSave<T>(fn: (v: T) => Promise<unknown>, done: string, onDone: () => void) {
  const qc = useQueryClient(); const toast = useIsland(); const { t } = useI18n();
  return useMutation({ mutationFn: fn, onSuccess: () => { void qc.invalidateQueries({ queryKey: ['platform-users'] }); toast(t(done)); onDone(); } });
}

function ErrorLine({ error }: { error: unknown }) {
  const { text } = useI18n();
  return error instanceof ApiError ? <p className="error" role="alert" style={{ margin: '10px 4px' }}>{text(error.title ?? { ar: 'تعذّر الحفظ', en: 'Could not save' })}</p> : null;
}

function Switch({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return <label className="lb-switch-row in"><span><b>{label}</b></span><input type="checkbox" className="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} /></label>;
}

function CreateSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const [f, setF] = useState({ username: '', ar: '', en: '', email: '', admin: false, temporaryPassword: '' });
  const close = () => { setF({ username: '', ar: '', en: '', email: '', admin: false, temporaryPassword: '' }); m.reset(); onClose(); };
  const m = useSave(() => createPlatformUser({ username: f.username, name: { ar: f.ar, en: f.en }, email: f.email || undefined, admin: f.admin, temporaryPassword: f.temporaryPassword }), 'users.created', close);
  const ok = f.username.trim().length >= 3 && (f.ar.trim() || f.en.trim()) && f.temporaryPassword.length >= MIN_PASSWORD;
  const input = (key: keyof typeof f, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="field"><label htmlFor={`pu-${key}`}>{label}</label><input id={`pu-${key}`} value={String(f[key])} onChange={(e) => setF({ ...f, [key]: e.target.value })} {...props} /></div>
  );
  return (
    <BottomSheet open={open} onClose={close} title={t('users.new')}>
      <form onSubmit={(e) => { e.preventDefault(); if (ok) m.mutate(undefined); }}>
        <div className="group">
          {input('username', t('users.username'), { autoCapitalize: 'none', autoComplete: 'off', dir: 'ltr' })}
          {input('ar', t('users.nameAr'), { dir: 'rtl' })}
          {input('en', t('users.nameEn'), { dir: 'ltr' })}
          {input('email', t('users.email'), { type: 'email', dir: 'ltr' })}
          <div className="field"><label htmlFor="pu-temporaryPassword">{t('users.temporaryPassword')}</label>
            <input id="pu-temporaryPassword" type="password" autoComplete="new-password" value={f.temporaryPassword} onChange={(e) => setF({ ...f, temporaryPassword: e.target.value })} />
            <span className="hint">{t('users.temporaryHint', { n: MIN_PASSWORD })}</span></div>
          <Switch label={t('users.admin')} checked={f.admin} onChange={(v) => setF({ ...f, admin: v })} />
        </div>
        <ErrorLine error={m.error} />
        <button className="btn primary block" style={{ marginTop: 14 }} disabled={!ok || m.isPending}>{m.isPending ? '…' : t('users.new')}</button>
      </form>
    </BottomSheet>
  );
}

function EditSheet({ user, onClose }: { user: PlatformUser | null; onClose: () => void }) {
  const { text } = useI18n();
  return (
    <BottomSheet open={!!user} onClose={onClose} title={user ? text(user.name) || user.username : ''}>
      {user ? <EditForm key={user.id} user={user} onClose={onClose} /> : null}
    </BottomSheet>
  );
}

function EditForm({ user, onClose }: { user: PlatformUser; onClose: () => void }) {
  const { t } = useI18n();
  const [f, setF] = useState({ ar: user.name.ar ?? '', en: user.name.en ?? '', email: user.email ?? '', admin: user.admin, enabled: user.enabled });
  const [temp, setTemp] = useState('');
  const save = useSave(() => updatePlatformUser(user.id, { name: { ar: f.ar, en: f.en }, email: f.email || null, admin: f.admin, enabled: f.enabled }), 'users.saved', onClose);
  const reset = useSave(() => resetPlatformUserPassword(user.id, temp), 'users.resetDone', onClose);
  return (
    <>
      <p className="lb-muted"><bdi className="num">{user.username}</bdi></p>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(undefined); }}>
        <div className="group">
          <div className="field"><label htmlFor="pe-ar">{t('users.nameAr')}</label><input id="pe-ar" dir="rtl" value={f.ar} onChange={(e) => setF({ ...f, ar: e.target.value })} /></div>
          <div className="field"><label htmlFor="pe-en">{t('users.nameEn')}</label><input id="pe-en" dir="ltr" value={f.en} onChange={(e) => setF({ ...f, en: e.target.value })} /></div>
          <div className="field"><label htmlFor="pe-email">{t('users.email')}</label><input id="pe-email" type="email" dir="ltr" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
          <Switch label={t('users.admin')} checked={f.admin} onChange={(v) => setF({ ...f, admin: v })} />
          <Switch label={t('users.enabled')} checked={f.enabled} onChange={(v) => setF({ ...f, enabled: v })} />
        </div>
        <ErrorLine error={save.error} />
        <button className="btn primary block" style={{ marginTop: 14 }} disabled={save.isPending || !(f.ar.trim() || f.en.trim())}>{save.isPending ? '…' : t('common.save')}</button>
      </form>
      <form onSubmit={(e) => { e.preventDefault(); if (temp.length >= MIN_PASSWORD) reset.mutate(undefined); }} style={{ marginTop: 22 }}>
        <div className="group">
          <div className="field"><label htmlFor="pe-temp">{t('users.resetPassword')}</label>
            <input id="pe-temp" type="password" autoComplete="new-password" value={temp} onChange={(e) => setTemp(e.target.value)} placeholder={t('users.temporaryPassword')} />
            <span className="hint">{t('users.temporaryHint', { n: MIN_PASSWORD })}</span></div>
        </div>
        <ErrorLine error={reset.error} />
        <button className="btn secondary block" style={{ marginTop: 12 }} disabled={temp.length < MIN_PASSWORD || reset.isPending}>{t('users.resetPassword')}</button>
      </form>
    </>
  );
}
