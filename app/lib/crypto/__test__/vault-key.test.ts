import { describe, expect, it } from 'vitest';

import { encodeBase64 } from '../encoding';
import { openItem, sealItem } from '../envelope';
import { InvalidKeyMaterialError, WrongPasswordError } from '../errors';
import { deriveMasterKey, deriveWrapKey } from '../kdf';
import { generateVaultKey, unwrapVaultKey, wrapVaultKey } from '../vault-key';
import { mutateBase64Byte, randomKey } from './helpers';

const KDF_SALT = 'EBESExQVFhcYGRobHB0eHw==';

describe('vault key wrapping', () => {
  it('generates 32 random bytes', () => {
    const first = generateVaultKey();
    const second = generateVaultKey();

    expect(first).toHaveLength(32);
    expect(first).not.toEqual(second);
  });

  it('rejects keys that are not 32 bytes', async () => {
    await expect(wrapVaultKey(randomKey(16), randomKey())).rejects.toThrow(InvalidKeyMaterialError);
    await expect(wrapVaultKey(generateVaultKey(), randomKey(16))).rejects.toThrow(InvalidKeyMaterialError);
    await expect(unwrapVaultKey({ ciphertext: 'AA==', iv: 'AA==' }, randomKey(16))).rejects.toThrow(
      InvalidKeyMaterialError,
    );
  });

  it('round-trips with the correct wrap key', async () => {
    const vaultKey = generateVaultKey();
    const wrapKey = randomKey();
    const wrapped = await wrapVaultKey(vaultKey, wrapKey);

    await expect(unwrapVaultKey(wrapped, wrapKey)).resolves.toEqual(vaultKey);
  });

  it('fails with the wrong wrap key', async () => {
    const wrapped = await wrapVaultKey(generateVaultKey(), randomKey());

    await expect(unwrapVaultKey(wrapped, randomKey())).rejects.toThrow(WrongPasswordError);
  });

  it('fails when one ciphertext byte is altered', async () => {
    const wrapKey = randomKey();
    const wrapped = await wrapVaultKey(generateVaultKey(), wrapKey);
    const tampered = { ...wrapped, ciphertext: mutateBase64Byte(wrapped.ciphertext) };

    await expect(unwrapVaultKey(tampered, wrapKey)).rejects.toThrow(WrongPasswordError);
  });

  it('uses a fresh IV per wrap', async () => {
    const vaultKey = generateVaultKey();
    const wrapKey = randomKey();

    const first = await wrapVaultKey(vaultKey, wrapKey);
    const second = await wrapVaultKey(vaultKey, wrapKey);

    expect(first.iv).not.toBe(second.iv);
  });

  it('keeps existing ciphertext readable after a password change', async () => {
    const vaultKey = generateVaultKey();
    const item = await sealItem({ name: 'Example' }, vaultKey);

    const firstWrapKey = await deriveWrapKey(await deriveMasterKey('first password', KDF_SALT), KDF_SALT);
    await wrapVaultKey(vaultKey, firstWrapKey);

    const secondWrapKey = await deriveWrapKey(await deriveMasterKey('second password', KDF_SALT), KDF_SALT);
    const rewrapped = await wrapVaultKey(vaultKey, secondWrapKey);

    const recovered = await unwrapVaultKey(rewrapped, secondWrapKey);
    await expect(openItem(item, recovered)).resolves.toEqual({ name: 'Example' });

    const legacyWrapKey = await deriveWrapKey(await deriveMasterKey('first password', KDF_SALT), KDF_SALT);
    await expect(unwrapVaultKey(rewrapped, legacyWrapKey)).rejects.toThrow(WrongPasswordError);
  });

  it('encodes the kdf salt for reuse across derivations', () => {
    expect(encodeBase64(new Uint8Array(16))).toBe('AAAAAAAAAAAAAAAAAAAAAA==');
  });
});
