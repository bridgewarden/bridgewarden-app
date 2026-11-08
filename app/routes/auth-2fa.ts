import { data } from 'react-router';

import type { Route } from './+types/auth-2fa';
import { parseChallengeInput } from '~/features/two-factor/.server/challenge-input';
import { verifyChallenge } from '~/features/two-factor/.server/use-cases/verify-challenge';
import { cloudflareContext } from '~/lib/.server/context';
import { readMutationJson } from '~/lib/.server/json-action';

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const mutation = await readMutationJson(request, env);

  if (!mutation.ok) {
    return data({ ok: false, error: mutation.error }, { status: mutation.status });
  }

  const input = parseChallengeInput(mutation.value);
  if (!input) {
    return data({ ok: false, error: 'invalid-input' }, { status: 400 });
  }

  const result = await verifyChallenge(env, request, input);

  if (result.status === 'invalid-challenge') {
    return data({ ok: false, error: 'invalid-challenge', challengeInvalid: true }, { status: 401 });
  }

  if (result.status === 'invalid-code') {
    return data({ ok: false, error: 'invalid-code', challengeInvalid: result.challengeInvalid }, { status: 401 });
  }

  if (result.status === 'server-error') {
    return data({ ok: false, error: 'server-error' }, { status: 500 });
  }

  return data(
    { ok: true, ...result.body },
    { status: 200, headers: { 'Set-Cookie': result.cookie, 'Cache-Control': 'no-store' } },
  );
}
