import { data } from 'react-router';

import type { Route } from './+types/api.vault.items.$id.purge';
import { cloudflareContext } from '~/lib/.server/context';
import { readMutationJson } from '~/lib/.server/json-action';
import { limitIdentity, limitIp, rateLimited } from '~/lib/.server/rate-limit';
import { requireUserApi } from '~/lib/.server/require-user';
import { isVaultId, parsePurgeInput } from '~/server/vault/input';
import { purgeVaultItem } from '~/server/vault/trash';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function action({ request, context, params }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const { user } = await requireUserApi(request, env);
  const ipLimit = await limitIp(env, 'vault', request);
  if (!ipLimit.allowed) return rateLimited(ipLimit.retryAfter);
  const userLimit = await limitIdentity(env, 'vault-purge', user.id);
  if (!userLimit.allowed) return rateLimited(userLimit.retryAfter);
  if (request.method !== 'POST')
    return data({ ok: false, error: 'method-not-allowed' }, { status: 405, headers: NO_STORE });
  if (!params.id || !isVaultId(params.id))
    return data({ ok: false, error: 'not-found' }, { status: 404, headers: NO_STORE });

  const mutation = await readMutationJson(request, env);
  if (!mutation.ok) return data({ ok: false, error: mutation.error }, { status: mutation.status, headers: NO_STORE });
  if (!parsePurgeInput(mutation.value))
    return data({ ok: false, error: 'invalid-input' }, { status: 400, headers: NO_STORE });

  const result = await purgeVaultItem(env, user.id, params.id, request);
  if (result.status === 'not-found') return data({ ok: false, error: 'not-found' }, { status: 404, headers: NO_STORE });
  if (result.status === 'server-error')
    return data({ ok: false, error: 'server-error' }, { status: 500, headers: NO_STORE });

  return data({ ok: true, item: result.item }, { headers: NO_STORE });
}
