import { t } from '~/lib/i18n/en';

export const meta = () => [{ title: t('app.name') }, { name: 'description', content: t('app.tagline') }];

export default function Home() {
  return (
    <section className="space-y-3">
      <h1 className="text-3xl font-semibold">{t('app.name')}</h1>
      <p className="max-w-prose text-muted-foreground">{t('app.tagline')}</p>
      <p className="text-sm text-muted-foreground">{t('home.notice')}</p>
    </section>
  );
}
