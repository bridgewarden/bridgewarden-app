import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import { createTestUser } from '../../../__test__/fixtures';
import { resetDatabase } from '../../../__test__/reset-database';
import { completeEnrollment } from '../../../features/two-factor/.server/queries/two-factor';
import { findChallenge, insertChallenge, consumeChallengeRow } from '../queries/two-factor-challenges';
import { findSessionUserById, incrementSessionVersion, findLoginUserByEmail } from '../queries/users';
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
