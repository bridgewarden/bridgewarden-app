import { KEY_BYTES } from '../crypto/contract';
import { InvalidKeyMaterialError } from '../crypto/errors';

let vaultKey: Uint8Array | null = null;

export const setVaultKey = (key: Uint8Array): void => {
  if (key.length !== KEY_BYTES) {
    throw new InvalidKeyMaterialError();
  }

  vaultKey = key.slice();
};

export const getVaultKey = (): Uint8Array | null => vaultKey?.slice() ?? null;

export const clearVaultKey = (): void => {
  vaultKey?.fill(0);
  vaultKey = null;
};
