import { t } from '~/lib/i18n/en';

import type { TwoFactorState } from '../account-settings.types';
import { TwoFactorCard } from './two-factor-card';

type AccountSettingsPanelProps = {
  email: string;
  displayName: string | null;
  twoFactor: TwoFactorState;
};

export const AccountSettingsPanel = ({ email, displayName, twoFactor }: AccountSettingsPanelProps) => (
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
