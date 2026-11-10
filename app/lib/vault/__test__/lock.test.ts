import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { generateSetupKeyMaterial } from '../../crypto/setup-keys';
import { storeKeyMaterial } from '../key-material';
import { clearVaultKey, isUnlocked } from '../key-store';
import { clearUnlockFailures, lockVault, unlockVault } from '../lock';
import { closeVaultDb, openVaultDb, wipeVaultDb } from '../local-db';

beforeEach(async () => {
  clearVaultKey();
  clearUnlockFailures();
  const values = new Map<string, string>();
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
  await closeVaultDb();
  await wipeVaultDb();
});

afterEach(() => {
  clearVaultKey();
  vi.unstubAllGlobals();
});

describe('vault lock lifetime', () => {
  it('unlocks locally without a network call and locks without clearing ciphertext', async () => {
    const setup = await generateSetupKeyMaterial('correct horse battery staple');
    await storeKeyMaterial('a@example.com', {
      vaultKeyWrapped: setup.vaultKeyWrapped,
      vaultKeyWrapIv: setup.vaultKeyWrapIv,
      kdfSalt: setup.kdfSalt,
      kdfIterations: setup.kdfIterations,
    });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    expect(isUnlocked()).toBe(false);
    expect(await unlockVault('correct horse battery staple')).toEqual({ status: 'ok' });
    expect(isUnlocked()).toBe(true);
    const active = await (await openVaultDb()).get('keys', 'active');
    expect(active).not.toHaveProperty('vaultKey');
    expect(fetchMock).not.toHaveBeenCalled();

    lockVault();
    expect(isUnlocked()).toBe(false);
    expect(await unlockVault('correct horse battery staple')).toEqual({ status: 'ok' });

    const db = await openVaultDb();
    await db.put('items', {
      id: 'ciphertext-item',
      type: 'login',
      folderId: null,
      favorite: false,
      dataCt: 'Y3Q=',
      dataIv: 'aXY=',
      dataVersion: 1,
      rev: 1,
      deletedAt: null,
      createdAt: 1,
      updatedAt: 1,
    });
    lockVault();
    expect(await db.get('items', 'ciphertext-item')).toMatchObject({ dataCt: 'Y3Q=' });
    expect(await unlockVault('')).toEqual({ status: 'invalid' });
  });

  it('rejects a wrong password and stays locked', async () => {
    const setup = await generateSetupKeyMaterial('correct horse battery staple');
    await storeKeyMaterial('a@example.com', {
      vaultKeyWrapped: setup.vaultKeyWrapped,
      vaultKeyWrapIv: setup.vaultKeyWrapIv,
      kdfSalt: setup.kdfSalt,
      kdfIterations: setup.kdfIterations,
    });

    expect(await unlockVault('wrong password')).toEqual({ status: 'invalid' });
    expect(isUnlocked()).toBe(false);
  });

  it('returns unavailable when no cached material exists', async () => {
    expect(await unlockVault('anything')).toEqual({ status: 'unavailable' });
    expect(isUnlocked()).toBe(false);
  });

  it('does not install a key when logout clears during an in-flight unlock', async () => {
    const setup = await generateSetupKeyMaterial('correct horse battery staple');
    await storeKeyMaterial('a@example.com', {
      vaultKeyWrapped: setup.vaultKeyWrapped,
      vaultKeyWrapIv: setup.vaultKeyWrapIv,
      kdfSalt: setup.kdfSalt,
      kdfIterations: setup.kdfIterations,
    });

    const pending = unlockVault('correct horse battery staple');
    lockVault();
    expect(await pending).toEqual({ status: 'unavailable' });
    expect(isUnlocked()).toBe(false);
  });

  it('forces locked-out after five wrong attempts until the failure counter is cleared', async () => {
    const setup = await generateSetupKeyMaterial('correct horse battery staple');
    await storeKeyMaterial('a@example.com', {
      vaultKeyWrapped: setup.vaultKeyWrapped,
      vaultKeyWrapIv: setup.vaultKeyWrapIv,
      kdfSalt: setup.kdfSalt,
      kdfIterations: setup.kdfIterations,
    });

    for (let attempt = 1; attempt < 5; attempt += 1) {
      expect(await unlockVault('wrong password')).toEqual({ status: 'invalid' });
    }
    expect(await unlockVault('wrong password')).toEqual({ status: 'locked-out' });
    expect(await unlockVault('correct horse battery staple')).toEqual({ status: 'locked-out' });

    clearUnlockFailures();
    expect(await unlockVault('correct horse battery staple')).toEqual({ status: 'ok' });
  });

  it('reports corrupted cached material as unavailable, not a wrong password', async () => {
    const setup = await generateSetupKeyMaterial('correct horse battery staple');
    await storeKeyMaterial('a@example.com', {
      vaultKeyWrapped: 'not-base64!',
      vaultKeyWrapIv: setup.vaultKeyWrapIv,
      kdfSalt: setup.kdfSalt,
      kdfIterations: setup.kdfIterations,
    });

    expect(await unlockVault('correct horse battery staple')).toEqual({ status: 'unavailable' });
  });
});
