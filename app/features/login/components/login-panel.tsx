import { t } from '~/lib/i18n/en';

import { useLoginFlow } from '../login.hooks';
import { LoginCredentialsForm } from './login-credentials-form';
import { LoginTwoFactorForm } from './login-two-factor-form';

export const LoginPanel = () => {
  const flow = useLoginFlow();

  return (
    <section className="mx-auto w-full max-w-md space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">{t('login.title')}</h1>
        <p className="text-muted-foreground">{t('login.description')}</p>
      </div>

      {flow.challengeToken ? (
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
          errors={{ field: flow.fieldError, form: flow.formError }}
          busy={flow.busy}
          actions={{
            onEmailChange: flow.changeEmail,
            onPasswordChange: flow.changePassword,
            onSubmit: flow.submitCredentials,
          }}
        />
      )}
    </section>
  );
};
