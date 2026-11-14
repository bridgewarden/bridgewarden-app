import { env } from 'cloudflare:workers';
import { RouterContextProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createAuthUser, TEST_SESSION_SECRET, testEnv } from '../../../__test__/auth-fixtures';
import { createTestUser } from '../../../__test__/fixtures';
import { createFixtureSession, fixtureRequest } from '../../../__test__/password-change-fixtures';
import { cloudflareContext } from '../../../lib/.server/context';
import { resetDatabase } from '../../../__test__/reset-database';
import { createUsersQueries } from '../../../lib/.server/queries/users';
import { destroySessionToken, getSession } from '../../../lib/.server/session';
import { action as disableAction } from '../../../routes/api-account-2fa-disable';
import { disableTwoFactor } from '../.server/use-cases/disable';
import { reissueSessionAfterFactorChange } from '../.server/reissue-session';

const request = () =>
  new Request('https://app.example/api/account/2fa/disable', {
    method: 'POST',
    headers: {
      origin: 'https://app.example',
      'content-type': 'application/json',
      'cf-connecting-ip': '203.0.113.9',
      'user-agent': 'test-agent',
    },
    body: '{}',
  });

const routeContext = new RouterContextProvider();
routeContext.set(cloudflareContext, {
  env: {
    ...env,
    APP_ORIGIN: 'https://app.example',
    APP_ENV: 'production',
    AUTH_PEPPER: 'test-auth-pepper',
    SESSION_SECRET: TEST_SESSION_SECRET,
  } as Env,
  ctx: {} as ExecutionContext,
});
const statusOf = (result: unknown): number => (result as { init?: { status?: number } }).init?.status ?? 200;

const environment = () =>
  testEnv({
    APP_ORIGIN: 'https://app.example',
    APP_ENV: 'production',
    SESSION_SECRET: TEST_SESSION_SECRET,
    RATE_LIMITER_IP: env.RATE_LIMITER_IP,
    RATE_LIMITER_IDENTITY: env.RATE_LIMITER_IDENTITY,
  });

beforeEach(async () => {
  vi.restoreAllMocks();
  await resetDatabase();
});

