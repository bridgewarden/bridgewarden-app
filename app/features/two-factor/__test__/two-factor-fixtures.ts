import { env } from 'cloudflare:workers';

import { createAuthUser } from '../../../__test__/auth-fixtures';
import { encryptTotpSecret } from '../../../lib/.server/totp-crypto';

export const TEST_PEPPER = 'test-auth-pepper';
export const TEST_SESSION_SECRET = 'test-session-secret';
export const TEST_TOTP_KEY = 'test-totp-encryption-key-material';
export const TEST_ISSUER = 'Bridgewarden';

export const twoFactorEnv = (overrides: Record<string, unknown> = {}) =>
  ({
    DB: env.DB,
    KV_SESSIONS: env.KV_SESSIONS,
    AUTH_PEPPER: TEST_PEPPER,
    SESSION_SECRET: TEST_SESSION_SECRET,
    TOTP_ENC_KEY: TEST_TOTP_KEY,
    TOTP_ISSUER: TEST_ISSUER,
    ...overrides,
  }) as unknown as Env;

export const seedTotp = async (userId: string, secret: Uint8Array, enabled = 1, lastStep = 0) => {
  const encrypted = await encryptTotpSecret(twoFactorEnv(), userId, secret);
  const now = Date.now();

  await env.DB.prepare(
    `INSERT INTO user_2fa (user_id, totp_secret_ct, totp_secret_iv, enabled, last_totp_step, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       totp_secret_ct = excluded.totp_secret_ct,
       totp_secret_iv = excluded.totp_secret_iv,
       enabled = excluded.enabled,
       last_totp_step = excluded.last_totp_step,
       updated_at = excluded.updated_at`,
  )
    .bind(userId, encrypted.ciphertext, encrypted.iv, enabled, lastStep, now, now)
    .run();
};

export const createTwoFactorUser = async (enabled = 1) => {
  const user = await createAuthUser({ email: `2fa-${crypto.randomUUID()}@example.com` });
  const secret = crypto.getRandomValues(new Uint8Array(20));
  await seedTotp(user.userId, secret, enabled);

  return { ...user, secret };
};

export const clearAuthKv = async () => {
  const list = await env.KV_SESSIONS.list();
  await Promise.all(list.keys.map((key) => env.KV_SESSIONS.delete(key.name)));
};
