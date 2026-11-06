import { t } from '~/lib/i18n/en';

export const Setup = () => (
  <section className="space-y-2">
    <h1 className="text-2xl font-semibold">{t('setup.title')}</h1>
    <p className="text-muted-foreground">{t('setup.description')}</p>
  </section>
);
