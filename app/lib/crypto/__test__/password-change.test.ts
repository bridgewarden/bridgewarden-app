import { describe, expect, it } from 'vitest';

import { base64UrlToStandard } from '../../base64-url';
import { WrongPasswordError } from '../errors';
import { prepareLogin } from '../login-keys';
import { rewrapPassword } from '../password-change';
import { parseRecoveryKey, unwrapVaultKeyWithRecovery } from '../recovery';
import { generateSetupKeyMaterial } from '../setup-keys';
import { unwrapVaultKey } from '../vault-key';

describe('password change', () => {
  it('rewraps the same vault key and leaves the recovery wrapper usable', async () => {
    const oldPassword = 'old master password 123';
    const newPassword = 'new master password 456';
    const setup = await generateSetupKeyMaterial(oldPassword);
    const current = await prepareLogin(oldPassword, setup.kdfSalt, setup.kdfIterations);

    try {
      const result = await rewrapPassword(current.authHash, current.wrapKey, newPassword, {
        vaultKeyWrapped: setup.vaultKeyWrapped,
        vaultKeyWrapIv: setup.vaultKeyWrapIv,
      });
      const next = await prepareLogin(newPassword, result.request.kdfSalt, result.request.kdfIterations);

      try {
        expect(result.request.kdfSalt).not.toBe(setup.kdfSalt);
        expect(result.request.vaultKeyWrapIv).not.toBe(setup.vaultKeyWrapIv);
        expect(next.authHash).toBe(result.request.authHash);

        const unwrapped = await unwrapVaultKey(
          {
            ciphertext: base64UrlToStandard(result.request.vaultKeyWrapped),
            iv: base64UrlToStandard(result.request.vaultKeyWrapIv),
          },
          next.wrapKey,
        );
        expect(unwrapped).toEqual(setup.vaultKey);

        const recovered = await unwrapVaultKeyWithRecovery(
          {
            ciphertext: base64UrlToStandard(setup.recoveryKeyWrapped),
            iv: base64UrlToStandard(setup.recoveryKeyWrapIv),
          },
          parseRecoveryKey(setup.recoveryKey),
        );
        expect(recovered).toEqual(setup.vaultKey);
      } finally {
        next.wrapKey.fill(0);
      }
    } finally {
      current.wrapKey.fill(0);
    }
  }, 20_000);

  it('rejects the old password wrapper under the new wrap key', async () => {
    const oldPassword = 'old master password 123';
    const newPassword = 'new master password 456';
    const setup = await generateSetupKeyMaterial(oldPassword);
    const current = await prepareLogin(oldPassword, setup.kdfSalt, setup.kdfIterations);

    try {
      const result = await rewrapPassword(current.authHash, current.wrapKey, newPassword, {
        vaultKeyWrapped: setup.vaultKeyWrapped,
        vaultKeyWrapIv: setup.vaultKeyWrapIv,
      });
      const next = await prepareLogin(newPassword, result.request.kdfSalt, result.request.kdfIterations);

      try {
        await expect(
          unwrapVaultKey(
            {
              ciphertext: base64UrlToStandard(setup.vaultKeyWrapped),
              iv: base64UrlToStandard(setup.vaultKeyWrapIv),
            },
            next.wrapKey,
          ),
        ).rejects.toThrow(WrongPasswordError);
        expect(current.authHash).not.toBe(result.request.authHash);
      } finally {
        next.wrapKey.fill(0);
      }
    } finally {
      current.wrapKey.fill(0);
    }
  }, 20_000);
});
