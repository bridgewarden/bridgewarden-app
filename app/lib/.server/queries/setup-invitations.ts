import { getDatabase } from '../db';

export type PendingInvitationRow = {
  id: string;
  email: string;
  display_name: string;
  role: 'admin' | 'member';
  expires_at: number;
  created_at: number;
};

export type SetupInvitationRow = {
  id: string;
  email: string;
  display_name: string;
  role: 'admin' | 'member';
  token_hash: string;
  invited_by_id: string;
  expires_at: number;
  consumed_at: number | null;
  created_at: number;
};

export type NewInvitation = {
  id: string;
  email: string;
  displayName: string;
  role: 'admin' | 'member';
  tokenHash: string;
  invitedById: string;
  expiresAt: number;
  now: number;
};

export type InvitedUser = {
  id: string;
  email: string;
  displayName: string;
  role: 'admin' | 'member';
  authHash: string;
  serverSalt: string;
  kdfIterations: number;
  kdfSalt: string;
  vaultKeyWrapped: string;
  vaultKeyWrapIv: string;
  recoveryKeyWrapped: string;
  recoveryKeyWrapIv: string;
  now: number;
};

export const upsertInvitation = async (db: D1Database, input: NewInvitation): Promise<boolean> => {
  const result = await db
    .prepare(
      `INSERT INTO setup_invitations
        (id, email, display_name, role, token_hash, invited_by_id, expires_at, consumed_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)
       ON CONFLICT(email) DO UPDATE SET
         display_name = excluded.display_name,
         role = excluded.role,
         token_hash = excluded.token_hash,
         invited_by_id = excluded.invited_by_id,
         expires_at = excluded.expires_at,
         consumed_at = NULL,
         created_at = excluded.created_at
       WHERE setup_invitations.consumed_at IS NULL`,
    )
    .bind(
      input.id,
      input.email,
      input.displayName,
      input.role,
      input.tokenHash,
      input.invitedById,
      input.expiresAt,
      input.now,
    )
    .run();

  return result.meta.changes === 1;
};

export const findValidInvitation = (
  db: D1Database,
  tokenHash: string,
  now: number,
): Promise<SetupInvitationRow | null> =>
  db
    .prepare('SELECT * FROM setup_invitations WHERE token_hash = ? AND consumed_at IS NULL AND expires_at > ? LIMIT 1')
    .bind(tokenHash, now)
    .first<SetupInvitationRow>();

export const listPendingInvitations = (db: D1Database, now: number): Promise<SetupInvitationRow[]> =>
  db
    .prepare('SELECT * FROM setup_invitations WHERE consumed_at IS NULL AND expires_at > ? ORDER BY created_at DESC')
    .bind(now)
    .all<SetupInvitationRow>()
    .then((result) => result.results ?? []);

export const revokeInvitation = (db: D1Database, id: string, now: number): Promise<D1Result> =>
  db.prepare('UPDATE setup_invitations SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL').bind(now, id).run();

export const acceptInvitation = async (
  db: D1Database,
  tokenHash: string,
  now: number,
  user: InvitedUser,
): Promise<boolean> => {
  const marker = now * 1000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 1000);
  const results = await db.batch([
    db
      .prepare(
        'UPDATE setup_invitations SET consumed_at = ? WHERE token_hash = ? AND consumed_at IS NULL AND expires_at > ?',
      )
      .bind(marker, tokenHash, now),
    db
      .prepare(
        `INSERT INTO users (
          id, email, display_name, auth_hash, server_salt, kdf_alg, kdf_iterations, kdf_salt,
          vault_key_wrapped, vault_key_wrap_iv, recovery_key_wrapped, recovery_key_wrap_iv,
          role, status, vault_rev, failed_login_count, locked_until, created_at, updated_at
        )
        SELECT ?, ?, ?, ?, ?, 'pbkdf2-sha256', ?, ?, ?, ?, ?, ?, ?, 'active', 0, 0, NULL, ?, ?
        WHERE EXISTS (
          SELECT 1 FROM setup_invitations WHERE token_hash = ? AND consumed_at = ? AND expires_at > ?
        )`,
      )
      .bind(
        user.id,
        user.email,
        user.displayName,
        user.authHash,
        user.serverSalt,
        user.kdfIterations,
        user.kdfSalt,
        user.vaultKeyWrapped,
        user.vaultKeyWrapIv,
        user.recoveryKeyWrapped,
        user.recoveryKeyWrapIv,
        user.role,
        user.now,
        user.now,
        tokenHash,
        marker,
        now,
      ),
  ]);

  return results[0]?.meta.changes === 1 && results[1]?.meta.changes === 1;
};

export const createSetupInvitationQueries = (env: Env) => {
  const db = getDatabase(env);
  return {
    upsert: (input: NewInvitation) => upsertInvitation(db, input),
    findValid: (hash: string, now: number) => findValidInvitation(db, hash, now),
    listPending: (now: number) => listPendingInvitations(db, now),
    accept: (hash: string, now: number, user: InvitedUser) => acceptInvitation(db, hash, now, user),
  };
};
