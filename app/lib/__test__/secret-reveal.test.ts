import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createRevealController } from '../secret-reveal';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('secret reveal controller', () => {
  it('auto-hides after the timeout', () => {
    const controller = createRevealController(30_000);
    controller.reveal();
    expect(controller.getSnapshot()).toBe(true);
    vi.advanceTimersByTime(30_000);
    expect(controller.getSnapshot()).toBe(false);
    controller.dispose();
  });

  it('hide cancels the timeout and dispose is safe', () => {
    const controller = createRevealController(30_000);
    controller.reveal();
    controller.hide();
    vi.advanceTimersByTime(30_000);
    expect(controller.getSnapshot()).toBe(false);
    controller.dispose();
  });
});
