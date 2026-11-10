import { env } from 'cloudflare:workers';
import { RouterContextProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { cloudflareContext } from '../../lib/.server/context';
import { action } from '../api-account-password';

const context = new RouterContextProvider();
context.set(cloudflareContext, {
  env: {
    ...env,
    APP_ORIGIN: 'https://app.example',
    APP_ENV: 'production',
    AUTH_PEPPER: 'test-auth-pepper',
    SESSION_SECRET: 'test-session-secret',
  } as Env,
  ctx: {} as ExecutionContext,
});

const request = (body: string) =>
  new Request('https://app.example/api/account/password', {
    method: 'POST',
    headers: { origin: 'https://app.example', 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.9' },
    body,
  });

const settle = async () => {
  try {
    return await action({ request: request('{}'), context, params: {} } as never);
  } catch (error) {
    return error;
  }
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(env.RATE_LIMITER_IP, 'limit').mockResolvedValue({ success: true });
  vi.spyOn(env.RATE_LIMITER_IDENTITY, 'limit').mockResolvedValue({ success: true });
});

describe('password change route', () => {
  it('rejects malformed input before authentication', async () => {
    const result = await settle();
    expect((result as { init?: { status?: number } }).init?.status).toBe(400);
  });

  it('rejects valid-shaped input without a session', async () => {
    const body = JSON.stringify({
      currentAuthHash: 'A'.repeat(43),
      authHash: 'A'.repeat(43),
      kdfSalt: 'A'.repeat(22),
      kdfIterations: 600_000,
      vaultKeyWrapped: 'A'.repeat(64),
      vaultKeyWrapIv: 'A'.repeat(16),
    });
    const result = await action({
      request: request(body),
      context,
      params: {},
    } as never).catch((error) => error);
    expect((result as { init?: { status?: number } }).init?.status).toBe(401);
  });
});
