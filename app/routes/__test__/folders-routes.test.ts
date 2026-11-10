import { env } from 'cloudflare:workers';
import { RouterContextProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { testEnv } from '../../__test__/auth-fixtures';
import { createTestUser } from '../../__test__/fixtures';
import { resetDatabase } from '../../__test__/reset-database';
import { toBase64Url } from '../../lib/base64-url';
import { cloudflareContext } from '../../lib/.server/context';
import { createSession, destroySessionToken, type CreatedSession } from '../../lib/.server/session';
import { action as createAction, loader as listLoader } from '../api.folders';
import { action as folderAction } from '../api.folders.$id';

const context = new RouterContextProvider();
context.set(cloudflareContext, {
  env: testEnv({
    APP_ORIGIN: 'https://app.example',
    APP_ENV: 'production',
    RATE_LIMITER_IP: env.RATE_LIMITER_IP,
  }),
  ctx: {} as ExecutionContext,
});

type ActionResult = { data?: unknown; init?: { status?: number; headers?: HeadersInit } };
const sessions: CreatedSession[] = [];

const cookieFor = async (userId: string) => {
  const session = await createSession(testEnv(), { userId });
  sessions.push(session);
  return `bw_session=${session.token}`;
};

const folderBody = (overrides: Record<string, unknown> = {}) => ({
  nameCt: toBase64Url(new Uint8Array([1, 2, 3])),
  nameIv: toBase64Url(new Uint8Array(12).fill(4)),
  dataVersion: 1,
  ...overrides,
});

const invoke = async (
  fn: (args: never) => unknown,
  path: string,
  options: {
    method?: string;
    body?: unknown;
    cookie?: string;
    headers?: Record<string, string>;
    params?: Record<string, string>;
  } = {},
): Promise<ActionResult> => {
  const request = new Request(`https://app.example${path}`, {
    method: options.method ?? 'GET',
    headers: {
      origin: 'https://app.example',
      'content-type': 'application/json',
      'cf-connecting-ip': '203.0.113.9',
      ...(options.cookie ? { cookie: options.cookie } : {}),
      ...options.headers,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
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
  await resetDatabase();
  sessions.length = 0;
});

afterEach(async () => {
  await Promise.all(sessions.map((session) => destroySessionToken(env, session.token).catch(() => undefined)));
  sessions.length = 0;
});

describe('folder routes', () => {
  it('lists, creates, renames, and soft-deletes folders', async () => {
    const userId = await createTestUser();
    const cookie = await cookieFor(userId);

    expect(statusOf(await invoke(listLoader, '/api/folders'))).toBe(401);

    const created = await invoke(createAction, '/api/folders', { method: 'POST', cookie, body: folderBody() });
    expect(statusOf(created)).toBe(201);
    expect(headersOf(created).get('cache-control')).toBe('no-store');
    const folder = (created.data as { folder: { id: string; rev: number; deletedAt: number | null } }).folder;
    expect(folder.deletedAt).toBeNull();

    const listed = await invoke(listLoader, '/api/folders', { cookie });
    expect(statusOf(listed)).toBe(200);
    expect((listed.data as { folders: unknown[] }).folders).toHaveLength(1);

    const renamed = await invoke(folderAction, `/api/folders/${folder.id}`, {
      method: 'PATCH',
      cookie,
      params: { id: folder.id },
      body: { ...folderBody(), rev: folder.rev },
    });
    expect(statusOf(renamed)).toBe(200);
    expect((renamed.data as { folder: { rev: number } }).folder.rev).toBe(2);

    const stale = await invoke(folderAction, `/api/folders/${folder.id}`, {
      method: 'PATCH',
      cookie,
      params: { id: folder.id },
      body: { ...folderBody(), rev: folder.rev },
    });
    expect(statusOf(stale)).toBe(409);

    const deleted = await invoke(folderAction, `/api/folders/${folder.id}`, {
      method: 'DELETE',
      cookie,
      params: { id: folder.id },
    });
    expect(statusOf(deleted)).toBe(200);
    expect((deleted.data as { folder: { deletedAt: number | null } }).folder.deletedAt).not.toBeNull();
    expect(headersOf(deleted).get('cache-control')).toBe('no-store');

    const repeat = await invoke(folderAction, `/api/folders/${folder.id}`, {
      method: 'DELETE',
      cookie,
      params: { id: folder.id },
    });
    expect(statusOf(repeat)).toBe(200);

    const after = await invoke(listLoader, '/api/folders', { cookie });
    expect((after.data as { folders: unknown[] }).folders).toHaveLength(0);
  });

  it('rejects unauthenticated, malformed, foreign-origin, and cross-user requests', async () => {
    const userId = await createTestUser();
    const other = await createTestUser();
    const cookie = await cookieFor(userId);
    const otherCookie = await cookieFor(other);

    expect(statusOf(await invoke(createAction, '/api/folders', { method: 'POST', body: folderBody() }))).toBe(401);
    expect(
      statusOf(await invoke(createAction, '/api/folders', { method: 'POST', cookie, body: { nameCt: '!!!!' } })),
    ).toBe(400);
    expect(
      statusOf(
        await invoke(createAction, '/api/folders', {
          method: 'POST',
          cookie,
          body: { ...folderBody(), padding: 'x'.repeat(270_000) },
        }),
      ),
    ).toBe(413);
    expect(
      statusOf(
        await invoke(createAction, '/api/folders', {
          method: 'POST',
          cookie,
          body: folderBody(),
          headers: { origin: 'https://evil.example' },
        }),
      ),
    ).toBe(403);

    const created = await invoke(createAction, '/api/folders', { method: 'POST', cookie, body: folderBody() });
    const folder = (created.data as { folder: { id: string; rev: number } }).folder;
    expect(
      statusOf(
        await invoke(folderAction, `/api/folders/${folder.id}`, {
          method: 'PATCH',
          cookie: otherCookie,
          params: { id: folder.id },
          body: { ...folderBody(), rev: 1 },
        }),
      ),
    ).toBe(404);
    expect(
      statusOf(
        await invoke(folderAction, `/api/folders/${folder.id}`, {
          method: 'DELETE',
          cookie: otherCookie,
          params: { id: folder.id },
        }),
      ),
    ).toBe(404);
    expect(
      statusOf(
        await invoke(folderAction, `/api/folders/${folder.id}`, {
          method: 'DELETE',
          cookie,
          params: { id: folder.id },
          headers: { origin: 'https://evil.example' },
        }),
      ),
    ).toBe(403);
    expect(
      statusOf(
        await invoke(folderAction, `/api/folders/${folder.id}`, {
          method: 'PUT',
          cookie,
          params: { id: folder.id },
          body: folderBody(),
        }),
      ),
    ).toBe(405);
  });
});

describe('folder route edge cases', () => {
  it('rejects deleted-folder rename, missing auth, wrong methods, rate limits, and invalid fields', async () => {
    const userId = await createTestUser();
    const cookie = await cookieFor(userId);
    const created = await invoke(createAction, '/api/folders', { method: 'POST', cookie, body: folderBody() });
    const folder = (created.data as { folder: { id: string; rev: number } }).folder;

    await invoke(folderAction, `/api/folders/${folder.id}`, {
      method: 'DELETE',
      cookie,
      params: { id: folder.id },
    });
    expect(
      statusOf(
        await invoke(folderAction, `/api/folders/${folder.id}`, {
          method: 'PATCH',
          cookie,
          params: { id: folder.id },
          body: { ...folderBody(), rev: folder.rev },
        }),
      ),
    ).toBe(404);

    expect(
      statusOf(
        await invoke(folderAction, `/api/folders/${folder.id}`, {
          method: 'PATCH',
          params: { id: folder.id },
          body: { ...folderBody(), rev: 1 },
        }),
      ),
    ).toBe(401);
    expect(
      statusOf(
        await invoke(folderAction, `/api/folders/${folder.id}`, {
          method: 'DELETE',
          params: { id: folder.id },
        }),
      ),
    ).toBe(401);
    expect(
      statusOf(
        await invoke(folderAction, `/api/folders/${folder.id}`, {
          method: 'PUT',
          cookie,
          params: { id: folder.id },
          body: folderBody(),
        }),
      ),
    ).toBe(405);

    for (const invalid of [
      folderBody({ nameIv: toBase64Url(new Uint8Array(11)) }),
      folderBody({ user_id: userId }),
      folderBody({ nameCt: toBase64Url(new Uint8Array(4097)) }),
    ]) {
      expect(statusOf(await invoke(createAction, '/api/folders', { method: 'POST', cookie, body: invalid }))).toBe(400);
    }
    expect(
      statusOf(
        await invoke(createAction, '/api/folders', {
          method: 'POST',
          cookie,
          body: folderBody({ nameCt: toBase64Url(new Uint8Array(4096)) }),
        }),
      ),
    ).toBeLessThan(500);

    vi.spyOn(env.RATE_LIMITER_IP, 'limit').mockResolvedValueOnce({ success: false });
    const limited = await invoke(createAction, '/api/folders', { method: 'POST', cookie, body: folderBody() });
    expect(statusOf(limited)).toBe(429);
  });

  it('does not list another user folder', async () => {
    const owner = await createTestUser();
    const other = await createTestUser();
    const ownerCookie = await cookieFor(owner);
    const otherCookie = await cookieFor(other);
    await invoke(createAction, '/api/folders', { method: 'POST', cookie: otherCookie, body: folderBody() });

    const listed = await invoke(listLoader, '/api/folders', { cookie: ownerCookie });
    expect((listed.data as { folders: unknown[] }).folders).toHaveLength(0);
  });
});
