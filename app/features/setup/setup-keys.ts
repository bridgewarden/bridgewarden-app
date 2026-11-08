import { toBase64Url } from '../../lib/base64-url';
import { DEFAULT_KDF_ITERATIONS, SALT_BYTES } from '../../lib/crypto/contract';
import { decodeBase64, encodeBase64 } from '../../lib/crypto/encoding';
import { deriveAuthHash, deriveMasterKey, deriveWrapKey } from '../../lib/crypto/kdf';
import { formatRecoveryKey, generateRecoverySecret, wrapVaultKeyWithRecovery } from '../../lib/crypto/recovery';
import { generateVaultKey, wrapVaultKey } from '../../lib/crypto/vault-key';

export type SetupTransportMaterial = {
  kdfSalt: string;
  kdfIterations: number;
  authHash: string;
  vaultKeyWrapped: string;
  vaultKeyWrapIv: string;
  recoveryKeyWrapped: string;
  recoveryKeyWrapIv: string;
};

export type SetupKeyMaterial = SetupTransportMaterial & {
  vaultKey: Uint8Array;
  recoveryKey: string;
};

const toTransport = (standardBase64: string): string => toBase64Url(decodeBase64(standardBase64));

export const generateSetupKeyMaterial = async (password: string): Promise<SetupKeyMaterial> => {
  const kdfSaltBytes = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const kdfSalt = encodeBase64(kdfSaltBytes);
  const masterKey = await deriveMasterKey(password, kdfSalt, DEFAULT_KDF_ITERATIONS);
  const authHash = await deriveAuthHash(masterKey);
  const wrapKey = await deriveWrapKey(masterKey, kdfSalt);
  const vaultKey = generateVaultKey();
  const wrappedVaultKey = await wrapVaultKey(vaultKey, wrapKey);
  const recoverySecret = generateRecoverySecret();
  const wrappedWithRecovery = await wrapVaultKeyWithRecovery(vaultKey, recoverySecret);

  return {
    kdfSalt: toBase64Url(kdfSaltBytes),
    kdfIterations: DEFAULT_KDF_ITERATIONS,
    authHash: toBase64Url(authHash),
    vaultKeyWrapped: toTransport(wrappedVaultKey.ciphertext),
    vaultKeyWrapIv: toTransport(wrappedVaultKey.iv),
    recoveryKeyWrapped: toTransport(wrappedWithRecovery.ciphertext),
    recoveryKeyWrapIv: toTransport(wrappedWithRecovery.iv),
    vaultKey,
    recoveryKey: formatRecoveryKey(recoverySecret),
  };
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
});
