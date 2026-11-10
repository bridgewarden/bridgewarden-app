import { describe, expect, it } from 'vitest';

import { base64UrlToStandard } from '../../base64-url';
import { prepareLogin } from '../login-keys';
import { rewrapPassword } from '../password-change';
import { generateSetupKeyMaterial } from '../setup-keys';
import { unwrapVaultKey } from '../vault-key';

describe('password change', () => {
  it('rewraps the same vault key under the new password', async () => {
    const oldPassword = 'old master password 123';
    const newPassword = 'new master password 456';
    const setup = await generateSetupKeyMaterial(oldPassword);
    const current = await prepareLogin(oldPassword, setup.kdfSalt, setup.kdfIterations);

    try {
      const result = await rewrapPassword(current.authHash, current.wrapKey, newPassword, {
        vaultKeyWrapped: setup.vaultKeyWrapped,
        vaultKeyWrapIv: setup.vaultKeyWrapIv,
      });

      expect(result.request.kdfSalt).not.toBe(setup.kdfSalt);
      expect(result.request.authHash).not.toBe(setup.authHash);

      const newMaster = await deriveMasterKeyForTest(newPassword, result.request.kdfSalt);
      const newWrap = await deriveWrapKeyForTest(newMaster, result.request.kdfSalt);
      const unwrapped = await unwrapVaultKey(
        {
          ciphertext: base64UrlToStandard(result.request.vaultKeyWrapped),
          iv: base64UrlToStandard(result.request.vaultKeyWrapIv),
        },
        newWrap,
      );
      expect(unwrapped).toEqual(setup.vaultKey);
    } finally {
      current.wrapKey.fill(0);
    }
  });
});

const deriveMasterKeyForTest = async (password: string, salt: string) => {
  const { deriveMasterKey } = await import('../kdf');
  return deriveMasterKey(password, base64UrlToStandard(salt), 600_000);
};

const deriveWrapKeyForTest = async (masterKey: Uint8Array, salt: string) => {
  const { deriveWrapKey } = await import('../kdf');
  return deriveWrapKey(masterKey, base64UrlToStandard(salt));
};
