import { redirect } from 'react-router';

import type { Route } from './+types/recover';
import Recover from '~/features/recover';
import { cloudflareContext } from '~/lib/.server/context';
import { getSessionCached } from '~/lib/.server/session-cache';
import { requireConfigured } from '~/lib/.server/setup-guard';
import { t } from '~/lib/i18n/en';

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  await requireConfigured(env);

  if (await getSessionCached(env, request)) throw redirect('/app');

  return null;
}

export default function RecoverRoute() {
  return <Recover />;
}

export const shouldRevalidate = () => false;

export const meta = () => [{ title: t('recover.title') }];
