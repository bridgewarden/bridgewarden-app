import { afterEach, describe, expect, it, vi } from 'vitest';

import { InvalidKeyMaterialError } from '../../crypto/errors';
import { clearVaultKey, getVaultKey, isUnlocked, setVaultKey, subscribeKeyState } from '../key-store';

afterEach(() => {
  clearVaultKey();
  vi.unstubAllGlobals();
});

describe('in-memory vault key store', () => {
  it('returns the key while set and forgets it after clear', () => {
    const key = crypto.getRandomValues(new Uint8Array(32));

    setVaultKey(key);
    expect(getVaultKey()).toEqual(key);

    clearVaultKey();
    expect(getVaultKey()).toBeNull();
  });

  it('keeps its own copy, returns a copy, and rejects the wrong length', () => {
    const key = crypto.getRandomValues(new Uint8Array(32));
    setVaultKey(key);
    key.fill(0);

    const read = getVaultKey()!;
    expect(read.some((byte) => byte !== 0)).toBe(true);
    read.fill(0);
    expect(getVaultKey()?.some((byte) => byte !== 0)).toBe(true);
    expect(() => setVaultKey(new Uint8Array(16))).toThrow(InvalidKeyMaterialError);
  });

  it('notifies subscribers on set and clear, but not on a redundant clear', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeKeyState(listener);

    setVaultKey(new Uint8Array(32));
    expect(isUnlocked()).toBe(true);
    clearVaultKey();
    clearVaultKey();
    unsubscribe();
    setVaultKey(new Uint8Array(32));

    expect(listener).toHaveBeenCalledTimes(2);
    expect(isUnlocked()).toBe(true);
  });

  it('never touches browser storage', () => {
    const setItem = vi.fn();
    const getItem = vi.fn();
    const removeItem = vi.fn();
    vi.stubGlobal('localStorage', { setItem, getItem, removeItem });

    setVaultKey(new Uint8Array(32));
    getVaultKey();
    clearVaultKey();

    expect(setItem).not.toHaveBeenCalled();
    expect(getItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
  });
});
