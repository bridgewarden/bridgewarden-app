import { useEffect } from 'react';

export const useSetupBeforeUnload = (enabled: boolean) => {
  useEffect(() => {
    if (!enabled) return;

    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [enabled]);
};
