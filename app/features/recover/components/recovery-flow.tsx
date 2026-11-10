import { useEffect, useRef } from 'react';
import { Link } from 'react-router';

import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { t } from '~/lib/i18n/en';
import { MIN_MASTER_PASSWORD_LENGTH } from '~/lib/password-policy';

import { useRecoveryFlow } from '../recover.hooks';
import type { RecoveryError } from '../recover.types';
import { RecoveryKeyPanel } from './recovery-key-panel';

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
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, [flow.step]);

  const error = flow.error ? ERROR_KEYS[flow.error] : null;
  const invalid = flow.error === 'invalid';

  return (
    <section aria-labelledby="recover-heading" className="mx-auto w-full max-w-md space-y-6">
      <div className="space-y-2">
        <h1 id="recover-heading" ref={headingRef} tabIndex={-1} className="text-2xl font-semibold">
          {t('recover.title')}
        </h1>
        <p className="text-muted-foreground">{t('recover.description')}</p>
        <p role="status" className="sr-only">
          {flow.busy ? t('recover.busy') : ''}
        </p>
      </div>

      {flow.step === 'email' ? (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            flow.submitEmail();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="recover-email">{t('recover.email.label')}</Label>
            <Input
              id="recover-email"
              type="email"
              autoComplete="email"
              required
              value={flow.email}
              aria-invalid={invalid}
              aria-describedby={error ? 'recover-error' : undefined}
              onChange={(event) => flow.changeEmail(event.target.value)}
            />
          </div>
          {error ? (
            <p id="recover-error" role="alert" className="text-sm text-destructive">
              {t(error)}
            </p>
          ) : null}
          <Button type="submit" className="min-h-11 w-full" disabled={flow.busy}>
            {flow.busy ? t('recover.busy') : t('recover.email.submit')}
          </Button>
        </form>
      ) : null}

      {flow.step === 'reset' ? (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void flow.submitReset();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="recover-key">{t('recover.key.label')}</Label>
            <Input
              id="recover-key"
              autoComplete="off"
              spellCheck={false}
              required
              value={flow.recoveryKey}
              aria-invalid={invalid}
              aria-describedby={error ? 'recover-key-hint recover-error' : 'recover-key-hint'}
              onChange={(event) => flow.changeRecoveryKey(event.target.value)}
            />
            <p id="recover-key-hint" className="text-sm text-muted-foreground">
              {t('recover.key.hint')}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="recover-password">{t('recover.password.label')}</Label>
            <Input
              id="recover-password"
              type="password"
              autoComplete="new-password"
              minLength={MIN_MASTER_PASSWORD_LENGTH}
              required
              value={flow.password}
              aria-invalid={invalid}
              aria-describedby={error ? 'recover-error' : undefined}
              onChange={(event) => flow.changePassword(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="recover-confirm">{t('recover.confirm.label')}</Label>
            <Input
              id="recover-confirm"
              type="password"
              autoComplete="new-password"
              minLength={MIN_MASTER_PASSWORD_LENGTH}
              required
              value={flow.confirmation}
              aria-invalid={invalid}
              aria-describedby={error ? 'recover-error' : undefined}
              onChange={(event) => flow.changeConfirmation(event.target.value)}
            />
          </div>

          {error ? (
            <p id="recover-error" role="alert" className="text-sm text-destructive">
              {t(error)}
            </p>
          ) : null}

          <Button type="submit" className="min-h-11 w-full" disabled={flow.busy}>
            {flow.busy ? t('recover.busy') : t('recover.submit')}
          </Button>
        </form>
      ) : null}

      {flow.step === 'success' ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <h2 className="text-lg font-medium">{t('recover.success.title')}</h2>
            <p className="text-sm text-muted-foreground">
              {t(flow.sessionIssued ? 'recover.success.description' : 'recover.success.signInDescription')}
            </p>
          </div>
          <RecoveryKeyPanel recoveryKey={flow.newRecoveryKey} />
          <p role="alert" className="text-sm text-destructive">
            {t('recover.success.warning')}
          </p>
          <Button asChild className="min-h-11 w-full">
            <Link to={flow.sessionIssued ? '/app' : '/login'}>
              {t(flow.sessionIssued ? 'recover.success.continue' : 'recover.success.signIn')}
            </Link>
          </Button>
        </div>
      ) : null}
    </section>
  );
};
