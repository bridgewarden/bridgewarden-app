import { useEffect, useRef, useState } from 'react';

import { LockIcon } from 'lucide-react';

import { Button } from '~/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '~/components/ui/dialog';
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

const LOCKOUT_NOTICE_MS = 1200;

export const LockedOverlay = ({ signingOut, onUnlock, onSignOut }: LockedOverlayProps) => {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<LockError | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const signOutTimer = useRef<number | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    return () => {
      if (signOutTimer.current !== null) window.clearTimeout(signOutTimer.current);
    };
  }, []);

  const signOut = () => {
    if (signOutTimer.current !== null) {
      window.clearTimeout(signOutTimer.current);
      signOutTimer.current = null;
    }
    onSignOut();
  };

  const submit = async () => {
    if (!password || busy) return;
    setBusy(true);
    setError(null);

    try {
      const result = await onUnlock(password);
      setPassword('');

      if (result.status === 'locked-out') {
        setError('locked-out');
        signOutTimer.current = window.setTimeout(signOut, LOCKOUT_NOTICE_MS);
        return;
      }

      if (result.status !== 'ok') {
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
    <Dialog open>
      <DialogContent
        showCloseButton={false}
        className="max-w-md bg-card duration-0 data-[state=closed]:animate-none data-[state=open]:animate-none"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <LockIcon className="size-8" aria-hidden="true" />
          <DialogTitle className="text-2xl">{t('lock.title')}</DialogTitle>
          <DialogDescription>{t('lock.description')}</DialogDescription>
        </DialogHeader>

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
              className="h-11"
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
          onClick={signOut}
        >
          {signingOut ? t('lock.signingOut') : t('lock.signOut')}
        </Button>
      </DialogContent>
    </Dialog>
  );
};
