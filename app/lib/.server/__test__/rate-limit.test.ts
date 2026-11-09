import { describe, expect, it, vi } from 'vitest';

import { limitIdentity, limitIp } from '../rate-limit';

const binding = (success: boolean) => ({ limit: vi.fn(async () => ({ success })) });

const testEnv = (ipSuccess = true, identitySuccess = true) =>
  ({
    AUTH_PEPPER: 'test-pepper',
    RATE_LIMITER_IP: binding(ipSuccess),
    RATE_LIMITER_IDENTITY: binding(identitySuccess),
  }) as unknown as Env;

const request = (ip = '203.0.113.10') =>
  new Request('https://app.example/auth/login', { headers: { 'cf-connecting-ip': ip } });

describe('rate limit helper', () => {
  it('allows requests under budget', async () => {
    await expect(limitIp(testEnv(), 'login', request())).resolves.toEqual({ allowed: true });
    await expect(limitIdentity(testEnv(), 'login', 'user@example.com')).resolves.toEqual({ allowed: true });
  });

  it('rejects over budget with the window as Retry-After', async () => {
    await expect(limitIp(testEnv(false), 'login', request())).resolves.toEqual({
      allowed: false,
      retryAfter: 60,
    });
    await expect(limitIdentity(testEnv(true, false), 'login', 'user@example.com')).resolves.toEqual({
      allowed: false,
      retryAfter: 60,
    });
  });

  it('fails closed without AUTH_PEPPER', async () => {
    const missingPepper = { ...testEnv(), AUTH_PEPPER: undefined } as unknown as Env;
    await expect(limitIp(missingPepper, 'login', request())).rejects.toThrow();
    await expect(limitIdentity(missingPepper, 'login', 'user@example.com')).rejects.toThrow();
  });

  it('never exposes raw identifiers in keys', async () => {
    const env = testEnv();
    await limitIp(env, 'login', request('198.51.100.77'));
    await limitIdentity(env, 'login', 'Sensitive@Example.com');

    const keys = [
      ...vi.mocked(env.RATE_LIMITER_IP.limit).mock.calls,
      ...vi.mocked(env.RATE_LIMITER_IDENTITY.limit).mock.calls,
    ].map(([options]) => options.key);

    expect(keys.every((key) => !key.includes('198.51.100.77') && !key.toLowerCase().includes('sensitive'))).toBe(true);
    expect(keys[0]).toMatch(/^[a-f0-9]{64}$/);
  });
});
