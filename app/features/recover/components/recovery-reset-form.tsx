import { useEffect, useRef } from 'react';

import { PasswordStrengthMeter } from '~/components/password-strength-meter';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { t } from '~/lib/i18n/en';
import { MIN_MASTER_PASSWORD_LENGTH, passwordScore } from '~/lib/password-policy';

import type { RecoveryFieldErrors } from '../recover.types';

type RecoveryResetFormProps = {
  values: {
    recoveryKey: string;
    password: string;
    confirmation: string;
  };
  errors: RecoveryFieldErrors;
  formError: string | null;
  busy: boolean;
  actions: {
    onRecoveryKeyChange: (value: string) => void;
    onPasswordChange: (value: string) => void;
    onConfirmationChange: (value: string) => void;
    onBack: () => void;
    onSubmit: () => void;
  };
};

export const RecoveryResetForm = ({ values, errors, formError, busy, actions }: RecoveryResetFormProps) => {
  const recoveryKeyRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmationRef = useRef<HTMLInputElement>(null);
  const submitted = useRef(false);

  useEffect(() => {
    if (!submitted.current) return;
    submitted.current = false;
    if (errors.recoveryKey) recoveryKeyRef.current?.focus();
    else if (errors.password) passwordRef.current?.focus();
    else if (errors.confirmation) confirmationRef.current?.focus();
  }, [errors.recoveryKey, errors.password, errors.confirmation]);

  const score = passwordScore(values.password);

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (errors.recoveryKey) recoveryKeyRef.current?.focus();
        else if (errors.password) passwordRef.current?.focus();
        else if (errors.confirmation) confirmationRef.current?.focus();
        submitted.current = true;
        actions.onSubmit();
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="recover-key">{t('recover.key.label')}</Label>
        <Input
          ref={recoveryKeyRef}
          id="recover-key"
          autoComplete="off"
          spellCheck={false}
          required
          disabled={busy}
          value={values.recoveryKey}
          aria-invalid={errors.recoveryKey !== null}
          aria-describedby={errors.recoveryKey ? 'recover-key-hint recover-key-error' : 'recover-key-hint'}
          onChange={(event) => actions.onRecoveryKeyChange(event.target.value)}
        />
        <p id="recover-key-hint" className="text-sm text-muted-foreground">
          {t('recover.key.hint')}
        </p>
        {errors.recoveryKey ? (
          <p id="recover-key-error" role="alert" className="text-sm text-destructive">
            {errors.recoveryKey}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="recover-password">{t('recover.password.label')}</Label>
        <Input
          ref={passwordRef}
          id="recover-password"
          type="password"
          autoComplete="new-password"
          minLength={MIN_MASTER_PASSWORD_LENGTH}
          required
          disabled={busy}
          value={values.password}
          aria-invalid={errors.password !== null}
          aria-describedby={errors.password ? 'recover-password-error' : undefined}
          onChange={(event) => actions.onPasswordChange(event.target.value)}
        />
        {errors.password ? (
          <p id="recover-password-error" role="alert" className="text-sm text-destructive">
            {errors.password}
          </p>
        ) : null}
      </div>

      <PasswordStrengthMeter score={score} />

      <div className="space-y-2">
        <Label htmlFor="recover-confirm">{t('recover.confirm.label')}</Label>
        <Input
          ref={confirmationRef}
          id="recover-confirm"
          type="password"
          autoComplete="new-password"
          minLength={MIN_MASTER_PASSWORD_LENGTH}
          required
          disabled={busy}
          value={values.confirmation}
          aria-invalid={errors.confirmation !== null}
          aria-describedby={errors.confirmation ? 'recover-confirmation-error' : undefined}
          onChange={(event) => actions.onConfirmationChange(event.target.value)}
        />
        {errors.confirmation ? (
          <p id="recover-confirmation-error" role="alert" className="text-sm text-destructive">
            {errors.confirmation}
          </p>
        ) : null}
      </div>

      {formError ? (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row">
        <Button type="button" variant="outline" className="min-h-11 sm:flex-1" disabled={busy} onClick={actions.onBack}>
          {t('recover.back')}
        </Button>
        <Button type="submit" className="min-h-11 sm:flex-[2]" disabled={busy}>
          {busy ? t('recover.busy') : t('recover.submit')}
        </Button>
      </div>
    </form>
  );
};
