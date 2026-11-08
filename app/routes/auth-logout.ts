import { data } from 'react-router';

import type { Route } from './+types/auth-logout';
import { logoutCurrentSession } from '~/features/login/.server/use-cases/logout';
import { cloudflareContext } from '~/lib/.server/context';
import { readMutationJson } from '~/lib/.server/json-action';

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);

  const mutation = await readMutationJson(request, env);
  if (!mutation.ok) {
    return data({ ok: false, error: mutation.error }, { status: mutation.status });
  }

  const result = await logoutCurrentSession(env, request);

  return data({ ok: true }, { headers: { 'Set-Cookie': result.cookie, 'Cache-Control': 'no-store' } });
}
