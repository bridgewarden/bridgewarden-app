import { data } from 'react-router';

import type { Route } from './+types/api.vault.items.$id';
import { cloudflareContext } from '~/lib/.server/context';
import { readMutationJson, readMutationOrigin } from '~/lib/.server/json-action';
import { limitIp, rateLimited } from '~/lib/.server/rate-limit';
import { requireUserApi } from '~/lib/.server/require-user';
import { isVaultId, parseUpdateItemInput } from '~/server/vault/input';
import { updateVaultItem } from '~/server/vault/items';
import { trashVaultItem } from '~/server/vault/trash';

const NO_STORE = { 'Cache-Control': 'no-store' };

const notFound = () => data({ ok: false, error: 'not-found' }, { status: 404, headers: NO_STORE });

export async function action({ request, context, params }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const { user } = await requireUserApi(request, env);
  const ipLimit = await limitIp(env, 'vault', request);
  if (!ipLimit.allowed) return rateLimited(ipLimit.retryAfter);
  if (!params.id || !isVaultId(params.id)) return notFound();

  if (request.method === 'DELETE') {
    const origin = readMutationOrigin(request, env);
    if (!origin.ok) return data({ ok: false, error: origin.error }, { status: origin.status, headers: NO_STORE });

    const result = await trashVaultItem(env, user.id, params.id);
    if (result.status === 'not-found') return notFound();
    if (result.status === 'server-error')
      return data({ ok: false, error: 'server-error' }, { status: 500, headers: NO_STORE });
    return data({ ok: true, item: result.item }, { headers: NO_STORE });
  }

  if (request.method !== 'PATCH') {
    return data({ ok: false, error: 'method-not-allowed' }, { status: 405, headers: NO_STORE });
  }

  const mutation = await readMutationJson(request, env);
  if (!mutation.ok) return data({ ok: false, error: mutation.error }, { status: mutation.status, headers: NO_STORE });

  const input = parseUpdateItemInput(mutation.value);
  if (!input) return data({ ok: false, error: 'invalid-input' }, { status: 400, headers: NO_STORE });

  const result = await updateVaultItem(env, user.id, params.id, input);
  if (result.status === 'limit') return data({ ok: false, error: 'limit' }, { status: 409, headers: NO_STORE });
  if (result.status === 'not-found') return notFound();
  if (result.status === 'server-error')
    return data({ ok: false, error: 'server-error' }, { status: 500, headers: NO_STORE });
  if (result.status === 'conflict') {
    return data({ ok: false, error: 'conflict', item: result.item }, { status: 409, headers: NO_STORE });
  }

  return data({ ok: true, item: result.item }, { headers: NO_STORE });
}
