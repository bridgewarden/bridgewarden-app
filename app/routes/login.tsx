import { redirect } from 'react-router';

import type { Route } from './+types/login';
import { cloudflareContext } from '~/lib/.server/context';
import { getSessionCached } from '~/lib/.server/session-cache';
import { requireConfigured } from '~/lib/.server/setup-guard';
import { safeNextPath } from '~/lib/next-path';
import { t } from '~/lib/i18n/en';

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  await requireConfigured(env);
  const session = await getSessionCached(env, request);

  if (session) {
    throw redirect(safeNextPath(new URL(request.url).searchParams.get('next')));
  }

  return null;
}

export { default } from '~/features/login';

export const shouldRevalidate = () => false;

export const meta = () => [{ title: t('login.title') }];
