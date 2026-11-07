import { describe, expect, it } from 'vitest';

import { decodeBase64, encodeBase64 } from '../encoding';
import { InvalidEncodingError } from '../errors';

describe('base64 encoding', () => {
  it('round-trips bytes', () => {
    const bytes = crypto.getRandomValues(new Uint8Array(32));

    expect(decodeBase64(encodeBase64(bytes))).toEqual(bytes);
  });

  it('matches known padded and unpadded values', () => {
    expect(encodeBase64(new Uint8Array([0, 1, 2]))).toBe('AAEC');
    expect(decodeBase64('AAEC')).toEqual(new Uint8Array([0, 1, 2]));
    expect(encodeBase64(new Uint8Array([0]))).toBe('AA==');
    expect(decodeBase64('AA==')).toEqual(new Uint8Array([0]));
    expect(decodeBase64('AAA=')).toEqual(new Uint8Array([0, 0]));
  });

  it('rejects empty, malformed, mis-padded, and non-canonical values', () => {
    expect(() => decodeBase64('')).toThrow(InvalidEncodingError);
    expect(() => decodeBase64('!!!!')).toThrow(InvalidEncodingError);
    expect(() => decodeBase64('abc')).toThrow(InvalidEncodingError);
    expect(() => decodeBase64('A===')).toThrow(InvalidEncodingError);
    expect(() => decodeBase64('AB==')).toThrow(InvalidEncodingError);
  });
});
