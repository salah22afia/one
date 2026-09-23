import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useI18n } from '@usp/i18n';
import { ChangePassword, useIsland } from '@usp/ui-web';
import { adminTitle } from '../routes';

/** A platform account changes its own password. */
export default function PasswordPage() {
  const { t, text } = useI18n(); const navigate = useNavigate(); const qc = useQueryClient(); const toast = useIsland();
  return <ChangePassword title={text(adminTitle)} required={false}
    onDone={(s) => { qc.setQueryData(['session'], s); toast(t('users.saved')); navigate(-1); }} onLeave={() => navigate(-1)} />;
}
