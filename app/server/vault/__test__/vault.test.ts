import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import { createTestUser } from '../../../__test__/fixtures';
import { testEnv } from '../../../__test__/auth-fixtures';
import { resetDatabase } from '../../../__test__/reset-database';
import { encodeBase64 } from '../../../lib/crypto/encoding';
import { decodeVaultCursor, encodeVaultCursor } from '../cursor';
import { createVaultItem, updateVaultItem } from '../items';
import { findOwnedItem } from '../queries/items';
import { findVaultRev, incrementVaultRev } from '../queries/rev';
import { listVaultDelta } from '../queries/sync';
import { readVaultDelta } from '../sync';
import type { VaultItemInput } from '../types';

const itemInput = (overrides: Partial<VaultItemInput> = {}): VaultItemInput => ({
  type: 'login',
  folderId: null,
  favorite: false,
  dataCt: encodeBase64(new Uint8Array([1, 2, 3])),
  dataIv: encodeBase64(new Uint8Array(12).fill(2)),
  dataVersion: 1,
  ...overrides,
});

beforeEach(async () => {
  await resetDatabase();
});

describe('vault queries', () => {
  it('allocates revisions and rolls back the allocation when the batch fails', async () => {
    const userId = await createTestUser();
    expect((await findVaultRev(env.DB, userId))?.vault_rev).toBe(0);

    await expect(
      env.DB.batch([
        incrementVaultRev(env.DB, userId, Date.now()),
        env.DB.prepare(
          `INSERT INTO vault_items (id, user_id, type, favorite, data_ct, data_iv, data_version, rev, created_at, updated_at)
           VALUES (?, ?, 'invalid-type', 0, 'ct', 'iv', 1, 1, 1, 1)`,
        ).bind(crypto.randomUUID(), userId),
      ]),
    ).rejects.toThrow();
    expect((await findVaultRev(env.DB, userId))?.vault_rev).toBe(0);

    await incrementVaultRev(env.DB, userId, Date.now()).run();
    expect((await findVaultRev(env.DB, userId))?.vault_rev).toBe(1);
  });

  it('paginates the ordered item/folder delta and resumes from the cursor', async () => {
    const userId = await createTestUser();
    await env.DB.prepare(
      `WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 501)
       INSERT INTO vault_items (id, user_id, type, favorite, data_ct, data_iv, data_version, rev, created_at, updated_at)
       SELECT 'item-' || n, ?, 'login', 0, 'Y3Q=', 'aXY=', 1, n, 1, 1 FROM seq`,
    )
      .bind(userId)
      .run();
    await env.DB.prepare('UPDATE users SET vault_rev = 501 WHERE id = ?').bind(userId).run();
    await env.DB.prepare(
      `INSERT INTO folders (id, user_id, name_ct, name_iv, data_version, rev, created_at, updated_at)
       VALUES ('folder-1', ?, 'bmFtZQ==', 'aXY=', 1, 500, 1, 1)`,
    )
      .bind(userId)
      .run();

    const rows = await listVaultDelta(env.DB, userId, 0, null);
    expect(rows).toHaveLength(501);

    const first = await readVaultDelta(testEnv(), userId, 0, null);
    expect(first.status).toBe('ok');
    if (first.status !== 'ok') throw new Error('expected delta');
    expect(first.items).toHaveLength(499);
    expect(first.folders).toHaveLength(1);
    expect(first.folders[0]).toMatchObject({ nameCt: 'bmFtZQ', nameIv: 'aXY' });
    expect(first.nextCursor).toBeDefined();

    const cursor = decodeVaultCursor(first.nextCursor!);
    expect(cursor).not.toBeNull();
    const second = await readVaultDelta(testEnv(), userId, 0, cursor);
    expect(second.status).toBe('ok');
    if (second.status !== 'ok') throw new Error('expected delta');
    expect(second.folders).toHaveLength(0);
    expect(second.items).toHaveLength(2);
  });

  it('returns tombstones once after the watermark', async () => {
    const userId = await createTestUser();
    await env.DB.prepare(
      `INSERT INTO vault_items (id, user_id, type, favorite, data_ct, data_iv, data_version, rev, deleted_at, created_at, updated_at)
       VALUES ('tombstone', ?, 'login', 0, 'Y3Q=', 'aXY=', 1, 1, 2, 1, 1)`,
    )
      .bind(userId)
      .run();
    await env.DB.prepare('UPDATE users SET vault_rev = 1 WHERE id = ?').bind(userId).run();

    const delta = await readVaultDelta(testEnv(), userId, 0, null);
    expect(delta.status).toBe('ok');
    if (delta.status !== 'ok') throw new Error('expected delta');
    expect(delta.items).toEqual([expect.objectContaining({ id: 'tombstone', deletedAt: 2 })]);
  });

  it('encodes opaque cursors and rejects malformed values', () => {
    const cursor = { rev: 42, id: 'item-1' };
    expect(decodeVaultCursor(encodeVaultCursor(cursor))).toEqual(cursor);
    expect(decodeVaultCursor('not-a-cursor')).toBeNull();
    expect(decodeVaultCursor('')).toBeNull();
  });
});

describe('vault item use cases', () => {
  it('creates an item with a new revision and updates it only with the current revision', async () => {
    const userId = await createTestUser();
    const created = await createVaultItem(testEnv(), userId, itemInput());
    expect(created.status).toBe('created');
    if (created.status !== 'created') throw new Error('expected created');
    expect(created.item.rev).toBe(1);
    expect(created.item.dataCt).toBe('AQID');

    const updated = await updateVaultItem(testEnv(), userId, created.item.id, {
      ...itemInput({ favorite: true }),
      rev: created.item.rev,
    });
    expect(updated.status).toBe('ok');
    if (updated.status !== 'ok') throw new Error('expected update');
    expect(updated.item.favorite).toBe(true);
    expect(updated.item.rev).toBe(2);

    const revBeforeConflict = (await findVaultRev(env.DB, userId))?.vault_rev;
    const conflict = await updateVaultItem(testEnv(), userId, created.item.id, {
      ...itemInput({ favorite: false }),
      rev: created.item.rev,
    });
    expect(conflict.status).toBe('conflict');
    if (conflict.status !== 'conflict') throw new Error('expected conflict');
    expect(conflict.item.rev).toBe(2);
    expect((await findOwnedItem(env.DB, userId, created.item.id))?.favorite).toBe(1);
    expect((await findVaultRev(env.DB, userId))?.vault_rev).toBe(revBeforeConflict);

    const delta = await readVaultDelta(testEnv(), userId, created.item.rev, null);
    expect(delta.status).toBe('ok');
    if (delta.status === 'ok') {
      expect(delta.items).toEqual([expect.objectContaining({ id: created.item.id, rev: 2 })]);
    }
  });

  it('returns not-found for foreign items and folders', async () => {
    const owner = await createTestUser();
    const other = await createTestUser();
    const created = await createVaultItem(testEnv(), owner, itemInput());
    if (created.status !== 'created') throw new Error('fixture create failed');

    const revBeforeForeign = (await findVaultRev(env.DB, other))?.vault_rev;
    expect((await updateVaultItem(testEnv(), other, created.item.id, { ...itemInput(), rev: 1 })).status).toBe(
      'not-found',
    );
    expect((await findVaultRev(env.DB, other))?.vault_rev).toBe(revBeforeForeign);
    expect((await createVaultItem(testEnv(), other, itemInput({ folderId: 'missing' }))).status).toBe('not-found');
  });
});
