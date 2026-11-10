import { data } from 'react-router';

import type { Route } from './+types/auth-recover-lookup';
import { parseRecoveryLookupInput } from '~/features/recover/.server/recovery-input';
import { lookupRecovery } from '~/features/recover/.server/use-cases/lookup';
import { cloudflareContext } from '~/lib/.server/context';
import { readMutationJson } from '~/lib/.server/json-action';
import { limitIdentity, limitIp, rateLimited } from '~/lib/.server/rate-limit';

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);

  const ipLimit = await limitIp(env, 'recover', request);
  if (!ipLimit.allowed) return rateLimited(ipLimit.retryAfter);

  const mutation = await readMutationJson(request, env);
  if (!mutation.ok) return data({ ok: false, error: mutation.error }, { status: mutation.status });

  const input = parseRecoveryLookupInput(mutation.value);
  if (!input) return data({ ok: false, error: 'invalid-input' }, { status: 400 });

  const identityLimit = await limitIdentity(
    env,
    'recover',
    `${request.headers.get('cf-connecting-ip') ?? 'local'}:${input.email}`,
  );
  if (!identityLimit.allowed) return rateLimited(identityLimit.retryAfter);

  const result = await lookupRecovery(env, request, input.email);
  if (result.status === 'server-error') return data({ ok: false, error: 'server-error' }, { status: 500 });

  return data(
    { ok: true, recoveryKeyWrapped: result.recoveryKeyWrapped, recoveryKeyWrapIv: result.recoveryKeyWrapIv },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
