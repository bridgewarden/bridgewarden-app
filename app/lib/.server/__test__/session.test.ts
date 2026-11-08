import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import { createTestUser } from '../../../__test__/fixtures';
import { resetDatabase } from '../../../__test__/reset-database';
import {
  createSession,
  destroySession,
  getSession,
  hashSessionToken,
  readSessionToken,
  revokeUserSessions,
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
} from '../session';

const cookieRequest = (token: string) =>
  new Request('https://app.example/app', { headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` } });

beforeEach(async () => {
  await resetDatabase();
});

describe('session store', () => {
  it('stores a hashed key with metadata and returns the cookie contract', async () => {
    const userId = await createTestUser();
    const created = await createSession(env, { userId, ver: 0, uaHash: 'ua-hash', ipHash: 'ip-hash' });
    const key = `session:${await hashSessionToken(created.token)}`;

    expect(created.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(created.cookie).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(created.cookie).toContain('HttpOnly');
    expect(created.cookie).toContain('Secure');
    expect(created.cookie).toContain('SameSite=Lax');
    expect(created.cookie).toContain('Path=/');
    expect(created.cookie).toContain(`Max-Age=${SESSION_TTL_SECONDS}`);

    const stored = JSON.parse((await env.KV_SESSIONS.get(key))!);
    expect(stored).toMatchObject({
      userId,
      ver: 0,
      uaHash: 'ua-hash',
      ipHash: 'ip-hash',
    });
    expect(stored.createdAt).toBeTypeOf('number');
    expect(stored.lastSeenAt).toBe(stored.createdAt);
    expect(JSON.stringify(stored)).not.toContain(created.token);
  });

  it('resolves a valid session and rejects missing or malformed cookies', async () => {
    const userId = await createTestUser();
    const created = await createSession(env, { userId, ver: 0 });

    await expect(getSession(env, cookieRequest(created.token))).resolves.toMatchObject({
      user: { id: userId, sessionVersion: 0, status: 'active' },
    });

    expect(readSessionToken(new Request('https://app.example/app'))).toBeNull();
    expect(
      readSessionToken(new Request('https://app.example/app', { headers: { cookie: 'bw_session=short' } })),
    ).toBeNull();
    await expect(getSession(env, cookieRequest('A'.repeat(43)))).resolves.toBeNull();
  });

  it('rejects disabled users and stale session versions', async () => {
    const disabledId = await createTestUser({ status: 'disabled' });
    const disabled = await createSession(env, { userId: disabledId, ver: 0 });
    await expect(getSession(env, cookieRequest(disabled.token))).resolves.toBeNull();

    const userId = await createTestUser();
    const created = await createSession(env, { userId, ver: 0 });
    await env.DB.prepare('UPDATE users SET session_version = 1 WHERE id = ?').bind(userId).run();
    await expect(getSession(env, cookieRequest(created.token))).resolves.toBeNull();
  });

  it('revokes every session by incrementing the user version', async () => {
    const userId = await createTestUser();
    const created = await createSession(env, { userId, ver: 0 });

    await revokeUserSessions(env, userId);

    await expect(getSession(env, cookieRequest(created.token))).resolves.toBeNull();
    const row = await env.DB.prepare('SELECT session_version FROM users WHERE id = ?')
      .bind(userId)
      .first<{ session_version: number }>();
    expect(row?.session_version).toBe(1);
  });

  it('refreshes lastSeen at most hourly without extending expiry', async () => {
    const userId = await createTestUser();
    const created = await createSession(env, { userId, ver: 0 });
    const key = `session:${await hashSessionToken(created.token)}`;
    const before = JSON.parse((await env.KV_SESSIONS.get(key))!);
    const expirationBefore = (await env.KV_SESSIONS.list({ prefix: key })).keys[0]?.expiration;

    before.lastSeenAt = Date.now() - 2 * 60 * 60 * 1000;
    await env.KV_SESSIONS.put(key, JSON.stringify(before), {
      expiration: Math.floor((before.createdAt + SESSION_TTL_SECONDS * 1000) / 1000),
    });

    await getSession(env, cookieRequest(created.token));
    const after = JSON.parse((await env.KV_SESSIONS.get(key))!);
    expect(after.lastSeenAt).toBeGreaterThan(before.lastSeenAt);

    const expirationAfter = (await env.KV_SESSIONS.list({ prefix: key })).keys[0]?.expiration;
    expect(expirationAfter).toBe(expirationBefore);
  });

  it('rejects an absolutely expired session and skips refresh near expiry', async () => {
    const userId = await createTestUser();
    const created = await createSession(env, { userId, ver: 0 });
    const key = `session:${await hashSessionToken(created.token)}`;
    const record = JSON.parse((await env.KV_SESSIONS.get(key))!);

    record.createdAt = Date.now() - SESSION_TTL_SECONDS * 1000;
    record.lastSeenAt = record.createdAt;
    await env.KV_SESSIONS.put(key, JSON.stringify(record), {
      expiration: Math.floor(Date.now() / 1000) + 120,
    });
    await expect(getSession(env, cookieRequest(created.token))).resolves.toBeNull();

    const nearExpiry = await createSession(env, { userId, ver: 0 });
    const nearKey = `session:${await hashSessionToken(nearExpiry.token)}`;
    const nearRecord = JSON.parse((await env.KV_SESSIONS.get(nearKey))!);
    nearRecord.createdAt = Date.now() - SESSION_TTL_SECONDS * 1000 + 30_000;
    nearRecord.lastSeenAt = Date.now() - 2 * 60 * 60 * 1000;
    await env.KV_SESSIONS.put(nearKey, JSON.stringify(nearRecord), {
      expiration: Math.floor(Date.now() / 1000) + 120,
    });

    await expect(getSession(env, cookieRequest(nearExpiry.token))).resolves.not.toBeNull();
  });

  it('destroys a session idempotently', async () => {
    const userId = await createTestUser();
    const created = await createSession(env, { userId, ver: 0 });
    const request = cookieRequest(created.token);

    await destroySession(env, request);
    await expect(getSession(env, request)).resolves.toBeNull();
    await expect(destroySession(env, request)).resolves.toBeUndefined();
  });
});
