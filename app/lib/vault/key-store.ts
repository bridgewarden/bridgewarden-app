import { KEY_BYTES } from '../crypto/contract';
import { InvalidKeyMaterialError } from '../crypto/errors';

let vaultKey: Uint8Array | null = null;
const listeners = new Set<() => void>();
let keyVersion = 0;

const notify = () => {
  for (const listener of listeners) listener();
};

export const setVaultKey = (key: Uint8Array): void => {
  if (key.length !== KEY_BYTES) {
    throw new InvalidKeyMaterialError();
  }

  vaultKey?.fill(0);
  vaultKey = key.slice();
  keyVersion += 1;
  notify();
};

export const getVaultKey = (): Uint8Array | null => vaultKey?.slice() ?? null;

export const clearVaultKey = (): void => {
  keyVersion += 1;
  if (!vaultKey) return;
  vaultKey.fill(0);
  vaultKey = null;
  notify();
};

export const subscribeKeyState = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const isUnlocked = (): boolean => vaultKey !== null;

export const getKeyVersion = (): number => keyVersion;
