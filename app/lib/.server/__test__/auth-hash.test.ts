import { describe, expect, it } from 'vitest';

import { encodeBase64 } from '../../crypto/encoding';
import { deriveServerAuthHash, generateServerSalt } from '../auth-hash';

describe('server authentication hash', () => {
  it('matches a fixed HMAC-SHA256 vector', async () => {
    const authHash = new Uint8Array(Array.from({ length: 32 }, (_, index) => index));
    const serverSalt = new Uint8Array(Array.from({ length: 16 }, (_, index) => 16 + index));

    const result = await deriveServerAuthHash(authHash, serverSalt, 'pepper');

    expect(result).toEqual({
      authHash: 'ShVRzYRb1SPSgBJrlIFwHwYKF4Yz+NvQCg8SETTuXGw=',
      serverSalt: 'EBESExQVFhcYGRobHB0eHw==',
    });
  });

  it('changes with the server salt and generates 16-byte salts', async () => {
    const authHash = new Uint8Array(32);
    const first = await deriveServerAuthHash(authHash, new Uint8Array(16), 'pepper');
    const second = await deriveServerAuthHash(authHash, new Uint8Array(16).fill(1), 'pepper');

    expect(first.authHash).not.toBe(second.authHash);
    expect(encodeBase64(generateServerSalt())).toHaveLength(24);
  });
});
