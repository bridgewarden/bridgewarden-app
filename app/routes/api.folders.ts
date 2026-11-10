import { data } from 'react-router';

import type { Route } from './+types/api.folders';
import { cloudflareContext } from '~/lib/.server/context';
import { readMutationJson } from '~/lib/.server/json-action';
import { limitIp, rateLimited } from '~/lib/.server/rate-limit';
import { requireUserApi } from '~/lib/.server/require-user';
import { createFolder, listFolders } from '~/server/vault/folders';
import { parseCreateFolderInput } from '~/server/vault/input';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const { user } = await requireUserApi(request, env);
  const ipLimit = await limitIp(env, 'vault-read', request);
  if (!ipLimit.allowed) return rateLimited(ipLimit.retryAfter);
  const result = await listFolders(env, user.id);
  if (result.status === 'server-error')
    return data({ ok: false, error: 'server-error' }, { status: 500, headers: NO_STORE });
  return data({ ok: true, folders: result.folders }, { headers: NO_STORE });
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const { user } = await requireUserApi(request, env);
  const ipLimit = await limitIp(env, 'vault', request);
  if (!ipLimit.allowed) return rateLimited(ipLimit.retryAfter);
  if (request.method !== 'POST')
    return data({ ok: false, error: 'method-not-allowed' }, { status: 405, headers: NO_STORE });

  const mutation = await readMutationJson(request, env);
  if (!mutation.ok) return data({ ok: false, error: mutation.error }, { status: mutation.status, headers: NO_STORE });

  const input = parseCreateFolderInput(mutation.value);
  if (!input) return data({ ok: false, error: 'invalid-input' }, { status: 400, headers: NO_STORE });

  const result = await createFolder(env, user.id, input);
  if (result.status === 'server-error')
    return data({ ok: false, error: 'server-error' }, { status: 500, headers: NO_STORE });
  if (result.status === 'not-found') return data({ ok: false, error: 'not-found' }, { status: 404, headers: NO_STORE });
  if (result.status === 'limit') return data({ ok: false, error: 'limit' }, { status: 409, headers: NO_STORE });
  return data(
    { ok: true, folder: result.folder },
    { status: result.status === 'created' ? 201 : 200, headers: NO_STORE },
  );
}
