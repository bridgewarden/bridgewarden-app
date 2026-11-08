import { Link } from 'react-router';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog';
import { Button } from '~/components/ui/button';
import { t } from '~/lib/i18n/en';

import { SetupAccountStep } from './setup-account-step';
import { SetupPasswordStep } from './setup-password-step';
import { SetupRecoveryStep } from './setup-recovery-step';
import { SetupTwoFactorStep } from './setup-two-factor-step';
import { SETUP_STEPS } from '../setup.types';
import { useSetupFlow } from '../setup.hooks';

export const SetupWizard = () => {
  const {
    state,
    blocker,
    headingRef,
    password,
    confirmPassword,
    confirmation,
    fieldError,
    copyStatus,
    downloadStatus,
    deriving,
    currentStep,
    busy,
    errorMessage,
    score,
    changeEmail,
    changeDisplayName,
    changePassword,
    changeConfirmPassword,
    changeConfirmation,
    submitAccount,
    submitPassword,
    submitRecovery,
    copyRecoveryKey,
    downloadRecoveryKey,
    continueTwoFactor,
    retry,
    leave,
    dispatch,
  } = useSetupFlow();

  return (
    <section className="mx-auto w-full max-w-xl space-y-6" aria-labelledby="setup-heading">
      <div className="space-y-2">
        <h1 id="setup-heading" ref={headingRef} tabIndex={-1} className="text-2xl font-semibold">
          {t('setup.title')}
        </h1>
        <p className="text-muted-foreground">{t('setup.description')}</p>
        {currentStep !== null ? (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {t('setup.step', { current: currentStep, total: SETUP_STEPS.length })}
          </p>
        ) : null}
      </div>

      {state.step === 'submitting' ? (
        <p role="status" className="text-sm text-muted-foreground">
          {t('setup.submitting')}
        </p>
      ) : null}

      {state.step === 'account' ? (
        <SetupAccountStep
          account={{ email: state.email, displayName: state.displayName }}
          errors={{ field: fieldError, message: state.error === 'invalid-input' ? errorMessage : null }}
          actions={{
            onEmailChange: changeEmail,
            onDisplayNameChange: changeDisplayName,
            onSubmit: submitAccount,
          }}
        />
      ) : null}

      {state.step === 'password' ? (
        <SetupPasswordStep
          values={{ password, confirmPassword }}
          fieldError={fieldError}
          deriving={deriving}
          score={score}
          actions={{
            onPasswordChange: changePassword,
            onConfirmPasswordChange: changeConfirmPassword,
            onBack: () => {
              dispatch({ type: 'back-to-account' });
              changePassword('');
              changeConfirmPassword('');
            },
            onSubmit: submitPassword,
          }}
        />
      ) : null}

      {state.step === 'recovery' && state.keys ? (
        <SetupRecoveryStep
          recovery={{ key: state.recoveryKey, confirmation }}
          fieldError={fieldError}
          status={{ copy: copyStatus, download: downloadStatus }}
          actions={{
            onConfirmationChange: changeConfirmation,
            onCopy: copyRecoveryKey,
            onDownload: downloadRecoveryKey,
            onSubmit: submitRecovery,
          }}
        />
      ) : null}

      {state.step === 'two-factor' || state.step === 'submitting' ? (
        <SetupTwoFactorStep
          errorMessage={errorMessage}
          canRetry={Boolean(state.error && state.keys)}
          busy={busy}
          onRetry={retry}
          onContinue={continueTwoFactor}
        />
      ) : null}

      {state.step === 'configured' ? (
        <div className="space-y-4">
          <p role="alert" className="text-sm text-destructive">
            {t('setup.error.alreadyConfigured')}
          </p>
          <Button asChild className="min-h-11">
            <Link to="/login">{t('common.signIn')}</Link>
          </Button>
        </div>
      ) : null}

      {state.step === 'done' ? (
        <div className="space-y-2">
          <h2 className="text-lg font-medium">{t('setup.done.heading')}</h2>
          <p className="text-muted-foreground">{t('setup.done.description')}</p>
        </div>
      ) : null}

      <AlertDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => {
          if (!open && blocker.state === 'blocked') blocker.reset();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('setup.leave.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('setup.leave.description')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('setup.leave.stay')}</AlertDialogCancel>
            <AlertDialogAction onClick={leave}>{t('setup.leave.leave')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
};
