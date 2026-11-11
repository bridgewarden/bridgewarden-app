import { Alert, AlertDescription } from '~/components/ui/alert';
import { Button } from '~/components/ui/button';
import { t } from '~/lib/i18n/en';

type SetupTwoFactorStepProps = {
  errorMessage: string | null;
  canRetry: boolean;
  busy: boolean;
  onRetry: () => void;
  onContinue: () => void;
};

export const SetupTwoFactorStep = ({ errorMessage, canRetry, busy, onRetry, onContinue }: SetupTwoFactorStepProps) => (
  <div className="space-y-4">
    <div className="space-y-2">
      <h2 className="text-lg font-medium">{t('setup.twoFactor.heading')}</h2>
      <p className="text-sm text-muted-foreground">{t('setup.twoFactor.description')}</p>
    </div>
    <Alert variant="destructive" role="status">
      <AlertDescription>{t('setup.twoFactor.warning')}</AlertDescription>
    </Alert>
    <p className="text-sm text-muted-foreground">{t('setup.twoFactor.enrollLater')}</p>
    {errorMessage ? (
      <Alert variant="destructive">
        <AlertDescription>{errorMessage}</AlertDescription>
      </Alert>
    ) : null}
    <div className="flex gap-2">
      {canRetry ? (
        <Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={onRetry}>
          {t('setup.retry')}
        </Button>
      ) : null}
      <Button type="button" className="min-h-11" disabled={busy} onClick={onContinue}>
        {busy ? t('setup.submitting') : t('setup.twoFactor.continue')}
      </Button>
    </div>
  </div>
);
