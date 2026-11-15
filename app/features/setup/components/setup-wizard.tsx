import { Link } from 'react-router';

import { ONBOARDING_PANEL_HEADING_ID, ONBOARDING_TITLE_ID, OnboardingShell } from '~/components/onboarding-shell';
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
import { useStepFocus } from '~/hooks/use-step-focus';
import { t, type MessageKey } from '~/lib/i18n/en';

import { SetupAccountStep } from './setup-account-step';
import { SetupPasswordStep } from './setup-password-step';
import { SetupRecoveryStep } from './setup-recovery-step';
import { SetupTwoFactorStep } from './setup-two-factor-step';
import { useSetupFlow } from '../setup.hooks';
import { SETUP_STEPS, type SetupFormStep } from '../setup.constants';
import type { SetupStep } from '../setup.types';

const STEP_LABELS: Record<SetupFormStep, MessageKey> = {
  account: 'setup.account.heading',
  password: 'setup.password.heading',
  recovery: 'setup.recovery.heading',
  'two-factor': 'setup.twoFactor.heading',
};

const panelFor = (step: SetupStep): { title: string; description?: string } => {
  switch (step) {
    case 'account':
      return { title: t('setup.account.heading'), description: t('setup.account.description') };
    case 'password':
      return { title: t('setup.password.heading'), description: t('setup.password.description') };
    case 'recovery':
      return { title: t('setup.recovery.heading'), description: t('setup.recovery.description') };
    case 'two-factor':
    case 'submitting':
      return { title: t('setup.twoFactor.heading'), description: t('setup.twoFactor.description') };
    case 'done':
      return { title: t('setup.done.heading'), description: t('setup.done.description') };
    case 'configured':
      return { title: t('setup.error.alreadyConfigured') };
  }
};

export const SetupWizard = () => {
  const {
    view,
    blocker,
    busy,
    errorMessage,
    fieldError,
    leave,
    account,
    password: passwordFlow,
    recovery,
    twoFactor,
  } = useSetupFlow();
  useStepFocus(view.step, ONBOARDING_TITLE_ID, ONBOARDING_PANEL_HEADING_ID);

  const currentStep = SETUP_STEPS.includes(view.step as SetupFormStep) ? (view.step as SetupFormStep) : null;
  const steps = SETUP_STEPS.map((id) => ({ id, label: t(STEP_LABELS[id]) }));

  return (
    <OnboardingShell
      title={t('setup.title')}
      description={t('setup.description')}
      steps={currentStep ? steps : []}
      currentStep={currentStep}
      panel={panelFor(view.step)}
    >
      {view.step === 'submitting' ? (
        <p role="status" className="mb-4 text-sm text-muted-foreground">
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
            onBack: recovery.backToPassword,
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
        <Button asChild className="min-h-11 w-full sm:w-auto">
          <Link to="/login">{t('common.signIn')}</Link>
        </Button>
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
    </OnboardingShell>
  );
};
