import { InvalidEncodingError } from './errors';

const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
};

export const encodeBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
};

export const decodeBase64 = (value: string): Uint8Array => {
  if (value.length === 0 || value.length % 4 !== 0 || !BASE64_PATTERN.test(value)) {
    throw new InvalidEncodingError();
  }

  let binary: string;
  try {
    binary = atob(value);
  } catch {
    throw new InvalidEncodingError();
  }

  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  if (encodeBase64(bytes) !== value) {
    throw new InvalidEncodingError();
  }

  return bytes;
};

export { toArrayBuffer };
