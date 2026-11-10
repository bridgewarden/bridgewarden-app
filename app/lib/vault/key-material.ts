import { openVaultDb, wipeVaultDb } from './local-db';
import type { StoredKeyMaterial, VaultKeyMaterial } from './types';

const KEY_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MIN_ITERATIONS = 600_000;
const MAX_ITERATIONS = 10_000_000;

const validMaterial = (record: StoredKeyMaterial): boolean =>
  Date.now() - record.storedAt <= KEY_TTL_MS &&
  Number.isInteger(record.kdfIterations) &&
  record.kdfIterations >= MIN_ITERATIONS &&
  record.kdfIterations <= MAX_ITERATIONS;

export const storeKeyMaterial = async (email: string, material: VaultKeyMaterial): Promise<void> => {
  const normalized = email.trim().toLowerCase();
  if (!normalized) throw new Error('account email required');

  const db = await openVaultDb();
  const active = await db.get('keys', 'active');
  if (!active || active.email !== normalized) await wipeVaultDb();

  const target = await openVaultDb();
  await target.put('keys', {
    key: 'active',
    email: normalized,
    vaultKeyWrapped: material.vaultKeyWrapped,
    vaultKeyWrapIv: material.vaultKeyWrapIv,
    kdfSalt: material.kdfSalt,
    kdfIterations: material.kdfIterations,
    storedAt: Date.now(),
  });
};

export const readKeyMaterial = async (): Promise<StoredKeyMaterial | null> => {
  const db = await openVaultDb();
  const record = await db.get('keys', 'active');
  return record && validMaterial(record) ? record : null;
};
