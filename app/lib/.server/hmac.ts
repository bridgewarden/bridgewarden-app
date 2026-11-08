import { toArrayBuffer } from '../crypto/encoding';

const textEncoder = new TextEncoder();

export const hmacSha256 = async (secret: string, data: Uint8Array | string): Promise<Uint8Array> => {
  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const bytes = typeof data === 'string' ? textEncoder.encode(data) : data;
  const signature = await crypto.subtle.sign('HMAC', key, toArrayBuffer(bytes));

  return new Uint8Array(signature);
};

export const toHex = (bytes: Uint8Array): string =>
  [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
