import { env } from 'cloudflare:workers';
import { RouterContextProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { testEnv } from '../../__test__/auth-fixtures';
import { createTestUser } from '../../__test__/fixtures';
import { resetDatabase } from '../../__test__/reset-database';
import { toBase64Url } from '../../lib/base64-url';
import { cloudflareContext } from '../../lib/.server/context';
import { MAX_ITEM_CIPHERTEXT_BYTES } from '../../lib/vault/limits';
import { createSession, destroySessionToken, type CreatedSession } from '../../lib/.server/session';
import { action as createAction } from '../api.vault.items';
import { action as updateAction } from '../api.vault.items.$id';
import { action as purgeAction } from '../api.vault.items.$id.purge';
import { action as restoreAction } from '../api.vault.items.$id.restore';
import { loader as syncLoader } from '../api.vault';

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

const cookieFor = async (userId: string) => {
  const session = await createSession(testEnv(), { userId });
  sessions.push(session);
  return `bw_session=${session.token}`;
};

const itemBody = (overrides: Record<string, unknown> = {}) => ({
  type: 'login',
  folderId: null,
  favorite: false,
  dataCt: toBase64Url(new Uint8Array([1, 2, 3])),
  dataIv: toBase64Url(new Uint8Array(12).fill(4)),
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
  vi.spyOn(env.RATE_LIMITER_IDENTITY, 'limit').mockResolvedValue({ success: true });
  await resetDatabase();
  sessions.length = 0;
});

afterEach(async () => {
  await Promise.all(sessions.map((session) => destroySessionToken(env, session.token).catch(() => undefined)));
  sessions.length = 0;
});

describe('vault sync route', () => {
  it('requires authentication and rejects malformed cursors', async () => {
    expect(statusOf(await invoke(syncLoader, '/api/vault'))).toBe(401);

    const userId = await createTestUser();
    const cookie = await cookieFor(userId);
    expect(statusOf(await invoke(syncLoader, '/api/vault?cursor=bad', { cookie }))).toBe(400);
    expect(statusOf(await invoke(syncLoader, '/api/vault?since=-1', { cookie }))).toBe(400);
  });

  it('returns only the session user rows and a resumable delta', async () => {
    const owner = await createTestUser();
    const other = await createTestUser();
    const cookie = await cookieFor(owner);
    const created = await invoke(createAction, '/api/vault/items', {
      method: 'POST',
      cookie,
      body: itemBody(),
    });
    expect(statusOf(created)).toBe(201);

    const sync = await invoke(syncLoader, '/api/vault?since=0', { cookie });
    expect(statusOf(sync)).toBe(200);
    const body = sync.data as { items: unknown[]; folders: unknown[]; serverRev: number };
    expect(body.items).toHaveLength(1);
    expect(body.folders).toHaveLength(0);
    expect(body.serverRev).toBe(1);
    expect(headersOf(sync).get('cache-control')).toBe('no-store');

    const empty = await invoke(syncLoader, `/api/vault?since=${body.serverRev}`, { cookie });
    expect((empty.data as { items: unknown[] }).items).toHaveLength(0);

    const otherCookie = await cookieFor(other);
    const otherSync = await invoke(syncLoader, '/api/vault?since=0', { cookie: otherCookie });
    expect((otherSync.data as { items: unknown[] }).items).toHaveLength(0);
  });

  it('paginates through the loader with a cursor and a consistent serverRev', async () => {
    const userId = await createTestUser();
    const cookie = await cookieFor(userId);
    await env.DB.prepare(
      `WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 501)
       INSERT INTO vault_items (id, user_id, type, favorite, data_ct, data_iv, data_version, rev, created_at, updated_at)
       SELECT 'item-' || n, ?, 'login', 0, 'Y3Q=', 'aXY=', 1, n, 1, 1 FROM seq`,
    )
      .bind(userId)
      .run();
    await env.DB.prepare('UPDATE users SET vault_rev = 501 WHERE id = ?').bind(userId).run();

    const first = await invoke(syncLoader, '/api/vault?since=0', { cookie });
    const firstBody = first.data as { items: unknown[]; serverRev: number; nextCursor?: string };
    expect(firstBody.items).toHaveLength(500);
    expect(firstBody.serverRev).toBe(501);
    expect(firstBody.nextCursor).toBeDefined();

    const second = await invoke(
      syncLoader,
      `/api/vault?since=${firstBody.serverRev}&cursor=${encodeURIComponent(firstBody.nextCursor!)}`,
      { cookie },
    );
    const secondBody = second.data as { items: unknown[] };
    expect(statusOf(second)).toBe(200);
    expect(secondBody.items).toHaveLength(1);
  });

  it('does not return another user folder rows', async () => {
    const owner = await createTestUser();
    const other = await createTestUser();
    const cookie = await cookieFor(owner);
    await env.DB.prepare(
      `INSERT INTO folders (id, user_id, name_ct, name_iv, data_version, rev, created_at, updated_at)
       VALUES ('folder-other', ?, 'bmFtZQ==', 'aXY=', 1, 1, 1, 1)`,
    )
      .bind(other)
      .run();

    const sync = await invoke(syncLoader, '/api/vault?since=0', { cookie });
    expect((sync.data as { folders: unknown[] }).folders).toHaveLength(0);
  });
});

describe('vault item create route', () => {
  it('rate limits authenticated mutations', async () => {
    const userId = await createTestUser();
    const cookie = await cookieFor(userId);
    vi.spyOn(env.RATE_LIMITER_IP, 'limit').mockResolvedValueOnce({ success: false });

    const result = await invoke(createAction, '/api/vault/items', {
      method: 'POST',
      cookie,
      body: itemBody(),
    });
    expect(statusOf(result)).toBe(429);
    expect(headersOf(result).get('retry-after')).toBeTruthy();
  });

  it('rate limits authenticated creates by identity', async () => {
    const userId = await createTestUser();
    const cookie = await cookieFor(userId);
    vi.spyOn(env.RATE_LIMITER_IDENTITY, 'limit').mockResolvedValueOnce({ success: false });

    const result = await invoke(createAction, '/api/vault/items', {
      method: 'POST',
      cookie,
      body: itemBody(),
    });
    expect(statusOf(result)).toBe(429);
  });

  it('creates an item, rejects body user_id, and enforces payload limits', async () => {
    const userId = await createTestUser();
    const cookie = await cookieFor(userId);

    const created = await invoke(createAction, '/api/vault/items', {
      method: 'POST',
      cookie,
      body: itemBody(),
    });
    expect(statusOf(created)).toBe(201);
    const item = (created.data as { item: { rev: number; dataCt: string } }).item;
    expect(item.rev).toBe(1);
    expect(item.dataCt).toBe(toBase64Url(new Uint8Array([1, 2, 3])));
    expect(Object.keys(item).sort()).toEqual([
      'createdAt',
      'dataCt',
      'dataIv',
      'dataVersion',
      'deletedAt',
      'favorite',
      'folderId',
      'id',
      'rev',
      'type',
      'updatedAt',
    ]);

    expect(
      statusOf(
        await invoke(createAction, '/api/vault/items', {
          method: 'POST',
          cookie,
          body: itemBody({ user_id: userId }),
        }),
      ),
    ).toBe(400);

    expect(
      statusOf(
        await invoke(createAction, '/api/vault/items', {
          method: 'POST',
          cookie,
          body: itemBody({ dataIv: toBase64Url(new Uint8Array(11)) }),
        }),
      ),
    ).toBe(400);

    expect(
      statusOf(
        await invoke(createAction, '/api/vault/items', {
          method: 'POST',
          cookie,
          body: itemBody({ dataCt: toBase64Url(new Uint8Array(MAX_ITEM_CIPHERTEXT_BYTES + 1)) }),
        }),
      ),
    ).toBe(400);

    const oversize = await invoke(createAction, '/api/vault/items', {
      method: 'POST',
      cookie,
      body: itemBody(),
      headers: { 'content-length': '300000' },
    });
    expect(statusOf(oversize)).toBe(413);

    expect(
      statusOf(
        await invoke(createAction, '/api/vault/items', {
          method: 'POST',
          cookie,
          body: { ...itemBody(), padding: 'x'.repeat(270_000) },
        }),
      ),
    ).toBe(413);

    for (const invalid of [itemBody({ dataCt: '!!!!' }), itemBody({ type: 'other' }), itemBody({ dataVersion: 0 })]) {
      expect(statusOf(await invoke(createAction, '/api/vault/items', { method: 'POST', cookie, body: invalid }))).toBe(
        400,
      );
    }

    const exact = await invoke(createAction, '/api/vault/items', {
      method: 'POST',
      cookie,
      body: itemBody({ dataCt: toBase64Url(new Uint8Array(MAX_ITEM_CIPHERTEXT_BYTES)) }),
    });
    expect(statusOf(exact)).toBe(201);
  });

  it('accepts client ids, replays an owned id without a revision, and hides foreign collisions', async () => {
    const userId = await createTestUser();
    const other = await createTestUser();
    const cookie = await cookieFor(userId);
    const otherCookie = await cookieFor(other);
    const id = crypto.randomUUID();

    const created = await invoke(createAction, '/api/vault/items', {
      method: 'POST',
      cookie,
      body: itemBody({ id }),
    });
    expect(statusOf(created)).toBe(201);
    expect((created.data as { item: { id: string; rev: number } }).item).toMatchObject({ id, rev: 1 });

    const replay = await invoke(createAction, '/api/vault/items', {
      method: 'POST',
      cookie,
      body: itemBody({ id }),
    });
    expect(statusOf(replay)).toBe(200);
    expect((replay.data as { item: { id: string; rev: number } }).item).toMatchObject({ id, rev: 1 });

    const sync = await invoke(syncLoader, '/api/vault?since=0', { cookie });
    expect((sync.data as { serverRev: number }).serverRev).toBe(1);

    await invoke(updateAction, `/api/vault/items/${id}`, {
      method: 'DELETE',
      cookie,
      params: { id },
    });
    const tombstonedReplay = await invoke(createAction, '/api/vault/items', {
      method: 'POST',
      cookie,
      body: itemBody({ id }),
    });
    expect(statusOf(tombstonedReplay)).toBe(409);

    const foreign = await invoke(createAction, '/api/vault/items', {
      method: 'POST',
      cookie: otherCookie,
      body: itemBody({ id }),
    });
    expect(statusOf(foreign)).toBe(404);
    expect((foreign.data as { item?: unknown }).item).toBeUndefined();

    const invalid = await invoke(createAction, '/api/vault/items', {
      method: 'POST',
      cookie,
      body: itemBody({ id: 'not-a-uuid' }),
    });
    expect(statusOf(invalid)).toBe(400);
  });

  it('rejects unauthenticated and unsupported methods before parsing a body', async () => {
    const userId = await createTestUser();
    const cookie = await cookieFor(userId);

    expect(statusOf(await invoke(createAction, '/api/vault/items', { method: 'POST', body: {} }))).toBe(401);
    expect(
      statusOf(await invoke(createAction, '/api/vault/items', { method: 'PATCH', cookie, body: itemBody() })),
    ).toBe(405);
  });

  it('returns 404 for a folder owned by another user', async () => {
    const owner = await createTestUser();
    const other = await createTestUser();
    const cookie = await cookieFor(owner);
    await env.DB.prepare(
      `INSERT INTO folders (id, user_id, name_ct, name_iv, data_version, rev, created_at, updated_at)
       VALUES ('foreign-folder', ?, 'bmFtZQ==', 'aXY=', 1, 1, 1, 1)`,
    )
      .bind(other)
      .run();

    const result = await invoke(createAction, '/api/vault/items', {
      method: 'POST',
      cookie,
      body: itemBody({ folderId: 'foreign-folder' }),
    });
    expect(statusOf(result)).toBe(404);
  });
});

describe('vault item update route', () => {
  it('updates with the current rev, returns the current row on conflict, and hides foreign items', async () => {
    const userId = await createTestUser();
    const other = await createTestUser();
    const cookie = await cookieFor(userId);
    const created = await invoke(createAction, '/api/vault/items', {
      method: 'POST',
      cookie,
      body: itemBody(),
    });
    const item = (created.data as { item: { id: string; rev: number } }).item;

    const updated = await invoke(updateAction, `/api/vault/items/${item.id}`, {
      method: 'PATCH',
      cookie,
      params: { id: item.id },
      body: itemBody({ favorite: true, rev: item.rev }),
    });
    expect(statusOf(updated)).toBe(200);
    expect((updated.data as { item: { rev: number } }).item.rev).toBe(2);

    const conflict = await invoke(updateAction, `/api/vault/items/${item.id}`, {
      method: 'PATCH',
      cookie,
      params: { id: item.id },
      body: itemBody({ favorite: false, rev: item.rev }),
    });
    expect(statusOf(conflict)).toBe(409);
    expect((conflict.data as { item: { rev: number } }).item.rev).toBe(2);

    const otherCookie = await cookieFor(other);
    const foreign = await invoke(updateAction, `/api/vault/items/${item.id}`, {
      method: 'PATCH',
      cookie: otherCookie,
      params: { id: item.id },
      body: itemBody({ rev: 1 }),
    });
    expect(statusOf(foreign)).toBe(404);

    expect(
      statusOf(
        await invoke(updateAction, `/api/vault/items/${item.id}`, {
          method: 'PATCH',
          params: { id: item.id },
          body: itemBody({ rev: 1 }),
        }),
      ),
    ).toBe(401);
    expect(
      statusOf(
        await invoke(updateAction, `/api/vault/items/${item.id}`, {
          method: 'POST',
          cookie,
          params: { id: item.id },
          body: itemBody({ rev: 2 }),
        }),
      ),
    ).toBe(405);
    expect(
      statusOf(
        await invoke(updateAction, `/api/vault/items/${item.id}`, {
          method: 'PATCH',
          cookie,
          params: { id: item.id },
          body: { type: 'login' },
        }),
      ),
    ).toBe(400);
  });
});

describe('vault trash routes', () => {
  const makeItem = async (cookie: string) => {
    const created = await invoke(createAction, '/api/vault/items', {
      method: 'POST',
      cookie,
      body: itemBody(),
    });
    return (created.data as { item: { id: string; rev: number } }).item;
  };

  it('deletes, lists a tombstone, restores, and purges', async () => {
    const userId = await createTestUser();
    const cookie = await cookieFor(userId);
    const item = await makeItem(cookie);

    expect(
      statusOf(
        await invoke(updateAction, `/api/vault/items/${item.id}`, {
          method: 'DELETE',
          params: { id: item.id },
        }),
      ),
    ).toBe(401);

    const deleted = await invoke(updateAction, `/api/vault/items/${item.id}`, {
      method: 'DELETE',
      cookie,
      params: { id: item.id },
    });
    expect(statusOf(deleted)).toBe(200);
    expect((deleted.data as { item: { deletedAt: number | null } }).item.deletedAt).not.toBeNull();
    expect(headersOf(deleted).get('cache-control')).toBe('no-store');

    const sync = await invoke(syncLoader, '/api/vault?since=0', { cookie });
    expect(
      (sync.data as { items: Array<{ id: string; deletedAt: number | null }> }).items.find((row) => row.id === item.id)
        ?.deletedAt,
    ).not.toBeNull();

    const restored = await invoke(restoreAction, `/api/vault/items/${item.id}/restore`, {
      method: 'POST',
      cookie,
      params: { id: item.id },
      body: {},
    });
    expect(statusOf(restored)).toBe(200);
    expect((restored.data as { item: { deletedAt: number | null } }).item.deletedAt).toBeNull();

    await invoke(updateAction, `/api/vault/items/${item.id}`, {
      method: 'DELETE',
      cookie,
      params: { id: item.id },
    });
    expect(
      statusOf(
        await invoke(purgeAction, `/api/vault/items/${item.id}/purge`, {
          method: 'POST',
          cookie,
          params: { id: item.id },
          body: { confirm: false },
        }),
      ),
    ).toBe(400);
    expect(
      statusOf(
        await invoke(purgeAction, `/api/vault/items/${item.id}/purge`, {
          method: 'POST',
          cookie,
          params: { id: item.id },
          body: { confirm: true },
        }),
      ),
    ).toBe(200);
    const audit = await env.DB.prepare("SELECT type FROM audit_events WHERE type = 'item.purged'").first<{
      type: string;
    }>();
    expect(audit).toEqual({ type: 'item.purged' });
    expect(
      statusOf(
        await invoke(purgeAction, `/api/vault/items/${item.id}/purge`, {
          method: 'POST',
          cookie,
          params: { id: item.id },
          body: { confirm: true },
        }),
      ),
    ).toBe(200);
    const count = await env.DB.prepare("SELECT COUNT(*) AS count FROM audit_events WHERE type = 'item.purged'").first<{
      count: number;
    }>();
    expect(count?.count).toBe(1);
  });

  it('rejects foreign origins, foreign items, and unsupported methods', async () => {
    const userId = await createTestUser();
    const other = await createTestUser();
    const cookie = await cookieFor(userId);
    const otherCookie = await cookieFor(other);
    const item = await makeItem(cookie);

    expect(
      statusOf(
        await invoke(updateAction, `/api/vault/items/${item.id}`, {
          method: 'DELETE',
          cookie,
          params: { id: item.id },
          headers: { origin: 'https://evil.example' },
        }),
      ),
    ).toBe(403);

    expect(
      statusOf(
        await invoke(updateAction, `/api/vault/items/${item.id}`, {
          method: 'DELETE',
          cookie: otherCookie,
          params: { id: item.id },
        }),
      ),
    ).toBe(404);

    expect(
      statusOf(
        await invoke(restoreAction, `/api/vault/items/${item.id}/restore`, {
          method: 'PATCH',
          cookie,
          params: { id: item.id },
          body: {},
        }),
      ),
    ).toBe(405);

    expect(
      statusOf(
        await invoke(purgeAction, `/api/vault/items/${item.id}/purge`, {
          method: 'POST',
          cookie,
          params: { id: item.id },
          body: { confirm: true },
          headers: { origin: 'https://evil.example' },
        }),
      ),
    ).toBe(403);
    expect(
      statusOf(
        await invoke(restoreAction, `/api/vault/items/${item.id}/restore`, {
          method: 'POST',
          cookie,
          params: { id: item.id },
          body: {},
          headers: { origin: 'https://evil.example' },
        }),
      ),
    ).toBe(403);

    await invoke(updateAction, `/api/vault/items/${item.id}`, {
      method: 'DELETE',
      cookie,
      params: { id: item.id },
    });
    expect(
      statusOf(
        await invoke(purgeAction, `/api/vault/items/${item.id}/purge`, {
          method: 'PATCH',
          cookie,
          params: { id: item.id },
          body: { confirm: true },
        }),
      ),
    ).toBe(405);
    expect(
      statusOf(
        await invoke(restoreAction, `/api/vault/items/${item.id}/restore`, {
          method: 'POST',
          params: { id: item.id },
          body: {},
        }),
      ),
    ).toBe(401);
  });
});
