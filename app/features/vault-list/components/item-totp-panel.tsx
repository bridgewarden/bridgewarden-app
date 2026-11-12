import { ClockIcon, CopyIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '~/components/ui/button';
import { useTotpCode } from '~/hooks/use-totp';
import { TOTP_STEP_SECONDS } from '~/lib/totp';
import { copySecret } from '~/lib/clipboard';
import { t } from '~/lib/i18n/en';

import { Section } from './item-detail-fields';

export const ItemTotpPanel = ({ secret }: { secret: string }) => {
  const { code, secondsRemaining, invalid } = useTotpCode(secret);
  const grouped = code ? `${code.slice(0, 3)} ${code.slice(3)}` : '';

  return (
    <Section icon={<ClockIcon className="size-4" aria-hidden="true" />} title={t('vault.detail.totp')}>
      {invalid ? (
        <p className="px-3 py-2.5 text-sm text-destructive">{t('vault.detail.totpInvalid')}</p>
      ) : (
        <div className="flex items-center justify-between gap-3 px-3 py-2.5">
          <div>
            <p className="font-mono text-lg tracking-[0.2em]">{grouped || '— — —'}</p>
            <p className="text-xs text-muted-foreground">
              {t('vault.detail.totpSeconds', { count: secondsRemaining })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div
              role="progressbar"
              aria-label={t('vault.detail.totpCountdown')}
              aria-valuetext={t('vault.detail.totpSeconds', { count: secondsRemaining })}
              aria-valuemin={0}
              aria-valuemax={TOTP_STEP_SECONDS}
              aria-valuenow={secondsRemaining}
              className="h-1.5 w-20 overflow-hidden rounded-full bg-muted"
            >
              <div
                className={`h-full bg-primary transition-all ${
                  secondsRemaining > 22
                    ? 'w-full'
                    : secondsRemaining > 15
                      ? 'w-3/4'
                      : secondsRemaining > 7
                        ? 'w-1/2'
                        : 'w-1/4'
                }`}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground"
              aria-label={t('vault.detail.copyField', { field: t('vault.detail.totp') })}
              disabled={!code}
              onClick={async () => {
                if (!code) return;
                if (await copySecret(code)) toast.success(t('vault.detail.copied', { label: t('vault.detail.totp') }));
                else toast.error(t('vault.detail.copyFailed'));
              }}
            >
              <CopyIcon className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}
    </Section>
  );
};
