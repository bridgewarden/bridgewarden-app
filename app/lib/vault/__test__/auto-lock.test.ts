import { describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_AUTO_LOCK,
  createAutoLockStore,
  isIdleExpired,
  parseAutoLockMinutes,
  parseLockOnHide,
  shouldLockOnVisibility,
  timeoutMs,
} from '../auto-lock';

const fakeStorage = (values: Record<string, string> = {}) => {
  const data = new Map(Object.entries(values));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
    data,
  };
};

describe('auto-lock preferences', () => {
  it('uses defaults when storage is missing or invalid', () => {
    expect(createAutoLockStore(null).get()).toEqual(DEFAULT_AUTO_LOCK);
    expect(createAutoLockStore(fakeStorage({ bw_auto_lock_minutes: '7', bw_lock_on_hide: 'yes' })).get()).toEqual(
      DEFAULT_AUTO_LOCK,
    );
    expect(parseAutoLockMinutes(null)).toBe(15);
    expect(parseAutoLockMinutes('never')).toBe('never');
    expect(parseAutoLockMinutes('30')).toBe(30);
    expect(parseAutoLockMinutes('0')).toBe(15);
    expect(parseLockOnHide('true')).toBe(true);
    expect(parseLockOnHide('false')).toBe(false);
    expect(createAutoLockStore(fakeStorage({ bw_auto_lock_minutes: '30', bw_lock_on_hide: 'true' })).get()).toEqual({
      minutes: 30,
      lockOnHide: true,
    });
  });

  it('falls back to the in-memory snapshot when storage throws', () => {
    const throwing = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    };
    const store = createAutoLockStore(throwing);

    expect(store.get()).toEqual(DEFAULT_AUTO_LOCK);
    store.setMinutes(5);
    expect(store.get()).toEqual({ minutes: 5, lockOnHide: false });
  });

  it('notifies subscribers and persists one changed key at a time', () => {
    const storage = fakeStorage();
    const store = createAutoLockStore(storage);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.setMinutes(30);
    store.setLockOnHide(true);
    unsubscribe();
    store.setMinutes('never');

    expect(listener).toHaveBeenCalledTimes(2);
    expect(storage.data.get('bw_auto_lock_minutes')).toBe('never');
    expect(storage.data.get('bw_lock_on_hide')).toBe('true');
    expect(store.get()).toEqual({ minutes: 'never', lockOnHide: true });

    const second = createAutoLockStore(storage);
    second.setLockOnHide(false);
    expect(storage.data.get('bw_auto_lock_minutes')).toBe('never');

    second.reset();
    expect(second.get()).toEqual(DEFAULT_AUTO_LOCK);
    expect(storage.data.has('bw_auto_lock_minutes')).toBe(false);
    expect(storage.data.has('bw_lock_on_hide')).toBe(false);
  });
});

describe('auto-lock decisions', () => {
  const minute = 60_000;

  it('computes timeouts and the never case', () => {
    expect(timeoutMs(1)).toBe(minute);
    expect(timeoutMs(60)).toBe(60 * minute);
    expect(timeoutMs('never')).toBeNull();
    expect(isIdleExpired(0, minute - 1, 1)).toBe(false);
    expect(isIdleExpired(0, minute, 1)).toBe(true);
    expect(isIdleExpired(0, 10 * minute, 'never')).toBe(false);
  });

  it('locks on hide only when enabled, and on return only when expired', () => {
    const base = { lastActivity: 0, minutes: 1 as const };
    expect(shouldLockOnVisibility({ ...base, hidden: true, lockOnHide: false, now: 10 * minute })).toBe(false);
    expect(shouldLockOnVisibility({ ...base, hidden: true, lockOnHide: true, now: 1 })).toBe(true);
    expect(shouldLockOnVisibility({ ...base, hidden: false, lockOnHide: true, now: minute - 1 })).toBe(false);
    expect(shouldLockOnVisibility({ ...base, hidden: false, lockOnHide: true, now: minute })).toBe(true);
  });
});
