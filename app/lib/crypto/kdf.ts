import {
  DEFAULT_KDF_ITERATIONS,
  HKDF_INFO,
  KEY_BYTES,
  MIN_KDF_ITERATIONS,
  PASSWORD_NORMALIZATION,
  SALT_BYTES,
} from './contract';
import { decodeBase64, toArrayBuffer } from './encoding';
import { InvalidKdfParamsError, InvalidKeyMaterialError } from './errors';

const textEncoder = new TextEncoder();

const decodeSalt = (kdfSalt: string): Uint8Array => {
  const salt = decodeBase64(kdfSalt);
  if (salt.length < SALT_BYTES) {
    throw new InvalidKdfParamsError();
  }

  return salt;
};

const assertKeyLength = (key: Uint8Array) => {
  if (key.length !== KEY_BYTES) {
    throw new InvalidKeyMaterialError();
  }
};

export const deriveMasterKey = async (
  password: string,
  kdfSalt: string,
  iterations = DEFAULT_KDF_ITERATIONS,
): Promise<Uint8Array> => {
  if (!Number.isInteger(iterations) || iterations < MIN_KDF_ITERATIONS) {
    throw new InvalidKdfParamsError();
  }

  const salt = decodeSalt(kdfSalt);
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(textEncoder.encode(password.normalize(PASSWORD_NORMALIZATION))),
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: toArrayBuffer(salt),
      iterations,
    },
    passwordKey,
    KEY_BYTES * 8,
  );

  return new Uint8Array(bits);
};

export const deriveHkdfBits = async (
  inputKeyMaterial: Uint8Array,
  info: string,
  salt: Uint8Array = new Uint8Array(0),
): Promise<Uint8Array> => {
  if (inputKeyMaterial.length === 0) {
    throw new InvalidKeyMaterialError();
  }

  const key = await crypto.subtle.importKey('raw', toArrayBuffer(inputKeyMaterial), 'HKDF', false, ['deriveBits']);

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: toArrayBuffer(salt),
      info: toArrayBuffer(textEncoder.encode(info)),
    },
    key,
    KEY_BYTES * 8,
  );

  return new Uint8Array(bits);
};

export const deriveAuthHash = (masterKey: Uint8Array): Promise<Uint8Array> => {
  assertKeyLength(masterKey);
  return deriveHkdfBits(masterKey, HKDF_INFO.auth);
};

export const deriveWrapKey = (masterKey: Uint8Array, kdfSalt: string): Promise<Uint8Array> => {
  assertKeyLength(masterKey);
  return deriveHkdfBits(masterKey, HKDF_INFO.wrap, decodeSalt(kdfSalt));
};
