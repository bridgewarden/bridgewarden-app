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
    <Alert variant="destructive" role="status">
      <AlertDescription>{t('setup.twoFactor.warning')}</AlertDescription>
    </Alert>
    <p className="text-sm text-muted-foreground">{t('setup.twoFactor.enrollLater')}</p>
    {errorMessage ? (
      <Alert variant="destructive">
        <AlertDescription>{errorMessage}</AlertDescription>
      </Alert>
    ) : null}
    <div className="flex flex-col-reverse gap-2 sm:flex-row">
      {canRetry ? (
        <Button type="button" variant="outline" className="min-h-11 w-full sm:w-auto" disabled={busy} onClick={onRetry}>
          {t('setup.retry')}
        </Button>
      ) : null}
      <Button type="button" className="min-h-11 w-full sm:flex-1" disabled={busy} onClick={onContinue}>
        {busy ? t('setup.submitting') : t('setup.twoFactor.continue')}
      </Button>
    </div>
  </div>
);
