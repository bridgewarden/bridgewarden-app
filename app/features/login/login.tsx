import { t } from '~/lib/i18n/en';

import { LoginPanel } from './components';

export const Login = () => (
  <section className="mx-auto w-full max-w-md space-y-6">
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">{t('login.title')}</h1>
      <p className="text-muted-foreground">{t('login.description')}</p>
    </div>

    <LoginPanel />
  </section>
);
