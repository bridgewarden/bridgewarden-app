import { Outlet, redirect } from 'react-router';

import type { Route } from './+types/protected';
import { isBootstrapAvailable } from '~/lib/.server/bootstrap';
import { cloudflareContext } from '~/lib/.server/context';
import { getDatabase } from '~/lib/.server/db';

export async function loader({ context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);

  if (await isBootstrapAvailable(getDatabase(env))) {
    throw redirect('/setup');
  }

  return null;
}

export default function ProtectedLayout() {
  return <Outlet />;
}
