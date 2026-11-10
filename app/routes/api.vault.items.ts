import { data } from 'react-router';

import type { Route } from './+types/api.vault.items';
import { cloudflareContext } from '~/lib/.server/context';
import { readMutationJson } from '~/lib/.server/json-action';
import { limitIp, rateLimited } from '~/lib/.server/rate-limit';
import { requireUserApi } from '~/lib/.server/require-user';
import { parseCreateItemInput } from '~/server/vault/input';
import { createVaultItem } from '~/server/vault/items';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const { user } = await requireUserApi(request, env);
  const ipLimit = await limitIp(env, 'vault', request);
  if (!ipLimit.allowed) return rateLimited(ipLimit.retryAfter);
  if (request.method !== 'POST')
    return data({ ok: false, error: 'method-not-allowed' }, { status: 405, headers: NO_STORE });

  const mutation = await readMutationJson(request, env);
  if (!mutation.ok) return data({ ok: false, error: mutation.error }, { status: mutation.status, headers: NO_STORE });

  const input = parseCreateItemInput(mutation.value);
  if (!input) return data({ ok: false, error: 'invalid-input' }, { status: 400, headers: NO_STORE });

  const result = await createVaultItem(env, user.id, input);
  if (result.status === 'not-found') return data({ ok: false, error: 'not-found' }, { status: 404, headers: NO_STORE });
  if (result.status === 'server-error')
    return data({ ok: false, error: 'server-error' }, { status: 500, headers: NO_STORE });

  return data({ ok: true, item: result.item }, { status: 201, headers: NO_STORE });
}
