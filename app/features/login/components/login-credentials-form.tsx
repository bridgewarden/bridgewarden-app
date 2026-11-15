import { useEffect, useRef } from 'react';

import { Link } from 'react-router';

import { Alert, AlertDescription } from '~/components/ui/alert';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { t } from '~/lib/i18n/en';

import type { LoginFieldErrors } from '../login.types';

type LoginCredentialsFormProps = {
  credentials: { email: string; password: string };
  errors: LoginFieldErrors & { form: string | null };
  busy: boolean;
  actions: {
    onEmailChange: (value: string) => void;
    onPasswordChange: (value: string) => void;
    onSubmit: () => void;
  };
};

export const LoginCredentialsForm = ({ credentials, errors, busy, actions }: LoginCredentialsFormProps) => {
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const submitted = useRef(false);

  useEffect(() => {
    if (!submitted.current) return;
    submitted.current = false;
    if (errors.email) emailRef.current?.focus();
    else if (errors.password) passwordRef.current?.focus();
  }, [errors.email, errors.password]);

  return (
    <form
      className="space-y-4"
      aria-busy={busy}
      onSubmit={(event) => {
        event.preventDefault();
        if (errors.email) emailRef.current?.focus();
        else if (errors.password) passwordRef.current?.focus();
        submitted.current = true;
        actions.onSubmit();
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="login-email">{t('login.email')}</Label>
        <Input
          ref={emailRef}
          id="login-email"
          type="email"
          autoComplete="email"
          autoFocus
          maxLength={254}
          placeholder={t('login.emailPlaceholder')}
          disabled={busy}
          value={credentials.email}
          aria-invalid={errors.email !== null}
          aria-describedby={errors.email ? 'login-email-error' : undefined}
          onChange={(event) => actions.onEmailChange(event.target.value)}
        />
        {errors.email ? (
          <p id="login-email-error" role="alert" className="text-sm text-destructive">
            {errors.email}
          </p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="login-password">{t('login.password')}</Label>
        <Input
          ref={passwordRef}
          id="login-password"
          type="password"
          autoComplete="current-password"
          spellCheck={false}
          placeholder={t('login.passwordPlaceholder')}
          disabled={busy}
          value={credentials.password}
          aria-invalid={errors.password !== null}
          aria-describedby={errors.password ? 'login-password-error' : undefined}
          onChange={(event) => actions.onPasswordChange(event.target.value)}
        />
        {errors.password ? (
          <p id="login-password-error" role="alert" className="text-sm text-destructive">
            {errors.password}
          </p>
        ) : null}
      </div>
      {errors.form ? (
        <Alert variant="destructive">
          <AlertDescription>{errors.form}</AlertDescription>
        </Alert>
      ) : null}
      {busy ? (
        <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
          {t('login.signingIn')}
        </p>
      ) : null}
      <Button type="submit" className="min-h-11 w-full" disabled={busy}>
        {t('login.submit')}
      </Button>
      <div className="flex flex-wrap items-center border-t pt-4">
        <Link to="/recover" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          {t('login.recovery')}
        </Link>
      </div>
    </form>
  );
};
