import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import { SESSION_COOKIE_NAME, SESSION_TTL_SECONDS, createSession, destroySession, hashSessionToken } from '../session';

describe('session issuance', () => {
  it('stores only the token hash and returns a hardened cookie', async () => {
    const userId = crypto.randomUUID();
    const session = await createSession(env, userId);
    const expectedKey = `session:${await hashSessionToken(session.token)}`;

    expect(session.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(session.cookie).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(session.cookie).toContain('HttpOnly');
    expect(session.cookie).toContain('Secure');
    expect(session.cookie).toContain('SameSite=Lax');
    expect(session.cookie).toContain('Path=/');
    expect(session.cookie).toContain(`Max-Age=${SESSION_TTL_SECONDS}`);

    const stored = await env.KV_SESSIONS.get(expectedKey);
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!)).toMatchObject({ userId });
    expect(stored).not.toContain(session.token);

    await destroySession(env, session.token);
    expect(await env.KV_SESSIONS.get(expectedKey)).toBeNull();
  });
});
