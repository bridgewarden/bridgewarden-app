import { useEffect, useRef } from 'react';

import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { t } from '~/lib/i18n/en';
import { TOTP_CODE_PATTERN } from '~/lib/totp-code';

type EnrollmentPanelProps = {
  enrollment: { secret: string; uri: string };
  code: { value: string; onChange: (value: string) => void; onInvalid: () => void };
  status: { error: string | null; busy: boolean };
  onVerify: () => void;
  onQrError: () => void;
};

export const EnrollmentPanel = ({ enrollment, code, status, onVerify, onQrError }: EnrollmentPanelProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    void import('qrcode/lib/browser')
      .then(({ default: QRCode }) => QRCode.toCanvas(canvasRef.current!, enrollment.uri, { width: 192, margin: 1 }))
      .catch(onQrError);
  }, [enrollment.uri, onQrError]);

  return (
    <div className="space-y-4 border-t pt-4">
      <p className="text-sm text-muted-foreground">{t('settings.twoFactor.scan')}</p>
      <canvas
        ref={canvasRef}
        className="rounded-md border p-2"
        role="img"
        aria-label={t('settings.twoFactor.qrLabel')}
      />
      <div className="space-y-2">
        <p id="setup-secret-label" className="text-sm font-medium">
          {t('settings.twoFactor.secret')}
        </p>
        <code
          id="setup-secret"
          aria-labelledby="setup-secret-label"
          className="block rounded-md border bg-muted px-3 py-2 font-mono text-sm break-all select-all"
        >
          {enrollment.secret}
        </code>
        <p className="text-sm text-muted-foreground">{t('settings.twoFactor.secretNote')}</p>
      </div>
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!TOTP_CODE_PATTERN.test(code.value)) {
            code.onInvalid();
            return;
          }
          onVerify();
        }}
      >
        <Label htmlFor="setup-code">{t('settings.twoFactor.code')}</Label>
        <Input
          id="setup-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="000000"
          value={code.value}
          disabled={status.busy}
          aria-invalid={status.error !== null}
          aria-describedby={status.error ? 'settings-2fa-error' : undefined}
          onChange={(event) => code.onChange(event.target.value.replace(/\D/g, ''))}
        />
        <Button type="submit" className="min-h-11" disabled={status.busy}>
          {t('settings.twoFactor.verify')}
        </Button>
      </form>
    </div>
  );
};
