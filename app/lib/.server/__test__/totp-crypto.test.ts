import { describe, expect, it } from 'vitest';

import { decodeBase64 } from '../../crypto/encoding';
import { decryptTotpSecret, encryptTotpSecret } from '../totp-crypto';

const env = { TOTP_ENC_KEY: 'test-totp-encryption-key-material' } as Env;

describe('TOTP seed encryption', () => {
  it('round-trips with fresh IVs and standard base64 storage', async () => {
    const secret = crypto.getRandomValues(new Uint8Array(20));
    const first = await encryptTotpSecret(env, 'user-1', secret);
    const second = await encryptTotpSecret(env, 'user-1', secret);

    expect(first.iv).not.toBe(second.iv);
    expect(decodeBase64(first.iv)).toHaveLength(12);
    expect(decodeBase64(first.ciphertext)).toHaveLength(20 + 16);
    await expect(decryptTotpSecret(env, 'user-1', first)).resolves.toEqual(secret);
  });

  it('rejects tampering, wrong user, and a wrong key', async () => {
    const secret = crypto.getRandomValues(new Uint8Array(20));
    const encrypted = await encryptTotpSecret(env, 'user-1', secret);
    const ciphertext = decodeBase64(encrypted.ciphertext);
    ciphertext[0] ^= 0xff;

    await expect(
      decryptTotpSecret(env, 'user-1', { ...encrypted, ciphertext: btoa(String.fromCharCode(...ciphertext)) }),
    ).rejects.toThrow();
    await expect(decryptTotpSecret(env, 'user-2', encrypted)).rejects.toThrow();
    await expect(decryptTotpSecret({ TOTP_ENC_KEY: 'different-key' } as Env, 'user-1', encrypted)).rejects.toThrow();
  });
});
