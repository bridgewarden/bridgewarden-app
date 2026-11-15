import { t } from '~/lib/i18n/en';
import { PASSWORD_STRENGTH_KEYS, PASSWORD_STRENGTH_WIDTH } from '~/lib/password-policy';

export const PasswordStrengthMeter = ({ score }: { score: number }) => (
  <div className="space-y-1">
    <div
      role="progressbar"
      aria-label={t('password.strength')}
      aria-valuemin={0}
      aria-valuemax={4}
      aria-valuenow={score}
      aria-valuetext={t(PASSWORD_STRENGTH_KEYS[score])}
      className="h-2 w-full overflow-hidden rounded-full bg-muted"
    >
      <div className={`h-full bg-primary transition-all ${PASSWORD_STRENGTH_WIDTH[score]}`} />
    </div>
    <p className="text-sm text-muted-foreground">{t(PASSWORD_STRENGTH_KEYS[score])}</p>
  </div>
);
