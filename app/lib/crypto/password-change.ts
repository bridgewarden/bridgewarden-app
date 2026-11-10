import { standardToBase64Url, toBase64Url } from '../base64-url';
import { DEFAULT_KDF_ITERATIONS, SALT_BYTES } from './contract';
import { encodeBase64 } from './encoding';
import { deriveAuthHash, deriveMasterKey, deriveWrapKey } from './kdf';
import { unwrapLoginVault } from './login-keys';
import { wrapVaultKey } from './vault-key';

export type PasswordKeyMaterial = {
  kdfSalt: string;
  kdfIterations: number;
  vaultKeyWrapped: string;
  vaultKeyWrapIv: string;
};

export type PasswordChangeRequest = {
  authHash: string;
  kdfSalt: string;
  kdfIterations: number;
  vaultKeyWrapped: string;
  vaultKeyWrapIv: string;
};

export const rewrapPassword = async (
  currentAuthHash: string,
  currentWrapKey: Uint8Array,
  newPassword: string,
  current: Pick<PasswordKeyMaterial, 'vaultKeyWrapped' | 'vaultKeyWrapIv'>,
): Promise<{ currentAuthHash: string; request: PasswordChangeRequest }> => {
  const vaultKey = await unwrapLoginVault(current.vaultKeyWrapped, current.vaultKeyWrapIv, currentWrapKey);
  let newMasterKey: Uint8Array | null = null;
  let newWrapKey: Uint8Array | null = null;

  try {
    const newSaltBytes = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
    const newSalt = encodeBase64(newSaltBytes);
    newMasterKey = await deriveMasterKey(newPassword, newSalt, DEFAULT_KDF_ITERATIONS);
    newWrapKey = await deriveWrapKey(newMasterKey, newSalt);
    const authHash = await deriveAuthHash(newMasterKey);
    const wrapped = await wrapVaultKey(vaultKey, newWrapKey);

    return {
      currentAuthHash,
      request: {
        authHash: toBase64Url(authHash),
        kdfSalt: toBase64Url(newSaltBytes),
        kdfIterations: DEFAULT_KDF_ITERATIONS,
        vaultKeyWrapped: standardToBase64Url(wrapped.ciphertext),
        vaultKeyWrapIv: standardToBase64Url(wrapped.iv),
      },
    };
  } finally {
    vaultKey.fill(0);
    newMasterKey?.fill(0);
    newWrapKey?.fill(0);
  }
};
