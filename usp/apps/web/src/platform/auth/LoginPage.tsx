import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useI18n } from '@usp/i18n';
import { SignIn } from '@usp/ui-web';

/** Sign-in: SAP user (SU01) or platform account. The password goes to the backend only. */
export default function LoginPage() {
  const { t } = useI18n(); const navigate = useNavigate(); const qc = useQueryClient();
  return <SignIn title={t('common.appName')} hint={t('auth.portalHint')} onSignedIn={(s) => { qc.setQueryData(['session'], { ...s, token: null }); navigate('/', { replace: true }); }} />;
}
