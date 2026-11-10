import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { t, type MessageKey } from '~/lib/i18n/en';

import type { PasswordFlow } from '../password-change.hooks';

const ERROR_KEYS: Record<string, MessageKey> = {
  invalid: 'passwordChange.error.invalid',
  'invalid-current': 'passwordChange.error.invalidCurrent',
  'invalid-input': 'passwordChange.error.invalid',
  locked: 'passwordChange.error.locked',
  'rate-limited': 'passwordChange.error.rateLimited',
  'server-error': 'passwordChange.error.server',
};

type PasswordCardProps = { flow: PasswordFlow };

export const PasswordCard = ({ flow }: PasswordCardProps) => {
  return (
    <section className="space-y-4 rounded-lg border p-5">
      <div className="space-y-2">
        <h2 className="text-lg font-medium">{t('passwordChange.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('passwordChange.description')}</p>
      </div>

      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void flow.submit();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="current-password">{t('passwordChange.current')}</Label>
          <Input
            id="current-password"
            aria-invalid={flow.error !== null}
            aria-describedby={flow.error ? 'password-change-error' : undefined}
            type="password"
            autoComplete="current-password"
            value={flow.currentPassword}
            disabled={flow.busy}
            onChange={(event) => flow.changeCurrentPassword(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-password">{t('passwordChange.new')}</Label>
          <Input
            id="new-password"
            minLength={12}
            aria-invalid={flow.error !== null}
            aria-describedby={flow.error ? 'password-change-error' : undefined}
            type="password"
            autoComplete="new-password"
            value={flow.newPassword}
            disabled={flow.busy}
            onChange={(event) => flow.changeNewPassword(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-password-confirm">{t('passwordChange.confirm')}</Label>
          <Input
            id="new-password-confirm"
            aria-invalid={flow.error !== null}
            aria-describedby={flow.error ? 'password-change-error' : undefined}
            type="password"
            autoComplete="new-password"
            value={flow.confirmation}
            disabled={flow.busy}
            onChange={(event) => flow.changeConfirmation(event.target.value)}
          />
        </div>
        {flow.error ? (
          <p id="password-change-error" role="alert" className="text-sm text-destructive">
            {t(ERROR_KEYS[flow.error] ?? 'passwordChange.error.server')}
          </p>
        ) : null}
        {flow.success ? (
          <p role="status" className="text-sm text-muted-foreground">
            {t('passwordChange.success')}
          </p>
        ) : null}
        <Button type="submit" className="min-h-11" disabled={flow.busy}>
          {flow.busy ? t('passwordChange.saving') : t('passwordChange.submit')}
        </Button>
      </form>
    </section>
  );
};
