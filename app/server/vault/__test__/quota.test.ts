import { describe, expect, it } from 'vitest';

import { exceedsItemQuota } from '../queries/quota';
import { MAX_ACTIVE_ITEMS, MAX_ITEM_BYTES, MAX_ITEM_ROWS } from '../types';

describe('item quota helper', () => {
  it('rejects active, lifetime, and encoded-byte boundaries', () => {
    expect(exceedsItemQuota({ active: MAX_ACTIVE_ITEMS, rows: 1, bytes: 0 }, 1)).toBe(true);
    expect(exceedsItemQuota({ active: 1, rows: MAX_ITEM_ROWS, bytes: 0 }, 1)).toBe(true);
    expect(exceedsItemQuota({ active: 1, rows: 1, bytes: (MAX_ITEM_BYTES * 4) / 3 }, 1)).toBe(true);
    expect(exceedsItemQuota({ active: 1, rows: 1, bytes: 100 }, 100, 100)).toBe(false);
  });
});
