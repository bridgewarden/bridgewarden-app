import { KeyRoundIcon, ShieldCheckIcon } from 'lucide-react';

import { AuthFrame } from '~/components/auth-frame';
import { t } from '~/lib/i18n/en';

import { useLoginFlow } from '../login.hooks';
import { LoginCredentialsForm } from './login-credentials-form';
import { LoginTwoFactorForm } from './login-two-factor-form';

export const LoginPanel = () => {
  const flow = useLoginFlow();
  const challenge = Boolean(flow.challengeToken);

  return (
    <AuthFrame
      title={t('login.guidance.title')}
      description={t('app.tagline')}
      points={[
        { icon: KeyRoundIcon, text: t('login.point.local') },
        { icon: ShieldCheckIcon, text: t('login.point.recovery') },
      ]}
      panel={{
        title: challenge ? t('login.twoFactorTitle') : t('login.title'),
        description: challenge ? t('login.twoFactorDescription') : t('login.description'),
      }}
    >
      {challenge ? (
        <LoginTwoFactorForm
          challenge={{
            code: flow.challengeCode,
            backupMode: flow.backupMode,
            error: flow.challengeError,
            inputRef: flow.challengeInputRef,
          }}
          busy={flow.busy}
          actions={{
            onCodeChange: flow.changeChallengeCode,
            onToggleBackupMode: flow.toggleBackupMode,
            onBack: flow.backToCredentials,
            onSubmit: flow.submitChallenge,
          }}
        />
      ) : (
        <LoginCredentialsForm
          credentials={{ email: flow.email, password: flow.password }}
          errors={{ email: flow.fieldErrors.email, password: flow.fieldErrors.password, form: flow.formError }}
          busy={flow.busy}
          actions={{
            onEmailChange: flow.changeEmail,
            onPasswordChange: flow.changePassword,
            onSubmit: flow.submitCredentials,
          }}
        />
      )}
    </AuthFrame>
  );
};
