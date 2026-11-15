import { Link } from 'react-router';

import { ONBOARDING_PANEL_HEADING_ID, ONBOARDING_TITLE_ID, OnboardingShell } from '~/components/onboarding-shell';
import { Button } from '~/components/ui/button';
import { useStepFocus } from '~/hooks/use-step-focus';
import { t } from '~/lib/i18n/en';

import { MEMBER_SETUP_ERROR_KEY, type MemberSetupError } from '../member-setup.constants';
import { useMemberSetup } from '../member-setup.hooks';
import { MemberSetupPasswordStep } from './member-setup-password-step';
import { MemberSetupRecoveryStep } from './member-setup-recovery-step';

type MemberSetupPanelProps = {
  invitation: { email: string; displayName: string; role: string } | null;
};

export const MemberSetupPanel = ({ invitation }: MemberSetupPanelProps) => {
  const flow = useMemberSetup(invitation?.email ?? '');
  const step = flow.material ? 'recovery' : 'password';
  useStepFocus(step, ONBOARDING_TITLE_ID, ONBOARDING_PANEL_HEADING_ID);

  const fieldError: MemberSetupError | null =
    flow.error === 'password' || flow.error === 'mismatch' || flow.error === 'recovery' ? flow.error : null;
  const formError = flow.error && !fieldError ? t(MEMBER_SETUP_ERROR_KEY[flow.error]) : null;

  if (!invitation) {
    return (
      <OnboardingShell
        title={t('memberSetup.title')}
        steps={[]}
        currentStep={null}
        panel={{ title: t('memberSetup.invalid') }}
      >
        <Button asChild className="min-h-11 w-full sm:w-auto">
          <Link to="/login">{t('common.signIn')}</Link>
        </Button>
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell
      title={t('memberSetup.title')}
      summary={
        <div className="space-y-1">
          <p className="font-medium text-foreground">{invitation.displayName}</p>
          <p className="break-all">{invitation.email}</p>
          <p className="font-mono text-[10px] tracking-[0.08em] uppercase">{invitation.role}</p>
        </div>
      }
      steps={[
        { id: 'password', label: t('memberSetup.password') },
        { id: 'recovery', label: t('memberSetup.recoveryLabel') },
      ]}
      currentStep={step}
      panel={{ title: t(step === 'password' ? 'memberSetup.password' : 'memberSetup.recoveryLabel') }}
    >
      {step === 'password' ? (
        <MemberSetupPasswordStep
          values={{ password: flow.password, confirmPassword: flow.confirmPassword }}
          error={fieldError}
          formError={formError}
          busy={flow.deriving}
          score={flow.score}
          actions={{
            onPasswordChange: flow.changePassword,
            onConfirmPasswordChange: flow.changeConfirmPassword,
            onSubmit: () => void flow.generate(),
          }}
        />
      ) : (
        <MemberSetupRecoveryStep
          values={{ recoveryKey: flow.recoveryKey, confirmation: flow.confirmation }}
          error={fieldError}
          formError={formError}
          busy={flow.busy}
          status={{ copy: flow.copyStatus, download: flow.downloadStatus }}
          actions={{
            onConfirmationChange: flow.changeConfirmation,
            onCopy: () => void flow.copyRecoveryKey(),
            onDownload: flow.downloadRecoveryKey,
            onBack: flow.backToPassword,
            onSubmit: flow.submit,
          }}
        />
      )}
    </OnboardingShell>
  );
};
