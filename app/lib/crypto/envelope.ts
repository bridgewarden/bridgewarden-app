import { ENVELOPE_ALGORITHM, ENVELOPE_VERSION, IV_BYTES, KEY_BYTES, TAG_BYTES } from './contract';
import { decodeBase64, encodeBase64, toArrayBuffer } from './encoding';
import {
  InvalidKeyMaterialError,
  InvalidPayloadError,
  MalformedEnvelopeError,
  UnsupportedEnvelopeError,
} from './errors';

export type SealedEnvelope = {
  v: typeof ENVELOPE_VERSION;
  alg: typeof ENVELOPE_ALGORITHM;
  iv: string;
  ct: string;
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const assertVaultKey = (vaultKey: Uint8Array) => {
  if (vaultKey.length !== KEY_BYTES) {
    throw new InvalidKeyMaterialError();
  }
};

const importVaultKey = (vaultKey: Uint8Array) =>
  crypto.subtle.importKey('raw', toArrayBuffer(vaultKey), 'AES-GCM', false, ['encrypt', 'decrypt']);

export const sealItem = async (payload: unknown, vaultKey: Uint8Array): Promise<SealedEnvelope> => {
  assertVaultKey(vaultKey);

  let json: string | undefined;
  try {
    json = JSON.stringify(payload);
  } catch {
    throw new InvalidPayloadError();
  }

  if (typeof json !== 'string') {
    throw new InvalidPayloadError();
  }

  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    await importVaultKey(vaultKey),
    toArrayBuffer(textEncoder.encode(json)),
  );

  return {
    v: ENVELOPE_VERSION,
    alg: ENVELOPE_ALGORITHM,
    iv: encodeBase64(iv),
    ct: encodeBase64(new Uint8Array(ciphertext)),
  };
};

export const openItem = async <T = unknown>(envelope: SealedEnvelope, vaultKey: Uint8Array): Promise<T> => {
  if (!envelope || typeof envelope !== 'object') {
    throw new MalformedEnvelopeError();
  }

  if (envelope.v !== ENVELOPE_VERSION || envelope.alg !== ENVELOPE_ALGORITHM) {
    throw new UnsupportedEnvelopeError();
  }

  if (typeof envelope.iv !== 'string' || typeof envelope.ct !== 'string') {
    throw new MalformedEnvelopeError();
  }

  assertVaultKey(vaultKey);

  const iv = decodeBase64(envelope.iv);
  const ciphertext = decodeBase64(envelope.ct);
  if (iv.length !== IV_BYTES || ciphertext.length < TAG_BYTES) {
    throw new MalformedEnvelopeError();
  }

  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(iv) },
      await importVaultKey(vaultKey),
      toArrayBuffer(ciphertext),
    );

    return JSON.parse(textDecoder.decode(plaintext)) as T;
  } catch {
    throw new MalformedEnvelopeError();
  }
};
