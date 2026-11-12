import { describe, expect, it } from 'vitest';

import { generateTotp, parseTotpSecret, TotpError } from '../totp';

const RFC_SECRET = parseTotpSecret('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');

describe('client TOTP', () => {
  it('matches RFC 6238 SHA-1 six-digit vectors', async () => {
    const vectors = [
      [59, '287082'],
      [1_111_111_109, '081804'],
      [1_111_111_111, '050471'],
      [1_234_567_890, '005924'],
      [2_000_000_000, '279037'],
      [20_000_000_000, '353130'],
    ] as const;

    for (const [seconds, code] of vectors) {
      await expect(generateTotp(RFC_SECRET, Math.floor(seconds / 30))).resolves.toBe(code);
    }
  });

  it('accepts raw Base32 with spaces/lowercase/padding and otpauth URIs', () => {
    expect(parseTotpSecret('gezd gnbv gy3t qojq gezd gnbv gy3t qojq')).toEqual(RFC_SECRET);
    expect(parseTotpSecret('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ====')).toEqual(RFC_SECRET);
    expect(
      parseTotpSecret(
        'otpauth://totp/Bridgewarden:me@example.com?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&algorithm=SHA1&digits=6&period=30',
      ),
    ).toEqual(RFC_SECRET);
  });

  it('rejects malformed and unsupported secrets', () => {
    expect(() => parseTotpSecret('INVALID!')).toThrow(TotpError);
    expect(() => parseTotpSecret('otpauth://totp/x?secret=GEZDGNBVGY3TQOJQ&algorithm=SHA256')).toThrow(TotpError);
    expect(() => parseTotpSecret('otpauth://totp/x?secret=GEZDGNBVGY3TQOJQ&digits=8')).toThrow(TotpError);
    expect(() => parseTotpSecret('otpauth://totp/x?secret=GEZDGNBVGY3TQOJQ&period=60')).toThrow(TotpError);
  });
});
