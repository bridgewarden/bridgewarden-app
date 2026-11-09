import { getDatabase } from '../db';

export type NewAdminInput = {
  id: string;
  email: string;
  displayName: string;
  authHash: string;
  serverSalt: string;
  kdfIterations: number;
  kdfSalt: string;
  vaultKeyWrapped: string;
  vaultKeyWrapIv: string;
  recoveryKeyWrapped: string;
  recoveryKeyWrapIv: string;
  createdAt: number;
};

export type LoginUserRow = {
  id: string;
  auth_hash: string;
  server_salt: string;
  status: 'active' | 'disabled';
  two_factor_enabled: number;
  locked_until: number | null;
};

export type KdfUserRow = {
  kdf_alg: 'pbkdf2-sha256';
  kdf_salt: string;
  kdf_iterations: number;
};

export type SessionUserRow = {
  id: string;
  email: string;
  displayName: string | null;
  role: 'admin' | 'member';
  status: 'active' | 'disabled';
  sessionVersion: number;
};

export type LoginCompletionRow = {
  id: string;
  kdf_alg: 'pbkdf2-sha256';
  kdf_salt: string;
  kdf_iterations: number;
  vault_key_wrapped: string;
  vault_key_wrap_iv: string;
  status: 'active' | 'disabled';
  session_version: number;
};

export type UserAuthRow = {
  auth_hash: string;
  server_salt: string;
  status: 'active' | 'disabled';
};

export const findLoginUserByEmail = (db: D1Database, email: string): Promise<LoginUserRow | null> =>
  db
    .prepare(
      `SELECT u.id, u.auth_hash, u.server_salt, u.status,
        COALESCE(t.enabled, 0) AS two_factor_enabled,
        u.locked_until
       FROM users u LEFT JOIN user_2fa t ON t.user_id = u.id
       WHERE u.email = ?`,
    )
    .bind(email)
    .first<LoginUserRow>();

export type LoginFailureState = {
  failed_login_count: number;
  locked_until: number | null;
};

export const recordFailedLogin = async (
  db: D1Database,
  userId: string,
  now: number,
  threshold: number,
  lockMs: number,
): Promise<LoginFailureState | null> => {
  await db
    .prepare(
      `UPDATE users
       SET failed_login_count = CASE
             WHEN locked_until IS NOT NULL AND locked_until <= ? THEN 1
             ELSE failed_login_count + 1
           END,
           locked_until = CASE
             WHEN (CASE WHEN locked_until IS NOT NULL AND locked_until <= ? THEN 1 ELSE failed_login_count + 1 END) >= ?
               THEN ?
             WHEN locked_until IS NOT NULL AND locked_until <= ? THEN NULL
             ELSE locked_until
           END,
           updated_at = ?
       WHERE id = ? AND status = 'active'`,
    )
    .bind(now, now, threshold, now + lockMs, now, now, userId)
    .run();

  return db
    .prepare('SELECT failed_login_count, locked_until FROM users WHERE id = ?')
    .bind(userId)
    .first<LoginFailureState>();
};

export const resetLoginFailures = (db: D1Database, userId: string, now: number): Promise<D1Result> =>
  db
    .prepare('UPDATE users SET failed_login_count = 0, locked_until = NULL, updated_at = ? WHERE id = ?')
    .bind(now, userId)
    .run();

export const findKdfParametersByEmail = (db: D1Database, email: string): Promise<KdfUserRow | null> =>
  db.prepare('SELECT kdf_alg, kdf_salt, kdf_iterations FROM users WHERE email = ?').bind(email).first<KdfUserRow>();

export const findSessionUserById = (db: D1Database, id: string): Promise<SessionUserRow | null> =>
  db
    .prepare(
      'SELECT id, email, display_name AS displayName, role, status, session_version AS sessionVersion FROM users WHERE id = ?',
    )
    .bind(id)
    .first<SessionUserRow>();

export const findLoginCompletionById = (db: D1Database, id: string): Promise<LoginCompletionRow | null> =>
  db
    .prepare(
      `SELECT id, kdf_alg, kdf_salt, kdf_iterations, vault_key_wrapped, vault_key_wrap_iv,
        status, session_version
       FROM users WHERE id = ?`,
    )
    .bind(id)
    .first<LoginCompletionRow>();

export const findUserAuthById = (db: D1Database, id: string): Promise<UserAuthRow | null> =>
  db.prepare('SELECT auth_hash, server_salt, status FROM users WHERE id = ?').bind(id).first<UserAuthRow>();

export const incrementSessionVersion = (db: D1Database, id: string, now: number): Promise<D1Result> =>
  db.prepare('UPDATE users SET session_version = session_version + 1, updated_at = ? WHERE id = ?').bind(now, id).run();

export const countUsers = async (db: D1Database): Promise<number> => {
  const row = await db.prepare('SELECT COUNT(*) AS count FROM users').first<{ count: number }>();
  if (!row) throw new Error('users count unavailable');
  return row.count;
};

export const CREATE_FIRST_ADMIN_SQL = `INSERT INTO users (
  id, email, display_name, auth_hash, server_salt, kdf_alg, kdf_iterations, kdf_salt,
  vault_key_wrapped, vault_key_wrap_iv, recovery_key_wrapped, recovery_key_wrap_iv,
  role, status, vault_rev, failed_login_count, created_at, updated_at
)
SELECT ?, ?, ?, ?, ?, 'pbkdf2-sha256', ?, ?, ?, ?, ?, ?, 'admin', 'active', 0, 0, ?, ?
WHERE NOT EXISTS (SELECT 1 FROM users)`;

export const createFirstAdmin = async (db: D1Database, admin: NewAdminInput): Promise<'created' | 'exists'> => {
  const result = await db
    .prepare(CREATE_FIRST_ADMIN_SQL)
    .bind(
      admin.id,
      admin.email,
      admin.displayName,
      admin.authHash,
      admin.serverSalt,
      admin.kdfIterations,
      admin.kdfSalt,
      admin.vaultKeyWrapped,
      admin.vaultKeyWrapIv,
      admin.recoveryKeyWrapped,
      admin.recoveryKeyWrapIv,
      admin.createdAt,
      admin.createdAt,
    )
    .run();

  return result.meta.changes === 1 ? 'created' : 'exists';
};

export const createUsersQueries = (env: Env) => {
  const db = getDatabase(env);
  return {
    findLoginByEmail: (email: string) => findLoginUserByEmail(db, email),
    recordFailedLogin: (userId: string, now: number, threshold: number, lockMs: number) =>
      recordFailedLogin(db, userId, now, threshold, lockMs),
    resetLoginFailures: (userId: string, now: number) => resetLoginFailures(db, userId, now),
    findKdfByEmail: (email: string) => findKdfParametersByEmail(db, email),
    findSessionUser: (id: string) => findSessionUserById(db, id),
    findLoginCompletion: (id: string) => findLoginCompletionById(db, id),
    findAuthById: (id: string) => findUserAuthById(db, id),
    incrementSessionVersion: (id: string, now: number) => incrementSessionVersion(db, id, now),
    count: () => countUsers(db),
    createFirstAdmin: (admin: NewAdminInput) => createFirstAdmin(db, admin),
  };
};
