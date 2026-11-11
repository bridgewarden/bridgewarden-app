import { useEffect, useRef } from 'react';
import { CopyIcon, DownloadIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Alert, AlertDescription } from '~/components/ui/alert';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { t } from '~/lib/i18n/en';

type BackupCodesPanelProps = {
  codes: string[];
};

export const BackupCodesPanel = ({ codes }: BackupCodesPanelProps) => {
  const headingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const copyCodes = async () => {
    try {
      await navigator.clipboard.writeText(codes.join('\n'));
      toast.success(t('settings.twoFactor.codesCopied'));
    } catch {
      toast.error(t('settings.twoFactor.copyFailed'));
    }
  };

  const downloadCodes = () => {
    const content = `${t('settings.twoFactor.codesFileTitle')}\n\n${codes.join('\n')}\n\n${t('settings.twoFactor.codesFileWarning')}\n`;
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'bridgewarden-backup-codes.txt';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return (
    <Card data-testid="backup-codes" className="border-destructive/40">
      <CardHeader>
        <CardTitle ref={headingRef} tabIndex={-1} role="heading" aria-level={2}>
          {t('settings.twoFactor.codesTitle')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Alert variant="destructive" role="status">
          <AlertDescription>{t('settings.twoFactor.codesWarning')}</AlertDescription>
        </Alert>
        <div className="grid gap-2 font-mono text-sm sm:grid-cols-2">
          {codes.map((backupCode) => (
            <code key={backupCode} className="rounded-md border bg-muted px-3 py-2 select-all">
              {backupCode}
            </code>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="min-h-11" onClick={copyCodes}>
            <CopyIcon aria-hidden="true" />
            {t('settings.twoFactor.copyCodes')}
          </Button>
          <Button type="button" variant="outline" className="min-h-11" onClick={downloadCodes}>
            <DownloadIcon aria-hidden="true" />
            {t('settings.twoFactor.downloadCodes')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
