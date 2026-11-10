import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import { createTestUser } from '../../../__test__/fixtures';
import { resetDatabase } from '../../../__test__/reset-database';
import { requireAdmin, requireAdminApi, requireUser } from '../require-user';
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

describe('requireAdmin', () => {
  it('rejects members and anonymous callers', async () => {
    const memberId = await createTestUser({ email: 'member-auth@example.com' });
    const member = await createSession(env, { userId: memberId, ver: 0 });

    const pageError = await requireAdmin(protectedRequest(member.token), env).catch((error) => error);
    expect((pageError as { init?: { status?: number } }).init?.status).toBe(403);

    const apiError = await requireAdminApi(protectedRequest(member.token), env).catch((error) => error);
    expect((apiError as { init?: { status?: number } }).init?.status).toBe(403);

    const anonApi = await requireAdminApi(protectedRequest(), env).catch((error) => error);
    expect((anonApi as { init?: { status?: number } }).init?.status).toBe(401);
  });

  it('accepts administrators', async () => {
    const adminId = await createTestUser({ email: 'admin-auth@example.com' });
    await env.DB.prepare("UPDATE users SET role = 'admin' WHERE id = ?").bind(adminId).run();
    const admin = await createSession(env, { userId: adminId, ver: 0 });

    await expect(requireAdmin(protectedRequest(admin.token), env)).resolves.toMatchObject({
      user: { id: adminId, role: 'admin' },
    });
  });
});
