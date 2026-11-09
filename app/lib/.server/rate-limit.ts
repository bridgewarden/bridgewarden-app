import { data } from 'react-router';

import { readConfig, requireSecret } from './env';
import { hmacSha256, toHex } from './hmac';

export const RATE_LIMIT_WINDOW_SECONDS = 60;

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfter: number };

const hashPart = async (env: Env, scope: string, kind: string, value: string): Promise<string> => {
  const pepper = requireSecret(env, 'AUTH_PEPPER');
  return toHex(await hmacSha256(pepper, `${scope}:${kind}:${value}`));
};

const limit = async (binding: RateLimit, key: string): Promise<RateLimitResult> => {
  const outcome = await binding.limit({ key });
  return outcome.success ? { allowed: true } : { allowed: false, retryAfter: RATE_LIMIT_WINDOW_SECONDS };
};

export const rateLimited = (retryAfter: number) =>
  data(
    { ok: false, error: 'rate-limited' },
    { status: 429, headers: { 'Retry-After': String(retryAfter), 'Cache-Control': 'no-store' } },
  );

export const limitIp = async (env: Env, scope: string, request: Request): Promise<RateLimitResult> => {
  const ip = request.headers.get('cf-connecting-ip');
  if (!ip && readConfig(env, 'APP_ENV') === 'production')
    return { allowed: false, retryAfter: RATE_LIMIT_WINDOW_SECONDS };

  return limit(env.RATE_LIMITER_IP, await hashPart(env, scope, 'ip', ip ?? 'local'));
};

export const limitIdentity = async (env: Env, scope: string, value: string): Promise<RateLimitResult> =>
  limit(env.RATE_LIMITER_IDENTITY, await hashPart(env, scope, 'identity', value.toLowerCase()));
