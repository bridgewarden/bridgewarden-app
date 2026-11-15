import { RecoveryKeyCard } from '~/components/recovery-key-card';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { t, type MessageKey } from '~/lib/i18n/en';

type SetupRecoveryStepProps = {
  recovery: { key: string; confirmation: string };
  fieldError: MessageKey | null;
  status: { copy: 'idle' | 'copied' | 'failed'; download: 'idle' | 'downloaded' | 'failed' };
  actions: {
    onConfirmationChange: (value: string) => void;
    onCopy: () => void;
    onDownload: () => void;
    onBack: () => void;
    onSubmit: () => void;
  };
};

export const SetupRecoveryStep = ({ recovery, fieldError, status, actions }: SetupRecoveryStepProps) => (
  <form
    className="space-y-4"
    onSubmit={(event) => {
      event.preventDefault();
      actions.onSubmit();
    }}
  >
    <RecoveryKeyCard
      recoveryKey={recovery.key}
      title={t('setup.recovery.label')}
      ariaLabel={t('setup.recovery.label')}
      copyStatus={status.copy}
      downloadStatus={status.download}
      onCopy={actions.onCopy}
      onDownload={actions.onDownload}
    />
    <div className="space-y-2">
      <Label htmlFor="setup-recovery-confirm">{t('setup.recovery.confirmLabel')}</Label>
      <Input
        id="setup-recovery-confirm"
        autoComplete="off"
        spellCheck={false}
        value={recovery.confirmation}
        aria-invalid={fieldError !== null}
        aria-describedby={fieldError ? 'setup-recovery-hint setup-recovery-error' : 'setup-recovery-hint'}
        onChange={(event) => actions.onConfirmationChange(event.target.value)}
      />
      <p id="setup-recovery-hint" className="text-sm text-muted-foreground">
        {t('setup.recovery.confirmHint')}
      </p>
    </div>
    {fieldError ? (
      <p id="setup-recovery-error" role="alert" className="text-sm text-destructive">
        {t(fieldError)}
      </p>
    ) : null}
    <div className="flex flex-col-reverse gap-2 sm:flex-row">
      <Button type="button" variant="outline" className="min-h-11 w-full sm:w-auto" onClick={actions.onBack}>
        {t('setup.back')}
      </Button>
      <Button type="submit" className="min-h-11 w-full sm:flex-1">
        {t('setup.recovery.continue')}
      </Button>
    </div>
  </form>
);
