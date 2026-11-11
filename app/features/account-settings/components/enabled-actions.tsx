import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Separator } from '~/components/ui/separator';
import { t } from '~/lib/i18n/en';

type EnabledActionsProps = {
  password: string;
  error: string | null;
  busy: boolean;
  onPasswordChange: (value: string) => void;
  onRegenerate: () => void;
  onDisable: () => void;
};

export const EnabledActions = ({
  password,
  error,
  busy,
  onPasswordChange,
  onRegenerate,
  onDisable,
}: EnabledActionsProps) => (
  <>
    <p className="text-sm text-muted-foreground">{t('settings.twoFactor.regenerateWarning')}</p>
    <p className="text-sm text-muted-foreground">{t('settings.twoFactor.disableDescription')}</p>
    <Separator />
    <div className="space-y-2">
      <Label htmlFor="disable-password">{t('settings.twoFactor.password')}</Label>
      <Input
        id="disable-password"
        type="password"
        autoComplete="current-password"
        spellCheck={false}
        value={password}
        disabled={busy}
        aria-invalid={error !== null}
        aria-describedby={error ? 'settings-2fa-disable-error' : undefined}
        onChange={(event) => onPasswordChange(event.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={onRegenerate}>
          {t('settings.twoFactor.regenerate')}
        </Button>
        <Button type="button" variant="destructive" className="min-h-11" disabled={busy} onClick={onDisable}>
          {t('settings.twoFactor.disable')}
        </Button>
      </div>
      {error ? (
        <p id="settings-2fa-disable-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  </>
);
