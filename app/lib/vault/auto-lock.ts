export const AUTO_LOCK_MINUTES = [1, 5, 15, 30, 60] as const;
export const AUTO_LOCK_OPTIONS = [...AUTO_LOCK_MINUTES, 'never'] as const;
export type AutoLockMinutes = (typeof AUTO_LOCK_OPTIONS)[number];

export type AutoLockPreferences = {
  minutes: AutoLockMinutes;
  lockOnHide: boolean;
};

type AutoLockStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const MINUTES_KEY = 'bw_auto_lock_minutes';
const HIDE_KEY = 'bw_lock_on_hide';

export const DEFAULT_AUTO_LOCK: Readonly<AutoLockPreferences> = Object.freeze({ minutes: 15, lockOnHide: false });

const validMinutes = (value: number): value is (typeof AUTO_LOCK_MINUTES)[number] =>
  AUTO_LOCK_MINUTES.some((minutes) => minutes === value);

export const parseAutoLockMinutes = (raw: string | null): AutoLockMinutes => {
  if (raw === 'never') return 'never';
  const parsed = Number(raw);
  return raw !== null && Number.isInteger(parsed) && validMinutes(parsed) ? parsed : DEFAULT_AUTO_LOCK.minutes;
};

export const parseLockOnHide = (raw: string | null): boolean => raw === 'true';

const browserStorage = (): AutoLockStorage | undefined => {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
};

const readPreferences = (storage: AutoLockStorage | null): AutoLockPreferences => {
  if (!storage) return DEFAULT_AUTO_LOCK;
  try {
    return {
      minutes: parseAutoLockMinutes(storage.getItem(MINUTES_KEY)),
      lockOnHide: parseLockOnHide(storage.getItem(HIDE_KEY)),
    };
  } catch {
    return DEFAULT_AUTO_LOCK;
  }
};

export const createAutoLockStore = (storage: AutoLockStorage | null = browserStorage() ?? null) => {
  let snapshot = readPreferences(storage);
  const listeners = new Set<() => void>();

  const update = (patch: Partial<AutoLockPreferences>): void => {
    snapshot = { ...snapshot, ...patch };
    try {
      if (patch.minutes !== undefined) storage?.setItem(MINUTES_KEY, String(patch.minutes));
      if (patch.lockOnHide !== undefined) storage?.setItem(HIDE_KEY, String(patch.lockOnHide));
    } catch {
      // Keep the in-memory snapshot when storage is unavailable.
    }
    for (const listener of listeners) listener();
  };

  return {
    get: (): AutoLockPreferences => snapshot,
    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setMinutes: (minutes: AutoLockMinutes): void => update({ minutes }),
    setLockOnHide: (lockOnHide: boolean): void => update({ lockOnHide }),
    reload: (): void => {
      snapshot = readPreferences(storage);
      for (const listener of listeners) listener();
    },
    reset: (): void => {
      snapshot = DEFAULT_AUTO_LOCK;
      try {
        storage?.removeItem(MINUTES_KEY);
        storage?.removeItem(HIDE_KEY);
      } catch {
        // Keep the in-memory default when storage is unavailable.
      }
      for (const listener of listeners) listener();
    },
  };
};

const store = createAutoLockStore();

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== null && event.key !== MINUTES_KEY && event.key !== HIDE_KEY) return;
    store.reload();
  });
}

export const getAutoLockPreferences = store.get;
export const subscribeAutoLock = store.subscribe;
export const setAutoLockMinutes = store.setMinutes;
export const setLockOnHide = store.setLockOnHide;
export const resetAutoLockPreferences = store.reset;
export const autoLockServerSnapshot = (): AutoLockPreferences => DEFAULT_AUTO_LOCK;

export const timeoutMs = (minutes: AutoLockMinutes): number | null =>
  minutes === 'never' ? null : minutes * 60 * 1000;

export const isIdleExpired = (lastActivity: number, now: number, minutes: AutoLockMinutes): boolean => {
  const timeout = timeoutMs(minutes);
  return timeout !== null && now - lastActivity >= timeout;
};

type VisibilityInput = {
  hidden: boolean;
  lockOnHide: boolean;
  lastActivity: number;
  now: number;
  minutes: AutoLockMinutes;
};

export const shouldLockOnVisibility = ({ hidden, lockOnHide, lastActivity, now, minutes }: VisibilityInput): boolean =>
  hidden ? lockOnHide : isIdleExpired(lastActivity, now, minutes);
