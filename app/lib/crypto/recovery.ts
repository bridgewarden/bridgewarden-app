import { base32Decode, base32Encode, CROCKFORD_ALPHABET, normalizeCrockford } from '../base32';
import { HKDF_INFO, KEY_BYTES, RECOVERY_KEY_LENGTH, RECOVERY_SECRET_BYTES } from './contract';
import { InvalidKeyMaterialError, InvalidRecoveryKeyError, WrongPasswordError } from './errors';
import { deriveHkdfBits } from './kdf';
import { unwrapVaultKey, wrapVaultKey, type WrappedVaultKey } from './vault-key';

export const normalizeRecoveryKey = normalizeCrockford;

const encodeBase32 = (bytes: Uint8Array): string => base32Encode(bytes, CROCKFORD_ALPHABET);

const decodeBase32 = (value: string): Uint8Array =>
  base32Decode(value, CROCKFORD_ALPHABET, {
    rejectInvalidBits: true,
    onInvalid: () => new InvalidRecoveryKeyError(),
  });

const assertSecretLength = (secret: Uint8Array) => {
  if (secret.length !== RECOVERY_SECRET_BYTES) {
    throw new InvalidKeyMaterialError();
  }
};

export const generateRecoverySecret = (): Uint8Array => crypto.getRandomValues(new Uint8Array(RECOVERY_SECRET_BYTES));

export const formatRecoveryKey = (secret: Uint8Array): string => {
  assertSecretLength(secret);

  const raw = encodeBase32(secret);
  return raw.match(/.{1,4}/g)?.join('-') ?? raw;
};

export const parseRecoveryKey = (value: string): Uint8Array => {
  const normalized = normalizeRecoveryKey(value);

  if (normalized.length !== RECOVERY_KEY_LENGTH) {
    throw new InvalidRecoveryKeyError();
  }

  const secret = decodeBase32(normalized);
  if (secret.length !== RECOVERY_SECRET_BYTES) {
    throw new InvalidRecoveryKeyError();
  }

  return secret;
};

const deriveRecoveryWrapKey = (secret: Uint8Array): Promise<Uint8Array> => deriveHkdfBits(secret, HKDF_INFO.recovery);

export const wrapVaultKeyWithRecovery = async (vaultKey: Uint8Array, secret: Uint8Array): Promise<WrappedVaultKey> => {
  if (vaultKey.length !== KEY_BYTES) throw new InvalidKeyMaterialError();
  assertSecretLength(secret);

  return wrapVaultKey(vaultKey, await deriveRecoveryWrapKey(secret));
};

export const unwrapVaultKeyWithRecovery = async (wrapped: WrappedVaultKey, secret: Uint8Array): Promise<Uint8Array> => {
  assertSecretLength(secret);

  try {
    return await unwrapVaultKey(wrapped, await deriveRecoveryWrapKey(secret));
  } catch (error) {
    if (error instanceof WrongPasswordError) {
      throw new InvalidRecoveryKeyError();
    }

    throw error;
  }
};
