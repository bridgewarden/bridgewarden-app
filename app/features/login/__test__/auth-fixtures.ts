import { env } from 'cloudflare:workers';

import { createTestUser } from '../../../__test__/fixtures';
import { encodeBase64 } from '../../../lib/crypto/encoding';
import { deriveServerAuthHash } from '../../../lib/.server/auth-hash';

export const TEST_PEPPER = 'test-auth-pepper';
export const TEST_SESSION_SECRET = 'test-session-secret';

export const testEnv = (overrides: Record<string, unknown> = {}) =>
  ({
    DB: env.DB,
    KV_SESSIONS: env.KV_SESSIONS,
    AUTH_PEPPER: TEST_PEPPER,
    SESSION_SECRET: TEST_SESSION_SECRET,
    ...overrides,
  }) as unknown as Env;

export const createAuthUser = async (overrides: { email?: string; status?: 'active' | 'disabled' } = {}) => {
  const authHash = crypto.getRandomValues(new Uint8Array(32));
  const serverSalt = crypto.getRandomValues(new Uint8Array(16));
  const derived = await deriveServerAuthHash(authHash, serverSalt, TEST_PEPPER);
  const email = overrides.email ?? 'auth@example.com';
  const userId = await createTestUser({ ...overrides, email });

  await env.DB.prepare(
    `UPDATE users SET auth_hash = ?, server_salt = ?, kdf_salt = ?, kdf_iterations = 600000,
      vault_key_wrapped = ?, vault_key_wrap_iv = ? WHERE id = ?`,
  )
    .bind(
      derived.authHash,
      derived.serverSalt,
      encodeBase64(crypto.getRandomValues(new Uint8Array(16))),
      encodeBase64(crypto.getRandomValues(new Uint8Array(48))),
      encodeBase64(crypto.getRandomValues(new Uint8Array(12))),
      userId,
    )
    .run();

  return { userId, authHash, email };
};

export const clearSessions = async () => {
  const list = await env.KV_SESSIONS.list({ prefix: 'session:' });
  await Promise.all(list.keys.map((key) => env.KV_SESSIONS.delete(key.name)));
};
