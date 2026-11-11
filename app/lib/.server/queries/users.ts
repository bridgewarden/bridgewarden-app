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
  recoveryAuthHash: string;
  recoveryServerSalt: string;
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

export type PasswordChangeRow = {
  auth_hash: string;
  server_salt: string;
  status: 'active' | 'disabled';
  session_version: number;
  locked_until: number | null;
  kdf_salt: string;
  kdf_iterations: number;
  vault_key_wrapped: string;
  vault_key_wrap_iv: string;
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

export type AdminUserRow = {
  id: string;
  email: string;
  displayName: string | null;
  role: 'admin' | 'member';
  status: 'active' | 'disabled';
  twoFactorEnabled: number;
  createdAt: number;
};

export const listAdminUsers = (db: D1Database, limit: number): Promise<AdminUserRow[]> =>
  db
    .prepare(
      `SELECT u.id, u.email, u.display_name AS displayName, u.role, u.status,
        COALESCE(t.enabled, 0) AS twoFactorEnabled, u.created_at AS createdAt
       FROM users u LEFT JOIN user_2fa t ON t.user_id = u.id
       ORDER BY u.created_at ASC LIMIT ?`,
    )
    .bind(limit)
    .all<AdminUserRow>()
    .then((result) => result.results ?? []);

export const findUserByEmail = (db: D1Database, email: string): Promise<{ id: string } | null> =>
  db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first<{ id: string }>();

export const disableUserGuarded = (db: D1Database, id: string, now: number): Promise<D1Result> =>
  db
    .prepare(
      `UPDATE users SET status = 'disabled', session_version = session_version + 1, updated_at = ?
       WHERE id = ? AND (
         role != 'admin' OR (SELECT COUNT(*) FROM users WHERE role = 'admin' AND status = 'active') > 1
       )`,
    )
    .bind(now, id)
    .run();

export const enableUser = (db: D1Database, id: string, now: number): Promise<D1Result> =>
  db.prepare("UPDATE users SET status = 'active', updated_at = ? WHERE id = ?").bind(now, id).run();

export const revokeUserSessions = (db: D1Database, id: string, now: number): Promise<D1Result> =>
  db.prepare('UPDATE users SET session_version = session_version + 1, updated_at = ? WHERE id = ?').bind(now, id).run();

export const changeRoleGuarded = (
  db: D1Database,
  id: string,
  role: 'admin' | 'member',
  now: number,
): Promise<D1Result> =>
  db
    .prepare(
      `UPDATE users SET role = ?, session_version = session_version + 1, updated_at = ?
       WHERE id = ? AND (
         ? = 'admin' OR role != 'admin' OR status = 'disabled' OR
         (SELECT COUNT(*) FROM users WHERE role = 'admin' AND status = 'active') > 1
       )`,
    )
    .bind(role, now, id, role)
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

export type StepUpStateRow = {
  auth_hash: string;
  server_salt: string;
  status: 'active' | 'disabled';
  step_up_failed_count: number;
  step_up_locked_until: number | null;
};

export const findStepUpState = (db: D1Database, id: string): Promise<StepUpStateRow | null> =>
  db
    .prepare(
      `SELECT auth_hash, server_salt, status, step_up_failed_count, step_up_locked_until
       FROM users WHERE id = ?`,
    )
    .bind(id)
    .first<StepUpStateRow>();

export const reserveStepUpAttempt = (
  db: D1Database,
  id: string,
  now: number,
  maxAttempts: number,
  durationMs: number,
): Promise<{ failed_count: number; locked_until: number | null } | null> =>
  db
    .prepare(
      `UPDATE users
       SET step_up_failed_count = step_up_failed_count + 1,
           step_up_locked_until = CASE
             WHEN step_up_failed_count + 1 >= ? THEN ?
             ELSE step_up_locked_until
           END,
           updated_at = ?
       WHERE id = ?
         AND status = 'active'
         AND (step_up_locked_until IS NULL OR step_up_locked_until <= ?)
       RETURNING step_up_failed_count AS failed_count, step_up_locked_until AS locked_until`,
    )
    .bind(maxAttempts, now + durationMs, now, id, now)
    .first<{ failed_count: number; locked_until: number | null }>();

export const resetStepUpFailures = (db: D1Database, id: string, now: number): Promise<D1Result> =>
  db
    .prepare('UPDATE users SET step_up_failed_count = 0, step_up_locked_until = NULL, updated_at = ? WHERE id = ?')
    .bind(now, id)
    .run();

export const findPasswordKdfById = (
  db: D1Database,
  id: string,
): Promise<{ kdf_salt: string; kdf_iterations: number } | null> =>
  db.prepare('SELECT kdf_salt, kdf_iterations FROM users WHERE id = ?').bind(id).first();

export const findPasswordChangeState = (db: D1Database, id: string): Promise<PasswordChangeRow | null> =>
  db
    .prepare(
      `SELECT auth_hash, server_salt, status, session_version, locked_until, kdf_salt, kdf_iterations,
        vault_key_wrapped, vault_key_wrap_iv
       FROM users WHERE id = ?`,
    )
    .bind(id)
    .first<PasswordChangeRow>();

export type RotatePasswordInput = {
  authHash: string;
  serverSalt: string;
  kdfSalt: string;
  kdfIterations: number;
  vaultKeyWrapped: string;
  vaultKeyWrapIv: string;
};

export const rotatePassword = (
  db: D1Database,
  id: string,
  input: RotatePasswordInput,
  now: number,
  expectedAuthHash: string,
  expectedServerSalt: string,
): Promise<D1Result> =>
  db
    .prepare(
      `UPDATE users
       SET auth_hash = ?, server_salt = ?, kdf_alg = 'pbkdf2-sha256',
           kdf_salt = ?, kdf_iterations = ?, vault_key_wrapped = ?, vault_key_wrap_iv = ?,
           session_version = session_version + 1,
           failed_login_count = 0, locked_until = NULL, updated_at = ?
       WHERE id = ? AND status = 'active' AND auth_hash = ? AND server_salt = ?`,
    )
    .bind(
      input.authHash,
      input.serverSalt,
      input.kdfSalt,
      input.kdfIterations,
      input.vaultKeyWrapped,
      input.vaultKeyWrapIv,
      now,
      id,
      expectedAuthHash,
      expectedServerSalt,
    )
    .run();

export type RecoveryLookupRow = {
  id: string;
  status: 'active' | 'disabled';
  recovery_key_wrapped: string | null;
  recovery_key_wrap_iv: string | null;
};

export const findRecoveryLookupByEmail = (db: D1Database, email: string): Promise<RecoveryLookupRow | null> =>
  db
    .prepare('SELECT id, status, recovery_key_wrapped, recovery_key_wrap_iv FROM users WHERE email = ?')
    .bind(email)
    .first<RecoveryLookupRow>();

export type RecoveryStateRow = {
  id: string;
  status: 'active' | 'disabled';
  recovery_auth_hash: string | null;
  recovery_server_salt: string | null;
};

export const findRecoveryStateByEmail = (db: D1Database, email: string): Promise<RecoveryStateRow | null> =>
  db
    .prepare('SELECT id, status, recovery_auth_hash, recovery_server_salt FROM users WHERE email = ?')
    .bind(email)
    .first<RecoveryStateRow>();

export type ResetRecoveryInput = {
  authHash: string;
  serverSalt: string;
  kdfSalt: string;
  kdfIterations: number;
  vaultKeyWrapped: string;
  vaultKeyWrapIv: string;
  recoveryKeyWrapped: string;
  recoveryKeyWrapIv: string;
  recoveryAuthHash: string;
  recoveryServerSalt: string;
};

export const resetRecovery = (
  db: D1Database,
  id: string,
  input: ResetRecoveryInput,
  now: number,
  expectedRecoveryAuthHash: string,
  expectedRecoveryServerSalt: string,
): Promise<D1Result> =>
  db
    .prepare(
      `UPDATE users
       SET auth_hash = ?, server_salt = ?, kdf_alg = 'pbkdf2-sha256',
           kdf_salt = ?, kdf_iterations = ?, vault_key_wrapped = ?, vault_key_wrap_iv = ?,
           recovery_key_wrapped = ?, recovery_key_wrap_iv = ?,
           recovery_auth_hash = ?, recovery_server_salt = ?,
           session_version = session_version + 1,
           failed_login_count = 0, locked_until = NULL, updated_at = ?
       WHERE id = ? AND status = 'active'
         AND recovery_auth_hash = ? AND recovery_server_salt = ?`,
    )
    .bind(
      input.authHash,
      input.serverSalt,
      input.kdfSalt,
      input.kdfIterations,
      input.vaultKeyWrapped,
      input.vaultKeyWrapIv,
      input.recoveryKeyWrapped,
      input.recoveryKeyWrapIv,
      input.recoveryAuthHash,
      input.recoveryServerSalt,
      now,
      id,
      expectedRecoveryAuthHash,
      expectedRecoveryServerSalt,
    )
    .run();

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
  recovery_auth_hash, recovery_server_salt,
  role, status, vault_rev, failed_login_count, created_at, updated_at
)
SELECT ?, ?, ?, ?, ?, 'pbkdf2-sha256', ?, ?, ?, ?, ?, ?, ?, ?, 'admin', 'active', 0, 0, ?, ?
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
      admin.recoveryAuthHash,
      admin.recoveryServerSalt,
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
    listAdmin: (limit: number) => listAdminUsers(db, limit),
    findIdByEmail: (email: string) => findUserByEmail(db, email),
    disableGuarded: (id: string, now: number) => disableUserGuarded(db, id, now),
    enable: (id: string, now: number) => enableUser(db, id, now),
    revokeSessions: (id: string, now: number) => revokeUserSessions(db, id, now),
    changeRoleGuarded: (id: string, role: 'admin' | 'member', now: number) => changeRoleGuarded(db, id, role, now),
    findSessionUser: (id: string) => findSessionUserById(db, id),
    findLoginCompletion: (id: string) => findLoginCompletionById(db, id),
    findStepUpState: (id: string) => findStepUpState(db, id),
    reserveStepUpAttempt: (id: string, now: number, maxAttempts: number, durationMs: number) =>
      reserveStepUpAttempt(db, id, now, maxAttempts, durationMs),
    resetStepUpFailures: (id: string, now: number) => resetStepUpFailures(db, id, now),
    findPasswordChangeState: (id: string) => findPasswordChangeState(db, id),
    rotatePassword: (
      id: string,
      input: RotatePasswordInput,
      now: number,
      expectedAuthHash: string,
      expectedServerSalt: string,
    ) => rotatePassword(db, id, input, now, expectedAuthHash, expectedServerSalt),
    findPasswordKdf: (id: string) => findPasswordKdfById(db, id),
    findRecoveryLookup: (email: string) => findRecoveryLookupByEmail(db, email),
    findRecoveryState: (email: string) => findRecoveryStateByEmail(db, email),
    resetRecovery: (
      id: string,
      input: ResetRecoveryInput,
      now: number,
      expectedRecoveryAuthHash: string,
      expectedRecoveryServerSalt: string,
    ) => resetRecovery(db, id, input, now, expectedRecoveryAuthHash, expectedRecoveryServerSalt),
    incrementSessionVersion: (id: string, now: number) => incrementSessionVersion(db, id, now),
    count: () => countUsers(db),
    createFirstAdmin: (admin: NewAdminInput) => createFirstAdmin(db, admin),
  };
};
