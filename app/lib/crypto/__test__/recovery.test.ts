import { describe, expect, it } from 'vitest';

import { InvalidKeyMaterialError, InvalidRecoveryKeyError } from '../errors';
import {
  formatRecoveryKey,
  generateRecoverySecret,
  parseRecoveryKey,
  unwrapVaultKeyWithRecovery,
  wrapVaultKeyWithRecovery,
} from '../recovery';
import { generateVaultKey } from '../vault-key';
import { randomKey } from './helpers';

describe('recovery key', () => {
  it('formats 16 random bytes as 26 grouped Crockford characters', () => {
    const secret = generateRecoverySecret();
    const formatted = formatRecoveryKey(secret);

    expect(secret).toHaveLength(16);
    expect(formatted.replace(/-/g, '')).toHaveLength(26);
    expect(parseRecoveryKey(formatted)).toEqual(secret);
  });

  it('tolerates lowercase and separators', () => {
    const secret = generateRecoverySecret();
    const formatted = formatRecoveryKey(secret);
    const messy = formatted.toLowerCase().replace(/-/g, ' ');

    expect(parseRecoveryKey(messy)).toEqual(secret);
  });

  it('maps ambiguous characters to their Crockford equivalents', () => {
    const zeros = new Uint8Array(16);

    expect(parseRecoveryKey('O'.repeat(26))).toEqual(zeros);
    expect(parseRecoveryKey(`${'I'.repeat(25)}0`)).toEqual(parseRecoveryKey(`${'1'.repeat(25)}0`));
  });

  it('rejects invalid length, alphabet, and padding bits', () => {
    expect(() => parseRecoveryKey('ABC')).toThrow(InvalidRecoveryKeyError);
    expect(() => parseRecoveryKey('U'.repeat(26))).toThrow(InvalidRecoveryKeyError);
    expect(() => parseRecoveryKey(`${'0'.repeat(25)}Z`)).toThrow(InvalidRecoveryKeyError);
  });

  it('rejects formatting a secret of the wrong length', () => {
    expect(() => formatRecoveryKey(randomKey(32))).toThrow(InvalidKeyMaterialError);
  });

  it('wraps and unwraps the vault key', async () => {
    const vaultKey = generateVaultKey();
    const secret = generateRecoverySecret();
    const wrapped = await wrapVaultKeyWithRecovery(vaultKey, secret);

    await expect(unwrapVaultKeyWithRecovery(wrapped, secret)).resolves.toEqual(vaultKey);
  });

  it('rejects a short secret or wrong recovery key', async () => {
    const vaultKey = generateVaultKey();
    const secret = generateRecoverySecret();
    const wrapped = await wrapVaultKeyWithRecovery(vaultKey, secret);

    await expect(wrapVaultKeyWithRecovery(vaultKey, randomKey(4))).rejects.toThrow(InvalidKeyMaterialError);
    await expect(unwrapVaultKeyWithRecovery(wrapped, randomKey(4))).rejects.toThrow(InvalidKeyMaterialError);
    await expect(unwrapVaultKeyWithRecovery(wrapped, generateRecoverySecret())).rejects.toThrow(
      InvalidRecoveryKeyError,
    );
  });

  it('invalidates the old key after regeneration', async () => {
    const vaultKey = generateVaultKey();
    const first = generateRecoverySecret();
    const second = generateRecoverySecret();
    const firstWrapped = await wrapVaultKeyWithRecovery(vaultKey, first);
    const secondWrapped = await wrapVaultKeyWithRecovery(vaultKey, second);

    await expect(unwrapVaultKeyWithRecovery(secondWrapped, first)).rejects.toThrow(InvalidRecoveryKeyError);
    await expect(unwrapVaultKeyWithRecovery(secondWrapped, second)).resolves.toEqual(vaultKey);
    await expect(unwrapVaultKeyWithRecovery(firstWrapped, second)).rejects.toThrow(InvalidRecoveryKeyError);
  });
});
