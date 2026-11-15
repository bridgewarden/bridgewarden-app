import { copySecret } from '~/lib/clipboard';
import { t } from '~/lib/i18n/en';

type RecoveryActionsOptions = {
  recoveryKey: string;
  setCopyStatus: (status: 'idle' | 'copied' | 'failed') => void;
  setDownloadStatus: (status: 'idle' | 'downloaded' | 'failed') => void;
};

export const useRecoveryActions = ({ recoveryKey, setCopyStatus, setDownloadStatus }: RecoveryActionsOptions) => {
  const copyRecoveryKey = async () => {
    setCopyStatus('idle');
    const copied = await copySecret(recoveryKey);
    setCopyStatus(copied ? 'copied' : 'failed');
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
