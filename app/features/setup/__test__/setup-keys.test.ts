import { describe, expect, it } from 'vitest';

import { fromBase64Url } from '../../../lib/base64-url';
import { encodeBase64 } from '../../../lib/crypto/encoding';
import { deriveMasterKey, deriveWrapKey } from '../../../lib/crypto/kdf';
import { parseRecoveryKey, unwrapVaultKeyWithRecovery } from '../../../lib/crypto/recovery';
import { unwrapVaultKey } from '../../../lib/crypto/vault-key';
import { generateSetupKeyMaterial, toSetupPayload } from '../setup-keys';

const decode = (value: string) => fromBase64Url(value);

describe('setup key generation', () => {
  it('produces transport-safe material that round-trips', async () => {
    const password = 'correct horse battery staple';
    const keys = await generateSetupKeyMaterial(password);

    expect(decode(keys.kdfSalt)).toHaveLength(16);
    expect(decode(keys.authHash)).toHaveLength(32);
    expect(decode(keys.vaultKeyWrapped)).toHaveLength(48);
    expect(decode(keys.vaultKeyWrapIv)).toHaveLength(12);
    expect(decode(keys.recoveryKeyWrapped)).toHaveLength(48);
    expect(decode(keys.recoveryKeyWrapIv)).toHaveLength(12);
    expect(keys.recoveryKey.replaceAll('-', '')).toHaveLength(26);

    const standardSalt = encodeBase64(decode(keys.kdfSalt));
    const wrapKey = await deriveWrapKey(await deriveMasterKey(password, standardSalt), standardSalt);
    const unwrapped = await unwrapVaultKey(
      { ciphertext: encodeBase64(decode(keys.vaultKeyWrapped)), iv: encodeBase64(decode(keys.vaultKeyWrapIv)) },
      wrapKey,
    );

    expect(unwrapped).toEqual(keys.vaultKey);

    const recovered = await unwrapVaultKeyWithRecovery(
      {
        ciphertext: encodeBase64(decode(keys.recoveryKeyWrapped)),
        iv: encodeBase64(decode(keys.recoveryKeyWrapIv)),
      },
      parseRecoveryKey(keys.recoveryKey),
    );

    expect(recovered).toEqual(keys.vaultKey);
  });

  it('never returns the password and keeps the vault key out of the payload', async () => {
    const keys = await generateSetupKeyMaterial('a very long master password');
    const payload = toSetupPayload(keys, { token: 't', email: 'a@example.com', displayName: 'A' });

    expect(Object.keys(keys)).not.toContain('password');
    expect(keys.vaultKey).toHaveLength(32);
    expect(payload).not.toHaveProperty('vaultKey');
    expect(JSON.stringify(payload)).not.toContain('a very long master password');
  });

  it('builds a payload without key material', async () => {
    const keys = await generateSetupKeyMaterial('another long password');
    const payload = toSetupPayload(keys, {
      token: 'token',
      email: 'admin@example.com',
      displayName: 'Admin',
    });

    expect(payload).not.toHaveProperty('vaultKey');
    expect(payload).not.toHaveProperty('recoveryKey');
    expect(JSON.stringify(payload)).not.toContain(keys.recoveryKey);
  });
});
