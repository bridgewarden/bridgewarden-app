import type { Route } from './+types/health';

import { cloudflareContext } from '~/lib/.server/context';
import { checkDatabase, readAppliedSchemaVersion } from '~/lib/.server/queries/health';
import { limitIp, rateLimited } from '~/lib/.server/rate-limit';
import { SCHEMA_VERSION } from '~/lib/.server/schema';

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const limit = await limitIp(env, 'health', request);
  if (!limit.allowed) return rateLimited(limit.retryAfter);
  const ok = await checkDatabase(env);
  if (new URL(request.url).searchParams.get('schema') === '1') {
    const applied = await readAppliedSchemaVersion(env).catch(() => null);
    const schemaOk = applied === SCHEMA_VERSION;
    return Response.json(
      { ok: ok && schemaOk, schemaVersion: SCHEMA_VERSION, appliedMigrations: applied },
      { status: ok && schemaOk ? 200 : 503, headers: { 'cache-control': 'no-store' } },
    );
  }

  return Response.json({ ok }, { headers: { 'cache-control': 'no-store' } });
}
