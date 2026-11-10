import { env } from 'cloudflare:workers';
import { RouterContextProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { testEnv } from '../../__test__/auth-fixtures';
import { createFixtureSession, createPasswordFixture } from '../../__test__/password-change-fixtures';
import { resetDatabase } from '../../__test__/reset-database';
import { cloudflareContext } from '../../lib/.server/context';
import { destroySessionToken } from '../../lib/.server/session';
import { prepareRecoveryReset } from '../../lib/crypto/recovery-reset';
import { action as lookupAction } from '../auth-recover-lookup';
import { action as resetAction } from '../auth-recover-reset';
import { loader } from '../recover';

const context = new RouterContextProvider();
context.set(cloudflareContext, {
  env: testEnv({
    APP_ORIGIN: 'https://app.example',
    APP_ENV: 'production',
    RATE_LIMITER_IP: env.RATE_LIMITER_IP,
    RATE_LIMITER_IDENTITY: env.RATE_LIMITER_IDENTITY,
  }),
  ctx: {} as ExecutionContext,
});

type ActionResult = { data?: unknown; init?: { status?: number; headers?: HeadersInit } };

const invoke = async (action: (args: never) => unknown, path: string, body: unknown): Promise<ActionResult> => {
  const request = new Request(`https://app.example${path}`, {
    method: 'POST',
    headers: { origin: 'https://app.example', 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.9' },
    body: JSON.stringify(body),
  });

  try {
    return (await action({ request, context, params: {} } as never)) as ActionResult;
  } catch (error) {
    return error as ActionResult;
  }
};

const statusOf = (result: ActionResult) => result.init?.status ?? 200;
const headersOf = (result: ActionResult) => new Headers(result.init?.headers);

beforeEach(async () => {
  vi.restoreAllMocks();
  vi.spyOn(env.RATE_LIMITER_IP, 'limit').mockResolvedValue({ success: true });
  vi.spyOn(env.RATE_LIMITER_IDENTITY, 'limit').mockResolvedValue({ success: true });
  await resetDatabase();
});

describe('recovery lookup route', () => {
  it('rejects a malformed body', async () => {
    const result = await invoke(lookupAction, '/auth/recover/lookup', {});
    expect(statusOf(result)).toBe(400);
  });

  it('returns the same shape for known and unknown emails', async () => {
    const fixture = await createPasswordFixture();
    const known = await invoke(lookupAction, '/auth/recover/lookup', { email: fixture.email });
    const unknown = await invoke(lookupAction, '/auth/recover/lookup', { email: 'missing@example.com' });
    const knownBody = known.data as Record<string, unknown>;
    const unknownBody = unknown.data as Record<string, unknown>;

    expect(statusOf(known)).toBe(200);
    expect(statusOf(unknown)).toBe(200);
    expect(Object.keys(knownBody).sort()).toEqual(Object.keys(unknownBody).sort());
    expect(headersOf(known).get('cache-control')).toBe('no-store');
  });
});

describe('recover page', () => {
  it('redirects an unconfigured install to setup', async () => {
    const request = new Request('https://app.example/recover');
    const result = await Promise.resolve(loader({ request, context, params: {} } as never)).catch(
      (error) => error as Response,
    );

    expect((result as Response).status).toBe(302);
    expect((result as Response).headers.get('location')).toBe('/setup');
  });

  it('redirects an authenticated session to the app', async () => {
    const fixture = await createPasswordFixture();
    const session = await createFixtureSession(fixture.userId);
    const request = new Request('https://app.example/recover', {
      headers: { cookie: `bw_session=${session.token}` },
    });

    const result = await Promise.resolve(loader({ request, context, params: {} } as never)).catch(
      (error) => error as Response,
    );

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(302);
    expect((result as Response).headers.get('location')).toBe('/app');
    await destroySessionToken(env, session.token).catch(() => undefined);
  });
});

describe('recovery reset route', () => {
  it('rejects a malformed body', async () => {
    const result = await invoke(resetAction, '/auth/recover/reset', {});
    expect(statusOf(result)).toBe(400);
  });

  it('returns a committed result when session issuance fails', async () => {
    const fixture = await createPasswordFixture();
    const prepared = await prepareRecoveryReset(
      fixture.setup.recoveryKey,
      { recoveryKeyWrapped: fixture.setup.recoveryKeyWrapped, recoveryKeyWrapIv: fixture.setup.recoveryKeyWrapIv },
      'new master password 456',
    );
    const put = vi.spyOn(env.KV_SESSIONS, 'put').mockRejectedValueOnce(new Error('kv unavailable'));

    const result = await invoke(resetAction, '/auth/recover/reset', { email: fixture.email, ...prepared.request });
    put.mockRestore();

    expect(statusOf(result)).toBe(200);
    expect(result.data).toEqual({ ok: true, sessionIssued: false });
    expect(headersOf(result).get('set-cookie')).toBeNull();
  }, 20_000);

  it('rejects a wrong proof without a cookie', async () => {
    const fixture = await createPasswordFixture();
    const prepared = await prepareRecoveryReset(
      fixture.setup.recoveryKey,
      { recoveryKeyWrapped: fixture.setup.recoveryKeyWrapped, recoveryKeyWrapIv: fixture.setup.recoveryKeyWrapIv },
      'new master password 456',
    );
    const result = await invoke(resetAction, '/auth/recover/reset', {
      email: fixture.email,
      ...prepared.request,
      currentRecoveryAuthKey: 'A'.repeat(43),
    });

    expect(statusOf(result)).toBe(401);
    expect(headersOf(result).get('set-cookie')).toBeNull();
  }, 20_000);

  it('returns a new cookie and no secret material on success', async () => {
    const fixture = await createPasswordFixture();
    const prepared = await prepareRecoveryReset(
      fixture.setup.recoveryKey,
      { recoveryKeyWrapped: fixture.setup.recoveryKeyWrapped, recoveryKeyWrapIv: fixture.setup.recoveryKeyWrapIv },
      'new master password 456',
    );
    const result = await invoke(resetAction, '/auth/recover/reset', {
      email: fixture.email,
      ...prepared.request,
    });
    const cookie = headersOf(result).get('set-cookie') ?? '';
    const token = cookie.match(/bw_session=([^;]+)/)?.[1];

    expect(statusOf(result)).toBe(200);
    expect(result.data).toEqual({ ok: true, sessionIssued: true });
    expect(headersOf(result).get('cache-control')).toBe('no-store');
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(JSON.stringify(result.data)).not.toMatch(/recovery|authHash|vaultKey|kdf/i);
    if (token) await destroySessionToken(env, token).catch(() => undefined);
  }, 20_000);
});
