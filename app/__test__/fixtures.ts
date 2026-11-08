import { env } from 'cloudflare:workers';

let userCounter = 0;

type TestUserOverrides = {
  email?: string;
  role?: 'admin' | 'member';
  status?: 'active' | 'disabled';
  vaultRev?: number;
  sessionVersion?: number;
};

export const createTestUser = async (overrides: TestUserOverrides = {}) => {
  const id = crypto.randomUUID();
  const now = Date.now();
  userCounter += 1;

  await env.DB.prepare(
    `INSERT INTO users (
      id, email, display_name, auth_hash, server_salt, kdf_alg, kdf_iterations, kdf_salt,
      vault_key_wrapped, vault_key_wrap_iv, role, status, vault_rev, session_version, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      overrides.email ?? `user${userCounter}@example.com`,
      'Test User',
      'auth-hash',
      'server-salt',
      'pbkdf2-sha256',
      600_000,
      'kdf-salt',
      'wrapped-vault-key',
      'wrap-iv',
      overrides.role ?? 'member',
      overrides.status ?? 'active',
      overrides.vaultRev ?? 0,
      overrides.sessionVersion ?? 0,
      now,
      now,
    )
    .run();

  return id;
};

export const createTestFolder = async (userId: string) => {
  const id = crypto.randomUUID();
  const now = Date.now();

  await env.DB.prepare(
    `INSERT INTO folders (id, user_id, name_ct, name_iv, data_version, rev, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, userId, 'folder-ct', 'folder-iv', 1, 1, now, now)
    .run();

  return id;
};

type TestItemOverrides = {
  type?: 'login' | 'note';
  folderId?: string | null;
  rev?: number;
};

export const createTestItem = async (userId: string, overrides: TestItemOverrides = {}) => {
  const id = crypto.randomUUID();
  const now = Date.now();

  await env.DB.prepare(
    `INSERT INTO vault_items (
      id, user_id, folder_id, type, favorite, data_ct, data_iv, data_version, rev, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      userId,
      overrides.folderId ?? null,
      overrides.type ?? 'login',
      0,
      'item-ct',
      'item-iv',
      1,
      overrides.rev ?? 1,
      now,
      now,
    )
    .run();

  return id;
};
