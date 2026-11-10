import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import { createTestUser } from '../../../__test__/fixtures';
import { resetDatabase } from '../../../__test__/reset-database';
import { completeEnrollment } from '../../../features/two-factor/.server/queries/two-factor';
import { findChallenge, insertChallenge, consumeChallengeRow } from '../queries/two-factor-challenges';
import {
  findSessionUserById,
  incrementSessionVersion,
  findLoginUserByEmail,
  rotatePassword,
  recordFailedLogin,
  resetLoginFailures,
} from '../queries/users';
import {
  findEnrollment,
  createUserTwoFactorQueries,
  findTwoFactorEnabled,
  upsertPendingEnrollment,
  updateTotpStep,
} from '../queries/user-two-factor';

const db = env.DB;
const testEnv = () => env as unknown as Env;

beforeEach(async () => {
  await resetDatabase();
});

describe('user queries', () => {
  it('finds users by email/session id and increments the session version', async () => {
    const userId = await createTestUser({ email: 'query@example.com' });
    const login = await findLoginUserByEmail(db, 'query@example.com');
    const session = await findSessionUserById(db, userId);

    expect(login).toMatchObject({ id: userId, status: 'active', two_factor_enabled: 0 });
    expect(session).toMatchObject({ id: userId, email: 'query@example.com' });

    await incrementSessionVersion(db, userId, Date.now());
    expect((await findSessionUserById(db, userId))?.sessionVersion).toBe(1);
  });

  it('rotates password material and increments the session version atomically', async () => {
    const userId = await createTestUser({ email: 'rotate@example.com' });
    await env.DB.prepare('UPDATE users SET auth_hash = ?, server_salt = ? WHERE id = ?')
      .bind('old-auth', 'old-salt', userId)
      .run();
    const result = await rotatePassword(
      db,
      userId,
      {
        authHash: 'new-auth',
        serverSalt: 'new-server-salt',
        kdfSalt: 'new-kdf-salt',
        kdfIterations: 600_000,
        vaultKeyWrapped: 'new-wrapped',
        vaultKeyWrapIv: 'new-iv',
      },
      Date.now(),
      'old-auth',
      'old-salt',
    );

    const stale = await rotatePassword(
      db,
      userId,
      {
        authHash: 'other-auth',
        serverSalt: 'other-server-salt',
        kdfSalt: 'other-kdf-salt',
        kdfIterations: 600_000,
        vaultKeyWrapped: 'other-wrapped',
        vaultKeyWrapIv: 'other-iv',
      },
      Date.now(),
      'old-auth',
      'old-salt',
    );

    expect(result.meta.changes).toBe(1);
    expect(stale.meta.changes).toBe(0);
    const row = await env.DB.prepare(
      'SELECT auth_hash, kdf_salt, vault_key_wrapped, session_version FROM users WHERE id = ?',
    )
      .bind(userId)
      .first<{ auth_hash: string; kdf_salt: string; vault_key_wrapped: string; session_version: number }>();
    expect(row).toMatchObject({
      auth_hash: 'new-auth',
      kdf_salt: 'new-kdf-salt',
      vault_key_wrapped: 'new-wrapped',
      session_version: 1,
    });
  });

  it('rejects password rotation for a disabled account', async () => {
    const userId = await createTestUser({ email: 'disabled-rotate@example.com', status: 'disabled' });
    const result = await rotatePassword(
      db,
      userId,
      {
        authHash: 'new-auth',
        serverSalt: 'new-server-salt',
        kdfSalt: 'new-kdf-salt',
        kdfIterations: 600_000,
        vaultKeyWrapped: 'new-wrapped',
        vaultKeyWrapIv: 'new-iv',
      },
      Date.now(),
      'auth-hash',
      'server-salt',
    );

    expect(result.meta.changes).toBe(0);
  });

  it('records failures atomically, locks at the threshold, and resets', async () => {
    const userId = await createTestUser({ email: 'lockout-query@example.com' });
    const now = Date.now();

    for (let attempt = 1; attempt < 10; attempt += 1) {
      const state = await recordFailedLogin(db, userId, now, 10, 900_000);
      expect(state?.failed_login_count).toBe(attempt);
      expect(state?.locked_until).toBeNull();
    }

    const locked = await recordFailedLogin(db, userId, now, 10, 900_000);
    expect(locked?.failed_login_count).toBe(10);
    expect(locked?.locked_until).toBe(now + 900_000);

    await resetLoginFailures(db, userId, now);
    const reset = await env.DB.prepare('SELECT failed_login_count, locked_until FROM users WHERE id = ?')
      .bind(userId)
      .first<{ failed_login_count: number; locked_until: number | null }>();
    expect(reset).toEqual({ failed_login_count: 0, locked_until: null });
  });

  it('cannot bypass the threshold with concurrent failures', async () => {
    const userId = await createTestUser({ email: 'lockout-concurrent@example.com' });
    const now = Date.now();

    await Promise.all(Array.from({ length: 20 }, () => recordFailedLogin(db, userId, now, 10, 900_000)));

    const state = await env.DB.prepare('SELECT failed_login_count, locked_until FROM users WHERE id = ?')
      .bind(userId)
      .first<{ failed_login_count: number; locked_until: number | null }>();
    expect(state?.failed_login_count).toBe(20);
    expect(state?.locked_until).toBe(now + 900_000);
  });

  it('starts a new consecutive window after an expired lock', async () => {
    const userId = await createTestUser({ email: 'lockout-expired@example.com' });
    const now = Date.now();

    for (let attempt = 0; attempt < 10; attempt += 1) {
      await recordFailedLogin(db, userId, now, 10, 900_000);
    }

    const afterExpiry = await recordFailedLogin(db, userId, now + 900_001, 10, 900_000);
    expect(afterExpiry?.failed_login_count).toBe(1);
    expect(afterExpiry?.locked_until).toBeNull();
  });
});

