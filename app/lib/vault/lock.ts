import { clearSecretClipboard } from '../clipboard';
import { clearVaultKey, getKeyVersion, isUnlocked, setVaultKey } from './key-store';
import type { UnlockResult } from './types';

const FAILURE_KEY = 'bw_unlock_failures';
const MAX_UNLOCK_FAILURES = 5;
const LOCK_CHANNEL = 'bw-vault-lock';
let unlockAttempt = 0;

const applyLock = (): void => {
  unlockAttempt += 1;
  void clearSecretClipboard();
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
  const { performUnlock } = await import('./unlock-vault');

  return performUnlock(password, {
    readFailures,
    writeFailures,
    clearFailures: clearUnlockFailures,
    isCurrent: () => attempt === unlockAttempt && version === getKeyVersion(),
    setKey: setVaultKey,
    maxFailures: MAX_UNLOCK_FAILURES,
  });
};
