import { describe, expect, it } from 'vitest';

import { invalidateSetupState, requireBootstrapAvailable, requireConfigured } from '../setup-guard';

const cache = () => {
  let value: string | null = null;
  let reads = 0;
  let writes = 0;
  let deletes = 0;
  const env = {
    KV_SESSIONS: {
      get: async () => {
        reads += 1;
        return value;
      },
      put: async (_key: string, next: string) => {
        writes += 1;
        value = next;
      },
      delete: async () => {
        deletes += 1;
        value = null;
      },
    },
    DB: { prepare: () => ({ first: async () => ({ count: 0 }) }) },
  } as never;
  return { env, stats: () => ({ reads, writes, deletes }) };
};

describe('setup guard cache', () => {
  it('memoizes the configured state for repeated document loaders', async () => {
    const fake = cache();
    await expect(requireConfigured(fake.env)).rejects.toBeDefined();
    await expect(requireConfigured(fake.env)).rejects.toBeDefined();
    expect(fake.stats()).toEqual({ reads: 2, writes: 1, deletes: 0 });
  });

  it('invalidates the memoized state after bootstrap', async () => {
    const fake = cache();
    await invalidateSetupState(fake.env);
    expect(fake.stats()).toEqual({ reads: 0, writes: 0, deletes: 1 });
    await expect(requireBootstrapAvailable(fake.env)).resolves.toBeUndefined();
  });
});
