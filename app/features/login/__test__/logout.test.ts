import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import { resetDatabase } from '../../../__test__/reset-database';
import { createTestUser } from '../../../__test__/fixtures';
import { createSession, hashSessionToken, SESSION_COOKIE_NAME } from '../../../lib/.server/session';
import { logoutCurrentSession } from '../.server/use-cases/logout';
import { testEnv } from '../../../__test__/auth-fixtures';

beforeEach(async () => {
  await resetDatabase();
});

describe('logout', () => {
  it('destroys the session, clears the cookie, and audits the user', async () => {
    const userId = await createTestUser();
    const session = await createSession(env, { userId, ver: 0 });
    const request = new Request('https://app.example/auth/logout', {
      method: 'POST',
      headers: { cookie: `${SESSION_COOKIE_NAME}=${session.token}` },
    });

    const result = await logoutCurrentSession(testEnv(), request);

    expect(result.hadSession).toBe(true);
    expect(result.cookie).toContain('Max-Age=0');
    expect(await env.KV_SESSIONS.get(`session:${await hashSessionToken(session.token)}`)).toBeNull();
    const audit = await env.DB.prepare('SELECT type, user_id FROM audit_events').first();
    expect(audit).toEqual({ type: 'logout', user_id: userId });
  });

  it('is idempotent without a session', async () => {
    const result = await logoutCurrentSession(testEnv(), new Request('https://app.example/auth/logout'));

    expect(result.hadSession).toBe(false);
    const count = await env.DB.prepare('SELECT COUNT(*) AS count FROM audit_events').first<{ count: number }>();
    expect(count?.count).toBe(0);
  });
});
