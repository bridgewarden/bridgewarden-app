import { IV_BYTES, KEY_BYTES, TAG_BYTES } from './contract';
import { decodeBase64, encodeBase64, toArrayBuffer } from './encoding';
import { InvalidKeyMaterialError, WrongPasswordError } from './errors';

export type WrappedVaultKey = {
  ciphertext: string;
  iv: string;
};

const assertKeyLength = (key: Uint8Array) => {
  if (key.length !== KEY_BYTES) {
    throw new InvalidKeyMaterialError();
  }
};

const importWrapKey = (wrapKey: Uint8Array) =>
  crypto.subtle.importKey('raw', toArrayBuffer(wrapKey), 'AES-GCM', false, ['encrypt', 'decrypt']);

export const generateVaultKey = (): Uint8Array => crypto.getRandomValues(new Uint8Array(KEY_BYTES));

export const wrapVaultKey = async (vaultKey: Uint8Array, wrapKey: Uint8Array): Promise<WrappedVaultKey> => {
  assertKeyLength(vaultKey);
  assertKeyLength(wrapKey);

  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    await importWrapKey(wrapKey),
    toArrayBuffer(vaultKey),
  );

  return { ciphertext: encodeBase64(new Uint8Array(ciphertext)), iv: encodeBase64(iv) };
};

export const unwrapVaultKey = async (wrapped: WrappedVaultKey, wrapKey: Uint8Array): Promise<Uint8Array> => {
  assertKeyLength(wrapKey);

  const iv = decodeBase64(wrapped.iv);
  const ciphertext = decodeBase64(wrapped.ciphertext);
  if (iv.length !== IV_BYTES || ciphertext.length < TAG_BYTES) {
    throw new InvalidKeyMaterialError();
  }

  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(iv) },
      await importWrapKey(wrapKey),
      toArrayBuffer(ciphertext),
    );
  } catch {
    throw new WrongPasswordError();
  }

  const vaultKey = new Uint8Array(plaintext);
  assertKeyLength(vaultKey);

  return vaultKey;
};
