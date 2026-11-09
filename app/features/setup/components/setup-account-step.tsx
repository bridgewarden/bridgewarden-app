import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { t, type MessageKey } from '~/lib/i18n/en';

type SetupAccountStepProps = {
  account: { email: string; displayName: string };
  errors: { field: MessageKey | null; message: string | null };
  actions: {
    onEmailChange: (value: string) => void;
    onDisplayNameChange: (value: string) => void;
    onSubmit: () => void;
  };
};

export const SetupAccountStep = ({ account, errors, actions }: SetupAccountStepProps) => (
  <form
    className="space-y-4"
    onSubmit={(event) => {
      event.preventDefault();
      actions.onSubmit();
    }}
  >
    <div className="space-y-2">
      <h2 className="text-lg font-medium">{t('setup.account.heading')}</h2>
      <p className="text-sm text-muted-foreground">{t('setup.account.description')}</p>
    </div>
    <div className="space-y-2">
      <Label htmlFor="setup-email">{t('setup.account.email')}</Label>
      <Input
        id="setup-email"
        type="email"
        autoComplete="email"
        maxLength={254}
        value={account.email}
        aria-invalid={errors.field !== null}
        aria-describedby={errors.field ? 'setup-account-error' : undefined}
        onChange={(event) => actions.onEmailChange(event.target.value)}
      />
    </div>
    <div className="space-y-2">
      <Label htmlFor="setup-display-name">{t('setup.account.displayName')}</Label>
      <Input
        id="setup-display-name"
        autoComplete="name"
        maxLength={100}
        value={account.displayName}
        aria-invalid={errors.field !== null}
        aria-describedby={errors.field ? 'setup-account-error' : undefined}
        onChange={(event) => actions.onDisplayNameChange(event.target.value)}
      />
    </div>
    {errors.field ? (
      <p id="setup-account-error" role="alert" className="text-sm text-destructive">
        {t(errors.field)}
      </p>
    ) : null}
    {errors.message ? (
      <p role="alert" className="text-sm text-destructive">
        {errors.message}
      </p>
    ) : null}
    <Button type="submit" className="min-h-11">
      {t('setup.account.continue')}
    </Button>
  </form>
);
