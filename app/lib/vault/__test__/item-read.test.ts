import 'fake-indexeddb/auto';

import { beforeEach, describe, expect, it } from 'vitest';

import { sealItem } from '../../crypto/envelope';
import { applyVaultDelta } from '../cache';
import { readVaultItem } from '../item-read';
import { clearVaultKey, setVaultKey } from '../key-store';
import { closeVaultDb, openVaultDb, wipeVaultDb } from '../local-db';
import { readVaultProjection } from '../projection';
import type { CachedItem } from '../types';

const key = () => crypto.getRandomValues(new Uint8Array(32));

const item = async (payload: unknown, type: 'login' | 'note', vaultKey: Uint8Array): Promise<CachedItem> => {
  const sealed = await sealItem(payload, vaultKey);
  return {
    id: crypto.randomUUID(),
    type,
    folderId: null,
    favorite: true,
    dataCt: sealed.ct,
    dataIv: sealed.iv,
    dataVersion: 1,
    rev: 1,
    deletedAt: null,
    createdAt: 1,
    updatedAt: 1,
  };
};

beforeEach(async () => {
  clearVaultKey();
  await closeVaultDb();
  await wipeVaultDb();
});

describe('readVaultItem', () => {
  it('returns the full login payload and leaves the projection reduced', async () => {
    const vaultKey = key();
    const row = await item(
      {
        type: 'login',
        name: 'Example',
        username: 'me@example.com',
        password: 'secret',
        totpSecret: 'JBSWY3DPEHPK3PXP',
        customFields: [{ label: 'PIN', value: '1234', hidden: true }],
      },
      'login',
      vaultKey,
    );
    await applyVaultDelta([row], []);
    setVaultKey(vaultKey);

    const result = await readVaultItem(row.id);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.item.payload).toMatchObject({
      password: 'secret',
      totpSecret: 'JBSWY3DPEHPK3PXP',
      customFields: [{ label: 'PIN', value: '1234', hidden: true }],
    });

    const projection = await readVaultProjection();
    expect(projection.items[0]).not.toHaveProperty('password');
    expect(projection.items[0]).not.toHaveProperty('totpSecret');
    expect(projection.items[0]).toMatchObject({ name: 'Example', username: 'me@example.com' });
  });

  it('returns a note payload', async () => {
    const vaultKey = key();
    const row = await item({ type: 'note', name: 'Note', body: 'body' }, 'note', vaultKey);
    await applyVaultDelta([row], []);
    setVaultKey(vaultKey);

    await expect(readVaultItem(row.id)).resolves.toMatchObject({
      status: 'ok',
      item: { type: 'note', payload: { body: 'body' } },
    });
  });

  it('reports locked, missing, and corrupt rows', async () => {
    const vaultKey = key();
    const row = await item({ type: 'login', name: 'Example' }, 'login', vaultKey);
    const corrupt = { ...row, dataCt: 'not-base64' };

    await expect(readVaultItem(row.id)).resolves.toEqual({ status: 'locked' });
    setVaultKey(vaultKey);
    await (await openVaultDb()).put('items', corrupt);
    await expect(readVaultItem('missing')).resolves.toEqual({ status: 'not-found' });
    await expect(readVaultItem(row.id)).resolves.toEqual({ status: 'invalid' });
  });
});
