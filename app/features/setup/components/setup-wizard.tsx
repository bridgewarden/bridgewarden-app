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
import { SETUP_STEPS } from '../setup.constants';
import { useSetupFlow } from '../setup.hooks';

export const SetupWizard = () => {
  const {
    view,
    blocker,
    headingRef,
    currentStep,
    busy,
    errorMessage,
    fieldError,
    leave,
    account,
    password: passwordFlow,
    recovery,
    twoFactor,
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

      {view.step === 'submitting' ? (
        <p role="status" className="text-sm text-muted-foreground">
          {t('setup.submitting')}
        </p>
      ) : null}

      {view.step === 'account' ? (
        <SetupAccountStep
          account={{ email: view.email, displayName: view.displayName }}
          errors={{ field: fieldError, message: view.error === 'invalid-input' ? errorMessage : null }}
          actions={{
            onEmailChange: account.changeEmail,
            onDisplayNameChange: account.changeDisplayName,
            onSubmit: account.submitAccount,
          }}
        />
      ) : null}

      {view.step === 'password' ? (
        <SetupPasswordStep
          values={{ password: passwordFlow.password, confirmPassword: passwordFlow.confirmPassword }}
          fieldError={fieldError}
          deriving={passwordFlow.deriving}
          score={passwordFlow.score}
          actions={{
            onPasswordChange: passwordFlow.changePassword,
            onConfirmPasswordChange: passwordFlow.changeConfirmPassword,
            onBack: passwordFlow.backToAccount,
            onSubmit: passwordFlow.submitPassword,
          }}
        />
      ) : null}

      {view.step === 'recovery' && view.keys ? (
        <SetupRecoveryStep
          recovery={{ key: view.recoveryKey, confirmation: recovery.confirmation }}
          fieldError={fieldError}
          status={{ copy: recovery.copyStatus, download: recovery.downloadStatus }}
          actions={{
            onConfirmationChange: recovery.changeConfirmation,
            onCopy: recovery.copyRecoveryKey,
            onDownload: recovery.downloadRecoveryKey,
            onSubmit: recovery.submitRecovery,
          }}
        />
      ) : null}

      {view.step === 'two-factor' || view.step === 'submitting' ? (
        <SetupTwoFactorStep
          errorMessage={errorMessage}
          canRetry={twoFactor.canRetry}
          busy={busy}
          onRetry={twoFactor.retry}
          onContinue={twoFactor.continueTwoFactor}
        />
      ) : null}

      {view.step === 'configured' ? (
        <div className="space-y-4">
          <p role="alert" className="text-sm text-destructive">
            {t('setup.error.alreadyConfigured')}
          </p>
          <Button asChild className="min-h-11">
            <Link to="/login">{t('common.signIn')}</Link>
          </Button>
        </div>
      ) : null}

      {view.step === 'done' ? (
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
