import { Outlet, type ShouldRevalidateFunctionArgs } from 'react-router';

import type { Route } from './+types/protected';
import { cloudflareContext } from '~/lib/.server/context';
import { requireUser } from '~/lib/.server/require-user';
import { requireConfigured } from '~/lib/.server/setup-guard';

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);

  await requireConfigured(env);
  await requireUser(request, env);

  return null;
}

export default function ProtectedLayout() {
  return <Outlet />;
}

export const shouldRevalidate = ({ formAction }: ShouldRevalidateFunctionArgs) => formAction !== '/auth/logout';
