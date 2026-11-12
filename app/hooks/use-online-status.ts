import { useSyncExternalStore } from 'react';

const listeners = new Set<() => void>();
let listening = false;

const notify = () => {
  for (const listener of listeners) listener();
};

const startListening = () => {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  window.addEventListener('online', notify);
  window.addEventListener('offline', notify);
};

const subscribe = (listener: () => void) => {
  startListening();
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getSnapshot = () => (typeof navigator === 'undefined' ? true : navigator.onLine);

export const useOnlineStatus = () => useSyncExternalStore(subscribe, getSnapshot, () => true);
