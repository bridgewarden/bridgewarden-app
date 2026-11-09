import { data } from 'react-router';

import type { Route } from './+types/auth-login';
import { parseLoginInput } from '~/features/login/.server/login-input';
import { loginWithPassword } from '~/features/login/.server/use-cases/login';
import { cloudflareContext } from '~/lib/.server/context';
import { readMutationJson } from '~/lib/.server/json-action';
import { limitIdentity, limitIp, rateLimited } from '~/lib/.server/rate-limit';

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);

  const ipLimit = await limitIp(env, 'login', request);
  if (!ipLimit.allowed) return rateLimited(ipLimit.retryAfter);

  const mutation = await readMutationJson(request, env);

  if (!mutation.ok) {
    return data({ ok: false, error: mutation.error }, { status: mutation.status });
  }

  const input = parseLoginInput(mutation.value);
  if (!input) {
    return data({ ok: false, error: 'invalid-input' }, { status: 400 });
  }

  const identityLimit = await limitIdentity(env, 'login', input.email);
  if (!identityLimit.allowed) return rateLimited(identityLimit.retryAfter);

  const result = await loginWithPassword(env, request, input);

  if (result.status === 'invalid-credentials') {
    return data({ ok: false, error: 'invalid-credentials' }, { status: 401 });
  }

  if (result.status === 'locked') {
    return data(
      { ok: false, error: 'locked' },
      {
        status: 423,
        headers: { 'Retry-After': String(result.retryAfter), 'Cache-Control': 'no-store' },
      },
    );
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
