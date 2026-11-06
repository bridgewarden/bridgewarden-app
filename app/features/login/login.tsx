import { t } from '~/lib/i18n/en';

export const Login = () => (
  <section className="space-y-2">
    <h1 className="text-2xl font-semibold">{t('login.title')}</h1>
    <p className="text-muted-foreground">{t('login.description')}</p>
  </section>
);
