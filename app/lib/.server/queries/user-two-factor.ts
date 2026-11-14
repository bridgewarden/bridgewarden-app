import { getDatabase } from '../db';

export type EnrollmentRow = {
  enabled: number;
  totp_secret_ct: string;
  totp_secret_iv: string;
  last_totp_step: number;
  updated_at: number;
};

export type ChallengeUserRow = {
  id: string;
  status: 'active' | 'disabled';
  enabled: number;
  totp_secret_ct: string;
  totp_secret_iv: string;
  last_totp_step: number;
  two_factor_failed_count: number;
  two_factor_locked_until: number | null;
};

export const findTwoFactorEnabled = async (db: D1Database, userId: string): Promise<boolean> => {
  const row = await db
    .prepare('SELECT enabled FROM user_2fa WHERE user_id = ?')
    .bind(userId)
    .first<{ enabled: number }>();
  return row?.enabled === 1;
};

export const findEnrollment = (db: D1Database, userId: string): Promise<EnrollmentRow | null> =>
  db
    .prepare(
      'SELECT enabled, totp_secret_ct, totp_secret_iv, last_totp_step, updated_at FROM user_2fa WHERE user_id = ?',
    )
    .bind(userId)
    .first<EnrollmentRow>();

export const findChallengeUser = (db: D1Database, userId: string): Promise<ChallengeUserRow | null> =>
  db
    .prepare(
      `SELECT u.id, u.status, u.two_factor_failed_count, u.two_factor_locked_until,
              t.enabled, t.totp_secret_ct, t.totp_secret_iv, t.last_totp_step
       FROM users u JOIN user_2fa t ON t.user_id = u.id WHERE u.id = ?`,
    )
    .bind(userId)
    .first<ChallengeUserRow>();

export const upsertPendingEnrollment = (
  db: D1Database,
  userId: string,
  ciphertext: string,
  iv: string,
  now: number,
): Promise<D1Result> =>
  db
    .prepare(
      `INSERT INTO user_2fa (user_id, totp_secret_ct, totp_secret_iv, enabled, last_totp_step, created_at, updated_at)
       VALUES (?, ?, ?, 0, 0, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         totp_secret_ct = excluded.totp_secret_ct,
         totp_secret_iv = excluded.totp_secret_iv,
         enabled = 0,
         last_totp_step = 0,
         updated_at = excluded.updated_at
       WHERE user_2fa.enabled = 0`,
    )
    .bind(userId, ciphertext, iv, now, now)
    .run();

export const deletePendingEnrollment = (db: D1Database, userId: string, cutoff: number): Promise<D1Result> =>
  db.prepare('DELETE FROM user_2fa WHERE user_id = ? AND enabled = 0 AND updated_at < ?').bind(userId, cutoff).run();

export const enableEnrollment = (db: D1Database, userId: string, step: number, now: number): Promise<D1Result> =>
  db
    .prepare('UPDATE user_2fa SET enabled = 1, last_totp_step = ?, updated_at = ? WHERE user_id = ? AND enabled = 0')
    .bind(step, now, userId)
    .run();

export const updateTotpStep = (
  db: D1Database,
  userId: string,
  step: number,
  now: number,
  previousStep: number,
): Promise<D1Result> =>
  db
    .prepare('UPDATE user_2fa SET last_totp_step = ?, updated_at = ? WHERE user_id = ? AND last_totp_step < ?')
    .bind(step, now, userId, previousStep)
    .run();

export const createUserTwoFactorQueries = (env: Env) => {
  const db = getDatabase(env);
  return {
    isEnabled: (userId: string) => findTwoFactorEnabled(db, userId),
    findEnrollment: (userId: string) => findEnrollment(db, userId),
    findChallengeUser: (userId: string) => findChallengeUser(db, userId),
    upsertPending: (userId: string, ciphertext: string, iv: string, now: number) =>
      upsertPendingEnrollment(db, userId, ciphertext, iv, now),
    deletePending: (userId: string, cutoff: number) => deletePendingEnrollment(db, userId, cutoff),
    updateStep: (userId: string, step: number, now: number, previousStep: number) =>
      updateTotpStep(db, userId, step, now, previousStep),
  };
};
