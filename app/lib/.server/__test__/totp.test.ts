import { describe, expect, it } from 'vitest';

import { buildOtpauthUri, decodeBase32, encodeBase32, generateCode, generateSecret, verifyCode } from '../totp';

const RFC_SECRET = decodeBase32('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');

describe('base32', () => {
  it('round-trips and encodes the RFC secret', () => {
    const bytes = crypto.getRandomValues(new Uint8Array(20));
    expect(decodeBase32(encodeBase32(bytes))).toEqual(bytes);
    expect(encodeBase32(RFC_SECRET)).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
    expect(() => decodeBase32('INVALID!')).toThrow();
  });
});

describe('TOTP', () => {
  it('matches RFC 6238 SHA-1 vectors at six digits', async () => {
    const vectors = [
      [59, '287082'],
      [1_111_111_109, '081804'],
      [1_111_111_111, '050471'],
      [1_234_567_890, '005924'],
      [2_000_000_000, '279037'],
      [20_000_000_000, '353130'],
    ] as const;

    for (const [seconds, code] of vectors) {
      const step = Math.floor(seconds / 30);
      await expect(generateCode(RFC_SECRET, step)).resolves.toBe(code);
      await expect(verifyCode(RFC_SECRET, code, 0, seconds * 1000 - 30_000)).resolves.toEqual({
        valid: true,
        step,
      });
    }
  });

  it('accepts adjacent steps and rejects replay, stale, and malformed codes', async () => {
    const secret = generateSecret();
    const now = 1_800_000_000_000;
    const current = Math.floor(now / 30_000);
    const previous = await generateCode(secret, current - 1);
    const next = await generateCode(secret, current + 1);
    const currentCode = await generateCode(secret, current);

    await expect(verifyCode(secret, previous, 0, now)).resolves.toEqual({ valid: true, step: current - 1 });
    await expect(verifyCode(secret, next, 0, now)).resolves.toEqual({ valid: true, step: current + 1 });
    await expect(verifyCode(secret, currentCode, current - 1, now)).resolves.toEqual({
      valid: true,
      step: current,
    });
    await expect(verifyCode(secret, currentCode, current, now)).resolves.toEqual({
      valid: false,
      step: current,
    });
    await expect(verifyCode(secret, '12345', 0, now)).resolves.toEqual({ valid: false, step: 0 });
    await expect(verifyCode(secret, 'abcdef', 0, now)).resolves.toEqual({ valid: false, step: 0 });
    await expect(verifyCode(secret, await generateCode(secret, current - 2), current, now)).resolves.toEqual({
      valid: false,
      step: current,
    });
  });

  it('builds an otpauth URI with the encoded secret', () => {
    const uri = buildOtpauthUri(RFC_SECRET, 'admin@example.com', 'Bridgewarden');

    expect(uri).toContain('otpauth://totp/Bridgewarden%3Aadmin%40example.com');
    expect(uri).toContain('secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
    expect(uri).toContain('issuer=Bridgewarden');
    expect(uri).toContain('digits=6');
  });
});
