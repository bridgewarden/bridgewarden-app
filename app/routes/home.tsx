import type { Route } from './+types/home';
import { cloudflareContext } from '~/lib/.server/context';
import { requireUser } from '~/lib/.server/require-user';
import { requireConfigured } from '~/lib/.server/setup-guard';
import { t } from '~/lib/i18n/en';

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);

  await requireConfigured(env);
  await requireUser(request, env);

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
