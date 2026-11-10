import { data } from 'react-router';

import type { Route } from './+types/api.vault';
import { cloudflareContext } from '~/lib/.server/context';
import { limitIp, rateLimited } from '~/lib/.server/rate-limit';
import { requireUserApi } from '~/lib/.server/require-user';
import { decodeVaultCursor } from '~/server/vault/cursor';
import { readVaultDelta } from '~/server/vault/sync';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const { user } = await requireUserApi(request, env);
  const ipLimit = await limitIp(env, 'vault-read', request);
  if (!ipLimit.allowed) return rateLimited(ipLimit.retryAfter);
  const url = new URL(request.url);
  const sinceValue = url.searchParams.get('since') ?? '0';
  const cursorValue = url.searchParams.get('cursor');

  if (!/^\d{1,15}$/.test(sinceValue))
    return data({ ok: false, error: 'invalid-input' }, { status: 400, headers: NO_STORE });
  const since = Number(sinceValue);
  if (!Number.isSafeInteger(since))
    return data({ ok: false, error: 'invalid-input' }, { status: 400, headers: NO_STORE });

  const cursor = cursorValue ? decodeVaultCursor(cursorValue) : null;
  if (cursorValue && !cursor) return data({ ok: false, error: 'invalid-input' }, { status: 400, headers: NO_STORE });

  const result = await readVaultDelta(env, user.id, since, cursor);
  if (result.status === 'not-found') return data({ ok: false, error: 'not-found' }, { status: 404, headers: NO_STORE });

  return data(
    {
      ok: true,
      serverRev: result.serverRev,
      items: result.items,
      folders: result.folders,
      ...(result.nextCursor ? { nextCursor: result.nextCursor } : {}),
    },
    { headers: NO_STORE },
  );
}
