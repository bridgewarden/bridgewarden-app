import { describe, expect, it } from 'vitest';

import { DEFAULT_KDF_ITERATIONS } from '../contract';
import { encodeBase64 } from '../encoding';
import { deriveMasterKey } from '../kdf';

describe('unlock benchmark', () => {
  it('derives a master key within the PRD budget', async () => {
    const salt = encodeBase64(crypto.getRandomValues(new Uint8Array(16)));
    const started = performance.now();

    await deriveMasterKey('correct horse battery staple', salt, DEFAULT_KDF_ITERATIONS);

    const duration = performance.now() - started;
    console.log(`PBKDF2-SHA256 ${DEFAULT_KDF_ITERATIONS}: ${duration.toFixed(1)}ms`);

    expect(duration).toBeLessThan(1000);
  });
});
