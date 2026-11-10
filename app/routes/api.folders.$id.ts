import { data } from 'react-router';

import type { Route } from './+types/api.folders.$id';
import { cloudflareContext } from '~/lib/.server/context';
import { readMutationJson, readMutationOrigin } from '~/lib/.server/json-action';
import { limitIp, rateLimited } from '~/lib/.server/rate-limit';
import { requireUserApi } from '~/lib/.server/require-user';
import { deleteFolder, renameFolder } from '~/server/vault/folders';
import { isVaultId, parseRenameFolderInput } from '~/server/vault/input';

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

    const result = await deleteFolder(env, user.id, params.id);
    if (result.status === 'not-found') return notFound();
    if (result.status === 'server-error')
      return data({ ok: false, error: 'server-error' }, { status: 500, headers: NO_STORE });
    return data({ ok: true, folder: result.folder }, { headers: NO_STORE });
  }

  if (request.method !== 'PATCH')
    return data({ ok: false, error: 'method-not-allowed' }, { status: 405, headers: NO_STORE });

  const mutation = await readMutationJson(request, env);
  if (!mutation.ok) return data({ ok: false, error: mutation.error }, { status: mutation.status, headers: NO_STORE });
  const input = parseRenameFolderInput(mutation.value);
  if (!input) return data({ ok: false, error: 'invalid-input' }, { status: 400, headers: NO_STORE });

  const result = await renameFolder(env, user.id, params.id, input);
  if (result.status === 'not-found') return notFound();
  if (result.status === 'server-error')
    return data({ ok: false, error: 'server-error' }, { status: 500, headers: NO_STORE });
  if (result.status === 'conflict')
    return data({ ok: false, error: 'conflict', folder: result.folder }, { status: 409, headers: NO_STORE });
  return data({ ok: true, folder: result.folder }, { headers: NO_STORE });
}
