import { data } from 'react-router';

import type { Route } from './+types/auth-login';
import { parseLoginInput } from '~/features/login/.server/login-input';
import { loginWithPassword } from '~/features/login/.server/use-cases/login';
import { cloudflareContext } from '~/lib/.server/context';
import { readMutationJson } from '~/lib/.server/json-action';

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const mutation = await readMutationJson(request, env);

  if (!mutation.ok) {
    return data({ ok: false, error: mutation.error }, { status: mutation.status });
  }

  const input = parseLoginInput(mutation.value);
  if (!input) {
    return data({ ok: false, error: 'invalid-input' }, { status: 400 });
  }

  // TODO(TASK-10, PR #11): rate-limit and lock out repeated login attempts.
  const result = await loginWithPassword(env, request, input);

  if (result.status === 'invalid-credentials') {
    return data({ ok: false, error: 'invalid-credentials' }, { status: 401 });
  }

  if (result.status === 'server-error') {
    return data({ ok: false, error: 'server-error' }, { status: 500 });
  }

  if (result.status === 'challenge') {
    return data(
      { ok: true, requires2fa: true, challengeToken: result.challengeToken },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  return data(
    { ok: true, ...result.body },
    { status: 200, headers: { 'Set-Cookie': result.cookie, 'Cache-Control': 'no-store' } },
  );
}
