import { Outlet } from 'react-router';

import type { Route } from './+types/protected';
import { cloudflareContext } from '~/lib/.server/context';
import { requireConfigured } from '~/lib/.server/setup-guard';

export async function loader({ context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);

  // TODO(TASK-8, PR #9): resolve the session and redirect unauthenticated users to /login.
  await requireConfigured(env);

  return null;
}

export default function ProtectedLayout() {
  return <Outlet />;
}
