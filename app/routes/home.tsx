import { redirect } from 'react-router';

import type { Route } from './+types/home';
import { isBootstrapAvailable } from '~/lib/.server/bootstrap';
import { cloudflareContext } from '~/lib/.server/context';
import { getDatabase } from '~/lib/.server/db';
import { t } from '~/lib/i18n/en';

export async function loader({ context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);

  if (await isBootstrapAvailable(getDatabase(env))) {
    throw redirect('/setup');
  }

  return null;
}

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
