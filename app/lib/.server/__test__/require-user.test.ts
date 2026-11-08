import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import { createTestUser } from '../../../__test__/fixtures';
import { resetDatabase } from '../../../__test__/reset-database';
import { requireUser } from '../require-user';
import { createSession, SESSION_COOKIE_NAME } from '../session';

const protectedRequest = (token?: string) =>
  new Request('https://app.example/app/trash?x=1', {
    headers: token ? { cookie: `${SESSION_COOKIE_NAME}=${token}` } : {},
  });

beforeEach(async () => {
  await resetDatabase();
});

const redirectLocation = async (request: Request): Promise<string> => {
  try {
    await requireUser(request, env);
  } catch (error) {
    if (error instanceof Response) return error.headers.get('location') ?? '';
    throw error;
  }

  throw new Error('expected a redirect');
};

describe('requireUser', () => {
  it('returns the user for a valid session', async () => {
    const userId = await createTestUser();
    const session = await createSession(env, { userId, ver: 0 });

    await expect(requireUser(protectedRequest(session.token), env)).resolves.toMatchObject({
      user: { id: userId, status: 'active' },
    });
  });

  it('redirects missing, disabled, and stale sessions with a safe next path', async () => {
    await expect(redirectLocation(protectedRequest())).resolves.toBe('/login?next=%2Fapp%2Ftrash%3Fx%3D1');

    const disabledId = await createTestUser({ status: 'disabled' });
    const disabled = await createSession(env, { userId: disabledId, ver: 0 });
    await expect(redirectLocation(protectedRequest(disabled.token))).resolves.toContain('/login?next=');

    const userId = await createTestUser();
    const stale = await createSession(env, { userId, ver: 0 });
    await env.DB.prepare('UPDATE users SET session_version = 1 WHERE id = ?').bind(userId).run();
    await expect(redirectLocation(protectedRequest(stale.token))).resolves.toContain('/login?next=');
  });
});
