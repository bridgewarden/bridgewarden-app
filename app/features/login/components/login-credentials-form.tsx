import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { t } from '~/lib/i18n/en';

type LoginCredentialsFormProps = {
  credentials: { email: string; password: string };
  errors: { field: string | null; form: string | null };
  busy: boolean;
  actions: {
    onEmailChange: (value: string) => void;
    onPasswordChange: (value: string) => void;
    onSubmit: () => void;
  };
};

export const LoginCredentialsForm = ({ credentials, errors, busy, actions }: LoginCredentialsFormProps) => (
  <form
    className="space-y-4"
    aria-busy={busy}
    onSubmit={(event) => {
      event.preventDefault();
      actions.onSubmit();
    }}
  >
    <div className="space-y-2">
      <Label htmlFor="login-email">{t('login.email')}</Label>
      <Input
        id="login-email"
        type="email"
        autoComplete="email"
        maxLength={254}
        placeholder={t('login.emailPlaceholder')}
        value={credentials.email}
        aria-invalid={errors.field !== null}
        aria-describedby={errors.field ? 'login-field-error' : undefined}
        onChange={(event) => actions.onEmailChange(event.target.value)}
      />
    </div>
    <div className="space-y-2">
      <Label htmlFor="login-password">{t('login.password')}</Label>
      <Input
        id="login-password"
        type="password"
        autoComplete="current-password"
        spellCheck={false}
        placeholder={t('login.passwordPlaceholder')}
        value={credentials.password}
        aria-invalid={errors.field !== null}
        aria-describedby={errors.field ? 'login-field-error' : undefined}
        onChange={(event) => actions.onPasswordChange(event.target.value)}
      />
    </div>
    {errors.field ? (
      <p id="login-field-error" role="alert" className="text-sm text-destructive">
        {errors.field}
      </p>
    ) : null}
    {errors.form ? (
      <p id="login-form-error" role="alert" className="text-sm text-destructive">
        {errors.form}
      </p>
    ) : null}
    {busy ? (
      <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
        {t('login.signingIn')}
      </p>
    ) : null}
    <Button type="submit" className="min-h-11" disabled={busy}>
      {t('login.submit')}
    </Button>
  </form>
);
