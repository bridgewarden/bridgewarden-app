const CLEAR_DELAY_MS = 30_000;

let clearTimer: ReturnType<typeof setTimeout> | null = null;
let pendingValue: string | null = null;
let copyGeneration = 0;

const cancelPendingClear = () => {
  if (clearTimer !== null) clearTimeout(clearTimer);
  clearTimer = null;
};

export const copySecret = async (value: string): Promise<boolean> => {
  if (typeof navigator === 'undefined' || !navigator.clipboard) return false;
  try {
    await navigator.clipboard.writeText(value);
    cancelPendingClear();
    const generation = ++copyGeneration;
    pendingValue = value;
    clearTimer = setTimeout(async () => {
      try {
        if (generation !== copyGeneration) return;
        const current = await navigator.clipboard.readText();
        if (generation === copyGeneration && current === value) await navigator.clipboard.writeText('');
      } catch {
        // Some browsers cannot verify clipboard contents; the UI shows a manual-clear hint.
      } finally {
        if (generation === copyGeneration) {
          clearTimer = null;
          pendingValue = null;
        }
      }
    }, CLEAR_DELAY_MS);
    return true;
  } catch {
    return false;
  }
};

export const clearSecretClipboard = async (): Promise<void> => {
  const value = pendingValue;
  const generation = ++copyGeneration;
  cancelPendingClear();
  pendingValue = null;
  if (!value || typeof navigator === 'undefined' || !navigator.clipboard) return;

  try {
    const current = await navigator.clipboard.readText();
    if (generation === copyGeneration && current === value) await navigator.clipboard.writeText('');
  } catch {
    // Verification is unavailable; the user was already told to clear manually.
  }
};
