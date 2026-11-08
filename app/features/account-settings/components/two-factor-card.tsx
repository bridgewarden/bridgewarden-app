import { ShieldCheckIcon } from 'lucide-react';

import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { t } from '~/lib/i18n/en';

import { useAccountSettings } from '../account-settings.hooks';
import type { TwoFactorState } from '../account-settings.types';
import { BackupCodesPanel } from './backup-codes-panel';
import { EnabledActions } from './enabled-actions';
import { EnrollmentPanel } from './enrollment-panel';

type TwoFactorCardProps = {
  email: string;
  twoFactor: TwoFactorState;
};

export const TwoFactorCard = ({ email, twoFactor }: TwoFactorCardProps) => {
  const flow = useAccountSettings({ email, twoFactor });

  return (
    <>
      <div className="space-y-4 rounded-lg border p-5">
        <div className="flex items-center gap-2">
          <ShieldCheckIcon className="size-5" aria-hidden="true" />
          <h2 className="text-lg font-medium">{t('settings.twoFactor.title')}</h2>
        </div>
        <p className="text-sm text-muted-foreground">{t('settings.twoFactor.description')}</p>

        {flow.enabled ? (
          <div className="space-y-4">
            <p className="text-sm">
              {t('settings.twoFactor.enabled')} · {t('settings.twoFactor.remaining', { count: flow.remaining })}
            </p>
            <EnabledActions
              password={flow.password}
              error={flow.disableError}
              busy={flow.busy}
              onPasswordChange={flow.changePassword}
              onRegenerate={flow.regenerate}
              onDisable={flow.disable}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t('settings.twoFactor.disabled')}</p>
            <form
              className="space-y-2"
              onSubmit={(event) => {
                event.preventDefault();
                flow.enable();
              }}
            >
              <Label htmlFor="enable-password">{t('settings.twoFactor.password')}</Label>
              <Input
                id="enable-password"
                type="password"
                autoComplete="current-password"
                spellCheck={false}
                value={flow.password}
                disabled={flow.busy || flow.enrollment !== null}
                aria-invalid={flow.error !== null}
                aria-describedby={flow.error ? 'settings-2fa-error' : undefined}
                onChange={(event) => flow.changePassword(event.target.value)}
              />
              <Button type="submit" className="min-h-11" disabled={flow.busy || flow.enrollment !== null}>
                {t('settings.twoFactor.enable')}
              </Button>
            </form>

            {flow.enrollment ? (
              <EnrollmentPanel
                enrollment={flow.enrollment}
                code={{ value: flow.code, onChange: flow.changeCode, onInvalid: flow.invalidCode }}
                status={{ error: flow.error, busy: flow.busy }}
                onVerify={flow.verify}
                onQrError={flow.handleQrError}
              />
            ) : null}
          </div>
        )}

        {flow.error ? (
          <p id="settings-2fa-error" role="alert" className="text-sm text-destructive">
            {flow.error}
          </p>
        ) : null}
      </div>

      {flow.codes ? <BackupCodesPanel codes={flow.codes} /> : null}
    </>
  );
};
