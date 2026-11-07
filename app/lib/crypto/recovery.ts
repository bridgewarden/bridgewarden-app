import { HKDF_INFO, KEY_BYTES, RECOVERY_KEY_LENGTH, RECOVERY_SECRET_BYTES } from './contract';
import { InvalidKeyMaterialError, InvalidRecoveryKeyError, WrongPasswordError } from './errors';
import { deriveHkdfBits } from './kdf';
import { unwrapVaultKey, wrapVaultKey, type WrappedVaultKey } from './vault-key';

// Crockford base32: excludes I, L, O, and U to avoid ambiguous characters.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

const normalize = (value: string): string =>
  value.toUpperCase().replace(/[\s-]/g, '').replace(/[IL]/g, '1').replace(/O/g, '0');

const encodeBase32 = (bytes: Uint8Array): string => {
  let bits = 0;
  let value = 0;
  let output = '';

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
};

const decodeBase32 = (value: string): Uint8Array => {
  let bits = 0;
  let accumulator = 0;
  const bytes: number[] = [];

  for (const character of value) {
    const index = ALPHABET.indexOf(character);
    if (index < 0) throw new InvalidRecoveryKeyError();

    accumulator = (accumulator << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bytes.push((accumulator >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  if (bits > 0 && (accumulator & ((1 << bits) - 1)) !== 0) {
    throw new InvalidRecoveryKeyError();
  }

  return new Uint8Array(bytes);
};

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
  const normalized = normalize(value);

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
