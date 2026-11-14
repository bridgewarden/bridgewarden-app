import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resetDatabase } from '../../../__test__/reset-database';
import { currentStep, generateCode } from '../../../lib/.server/totp';
import { generateAndStoreBackupCodes } from '../.server/backup-codes';
import { createChallenge, MAX_CHALLENGE_ATTEMPTS, readChallenge } from '../../../lib/.server/challenge';
import { verifyChallenge } from '../.server/use-cases/verify-challenge';
import { clearAuthKv, createTwoFactorUser, twoFactorEnv, TEST_PEPPER } from './two-factor-fixtures';

const request = () =>
  new Request('https://app.example/auth/2fa', {
    method: 'POST',
    headers: { 'user-agent': 'test-agent', 'cf-connecting-ip': '203.0.113.9' },
  });

beforeEach(async () => {
  await resetDatabase();
  await clearAuthKv();
});

afterEach(clearAuthKv);

describe('2FA challenge verification', () => {
  it('accepts a current TOTP code, issues a session, and prevents replay', async () => {
    const user = await createTwoFactorUser(1);
    const token = await createChallenge(twoFactorEnv(), user.userId);
    const code = await generateCode(user.secret, currentStep());

    const result = await verifyChallenge(twoFactorEnv(), request(), { challengeToken: token, code });

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.cookie).toContain('bw_session=');
    expect(result.body).toMatchObject({ requires2fa: false });
    expect(await readChallenge(twoFactorEnv(), token)).toBeNull();

    const replayToken = await createChallenge(twoFactorEnv(), user.userId);
    const replay = await verifyChallenge(twoFactorEnv(), request(), { challengeToken: replayToken, code });
    expect(replay).toMatchObject({ status: 'invalid-code', challengeInvalid: false });

    const audit = await env.DB.prepare("SELECT type FROM audit_events WHERE type = '2fa.verified'").first();
    expect(audit).toEqual({ type: '2fa.verified' });
  });

  it('accepts a backup code once and consumes it', async () => {
    const user = await createTwoFactorUser(1);
    const codes = await generateAndStoreBackupCodes(twoFactorEnv(), user.userId, TEST_PEPPER);
    const firstToken = await createChallenge(twoFactorEnv(), user.userId);

    const first = await verifyChallenge(twoFactorEnv(), request(), {
      challengeToken: firstToken,
      backupCode: codes[0],
    });
    expect(first.status).toBe('ok');

    const secondToken = await createChallenge(twoFactorEnv(), user.userId);
    const second = await verifyChallenge(twoFactorEnv(), request(), {
      challengeToken: secondToken,
      backupCode: codes[0],
    });
    expect(second.status).toBe('invalid-code');
  });

  it('carries failures across challenges, locks at the cumulative threshold, and recovers', async () => {
    const user = await createTwoFactorUser(1);
    const first = await createChallenge(twoFactorEnv(), user.userId);
    for (let attempt = 0; attempt < MAX_CHALLENGE_ATTEMPTS; attempt += 1) {
      await verifyChallenge(twoFactorEnv(), request(), { challengeToken: first, code: '000000' });
    }
    const second = await createChallenge(twoFactorEnv(), user.userId);
    let locked = false;
    for (let attempt = 0; attempt < MAX_CHALLENGE_ATTEMPTS; attempt += 1) {
      const result = await verifyChallenge(twoFactorEnv(), request(), { challengeToken: second, code: '000000' });
      if (result.status === 'locked') locked = true;
    }
    expect(locked).toBe(true);

    const row = await env.DB.prepare(
      'SELECT two_factor_failed_count, two_factor_locked_until, failed_login_count, locked_until FROM users WHERE id = ?',
    )
      .bind(user.userId)
      .first<{
        two_factor_failed_count: number;
        two_factor_locked_until: number;
        failed_login_count: number;
        locked_until: number | null;
      }>();
    expect(row?.two_factor_failed_count).toBe(10);
    expect(row?.two_factor_locked_until).toBeGreaterThan(Date.now());
    expect(row?.failed_login_count).toBe(0);
    expect(row?.locked_until).toBeNull();
    const lockAudit = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM audit_events WHERE type = '2fa.locked'",
    ).first<{ count: number }>();
    expect(lockAudit?.count).toBeGreaterThan(0);

    await env.DB.prepare('UPDATE users SET two_factor_locked_until = ? WHERE id = ?')
      .bind(Date.now() - 60_000, user.userId)
      .run();
    const expired = await createChallenge(twoFactorEnv(), user.userId);
    const retried = await verifyChallenge(twoFactorEnv(), request(), { challengeToken: expired, code: '000000' });
    expect(retried.status).toBe('invalid-code');
    const restarted = await env.DB.prepare(
      'SELECT two_factor_failed_count, two_factor_locked_until FROM users WHERE id = ?',
    )
      .bind(user.userId)
      .first<{ two_factor_failed_count: number; two_factor_locked_until: number | null }>();
    expect(restarted).toEqual({ two_factor_failed_count: 1, two_factor_locked_until: null });
    const third = await createChallenge(twoFactorEnv(), user.userId);
    const code = await generateCode(user.secret, currentStep());
    const recovered = await verifyChallenge(twoFactorEnv(), request(), { challengeToken: third, code });
    expect(recovered.status).toBe('ok');
    const cleared = await env.DB.prepare(
      'SELECT two_factor_failed_count, two_factor_locked_until FROM users WHERE id = ?',
    )
      .bind(user.userId)
      .first<{ two_factor_failed_count: number; two_factor_locked_until: number | null }>();
    expect(cleared).toEqual({ two_factor_failed_count: 0, two_factor_locked_until: null });
  });

  it('invalidates the challenge after five failures and allows only one concurrent success', async () => {
    const user = await createTwoFactorUser(1);
    const token = await createChallenge(twoFactorEnv(), user.userId);

    for (let attempt = 1; attempt <= MAX_CHALLENGE_ATTEMPTS; attempt += 1) {
      const result = await verifyChallenge(twoFactorEnv(), request(), { challengeToken: token, code: '000000' });
      expect(result).toMatchObject({
        status: 'invalid-code',
        challengeInvalid: attempt === MAX_CHALLENGE_ATTEMPTS,
      });
    }
    expect(await readChallenge(twoFactorEnv(), token)).toBeNull();

    const concurrentToken = await createChallenge(twoFactorEnv(), user.userId);
    const code = await generateCode(user.secret, currentStep());
    const results = await Promise.all([
      verifyChallenge(twoFactorEnv(), request(), { challengeToken: concurrentToken, code }),
      verifyChallenge(twoFactorEnv(), request(), { challengeToken: concurrentToken, code }),
    ]);

    expect(results.filter((result) => result.status === 'ok')).toHaveLength(1);
    const counter = await env.DB.prepare('SELECT two_factor_failed_count FROM users WHERE id = ?')
      .bind(user.userId)
      .first<{ two_factor_failed_count: number }>();
    expect(counter?.two_factor_failed_count).toBe(0);
  });
});
