import { describe, expect, it } from 'vitest';

import { toBase64Url } from '../../../lib/base64-url';
import { decodeBase64 } from '../../../lib/crypto/encoding';

import { parseSetupInput } from '../.server/setup-input';

const random = (length: number) => crypto.getRandomValues(new Uint8Array(length));

const validInput = () => ({
  email: '  Admin@Example.COM ',
  displayName: '  Administrator  ',
  kdfIterations: 600_000,
  kdfSalt: toBase64Url(random(16)),
  authHash: toBase64Url(random(32)),
  vaultKeyWrapped: toBase64Url(random(48)),
  vaultKeyWrapIv: toBase64Url(random(12)),
  recoveryKeyWrapped: toBase64Url(random(48)),
  recoveryKeyWrapIv: toBase64Url(random(12)),
});

describe('setup input', () => {
  it('normalizes the account and stores standard base64', () => {
    const parsed = parseSetupInput(validInput());

    expect(parsed).not.toBeNull();
    expect(parsed?.email).toBe('admin@example.com');
    expect(parsed?.displayName).toBe('Administrator');
    expect(decodeBase64(parsed!.kdfSalt)).toHaveLength(16);
    expect(parsed!.authHashBytes).toHaveLength(32);
    expect(decodeBase64(parsed!.vaultKeyWrapped)).toHaveLength(48);
    expect(decodeBase64(parsed!.vaultKeyWrapIv)).toHaveLength(12);
    expect(parsed!.kdfSalt).toContain('=');
  });

  it('rejects malformed base64url and wrong byte lengths', () => {
    expect(parseSetupInput({ ...validInput(), kdfSalt: 'AA==' })).toBeNull();
    expect(parseSetupInput({ ...validInput(), kdfSalt: toBase64Url(random(15)) })).toBeNull();
    expect(parseSetupInput({ ...validInput(), authHash: toBase64Url(random(31)) })).toBeNull();
    expect(parseSetupInput({ ...validInput(), vaultKeyWrapped: toBase64Url(random(47)) })).toBeNull();
    expect(parseSetupInput({ ...validInput(), recoveryKeyWrapIv: toBase64Url(random(11)) })).toBeNull();
  });

  it('rejects unsafe iterations, short fields, and unknown keys', () => {
    expect(parseSetupInput({ ...validInput(), kdfIterations: 1 })).toBeNull();
    expect(parseSetupInput({ ...validInput(), kdfIterations: 600_000.5 })).toBeNull();
    expect(parseSetupInput({ ...validInput(), email: 'not-an-email' })).toBeNull();
    expect(parseSetupInput({ ...validInput(), displayName: '   ' })).toBeNull();
    expect(parseSetupInput({ ...validInput(), extra: 'field' })).toBeNull();
  });
});
