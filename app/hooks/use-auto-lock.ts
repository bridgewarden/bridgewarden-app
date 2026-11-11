import { useEffect, useRef, useSyncExternalStore } from 'react';

import {
  autoLockServerSnapshot,
  getAutoLockPreferences,
  isIdleExpired,
  shouldLockOnVisibility,
  subscribeAutoLock,
  timeoutMs,
} from '~/lib/vault/auto-lock';
import { lockVault } from '~/lib/vault/lock';

export const useAutoLock = (enabled: boolean): void => {
  const preferences = useSyncExternalStore(subscribeAutoLock, getAutoLockPreferences, autoLockServerSnapshot);
  const lastActivityRef = useRef(0);

  useEffect(() => {
    if (enabled) lastActivityRef.current = Date.now();
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    const { minutes, lockOnHide } = preferences;
    const timeout = timeoutMs(minutes);
    if (timeout === null && !lockOnHide) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const expired = () => isIdleExpired(lastActivityRef.current, Date.now(), minutes);

    const schedule = () => {
      if (timeout === null) return;
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(lockVault, Math.max(0, timeout - (Date.now() - lastActivityRef.current)));
    };

    const onActivity = () => {
      if (expired()) {
        lockVault();
        return;
      }
      lastActivityRef.current = Date.now();
      schedule();
    };

    const onVisibility = () => {
      if (document.hidden) {
        if (lockOnHide) lockVault();
        return;
      }
      const shouldLock = shouldLockOnVisibility({
        hidden: false,
        lockOnHide,
        lastActivity: lastActivityRef.current,
        now: Date.now(),
        minutes,
      });
      if (shouldLock) {
        lockVault();
        return;
      }
      schedule();
    };

    if (document.hidden) {
      if (lockOnHide) {
        lockVault();
        return;
      }
    } else if (expired()) {
      lockVault();
      return;
    }

    schedule();
    if (timeout !== null) {
      window.addEventListener('pointerdown', onActivity, { passive: true });
      window.addEventListener('keydown', onActivity);
      window.addEventListener('touchstart', onActivity, { passive: true });
      window.addEventListener('scroll', onActivity, { capture: true, passive: true });
    }
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      if (timer !== undefined) clearTimeout(timer);
      window.removeEventListener('pointerdown', onActivity);
      window.removeEventListener('keydown', onActivity);
      window.removeEventListener('touchstart', onActivity);
      window.removeEventListener('scroll', onActivity, { capture: true });
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled, preferences]);
};
