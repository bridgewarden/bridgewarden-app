import { env } from 'cloudflare:workers';
import { RouterContextProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { testEnv } from '../../__test__/auth-fixtures';
import { createTestUser } from '../../__test__/fixtures';
import { resetDatabase } from '../../__test__/reset-database';
import { cloudflareContext } from '../../lib/.server/context';
import { createSession, destroySessionToken, type CreatedSession } from '../../lib/.server/session';
import { createInvitation } from '../../features/admin-users/.server/use-cases/create-invitation';
import { action as disableAction } from '../admin.users.$userId.disable';
import { action as enableAction } from '../admin.users.$userId.enable';
import { action as revokeAction } from '../admin.users.$userId.revoke';
import { action as roleAction } from '../admin.users.$userId.role';
import { action as inviteAction } from '../admin.users.invite';
import { action as revokeInvitationAction } from '../admin.users.invitations.$invitationId.revoke';

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
const sessions: CreatedSession[] = [];

const adminCookie = async () => {
  const userId = await createTestUser({ email: `admin-${crypto.randomUUID()}@example.com` });
  await env.DB.prepare("UPDATE users SET role = 'admin' WHERE id = ?").bind(userId).run();
  const session = await createSession(testEnv(), { userId });
  sessions.push(session);
  return { userId, cookie: `bw_session=${session.token}` };
};

const invoke = async (
  fn: (args: never) => unknown,
  path: string,
  options: { body?: unknown; cookie?: string; params?: Record<string, string> } = {},
): Promise<ActionResult> => {
  const request = new Request(`https://app.example${path}`, {
    method: 'POST',
    headers: {
      origin: 'https://app.example',
      'content-type': 'application/json',
      'cf-connecting-ip': '203.0.113.9',
      ...(options.cookie ? { cookie: options.cookie } : {}),
    },
    body: JSON.stringify(options.body ?? {}),
  });
  try {
    return (await fn({ request, context, params: options.params ?? {} } as never)) as ActionResult;
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
  sessions.length = 0;
});

afterEach(async () => {
  await Promise.all(sessions.map((session) => destroySessionToken(env, session.token).catch(() => undefined)));
  sessions.length = 0;
});

describe('admin mutation guard', () => {
  it('rejects by IP before creating an invitation', async () => {
    const { cookie } = await adminCookie();
    vi.spyOn(env.RATE_LIMITER_IP, 'limit').mockResolvedValueOnce({ success: false });

    const result = await invoke(inviteAction, '/admin/users/invite', {
      cookie,
      body: { email: 'blocked@example.com', displayName: 'Blocked', role: 'member' },
    });

    expect(statusOf(result)).toBe(429);
    const count = await env.DB.prepare('SELECT COUNT(*) AS count FROM setup_invitations').first<{ count: number }>();
    expect(count?.count).toBe(0);
  });

  it('rejects by actor identity before creating an invitation', async () => {
    const { cookie } = await adminCookie();
    vi.spyOn(env.RATE_LIMITER_IDENTITY, 'limit').mockResolvedValueOnce({ success: false });

    const result = await invoke(inviteAction, '/admin/users/invite', {
      cookie,
      body: { email: 'blocked@example.com', displayName: 'Blocked', role: 'member' },
    });

    expect(statusOf(result)).toBe(429);
    const count = await env.DB.prepare('SELECT COUNT(*) AS count FROM setup_invitations').first<{ count: number }>();
    expect(count?.count).toBe(0);
  });

  it('rejects every guarded mutation by identity without changing target state', async () => {
    const { userId, cookie } = await adminCookie();
    const target = await createTestUser({ email: 'target@example.com' });
    await createInvitation(testEnv({ APP_ORIGIN: 'https://app.example' }), userId, {
      email: 'guarded-invite@example.com',
      displayName: 'Guarded',
      role: 'member',
    });
    const invitation = await env.DB.prepare('SELECT id FROM setup_invitations WHERE email = ?')
      .bind('guarded-invite@example.com')
      .first<{ id: string }>();
    if (!invitation) throw new Error('invitation missing');

    const cases = [
      {
        name: 'disable',
        action: disableAction,
        path: `/admin/users/${target}/disable`,
        params: { userId: target },
        body: {},
      },
      {
        name: 'enable',
        action: enableAction,
        path: `/admin/users/${target}/enable`,
        params: { userId: target },
        body: {},
      },
      {
        name: 'role',
        action: roleAction,
        path: `/admin/users/${target}/role`,
        params: { userId: target },
        body: { role: 'admin' },
      },
      {
        name: 'revoke',
        action: revokeAction,
        path: `/admin/users/${target}/revoke`,
        params: { userId: target },
        body: {},
      },
      {
        name: 'revoke invitation',
        action: revokeInvitationAction,
        path: `/admin/users/invitations/${invitation.id}/revoke`,
        params: { invitationId: invitation.id },
        body: {},
      },
    ];

    for (const item of cases) {
      vi.spyOn(env.RATE_LIMITER_IDENTITY, 'limit').mockResolvedValueOnce({ success: false });
      const result = await invoke(item.action, item.path, {
        cookie,
        params: item.params,
        body: item.body,
      });
      expect(statusOf(result), item.name).toBe(429);
      expect(headersOf(result).get('retry-after'), item.name).toBe('60');
      expect(headersOf(result).get('cache-control'), item.name).toBe('no-store');
    }

    const user = await env.DB.prepare('SELECT role, status, session_version FROM users WHERE id = ?')
      .bind(target)
      .first<{ role: string; status: string; session_version: number }>();
    expect(user).toEqual({ role: 'member', status: 'active', session_version: 0 });
    const invitationRow = await env.DB.prepare('SELECT consumed_at FROM setup_invitations WHERE id = ?')
      .bind(invitation.id)
      .first<{ consumed_at: number | null }>();
    expect(invitationRow?.consumed_at).toBeNull();
  });

  it('creates an invitation within both limits', async () => {
    const { cookie } = await adminCookie();

    const result = await invoke(inviteAction, '/admin/users/invite', {
      cookie,
      body: { email: 'allowed@example.com', displayName: 'Allowed', role: 'member' },
    });

    expect(statusOf(result)).toBe(200);
    const count = await env.DB.prepare('SELECT COUNT(*) AS count FROM setup_invitations').first<{ count: number }>();
    expect(count?.count).toBe(1);
  });
});

describe('pending invitation revoke', () => {
  it('revokes once, audits the invitation id, and rejects repeats', async () => {
    const { userId, cookie } = await adminCookie();
    await createInvitation(testEnv({ APP_ORIGIN: 'https://app.example' }), userId, {
      email: 'pending@example.com',
      displayName: 'Pending',
      role: 'member',
    });
    const invitation = await env.DB.prepare('SELECT id FROM setup_invitations WHERE email = ?')
      .bind('pending@example.com')
      .first<{ id: string }>();
    if (!invitation) throw new Error('invitation missing');

    const result = await invoke(revokeInvitationAction, `/admin/users/invitations/${invitation.id}/revoke`, {
      cookie,
      params: { invitationId: invitation.id },
    });
    expect(statusOf(result)).toBe(200);

    const row = await env.DB.prepare('SELECT consumed_at FROM setup_invitations WHERE id = ?')
      .bind(invitation.id)
      .first<{ consumed_at: number | null }>();
    expect(row?.consumed_at).not.toBeNull();
    const audit = await env.DB.prepare(
      "SELECT type, user_id, metadata FROM audit_events WHERE type = 'admin.invitation_revoked'",
    ).first<{
      type: string;
      user_id: string;
      metadata: string;
    }>();
    expect(audit).toMatchObject({ type: 'admin.invitation_revoked', user_id: userId });
    expect(JSON.parse(audit!.metadata)).toEqual({ invitationId: invitation.id });

    const repeat = await invoke(revokeInvitationAction, `/admin/users/invitations/${invitation.id}/revoke`, {
      cookie,
      params: { invitationId: invitation.id },
    });
    expect(statusOf(repeat)).toBe(404);
  });

  it('allows re-inviting the same email after revocation', async () => {
    const { userId, cookie } = await adminCookie();
    await createInvitation(testEnv({ APP_ORIGIN: 'https://app.example' }), userId, {
      email: 'reinvite@example.com',
      displayName: 'Reinvite',
      role: 'member',
    });
    const first = await env.DB.prepare('SELECT id, token_hash FROM setup_invitations WHERE email = ?')
      .bind('reinvite@example.com')
      .first<{ id: string; token_hash: string }>();
    if (!first) throw new Error('invitation missing');

    const revoked = await invoke(revokeInvitationAction, `/admin/users/invitations/${first.id}/revoke`, {
      cookie,
      params: { invitationId: first.id },
    });
    expect(statusOf(revoked)).toBe(200);

    const reinvited = await invoke(inviteAction, '/admin/users/invite', {
      cookie,
      body: { email: 'reinvite@example.com', displayName: 'Reinvite Again', role: 'member' },
    });
    expect(statusOf(reinvited)).toBe(200);
    const second = await env.DB.prepare('SELECT id, token_hash, consumed_at FROM setup_invitations WHERE email = ?')
      .bind('reinvite@example.com')
      .first<{ id: string; token_hash: string; consumed_at: number | null }>();
    expect(second?.id).toBe(first.id);
    expect(second?.token_hash).not.toBe(first.token_hash);
    expect(second?.consumed_at).toBeNull();
  });

  it('returns 404 for an unknown invitation', async () => {
    const { cookie } = await adminCookie();
    const id = crypto.randomUUID();
    const result = await invoke(revokeInvitationAction, `/admin/users/invitations/${id}/revoke`, {
      cookie,
      params: { invitationId: id },
    });
    expect(statusOf(result)).toBe(404);
  });
});
