import type { RefObject } from 'react';

import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { t } from '~/lib/i18n/en';

type LoginTwoFactorFormProps = {
  challenge: {
    code: string;
    backupMode: boolean;
    error: string | null;
    inputRef: RefObject<HTMLInputElement | null>;
  };
  busy: boolean;
  actions: {
    onCodeChange: (value: string) => void;
    onToggleBackupMode: () => void;
    onBack: () => void;
    onSubmit: () => void;
  };
};

export const LoginTwoFactorForm = ({ challenge, busy, actions }: LoginTwoFactorFormProps) => {
  const { code, backupMode, error, inputRef } = challenge;
  const { onCodeChange, onToggleBackupMode, onBack, onSubmit } = actions;

  return (
    <form
      className="space-y-4"
      aria-busy={busy}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="space-y-2">
        <h2 className="text-lg font-medium">{t('login.twoFactorTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('login.twoFactorDescription')}</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="login-2fa-code">{backupMode ? t('login.backupCode') : t('login.totpCode')}</Label>
        <Input
          ref={inputRef}
          id="login-2fa-code"
          autoComplete="one-time-code"
          spellCheck={false}
          inputMode={backupMode ? 'text' : 'numeric'}
          maxLength={backupMode ? 32 : 6}
          placeholder={backupMode ? 'XXXXX-XXXXX' : '000000'}
          value={code}
          aria-invalid={error !== null}
          aria-describedby={error ? 'login-2fa-error' : undefined}
          onChange={(event) => onCodeChange(event.target.value)}
        />
      </div>
      <p role="status" aria-live="polite" className="sr-only">
        {busy ? t('login.signingIn') : ''}
      </p>
      {error ? (
        <p id="login-2fa-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="min-h-11" disabled={busy}>
          {busy ? t('login.signingIn') : t('login.verifyCode')}
        </Button>
        <Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={onToggleBackupMode}>
          {backupMode ? t('login.useTotp') : t('login.useBackupCode')}
        </Button>
        <Button type="button" variant="ghost" className="min-h-11" disabled={busy} onClick={onBack}>
          {t('login.back')}
        </Button>
      </div>
    </form>
  );
};
