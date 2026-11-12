import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearSecretClipboard, copySecret } from '../clipboard';

const clipboard = {
  writeText: vi.fn(),
  readText: vi.fn(),
};

beforeEach(async () => {
  vi.useFakeTimers();
  vi.stubGlobal('navigator', { clipboard });
  clipboard.writeText.mockReset().mockResolvedValue(undefined);
  clipboard.readText.mockReset().mockResolvedValue('first');
  await clearSecretClipboard();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('clipboard lifecycle', () => {
  it('cancels the previous timer when a new secret is copied', async () => {
    await copySecret('first');
    await copySecret('second');
    clipboard.readText.mockResolvedValue('second');
    await vi.advanceTimersByTimeAsync(30_000);

    expect(clipboard.writeText).toHaveBeenLastCalledWith('');
    expect(clipboard.writeText).toHaveBeenCalledTimes(3);
    expect(clipboard.readText).toHaveBeenCalledTimes(1);
  });

  it('does not overwrite a value changed by another application', async () => {
    await copySecret('secret');
    clipboard.readText.mockResolvedValue('other');
    await vi.advanceTimersByTimeAsync(30_000);
    expect(clipboard.writeText).not.toHaveBeenCalledWith('');
  });

  it('clears a pending value on explicit cleanup', async () => {
    await copySecret('secret');
    clipboard.readText.mockResolvedValue('secret');
    await clearSecretClipboard();
    expect(clipboard.writeText).toHaveBeenLastCalledWith('');
  });

  it('keeps the previous clear armed when a new write fails', async () => {
    await copySecret('first');
    clipboard.writeText.mockRejectedValueOnce(new Error('denied'));
    await expect(copySecret('second')).resolves.toBe(false);
    clipboard.readText.mockResolvedValue('first');
    await vi.advanceTimersByTimeAsync(30_000);
    expect(clipboard.writeText).toHaveBeenLastCalledWith('');
  });

  it('does not clear a newer copy when an older expiry finishes late', async () => {
    let resolveRead: ((value: string) => void) | undefined;
    clipboard.readText.mockReturnValueOnce(new Promise((resolve) => (resolveRead = resolve)));
    await copySecret('first');
    await vi.advanceTimersByTimeAsync(30_000);
    await copySecret('second');
    resolveRead?.('first');
    await Promise.resolve();
    expect(clipboard.writeText).not.toHaveBeenCalledWith('');
  });
});
