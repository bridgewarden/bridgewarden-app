import { useEffect, useRef } from 'react';

import { AUTH_PANEL_HEADING_ID, AuthFrame } from '~/components/auth-frame';
import { t } from '~/lib/i18n/en';

import { useRecoveryFlow } from '../recover.hooks';
import type { RecoveryError } from '../recover.types';
import { RecoveryEmailStep } from './recovery-email-step';
import { RecoveryResetForm } from './recovery-reset-form';
import { RecoverySuccessStep } from './recovery-success-step';

const ERROR_KEYS: Record<
  RecoveryError,
  'recover.error.invalid' | 'recover.error.rateLimited' | 'recover.error.server'
> = {
  invalid: 'recover.error.invalid',
  'rate-limited': 'recover.error.rateLimited',
  'server-error': 'recover.error.server',
};

export const RecoveryFlow = () => {
  const flow = useRecoveryFlow();
  const previousStep = useRef(flow.step);

  useEffect(() => {
    if (previousStep.current === flow.step) return;
    previousStep.current = flow.step;
    document.getElementById(AUTH_PANEL_HEADING_ID)?.focus();
  }, [flow.step]);

  const formError = flow.error ? t(ERROR_KEYS[flow.error]) : null;
  const panel =
    flow.step === 'email'
      ? { title: t('recover.email.heading') }
      : flow.step === 'reset'
        ? { title: t('recover.reset.heading') }
        : { title: t('recover.success.title') };

  return (
    <AuthFrame title={t('recover.title')} description={t('recover.description')} panel={panel}>
      <div className="space-y-4">
        <p role="status" className="sr-only">
          {flow.busy ? t('recover.busy') : ''}
        </p>

        {flow.step === 'email' ? (
          <RecoveryEmailStep
            email={flow.email}
            error={formError}
            busy={flow.busy}
            onChange={flow.changeEmail}
            onSubmit={flow.submitEmail}
          />
        ) : null}

        {flow.step === 'reset' ? (
          <RecoveryResetForm
            values={{
              recoveryKey: flow.recoveryKey,
              password: flow.password,
              confirmation: flow.confirmation,
            }}
            errors={flow.fieldErrors}
            formError={formError}
            busy={flow.busy}
            actions={{
              onRecoveryKeyChange: flow.changeRecoveryKey,
              onPasswordChange: flow.changePassword,
              onConfirmationChange: flow.changeConfirmation,
              onBack: flow.backToEmail,
              onSubmit: flow.submitReset,
            }}
          />
        ) : null}

        {flow.step === 'success' ? (
          <RecoverySuccessStep recoveryKey={flow.newRecoveryKey} sessionIssued={flow.sessionIssued} />
        ) : null}
      </div>
    </AuthFrame>
  );
};
