import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import { resetDatabase } from '../../../__test__/reset-database';
import { CREATE_FIRST_ADMIN_SQL, countUsers, createFirstAdmin, type NewAdminInput } from '../queries/users';

const adminInput = (overrides: Partial<NewAdminInput> = {}): NewAdminInput => ({
  id: crypto.randomUUID(),
  email: 'admin@example.com',
  displayName: 'Administrator',
  authHash: 'peppered-hash',
  serverSalt: 'server-salt',
  kdfIterations: 600_000,
  kdfSalt: 'kdf-salt',
  vaultKeyWrapped: 'vault-key-wrapped',
  vaultKeyWrapIv: 'vault-key-iv',
  recoveryKeyWrapped: 'recovery-key-wrapped',
  recoveryKeyWrapIv: 'recovery-key-iv',
  recoveryAuthHash: 'recovery-auth-hash',
  recoveryServerSalt: 'recovery-server-salt',
  createdAt: 1_700_000_000_000,
  ...overrides,
});

beforeEach(async () => {
  await resetDatabase();
});

describe('bootstrap guard', () => {
  it('is available only while the users table is empty', async () => {
    expect((await countUsers(env.DB)) === 0).toBe(true);

    expect(await createFirstAdmin(env.DB, adminInput())).toBe('created');
    expect((await countUsers(env.DB)) === 0).toBe(false);
  });

  it('stores the admin with constrained defaults and supplied key fields', async () => {
    const admin = adminInput();

    expect(await createFirstAdmin(env.DB, admin)).toBe('created');

    const row = await env.DB.prepare(
      `SELECT email, display_name, auth_hash, server_salt, kdf_alg, kdf_iterations, kdf_salt,
        vault_key_wrapped, vault_key_wrap_iv, recovery_key_wrapped, recovery_key_wrap_iv,
        recovery_auth_hash, recovery_server_salt, role, status, vault_rev, failed_login_count, locked_until, created_at, updated_at
       FROM users WHERE id = ?`,
    )
      .bind(admin.id)
      .first();

    expect(row).toEqual({
      email: admin.email,
      display_name: admin.displayName,
      auth_hash: admin.authHash,
      server_salt: admin.serverSalt,
      kdf_alg: 'pbkdf2-sha256',
      kdf_iterations: admin.kdfIterations,
      kdf_salt: admin.kdfSalt,
      vault_key_wrapped: admin.vaultKeyWrapped,
      vault_key_wrap_iv: admin.vaultKeyWrapIv,
      recovery_key_wrapped: admin.recoveryKeyWrapped,
      recovery_key_wrap_iv: admin.recoveryKeyWrapIv,
      recovery_auth_hash: admin.recoveryAuthHash,
      recovery_server_salt: admin.recoveryServerSalt,
      role: 'admin',
      status: 'active',
      vault_rev: 0,
      failed_login_count: 0,
      locked_until: null,
      created_at: admin.createdAt,
      updated_at: admin.createdAt,
    });
  });

  it('guards the write with a single conditional insert', () => {
    expect(CREATE_FIRST_ADMIN_SQL).toContain('WHERE NOT EXISTS (SELECT 1 FROM users)');
    expect(CREATE_FIRST_ADMIN_SQL).not.toContain('COUNT(*)');
  });

  it('creates exactly one admin under concurrent requests', async () => {
    const results = await Promise.all([
      createFirstAdmin(env.DB, adminInput({ email: 'first@example.com' })),
      createFirstAdmin(env.DB, adminInput({ email: 'second@example.com' })),
    ]);

    const count = await env.DB.prepare('SELECT COUNT(*) AS count FROM users').first<{ count: number }>();
    const twoFactor = await env.DB.prepare('SELECT COUNT(*) AS count FROM user_2fa').first<{ count: number }>();

    expect(twoFactor?.count).toBe(0);
    expect(results.filter((result) => result === 'created')).toHaveLength(1);
    expect(results.filter((result) => result === 'exists')).toHaveLength(1);
    expect(count?.count).toBe(1);
  });
});
