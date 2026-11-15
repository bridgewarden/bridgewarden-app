import { useState } from 'react';

import { CopyIcon, DownloadIcon } from 'lucide-react';

import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
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
      const content = `${t('recover.success.fileTitle')}: ${recoveryKey}\n\n${t('recover.success.description')}\n${t('recover.success.warning')}\n`;
      const url = URL.createObjectURL(new Blob([content], { type: 'text/plain' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'bridgewarden-recovery-key.txt';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setDownloadStatus('downloaded');
    } catch {
      setDownloadStatus('failed');
    }
  };

  return (
    <Card role="group" aria-labelledby="recover-new-key-label" className="gap-0 py-0 shadow-none">
      <CardHeader className="px-4 pt-4 pb-2">
        <CardTitle id="recover-new-key-label" role="heading" aria-level={3} className="text-sm">
          {t('recover.success.keyLabel')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 px-4 pb-4">
        <code
          id="recover-new-key"
          tabIndex={0}
          className="block rounded-md bg-muted p-3 font-mono text-sm break-all select-all focus-visible:ring-2 focus-visible:ring-ring"
        >
          {recoveryKey}
        </code>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void copy()}>
            <CopyIcon aria-hidden="true" />
            {t('recover.success.copy')}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={download}>
            <DownloadIcon aria-hidden="true" />
            {t('recover.success.download')}
          </Button>
        </div>
        {copyStatus !== 'idle' ? (
          <p role="status" className="text-sm text-muted-foreground">
            {t(copyStatus === 'copied' ? 'recover.success.copied' : 'recover.success.copyFailed')}
          </p>
        ) : null}
        {downloadStatus !== 'idle' ? (
          <p role="status" className="text-sm text-muted-foreground">
            {t(downloadStatus === 'downloaded' ? 'recover.success.downloaded' : 'recover.success.downloadFailed')}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
};
