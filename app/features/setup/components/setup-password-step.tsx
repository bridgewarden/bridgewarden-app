import { PasswordStrengthMeter } from '~/components/password-strength-meter';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { t, type MessageKey } from '~/lib/i18n/en';

type SetupPasswordStepProps = {
  values: { password: string; confirmPassword: string };
  fieldError: MessageKey | null;
  deriving: boolean;
  score: number;
  actions: {
    onPasswordChange: (value: string) => void;
    onConfirmPasswordChange: (value: string) => void;
    onBack: () => void;
    onSubmit: () => void;
  };
};

export const SetupPasswordStep = ({ values, fieldError, deriving, score, actions }: SetupPasswordStepProps) => (
  <form
    className="space-y-4"
    onSubmit={(event) => {
      event.preventDefault();
      actions.onSubmit();
    }}
  >
    <div className="space-y-2">
      <Label htmlFor="setup-password">{t('setup.password.label')}</Label>
      <Input
        id="setup-password"
        type="password"
        autoComplete="new-password"
        spellCheck={false}
        value={values.password}
        aria-invalid={fieldError === 'password.hint'}
        aria-describedby={fieldError ? 'setup-password-hint setup-password-error' : 'setup-password-hint'}
        onChange={(event) => actions.onPasswordChange(event.target.value)}
      />
      <p id="setup-password-hint" className="text-sm text-muted-foreground">
        {t('password.hint')}
      </p>
    </div>
    <div className="space-y-2">
      <Label htmlFor="setup-password-confirm">{t('setup.password.confirmLabel')}</Label>
      <Input
        id="setup-password-confirm"
        type="password"
        autoComplete="new-password"
        spellCheck={false}
        value={values.confirmPassword}
        aria-invalid={fieldError === 'password.mismatch'}
        aria-describedby={fieldError ? 'setup-password-error' : undefined}
        onChange={(event) => actions.onConfirmPasswordChange(event.target.value)}
      />
    </div>
    <PasswordStrengthMeter score={score} />
    {fieldError ? (
      <p id="setup-password-error" role="alert" className="text-sm text-destructive">
        {t(fieldError)}
      </p>
    ) : null}
    <div className="flex flex-col-reverse gap-2 sm:flex-row">
      <Button
        type="button"
        variant="outline"
        className="min-h-11 w-full sm:w-auto"
        disabled={deriving}
        onClick={actions.onBack}
      >
        {t('setup.back')}
      </Button>
      <Button type="submit" className="min-h-11 w-full sm:flex-1" disabled={deriving}>
        {deriving ? t('setup.password.generating') : t('setup.password.continue')}
      </Button>
    </div>
  </form>
);
