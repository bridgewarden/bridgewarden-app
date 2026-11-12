export type RevealController = {
  reveal: () => void;
  hide: () => void;
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => boolean;
  dispose: () => void;
};

export const createRevealController = (timeoutMs = 30_000): RevealController => {
  let revealed = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const listeners = new Set<() => void>();

  const emit = () => {
    for (const listener of listeners) listener();
  };

  const clearTimer = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  const hide = () => {
    clearTimer();
    if (!revealed) return;
    revealed = false;
    emit();
  };

  const reveal = () => {
    clearTimer();
    if (!revealed) {
      revealed = true;
      emit();
    }
    timer = setTimeout(hide, timeoutMs);
  };

  return {
    reveal,
    hide,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => revealed,
    dispose: () => {
      clearTimer();
      listeners.clear();
    },
  };
};
