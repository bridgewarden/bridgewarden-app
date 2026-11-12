import { useEffect, useRef } from 'react';

import { toast } from 'sonner';

import { t } from '~/lib/i18n/en';

export const useServiceWorker = () => {
  const prompted = useRef<ServiceWorkerRegistration | null>(null);
  const reloading = useRef(false);

  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;

    let disposed = false;

    const onControllerChange = () => {
      if (reloading.current) window.location.reload();
    };

    const prompt = (registration: ServiceWorkerRegistration) => {
      if (disposed || prompted.current === registration || !navigator.serviceWorker.controller) return;
      prompted.current = registration;
      toast(t('pwa.updateAvailable'), {
        id: 'pwa-update',
        duration: Infinity,
        action: {
          label: t('pwa.reload'),
          onClick: () => {
            const waiting = registration.waiting;
            if (!waiting) return;
            reloading.current = true;
            waiting.postMessage({ type: 'SKIP_WAITING' });
          },
        },
      });
    };

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    void navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        if (disposed) return;
        const track = (worker: ServiceWorker | null) => {
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed') prompt(registration);
          });
        };

        if (registration.waiting) prompt(registration);
        track(registration.installing);
        registration.addEventListener('updatefound', () => track(registration.installing));
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);
};
