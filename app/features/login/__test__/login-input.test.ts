import { describe, expect, it } from 'vitest';

import { toBase64Url } from '../../../lib/base64-url';
import { parseLoginInput, parsePreloginInput } from '../.server/login-input';

describe('login input', () => {
  it('normalizes email and decodes a 32-byte auth hash', () => {
    const authHash = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
    const parsed = parseLoginInput({ email: '  Admin@Example.COM ', authHash });

    expect(parsed?.email).toBe('admin@example.com');
    expect(parsed?.authHashBytes).toHaveLength(32);
  });

  it('rejects malformed email, hash, length, and unknown keys', () => {
    const authHash = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));

    expect(parsePreloginInput({ email: 'not-an-email' })).toBeNull();
    expect(parseLoginInput({ email: 'admin@example.com', authHash: 'not base64!' })).toBeNull();
    expect(parseLoginInput({ email: 'admin@example.com', authHash: toBase64Url(new Uint8Array(31)) })).toBeNull();
    expect(parseLoginInput({ email: 'admin@example.com', authHash, extra: true })).toBeNull();
  });
});
