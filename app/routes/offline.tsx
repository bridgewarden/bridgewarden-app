import { t } from '~/lib/i18n/en';

export default function OfflineRoute() {
  return (
    <section className="mx-auto max-w-md space-y-3 py-12 text-center">
      <h1 className="text-2xl font-semibold">{t('offline.title')}</h1>
      <p className="text-muted-foreground">{t('offline.description')}</p>
    </section>
  );
}

export const meta = () => [{ title: `${t('offline.title')} — ${t('app.name')}` }];
