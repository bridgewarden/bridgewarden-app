import {
  CURRENT_ENVELOPE_VERSION,
  ENVELOPE_ALGORITHM,
  ENVELOPE_VERSION,
  IV_BYTES,
  KEY_BYTES,
  TAG_BYTES,
} from './contract';
import { decodeBase64, encodeBase64, toArrayBuffer } from './encoding';
import {
  InvalidKeyMaterialError,
  InvalidPayloadError,
  MalformedEnvelopeError,
  UnsupportedEnvelopeError,
} from './errors';

export type SealedEnvelope = {
  v: typeof ENVELOPE_VERSION | typeof CURRENT_ENVELOPE_VERSION;
  alg: typeof ENVELOPE_ALGORITHM;
  iv: string;
  ct: string;
};

export type EnvelopeContext = { kind: 'item'; id: string; type: 'login' | 'note' } | { kind: 'folder'; id: string };

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const envelopeAad = (context: EnvelopeContext): Uint8Array => {
  const value = context.kind === 'item' ? `bw2:item:${context.id}:${context.type}` : `bw2:folder:${context.id}`;
  return textEncoder.encode(value);
};

const assertVaultKey = (vaultKey: Uint8Array) => {
  if (vaultKey.length !== KEY_BYTES) {
    throw new InvalidKeyMaterialError();
  }
};

const importVaultKey = (vaultKey: Uint8Array) =>
  crypto.subtle.importKey('raw', toArrayBuffer(vaultKey), 'AES-GCM', false, ['encrypt', 'decrypt']);

export const sealItem = async (
  payload: unknown,
  vaultKey: Uint8Array,
  context: EnvelopeContext,
): Promise<SealedEnvelope> => {
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
    { name: 'AES-GCM', iv: toArrayBuffer(iv), additionalData: toArrayBuffer(envelopeAad(context)) },
    await importVaultKey(vaultKey),
    toArrayBuffer(textEncoder.encode(json)),
  );

  return {
    v: CURRENT_ENVELOPE_VERSION,
    alg: ENVELOPE_ALGORITHM,
    iv: encodeBase64(iv),
    ct: encodeBase64(new Uint8Array(ciphertext)),
  };
};

export const openItem = async <T = unknown>(
  envelope: SealedEnvelope,
  vaultKey: Uint8Array,
  context?: EnvelopeContext,
): Promise<T> => {
  if (!envelope || typeof envelope !== 'object') {
    throw new MalformedEnvelopeError();
  }

  if (
    envelope.alg !== ENVELOPE_ALGORITHM ||
    (envelope.v !== ENVELOPE_VERSION && envelope.v !== CURRENT_ENVELOPE_VERSION)
  ) {
    throw new UnsupportedEnvelopeError();
  }
  let additionalData: Uint8Array | undefined;
  if (envelope.v === CURRENT_ENVELOPE_VERSION) {
    if (!context) throw new MalformedEnvelopeError();
    additionalData = envelopeAad(context);
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
      {
        name: 'AES-GCM',
        iv: toArrayBuffer(iv),
        ...(additionalData ? { additionalData: toArrayBuffer(additionalData) } : {}),
      },
      await importVaultKey(vaultKey),
      toArrayBuffer(ciphertext),
    );

    return JSON.parse(textDecoder.decode(plaintext)) as T;
  } catch {
    throw new MalformedEnvelopeError();
  }
};
