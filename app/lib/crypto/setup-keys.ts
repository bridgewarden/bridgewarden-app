import { standardToBase64Url, toBase64Url } from '../base64-url';
import { DEFAULT_KDF_ITERATIONS, SALT_BYTES } from './contract';
import { encodeBase64 } from './encoding';
import { deriveAuthHash, deriveMasterKey, deriveWrapKey } from './kdf';
import { deriveRecoveryAuthKey, formatRecoveryKey, generateRecoverySecret, wrapVaultKeyWithRecovery } from './recovery';
import { generateVaultKey, wrapVaultKey } from './vault-key';

export type SetupTransportMaterial = {
  kdfSalt: string;
  kdfIterations: number;
  authHash: string;
  vaultKeyWrapped: string;
  vaultKeyWrapIv: string;
  recoveryKeyWrapped: string;
  recoveryKeyWrapIv: string;
  recoveryAuthKey: string;
};

export type SetupKeyMaterial = SetupTransportMaterial & {
  vaultKey: Uint8Array;
  recoveryKey: string;
};

export const generateSetupKeyMaterial = async (password: string): Promise<SetupKeyMaterial> => {
  const kdfSaltBytes = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const kdfSalt = encodeBase64(kdfSaltBytes);
  const masterKey = await deriveMasterKey(password, kdfSalt, DEFAULT_KDF_ITERATIONS);
  const authHash = await deriveAuthHash(masterKey);
  const wrapKey = await deriveWrapKey(masterKey, kdfSalt);
  const vaultKey = generateVaultKey();
  const recoverySecret = generateRecoverySecret();

  try {
    const wrappedVaultKey = await wrapVaultKey(vaultKey, wrapKey);
    const wrappedWithRecovery = await wrapVaultKeyWithRecovery(vaultKey, recoverySecret);
    const recoveryAuthKey = await deriveRecoveryAuthKey(recoverySecret);

    try {
      return {
        kdfSalt: toBase64Url(kdfSaltBytes),
        kdfIterations: DEFAULT_KDF_ITERATIONS,
        authHash: toBase64Url(authHash),
        vaultKeyWrapped: standardToBase64Url(wrappedVaultKey.ciphertext),
        vaultKeyWrapIv: standardToBase64Url(wrappedVaultKey.iv),
        recoveryKeyWrapped: standardToBase64Url(wrappedWithRecovery.ciphertext),
        recoveryKeyWrapIv: standardToBase64Url(wrappedWithRecovery.iv),
        recoveryAuthKey: toBase64Url(recoveryAuthKey),
        vaultKey,
        recoveryKey: formatRecoveryKey(recoverySecret),
      };
    } finally {
      recoveryAuthKey.fill(0);
    }
  } finally {
    masterKey.fill(0);
    authHash.fill(0);
    wrapKey.fill(0);
    recoverySecret.fill(0);
  }
};

export type SetupPayload = SetupTransportMaterial & {
  email: string;
  displayName: string;
};

export const toSetupPayload = (
  keys: SetupTransportMaterial,
  account: { email: string; displayName: string },
): SetupPayload => ({
  email: account.email,
  displayName: account.displayName,
  kdfSalt: keys.kdfSalt,
  kdfIterations: keys.kdfIterations,
  authHash: keys.authHash,
  vaultKeyWrapped: keys.vaultKeyWrapped,
  vaultKeyWrapIv: keys.vaultKeyWrapIv,
  recoveryKeyWrapped: keys.recoveryKeyWrapped,
  recoveryKeyWrapIv: keys.recoveryKeyWrapIv,
  recoveryAuthKey: keys.recoveryAuthKey,
});
