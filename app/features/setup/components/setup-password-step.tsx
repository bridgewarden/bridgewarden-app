import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { t, type MessageKey } from '~/lib/i18n/en';

import { STRENGTH_KEYS, STRENGTH_WIDTH } from '../setup.constants';

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
      <h2 className="text-lg font-medium">{t('setup.password.heading')}</h2>
      <p className="text-sm text-muted-foreground">{t('setup.password.description')}</p>
    </div>
    <div className="space-y-2">
      <Label htmlFor="setup-password">{t('setup.password.label')}</Label>
      <Input
        id="setup-password"
        type="password"
        autoComplete="new-password"
        spellCheck={false}
        value={values.password}
        aria-invalid={fieldError === 'setup.password.hint'}
        aria-describedby={fieldError ? 'setup-password-hint setup-password-error' : 'setup-password-hint'}
        onChange={(event) => actions.onPasswordChange(event.target.value)}
      />
      <p id="setup-password-hint" className="text-sm text-muted-foreground">
        {t('setup.password.hint')}
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
        aria-invalid={fieldError === 'setup.password.mismatch'}
        aria-describedby={fieldError ? 'setup-password-error' : undefined}
        onChange={(event) => actions.onConfirmPasswordChange(event.target.value)}
      />
    </div>
    <div className="space-y-1">
      <div
        role="progressbar"
        aria-label={t('setup.password.strength')}
        aria-valuemin={0}
        aria-valuemax={4}
        aria-valuenow={score}
        aria-valuetext={t(STRENGTH_KEYS[score])}
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        <div className={`h-full bg-primary transition-all ${STRENGTH_WIDTH[score]}`} />
      </div>
      <p className="text-sm text-muted-foreground">{t(STRENGTH_KEYS[score])}</p>
    </div>
    {fieldError ? (
      <p id="setup-password-error" role="alert" className="text-sm text-destructive">
        {t(fieldError)}
      </p>
    ) : null}
    <div className="flex gap-2">
      <Button type="button" variant="outline" className="min-h-11" disabled={deriving} onClick={actions.onBack}>
        {t('setup.back')}
      </Button>
      <Button type="submit" className="min-h-11" disabled={deriving}>
        {deriving ? t('setup.password.generating') : t('setup.password.continue')}
      </Button>
    </div>
  </form>
);
