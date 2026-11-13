import { readConfig } from './env';
import { hmacSha256, toHex } from './hmac';

const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;

const DYNAMIC_ROUTES: [RegExp, string][] = [
  [/^\/api\/vault\/items\/[^/]+\/restore$/, '/api/vault/items/:id/restore'],
  [/^\/api\/vault\/items\/[^/]+\/purge$/, '/api/vault/items/:id/purge'],
  [/^\/api\/vault\/items\/[^/]+$/, '/api/vault/items/:id'],
  [/^\/api\/folders\/[^/]+$/, '/api/folders/:id'],
  [/^\/app\/edit\/[^/]+$/, '/app/edit/:itemId'],
  [/^\/admin\/users\/[^/]+\/(disable|enable|revoke|role)$/, '/admin/users/:userId/$1'],
];

export type RequestLog = {
  event: 'request.completed' | 'request.error';
  requestId: string;
  method: string;
  route: string;
  status: number;
  durationMs: number;
  userIdHash: string | null;
};

export const normalizeRoutePattern = (pathname: string): string => {
  for (const [pattern, route] of DYNAMIC_ROUTES) {
    if (pattern.test(pathname)) return route;
  }
  return pathname.replace(UUID_PATTERN, ':id');
};

export const hashUserId = async (env: Env, userId: string | null): Promise<string | null> => {
  if (!userId) return null;
  const secret = readConfig(env, 'AUTH_PEPPER');
  if (!secret) return null;
  return toHex(await hmacSha256(secret, `user:${userId}`)).slice(0, 32);
};

export const writeRequestLog = (entry: RequestLog, error?: unknown): void => {
  const payload: RequestLog & { errorName?: string; stack?: string } = { ...entry };
  if (error !== undefined) {
    payload.errorName = error instanceof Error ? error.name : typeof error;
    payload.stack = error instanceof Error ? error.stack : undefined;
  }
  const line = JSON.stringify(payload);
  if (error === undefined) console.log(line);
  else console.error(line);
};

export const buildErrorResponse = (requestId: string): Response =>
  new Response(JSON.stringify({ error: 'internal_error', requestId }), {
    status: 500,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-request-id': requestId,
    },
  });