describe('2FA step-up lockout', () => {
  it('counts failures, locks after the threshold, and rejects the correct password while locked', async () => {
    const user = await createAuthUser();
    const wrong = { authHashBytes: new Uint8Array(32).fill(9) };

    await expect(disableTwoFactor(environment(), request(), user.userId, wrong)).resolves.toEqual({
      status: 'invalid-password',
    });
    expect(
      await env.DB.prepare('SELECT COUNT(*) AS count FROM audit_events WHERE type = ?')
        .bind('2fa.step_up_failed')
        .first<{ count: number }>(),
    ).toEqual({ count: 1 });

    for (let attempt = 2; attempt <= 9; attempt += 1) {
      await expect(disableTwoFactor(environment(), request(), user.userId, wrong)).resolves.toEqual({
        status: 'invalid-password',
      });
    }
    await expect(disableTwoFactor(environment(), request(), user.userId, wrong)).resolves.toMatchObject({
      status: 'locked',
    });
    const locked = await env.DB.prepare(
      'SELECT failed_login_count, locked_until, step_up_failed_count, step_up_locked_until FROM users WHERE id = ?',
    )
      .bind(user.userId)
      .first<{
        failed_login_count: number;
        locked_until: number | null;
        step_up_failed_count: number;
        step_up_locked_until: number | null;
      }>();
    expect(locked?.step_up_failed_count).toBe(10);
    expect(locked?.step_up_locked_until).toBeGreaterThan(Date.now());
    expect(locked?.failed_login_count).toBe(0);
    expect(locked?.locked_until).toBeNull();

    await expect(
      disableTwoFactor(environment(), request(), user.userId, { authHashBytes: user.authHash }),
    ).resolves.toMatchObject({ status: 'locked' });
    const afterLockedAttempt = await env.DB.prepare(
      'SELECT step_up_failed_count, step_up_locked_until FROM users WHERE id = ?',
    )
      .bind(user.userId)
      .first<{ step_up_failed_count: number; step_up_locked_until: number | null }>();
    expect(afterLockedAttempt).toEqual({
      step_up_failed_count: locked?.step_up_failed_count,
      step_up_locked_until: locked?.step_up_locked_until,
    });
    const lockedAudit = await env.DB.prepare('SELECT COUNT(*) AS count FROM audit_events WHERE type = ?')
      .bind('2fa.step_up_locked')
      .first<{ count: number }>();
    expect(lockedAudit).toEqual({ count: 1 });
  });

  it('recovers after the lock expires and clears the step-up counter', async () => {
    const user = await createAuthUser();
    await env.DB.prepare('UPDATE users SET step_up_failed_count = 10, step_up_locked_until = ? WHERE id = ?')
      .bind(Date.now() - 60_000, user.userId)
      .run();

    await expect(
      disableTwoFactor(environment(), request(), user.userId, { authHashBytes: user.authHash }),
    ).resolves.toMatchObject({ status: 'ok' });

    const row = await env.DB.prepare('SELECT step_up_failed_count, step_up_locked_until FROM users WHERE id = ?')
      .bind(user.userId)
      .first<{ step_up_failed_count: number; step_up_locked_until: number | null }>();
    expect(row).toEqual({ step_up_failed_count: 0, step_up_locked_until: null });
  });

  it('restarts the step-up counter at one after an expired lock and re-locks at the threshold', async () => {
    const user = await createAuthUser();
    const wrong = { authHashBytes: new Uint8Array(32).fill(9) };
    await env.DB.prepare('UPDATE users SET step_up_failed_count = 10, step_up_locked_until = ? WHERE id = ?')
      .bind(Date.now() - 60_000, user.userId)
      .run();

    await expect(disableTwoFactor(environment(), request(), user.userId, wrong)).resolves.toEqual({
      status: 'invalid-password',
    });
    const firstFailure = await env.DB.prepare(
      'SELECT step_up_failed_count, step_up_locked_until FROM users WHERE id = ?',
    )
      .bind(user.userId)
      .first<{ step_up_failed_count: number; step_up_locked_until: number | null }>();
    expect(firstFailure).toEqual({ step_up_failed_count: 1, step_up_locked_until: null });

    for (let attempt = 0; attempt < 9; attempt += 1) {
      await disableTwoFactor(environment(), request(), user.userId, wrong);
    }
    const relocked = await env.DB.prepare('SELECT step_up_failed_count, step_up_locked_until FROM users WHERE id = ?')
      .bind(user.userId)
      .first<{ step_up_failed_count: number; step_up_locked_until: number | null }>();
    expect(relocked?.step_up_failed_count).toBe(10);
    expect(relocked?.step_up_locked_until).toBeGreaterThan(Date.now());
  });

  it('rate-limits and locks 50 route attempts without touching login lockout', async () => {
    vi.restoreAllMocks();
    vi.spyOn(env.RATE_LIMITER_IP, 'limit').mockResolvedValue({ success: true });
    vi.spyOn(env.RATE_LIMITER_IDENTITY, 'limit').mockResolvedValue({ success: true });
    const user = await createAuthUser();
    const session = await createFixtureSession(user.userId);
    const invalid = new Uint8Array(32).fill(7);
    const encoded = btoa(String.fromCharCode(...invalid))
      .replaceAll('+', '-')
      .replaceAll('/', '_')
      .replace(/=+$/, '');
    const statuses: number[] = [];

    for (let attempt = 0; attempt < 50; attempt += 1) {
      const result = await disableAction({
        request: fixtureRequest(`bw_session=${session.token}`, JSON.stringify({ authHash: encoded })),
        context: routeContext,
        params: {},
      } as never);
      statuses.push(statusOf(result));
    }

    expect(statuses.slice(0, 9)).toEqual(Array(9).fill(400));
    expect(statuses.slice(9)).toEqual(Array(41).fill(423));
    const row = await env.DB.prepare(
      'SELECT failed_login_count, locked_until, step_up_failed_count, step_up_locked_until FROM users WHERE id = ?',
    )
      .bind(user.userId)
      .first<{
        failed_login_count: number;
        locked_until: number | null;
        step_up_failed_count: number;
        step_up_locked_until: number | null;
      }>();
    expect(row).toMatchObject({
      failed_login_count: 0,
      locked_until: null,
      step_up_failed_count: 10,
      step_up_locked_until: expect.any(Number),
    });
  });

  it('accepts a route-level correct proof after the step-up lock expires', async () => {
    vi.restoreAllMocks();
    vi.spyOn(env.RATE_LIMITER_IP, 'limit').mockResolvedValue({ success: true });
    vi.spyOn(env.RATE_LIMITER_IDENTITY, 'limit').mockResolvedValue({ success: true });
    const user = await createAuthUser();
    const session = await createFixtureSession(user.userId);
    await env.DB.prepare('UPDATE users SET step_up_failed_count = 10, step_up_locked_until = ? WHERE id = ?')
      .bind(Date.now() - 60_000, user.userId)
      .run();
    const encoded = btoa(String.fromCharCode(...user.authHash))
      .replaceAll('+', '-')
      .replaceAll('/', '_')
      .replace(/=+$/, '');

    const result = await disableAction({
      request: fixtureRequest(`bw_session=${session.token}`, JSON.stringify({ authHash: encoded })),
      context: routeContext,
      params: {},
    } as never);

    expect(statusOf(result)).toBe(200);
    const row = await env.DB.prepare('SELECT step_up_failed_count, step_up_locked_until FROM users WHERE id = ?')
      .bind(user.userId)
      .first<{ step_up_failed_count: number; step_up_locked_until: number | null }>();
    expect(row).toEqual({ step_up_failed_count: 0, step_up_locked_until: null });
  });

  it('does not clear a live step-up lock when a success resets the counter', async () => {
    const user = await createAuthUser();
    await env.DB.prepare('UPDATE users SET step_up_failed_count = 10, step_up_locked_until = ? WHERE id = ?')
      .bind(Date.now() + 60_000, user.userId)
      .run();
    await createUsersQueries(environment()).resetStepUpFailures(user.userId, Date.now());
    const row = await env.DB.prepare('SELECT step_up_failed_count, step_up_locked_until FROM users WHERE id = ?')
      .bind(user.userId)
      .first<{ step_up_failed_count: number; step_up_locked_until: number | null }>();
    expect(row?.step_up_failed_count).toBe(0);
    expect(row?.step_up_locked_until).toBeGreaterThan(Date.now());
  });

  it('reissues the session and invalidates the previous token after a factor change', async () => {
    const user = await createTestUser();
    const session = await createFixtureSession(user);
    const sibling = await createFixtureSession(user);
    const siblingRequest = new Request('https://app.example/app', {
      headers: { cookie: `bw_session=${sibling.token}` },
    });
    const oldRequest = new Request('https://app.example/app', {
      headers: { cookie: `bw_session=${session.token}`, 'user-agent': 'test-agent', 'cf-connecting-ip': '203.0.113.9' },
    });

    const cookie = await reissueSessionAfterFactorChange(environment(), oldRequest, user);
    expect(cookie).toContain('bw_session=');
    await expect(getSession(environment(), oldRequest)).resolves.toBeNull();
    await expect(getSession(environment(), siblingRequest)).resolves.toBeNull();
    await destroySessionToken(environment(), sibling.token);

    const newToken = cookie!.split(';')[0]!.split('=')[1]!;
    const newRequest = new Request('https://app.example/app', { headers: { cookie: `bw_session=${newToken}` } });
    await expect(getSession(environment(), newRequest)).resolves.toMatchObject({ user: { id: user } });
    await destroySessionToken(environment(), newToken);
  });
});
