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

export type CreateAdminResult = 'created' | 'exists';

export const isBootstrapAvailable = async (db: D1Database): Promise<boolean> => {
  const row = await db.prepare('SELECT COUNT(*) AS count FROM users').first<{ count: number }>();

  return (row?.count ?? 0) === 0;
};

export const CREATE_FIRST_ADMIN_SQL = `INSERT INTO users (
  id, email, display_name, auth_hash, server_salt, kdf_alg, kdf_iterations, kdf_salt,
  vault_key_wrapped, vault_key_wrap_iv, recovery_key_wrapped, recovery_key_wrap_iv,
  role, status, vault_rev, failed_login_count, created_at, updated_at
)
SELECT ?, ?, ?, ?, ?, 'pbkdf2-sha256', ?, ?, ?, ?, ?, ?, 'admin', 'active', 0, 0, ?, ?
WHERE NOT EXISTS (SELECT 1 FROM users)`;

export const createFirstAdmin = async (db: D1Database, admin: NewAdminInput): Promise<CreateAdminResult> => {
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
