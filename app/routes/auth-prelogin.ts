import { data } from 'react-router';

import type { Route } from './+types/auth-prelogin';
import { parsePreloginInput } from '~/features/login/.server/login-input';
import { lookupKdfParameters } from '~/features/login/.server/use-cases/prelogin';
import { cloudflareContext } from '~/lib/.server/context';
import { readMutationJson } from '~/lib/.server/json-action';

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const mutation = await readMutationJson(request, env);

  if (!mutation.ok) {
    return data({ ok: false, error: mutation.error }, { status: mutation.status });
  }

  const input = parsePreloginInput(mutation.value);
  if (!input) {
    return data({ ok: false, error: 'invalid-input' }, { status: 400 });
  }

  const result = await lookupKdfParameters(env, input.email);
  if (result.status === 'server-error') {
    return data({ ok: false, error: 'server-error' }, { status: 500 });
  }

  return data({ ok: true, ...result.parameters }, { headers: { 'Cache-Control': 'no-store' } });
}
