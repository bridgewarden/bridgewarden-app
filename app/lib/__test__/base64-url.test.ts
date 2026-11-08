import { describe, expect, it } from 'vitest';

import { fromBase64Url, toBase64Url } from '../base64-url';
import { InvalidEncodingError } from '../crypto/errors';

describe('base64url transport', () => {
  it('round-trips bytes without padding', () => {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    const encoded = toBase64Url(bytes);

    expect(encoded).not.toContain('=');
    expect(encoded).not.toMatch(/[+/]/);
    expect(fromBase64Url(encoded)).toEqual(bytes);
  });

  it('uses the url-safe alphabet', () => {
    expect(toBase64Url(new Uint8Array([0xfb, 0xff]))).toBe('-_8');
    expect(fromBase64Url('-_8')).toEqual(new Uint8Array([0xfb, 0xff]));
  });

  it('rejects padding, foreign alphabet, empty, and non-canonical values', () => {
    expect(() => fromBase64Url('AA==')).toThrow(InvalidEncodingError);
    expect(() => fromBase64Url('+/8')).toThrow(InvalidEncodingError);
    expect(() => fromBase64Url('')).toThrow(InvalidEncodingError);
    expect(() => fromBase64Url('AB')).toThrow(InvalidEncodingError);
  });
});
