import { useEffect, useRef } from 'react';

export const useStepFocus = (
  step: string | null,
  titleId: string,
  panelId: string,
  options: { focusTitleOnMount?: boolean } = {},
) => {
  const previousStep = useRef(step);

  useEffect(() => {
    if (options.focusTitleOnMount === false) return;
    document.getElementById(titleId)?.focus();
  }, [options.focusTitleOnMount, titleId]);

  useEffect(() => {
    if (previousStep.current === step) return;
    previousStep.current = step;
    document.getElementById(panelId)?.focus();
  }, [panelId, step]);
};
