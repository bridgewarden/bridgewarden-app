import { data } from 'react-router';

import type { Route } from './+types/api-account-password-prepare';
import { parseAuthHash } from '~/lib/.server/parse-auth-hash';
import { preparePasswordChange } from '~/features/account-settings/.server/use-cases/prepare-password-change';
import { cloudflareContext } from '~/lib/.server/context';
import { readMutationJson } from '~/lib/.server/json-action';
import { limitIdentity, limitIp, rateLimited } from '~/lib/.server/rate-limit';
import { requireUserApi } from '~/lib/.server/require-user';

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);

  const ipLimit = await limitIp(env, 'password-change', request);
  if (!ipLimit.allowed) return rateLimited(ipLimit.retryAfter);

  const mutation = await readMutationJson(request, env);
  if (!mutation.ok) return data({ ok: false, error: mutation.error }, { status: mutation.status });

  const value = mutation.value as { currentAuthHash?: unknown };
  const currentAuthHash = typeof value.currentAuthHash === 'string' ? parseAuthHash(value.currentAuthHash) : null;
  if (!currentAuthHash) return data({ ok: false, error: 'invalid-input' }, { status: 400 });

  const { user } = await requireUserApi(request, env);
  const identityLimit = await limitIdentity(env, 'password-change', user.email);
  if (!identityLimit.allowed) return rateLimited(identityLimit.retryAfter);

  const result = await preparePasswordChange(env, request, user.id, currentAuthHash);
  if (result.status === 'invalid-current') return data({ ok: false, error: 'invalid-current' }, { status: 401 });
  if (result.status === 'locked') {
    return data(
      { ok: false, error: 'locked' },
      { status: 423, headers: { 'Retry-After': String(result.retryAfter), 'Cache-Control': 'no-store' } },
    );
  }
  if (result.status === 'server-error') return data({ ok: false, error: 'server-error' }, { status: 500 });

  return data({ ok: true, material: result.material }, { headers: { 'Cache-Control': 'no-store' } });
}
