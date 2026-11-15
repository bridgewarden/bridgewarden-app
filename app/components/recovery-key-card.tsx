import { CopyIcon, DownloadIcon } from 'lucide-react';

import { Button } from '~/components/ui/button';
import { t } from '~/lib/i18n/en';

type RecoveryKeyCardProps = {
  recoveryKey: string;
  ariaLabel: string;
  title?: string;
  warning?: string;
  copyStatus: 'idle' | 'copied' | 'failed';
  downloadStatus: 'idle' | 'downloaded' | 'failed';
  onCopy: () => void;
  onDownload: () => void;
};

export const RecoveryKeyCard = ({
  recoveryKey,
  ariaLabel,
  title,
  warning,
  copyStatus,
  downloadStatus,
  onCopy,
  onDownload,
}: RecoveryKeyCardProps) => (
  <div role="group" aria-label={ariaLabel} className="space-y-3 rounded-md border bg-muted p-3">
    {title ? <p className="text-sm font-medium">{title}</p> : null}
    <code
      id="recovery-key"
      tabIndex={0}
      className="block rounded-md bg-background/60 p-3 font-mono text-sm break-all select-all focus-visible:ring-2 focus-visible:ring-ring"
    >
      {recoveryKey}
    </code>
    {warning ? <p className="text-sm text-muted-foreground">{warning}</p> : null}
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" size="sm" onClick={onCopy}>
        <CopyIcon aria-hidden="true" />
        {t('setup.recovery.copy')}
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={onDownload}>
        <DownloadIcon aria-hidden="true" />
        {t('setup.recovery.download')}
      </Button>
    </div>
    {copyStatus !== 'idle' ? (
      <p role="status" className="text-sm text-muted-foreground">
        {t(copyStatus === 'copied' ? 'setup.recovery.copied' : 'setup.recovery.copyFailed')}
      </p>
    ) : null}
    {downloadStatus !== 'idle' ? (
      <p role="status" className="text-sm text-muted-foreground">
        {t(downloadStatus === 'downloaded' ? 'setup.recovery.downloaded' : 'setup.recovery.downloadFailed')}
      </p>
    ) : null}
  </div>
);
