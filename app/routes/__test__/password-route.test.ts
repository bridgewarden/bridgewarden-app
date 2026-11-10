import { env } from 'cloudflare:workers';
import { RouterContextProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetDatabase } from '../../__test__/reset-database';
import { createTestUser } from '../../__test__/fixtures';
import { testEnv } from '../../__test__/auth-fixtures';
import {
  createFixtureSession,
  createPasswordFixture,
  CURRENT_PASSWORD,
  fixtureRequest,
  userSnapshot,
  type PasswordFixture,
} from '../../__test__/password-change-fixtures';
import { toBase64Url } from '../../lib/base64-url';
import { cloudflareContext } from '../../lib/.server/context';
import { incrementSessionVersion } from '../../lib/.server/queries/users';
import { destroySessionToken, getSession, hashSessionToken, type CreatedSession } from '../../lib/.server/session';
import { prepareLogin } from '../../lib/crypto/login-keys';
import { rewrapPassword } from '../../lib/crypto/password-change';
import { action } from '../api-account-password';

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

const VALID_BODY = {
  currentAuthHash: 'A'.repeat(43),
  authHash: 'A'.repeat(43),
  kdfSalt: 'A'.repeat(22),
  kdfIterations: 600_000,
  vaultKeyWrapped: 'A'.repeat(64),
  vaultKeyWrapIv: 'A'.repeat(16),
};

const sessions: CreatedSession[] = [];

const newPasswordBody = async (fixture: PasswordFixture) => {
  const current = await prepareLogin(CURRENT_PASSWORD, fixture.setup.kdfSalt, fixture.setup.kdfIterations);

  try {
    const rotated = await rewrapPassword(current.authHash, current.wrapKey, 'new master password 456', fixture.setup);
    return { currentAuthHash: current.authHash, ...rotated.request };
  } finally {
    current.wrapKey.fill(0);
  }
};

type ActionResult = { data?: unknown; init?: { status?: number; headers?: HeadersInit } };

const invoke = async (body: unknown, cookie?: string): Promise<ActionResult> => {
  try {
    return (await action({
      request: fixtureRequest(cookie, JSON.stringify(body)),
      context,
      params: {},
    } as never)) as ActionResult;
  } catch (error) {
    return error as ActionResult;
  }
};

const statusOf = (result: ActionResult) => result.init?.status ?? 200;
const headersOf = (result: ActionResult) => new Headers(result.init?.headers);

const cookieFor = async (fixture: PasswordFixture) => {
  const session = await createFixtureSession(fixture.userId);
  sessions.push(session);
  return { cookie: `bw_session=${session.token}`, token: session.token };
};

const cookieRequest = (token: string) =>
  new Request('https://app.example/app', { headers: { cookie: `bw_session=${token}` } });

beforeEach(async () => {
  vi.restoreAllMocks();
  vi.spyOn(env.RATE_LIMITER_IP, 'limit').mockResolvedValue({ success: true });
  vi.spyOn(env.RATE_LIMITER_IDENTITY, 'limit').mockResolvedValue({ success: true });
  await resetDatabase();
  sessions.length = 0;
});

afterEach(async () => {
  await Promise.all(sessions.map((session) => destroySessionToken(env, session.token).catch(() => undefined)));
  sessions.length = 0;
});

describe('password change route', () => {
  it('rejects malformed input before authentication', async () => {
    const result = await invoke({});

    expect(statusOf(result)).toBe(400);
  });

  it('rejects valid-shaped input without a session', async () => {
    const result = await invoke(VALID_BODY);

    expect(statusOf(result)).toBe(401);
  });

  it('rejects a wrong current proof without mutating credentials or issuing a cookie', async () => {
    const fixture = await createPasswordFixture();
    const issued = await cookieFor(fixture);
    const before = await userSnapshot(fixture.userId);
    const body = {
      ...(await newPasswordBody(fixture)),
      currentAuthHash: toBase64Url(new Uint8Array(32).fill(9)),
    };

    const result = await invoke(body, issued.cookie);

    const after = await userSnapshot(fixture.userId);
    expect(statusOf(result)).toBe(401);
    expect(headersOf(result).get('set-cookie')).toBeNull();
    expect(after).toEqual({ ...before, failed_login_count: (before?.failed_login_count ?? 0) + 1 });
  });

  it('rotates the password, reissues a working session, and leaves recovery material untouched', async () => {
    const fixture = await createPasswordFixture();
    const issued = await cookieFor(fixture);
    const before = await userSnapshot(fixture.userId);
    const body = await newPasswordBody(fixture);

    const result = await invoke(body, issued.cookie);
    const payload = result.data as Record<string, unknown>;
    const headers = headersOf(result);
    const setCookie = headers.get('set-cookie') ?? '';
    const newToken = setCookie.match(/bw_session=([^;]+)/)?.[1];

    expect(statusOf(result)).toBe(200);
    expect(payload).toEqual({ ok: true });
    expect(headers.get('cache-control')).toBe('no-store');
    expect(newToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(newToken === issued.token).toBe(false);
    if (newToken) sessions.push({ token: newToken, cookie: '' });

    const after = await userSnapshot(fixture.userId);
    expect(after?.auth_hash).not.toBe(before?.auth_hash);
    expect(after?.kdf_salt).not.toBe(before?.kdf_salt);
    expect(after?.vault_key_wrapped).not.toBe(before?.vault_key_wrapped);
    expect(after?.recovery_key_wrapped).toBe(before?.recovery_key_wrapped);
    expect(after?.recovery_key_wrap_iv).toBe(before?.recovery_key_wrap_iv);

    const refreshed = newToken ? await getSession(testEnv(), cookieRequest(newToken)) : null;
    expect(refreshed).toMatchObject({ user: { id: fixture.userId, sessionVersion: 1 } });
    expect(await getSession(testEnv(), cookieRequest(issued.token))).toBeNull();
    expect(await testEnv().KV_SESSIONS.get(`session:${await hashSessionToken(issued.token)}`)).toBeNull();
  }, 20_000);

  it('rejects a locked account without verifying or rotating', async () => {
    const fixture = await createPasswordFixture();
    const issued = await cookieFor(fixture);
    await env.DB.prepare('UPDATE users SET locked_until = ? WHERE id = ?')
      .bind(Date.now() + 60_000, fixture.userId)
      .run();
    const before = await userSnapshot(fixture.userId);
    const body = await newPasswordBody(fixture);

    const result = await invoke(body, issued.cookie);

    expect(statusOf(result)).toBe(423);
    expect(Number(headersOf(result).get('retry-after'))).toBeGreaterThan(0);
    expect(headersOf(result).get('set-cookie')).toBeNull();
    expect(await userSnapshot(fixture.userId)).toEqual(before);
  }, 20_000);

  it('rejects a stale session before verifying the password', async () => {
    const userId = await createTestUser();
    const session = await createFixtureSession(userId);
    sessions.push(session);
    await incrementSessionVersion(env.DB, userId, Date.now());
    const before = await userSnapshot(userId);

    const result = await invoke(VALID_BODY, `bw_session=${session.token}`);

    expect(statusOf(result)).toBe(401);
    expect(await userSnapshot(userId)).toEqual(before);
    const audits = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM audit_events WHERE type = 'password.change_failed'",
    ).first<{ count: number }>();
    expect(audits?.count).toBe(0);
  });
});
