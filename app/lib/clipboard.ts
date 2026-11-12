const CLEAR_DELAY_MS = 30_000;

export const copySecret = async (value: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(value);
    window.setTimeout(async () => {
      try {
        const current = await navigator.clipboard.readText();
        if (current === value) await navigator.clipboard.writeText('');
      } catch {
        // Some browsers cannot verify clipboard contents; the UI shows a manual-clear hint.
      }
    }, CLEAR_DELAY_MS);
    return true;
  } catch {
    return false;
  }
};
