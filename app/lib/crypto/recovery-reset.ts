import { base64UrlToStandard, standardToBase64Url, toBase64Url } from '../base64-url';
import { DEFAULT_KDF_ITERATIONS, SALT_BYTES } from './contract';
import { encodeBase64 } from './encoding';
import { deriveAuthHash, deriveMasterKey, deriveWrapKey } from './kdf';
import {
  deriveRecoveryAuthKey,
  formatRecoveryKey,
  generateRecoverySecret,
  parseRecoveryKey,
  unwrapVaultKeyWithRecovery,
  wrapVaultKeyWithRecovery,
} from './recovery';
import { wrapVaultKey } from './vault-key';

export type RecoveryResetRequest = {
  currentRecoveryAuthKey: string;
  authHash: string;
  kdfSalt: string;
  kdfIterations: number;
  vaultKeyWrapped: string;
  vaultKeyWrapIv: string;
  recoveryKeyWrapped: string;
  recoveryKeyWrapIv: string;
  recoveryAuthKey: string;
};

export type RecoveryResetResult = {
  vaultKey: Uint8Array;
  recoveryKey: string;
  request: RecoveryResetRequest;
};

export const prepareRecoveryReset = async (
  recoveryKey: string,
  current: { recoveryKeyWrapped: string; recoveryKeyWrapIv: string },
  newPassword: string,
): Promise<RecoveryResetResult> => {
  const currentSecret = parseRecoveryKey(recoveryKey);
  const currentAuthKey = await deriveRecoveryAuthKey(currentSecret);
  const vaultKey = await unwrapVaultKeyWithRecovery(
    {
      ciphertext: base64UrlToStandard(current.recoveryKeyWrapped),
      iv: base64UrlToStandard(current.recoveryKeyWrapIv),
    },
    currentSecret,
  );
  const newSecret = generateRecoverySecret();
  let newMasterKey: Uint8Array | null = null;
  let newWrapKey: Uint8Array | null = null;
  let newAuthKey: Uint8Array | null = null;

  try {
    const saltBytes = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
    const salt = encodeBase64(saltBytes);
    newMasterKey = await deriveMasterKey(newPassword, salt, DEFAULT_KDF_ITERATIONS);
    newWrapKey = await deriveWrapKey(newMasterKey, salt);
    newAuthKey = await deriveRecoveryAuthKey(newSecret);
    const authHash = await deriveAuthHash(newMasterKey);
    const wrappedVault = await wrapVaultKey(vaultKey, newWrapKey);
    const wrappedRecovery = await wrapVaultKeyWithRecovery(vaultKey, newSecret);

    return {
      vaultKey,
      recoveryKey: formatRecoveryKey(newSecret),
      request: {
        currentRecoveryAuthKey: toBase64Url(currentAuthKey),
        authHash: toBase64Url(authHash),
        kdfSalt: toBase64Url(saltBytes),
        kdfIterations: DEFAULT_KDF_ITERATIONS,
        vaultKeyWrapped: standardToBase64Url(wrappedVault.ciphertext),
        vaultKeyWrapIv: standardToBase64Url(wrappedVault.iv),
        recoveryKeyWrapped: standardToBase64Url(wrappedRecovery.ciphertext),
        recoveryKeyWrapIv: standardToBase64Url(wrappedRecovery.iv),
        recoveryAuthKey: toBase64Url(newAuthKey),
      },
    };
  } finally {
    currentSecret.fill(0);
    currentAuthKey.fill(0);
    newSecret.fill(0);
    newMasterKey?.fill(0);
    newWrapKey?.fill(0);
    newAuthKey?.fill(0);
  }
};
