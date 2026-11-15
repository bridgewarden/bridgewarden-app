import { PasswordStrengthMeter } from '~/components/password-strength-meter';
import { InlineError } from '~/components/inline-error';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { t } from '~/lib/i18n/en';

import { MEMBER_SETUP_ERROR_KEY, type MemberSetupError } from '../member-setup.constants';

type MemberSetupPasswordStepProps = {
  values: { password: string; confirmPassword: string };
  error: MemberSetupError | null;
  formError: string | null;
  busy: boolean;
  score: number;
  actions: {
    onPasswordChange: (value: string) => void;
    onConfirmPasswordChange: (value: string) => void;
    onSubmit: () => void;
  };
};

export const MemberSetupPasswordStep = ({
  values,
  error,
  formError,
  busy,
  score,
  actions,
}: MemberSetupPasswordStepProps) => (
  <form
    className="space-y-4"
    onSubmit={(event) => {
      event.preventDefault();
      actions.onSubmit();
    }}
  >
    <div className="space-y-2">
      <Label htmlFor="member-password">{t('memberSetup.password')}</Label>
      <Input
        id="member-password"
        type="password"
        autoComplete="new-password"
        disabled={busy}
        value={values.password}
        aria-invalid={error === 'password'}
        aria-describedby={error === 'password' ? 'member-password-error' : undefined}
        onChange={(event) => actions.onPasswordChange(event.target.value)}
      />
      {error === 'password' ? (
        <p id="member-password-error" role="alert" className="text-sm text-destructive">
          {t(MEMBER_SETUP_ERROR_KEY.password)}
        </p>
      ) : null}
    </div>
    <div className="space-y-2">
      <Label htmlFor="member-password-confirm">{t('memberSetup.confirmPassword')}</Label>
      <Input
        id="member-password-confirm"
        type="password"
        autoComplete="new-password"
        disabled={busy}
        value={values.confirmPassword}
        aria-invalid={error === 'mismatch'}
        aria-describedby={error === 'mismatch' ? 'member-confirm-error' : undefined}
        onChange={(event) => actions.onConfirmPasswordChange(event.target.value)}
      />
      {error === 'mismatch' ? (
        <p id="member-confirm-error" role="alert" className="text-sm text-destructive">
          {t(MEMBER_SETUP_ERROR_KEY.mismatch)}
        </p>
      ) : null}
    </div>
    <PasswordStrengthMeter score={score} />
    {formError ? <InlineError message={formError} /> : null}
    <Button type="submit" className="min-h-11 w-full" disabled={busy}>
      {busy ? t('memberSetup.generating') : t('memberSetup.generate')}
    </Button>
  </form>
);
