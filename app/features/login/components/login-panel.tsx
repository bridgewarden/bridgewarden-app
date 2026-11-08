import { useLoginFlow } from '../login.hooks';
import { LoginCredentialsForm } from './login-credentials-form';
import { LoginTwoFactorForm } from './login-two-factor-form';

export const LoginPanel = () => {
  const flow = useLoginFlow();

  return flow.challengeToken ? (
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
  );
};