describe('two-factor queries', () => {
  it('does not replace backup codes when a second enable loses the race', async () => {
    const userId = await createTestUser({ email: 'two-factor-race@example.com' });
    await upsertPendingEnrollment(db, userId, 'ciphertext', 'iv', Date.now());

    expect(await completeEnrollment(db, userId, 10, Date.now(), ['winner'])).toBe(true);
    expect(await completeEnrollment(db, userId, 10, Date.now(), ['loser'])).toBe(false);

    const rows = await env.DB.prepare('SELECT code_hash FROM backup_codes WHERE user_id = ?')
      .bind(userId)
      .all<{ code_hash: string }>();
    expect(rows.results?.map((row) => row.code_hash)).toEqual(['winner']);
  });

  it('stores a pending seed, enables it, and updates the TOTP step', async () => {
    const userId = await createTestUser({ email: 'two-factor-query@example.com' });
    await upsertPendingEnrollment(db, userId, 'ciphertext', 'iv', Date.now());

    expect(await findTwoFactorEnabled(db, userId)).toBe(false);
    expect(await findEnrollment(db, userId)).toMatchObject({ enabled: 0, totp_secret_ct: 'ciphertext' });

    expect(await completeEnrollment(db, userId, 10, Date.now(), ['hash-1'])).toBe(true);
    expect(await createUserTwoFactorQueries(testEnv()).isEnabled(userId)).toBe(true);
    expect((await findEnrollment(db, userId))?.last_totp_step).toBe(10);

    await updateTotpStep(db, userId, 11, Date.now(), 11);
    expect((await findEnrollment(db, userId))?.last_totp_step).toBe(11);
    await updateTotpStep(db, userId, 11, Date.now(), 11);
    expect((await findEnrollment(db, userId))?.last_totp_step).toBe(11);
  });
});

describe('challenge queries', () => {
  it('inserts, reads, and consumes a challenge row', async () => {
    const userId = await createTestUser({ email: 'challenge-query@example.com' });
    await insertChallenge(db, 'hash', userId, Date.now() + 60_000);

    expect(await findChallenge(db, 'hash')).toMatchObject({ user_id: userId, attempts: 0 });
    expect((await consumeChallengeRow(db, 'hash', Date.now(), 5)).meta.changes).toBe(1);
    expect(await findChallenge(db, 'hash')).toBeNull();
  });
});
