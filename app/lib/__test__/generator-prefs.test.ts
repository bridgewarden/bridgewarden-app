import 'fake-indexeddb/auto';

import { deleteDB, openDB } from 'idb';
import { beforeEach, describe, expect, it } from 'vitest';

import { DEFAULT_GENERATOR_PREFERENCES } from '../generator';
import { getGeneratorPreferences, setGeneratorPreferences } from '../generator-prefs';
import { openVaultDb, VAULT_DB_NAME, wipeVaultDb } from '../vault/local-db';

beforeEach(async () => {
  await deleteDB(VAULT_DB_NAME);
});

describe('generator preferences', () => {
  it('returns defaults for a missing or corrupt record and round-trips valid options', async () => {
    expect(await getGeneratorPreferences()).toEqual(DEFAULT_GENERATOR_PREFERENCES);

    const preferences = {
      ...DEFAULT_GENERATOR_PREFERENCES,
      mode: 'passphrase' as const,
      passphrase: { mode: 'passphrase' as const, words: 5, separator: '.' as const, capitalize: true },
    };
    await setGeneratorPreferences(preferences);
    expect(await getGeneratorPreferences()).toEqual(preferences);

    const db = await openDB(VAULT_DB_NAME, 3);
    await db.put('meta', { key: 'generator', preferences: { mode: 'password', length: 4 } });
    expect(await getGeneratorPreferences()).toEqual(DEFAULT_GENERATOR_PREFERENCES);
    db.close();
  });

  it('upgrades a v2 database with the meta store', async () => {
    const legacy = await openDB(VAULT_DB_NAME, 2, {
      upgrade(db) {
        db.createObjectStore('items', { keyPath: 'id' });
        db.createObjectStore('folders', { keyPath: 'id' });
        db.createObjectStore('keys', { keyPath: 'key' });
        db.createObjectStore('sync', { keyPath: 'key' });
        db.createObjectStore('outbox', { keyPath: 'seq', autoIncrement: true });
      },
    });
    legacy.close();

    const db = await openVaultDb();
    expect(db.objectStoreNames.contains('meta')).toBe(true);
    db.close();
  });

  it('drops preferences with the local vault wipe', async () => {
    await setGeneratorPreferences({
      ...DEFAULT_GENERATOR_PREFERENCES,
      mode: 'passphrase',
      passphrase: { mode: 'passphrase', words: 4, separator: '_', capitalize: false },
    });
    await wipeVaultDb();
    expect(await getGeneratorPreferences()).toEqual(DEFAULT_GENERATOR_PREFERENCES);
  });
});
