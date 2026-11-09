import type { Route } from './+types/health';

import { cloudflareContext } from '../lib/.server/context';
import { checkDatabase } from '../lib/.server/queries/health';

export async function loader({ context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const ok = await checkDatabase(env);

  return Response.json({ ok }, { headers: { 'cache-control': 'no-store' } });
}
