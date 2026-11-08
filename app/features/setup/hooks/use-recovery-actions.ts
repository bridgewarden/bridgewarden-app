import { useEffect } from 'react';

import { t } from '~/lib/i18n/en';

type RecoveryActionsOptions = {
  recoveryKey: string;
  copyStatus: 'idle' | 'copied' | 'failed';
  setCopyStatus: (status: 'idle' | 'copied' | 'failed') => void;
  setDownloadStatus: (status: 'idle' | 'downloaded' | 'failed') => void;
};

export const useRecoveryActions = ({
  recoveryKey,
  copyStatus,
  setCopyStatus,
  setDownloadStatus,
}: RecoveryActionsOptions) => {
  useEffect(() => {
    if (copyStatus !== 'copied') return;

    const timeout = window.setTimeout(async () => {
      try {
        await navigator.clipboard.writeText('');
      } catch {
        // Clipboard may be unavailable; the status still resets.
      }
      setCopyStatus('idle');
    }, 60_000);

    return () => window.clearTimeout(timeout);
  }, [copyStatus, setCopyStatus]);

  const copyRecoveryKey = async () => {
    setCopyStatus('idle');
    try {
      await navigator.clipboard.writeText(recoveryKey);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('failed');
    }
  };

  const downloadRecoveryKey = () => {
    setDownloadStatus('idle');
    try {
      const content = `${t('setup.recovery.fileTitle')}: ${recoveryKey}\n\n${t('setup.recovery.fileWarning')}\n`;
      const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
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

  return { copyRecoveryKey, downloadRecoveryKey };
};
