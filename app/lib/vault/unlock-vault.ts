import { WrongPasswordError } from '../crypto/errors';
import { readKeyMaterial } from './key-material';
import type { UnlockResult } from './types';

export type UnlockDeps = {
  readFailures: () => number;
  writeFailures: (count: number) => void;
  clearFailures: () => void;
  isCurrent: () => boolean;
  setKey: (key: Uint8Array) => void;
  maxFailures: number;
};

export const performUnlock = async (password: string, deps: UnlockDeps): Promise<UnlockResult> => {
  const { prepareLogin, unwrapLoginVault } = await import('../crypto/login-keys');
  let material;
  try {
    material = await readKeyMaterial();
  } catch {
    return { status: 'unavailable' };
  }
  if (!material) return { status: 'unavailable' };

  let prepared;
  try {
    prepared = await prepareLogin(password, material.kdfSalt, material.kdfIterations);
  } catch {
    return { status: 'unavailable' };
  }

  try {
    const vaultKey = await unwrapLoginVault(material.vaultKeyWrapped, material.vaultKeyWrapIv, prepared.wrapKey);
    if (!deps.isCurrent()) {
      vaultKey.fill(0);
      return { status: 'unavailable' };
    }
    deps.setKey(vaultKey);
    vaultKey.fill(0);
    deps.clearFailures();
    return { status: 'ok' };
  } catch (error) {
    if (!(error instanceof WrongPasswordError)) return { status: 'unavailable' };
    const failures = deps.readFailures() + 1;
    deps.writeFailures(failures);
    return { status: failures >= deps.maxFailures ? 'locked-out' : 'invalid' };
  } finally {
    prepared.wrapKey.fill(0);
  }
};
