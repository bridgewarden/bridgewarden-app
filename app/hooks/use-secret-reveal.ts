import { useEffect, useState, useSyncExternalStore } from 'react';

import { useLocation } from 'react-router';

import { createRevealController } from '~/lib/secret-reveal';
import { isUnlocked, subscribeKeyState } from '~/lib/vault/key-store';

export const useSecretReveal = () => {
  const [controller] = useState(() => createRevealController());
  const revealed = useSyncExternalStore(controller.subscribe, controller.getSnapshot, () => false);
  const { pathname } = useLocation();

  useEffect(() => {
    controller.hide();
  }, [controller, pathname]);

  useEffect(
    () =>
      subscribeKeyState(() => {
        if (!isUnlocked()) controller.hide();
      }),
    [controller],
  );

  useEffect(() => {
    const onBlur = () => controller.hide();
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('blur', onBlur);
      controller.dispose();
    };
  }, [controller]);

  return {
    revealed,
    reveal: controller.reveal,
    hide: controller.hide,
  };
};
