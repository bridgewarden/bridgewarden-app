import { useEffect } from 'react';

import { useBlocker } from 'react-router';

export const useUnsavedGuard = (dirty: boolean, busy: boolean) => {
  const blocker = useBlocker(dirty && !busy);

  useEffect(() => {
    if (!dirty || busy) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [busy, dirty]);

  return blocker;
};
