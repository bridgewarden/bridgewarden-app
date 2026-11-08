import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import { createTestUser } from '../../../__test__/fixtures';
import { resetDatabase } from '../../../__test__/reset-database';
import {
  consumeChallenge,
  createChallenge,
  MAX_CHALLENGE_ATTEMPTS,
  readChallenge,
  recordChallengeFailure,
} from '../challenge';
import { hashSessionToken } from '../session';

beforeEach(async () => {
  await resetDatabase();
});

describe('2FA challenge store', () => {
  it('creates, reads, and consumes a challenge', async () => {
    const userId = await createTestUser();
    const token = await createChallenge(env, userId);
    const stored = await readChallenge(env, token);

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(stored?.record).toMatchObject({ userId, attempts: 0 });
    await expect(consumeChallenge(env, token)).resolves.toBe(true);
    await expect(consumeChallenge(env, token)).resolves.toBe(false);
    expect(await readChallenge(env, token)).toBeNull();
  });

  it('rejects malformed, missing, expired, consumed, and exhausted challenges', async () => {
    const userId = await createTestUser();
    expect(await readChallenge(env, 'short')).toBeNull();
    expect(await readChallenge(env, 'A'.repeat(43))).toBeNull();

    const token = await createChallenge(env, userId);
    const hash = await hashSessionToken(token);
    await env.DB.prepare('UPDATE two_factor_challenges SET expires_at = ? WHERE token_hash = ?')
      .bind(Date.now() - 1, hash)
      .run();
    expect(await readChallenge(env, token)).toBeNull();

    const exhausted = await createChallenge(env, userId);
    await env.DB.prepare('UPDATE two_factor_challenges SET attempts = ? WHERE token_hash = ?')
      .bind(MAX_CHALLENGE_ATTEMPTS, await hashSessionToken(exhausted))
      .run();
    expect(await readChallenge(env, exhausted)).toBeNull();
  });

  it('invalidates after five atomic failures and cannot be resurrected', async () => {
    const userId = await createTestUser();
    const token = await createChallenge(env, userId);
    let stored = await readChallenge(env, token);

    for (let attempt = 1; attempt < MAX_CHALLENGE_ATTEMPTS; attempt += 1) {
      await expect(recordChallengeFailure(env, stored!)).resolves.toBe(false);
      stored = await readChallenge(env, token);
      expect(stored?.record.attempts).toBe(attempt);
    }

    await expect(recordChallengeFailure(env, stored!)).resolves.toBe(true);
    expect(await readChallenge(env, token)).toBeNull();
    await expect(recordChallengeFailure(env, stored!)).resolves.toBe(true);
  });
});
