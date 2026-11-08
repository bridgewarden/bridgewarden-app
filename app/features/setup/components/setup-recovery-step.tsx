import { CopyIcon, DownloadIcon } from 'lucide-react';

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
    <div className="space-y-2">
      <h2 className="text-lg font-medium">{t('setup.recovery.heading')}</h2>
      <p className="text-sm text-muted-foreground">{t('setup.recovery.description')}</p>
    </div>
    <div className="space-y-2">
      <p id="setup-recovery-label" className="text-sm font-medium">
        {t('setup.recovery.label')}
      </p>
      <div role="group" aria-labelledby="setup-recovery-label" className="rounded-md border bg-muted">
        <div className="flex items-start gap-2 p-3">
          <code id="setup-recovery-key" className="min-w-0 flex-1 font-mono text-sm break-all select-all">
            {recovery.key}
          </code>
          <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={actions.onCopy}>
            <CopyIcon aria-hidden="true" />
            {t('setup.recovery.copy')}
          </Button>
        </div>
      </div>
      {status.copy === 'copied' ? (
        <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
          {t('setup.recovery.copied')}
        </p>
      ) : null}
      {status.copy === 'failed' ? (
        <p role="alert" className="text-sm text-destructive">
          {t('setup.recovery.copyFailed')}
        </p>
      ) : null}
    </div>
    <div className="space-y-2">
      <Button type="button" variant="outline" className="min-h-11" onClick={actions.onDownload}>
        <DownloadIcon aria-hidden="true" />
        {t('setup.recovery.download')}
      </Button>
      {status.download === 'downloaded' ? (
        <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
          {t('setup.recovery.downloaded')}
        </p>
      ) : null}
      {status.download === 'failed' ? (
        <p role="alert" className="text-sm text-destructive">
          {t('setup.recovery.downloadFailed')}
        </p>
      ) : null}
    </div>
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
    <Button type="submit" className="min-h-11">
      {t('setup.recovery.continue')}
    </Button>
  </form>
);
