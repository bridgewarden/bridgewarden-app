import { decodeBase64, encodeBase64 } from './crypto/encoding';
import { InvalidEncodingError } from './crypto/errors';

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

export const toBase64Url = (bytes: Uint8Array): string =>
  encodeBase64(bytes).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');

export const fromBase64Url = (value: string): Uint8Array => {
  if (!BASE64URL_PATTERN.test(value)) {
    throw new InvalidEncodingError();
  }

  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const standard = value.replaceAll('-', '+').replaceAll('_', '/') + padding;
  const bytes = decodeBase64(standard);

  if (toBase64Url(bytes) !== value) {
    throw new InvalidEncodingError();
  }

  return bytes;
};

export const standardToBase64Url = (value: string): string => toBase64Url(decodeBase64(value));

export const storedToStandardBase64 = (value: string): string => {
  if (value === '') return '';
  try {
    return encodeBase64(fromBase64Url(value));
  } catch {
    decodeBase64(value);
    return value;
  }
};

export const storedToBase64Url = (value: string): string => {
  try {
    return toBase64Url(fromBase64Url(value));
  } catch {
    return standardToBase64Url(value);
  }
};

export const base64UrlToStandard = (value: string): string => encodeBase64(fromBase64Url(value));
