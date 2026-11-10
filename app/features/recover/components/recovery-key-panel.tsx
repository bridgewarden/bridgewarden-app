import { useState } from 'react';

import { Button } from '~/components/ui/button';
import { t } from '~/lib/i18n/en';

export const RecoveryKeyPanel = ({ recoveryKey }: { recoveryKey: string }) => {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [downloadStatus, setDownloadStatus] = useState<'idle' | 'downloaded' | 'failed'>('idle');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(recoveryKey);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('failed');
    }
  };

  const download = () => {
    try {
      const content = `${t('recover.success.fileTitle')}: ${recoveryKey}\n\n${t('recover.success.warning')}\n`;
      const url = URL.createObjectURL(new Blob([content], { type: 'text/plain' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'bridgewarden-recovery-key.txt';
      link.click();
      URL.revokeObjectURL(url);
      setDownloadStatus('downloaded');
    } catch {
      setDownloadStatus('failed');
    }
  };

  return (
    <div role="group" aria-labelledby="recover-new-key-label" className="rounded-md border bg-muted p-4">
      <p id="recover-new-key-label" className="text-sm font-medium">
        {t('recover.success.keyLabel')}
      </p>
      <code
        id="recover-new-key"
        tabIndex={0}
        className="mt-2 block font-mono text-sm break-all select-all focus-visible:ring-2 focus-visible:ring-ring"
      >
        {recoveryKey}
      </code>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => void copy()}>
          {t('recover.success.copy')}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={download}>
          {t('recover.success.download')}
        </Button>
      </div>
      {copyStatus !== 'idle' ? (
        <p role="status" className="mt-2 text-sm text-muted-foreground">
          {t(copyStatus === 'copied' ? 'recover.success.copied' : 'recover.success.copyFailed')}
        </p>
      ) : null}
      {downloadStatus !== 'idle' ? (
        <p role="status" className="mt-2 text-sm text-muted-foreground">
          {t(downloadStatus === 'downloaded' ? 'recover.success.downloaded' : 'recover.success.downloadFailed')}
        </p>
      ) : null}
    </div>
  );
};
