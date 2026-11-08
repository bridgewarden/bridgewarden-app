import { decodeBase64, encodeBase64, toArrayBuffer } from '../crypto/encoding';
import { requireSecret } from './env';

const IV_BYTES = 12;
const KEY_BYTES = 32;
const HKDF_INFO = 'bw-totp';
const textEncoder = new TextEncoder();

export type EncryptedTotpSecret = {
  ciphertext: string;
  iv: string;
};

const deriveKey = async (env: Env): Promise<CryptoKey> => {
  const rawKey = requireSecret(env, 'TOTP_ENC_KEY');
  const material = await crypto.subtle.importKey('raw', textEncoder.encode(rawKey), 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(0),
      info: textEncoder.encode(HKDF_INFO),
    },
    material,
    KEY_BYTES * 8,
  );

  return crypto.subtle.importKey('raw', bits, 'AES-GCM', false, ['encrypt', 'decrypt']);
};

const aad = (userId: string): Uint8Array => textEncoder.encode(`totp:${userId}`);

export const encryptTotpSecret = async (env: Env, userId: string, secret: Uint8Array): Promise<EncryptedTotpSecret> => {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv), additionalData: toArrayBuffer(aad(userId)) },
    await deriveKey(env),
    toArrayBuffer(secret),
  );

  return { ciphertext: encodeBase64(new Uint8Array(ciphertext)), iv: encodeBase64(iv) };
};

export const decryptTotpSecret = async (
  env: Env,
  userId: string,
  encrypted: EncryptedTotpSecret,
): Promise<Uint8Array> => {
  const iv = decodeBase64(encrypted.iv);
  if (iv.length !== IV_BYTES) throw new Error('Invalid TOTP IV');

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv), additionalData: toArrayBuffer(aad(userId)) },
    await deriveKey(env),
    toArrayBuffer(decodeBase64(encrypted.ciphertext)),
  );

  return new Uint8Array(plaintext);
};
