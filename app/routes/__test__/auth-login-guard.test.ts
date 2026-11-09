import { env } from 'cloudflare:workers';
import { RouterContextProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetDatabase } from '../../__test__/reset-database';
import { createAuthUser } from '../../__test__/auth-fixtures';
import { toBase64Url } from '../../lib/base64-url';
import { cloudflareContext } from '../../lib/.server/context';
import { action as loginAction } from '../auth-login';

const context = new RouterContextProvider();
context.set(cloudflareContext, {
  env: { ...env, APP_ORIGIN: 'https://app.example', APP_ENV: 'production' } as Env,
  ctx: {} as ExecutionContext,
});

const request = (body: unknown, path = '/auth/login') =>
  new Request(`https://app.example${path}`, {
    method: 'POST',
    headers: { origin: 'https://app.example', 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.9' },
    body: JSON.stringify(body),
  });

const invoke = (req: Request) => loginAction({ request: req, context, params: {} } as never);
const statusOf = (result: unknown): number => (result as { init?: { status?: number } }).init?.status ?? 200;
const headerOf = (result: unknown, name: string): string | null | undefined => {
  const headers = (result as { init?: { headers?: Headers | Record<string, string> } }).init?.headers;
  if (!headers) return undefined;
  return headers instanceof Headers ? headers.get(name) : (headers[name] ?? headers[name.toLowerCase()]);
};

beforeEach(async () => {
  await resetDatabase();
  vi.restoreAllMocks();
  vi.spyOn(env.RATE_LIMITER_IP, 'limit').mockResolvedValue({ success: true });
  vi.spyOn(env.RATE_LIMITER_IDENTITY, 'limit').mockResolvedValue({ success: true });
});

describe('login route abuse guards', () => {
  it('returns 429 with Retry-After when the identity budget rejects', async () => {
    vi.spyOn(env.RATE_LIMITER_IDENTITY, 'limit').mockResolvedValue({ success: false });
    const user = await createAuthUser({ email: 'limited@example.com' });

    const result = await invoke(request({ email: user.email, authHash: toBase64Url(user.authHash) }));

    expect(statusOf(result)).toBe(429);
    expect(headerOf(result, 'Retry-After')).toBe('60');
  });

  it('locks the account after ten route-level failures and returns 423', async () => {
    const user = await createAuthUser({ email: 'locked-route@example.com' });
    const wrongHash = 'A'.repeat(43);

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const result = await invoke(request({ email: user.email, authHash: wrongHash }));
      expect(statusOf(result)).toBe(401);
    }

    const result = await invoke(request({ email: user.email, authHash: wrongHash }));
    expect(statusOf(result)).toBe(423);
    expect(Number(headerOf(result, 'Retry-After'))).toBeGreaterThan(0);
  });
});
