import { useEffect, useRef, useState } from 'react';

import { LockIcon } from 'lucide-react';

import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { t } from '~/lib/i18n/en';
import type { UnlockResult } from '~/lib/vault/types';

type LockError = Exclude<UnlockResult['status'], 'ok'>;

type LockedOverlayProps = {
  signingOut: boolean;
  onUnlock: (password: string) => Promise<UnlockResult>;
  onSignOut: () => void;
};

export const LockedOverlay = ({ signingOut, onUnlock, onSignOut }: LockedOverlayProps) => {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<LockError | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = async () => {
    if (!password || busy) return;
    setBusy(true);
    setError(null);

    try {
      const result = await onUnlock(password);
      setPassword('');
      if (result.status === 'locked-out') {
        setError('locked-out');
        onSignOut();
      } else if (result.status !== 'ok') {
        setError(result.status);
        inputRef.current?.focus();
      }
    } catch {
      setError('unavailable');
      inputRef.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 p-4 backdrop-blur">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="locked-title"
        className="w-full max-w-md space-y-5 rounded-lg border bg-background p-6 shadow-lg"
      >
        <div className="space-y-2">
          <LockIcon className="size-8" aria-hidden="true" />
          <h1 id="locked-title" className="text-2xl font-semibold">
            {t('lock.title')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('lock.description')}</p>
        </div>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="unlock-password">{t('lock.password')}</Label>
            <Input
              id="unlock-password"
              ref={inputRef}
              type="password"
              autoComplete="current-password"
              spellCheck={false}
              maxLength={1024}
              value={password}
              aria-invalid={error !== null}
              aria-describedby={error ? 'unlock-error' : undefined}
              readOnly={busy || signingOut}
              disabled={error === 'unavailable'}
              onChange={(event) => {
                setPassword(event.target.value);
                setError(null);
              }}
            />
          </div>

          {error ? (
            <p id="unlock-error" role="alert" className="text-sm text-destructive">
              {t(
                error === 'invalid'
                  ? 'lock.invalid'
                  : error === 'locked-out'
                    ? 'lock.tooManyAttempts'
                    : 'lock.unavailable',
              )}
            </p>
          ) : null}

          <Button
            type="submit"
            className="min-h-11 w-full"
            disabled={busy || signingOut || !password || error === 'unavailable' || error === 'locked-out'}
          >
            {busy ? t('lock.unlocking') : t('lock.submit')}
          </Button>
        </form>

        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-full"
          disabled={busy || signingOut}
          onClick={onSignOut}
        >
          {t('lock.signOut')}
        </Button>
      </section>
    </div>
  );
};
