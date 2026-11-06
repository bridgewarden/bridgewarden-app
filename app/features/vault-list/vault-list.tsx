import { t } from '~/lib/i18n/en';

export const VaultList = () => (
  <section className="space-y-2">
    <h1 className="text-2xl font-semibold">{t('vault.title')}</h1>
    <p className="max-w-prose text-muted-foreground">{t('vault.description')}</p>
  </section>
);
