import { describe, expect, it } from 'vitest';

import { generateSetupKeyMaterial } from '../../setup/setup-keys';
import { prepareLogin, unwrapLoginVault } from '../login-keys';

describe('login key preparation', () => {
  it('derives the same auth hash and unwraps the vault key', async () => {
    const password = 'correct horse battery staple';
    const setup = await generateSetupKeyMaterial(password);

    const prepared = await prepareLogin(password, setup.kdfSalt, setup.kdfIterations);
    const vaultKey = await unwrapLoginVault(setup.vaultKeyWrapped, setup.vaultKeyWrapIv, prepared.wrapKey);
    prepared.wrapKey.fill(0);

    expect(prepared.authHash).toBe(setup.authHash);
    expect(vaultKey).toEqual(setup.vaultKey);
  });
});
