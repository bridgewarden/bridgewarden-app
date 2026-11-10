import { describe, expect, it } from 'vitest';

import { toBase64Url } from '../../base64-url';
import { prepareLogin } from '../login-keys';
import {
  deriveRecoveryAuthKey,
  deriveRecoveryWrapKey,
  generateRecoverySecret,
  parseRecoveryKey,
  unwrapVaultKeyWithRecovery,
} from '../recovery';
import { prepareRecoveryReset } from '../recovery-reset';
import { generateSetupKeyMaterial } from '../setup-keys';
import { InvalidRecoveryKeyError } from '../errors';

describe('recovery auth proof', () => {
  it('is deterministic, 32 bytes, and distinct from the wrap key', async () => {
    const secret = generateRecoverySecret();
    const first = await deriveRecoveryAuthKey(secret);
    const second = await deriveRecoveryAuthKey(secret);
    const wrap = await deriveRecoveryWrapKey(secret);

    expect(first).toHaveLength(32);
    expect(first).toEqual(second);
    expect(first).not.toEqual(wrap);
  });

  it('rejects a secret of the wrong length', async () => {
    expect(() => deriveRecoveryAuthKey(new Uint8Array(4))).toThrow();
  });
});

describe('recovery reset', () => {
  it('keeps the vault key, regenerates the recovery key, and burns the old key', async () => {
    const setup = await generateSetupKeyMaterial('old master password 123');
    const oldSecret = parseRecoveryKey(setup.recoveryKey);
    const result = await prepareRecoveryReset(
      setup.recoveryKey,
      { recoveryKeyWrapped: setup.recoveryKeyWrapped, recoveryKeyWrapIv: setup.recoveryKeyWrapIv },
      'new master password 456',
    );

    try {
      expect(result.request.currentRecoveryAuthKey).toBe(toBase64Url(await deriveRecoveryAuthKey(oldSecret)));
      expect(result.recoveryKey).not.toBe(setup.recoveryKey);

      const newSecret = parseRecoveryKey(result.recoveryKey);
      const recovered = await unwrapVaultKeyWithRecovery(
        {
          ciphertext: Buffer.from(result.request.recoveryKeyWrapped, 'base64url').toString('base64'),
          iv: Buffer.from(result.request.recoveryKeyWrapIv, 'base64url').toString('base64'),
        },
        newSecret,
      );
      expect(recovered).toEqual(result.vaultKey);

      await expect(
        unwrapVaultKeyWithRecovery(
          {
            ciphertext: Buffer.from(result.request.recoveryKeyWrapped, 'base64url').toString('base64'),
            iv: Buffer.from(result.request.recoveryKeyWrapIv, 'base64url').toString('base64'),
          },
          oldSecret,
        ),
      ).rejects.toThrow(InvalidRecoveryKeyError);

      const next = await prepareLogin('new master password 456', result.request.kdfSalt, result.request.kdfIterations);
      try {
        expect(next.authHash).toBe(result.request.authHash);
        expect(result.request.recoveryAuthKey).not.toBe(result.request.currentRecoveryAuthKey);
      } finally {
        next.wrapKey.fill(0);
      }
    } finally {
      oldSecret.fill(0);
    }
  }, 20_000);
});
