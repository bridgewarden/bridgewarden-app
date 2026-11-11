import { WrongPasswordError } from '../crypto/errors';
import { prepareLogin, unwrapLoginVault } from '../crypto/login-keys';
import { readKeyMaterial } from './key-material';
import { clearVaultKey, getKeyVersion, isUnlocked, setVaultKey } from './key-store';
import type { UnlockResult } from './types';

const FAILURE_KEY = 'bw_unlock_failures';
const MAX_UNLOCK_FAILURES = 5;
const LOCK_CHANNEL = 'bw-vault-lock';
let unlockAttempt = 0;

const applyLock = (): void => {
  unlockAttempt += 1;
  clearVaultKey();
};

const lockChannel =
  typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(LOCK_CHANNEL) : null;

lockChannel?.addEventListener('message', (event: MessageEvent<{ type?: string }>) => {
  if (event.data?.type === 'lock') applyLock();
});
let fallbackFailures = 0;

const readFailures = (): number => {
  try {
    const raw = globalThis.sessionStorage?.getItem(FAILURE_KEY);
    if (raw === null || raw === undefined) return fallbackFailures;
    const parsed = Number(raw);
    return Number.isInteger(parsed) && parsed >= 0 ? Math.min(parsed, MAX_UNLOCK_FAILURES) : fallbackFailures;
  } catch {
    return fallbackFailures;
  }
};

const writeFailures = (count: number): void => {
  fallbackFailures = count;
  try {
    globalThis.sessionStorage?.setItem(FAILURE_KEY, String(count));
  } catch {
    return;
  }
};

export const clearUnlockFailures = (): void => {
  fallbackFailures = 0;
  try {
    globalThis.sessionStorage?.removeItem(FAILURE_KEY);
  } catch {
    return;
  }
};

export const hasExceededUnlockAttempts = (): boolean => readFailures() >= MAX_UNLOCK_FAILURES;

export const lockVault = (): void => {
  applyLock();
  lockChannel?.postMessage({ type: 'lock' });
};

export const unlockVault = async (password: string): Promise<UnlockResult> => {
  if (isUnlocked()) return { status: 'ok' };
  if (hasExceededUnlockAttempts()) return { status: 'locked-out' };
  if (!password) return { status: 'invalid' };
  const attempt = ++unlockAttempt;
  const version = getKeyVersion();

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
    if (attempt !== unlockAttempt || version !== getKeyVersion()) {
      vaultKey.fill(0);
      return { status: 'unavailable' };
    }
    setVaultKey(vaultKey);
    vaultKey.fill(0);
    clearUnlockFailures();
    return { status: 'ok' };
  } catch (error) {
    if (!(error instanceof WrongPasswordError)) return { status: 'unavailable' };
    const failures = readFailures() + 1;
    writeFailures(failures);
    return { status: failures >= MAX_UNLOCK_FAILURES ? 'locked-out' : 'invalid' };
  } finally {
    prepared.wrapKey.fill(0);
  }
};
