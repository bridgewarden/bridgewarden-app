import { t } from '~/lib/i18n/en';

import type { AccountSettingsProps } from './account-settings.types';
import { TwoFactorCard } from './components';

export const AccountSettings = ({ email, displayName, twoFactor }: AccountSettingsProps) => {
  return (
    <section className="mx-auto w-full max-w-2xl space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">{t('settings.title')}</h1>
        <p className="text-muted-foreground">{t('settings.description')}</p>
        <p className="text-sm text-muted-foreground">
          {displayName ?? email} · {email}
        </p>
      </div>

      <TwoFactorCard email={email} twoFactor={twoFactor} />
    </section>
  );
};
