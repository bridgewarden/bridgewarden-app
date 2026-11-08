import { describe, expect, it } from 'vitest';

import { encodeBase64 } from '../../crypto/encoding';
import { deriveServerAuthHash } from '../auth-hash';
import { verifyServerAuthHash } from '../verify-auth';

describe('server auth hash verification', () => {
  it('accepts the matching hash and rejects wrong values', async () => {
    const authHash = crypto.getRandomValues(new Uint8Array(32));
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const derived = await deriveServerAuthHash(authHash, salt, 'pepper');

    await expect(verifyServerAuthHash(authHash, derived.serverSalt, 'pepper', derived.authHash)).resolves.toBe(true);
    await expect(
      verifyServerAuthHash(crypto.getRandomValues(new Uint8Array(32)), derived.serverSalt, 'pepper', derived.authHash),
    ).resolves.toBe(false);
    await expect(
      verifyServerAuthHash(new Uint8Array(16), derived.serverSalt, 'pepper', derived.authHash),
    ).resolves.toBe(false);
    await expect(verifyServerAuthHash(authHash, 'not-base64!', 'pepper', derived.authHash)).resolves.toBe(false);
    await expect(
      verifyServerAuthHash(authHash, derived.serverSalt, 'pepper', encodeBase64(new Uint8Array(31))),
    ).resolves.toBe(false);
  });
});
