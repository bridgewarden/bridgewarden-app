import { describe, expect, it } from 'vitest';

import { DEFAULT_KDF_ITERATIONS } from '../contract';
import { encodeBase64 } from '../encoding';
import { deriveMasterKey } from '../kdf';

const percentile = (values: number[], p: number): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] ?? 0;
};

describe('unlock benchmark', () => {
  it('keeps unlock p95 within the PRD budget', { timeout: 20_000 }, async () => {
    const salt = encodeBase64(crypto.getRandomValues(new Uint8Array(16)));
    const durations: number[] = [];

    for (let run = 0; run < 20; run += 1) {
      const started = performance.now();
      await deriveMasterKey('correct horse battery staple', salt, DEFAULT_KDF_ITERATIONS);
      durations.push(performance.now() - started);
    }

    const p95 = percentile(durations, 95);
    console.log(`PBKDF2-SHA256 ${DEFAULT_KDF_ITERATIONS} p95: ${p95.toFixed(1)}ms`);

    expect(p95).toBeLessThan(1000);
  });
});
