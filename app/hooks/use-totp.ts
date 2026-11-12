import { useEffect, useState } from 'react';

import { currentTotpStep, generateTotp, TOTP_STEP_MS, TOTP_STEP_SECONDS, TotpError } from '~/lib/totp';

type TotpState = {
  code: string | null;
  secondsRemaining: number;
  invalid: boolean;
};

const remainingSeconds = (now: number): number =>
  Math.max(1, TOTP_STEP_SECONDS - (Math.floor(now / 1000) % TOTP_STEP_SECONDS));

export const useTotpCode = (secret: string) => {
  const [state, setState] = useState<TotpState>({
    code: null,
    secondsRemaining: TOTP_STEP_SECONDS,
    invalid: false,
  });

  useEffect(() => {
    let active = true;
    let boundaryTimer: ReturnType<typeof setTimeout> | null = null;
    const displayTimer = setInterval(() => {
      if (active) {
        setState((current) => ({ ...current, secondsRemaining: remainingSeconds(Date.now()) }));
      }
    }, 1_000);

    const tick = async () => {
      const now = Date.now();
      try {
        const code = await generateTotp(secret, currentTotpStep(now));
        if (!active) return;
        setState({ code, secondsRemaining: remainingSeconds(now), invalid: false });
        boundaryTimer = setTimeout(() => void tick(), TOTP_STEP_MS - (now % TOTP_STEP_MS) + 25);
      } catch (error) {
        if (!active) return;
        if (error instanceof TotpError) {
          setState({ code: null, secondsRemaining: remainingSeconds(now), invalid: true });
          return;
        }
        boundaryTimer = setTimeout(() => void tick(), 1_000);
      }
    };

    void tick();
    return () => {
      active = false;
      clearInterval(displayTimer);
      if (boundaryTimer !== null) clearTimeout(boundaryTimer);
    };
  }, [secret]);

  return state;
};
