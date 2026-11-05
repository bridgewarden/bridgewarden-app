import type { Route } from './+types/health';

import { cloudflareContext } from '../lib/.server/context';

export async function loader({ context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const row = await env.DB.prepare('SELECT 1 AS ok').first<{ ok: number }>();

  return Response.json({ ok: row?.ok === 1 }, { headers: { 'cache-control': 'no-store' } });
}
