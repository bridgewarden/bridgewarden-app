import { decodeBase64, encodeBase64 } from '../encoding';

export const randomKey = (bytes = 32) => crypto.getRandomValues(new Uint8Array(bytes));

export const fromHex = (hex: string) => new Uint8Array(hex.match(/../g)?.map((byte) => parseInt(byte, 16)) ?? []);

export const toHex = (bytes: Uint8Array) => [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');

export const mutateBase64Byte = (value: string): string => {
  const bytes = decodeBase64(value);
  const index = Math.floor(bytes.length / 2);
  bytes[index] ^= 0xff;

  return encodeBase64(bytes);
};
